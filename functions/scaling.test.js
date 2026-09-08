import assert from "node:assert/strict";
import test from "node:test";
import { automaticUsernameCandidates, usernameForSignupEmail } from "./lib/accounts.js";
import { attendanceSyncId, planAttendanceSheetBatch } from "./lib/attendance.js";
import { buildLeaderboardEntries } from "./lib/leaderboard.js";

test("automatic usernames have deterministic collision-safe fallbacks", () => {
  const candidates = automaticUsernameCandidates("avery.long.quantum.gator");
  assert.equal(candidates.length, 50);
  assert.equal(new Set(candidates).size, candidates.length);
  assert.equal(candidates.every((username) => username.length <= 24), true);
  assert.equal(usernameForSignupEmail("new.gator@ufl.edu"), "new.gator");
});

test("five hundred account usernames stay independent", () => {
  const usernames = Array.from({ length: 500 }, (_, index) => usernameForSignupEmail(`member${index}@ufl.edu`));
  assert.equal(new Set(usernames).size, 500);
  assert.equal(usernames.every(Boolean), true);
});

test("attendance queue ids are stable, unique, and retry-safe", () => {
  const ids = Array.from({ length: 500 }, (_, index) => attendanceSyncId("gbm-1", `member-${index}`));
  assert.equal(new Set(ids).size, 500);
  assert.equal(ids[42], attendanceSyncId("gbm-1", "member-42"));
  assert.notEqual(ids[42], attendanceSyncId("gbm-2", "member-42"));
});

test("a full attendance batch coalesces members and separates updates from appends", () => {
  const columns = new Map([["gbm-1", 5], ["gbm-2", 6]]);
  const existingRows = new Map(Array.from({ length: 125 }, (_, index) => [`key-${index}`, index + 3]));
  const values = Array.from({ length: 250 }, (_, index) => ({
    memberKey: `key-${index}`,
    displayName: `Member ${index}`,
    roleLabel: "Member",
    points: 1,
    checkedInEvents: ["gbm-1"],
    checkedInAt: "2026-09-01T20:00:00.000Z"
  }));
  values.push({
    memberKey: "key-249",
    displayName: "Member 249",
    roleLabel: "Member",
    points: 2,
    checkedInEvents: ["gbm-1", "gbm-2"],
    checkedInAt: "2026-09-01T21:00:00.000Z"
  });
  const plan = planAttendanceSheetBatch(values, columns, existingRows);
  assert.equal(plan.updates.length, 125);
  assert.equal(plan.appends.length, 125);
  const merged = plan.appends.find((entry) => entry.memberKey === "key-249");
  assert.deepEqual(merged.attendedColumns, [5, 6]);
  assert.equal(merged.baseValues[3], 2);
});

test("leaderboard aggregation keeps one compact top-one-hundred snapshot", () => {
  let entries = [];
  for (let index = 0; index < 500; index += 1) {
    entries = buildLeaderboardEntries(entries, {
      uid: `member-${index}`,
      displayName: `Member ${index}`,
      points: index,
      role: "member"
    });
  }
  assert.equal(entries.length, 100);
  assert.equal(entries[0].points, 499);
  assert.equal(entries.at(-1).points, 400);
});


// Exercise the actual export row planner against a populated 10K roster.
import { memberSheetRows, masterMemberKey } from "./index.js";
test("10K member rows are stable, formula-safe values and removals clear attendance", () => {
  const context = { columns: new Map([["event", 5]]), rowByKey: new Map(), lastCheckInByKey: new Map(), nextRow: 3 };
  const profiles = Array.from({ length: 10000 }, (_, i) => ({ uid: `member-${i}`, displayName: i === 9999 ? "=1+1" : `Member ${i}`, checkedInEvents: ["event"] }));
  const first = memberSheetRows(context, profiles);
  assert.equal(first.length, 10000);
  assert.equal(first[9999].range, "'Master Members'!A10002:IZ10002");
  assert.equal(first[9999].values[0][1], "=1+1");
  assert.equal(first[9999].values[0][5], "✓");
  const retry = memberSheetRows(context, [profiles[9999]]);
  assert.deepEqual(retry[0], first[9999]);
  assert.equal(context.nextRow, 10003);
  const removed = memberSheetRows(context, [{ uid: "member-9999", deleted: true }])[0];
  assert.equal(removed.values[0][0], masterMemberKey("member-9999"));
  assert.equal(removed.values[0].slice(1).every(value => value === ""), true);
});
