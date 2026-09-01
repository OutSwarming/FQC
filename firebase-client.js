import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, getFirestore, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

const firebaseConfig = {
  apiKey: "AIzaSyDB_R45SNkEJT9LoNE6BuX2bt4TDO_Bs4g",
  authDomain: "florida-quantum-computing.web.app",
  projectId: "florida-quantum-computing",
  storageBucket: "florida-quantum-computing.firebasestorage.app",
  messagingSenderId: "652691476530",
  appId: "1:652691476530:web:dd36470c49d449a8a62c2b"
};

const testMode = globalThis.__FQC_AUTH_TEST__ === true;
let auth;
let db;
let functions;
let mockSessionObserver = null;
let mockCheckInObserver = null;
let mockProfile = null;
let mockCheckIn = { eventId: "fqc-2026-03-03-ionq", open: true, requireLocation: false };
let mockMembers = [];
let mockLeadershipSlots = [];
let mockLeadershipRoster = [];
let mockLeaderboard = { entries: [], participantCount: 0 };
let mockLeaderboardReads = 0;
let mockOfficerResources = [
  { id: "general-onboarding", title: "General Onboarding", kind: "Google Doc", category: "Getting Started", roles: ["general"], featured: ["all"], summary: "Start here for club-wide officer onboarding.", url: "https://drive.google.com/open?id=mock-onboarding" },
  { id: "treasurer-guide", title: "Treasurer Guide", kind: "Google Doc", category: "Role Guides", roles: ["treasurer"], featured: ["treasurer"], summary: "Treasurer responsibilities and workflow.", url: "https://drive.google.com/open?id=mock-treasurer" },
  { id: "event-logistics", title: "2026 Event Logistics", kind: "Google Sheet", category: "Planning & Operations", roles: ["all"], featured: ["all"], summary: "Live event and budget workbook.", url: "https://drive.google.com/open?id=mock-events" },
  { id: "president-guide", title: "President Guide", kind: "Google Doc", category: "Role Guides", roles: ["president"], featured: ["president"], summary: "President responsibilities and workflow.", url: "https://drive.google.com/open?id=mock-president" }
];
let mockOfficerEventOperations = {
  events: [
    {
      id: "fqc-2026-03-03-ionq", row: 2, date: "2026-03-03", time: "3:30 PM", title: "IonQ Quantum Networking Speaker Session",
      location: "Reitz Student Union 2340", backupRoom: "Larsen 234", attendance: "40", permitStatus: "Confirmed", permitNumber: "058982-GP",
      roomStatus: "Confirmed", backupRoomStatus: "Submitted", notes: "Confirm the catering pickup owner.", plannedBudget: 80, actualSpend: 0,
      remainingBudget: 80, fundingSource: "Operational Funding", budgetStatus: "Planned", eventStatus: "Confirmed",
      rsvps: [{ uid: "member-2", displayName: "Jordan", role: "member" }], officerRsvps: []
    },
    {
      id: "fqc-2026-04-14-gbm-3", row: 3, date: "2026-04-14", time: "6:00 PM", title: "GBM 3: Quantum Technology Today",
      location: "Larsen Hall 234", backupRoom: "", attendance: "70", permitStatus: "Pending", permitNumber: "",
      roomStatus: "Submitted", backupRoomStatus: "Not submitted", notes: "", plannedBudget: 140, actualSpend: 40,
      remainingBudget: 100, fundingSource: "Operational Funding", budgetStatus: "In progress", eventStatus: "Planned", rsvps: [], officerRsvps: []
    }
  ],
  budgetItems: [
    { row: 2, eventId: "fqc-2026-03-03-ionq", event: "IonQ Quantum Networking Speaker Session", date: "2026-03-03", item: "Speaker catering", quantity: 1, unit: "order", unitCost: 80, plannedCost: 80, actualCost: 0, fundingSource: "Operational Funding", status: "Estimate", notes: "Confirm final receipt." }
  ],
  totals: { baseFunding: 1050, operationalFunding: 2490, totalApproved: 3540, plannedSpend: 220, actualSpend: 40, availableAfterActual: 3500, uncommittedAfterPlan: 3320 },
  locations: ["Malachowsky Hall", "Larsen Hall", "Reitz Student Union", "Marston Science Library"],
  updatedAt: new Date().toISOString()
};
let mockUsernameDirectory = new Map();
let mockUsernameReservations = new Map();
let pendingAccountCreation = null;

