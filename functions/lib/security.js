import { createHash, randomInt } from 'node:crypto';
import { isIP } from 'node:net';
import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export function sessionIsRevoked(user, token = {}) {
  const revokedAfter = Math.floor(Date.parse(user.tokensValidAfterTime || '') / 1000);
  return Number.isFinite(revokedAfter) && Number(token.auth_time || 0) < revokedAfter;
}

export function requestNetwork(request) {
  const raw = request.rawRequest;
  // Functions Framework trusts all proxies: req.ip can be a spoofed leftmost XFF.
  // Bucket the rightmost hop appended by Cloud Run instead. If another proxy is
  // present this conservatively shares a bucket rather than trusting its claims.
  const forwarded = String(raw?.headers?.['x-forwarded-for'] || '').split(',').at(-1).trim();
  if (isIP(forwarded)) return forwarded;
  return raw?.socket?.remoteAddress || raw?.ip || 'unknown';
}

export function rateLimitRules(name, request) {
  const ip = requestNetwork(request);
  const uid = request.auth?.uid;
  const login = ['signInWithUsername', 'requestAccountPasswordReset', 'beginPasskeySignIn', 'finishPasskeySignIn'].includes(name);
  const rules = [{ subject: `ip:${ip}`, limit: login ? 2400 : 24000, windowMs: 600000 }];
  if (uid) rules.push({ subject: `uid:${uid}`, limit: 1200, windowMs: 600000 });
  if (login && request.data?.identifier) rules.push({ subject: `login:${ip}:${String(request.data.identifier).trim().toLowerCase().slice(0,180)}`, limit: 30, windowMs: 600000 });
  return rules;
}

export async function enforceRateLimit(db, name, request, now = Date.now()) {
  const group = ['signInWithUsername', 'requestAccountPasswordReset', 'beginPasskeySignIn', 'finishPasskeySignIn'].includes(name) ? 'login' : 'app';
  const rules = rateLimitRules(name, request).map(rule => {
    const window = Math.floor(now / rule.windowMs);
    // Bounded IP shards avoid serializing a whole event's Wi-Fi through one doc.
    const ipShard = rule.subject.startsWith('ip:') ? randomInt(16) : null;
    const limit = ipShard === null ? rule.limit : Math.ceil(rule.limit / 16);
    const subject = ipShard === null ? rule.subject : `${rule.subject}:${ipShard}`;
    const key = createHash('sha256').update(`${group}:${window}:${subject}`).digest('hex');
    return { ...rule, limit, ref: db.collection('requestLimits').doc(key), expiresAt: Timestamp.fromMillis((window + 2) * rule.windowMs) };
  });
  // Atomic increments commute under a shared Wi-Fi burst. Read after commit:
  // parallel requests may reject conservatively at the limit, but cannot lose
  // increments or over-admit by racing a read/check/write transaction.
  const batch = db.batch();
  rules.forEach(rule => batch.set(rule.ref, { count: FieldValue.increment(1), expiresAt: rule.expiresAt }, { merge: true }));
  await batch.commit();
  const snapshots = await db.getAll(...rules.map(rule => rule.ref));
  if (rules.some((rule, i) => Number(snapshots[i].data()?.count || 0) > rule.limit)) {
    throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a few minutes and try again.');
  }
}

const publicEventFields = ['Date','Time','Type','Location','Event Status','Event Name','Event Date','Start Time','Room','Event Description','Published','Event ID'];
const publicLocationFields = ['Location','Address','Lat','Long','Latitude','Longitude'];
export function publicScheduleCsv(rows, kind) {
  const [headers = [], ...values] = rows;
  const allowed = kind === 'events' ? publicEventFields : publicLocationFields;
  const columns = headers.map((name, i) => ({ name: String(name).trim(), i })).filter(col => allowed.includes(col.name));
  const published = headers.indexOf('Published');
  const safeRows = values.filter(row => kind !== 'events' || published < 0 || String(row[published]).toLowerCase() === 'yes');
  return [columns.map(col => col.name), ...safeRows.slice(0, 250).map(row => columns.map(col => String(row[col.i] ?? '').slice(0, 1500)))]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}
