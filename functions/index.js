import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
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
const bootstrapAdminEmails = new Set(["floridaquantumcomputingsociety@gmail.com"]);
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

function isBootstrapAdmin(token = {}) {
  return bootstrapAdminEmails.has(String(token.email || "").toLowerCase());
}

function requireAdmin(request) {
  const caller = requireAuth(request);
  if (caller.token.admin !== true && !isBootstrapAdmin(caller.token)) {
    throw new HttpsError("permission-denied", "Administrator access is required.");
  }
  return caller;
}

function requireOfficer(request) {
  const caller = requireAuth(request);
  if (caller.token.role !== "officer" && caller.token.admin !== true && !isBootstrapAdmin(caller.token)) {
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
    isAdmin: data.isAdmin === true,
    checkedInEvents: Array.isArray(data.checkedInEvents) ? data.checkedInEvents.slice(0, 250) : [],
    passkeyCount: Number(data.passkeyCount) || 0
  };
}

async function ensureProfileForUser(userRecord) {
  const userRef = db.collection("users").doc(userRecord.uid);
  const admin = bootstrapAdminEmails.has(String(userRecord.email || "").toLowerCase());
  const snapshot = await userRef.get();
  const existing = snapshot.exists ? snapshot.data() : {};
  const role = admin ? "officer" : profileRole(existing.role);
  const data = {
    displayName: cleanText(existing.displayName || userRecord.displayName || userRecord.email?.split("@")[0] || "FQC Member", 80),
    email: cleanText(userRecord.email, 180),
    photoURL: cleanText(userRecord.photoURL, 500),
    role,
    isAdmin: admin || existing.isAdmin === true,
    checkedInEvents: Array.isArray(existing.checkedInEvents) ? existing.checkedInEvents : [],
    passkeyCount: Number(existing.passkeyCount) || 0,
    createdAt: existing.createdAt || FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp()
  };

  await userRef.set(data, { merge: true });
  const nextClaims = { ...(userRecord.customClaims || {}), role: data.role, admin: data.isAdmin };
  if (userRecord.customClaims?.role !== nextClaims.role || userRecord.customClaims?.admin !== nextClaims.admin) {
    await auth.setCustomUserClaims(userRecord.uid, nextClaims);
  }
  return publicProfile(userRecord.uid, data);
}

export const ensureUserProfile = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const userRecord = await auth.getUser(caller.uid);
  return ensureProfileForUser(userRecord);
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
  requireAdmin(request);
  const snapshot = await db.collection("users").orderBy("displayName").limit(250).get();
  return { members: snapshot.docs.map((doc) => publicProfile(doc.id, doc.data())) };
});

export const setMemberRole = onCall(callableOptions, async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data?.uid, 160);
  const role = profileRole(request.data?.role);
  if (!uid) throw new HttpsError("invalid-argument", "Choose a member.");
  const targetUser = await auth.getUser(uid);
  const targetIsAdmin = bootstrapAdminEmails.has(String(targetUser.email || "").toLowerCase());
  const finalRole = targetIsAdmin ? "officer" : role;
  const claims = { ...(targetUser.customClaims || {}), role: finalRole, admin: targetIsAdmin };
  await Promise.all([
    auth.setCustomUserClaims(uid, claims),
    db.collection("users").doc(uid).set({ role: finalRole, isAdmin: targetIsAdmin, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  ]);
  return { uid, role: finalRole, isAdmin: targetIsAdmin };
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