if (!testMode) {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  functions = getFunctions(firebaseApp, "us-central1");
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

function callable(name) {
  return httpsCallable(functions, name);
}

function isTransientFirebaseError(error) {
  const code = String(error?.code || "");
  return ["unavailable", "deadline-exceeded", "internal", "network-request-failed"]
    .some((value) => code.includes(value));
}

function shortRetryDelay() {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 350));
}

async function retryOnceWhenTransient(action) {
  try {
    return await action();
  } catch (error) {
    if (!isTransientFirebaseError(error)) throw error;
    await shortRetryDelay();
    return action();
  }
}

function normalizedEventIds(eventIds = []) {
  return [...new Set(Array.isArray(eventIds) ? eventIds.map(String).filter(Boolean) : [])].slice(0, 250);
}

function normalizedProfile(profile = {}) {
  const leadership = ["president", "vice_president", "treasurer"].includes(profile.leadership) ? profile.leadership : "";
  const checkedInEvents = normalizedEventIds(profile.checkedInEvents);
  return {
    uid: String(profile.uid || ""),
    username: String(profile.username || ""),
    displayName: String(profile.displayName || "FQC Member"),
    email: String(profile.email || ""),
    photoURL: String(profile.photoURL || ""),
    role: profile.role === "officer" ? "officer" : "member",
    leadership,
    officerTitle: String(profile.officerTitle || ""),
    canManageOfficers: profile.canManageOfficers === true || leadership === "president" || leadership === "treasurer",
    checkedInEvents,
    points: checkedInEvents.length,
    passkeyCount: Number(profile.passkeyCount) || 0
  };
}

function emitMockSession() {
  queueMicrotask(() => mockSessionObserver?.(mockProfile ? { user: { uid: mockProfile.uid }, profile: normalizedProfile(mockProfile) } : null));
}

function emitMockCheckIn() {
  queueMicrotask(() => mockCheckInObserver?.({ ...mockCheckIn }));
}

function mockSignIn(profile = {}) {
  mockProfile = normalizedProfile({
    uid: profile.uid || "test-user",
    username: profile.username || "",
    displayName: profile.displayName || "Alex",
    email: profile.email || "alex@ufl.edu",
    role: profile.role || "member",
    leadership: profile.leadership || "",
    officerTitle: profile.officerTitle || "",
    canManageOfficers: profile.canManageOfficers === true,
    checkedInEvents: profile.checkedInEvents || [],
    points: profile.points,
    passkeyCount: profile.passkeyCount || 0
  });
  if (!mockMembers.some((member) => member.uid === mockProfile.uid)) mockMembers.push(mockProfile);
  const entries = mockLeaderboard.entries.filter((entry) => entry.uid !== mockProfile.uid);
  entries.push({ uid: mockProfile.uid, displayName: mockProfile.displayName, points: mockProfile.points, role: mockProfile.role });
  mockLeaderboard = normalizedLeaderboard({ entries });
  emitMockSession();
}

function normalizedLeaderboard(snapshot = {}) {
  const seen = new Set();
  const entries = (Array.isArray(snapshot.entries) ? snapshot.entries : [])
    .map((entry) => ({
      uid: String(entry?.uid || ""),
      displayName: String(entry?.displayName || "FQC Member").slice(0, 80),
      points: Math.max(0, Math.trunc(Number(entry?.points) || 0)),
      role: entry?.role === "officer" ? "officer" : "member"
    }))
    .filter((entry) => entry.uid && !seen.has(entry.uid) && seen.add(entry.uid))
    .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName) || a.uid.localeCompare(b.uid))
    .slice(0, 100);
  return { entries, participantCount: Math.max(entries.length, Number(snapshot.participantCount) || 0) };
}

