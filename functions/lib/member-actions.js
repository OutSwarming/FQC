import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

export async function saveMemberRsvp(db, uid, eventId, going, validateEvent) {
  if (typeof going !== 'boolean') throw new HttpsError('invalid-argument', 'Choose RSVP or cancel RSVP.');
  await validateEvent(eventId);
  await db.runTransaction(async tx => {
    const userRef = db.collection('users').doc(uid);
    const [user, deletion] = await Promise.all([tx.get(userRef), tx.get(db.collection('accountDeletions').doc(uid))]);
    if (!user.exists || !user.data().createdAt || deletion.exists) throw new HttpsError('permission-denied', 'An active member account is required.');
    const profile = user.data();
    const officer = profile.roleOverride === 'officer' || ['president','vice_president','treasurer'].includes(profile.leadership);
    const data = {uid, eventId, going, displayName:String(profile.displayName || 'FQC Member').slice(0,80),role:officer?'officer':'member',updatedAt:FieldValue.serverTimestamp()};
    tx.set(db.collection('events').doc(eventId).collection('rsvps').doc(uid),data);
    // This private index avoids reading anyone else's RSVPs on member devices.
    tx.set(userRef.collection('eventRsvps').doc(eventId),{eventId,going,updatedAt:FieldValue.serverTimestamp()});
    tx.set(db.collection('rsvpSheetQueue').doc(`${uid}_${eventId}`),{eventId,updatedAt:FieldValue.serverTimestamp()});
  });
  return {eventId,going};
}

export function mergeRsvps(legacy = [], snapshots = []) {
  const entries = new Map(legacy.map(entry=>[entry.uid,entry]));
  for (const doc of snapshots) {
    const data=doc.data();
    if (data.going) entries.set(data.uid,{uid:data.uid,displayName:data.displayName,role:data.role});
    else entries.delete(data.uid);
  }
  return [...entries.values()];
}

export function offlinePermitAllows(permit, uid, eventId, now=Date.now()) {
  return permit?.uid === uid && permit.eventId === eventId && permit.expiresAt?.toMillis?.() > now;
}

// Cryptographic verification happens first, then this compare-and-delete makes
// a verified assertion single-use even when two identical requests arrive together.
export async function consumePasskeyChallenge(db, challengeSnapshot, credentialSnapshot, uid, update) {
  await db.runTransaction(async tx => {
    const [challenge, credential, user, deletion] = await Promise.all([
      tx.get(challengeSnapshot.ref),tx.get(credentialSnapshot.ref),tx.get(db.collection('users').doc(uid)),tx.get(db.collection('accountDeletions').doc(uid))
    ]);
    if (!challenge.exists || !challenge.updateTime.isEqual(challengeSnapshot.updateTime)
      || !credential.exists || !credential.updateTime.isEqual(credentialSnapshot.updateTime)
      || !user.exists || deletion.exists) throw new HttpsError('failed-precondition','This passkey request was already used or the account changed. Try again.');
    tx.update(credential.ref,update);
    tx.delete(challenge.ref);
  });
}
