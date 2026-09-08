import test from 'node:test';import assert from 'node:assert/strict';
import {createMemberOutbox} from '../member-outbox.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('offline tap survives reload and retries once online without changing its event',async()=>{
 const storage=memory();let online=false;const sent=[];const options={storage,getUid:()=> 'member-a',isOnline:()=>online,send:async e=>{sent.push(e);return {eventId:e.eventId};}};
 const first=createMemberOutbox(options);first.enqueue('checkin','event-a',{permitId:'a_event-a'});await first.flush();assert.equal(sent.length,0);
 const reloaded=createMemberOutbox(options);assert.equal(reloaded.entries().length,1);online=true;await reloaded.flush();assert.equal(sent[0].eventId,'event-a');assert.equal(reloaded.entries().length,0);
});
test('another account cannot send or see the pending intent',async()=>{
 const storage=memory();let uid='a';const sent=[];const q=createMemberOutbox({storage,getUid:()=>uid,isOnline:()=>true,send:async e=>sent.push(e)});
 q.enqueue('rsvp','event-a',{going:true});uid='b';assert.equal(q.entries().length,0);await q.flush();assert.equal(sent.length,0);uid='a';await q.flush();assert.equal(sent.length,1);
});
test('latest RSVP wins and a lost acknowledgement cannot erase a newer intent',async()=>{
 const storage=memory();let finish;const events=[];let first=true;
 const q=createMemberOutbox({storage,getUid:()=> 'a',isOnline:()=>true,send:async e=>{events.push(e.going);if(first){first=false;await new Promise(r=>finish=r);}return {};}});
 q.enqueue('rsvp','event-a',{going:true});const flushing=q.flush();await new Promise(r=>setTimeout(r,0));q.enqueue('rsvp','event-a',{going:false});finish();await flushing;assert.equal(q.entries()[0].going,false);await q.flush();assert.deepEqual(events,[true,false]);assert.equal(q.entries().length,0);
});
test('network errors remain pending; permanent check-in rejection stays visible',async()=>{
 const storage=memory();let code='functions/unavailable';const q=createMemberOutbox({storage,getUid:()=> 'a',isOnline:()=>true,send:async()=>{throw Object.assign(new Error('Offline window expired'),{code});}});
 q.enqueue('checkin','event-a');await q.flush();assert.equal(q.entries()[0].status,'pending');code='functions/failed-precondition';await q.flush({force:true});assert.equal(q.entries()[0].status,'attention');
});
test('storage failure never reports a saved action',()=>{
 const q=createMemberOutbox({storage:{getItem:()=>null,setItem:()=>{throw new Error('quota');}},getUid:()=> 'a',send:async()=>{}});
 assert.throws(()=>q.enqueue('checkin','event-a'),/could not save/);
});