if (testMode) {
  globalThis.__FQC_AUTH_TEST_API__ = {
    signInAs: mockSignIn,
    signOut: () => { mockProfile = null; emitMockSession(); },
    setCheckIn: (next) => { mockCheckIn = { ...mockCheckIn, ...next }; emitMockCheckIn(); },
    setMembers: (members) => { mockMembers = members.map(normalizedProfile); },
    setLeadershipSlots: (slots) => {
      mockLeadershipSlots = slots.map((slot) => ({ ...slot, row: Number(slot.row) }));
      mockLeadershipRoster = mockLeadershipSlots.map((slot) => ({ ...slot, active: false, linked: false, pending: true }));
    },
    setLeadershipRoster: (seats) => { mockLeadershipRoster = seats.map((seat) => ({ ...seat, row: Number(seat.row) })); },
    setLeaderboard: (snapshot) => { mockLeaderboard = normalizedLeaderboard(snapshot); },
    setOfficerResources: (resources) => { mockOfficerResources = resources; },
    setOfficerEventOperations: (operations) => { mockOfficerEventOperations = structuredClone(operations); },
    getLeaderboardReads: () => mockLeaderboardReads,
    resetLeaderboardReads: () => { mockLeaderboardReads = 0; },
    setUsernameDirectory: (entries) => {
      mockUsernameDirectory = new Map(Object.entries(entries || {}));
      mockUsernameReservations = new Map();
    }
  };
}

export function supportsPasskeys() {
  return testMode || Boolean(globalThis.PublicKeyCredential && globalThis.isSecureContext);
}

export function observeSession(callback, onError = () => {}) {
  if (testMode) {
    mockSessionObserver = callback;
    emitMockSession();
    return () => { mockSessionObserver = null; };
  }

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    try {
      const profile = pendingAccountCreation
        ? await pendingAccountCreation.promise
        : normalizedProfile((await retryOnceWhenTransient(() => callable("ensureUserProfile")())).data);
      if (auth.currentUser?.uid !== user.uid) return;
      await user.getIdToken(true);
      callback({ user, profile });
    } catch (error) {
      onError(error);
    }
  }, onError);
}

export function observeCheckIn(callback, onError = () => {}) {
  if (testMode) {
    mockCheckInObserver = callback;
    emitMockCheckIn();
    return () => { mockCheckInObserver = null; };
  }
  return onSnapshot(doc(db, "settings", "checkin"), (snapshot) => {
    const data = snapshot.data() || {};
    callback({
      eventId: String(data.eventId || ""),
      open: data.open === true,
      requireLocation: data.requireLocation !== false
    });
  }, onError);
}

async function emailForLoginIdentifier(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  if (value.includes("@")) return value;
  if (testMode) return String(mockUsernameDirectory.get(value) || "");
  const result = await retryOnceWhenTransient(() => callable("resolveLoginIdentifier")({ identifier: value }));
  return String(result.data?.email || "");
}

export async function checkUsername(username, reservationToken = "") {
  const normalized = String(username || "").trim().toLowerCase();
  if (testMode) {
    if (mockUsernameDirectory.has(normalized)) return { username: normalized, available: false };
    const existing = mockUsernameReservations.get(normalized);
    if (existing && existing !== reservationToken) return { username: normalized, available: false };
    const token = existing || `test-reservation:${normalized}`;
    mockUsernameReservations.set(normalized, token);
    return { username: normalized, available: true, reservationToken: token };
  }
  const result = await callable("checkUsernameAvailability")({ username: normalized, reservationToken });
  return result.data;
}

export async function signInWithEmail(identifier, password) {
  const email = await emailForLoginIdentifier(identifier);
  if (!email) throw new Error("The username or password is incorrect.");
  if (testMode) {
    const username = String(identifier).includes("@") ? "" : String(identifier).trim().toLowerCase();
    mockSignIn({ uid: "email-user", username, displayName: username || "Email Member", email });
    return;
  }
  await signInWithEmailAndPassword(auth, email, password);
}

