import test from 'node:test';import assert from 'node:assert/strict';
import {getAuth} from 'firebase-admin/auth';import {getFirestore,FieldValue,Timestamp} from 'firebase-admin/firestore';
import {setMemberRole,prepareOfflineCheckIn,recordEventCheckIn,getMyEventRsvps,claimUsername,updateUserProfile} from './index.js';
import {saveMemberRsvp,consumePasskeyChallenge} from './lib/member-actions.js';
const enabled=process.env.GCLOUD_PROJECT==='demo-fqc'&&!!process.env.FIRESTORE_EMULATOR_HOST&&!!process.env.FIREBASE_AUTH_EMULATOR_HOST;
async function account(name,fields={}){const user=await getAuth().createUser({email:`${name}@ufl.edu`});await getFirestore().collection('users').doc(user.uid).set({displayName:name,createdAt:FieldValue.serverTimestamp(),...fields});return {auth:{uid:user.uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{}};}
test('only current leadership can grant access, including with forged officer claims',{skip:!enabled},async()=>{
 const officer=await account('role-a',{roleOverride:'officer'}), member=await account('role-b');
 await assert.rejects(setMemberRole.run({...officer,auth:{...officer.auth,token:{...officer.auth.token,leadership:'president',manageOfficers:true}},data:{uid:member.auth.uid,role:'officer'}}),{code:'permission-denied'});
});
test('RSVPs are private, require a real event and initialized member, and do not share one write bottleneck',{skip:!enabled},async()=>{
 const db=getFirestore();const users=await Promise.all(Array.from({length:70},(_,i)=>account(`rsvp-${i}`)));
 const validate=async id=>{if(id!=='real-event')throw Object.assign(new Error('Unknown event'),{code:'not-found'});};
 const results=await Promise.all(users.map(u=>saveMemberRsvp(db,u.auth.uid,'real-event',true,validate)));
 assert.ok(results.every(r=>Object.keys(r).sort().join(',')==='eventId,going'));
 assert.equal((await db.collection('events').doc('real-event').collection('rsvps').get()).size,70);
 await assert.rejects(saveMemberRsvp(db,users[0].auth.uid,'invented-event',true,validate),{code:'not-found'});
 await assert.rejects(saveMemberRsvp(db,'no-profile','real-event',true,validate),{code:'permission-denied'});
 assert.deepEqual(await getMyEventRsvps.run(users[0]),{eventIds:['real-event']});
 await saveMemberRsvp(db,users[0].auth.uid,'real-event',false,validate);
 assert.deepEqual(await getMyEventRsvps.run(users[0]),{eventIds:[]});
});
test('offline permission is owner/event-bound, expires, and check-in retries stay idempotent after closing',{skip:!enabled},async()=>{
 const db=getFirestore();const user=await account('offline-member'),other=await account('offline-other');
 const setting=db.collection('settings').doc('checkin');await setting.set({open:true,eventId:'offline-event',requireLocation:false});
 const permit=await prepareOfflineCheckIn.run({...user,data:{eventId:'offline-event'}});
 await setting.set({open:false,eventId:'offline-event',requireLocation:false});
 await assert.rejects(recordEventCheckIn.run({...other,data:{eventId:'offline-event',permitId:permit.permitId}}),{code:'failed-precondition'});
 await assert.rejects(recordEventCheckIn.run({...user,data:{eventId:'different-event',permitId:permit.permitId}}),{code:'failed-precondition'});
 const req={...user,data:{eventId:'offline-event',permitId:permit.permitId}};
 assert.equal((await recordEventCheckIn.run(req)).awarded,true);
 assert.equal((await recordEventCheckIn.run(req)).awarded,false);
 assert.equal((await db.collection('events').doc('offline-event').collection('checkins').get()).size,1);
 await db.collection('offlineCheckInPermits').doc(`${other.auth.uid}_offline-event`).set({uid:other.auth.uid,eventId:'offline-event',requireLocation:false,expiresAt:Timestamp.fromMillis(Date.now()-1000)});
 await assert.rejects(recordEventCheckIn.run({...other,data:{eventId:'offline-event',permitId:`${other.auth.uid}_offline-event`}}),/expired/);
});
test('a verified passkey challenge can be consumed exactly once under simultaneous replay',{skip:!enabled},async()=>{
 const db=getFirestore(),user=await account('passkey-replay');const challenge=db.collection('passkeyChallenges').doc('replay-challenge'),credential=db.collection('passkeyCredentials').doc('replay-key');
 await challenge.set({challenge:'verified'});await credential.set({uid:user.auth.uid,counter:0});const [c,k]=await Promise.all([challenge.get(),credential.get()]);
 const results=await Promise.allSettled(Array.from({length:5},()=>consumePasskeyChallenge(db,c,k,user.auth.uid,{counter:1})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});


test('a profile or username write cannot race past account removal', {skip:!enabled}, async () => {
  const db=getFirestore();
  for (const [name,handler,data] of [['deleteusername',claimUsername,{username:'deleteusername'}],['deletename',updateUserProfile,{displayName:'Pending deletion name'}]]) {
    const request=await account(name);
    const original=db.runTransaction;
    db.runTransaction=async function (...args) {
      await db.collection('accountDeletions').doc(request.auth.uid).set({startedAt:FieldValue.serverTimestamp()});
      return original.apply(this,args);
    };
    try { await assert.rejects(handler.run({...request,data}),{code:'failed-precondition'}); }
    finally {db.runTransaction=original;}
    assert.equal((await db.collection('users').doc(request.auth.uid).get()).data().displayName,name);
    assert.equal((await db.collection('usernameDirectory').doc(name).get()).exists,false);
  }
});
