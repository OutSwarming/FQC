import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
function setup(response = new Response('public asset')) {
  const handlers = {}, writes = [], calls = [];
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://flqcs.com' }, addEventListener: (type, handler) => { handlers[type] = handler; } },
    URL,
    caches: { open: async () => ({ put: (request) => writes.push(request.url) }), match: async () => undefined },
    fetch: async (request, options) => { calls.push({ request, options }); return response; }
  });
  return {
    writes, calls,
    async request(path, mode = 'cors') {
      let responsePromise;
      handlers.fetch({ request: { url: new URL(path, 'https://flqcs.com').href, method: 'GET', mode }, respondWith: promise => { responsePromise = promise; } });
      await responsePromise;
      await Promise.resolve();
      return responsePromise !== undefined;
    }
  };
}

test('only public assets are cached; account URLs and cross-origin requests are untouched', async () => {
  const sw = setup();
  assert.equal(await sw.request('/assets/app.js'), true);
  assert.equal(await sw.request('/api/account'), false);
  assert.equal(await sw.request('https://identitytoolkit.googleapis.com/account'), false);
  assert.deepEqual(sw.writes, ['https://flqcs.com/assets/app.js']);
});

test('navigation is network-only with no-store', async () => {
  const sw = setup();
  await sw.request('/#profile', 'navigate');
  assert.equal(sw.calls[0].options.cache, 'no-store');
  assert.deepEqual(sw.writes, []);
});

test('private and no-store responses are never added to offline storage', async () => {
  for (const value of ['private, max-age=3600', 'no-store']) {
    const sw = setup(new Response('protected', { headers: { 'Cache-Control': value } }));
    await sw.request('/assets/protected.json');
    assert.deepEqual(sw.writes, []);
  }
});