function generatedAccountPassword() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createEmailAccount({ username, email, password, method = "password", reservationToken = "" }) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  if (testMode) {
    if (mockUsernameDirectory.has(normalizedUsername)) throw new Error("That username is already taken.");
    if (normalizedUsername !== String(email || "").trim().toLowerCase().split("@")[0]
      && mockUsernameReservations.get(normalizedUsername) !== reservationToken) {
      throw new Error("Your username reservation expired. Choose the username again.");
    }
    mockUsernameDirectory.set(normalizedUsername, email);
    mockUsernameReservations.delete(normalizedUsername);
    mockSignIn({ uid: "new-email-user", username: normalizedUsername, displayName: normalizedUsername, email });
    if (method === "passkey") {
      mockProfile = normalizedProfile({ ...mockProfile, passkeyCount: 1 });
      emitMockSession();
    }
    return mockProfile;
  }
  const accountPassword = method === "passkey" ? generatedAccountPassword() : password;
  let settleAccountCreation;
  let rejectAccountCreation;
  const creation = {
    promise: new Promise((resolve, reject) => {
      settleAccountCreation = resolve;
      rejectAccountCreation = reject;
    })
  };
  // The Auth state listener fires as soon as Firebase creates the credential.
  // Make it await this single account setup pipeline instead of racing a second
  // profile write before the username has been claimed.
  creation.promise.catch(() => {});
  pendingAccountCreation = creation;
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, email, accountPassword);
    await callable("claimUsername")({ username: normalizedUsername, reservationToken });
    await updateProfile(credential.user, { displayName: normalizedUsername });
    const result = await callable("ensureUserProfile")();
    const profile = normalizedProfile(result.data);
    settleAccountCreation(profile);
    return method === "passkey" ? registerPasskey() : profile;
  } catch (error) {
    rejectAccountCreation(error);
    if (credential?.user) await deleteUser(credential.user).catch(() => {});
    throw error;
  } finally {
    globalThis.setTimeout(() => {
      if (pendingAccountCreation === creation) pendingAccountCreation = null;
    }, 5000);
  }
}

// A reset request always reports the same result, so the form cannot be used to
// discover which usernames or addresses have FQC accounts. Accounts created with
// a passkey hold a random password nobody knows, so this doubles as the way to
// set a first password on a device that has no passkey.
export async function requestPasswordReset(identifier) {
  const value = String(identifier || "").trim();
  if (!value) throw new Error("Enter your username or UF email.");
  if (testMode) return { sent: true, email: value };
  try {
    const email = await emailForLoginIdentifier(value);
    if (email) await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.debug("Password reset lookup did not resolve", error);
  }
  return { sent: true };
}

// Same email, requested from inside a signed-in session, where there is no
// account to enumerate and a real failure should be reported.
export async function sendPasswordSetupEmail() {
  if (testMode) {
    if (!mockProfile) throw new Error("Sign in first.");
    return { email: mockProfile.email };
  }
  const email = auth.currentUser?.email;
  if (!email) throw new Error("Sign in again, then request the password link.");
  await sendPasswordResetEmail(auth, email);
  return { email };
}

export async function signInWithPasskey() {
  if (!supportsPasskeys()) throw new Error("Passkeys are not supported on this device.");
  if (testMode) {
    mockSignIn({ uid: "passkey-user", displayName: "Passkey Member", email: "passkey@ufl.edu", passkeyCount: 1 });
    return;
  }
  const begin = await callable("beginPasskeySignIn")();
  const response = await startAuthentication({ optionsJSON: begin.data.options });
  const finish = await callable("finishPasskeySignIn")({ challengeId: begin.data.challengeId, response });
  await signInWithCustomToken(auth, finish.data.customToken);
}

