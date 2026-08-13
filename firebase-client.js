import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
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
let mockUfidDirectory = new Map();
let redirectResultChecked = false;

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

function normalizedEventIds(eventIds = []) {
  return [...new Set(Array.isArray(eventIds) ? eventIds.map(String).filter(Boolean) : [])].slice(0, 250);
}

function normalizedProfile(profile = {}) {
  const leadership = ["president", "vice_president", "treasurer"].includes(profile.leadership) ? profile.leadership : "";
  const checkedInEvents = normalizedEventIds(profile.checkedInEvents);
  return {
    uid: String(profile.uid || ""),
    displayName: String(profile.displayName || "FQC Member"),
    email: String(profile.email || ""),
    photoURL: String(profile.photoURL || ""),
    role: profile.role === "officer" ? "officer" : "member",
    leadership,
    officerTitle: String(profile.officerTitle || ""),
    canManageOfficers: profile.canManageOfficers === true || leadership === "president" || leadership === "treasurer",
    ufidStatus: ["required", "matched", "member"].includes(profile.ufidStatus) ? profile.ufidStatus : "member",
    checkedInEvents,
    points: checkedInEvents.length,
    passkeyCount: Number(profile.passkeyCount) || 0,
    officerNomination: profile.officerNomination === "pending" ? "pending" : ""
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
    displayName: profile.displayName || "Alex",
    email: profile.email || "alex@ufl.edu",
    role: profile.role || "member",
    leadership: profile.leadership || "",
    officerTitle: profile.officerTitle || "",
    canManageOfficers: profile.canManageOfficers === true,
    ufidStatus: profile.ufidStatus || (profile.role === "officer" ? "matched" : "member"),
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
    setLeaderboard: (snapshot) => { mockLeaderboard = normalizedLeaderboard(snapshot); },
    setOfficerResources: (resources) => { mockOfficerResources = resources; },
    setOfficerEventOperations: (operations) => { mockOfficerEventOperations = structuredClone(operations); },
    getLeaderboardReads: () => mockLeaderboardReads,
    resetLeaderboardReads: () => { mockLeaderboardReads = 0; },
    setUfidDirectory: (entries) => { mockUfidDirectory = new Map(Object.entries(entries || {})); }
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

  if (!redirectResultChecked) {
    redirectResultChecked = true;
    getRedirectResult(auth).catch(onError);
  }

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    try {
      const result = await callable("ensureUserProfile")();
      await user.getIdToken(true);
      callback({ user, profile: normalizedProfile(result.data) });
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

async function socialSignIn(provider) {
  if (testMode) {
    mockSignIn({
      uid: provider.providerId === "apple.com" ? "apple-user" : "google-user",
      displayName: provider.providerId === "apple.com" ? "Apple Member" : "Google Member",
      email: provider.providerId === "apple.com" ? "apple@privaterelay.appleid.com" : "member@ufl.edu",
      ufidStatus: "required"
    });
    return;
  }
  const prefersRedirect = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || globalThis.matchMedia?.("(max-width: 680px)")?.matches;
  if (prefersRedirect) {
    await signInWithRedirect(auth, provider);
    return;
  }
  await signInWithPopup(auth, provider);
}

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return socialSignIn(provider);
}

export function signInWithApple() {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return socialSignIn(provider);
}

export async function signInWithEmail(email, password) {
  if (testMode) {
    mockSignIn({ uid: "email-user", displayName: "Email Member", email, ufidStatus: "member" });
    return;
  }
  await signInWithEmailAndPassword(auth, email, password);
}

export async function createEmailAccount({ displayName, email, password, ufid }) {
  if (testMode) {
    mockSignIn({ uid: "new-email-user", displayName, email, ufidStatus: "required" });
    return verifyUfid(ufid);
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await callable("ensureUserProfile")();
  return verifyUfid(ufid);
}

export async function requestPasswordReset(email) {
  if (testMode) return { email };
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

export async function verifyUfid(ufid) {
  if (testMode) {
    const match = mockUfidDirectory.get(String(ufid));
    const officerTitle = String(match?.officerTitle || "");
    const leadership = officerTitle.toLowerCase() === "president"
      ? "president"
      : officerTitle.toLowerCase() === "vice president"
        ? "vice_president"
        : officerTitle.toLowerCase() === "treasurer" ? "treasurer" : "";
    mockProfile = normalizedProfile({
      ...mockProfile,
      role: match ? "officer" : "member",
      officerTitle,
      leadership,
      canManageOfficers: leadership === "president" || leadership === "treasurer",
      ufidStatus: match ? "matched" : "member"
    });
    mockMembers = mockMembers.map((member) => member.uid === mockProfile.uid ? mockProfile : member);
    mockLeaderboard = normalizedLeaderboard({
      entries: mockLeaderboard.entries.map((entry) => entry.uid === mockProfile.uid ? { ...entry, role: mockProfile.role } : entry)
    });
    emitMockSession();
    return mockProfile;
  }
  const result = await callable("claimUfidRole")({ ufid });
  await auth.currentUser?.getIdToken(true);
  return normalizedProfile(result.data);
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
  if (testMode) return mockMembers.map(normalizedProfile);
  const result = await callable("listMembers")();
  return (result.data.members || []).map(normalizedProfile);
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
    if (!mockProfile?.canManageOfficers) throw new Error("Only the President or Treasurer can change officer roles.");
    mockMembers = mockMembers.map((member) => member.uid === uid
      ? { ...member, role: role === "officer" ? "officer" : "member", officerNomination: "" }
      : member);
    return mockMembers.find((member) => member.uid === uid);
  }
  const result = await callable("setMemberRole")({ uid, role });
  return result.data;
}

export async function recommendOfficer(uid) {
  if (testMode) {
    if (mockProfile?.role !== "officer") throw new Error("Officer access is required.");
    mockMembers = mockMembers.map((member) => member.uid === uid ? { ...member, officerNomination: "pending" } : member);
    return { uid, officerNomination: "pending" };
  }
  const result = await callable("nominateOfficer")({ uid });
  return result.data;
}

export function readableAuthError(error) {
  const code = String(error?.code || "");
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "Sign-in was cancelled.";
  if (code.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow popups and try again.";
  if (code.includes("operation-not-allowed")) return "This sign-in method is still being configured.";
  if (code.includes("account-exists-with-different-credential")) return "That email already uses another sign-in method. Sign in with the original method first.";
  if (code.includes("email-already-in-use")) return "An account already exists for that email. Use Log In or Forgot Password.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "The email or password is incorrect.";
  if (code.includes("weak-password")) return "Use a password with at least eight characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a moment and try again.";
  if (code.includes("unauthenticated")) return "Your session expired. Sign in again.";
  if (code.includes("permission-denied")) return "Your account does not have permission for that action.";
  if (error?.name === "NotAllowedError") return "Face ID, Touch ID, or the passkey prompt was cancelled.";
  return String(error?.message || "Something went wrong. Please try again.").replace(/^Firebase:\s*/i, "").slice(0, 220);
}
