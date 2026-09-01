import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

export const maxAttendanceSyncsPerRun = 250;

export function attendanceSyncId(eventId, uid) {
  return createHash("sha256")
    .update(`${cleanText(eventId, 100)}:${cleanText(uid, 160)}`)
    .digest("hex");
}

export function attendanceSyncPayload(value = {}) {
  return {
    memberKey: cleanText(value.memberKey, 80),
    uid: cleanText(value.uid, 160),
    eventId: cleanText(value.eventId, 100),
    displayName: cleanText(value.displayName || "FQC Member", 80),
    roleLabel: cleanText(value.roleLabel || "Member", 80),
    points: Math.max(0, Math.trunc(Number(value.points) || 0)),
    checkedInEvents: [...new Set((Array.isArray(value.checkedInEvents) ? value.checkedInEvents : [])
      .map((eventId) => cleanText(eventId, 100))
      .filter(Boolean))].slice(0, 250),
    checkedInAt: cleanText(value.checkedInAt, 40),
    attempts: Math.max(0, Math.trunc(Number(value.attempts) || 0)),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

export function planAttendanceSheetBatch(values = [], columnByEventId = new Map(), existingRows = new Map()) {
  const updates = [];
  const appends = [];
  const latestByMember = new Map();
  for (const value of values) {
    const memberKey = cleanText(value.memberKey, 80);
    if (!memberKey) continue;
    const previous = latestByMember.get(memberKey) || {};
    latestByMember.set(memberKey, {
      ...previous,
      ...value,
      memberKey,
      points: Math.max(Number(previous.points) || 0, Number(value.points) || 0),
      checkedInAt: String(previous.checkedInAt || "") > String(value.checkedInAt || "") ? previous.checkedInAt : value.checkedInAt,
      checkedInEvents: [...new Set([...(previous.checkedInEvents || []), ...(value.checkedInEvents || [])])]
    });
  }
  for (const value of latestByMember.values()) {
    const memberKey = value.memberKey;
    const attendedColumns = [...new Set(value.checkedInEvents || [])]
      .map((eventId) => columnByEventId.get(eventId))
      .filter(Number.isInteger);
    const baseValues = [memberKey, cleanText(value.displayName, 80), cleanText(value.roleLabel, 80), Number(value.points) || 0, value.checkedInAt];
    const existingRow = existingRows.get(memberKey);
    if (existingRow) {
      updates.push({ row: existingRow, baseValues, attendedColumns });
    } else {
      appends.push({ memberKey, baseValues, attendedColumns });
    }
  }
  return { updates, appends };
}
