import { chromium, webkit, devices } from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const base = process.argv[2] || 'http://127.0.0.1:4176';
for (const [name, engine, device] of [['Android',chromium,'Pixel 5'],['iPhone',webkit,'iPhone 13']]) {
  // Drop the real transport instead of Playwright's WebKit offline emulation,
  // which can reject navigation before the service worker handles it.
  let connected=true;
  const server=createServer(async(request,response)=>{
    if(!connected){response.destroy();return;}
    try {
      const upstream=await fetch(base+request.url);
      response.statusCode=upstream.status;
      for(const [key,value] of upstream.headers)if(!['content-encoding','content-length','transfer-encoding'].includes(key))response.setHeader(key,value);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    }catch{response.destroy();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({...devices[device],serviceWorkers:'allow'});
    const page = await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));

    await page.addInitScript(() => { window.__FQC_AUTH_TEST__=true; });
    await page.goto(origin+'/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    });
    const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).filter(k=>k.startsWith('fqc-app-')).map(async k=>(await (await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat());
    assert.ok(cached.includes('/offline-shell'));
    assert.ok(cached.some(path=>/\/assets\/index-.*\.js$/.test(path)));
    assert.ok(!cached.some(path=>path.includes('/api/')||path.includes('/users/')));
    connected=false;
    await page.reload();

    await page.locator('#event-planner').waitFor();
    await page.getByRole('navigation',{name:'Primary'}).waitFor();
    await page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'Profile',exact:true}).click();

    await page.getByRole('heading',{name:'Profile',exact:true,level:1}).waitFor();
    assert.ok(await page.getByRole('button',{name:'Sign in with a passkey'}).count());
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({device:name,firstInstallOfflineReload:true,privateResponsesCached:false,publicFiles:cached.length}));
    await context.close();
  } finally { await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
}
