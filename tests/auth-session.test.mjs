import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionRestorer } from '../auth-session.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
function setup(loadProfile, timeoutMs=1000) {
  const data={user:{uid:'old'},sessions:[],errors:[],signouts:0};
  data.restore=createSessionRestorer({getCurrentUser:()=>data.user,loadProfile,refreshToken:async()=>{},signOut:async()=>{data.signouts++;data.user=null;},onSession:s=>data.sessions.push(s),onError:e=>data.errors.push(e),timeoutMs});
  return data;
}
test('deleted account clears its saved session and accepts a new uid with the same email',async()=>{
 const s=setup(async user=>{if(user.uid==='old')throw {code:'functions/unauthenticated'};return {role:'member',email:'same@ufl.edu'};});
 await assert.rejects(s.restore(s.user));assert.equal(s.signouts,1);assert.equal(s.sessions.at(-1),null);
 s.user={uid:'new'};await s.restore(s.user);assert.equal(s.sessions.at(-1).user.uid,'new');assert.equal(s.errors.length,1);
});
test('an old failed request cannot sign out a newly logged-in president',async()=>{
 const old=deferred();const s=setup(user=>user.uid==='old'?old.promise:Promise.resolve({role:'officer',leadership:'president'}));
 const first=s.restore(s.user);s.user={uid:'new'};await s.restore(s.user);old.reject({code:'functions/unauthenticated'});await first;
 assert.equal(s.signouts,0);assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].profile.leadership,'president');
});
test('form and observer share one setup request and a failed setup can retry',async()=>{
 const pending=deferred();let calls=0;const s=setup(()=>{calls++;return calls===1?pending.promise:Promise.resolve({role:'member'});});
 const one=s.restore(s.user);const two=s.restore(s.user);assert.equal(one,two);
 pending.reject({code:'functions/unavailable'});await assert.rejects(one);await assert.rejects(two);
 assert.equal(s.signouts,0);await s.restore(s.user);assert.equal(calls,2);assert.equal(s.sessions.length,1);
});
test('a hanging setup ends with a retryable error and its late result is ignored',async()=>{
 const pending=deferred();const s=setup(()=>pending.promise,15);
 await assert.rejects(s.restore(s.user),{code:'auth/setup-timeout'});assert.equal(s.errors.length,1);assert.equal(s.signouts,0);
 pending.resolve({role:'member'});await new Promise(resolve=>setTimeout(resolve,5));assert.equal(s.sessions.length,0);
});
test('signing out while setup runs cannot resurrect a session',async()=>{
 const pending=deferred();const s=setup(()=>pending.promise);const first=s.restore(s.user);s.user=null;await s.restore(null);
 pending.resolve({role:'member'});await first;assert.deepEqual(s.sessions,[null]);
});
