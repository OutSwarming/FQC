import { randomUUID } from "node:crypto";
import { FieldValue, FieldPath } from "firebase-admin/firestore";

export const memberSyncFields = ["displayName", "role", "officerTitle", "checkedInEvents", "lastCheckInAt"];
export function memberExportChanged(before, after) {
  if (!before || !after) return true;
  return memberSyncFields.some((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
}

export function enqueueMemberExport(writer, db, uid) {
  writer.set(db.collection("attendanceSyncQueue").doc(`member-${uid}`), {
    uid, generation: randomUUID(), updatedAt: FieldValue.serverTimestamp()
  });
}

// Acknowledge only the exact version exported. A check-in arriving during a
// Sheets request must remain queued, including when a legacy queue row is read.
export async function acknowledgeExports(db, documents) {
  await db.runTransaction(async (transaction) => {
    const current = await transaction.getAll(...documents.map((document) => document.ref));
    current.forEach((document, index) => {
      if (document.exists && document.updateTime.isEqual(documents[index].updateTime)) transaction.delete(document.ref);
    });
  });
}

// One-time, resumable import includes members who have never checked in. Normal
// runs only read changed members; they never scan the 10,000-account directory.
export async function seedMemberExport(db, pageSize = 250) {
  const migrationRef = db.collection("system").doc("memberExportMigrationV1");
  const migration = (await migrationRef.get()).data() || {};
  if (migration.complete) return;
  let query = db.collection("users").orderBy(FieldPath.documentId()).limit(pageSize);
  if (migration.cursor) query = query.startAfter(migration.cursor);
  const users = await query.get();
  const batch = db.batch();
  users.docs.forEach((user) => enqueueMemberExport(batch, db, user.id));
  batch.set(migrationRef, {
    cursor: users.docs.at(-1)?.id || migration.cursor || "",
    complete: users.size < pageSize, updatedAt: FieldValue.serverTimestamp()
  });
  await batch.commit();
}

export async function drainMemberExports(db, exportProfiles, { maxRecords = 10000, deadline = Date.now() + 450000 } = {}) {
  let cursor;
  let processed = 0;
  while (processed < maxRecords && Date.now() < deadline) {
    let query = db.collection("attendanceSyncQueue").orderBy(FieldPath.documentId()).limit(Math.min(250, maxRecords - processed));
    if (cursor) query = query.startAfter(cursor);
    const queued = await query.get();
    if (queued.empty) break;
    const uids = [...new Set(queued.docs.map((document) => document.data().uid).filter(Boolean))];
    const users = uids.length ? await db.getAll(...uids.map((uid) => db.collection("users").doc(uid))) : [];
    // Read authoritative profiles, never an old attendance payload. Out-of-order
    // trigger delivery and old retry queues cannot roll names or points back.
    await exportProfiles(users.map((user) => ({ uid: user.id, deleted: !user.exists, ...user.data() })));
    await acknowledgeExports(db, queued.docs);
    processed += queued.size;
    cursor = queued.docs.at(-1);
    if (queued.size < 250) break;
  }
  const remaining = !(await db.collection("attendanceSyncQueue").limit(1).get()).empty;
  return { processed, remaining };
}
