import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageOfficerRoles,
  leadershipForRole,
  parseCsv,
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
