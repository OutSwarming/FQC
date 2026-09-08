import { getAuth } from "firebase-admin/auth";
import test from "node:test";
import assert from "node:assert/strict";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { finalizeAccount, ensureUserProfile, recordEventCheckIn, queueMemberSheetExport, removeMember, finishPasskeySignIn, updateUserProfile, allowedOrigins } from "./index.js";
import { enqueueMemberExport, drainMemberExports, memberExportChanged, seedMemberExport } from "./lib/member-sync.js";

const enabled = process.env.GCLOUD_PROJECT === "demo-fqc" && Boolean(process.env.FIRESTORE_EMULATOR_HOST) && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
test("Firebase onboarding, attendance, and resilient 10K export", { skip: !enabled, timeout: 240000 }, async (t) => {
  const db = getFirestore();
  const originalFetch = globalThis.fetch;
  let sheetRequests = 0;
  globalThis.fetch = (url, options) => {
    if (String(url).includes("sheets.googleapis.com")) { sheetRequests++; throw new Error("Sheets is offline"); }
    return originalFetch(url, options);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const started = performance.now();
  const accounts = await Promise.all(Array.from({ length: 70 }, async (_, index) => {
    const email = `burst${index}@ufl.edu`;
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "integration-test-password", returnSecureToken: true })
    });
    const credential = await response.json();
    assert.ok(credential.localId, JSON.stringify(credential));
    const request = { auth: { uid: credential.localId, token: { email, auth_time: Math.floor(Date.now() / 1000) } }, data: {} };
    const profile = await finalizeAccount.run(request);
    assert.equal(profile.role, "member");
    assert.equal(profile.username, "");
    return request;
  }));
  const signupMs = Math.round(performance.now() - started);
  assert.ok(signupMs < 600000);
  assert.equal(sheetRequests, 0);
  await db.collection("settings").doc("checkin").set({ open: true, eventId: "burst-event", requireLocation: false });
  // Event-specific clients must not award attendance after an officer switches sessions.
  await assert.rejects(recordEventCheckIn.run({ ...accounts[0], data: { eventId: "different-event" } }), /no longer open for this event/);
  assert.equal((await db.collection("events").doc("burst-event").collection("checkins").get()).size, 0);
  accounts[0].data.eventId = "burst-event";
  const checkinStarted = performance.now();
  await Promise.all(accounts.map((request) => recordEventCheckIn.run(request)));
  await Promise.all(accounts.map(async (request) => {
    const duplicate = await recordEventCheckIn.run(request);
    assert.equal(duplicate.awarded, false);
    assert.equal(duplicate.points, 1);
    // A sign-in refresh must never overwrite attendance earned concurrently.
    assert.equal((await ensureUserProfile.run(request)).points, 1);
  }));
  assert.equal((await db.collection("events").doc("burst-event").collection("checkins").get()).size, 70);
  assert.equal(sheetRequests, 0);
  // Recover a legacy partially initialized profile without discarding history.
  await db.collection("users").doc(accounts[0].auth.uid).update({ createdAt: FieldValue.delete() });
  assert.equal((await finalizeAccount.run(accounts[0])).points, 1);
  assert.equal((await db.collection("attendanceSyncQueue").get()).size, 70);
  console.log(JSON.stringify({ burstAccounts: 70, signupMs, checkinAndRetryMs: Math.round(performance.now() - checkinStarted), sheetRequests }));

  await assert.rejects(drainMemberExports(db, async () => { throw new Error("Sheets offline"); }), /Sheets offline/);
  assert.equal((await db.collection("attendanceSyncQueue").get()).size, 70, "failure keeps all work queued");
  let changedUid;
  await drainMemberExports(db, async (profiles) => {
    if (changedUid) return;
    changedUid = profiles[0].uid;
    const batch = db.batch();
    batch.update(db.collection("users").doc(changedUid), { displayName: "Changed during export" });
    enqueueMemberExport(batch, db, changedUid);
    await batch.commit();
  });
  assert.equal((await db.collection("attendanceSyncQueue").get()).size, 1, "concurrent changes remain queued");
  await drainMemberExports(db, async (profiles) => assert.equal(profiles[0].displayName, "Changed during export"));
  const removedUid = accounts[1].auth.uid;
  await db.collection("users").doc(removedUid).delete();
  const deletion = db.batch(); enqueueMemberExport(deletion, db, removedUid); await deletion.commit();
  await drainMemberExports(db, async (profiles) => assert.equal(profiles[0].deleted, true));
  await assert.rejects(recordEventCheckIn.run(accounts[1]), /Finish creating/);

  assert.equal(memberExportChanged({ displayName: "A", lastLoginAt: 1 }, { displayName: "A", lastLoginAt: 2 }), false);
  assert.equal(memberExportChanged(undefined, { displayName: "A" }), true);
  assert.equal(memberExportChanged({ displayName: "A" }, undefined), true);
  // Queue an existing member who never checks in through the migration.
  await seedMemberExport(db);
  await drainMemberExports(db, async () => {});

  const largeStarted = performance.now();
  for (let page = 0; page < 40; page++) {
    const batch = db.batch();
    for (let i = 0; i < 250; i++) {
      const uid = `scale-${String(page * 250 + i).padStart(5, "0")}`;
      batch.set(db.collection("users").doc(uid), { displayName: uid, role: "member", checkedInEvents: [], createdAt: FieldValue.serverTimestamp() });
      enqueueMemberExport(batch, db, uid);
    }
    await batch.commit();
  }
  let exported = 0; let batches = 0;
  const result = await drainMemberExports(db, async (profiles) => { exported += profiles.length; batches++; });
  assert.equal(exported, 10000);
  assert.equal(batches, 40);
  assert.equal(result.remaining, false);
  console.log(JSON.stringify({ scaleMembers: exported, exportBatches: batches, seedAndExportMs: Math.round(performance.now() - largeStarted) }));
});


