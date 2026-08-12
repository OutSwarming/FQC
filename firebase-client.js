import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
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
let mockCheckIn = { eventId: "fqc-2026-03-03-ionq", open: true };
let mockMembers = [];
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

function normalizedProfile(profile = {}) {
  return {
    uid: String(profile.uid || ""),
    displayName: String(profile.displayName || "FQC Member"),
    email: String(profile.email || ""),
    photoURL: String(profile.photoURL || ""),
    role: profile.role === "officer" ? "officer" : "member",
    isAdmin: profile.isAdmin === true,
    checkedInEvents: Array.isArray(profile.checkedInEvents) ? profile.checkedInEvents : [],
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
    displayName: profile.displayName || "Alex",
    email: profile.email || "alex@ufl.edu",
    role: profile.role || "member",
    isAdmin: profile.isAdmin === true,
    checkedInEvents: profile.checkedInEvents || [],
    passkeyCount: profile.passkeyCount || 0
  });
  if (!mockMembers.some((member) => member.uid === mockProfile.uid)) mockMembers.push(mockProfile);
  emitMockSession();
}

if (testMode) {
  globalThis.__FQC_AUTH_TEST_API__ = {
    signInAs: mockSignIn,
    signOut: () => { mockProfile = null; emitMockSession(); },
    setCheckIn: (next) => { mockCheckIn = { ...mockCheckIn, ...next }; emitMockCheckIn(); },
    setMembers: (members) => { mockMembers = members.map(normalizedProfile); }
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
    callback({ eventId: String(data.eventId || ""), open: data.open === true });
  }, onError);
}

async function socialSignIn(provider) {
  if (testMode) {
    mockSignIn({
      uid: provider.providerId === "apple.com" ? "apple-user" : "google-user",
      displayName: provider.providerId === "apple.com" ? "Apple Member" : "Google Member",
      email: provider.providerId === "apple.com" ? "apple@privaterelay.appleid.com" : "member@ufl.edu"
    });
    return;
  }
  const prefersRedirect = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || globalThis.matchMedia?.("(max-width: 680px)").matches;
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
    emitMockSession();
    return normalizedProfile(mockProfile);
  }
  const result = await callable("updateUserProfile")({ displayName });
  return normalizedProfile(result.data);
}

export async function recordCheckIn() {
  if (testMode) {
    if (!mockCheckIn.open) throw new Error("Event check-in is not open.");
    mockProfile = { ...mockProfile, checkedInEvents: [...new Set([...(mockProfile?.checkedInEvents || []), mockCheckIn.eventId])] };
    emitMockSession();
    return { eventId: mockCheckIn.eventId };
  }
  const result = await callable("recordEventCheckIn")();
  return result.data;
}

export async function updateActiveCheckIn(eventId, open) {
  if (testMode) {
    mockCheckIn = { eventId, open };
    emitMockCheckIn();
    return mockCheckIn;
  }
  const result = await callable("setActiveCheckIn")({ eventId, open });
  return result.data;
}

export async function loadMembers() {
  if (testMode) return mockMembers.map(normalizedProfile);
  const result = await callable("listMembers")();
  return (result.data.members || []).map(normalizedProfile);
}

export async function changeMemberRole(uid, role) {
  if (testMode) {
    mockMembers = mockMembers.map((member) => member.uid === uid ? { ...member, role: role === "officer" ? "officer" : "member" } : member);
    return mockMembers.find((member) => member.uid === uid);
  }
  const result = await callable("setMemberRole")({ uid, role });
  return result.data;
}

export function readableAuthError(error) {
  const code = String(error?.code || "");
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "Sign-in was cancelled.";
  if (code.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow popups and try again.";
  if (code.includes("operation-not-allowed")) return "This sign-in method is still being configured.";
  if (code.includes("account-exists-with-different-credential")) return "That email already uses another sign-in method. Sign in with the original method first.";
  if (code.includes("unauthenticated")) return "Your session expired. Sign in again.";
  if (code.includes("permission-denied")) return "Your account does not have permission for that action.";
  if (error?.name === "NotAllowedError") return "Face ID, Touch ID, or the passkey prompt was cancelled.";
  return String(error?.message || "Something went wrong. Please try again.").replace(/^Firebase:\s*/i, "").slice(0, 220);
}