export async function registerPasskey() {
  if (!supportsPasskeys()) throw new Error("Passkeys are not supported on this device.");
  if (testMode) {
    mockProfile = { ...mockProfile, passkeyCount: (mockProfile?.passkeyCount || 0) + 1 };
    emitMockSession();
    return normalizedProfile(mockProfile);
  }
  const begin = await callable("beginPasskeyRegistration")();
  const response = await startRegistration({ optionsJSON: begin.data.options });
  await callable("finishPasskeyRegistration")({ challengeId: begin.data.challengeId, response });
  const refreshed = await callable("ensureUserProfile")();
  return normalizedProfile(refreshed.data);
}

export async function logOut() {
  if (testMode) {
    mockProfile = null;
    emitMockSession();
    return;
  }
  await signOut(auth);
}

export async function updateProfileName(displayName) {
  if (testMode) {
    const key = String(displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
    const taken = mockMembers.some((member) => member.uid !== mockProfile?.uid
      && String(member.displayName || "").trim().toLowerCase().replace(/\s+/g, " ") === key);
    if (taken) throw new Error("Another member is already using that display name.");
    mockProfile = { ...mockProfile, displayName };
    mockMembers = mockMembers.map((member) => member.uid === mockProfile.uid ? mockProfile : member);
    mockLeaderboard = normalizedLeaderboard({
      entries: mockLeaderboard.entries.map((entry) => entry.uid === mockProfile.uid ? { ...entry, displayName } : entry)
    });
    emitMockSession();
    return normalizedProfile(mockProfile);
  }
  const result = await callable("updateUserProfile")({ displayName });
  return normalizedProfile(result.data);
}

export async function updateUsername(username) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  if (testMode) {
    const holderEmail = mockUsernameDirectory.get(normalizedUsername);
    if (holderEmail && holderEmail !== mockProfile?.email) throw new Error("That username is already taken.");
    const previous = String(mockProfile?.username || "");
    if (previous && mockUsernameDirectory.get(previous) === mockProfile?.email) mockUsernameDirectory.delete(previous);
    mockUsernameDirectory.set(normalizedUsername, mockProfile?.email || "");
    mockProfile = { ...mockProfile, username: normalizedUsername };
    mockMembers = mockMembers.map((member) => member.uid === mockProfile.uid ? mockProfile : member);
    emitMockSession();
    return normalizedProfile(mockProfile);
  }
  const reservation = await checkUsername(normalizedUsername);
  if (!reservation?.available) throw new Error("That username is already taken.");
  await callable("claimUsername")({ username: normalizedUsername, reservationToken: reservation.reservationToken });
  const refreshed = await callable("ensureUserProfile")();
  return normalizedProfile(refreshed.data);
}

export async function recordCheckIn(location = null) {
  if (testMode) {
    if (!mockCheckIn.open) throw new Error("Event check-in is not open.");
    if (mockCheckIn.requireLocation && !location) throw new Error("Location is required for this check-in.");
    const checkedInEvents = [...new Set([...(mockProfile?.checkedInEvents || []), mockCheckIn.eventId])];
    const awarded = checkedInEvents.length > (mockProfile?.checkedInEvents || []).length;
    mockProfile = normalizedProfile({ ...mockProfile, checkedInEvents, points: checkedInEvents.length });
    mockLeaderboard = normalizedLeaderboard({
      entries: [
        ...mockLeaderboard.entries.filter((entry) => entry.uid !== mockProfile.uid),
        { uid: mockProfile.uid, displayName: mockProfile.displayName, points: mockProfile.points, role: mockProfile.role }
      ]
    });
    emitMockSession();
    return { eventId: mockCheckIn.eventId, awarded, points: mockProfile.points, leaderboard: mockLeaderboard };
  }
  const result = await callable("recordEventCheckIn")({ location });
  return result.data;
}

export async function loadLeaderboard() {
  if (testMode) {
    mockLeaderboardReads += 1;
    return normalizedLeaderboard(mockLeaderboard);
  }
  const snapshot = await getDoc(doc(db, "system", "leaderboardData"));
  return normalizedLeaderboard(snapshot.data() || {});
}

