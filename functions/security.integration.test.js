import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { signInWithUsername, resolveLoginIdentifier, requestAccountPasswordReset, getOfficerResources, ensureUserProfile } from './index.js';
const enabled = process.env.GCLOUD_PROJECT === 'demo-fqc' && Boolean(process.env.FIRESTORE_EMULATOR_HOST) && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

test('username sign-in never discloses the email and requires the correct password', {skip:!enabled}, async () => {
  const auth=getAuth(), db=getFirestore();
  const user=await auth.createUser({email:'security.login@ufl.edu',password:'correct-password-123'});
  await db.collection('usernameDirectory').doc('security.login').set({uid:user.uid});
  const request=(identifier,password) => ({rawRequest:{ip:'192.0.2.55'}, data:{identifier,password}});
  const valid=await signInWithUsername.run(request('security.login','correct-password-123'));
  assert.deepEqual(Object.keys(valid),['customToken']);
  assert.ok(valid.customToken);
  for(const [name,password] of [['security.login','wrong-password'],['unknown.name','correct-password-123']]) {
    await assert.rejects(signInWithUsername.run(request(name,password)), {code:'unauthenticated',message:'The username or password is incorrect.'});
    await assert.rejects(resolveLoginIdentifier.run({data:{identifier:name}}), {code:'failed-precondition'});
    assert.deepEqual(await requestAccountPasswordReset.run({data:{identifier:name}}), {sent:true});
  }
  await auth.deleteUser(user.uid);
  await assert.rejects(signInWithUsername.run(request('security.login','correct-password-123')), {code:'unauthenticated'});
});

test('demoted, revoked and deleted officer sessions cannot reuse stale claims', {skip:!enabled}, async () => {
  const auth=getAuth(), db=getFirestore();
  const user=await auth.createUser({email:'security-officer@ufl.edu'});
  const ref=db.collection('users').doc(user.uid);
  const req={auth:{uid:user.uid,token:{auth_time:Math.floor(Date.now()/1000),role:'officer',leadership:'president',manageOfficers:true}},data:{}};
  await ref.set({roleOverride:'officer'});
  assert.ok(await getOfficerResources.run(req));
  await ref.set({role:'member'});
  await assert.rejects(getOfficerResources.run(req),{code:'permission-denied'});
  await ref.set({roleOverride:'officer'});
  await auth.revokeRefreshTokens(user.uid);
  await assert.rejects(getOfficerResources.run({...req,auth:{...req.auth,token:{...req.auth.token,auth_time:1}}}),{code:'unauthenticated'});
  await auth.deleteUser(user.uid);
  await assert.rejects(getOfficerResources.run(req),{code:'unauthenticated'});
  await assert.rejects(ensureUserProfile.run(req),{code:'unauthenticated'});
});
