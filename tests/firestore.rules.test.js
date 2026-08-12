import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: "florida-quantum-computing",
    firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "users", "member-1"), { displayName: "Member", role: "member" });
    await setDoc(doc(database, "users", "member-2"), { displayName: "Other Member", role: "member" });
    await setDoc(doc(database, "settings", "checkin"), { eventId: "gbm-1", open: true });
    await setDoc(doc(database, "events", "gbm-1", "checkins", "member-1"), { uid: "member-1" });
    await setDoc(doc(database, "passkeyCredentials", "credential-1"), { uid: "member-1" });
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

test("members can read only their own profile", async () => {
  const database = testEnvironment.authenticatedContext("member-1", { role: "member" }).firestore();
  await assertSucceeds(getDoc(doc(database, "users", "member-1")));
  await assertFails(getDoc(doc(database, "users", "member-2")));
});

test("clients cannot change role fields directly", async () => {
  const database = testEnvironment.authenticatedContext("member-1", { role: "member" }).firestore();
  await assertFails(setDoc(doc(database, "users", "member-1"), { role: "officer" }, { merge: true }));
});

test("President and Treasurer claims can read member profiles but secrets stay server-only", async () => {
  const database = testEnvironment.authenticatedContext("treasurer-1", { role: "officer", leadership: "treasurer", manageOfficers: true }).firestore();
  const profile = await assertSucceeds(getDoc(doc(database, "users", "member-2")));
  assert.equal(profile.data().displayName, "Other Member");
  await assertFails(getDoc(doc(database, "passkeyCredentials", "credential-1")));
  await assertFails(getDoc(doc(database, "ufidClaimAttempts", "member-1")));
});

test("check-in state is public while mutations remain server-only", async () => {
  const publicDatabase = testEnvironment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDatabase, "settings", "checkin")));
  await assertFails(setDoc(doc(publicDatabase, "settings", "checkin"), { open: false }, { merge: true }));
});

test("members read their own attendance and officers can read attendance", async () => {
  const memberDatabase = testEnvironment.authenticatedContext("member-1", { role: "member" }).firestore();
  const otherDatabase = testEnvironment.authenticatedContext("member-2", { role: "member" }).firestore();
  const officerDatabase = testEnvironment.authenticatedContext("officer-1", { role: "officer" }).firestore();
  const checkIn = doc(memberDatabase, "events", "gbm-1", "checkins", "member-1");
  await assertSucceeds(getDoc(checkIn));
  await assertFails(getDoc(doc(otherDatabase, "events", "gbm-1", "checkins", "member-1")));
  await assertSucceeds(getDoc(doc(officerDatabase, "events", "gbm-1", "checkins", "member-1")));
  await assertFails(setDoc(checkIn, { uid: "member-1" }, { merge: true }));
});