test("custom domain supports every callable and its own passkeys", () => {
  assert.equal(allowedOrigins.get("https://flqcs.com"), "flqcs.com");
  assert.equal(allowedOrigins.has("https://untrusted.example"), false);
});

test("deleted members and former presidents can recreate an account safely", { skip: !enabled, timeout: 30000 }, async () => {
  const db = getFirestore();
  const auth = getAuth();
  await auth.createUser({ uid: "deletion-manager", email: "manager@ufl.edu" });
  await db.collection("users").doc("deletion-manager").set({ leadership: "treasurer" });
  const manager = { uid: "deletion-manager", token: { leadership: "treasurer", auth_time: Math.floor(Date.now() / 1000) } };
  for (const role of ["member", "president"]) {
    const email = `recreated-${role}@ufl.edu`;
    const user = await auth.createUser({ email, password: "recreate-test-password" });
    const request = { auth: { uid: user.uid, token: { email, auth_time: Math.floor(Date.now() / 1000) } }, data: {} };
    await finalizeAccount.run(request);
    const userRef = db.collection("users").doc(user.uid);
    await userRef.set({ displayName: "Already Reclaimed", username: `old-${role}`, checkedInEvents: ["old-event"] }, { merge: true });
    await Promise.all([
      db.collection("usernameDirectory").doc(`old-${role}`).set({ uid: user.uid }),
      db.collection("usernameDirectory").doc(`alias-${role}`).set({ uid: user.uid }),
      db.collection("displayNameDirectory").doc(`original ${role}`).set({ uid: user.uid }),
      db.collection("displayNameDirectory").doc("already reclaimed").set({ uid: "another-member" }),
      userRef.collection("passkeys").doc("old-key").set({ credentialId: `key-${role}` }),
      db.collection("passkeyCredentials").doc(`key-${role}`).set({ uid: user.uid }),
      db.collection("hackathonInterest").doc(user.uid).set({ interested: true }),
      db.collection("events").doc("old-event").collection("checkins").doc(user.uid).set({ uid: user.uid })
    ]);
    if (role === "president") {
      await userRef.set({ leadership: "president", role: "officer" }, { merge: true });
      await auth.setCustomUserClaims(user.uid, { leadership: "president" });
      await assert.rejects(removeMember.run({ auth: manager, data: { uid: user.uid } }), /Open that leadership seat/);
      // Existing officer-management flow opens the seat before deleting its holder.
      await userRef.set({ leadership: "", roleOverride: "officer" }, { merge: true });
      await auth.setCustomUserClaims(user.uid, { leadership: "" });
    }
    await removeMember.run({ auth: manager, data: { uid: user.uid } });
    await assert.rejects(auth.getUser(user.uid), { code: "auth/user-not-found" });
    await assert.rejects(ensureUserProfile.run(request), { code: "unauthenticated" });
    assert.equal((await userRef.get()).exists, false);
    assert.equal((await userRef.collection("passkeys").get()).size, 0);
    assert.equal((await db.collection("usernameDirectory").where("uid", "==", user.uid).get()).size, 0);
    assert.equal((await db.collection("displayNameDirectory").doc("already reclaimed").get()).data().uid, "another-member");
    assert.equal((await db.collection("hackathonInterest").doc(user.uid).get()).exists, false);
    // Even an orphaned key cannot mint a token that resurrects the deleted uid.
    await db.collection("passkeyCredentials").doc(`orphan-${role}`).set({ uid: user.uid });
    await db.collection("passkeyChallenges").doc(`challenge-${role}`).set({ type: "authentication", expiresAt: Timestamp.fromMillis(Date.now() + 60000) });
    await assert.rejects(finishPasskeySignIn.run({ data: { challengeId: `challenge-${role}`, response: { id: `orphan-${role}` } } }), { code: "unauthenticated" });
    const recreated = await auth.createUser({ email, password: "new-test-password" });
    const newRequest = { auth: { uid: recreated.uid, token: { email, auth_time: Math.floor(Date.now() / 1000) } }, data: {} };
    const profile = await finalizeAccount.run(newRequest);
    assert.notEqual(recreated.uid, user.uid);
    assert.equal(profile.role, "member");
    assert.equal(profile.points, 0);
    const renamed = await updateUserProfile.run({ ...newRequest, data: { displayName: `Original ${role}` } });
    assert.equal(renamed.displayName, `Original ${role}`);
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "new-test-password", returnSecureToken: true })
    });
    assert.equal((await response.json()).localId, recreated.uid);
    // A late old session cannot recreate the profile while deletion is in progress.
    await db.collection("accountDeletions").doc(recreated.uid).set({ startedAt: FieldValue.serverTimestamp() });
    await assert.rejects(ensureUserProfile.run(newRequest), { code: "unauthenticated" });
  }
});
