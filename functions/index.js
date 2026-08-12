import { createHmac, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const region = "us-central1";
const rpName = "Florida Quantum Computing";
const challengeLifetimeMs = 5 * 60 * 1000;
const officerRosterSpreadsheetId = "1USQju8bWHgXu6X95-NVh6PAGp6GyjCNPqecfTPBTx50";
const officerRosterSheetName = "Officer Access";
const officerRosterCacheMs = 5 * 60 * 1000;
const officerUfidPepper = defineSecret("OFFICER_UFID_PEPPER");
let officerRosterCache = { expiresAt: 0, entries: [] };
const allowedOrigins = new Map([
  ["https://florida-quantum-computing.web.app", "florida-quantum-computing.web.app"],
  ["https://florida-quantum-computing.firebaseapp.com", "florida-quantum-computing.firebaseapp.com"],
  ["http://127.0.0.1:4175", "127.0.0.1"],
  ["http://localhost:4175", "localhost"]
]);

const callableOptions = {
  region,
  cors: [...allowedOrigins.keys()],
  maxInstances: 10
};
const ufidCallableOptions = { ...callableOptions, secrets: [officerUfidPepper] };

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in is required.");
  return request.auth;
}

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function profileRole(value) {
  return value === "officer" ? "officer" : "member";
}

export function leadershipForRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "president") return "president";
  if (normalized === "vice president" || normalized === "vice-president" || normalized === "vp") return "vice_president";
  if (normalized === "treasurer") return "treasurer";
  return "";
}

