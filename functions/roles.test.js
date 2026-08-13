import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLeaderboardEntries,
  canManageOfficerRoles,
  leadershipForRole,
  parseCsv,
  pointsForEvents,
  resolvedAccess
} from "./index.js";

test("CSV parsing preserves quoted officer titles", () => {
  const rows = parseCsv('Officer Name,Role,UFID Fingerprint,Active\n"Jordan Q","Vice President","abc",Yes\n');
  assert.deepEqual(rows[1], ["Jordan Q", "Vice President", "abc", "Yes"]);
});

test("only President and Treasurer titles receive officer-management authority", () => {
  assert.equal(leadershipForRole("President"), "president");
  assert.equal(leadershipForRole("Vice President"), "vice_president");
  assert.equal(leadershipForRole(" Treasurer "), "treasurer");
  assert.equal(canManageOfficerRoles({ leadership: "president" }), true);
  assert.equal(canManageOfficerRoles({ leadership: "vice_president" }), false);
  assert.equal(canManageOfficerRoles({ role: "officer" }), false);
});

test("spreadsheet roles and protected leadership resolve predictably", () => {
  assert.deepEqual(resolvedAccess({}, { role: "Workshop Coordinator" }), {
    role: "officer",
    leadership: "",
    officerTitle: "Workshop Coordinator",
    canManageOfficers: false
  });
  assert.deepEqual(resolvedAccess({ roleOverride: "member" }, { role: "President" }), {
    role: "officer",
    leadership: "president",
    officerTitle: "President",
    canManageOfficers: true
  });
  assert.equal(resolvedAccess({ roleOverride: "member" }, { role: "Secretary" }).role, "member");
  assert.deepEqual(resolvedAccess({}, { role: "Vice President" }), {
    role: "officer",
    leadership: "vice_president",
    officerTitle: "Vice President",
    canManageOfficers: false
  });
});

test("leaderboard points are one per unique event and server-ranked", () => {
  assert.equal(pointsForEvents(["gbm-1", "gbm-1", "workshop-1", ""]), 2);
  assert.equal(pointsForEvents([]), 0);

  const entries = buildLeaderboardEntries([
    { uid: "a", displayName: "Alex", points: 1, role: "member" },
    { uid: "b", displayName: "Bailey", points: 3, role: "officer" }
  ], { uid: "a", displayName: "Alex Q", points: 4, role: "member" });

  assert.deepEqual(entries, [
    { uid: "a", displayName: "Alex Q", points: 4, role: "member" },
    { uid: "b", displayName: "Bailey", points: 3, role: "officer" }
  ]);
});