export async function updateActiveCheckIn(eventId, open) {
  if (testMode) {
    mockCheckIn = { ...mockCheckIn, eventId, open };
    emitMockCheckIn();
    return mockCheckIn;
  }
  const result = await callable("setActiveCheckIn")({ eventId, open });
  return result.data;
}

export async function updateCheckInLocationRequirement(requireLocation) {
  if (testMode) {
    mockCheckIn = { ...mockCheckIn, requireLocation: requireLocation === true };
    emitMockCheckIn();
    return { requireLocation: mockCheckIn.requireLocation };
  }
  const result = await callable("setCheckInLocationRequirement")({ requireLocation: requireLocation === true });
  return result.data;
}

export async function loadMembers() {
  if (testMode) {
    return {
      members: mockMembers.map(normalizedProfile),
      leadershipSlots: mockLeadershipSlots.map((slot) => ({ ...slot })),
      leadershipRoster: mockLeadershipRoster.map((seat) => ({ ...seat }))
    };
  }
  const result = await callable("listMembers")();
  return {
    members: (result.data.members || []).map(normalizedProfile),
    leadershipSlots: Array.isArray(result.data.leadershipSlots) ? result.data.leadershipSlots : [],
    leadershipRoster: Array.isArray(result.data.leadershipRoster) ? result.data.leadershipRoster : []
  };
}

export async function loadOfficerResources() {
  if (testMode) return mockOfficerResources.map((resource) => ({ ...resource }));
  const result = await callable("getOfficerResources")();
  return Array.isArray(result.data?.resources) ? result.data.resources : [];
}

export async function loadOfficerEventOperations() {
  if (testMode) return structuredClone(mockOfficerEventOperations);
  const result = await callable("getOfficerEventOperations")();
  return result.data;
}

export async function saveOfficerEvent(event) {
  if (testMode) {
    const existingIndex = mockOfficerEventOperations.events.findIndex((entry) => entry.id === event.id);
    const normalized = {
      ...event,
      id: event.id || `fqc-${event.date}-${String(event.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 52)}`,
      row: existingIndex >= 0 ? mockOfficerEventOperations.events[existingIndex].row : mockOfficerEventOperations.events.length + 2,
      plannedBudget: existingIndex >= 0 ? mockOfficerEventOperations.events[existingIndex].plannedBudget : 0,
      actualSpend: existingIndex >= 0 ? mockOfficerEventOperations.events[existingIndex].actualSpend : 0,
      remainingBudget: existingIndex >= 0 ? mockOfficerEventOperations.events[existingIndex].remainingBudget : 0,
      rsvps: existingIndex >= 0 ? mockOfficerEventOperations.events[existingIndex].rsvps : [],
      officerRsvps: existingIndex >= 0 ? mockOfficerEventOperations.events[existingIndex].officerRsvps : []
    };
    if (existingIndex >= 0) mockOfficerEventOperations.events[existingIndex] = normalized;
    else mockOfficerEventOperations.events.push(normalized);
    mockOfficerEventOperations.updatedAt = new Date().toISOString();
    return { saved: true, row: normalized.row };
  }
  const result = await callable("saveOfficerEvent")({ event });
  return result.data;
}

export async function saveOfficerBudgetItem(item) {
  if (testMode) {
    const existingIndex = mockOfficerEventOperations.budgetItems.findIndex((entry) => entry.row === Number(item.row));
    const row = existingIndex >= 0 ? Number(item.row) : Math.max(1, ...mockOfficerEventOperations.budgetItems.map((entry) => entry.row)) + 1;
    const saved = { ...item, row, plannedCost: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), actualCost: Number(item.actualCost) || 0 };
    if (existingIndex >= 0) mockOfficerEventOperations.budgetItems[existingIndex] = saved;
    else mockOfficerEventOperations.budgetItems.push(saved);
    const event = mockOfficerEventOperations.events.find((entry) => entry.id === item.eventId);
    if (event) {
      const items = mockOfficerEventOperations.budgetItems.filter((entry) => entry.eventId === item.eventId);
      event.plannedBudget = items.reduce((sum, entry) => sum + entry.plannedCost, 0);
      event.actualSpend = items.reduce((sum, entry) => sum + entry.actualCost, 0);
      event.remainingBudget = event.plannedBudget - event.actualSpend;
    }
    return { saved: true, row };
  }
  const result = await callable("saveOfficerBudgetItem")({ item });
  return result.data;
}

