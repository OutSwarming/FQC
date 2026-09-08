import test from 'node:test';
import assert from 'node:assert/strict';
import { publicScheduleCsv, sessionIsRevoked, enforceRateLimit, requestNetwork } from './lib/security.js';

test('public schedule excludes private columns and unpublished events', () => {
  const csv = publicScheduleCsv([
    ['Event Name','Published','Event Description','Officer Notes','Budget','Member Email'],
    ['Workshop','yes','A "quantum", workshop','private-note','123','secret@ufl.edu'],
    ['Not announced','no','secret-event','','','']
  ], 'events');
  assert.equal(csv, '"Event Name","Published","Event Description"\n"Workshop","yes","A ""quantum"", workshop"');
  assert.equal(publicScheduleCsv([['Location','Lat','Long','Contact'],['UF',1,2,'private']], 'locations'), '"Location","Lat","Long"\n"UF","1","2"');
});

test('revoked sessions fail while sessions authenticated after revocation pass', () => {
  const user = { tokensValidAfterTime: new Date(100000).toISOString() };
  assert.equal(sessionIsRevoked(user, { auth_time: 99 }), true);
  assert.equal(sessionIsRevoked(user, { auth_time: 100 }), false);
  assert.equal(sessionIsRevoked(user, {}), true);
});

test('request limits enforce per-identifier bounds and only store hashes with expiry', async () => {
  const docs = new Map();
  const db = {
    collection: () => ({doc: key => ({key})}),
    batch: () => ({set: (ref,value) => docs.set(ref.key,{count:(docs.get(ref.key)?.count || 0)+1,expiresAt:value.expiresAt}),commit:async()=>{}}),
    getAll: async (...refs) => refs.map(ref=>({data:()=>docs.get(ref.key)}))
  };
  const request = { rawRequest: {ip:'192.0.2.1'}, data:{identifier:'private-user'} };
  for(let i=0;i<30;i++) await enforceRateLimit(db,'signInWithUsername',request,100000);
  await assert.rejects(enforceRateLimit(db,'signInWithUsername',request,100000), {code:'resource-exhausted'});
  for(const [key,value] of docs) {
    assert.match(key,/^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(value).sort(),['count','expiresAt']);
    assert.equal(value.expiresAt.toMillis(),1200000);
  }
  await enforceRateLimit(db,'signInWithUsername',request,700000);
});

test('spoofed forwarded client addresses cannot rotate the network limit', () => {
  for (const spoof of ['192.0.2.9','198.51.100.8']) {
    assert.equal(requestNetwork({rawRequest:{ip:spoof,headers:{'x-forwarded-for':`${spoof}, 203.0.113.5`}}}), '203.0.113.5');
  }
});
