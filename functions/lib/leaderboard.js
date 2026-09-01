import { FieldValue } from "firebase-admin/firestore";

export const maxLeaderboardEntries = 100;
export const maxLeaderboardUpdatesPerRun = 250;

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function profileRole(value) {
  return value === "officer" ? "officer" : "member";
}

export function uniqueEventIds(eventIds = []) {
  return [...new Set((Array.isArray(eventIds) ? eventIds : [])
    .map((eventId) => cleanText(eventId, 100))
    .filter(Boolean))].slice(0, 250);
}

export function pointsForEvents(eventIds = []) {
  return uniqueEventIds(eventIds).length;
}

export function buildLeaderboardEntries(entries = [], nextEntry = {}, limit = maxLeaderboardEntries) {
  const byUid = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const uid = cleanText(entry?.uid, 160);
    if (!uid) continue;
    byUid.set(uid, {
      uid,
      displayName: cleanText(entry.displayName || "FQC Member", 80),
      points: Math.max(0, Math.trunc(Number(entry.points) || 0)),
      role: profileRole(entry.role)
    });
  }

  const uid = cleanText(nextEntry?.uid, 160);
  if (uid) {
    byUid.set(uid, {
      uid,
      displayName: cleanText(nextEntry.displayName || "FQC Member", 80),
      points: Math.max(0, Math.trunc(Number(nextEntry.points) || 0)),
      role: profileRole(nextEntry.role)
    });
  }

  return [...byUid.values()]
    .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName) || a.uid.localeCompare(b.uid))
    .slice(0, Math.max(1, Math.min(maxLeaderboardEntries, Number(limit) || maxLeaderboardEntries)));
}

export function leaderboardEntry(uid, data = {}) {
  const checkedInEvents = uniqueEventIds(data.checkedInEvents);
  return {
    uid: cleanText(uid, 160),
    displayName: cleanText(data.displayName || "FQC Member", 80),
    points: pointsForEvents(checkedInEvents),
    role: profileRole(data.role)
  };
}

export function leaderboardUpdatePayload(uid, data = {}, deleted = false) {
  return {
    entry: leaderboardEntry(uid, data),
    deleted: deleted === true,
    updatedAt: FieldValue.serverTimestamp()
  };
}

export function queueLeaderboardUpdate(writer, db, uid, data = {}, deleted = false) {
  const ref = db.collection("leaderboardUpdates").doc(cleanText(uid, 160));
  writer.set(ref, leaderboardUpdatePayload(uid, data, deleted));
  return ref;
}

export async function saveLeaderboardUpdate(db, uid, data = {}, deleted = false) {
  const ref = db.collection("leaderboardUpdates").doc(cleanText(uid, 160));
  await ref.set(leaderboardUpdatePayload(uid, data, deleted));
  return ref;
}

export async function flushLeaderboardUpdates(db, limit = maxLeaderboardUpdatesPerRun) {
  const snapshotRef = db.collection("system").doc("leaderboardData");
  const updatesQuery = db.collection("leaderboardUpdates").limit(Math.max(1, Math.min(400, Number(limit) || maxLeaderboardUpdatesPerRun)));
  return db.runTransaction(async (transaction) => {
    const updates = await transaction.get(updatesQuery);
    if (updates.empty) return { processed: 0, remaining: false };
    const current = await transaction.get(snapshotRef);
    let entries = Array.isArray(current.data()?.entries) ? current.data().entries : [];
    for (const update of updates.docs) {
      const value = update.data() || {};
      const uid = cleanText(value.entry?.uid || update.id, 160);
      if (value.deleted === true) {
        entries = entries.filter((entry) => entry.uid !== uid);
      } else {
        entries = buildLeaderboardEntries(entries, value.entry);
      }
    }
    transaction.set(snapshotRef, {
      entries,
      participantCount: entries.length,
      scoring: "one-point-per-event",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    updates.docs.forEach((update) => transaction.delete(update.ref));
    return { processed: updates.size, remaining: updates.size >= limit, entries: entries.length };
  });
}