export async function deleteOfficerBudgetItem(row) {
  if (testMode) {
    const target = Number(row);
    const removed = mockOfficerEventOperations.budgetItems.find((entry) => entry.row === target);
    mockOfficerEventOperations.budgetItems = mockOfficerEventOperations.budgetItems.filter((entry) => entry.row !== target);
    const event = mockOfficerEventOperations.events.find((entry) => entry.id === removed?.eventId);
    if (event) {
      const items = mockOfficerEventOperations.budgetItems.filter((entry) => entry.eventId === event.id);
      event.plannedBudget = items.reduce((sum, entry) => sum + (Number(entry.plannedCost) || 0), 0);
      event.actualSpend = items.reduce((sum, entry) => sum + (Number(entry.actualCost) || 0), 0);
      event.remainingBudget = event.plannedBudget - event.actualSpend;
    }
    return { removed: true, row: target };
  }
  const result = await callable("deleteOfficerBudgetItem")({ row: Number(row) });
  return result.data;
}

export async function removeClubMember(uid) {
  if (testMode) {
    if (!mockProfile?.canManageOfficers) throw new Error("Only the President or Treasurer can remove a member.");
    const target = mockMembers.find((member) => member.uid === uid);
    if (!target) throw new Error("That member is no longer in the directory.");
    if (target.uid === mockProfile.uid) throw new Error("You cannot remove your own account.");
    if (target.leadership) throw new Error("President, Vice President, and Treasurer accounts are protected.");
    mockMembers = mockMembers.filter((member) => member.uid !== uid);
    mockLeaderboard = normalizedLeaderboard({
      entries: mockLeaderboard.entries.filter((entry) => entry.uid !== uid),
      participantCount: Math.max(0, mockLeaderboard.participantCount - 1)
    });
    return { removed: true, uid, displayName: target.displayName };
  }
  const result = await callable("removeMember")({ uid });
  return result.data;
}

export async function updateEventRsvp(eventId, going) {
  if (testMode) {
    const event = mockOfficerEventOperations.events.find((entry) => entry.id === eventId);
    if (event && mockProfile) {
      event.rsvps = event.rsvps.filter((entry) => entry.uid !== mockProfile.uid);
      if (going) event.rsvps.push({ uid: mockProfile.uid, displayName: mockProfile.displayName, role: mockProfile.role });
      event.officerRsvps = event.rsvps.filter((entry) => entry.role === "officer").map((entry) => entry.displayName);
    }
    return { eventId, going, entries: event?.rsvps || [] };
  }
  const result = await callable("setEventRsvp")({ eventId, going });
  return result.data;
}

export async function changeMemberRole(uid, role) {
  if (testMode) {
    if (mockProfile?.role !== "officer") throw new Error("Officer access is required.");
    if (role !== "officer" && !mockProfile?.canManageOfficers) {
      throw new Error("Only the President or Treasurer can remove an officer role.");
    }
    mockMembers = mockMembers.map((member) => member.uid === uid
      ? { ...member, role: role === "officer" ? "officer" : "member" }
      : member);
    return mockMembers.find((member) => member.uid === uid);
  }
  const result = await callable("setMemberRole")({ uid, role });
  return result.data;
}

