import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLeaderboardEntries,
  canManageOfficerRoles,
  distanceMilesBetween,
  leadershipForRole,
  leadershipRowsFromValues,
  masterMemberKey,
  normalizedEventStatus,
  officerResourceCatalog,
  officerResourceRoleKey,
  parseCsv,
  pointsForEvents,
  resolvedAccess,
  sheetColumnLetter
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

test("officer resources are complete, unique, and mapped to the signed-in role", () => {
  assert.equal(officerResourceRoleKey("", "president"), "president");
  assert.equal(officerResourceRoleKey("Vice President"), "vice-president");
  assert.equal(officerResourceRoleKey("Workshop Coordinator"), "workshop");
  assert.equal(officerResourceRoleKey("Additional Officer"), "general");

  assert.equal(officerResourceCatalog.length, 20);
  assert.equal(new Set(officerResourceCatalog.map((resource) => resource.id)).size, officerResourceCatalog.length);
  assert.ok(officerResourceCatalog.some((resource) => resource.title === "Treasurer Guide" && resource.featured.includes("treasurer")));
  assert.ok(officerResourceCatalog.every((resource) => /^https:\/\/drive\.google\.com\/open\?id=[\w-]+$/.test(resource.url)));
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

test("every current e-board title resolves to the correct access level", () => {
  const expectations = [
    ["President", "president", true],
    ["Vice President", "vice_president", false],
    ["Treasurer", "treasurer", true],
    ["Additional Officer", "", false]
  ];
  for (const [title, leadership, canManageOfficers] of expectations) {
    assert.deepEqual(resolvedAccess({}, { role: title }), {
      role: "officer",
      leadership,
      officerTitle: title,
      canManageOfficers
    });
  }
});

test("leadership sheet parsing keeps every officer row and secure fingerprint state", () => {
  const fingerprint = "a".repeat(64);
  assert.deepEqual(leadershipRowsFromValues([
    ["Officer Name", "UFID Fingerprint", "Title", "Active", "Security Note"],
    ["Alex", fingerprint, "President", "Yes", "Matched"],
    ["Sidney", "", "Vice President", "No", "Pending"]
  ]), [
    { row: 2, name: "Alex", title: "President", fingerprint, active: true, note: "Matched" },
    { row: 3, name: "Sidney", title: "Vice President", fingerprint: "", active: false, note: "Pending" }
  ]);
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

test("event status is constrained to the spreadsheet dropdown", () => {
  assert.equal(normalizedEventStatus("Confirmed", "2026-09-03"), "Confirmed");
  assert.equal(normalizedEventStatus("made up", "2099-01-01"), "Planned");
  assert.equal(normalizedEventStatus("", "2020-01-01"), "Completed");
});

test("member attendance uses stable private keys and spreadsheet columns", () => {
  assert.equal(masterMemberKey("firebase-user-1").length, 64);
  assert.notEqual(masterMemberKey("firebase-user-1"), masterMemberKey("firebase-user-2"));
  assert.equal(sheetColumnLetter(0), "A");
  assert.equal(sheetColumnLetter(25), "Z");
  assert.equal(sheetColumnLetter(26), "AA");
  assert.ok(distanceMilesBetween(
    { lat: 29.64631, lng: -82.34788 },
    { lat: 29.64794, lng: -82.34394 }
  ) < 2);
  assert.ok(distanceMilesBetween(
    { lat: 29.64631, lng: -82.34788 },
    { lat: 29.70, lng: -82.35 }
  ) > 2);
});
