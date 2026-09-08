export function isInvalidSessionError(error) {
  return ['auth/user-not-found', 'auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token', 'functions/unauthenticated']
    .includes(String(error?.code || ''));
}

export async function withAuthTimeout(action, timeoutMs = 20000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Sign-in took too long. Please try again.'), { code: 'auth/setup-timeout' })), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// One profile restoration per user, shared by the Auth observer and the form.
// A late result from a deleted/previous account cannot replace the new session.
export function createSessionRestorer({ getCurrentUser, loadProfile, refreshToken, signOut, onSession, onError, timeoutMs = 20000 }) {
  let generation = 0;
  let job = null;
  return function restore(user) {
    if (!user) {
      generation++;
      job = null;
      onSession(null);
      return Promise.resolve(null);
    }
    if (job?.user === user) return job.promise;
    const run = ++generation;
    const current = { user };
    job = current;
    const active = () => generation === run && getCurrentUser()?.uid === user.uid;
    current.promise = (async () => {
      try {
        const profile = await withAuthTimeout(async () => {
          const profile = await loadProfile(user);
          if (active()) await refreshToken(user);
          return profile;
        }, timeoutMs);
        if (!active()) return null;
        onSession({ user, profile });
        return profile;
      } catch (error) {
        if (!active()) return null;
        if (isInvalidSessionError(error)) {
          await signOut();
          if (!getCurrentUser()) { onSession(null); onError(error); }
        } else onError(error);
        throw error;
      } finally {
        if (job === current) job = null;
      }
    })();
    return current.promise;
  };
}