export async function assignLeadershipRole(uid, row) {
  if (testMode) {
    if (!mockProfile?.canManageOfficers) throw new Error("Only the President or Treasurer can change officer roles.");
    const slot = mockLeadershipSlots.find((entry) => entry.row === Number(row));
    const member = mockMembers.find((entry) => entry.uid === uid);
    if (!slot || !member) throw new Error("Choose a pending leadership role and a member account.");
    const seatLeadership = /^president$/i.test(slot.title) ? "president"
      : /^vice[ -]?president$/i.test(slot.title) ? "vice_president"
        : /^treasurer$/i.test(slot.title) ? "treasurer" : "";
    if (member.leadership && member.leadership !== seatLeadership) {
      throw new Error("That account already holds a different leadership seat.");
    }
    const title = String(slot.title || "Officer");
    const leadership = /^president$/i.test(title) ? "president"
      : /^vice[ -]?president$/i.test(title) ? "vice_president"
        : /^treasurer$/i.test(title) ? "treasurer" : "";
    const profile = normalizedProfile({
      ...member,
      role: "officer",
      leadership,
      officerTitle: title,
      canManageOfficers: leadership === "president" || leadership === "treasurer"
    });
    mockMembers = mockMembers.map((entry) => entry.uid === uid ? profile : entry);
    mockLeadershipSlots = mockLeadershipSlots.filter((entry) => entry.row !== Number(row));
    mockLeadershipRoster = mockLeadershipRoster.map((seat) => seat.row === Number(row)
      ? { ...seat, active: true, linked: true, pending: false }
      : seat);
    return { profile, slot };
  }
  const result = await callable("assignMemberLeadership")({ uid, row: Number(row) });
  return result.data;
}

export async function openLeadershipSeat(row, uid = "") {
  if (testMode) {
    if (!mockProfile?.canManageOfficers) throw new Error("Only the President or Treasurer can change officer roles.");
    const seat = mockLeadershipRoster.find((entry) => entry.row === Number(row));
    if (!seat || seat.pending) throw new Error("That seat is already open.");
    mockLeadershipRoster = mockLeadershipRoster.map((entry) => entry.row === Number(row)
      ? { ...entry, active: false, linked: false, pending: true }
      : entry);
    if (!mockLeadershipSlots.some((entry) => entry.row === Number(row))) {
      mockLeadershipSlots = [...mockLeadershipSlots, { row: Number(row), name: seat.name, title: seat.title }];
    }
    const holder = mockMembers.find((member) => member.uid === uid)
      || mockMembers.find((member) => member.officerTitle === seat.title);
    if (holder) {
      const demoted = normalizedProfile({ ...holder, leadership: "", officerTitle: "Officer", canManageOfficers: false });
      mockMembers = mockMembers.map((member) => member.uid === demoted.uid ? demoted : member);
    }
    return { row: Number(row), uid: holder?.uid || "", demoted: Boolean(holder) };
  }
  const result = await callable("unassignMemberLeadership")({ row: Number(row), uid });
  return result.data;
}

export function readableAuthError(error) {
  const code = String(error?.code || "");
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "Sign-in was cancelled.";
  if (code.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow popups and try again.";
  if (code.includes("operation-not-allowed")) return "This sign-in method is still being configured.";
  if (code.includes("account-exists-with-different-credential")) return "That email already uses another sign-in method. Sign in with the original method first.";
  if (code.includes("email-already-in-use")) return "An account already exists for that email. Use Log In or Forgot Password.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found") || code.includes("not-found")) return "The username, UF email, or password is incorrect.";
  if (code.includes("weak-password")) return "Use a password with at least eight characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("too-many-requests")) return "Firebase is temporarily limiting signups or sign-ins on this network. Wait a moment, or switch between UF Wi-Fi and cellular data, then try again.";
  if (isTransientFirebaseError(error)) return "FQC could not reach sign-in. Check your connection and try once more.";
  if (code.includes("unauthenticated")) return "Your session expired. Sign in again.";
  if (code.includes("permission-denied")) return "Your account does not have permission for that action.";
  if (error?.name === "NotAllowedError") return "Face ID, Touch ID, or the passkey prompt was cancelled.";
  return String(error?.message || "Something went wrong. Please try again.").replace(/^Firebase:\s*/i, "").slice(0, 220);
}
