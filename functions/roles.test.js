import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetItemData,
  buildLeaderboardEntries,
  canUseUsernameReservation,
  canManageOfficerRoles,
  displayNameKey,
  distanceMilesBetween,
  isSafeEventId,
  isActiveUsernameReservation,
  leadershipForRole,
  leadershipRosterFromRows,
  leadershipRowsFromValues,
  masterMemberKey,
  normalizedEventStatus,
  officerResourceCatalog,
  officerResourceRoleKey,
  parseCsv,
  pointsForEvents,
  resolvedAccess,
  sheetColumnLetter,
  usernameReservationHash,
  usernameForSignupEmail,
  usernameForInput
} from "./index.js";

test("CSV parsing preserves quoted officer titles", () => {
  const rows = parseCsv('Officer Name,Role,Linked Account,Active\n"Jordan Q","Vice President","uid-1",Yes\n');
  assert.deepEqual(rows[1], ["Jordan Q", "Vice President", "uid-1", "Yes"]);
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

test("roles come from stored Firestore state, never from an outside lookup", () => {
  assert.deepEqual(resolvedAccess({ roleOverride: "officer", officerTitle: "Workshop Coordinator" }), {
    role: "officer",
    leadership: "",
    officerTitle: "Workshop Coordinator",
    canManageOfficers: false
  });
  assert.deepEqual(resolvedAccess({ roleOverride: "officer" }), {
    role: "officer",
    leadership: "",
    officerTitle: "Officer",
    canManageOfficers: false
  });
  assert.deepEqual(resolvedAccess({}), {
    role: "member",
    leadership: "",
    officerTitle: "",
    canManageOfficers: false
  });
  assert.deepEqual(resolvedAccess({ roleOverride: "member" }), {
    role: "member",
    leadership: "",
    officerTitle: "",
    canManageOfficers: false
  });
});

test("an unverified account cannot claim a role by supplying extra fields", () => {
  // Nothing a client can put in its own document promotes it. Only leadership and
  // roleOverride, both written by callables, mean anything.
  assert.equal(resolvedAccess({ role: "officer" }).role, "member");
  assert.equal(resolvedAccess({ officerTitle: "President" }).role, "member");
  assert.equal(resolvedAccess({ canManageOfficers: true }).canManageOfficers, false);
  assert.equal(resolvedAccess({ leadership: "admin", roleOverride: "officer" }).canManageOfficers, false);
  assert.equal(resolvedAccess({ ufidFingerprint: "a".repeat(64), ufidMatched: true }).role, "member");
});

test("a stored leadership seat outranks a plain officer grant", () => {
  const expectations = [
    ["president", "President", true],
    ["vice_president", "Vice President", false],
    ["treasurer", "Treasurer", true]
  ];
  for (const [leadership, officerTitle, canManageOfficers] of expectations) {
    assert.deepEqual(resolvedAccess({ leadership }), { role: "officer", leadership, officerTitle, canManageOfficers });
    assert.deepEqual(resolvedAccess({ leadership, roleOverride: "member" }), {
      role: "officer",
      leadership,
      officerTitle,
      canManageOfficers
    });
  }
});

test("leadership sheet parsing keeps every officer row and its linked account", () => {
  assert.deepEqual(leadershipRowsFromValues([
    ["Officer Name", "Linked Account", "Title", "Active", "Security Note"],
    ["Alex", "uid-alex", "President", "Yes", "Linked"],
    ["Sidney", "", "Vice President", "No", "Pending"]
  ]), [
    { row: 2, name: "Alex", title: "President", linkedUid: "uid-alex", active: true, note: "Linked" },
    { row: 3, name: "Sidney", title: "Vice President", linkedUid: "", active: false, note: "Pending" }
  ]);
});

test("a sheet still carrying the old fingerprint column reads as a claimed seat", () => {
  // The tab keeps working before anyone renames column B; a leftover hash just
  // means that seat is already taken, which is all the column is used for now.
  const rows = leadershipRowsFromValues([
    ["Officer Name", "UFID Fingerprint", "Title", "Active", "Security Note"],
    ["Alex", "a".repeat(64), "President", "Yes", ""],
    ["Sidney", "", "Vice President", "No", ""]
  ]);
  assert.deepEqual(rows.map((entry) => entry.linkedUid), ["a".repeat(64), ""]);
  assert.deepEqual(leadershipRosterFromRows(rows).map((seat) => seat.pending), [false, true]);
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

test("the officer roster keeps every leadership seat, not just the pending ones", () => {
  const rows = leadershipRowsFromValues([
    ["Officer Name", "Linked Account", "Title", "Active", "Security Note"],
    ["Alexander Heard", "uid-alex", "President", "Yes", ""],
    ["Sidney Brann", "", "Program Officer", "No", ""],
    ["Carter Swarm", "uid-carter", "Treasurer", "Yes", ""],
    ["Jake", "", "Social Media", "No", ""]
  ]);
  const roster = leadershipRosterFromRows(rows);

  assert.equal(roster.length, 4);
  assert.deepEqual(roster.map((seat) => seat.name), ["Alexander Heard", "Sidney Brann", "Carter Swarm", "Jake"]);
  assert.deepEqual(roster.map((seat) => seat.pending), [false, true, false, true]);
  assert.deepEqual(roster.map((seat) => seat.linked), [true, false, true, false]);
  assert.equal(roster.every((seat) => !("linkedUid" in seat) && !("fingerprint" in seat)), true);
});

test("display names allow any characters but collide case- and space-insensitively", () => {
  assert.equal(displayNameKey("Alex Q"), "alex q");
  assert.equal(displayNameKey("  ALEX   q "), "alex q");
  assert.equal(displayNameKey("Ana María 🐊"), "ana maría 🐊");
  assert.notEqual(displayNameKey("Alex Q"), displayNameKey("Alexa Q"));
  assert.equal(displayNameKey("a/b"), "a∕b");
  assert.equal(displayNameKey(""), "");
});

test("event ids from the workbook are accepted and unsafe ids are rejected", () => {
  assert.equal(isSafeEventId("fqc-2026-09-03-general-meeting"), true);
  assert.equal(isSafeEventId(""), false);
  assert.equal(isSafeEventId("ab"), false);
  assert.equal(isSafeEventId("fqc 2026 meeting"), false);
  assert.equal(isSafeEventId("'Treasurer Breakdown'!A1"), false);
});

test("treasurer money edits keep itemized values and reject incomplete rows", () => {
  const item = budgetItemData({
    eventId: "fqc-2026-09-03-general-meeting",
    event: "General Meeting",
    date: "9/3/2026",
    item: "Pizza",
    quantity: "4",
    unit: "order",
    unitCost: "$18.50",
    actualCost: "72",
    fundingSource: "Operational Funding",
    status: "Purchased",
    notes: "Receipt submitted"
  });

  assert.equal(item.date, "2026-09-03");
  assert.equal(item.quantity, 4);
  assert.equal(item.unitCost, 18.5);
  assert.equal(item.actualCost, 72);
  assert.equal(item.status, "Purchased");
  assert.equal(budgetItemData({ eventId: "fqc-2026-09-03-general-meeting", event: "General Meeting", date: "2026-09-03", item: "Pizza", status: "" }).status, "Estimate");
  assert.throws(() => budgetItemData({ eventId: "not a real id", event: "General Meeting", date: "2026-09-03", item: "Pizza" }), /Choose an event/);
  assert.throws(() => budgetItemData({ eventId: "fqc-2026-09-03-general-meeting", event: "General Meeting", date: "2026-09-03", item: "" }), /budget item name/);
});

test("only UF addresses can open a new account, with named exceptions", async () => {
  const { assertEligibleSignupEmail } = await import("./index.js");
  assert.doesNotThrow(() => assertEligibleSignupEmail("gator@ufl.edu"));
  assert.doesNotThrow(() => assertEligibleSignupEmail("Gator@UFL.edu"));
  assert.throws(() => assertEligibleSignupEmail("someone@gmail.com"), /UF email/);
  assert.throws(() => assertEligibleSignupEmail("someone@notufl.edu"), /UF email/);
  assert.throws(() => assertEligibleSignupEmail("ufl.edu"), /UF email/);
  assert.throws(() => assertEligibleSignupEmail(""), /UF email/);

  process.env.FQC_EMAIL_ALLOWLIST = "founder@gmail.com, other@example.com";
  assert.doesNotThrow(() => assertEligibleSignupEmail("founder@gmail.com"));
  assert.throws(() => assertEligibleSignupEmail("stranger@gmail.com"), /UF email/);
  delete process.env.FQC_EMAIL_ALLOWLIST;
});

test("usernames are normalized, constrained, and reserve trusted club names", () => {
  assert.equal(usernameForInput(" Quantum.Gator "), "quantum.gator");
  assert.equal(usernameForInput("two"), "two");
  assert.equal(usernameForInput("no spaces"), "");
  assert.equal(usernameForInput("admin"), "");
  assert.equal(usernameForInput("a"), "");
  assert.equal(usernameForSignupEmail("New.Gator@ufl.edu"), "new.gator");
  assert.equal(usernameForSignupEmail("person@gmail.com"), "");
  assert.equal(usernameForSignupEmail("president@ufl.edu"), "");
});

test("automatic UF usernames stay independent at event signup scale", () => {
  const usernames = Array.from({ length: 1_000 }, (_, index) => (
    usernameForSignupEmail(`gator${String(index).padStart(4, "0")}@ufl.edu`)
  ));
  assert.equal(usernames.every(Boolean), true);
  assert.equal(new Set(usernames).size, usernames.length);
});

test("username reservations are private, exclusive, and expire", () => {
  const token = "browser-only-reservation-token";
  const now = Date.now();
  const reservation = {
    reservationHash: usernameReservationHash(token),
    reservationExpiresAt: now + 60_000
  };

  assert.equal(reservation.reservationHash.length, 64);
  assert.notEqual(reservation.reservationHash, token);
  assert.equal(isActiveUsernameReservation(reservation, now), true);
  assert.equal(canUseUsernameReservation(reservation, token, now), true);
  assert.equal(canUseUsernameReservation(reservation, "another-browser", now), false);
  assert.equal(isActiveUsernameReservation(reservation, now + 60_001), false);
  assert.equal(canUseUsernameReservation(reservation, token, now + 60_001), false);
});