export function canManageOfficerRoles(token = {}) {
  return token.manageOfficers === true || token.leadership === "president" || token.leadership === "treasurer";
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function rosterUrl() {
  const sheet = encodeURIComponent(officerRosterSheetName);
  return `https://docs.google.com/spreadsheets/d/${officerRosterSpreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
}

async function loadOfficerRoster() {
  if (officerRosterCache.expiresAt > Date.now()) return officerRosterCache.entries;
  const response = await fetch(rosterUrl(), { headers: { accept: "text/csv" } });
  if (!response.ok) throw new HttpsError("unavailable", "The officer roster is temporarily unavailable.");
  const csv = await response.text();
  if (csv.length > 250_000) throw new HttpsError("data-loss", "The officer roster is unexpectedly large.");
  const [headers = [], ...rows] = parseCsv(csv);
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header.trim().toLowerCase(), index]));
  const entries = rows.map((row) => ({
    name: cleanText(row[headerIndex["officer name"]], 80),
    role: cleanText(row[headerIndex.role], 80),
    fingerprint: cleanText(row[headerIndex["ufid fingerprint"]], 64).toLowerCase(),
    active: /^(yes|true|1|active)$/i.test(cleanText(row[headerIndex.active], 12))
  })).filter((entry) => entry.active && entry.role && /^[a-f0-9]{64}$/.test(entry.fingerprint));
  officerRosterCache = { expiresAt: Date.now() + officerRosterCacheMs, entries };
  return entries;
}

export function resolvedAccess(existing = {}, rosterEntry = null) {
  const rosterLeadership = leadershipForRole(rosterEntry?.role);
  if (rosterLeadership) {
    return {
      role: "officer",
      leadership: rosterLeadership,
      officerTitle: rosterEntry.role,
      canManageOfficers: rosterLeadership === "president" || rosterLeadership === "treasurer"
    };
  }
  if (existing.roleOverride === "officer") {
    return { role: "officer", leadership: "", officerTitle: cleanText(existing.officerTitle || "Officer", 80), canManageOfficers: false };
  }
  if (existing.roleOverride === "member") {
    return { role: "member", leadership: "", officerTitle: "", canManageOfficers: false };
  }
  if (rosterEntry) {
    return { role: "officer", leadership: "", officerTitle: rosterEntry.role, canManageOfficers: false };
  }
  return { role: "member", leadership: "", officerTitle: "", canManageOfficers: false };
}

async function setAccessClaims(userRecord, access) {
  const nextClaims = {
    ...(userRecord.customClaims || {}),
    role: access.role,
    leadership: access.leadership,
    manageOfficers: access.canManageOfficers,
    admin: false
  };
  if (userRecord.customClaims?.role !== nextClaims.role
    || userRecord.customClaims?.leadership !== nextClaims.leadership
    || userRecord.customClaims?.manageOfficers !== nextClaims.manageOfficers
    || userRecord.customClaims?.admin !== false) {
    await auth.setCustomUserClaims(userRecord.uid, nextClaims);
  }
}

function requireOfficerManager(request) {
  const caller = requireAuth(request);
  if (!canManageOfficerRoles(caller.token)) {
    throw new HttpsError("permission-denied", "Only the President or Treasurer can change officer roles.");
  }
  return caller;
}

function requireOfficer(request) {
  const caller = requireAuth(request);
  if (caller.token.role !== "officer" && !canManageOfficerRoles(caller.token)) {
    throw new HttpsError("permission-denied", "Officer access is required.");
  }
  return caller;
}

function relyingParty(request) {
  const origin = cleanText(request.rawRequest?.headers?.origin, 240);
  const rpID = allowedOrigins.get(origin);
  if (!rpID) throw new HttpsError("permission-denied", "This site is not approved for passkeys.");
  return { origin, rpID };
}

function publicProfile(uid, data = {}) {
  return {
    uid,
    displayName: cleanText(data.displayName || "FQC Member", 80),
    email: cleanText(data.email, 180),
    photoURL: cleanText(data.photoURL, 500),
    role: profileRole(data.role),
    leadership: ["president", "vice_president", "treasurer"].includes(data.leadership) ? data.leadership : "",
    officerTitle: cleanText(data.officerTitle, 80),
    canManageOfficers: data.canManageOfficers === true,
    ufidStatus: !data.ufidFingerprint ? "required" : data.ufidMatched === true ? "matched" : "member",
    checkedInEvents: Array.isArray(data.checkedInEvents) ? data.checkedInEvents.slice(0, 250) : [],
    passkeyCount: Number(data.passkeyCount) || 0,
    officerNomination: data.officerNomination === "pending" ? "pending" : ""
  };
}

async function ensureProfileForUser(userRecord) {
  const userRef = db.collection("users").doc(userRecord.uid);
  const snapshot = await userRef.get();
  const existing = snapshot.exists ? snapshot.data() : {};
  const roster = existing.ufidFingerprint ? await loadOfficerRoster() : [];
  const rosterEntry = roster.find((entry) => entry.fingerprint === existing.ufidFingerprint) || null;
  const access = resolvedAccess(existing, rosterEntry);
  const data = {
    displayName: cleanText(existing.displayName || userRecord.displayName || userRecord.email?.split("@")[0] || "FQC Member", 80),
    email: cleanText(userRecord.email, 180),
    photoURL: cleanText(userRecord.photoURL, 500),
    ...access,
    ufidFingerprint: existing.ufidFingerprint || "",
    ufidMatched: Boolean(rosterEntry),
    checkedInEvents: Array.isArray(existing.checkedInEvents) ? existing.checkedInEvents : [],
    passkeyCount: Number(existing.passkeyCount) || 0,
    createdAt: existing.createdAt || FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp()
  };

  await userRef.set(data, { merge: true });
  await setAccessClaims(userRecord, access);
  return publicProfile(userRecord.uid, data);
}

export const ensureUserProfile = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const userRecord = await auth.getUser(caller.uid);
  return ensureProfileForUser(userRecord);
});

export const claimUfidRole = onCall(ufidCallableOptions, async (request) => {
  const caller = requireAuth(request);
  const ufid = String(request.data?.ufid || "").trim();
  if (!/^\d{8}$/.test(ufid)) throw new HttpsError("invalid-argument", "Enter an eight-digit UFID.");
  const attemptRef = db.collection("ufidClaimAttempts").doc(caller.uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(attemptRef);
    const attempt = snapshot.data() || {};
    const windowStartedAt = attempt.windowStartedAt?.toMillis?.() || 0;
    const withinWindow = Date.now() - windowStartedAt < 15 * 60 * 1000;
    const count = withinWindow ? Number(attempt.count) || 0 : 0;
    if (count >= 5) throw new HttpsError("resource-exhausted", "Too many UFID attempts. Try again in 15 minutes.");
    transaction.set(attemptRef, {
      count: count + 1,
      windowStartedAt: withinWindow ? attempt.windowStartedAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const fingerprint = createHmac("sha256", officerUfidPepper.value()).update(ufid, "utf8").digest("hex");
  const roster = await loadOfficerRoster();
  const rosterEntry = roster.find((entry) => entry.fingerprint === fingerprint) || null;
  const userRecord = await auth.getUser(caller.uid);
  const userRef = db.collection("users").doc(caller.uid);
  const snapshot = await userRef.get();
  const existing = snapshot.data() || {};
  const access = resolvedAccess(existing, rosterEntry);
  const data = {
    ...access,
    ufidFingerprint: fingerprint,
    ufidMatched: Boolean(rosterEntry),
    ufidVerifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await Promise.all([userRef.set(data, { merge: true }), setAccessClaims(userRecord, access)]);
  return publicProfile(caller.uid, { ...existing, ...data });
});

export const updateUserProfile = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const displayName = cleanText(request.data?.displayName, 80);
  if (displayName.length < 2) throw new HttpsError("invalid-argument", "Enter a display name.");
  await Promise.all([
    auth.updateUser(caller.uid, { displayName }),
    db.collection("users").doc(caller.uid).set({ displayName, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  ]);
  const snapshot = await db.collection("users").doc(caller.uid).get();
  return publicProfile(caller.uid, snapshot.data());
});

export const listMembers = onCall(callableOptions, async (request) => {
  requireOfficer(request);
  const [snapshot, nominations] = await Promise.all([
    db.collection("users").orderBy("displayName").limit(250).get(),
    db.collection("officerNominations").where("status", "==", "pending").limit(250).get()
  ]);
  const nominated = new Set(nominations.docs.map((doc) => doc.id));
  return {
    members: snapshot.docs.map((doc) => publicProfile(doc.id, {
      ...doc.data(),
      officerNomination: nominated.has(doc.id) ? "pending" : ""
    }))
  };
});

export const setMemberRole = onCall(callableOptions, async (request) => {
  const caller = requireOfficerManager(request);
  const uid = cleanText(request.data?.uid, 160);
  const role = profileRole(request.data?.role);
  if (!uid) throw new HttpsError("invalid-argument", "Choose a member.");
  const [targetUser, targetSnapshot] = await Promise.all([
    auth.getUser(uid),
    db.collection("users").doc(uid).get()
  ]);
  const targetData = targetSnapshot.data() || {};
  if (targetData.leadership || targetUser.customClaims?.leadership) {
    throw new HttpsError("failed-precondition", "President and Treasurer roles are protected.");
  }
  const claims = {
    ...(targetUser.customClaims || {}),
    role,
    leadership: "",
    manageOfficers: false,
    admin: false
  };
  const batch = db.batch();
  batch.set(db.collection("users").doc(uid), {
    role,
    leadership: "",
    officerTitle: role === "officer" ? "Officer" : "",
    canManageOfficers: false,
    roleOverride: role,
    roleUpdatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.delete(db.collection("officerNominations").doc(uid));
  await Promise.all([auth.setCustomUserClaims(uid, claims), batch.commit()]);
  return { uid, role, leadership: "", canManageOfficers: false };
});

export const nominateOfficer = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const uid = cleanText(request.data?.uid, 160);
  if (!uid || uid === caller.uid) throw new HttpsError("invalid-argument", "Choose another member.");
  const [targetUser, targetProfile, callerProfile] = await Promise.all([
    auth.getUser(uid),
    db.collection("users").doc(uid).get(),
    db.collection("users").doc(caller.uid).get()
  ]);
  if (targetProfile.data()?.leadership || profileRole(targetProfile.data()?.role) === "officer") {
    throw new HttpsError("failed-precondition", "That account is already an officer.");
  }
  await db.collection("officerNominations").doc(uid).set({
    uid,
    status: "pending",
    nominatedBy: caller.uid,
    nominatedByName: cleanText(callerProfile.data()?.displayName || caller.token.name || caller.token.email, 80),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { uid, officerNomination: "pending" };
});

export const setActiveCheckIn = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const eventId = cleanText(request.data?.eventId, 100);
  const open = request.data?.open === true;
  if (open && !eventId) throw new HttpsError("invalid-argument", "Choose an event.");
  const checkIn = {
    eventId,
    open,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  };
  await db.collection("settings").doc("checkin").set(checkIn, { merge: true });
  return { eventId, open };
});

export const recordEventCheckIn = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const settingRef = db.collection("settings").doc("checkin");
  const setting = await settingRef.get();
  const checkIn = setting.data() || {};
  if (checkIn.open !== true || !checkIn.eventId) {
    throw new HttpsError("failed-precondition", "Event check-in is not open.");
  }

  const eventId = cleanText(checkIn.eventId, 100);
  const checkInRef = db.collection("events").doc(eventId).collection("checkins").doc(caller.uid);
  const userRef = db.collection("users").doc(caller.uid);
  const batch = db.batch();
  batch.set(checkInRef, {
    uid: caller.uid,
    displayName: cleanText(caller.token.name || caller.token.email || "FQC Member", 80),
    email: cleanText(caller.token.email, 180),
    checkedInAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(userRef, { checkedInEvents: FieldValue.arrayUnion(eventId), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { eventId };
});

export const beginPasskeyRegistration = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const { origin, rpID } = relyingParty(request);
  const userRecord = await auth.getUser(caller.uid);
  const credentials = await db.collection("users").doc(caller.uid).collection("passkeys").get();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userRecord.email || caller.uid,
    userDisplayName: userRecord.displayName || userRecord.email || "FQC Member",
    userID: Buffer.from(caller.uid, "utf8"),
    attestationType: "none",
    excludeCredentials: credentials.docs.map((doc) => ({ id: doc.id, transports: doc.data().transports || [] })),
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required"
    },
    preferredAuthenticatorType: "localDevice"
  });
  const challengeId = randomUUID();
  await db.collection("passkeyChallenges").doc(challengeId).set({
    type: "registration",
    uid: caller.uid,
    challenge: options.challenge,
    origin,
    rpID,
    expiresAt: Timestamp.fromMillis(Date.now() + challengeLifetimeMs)
  });
  return { challengeId, options };
});

export const finishPasskeyRegistration = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const challengeId = cleanText(request.data?.challengeId, 100);
  const response = request.data?.response;
  const challengeRef = db.collection("passkeyChallenges").doc(challengeId);
  const challengeSnapshot = await challengeRef.get();
  const challenge = challengeSnapshot.data();
  if (!challenge || challenge.type !== "registration" || challenge.uid !== caller.uid || challenge.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError("failed-precondition", "This passkey request expired. Try again.");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpID,
    requireUserVerification: true
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new HttpsError("permission-denied", "The passkey could not be verified.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const credentialData = {
    uid: caller.uid,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: response?.response?.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null
  };
  const batch = db.batch();
  batch.set(db.collection("passkeyCredentials").doc(credential.id), credentialData);
  batch.set(db.collection("users").doc(caller.uid).collection("passkeys").doc(credential.id), {
    transports: credentialData.transports,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(db.collection("users").doc(caller.uid), { passkeyCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.delete(challengeRef);
  await batch.commit();
  return { verified: true };
});

export const beginPasskeySignIn = onCall(callableOptions, async (request) => {
  const { origin, rpID } = relyingParty(request);
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "required"
  });
  const challengeId = randomUUID();
  await db.collection("passkeyChallenges").doc(challengeId).set({
    type: "authentication",
    challenge: options.challenge,
    origin,
    rpID,
    expiresAt: Timestamp.fromMillis(Date.now() + challengeLifetimeMs)
  });
  return { challengeId, options };
});

export const finishPasskeySignIn = onCall(callableOptions, async (request) => {
  const challengeId = cleanText(request.data?.challengeId, 100);
  const response = request.data?.response;
  const credentialId = cleanText(response?.id, 1024);
  if (!challengeId || !credentialId) throw new HttpsError("invalid-argument", "Passkey response is incomplete.");

  const challengeRef = db.collection("passkeyChallenges").doc(challengeId);
  const credentialRef = db.collection("passkeyCredentials").doc(credentialId);
  const [challengeSnapshot, credentialSnapshot] = await Promise.all([challengeRef.get(), credentialRef.get()]);
  const challenge = challengeSnapshot.data();
  const stored = credentialSnapshot.data();
  if (!challenge || challenge.type !== "authentication" || challenge.expiresAt.toMillis() < Date.now() || !stored?.uid) {
    throw new HttpsError("failed-precondition", "This passkey request expired. Try again.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpID,
    credential: {
      id: credentialId,
      publicKey: new Uint8Array(stored.publicKey.toBuffer()),
      counter: Number(stored.counter) || 0,
      transports: stored.transports || []
    },
    requireUserVerification: true
  });
  if (!verification.verified) throw new HttpsError("permission-denied", "The passkey could not be verified.");

  const batch = db.batch();
  batch.update(credentialRef, {
    counter: verification.authenticationInfo.newCounter,
    lastUsedAt: FieldValue.serverTimestamp()
  });
  batch.delete(challengeRef);
  await batch.commit();
  const customToken = await auth.createCustomToken(stored.uid, { passkey: true });
  return { customToken };
});
