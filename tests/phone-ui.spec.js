import { test, expect } from '@playwright/test';
const nav = (page, name) => page.locator('.bottom-nav').getByRole('button', { name, exact: true, includeHidden: true });
const goTab = async (page, name) => {
  if (!await nav(page, name).isVisible() && await page.locator('.event-planner').count()) {
    const point = await mapPoint(page);
    await page.touchscreen.tap(point.x, point.y);
  }
  await nav(page, name).click();
};
const zoom = page => page.evaluate(() => window.__FQC_MAP__.getZoom());
const mapPoint = async page => {
  const box = await page.locator('#event-map').boundingBox();
  const sheet = await page.locator('.event-planner').boundingBox();
  return { x: box.x + box.width * .3, y: box.y + Math.min(85, Math.max(2, (sheet.y - box.y) / 2)) };
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__FQC_AUTH_TEST__ = true; });
  await page.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
  await page.route('https://docs.google.com/spreadsheets/**', route => {
    const sheet = new URL(route.request().url()).searchParams.get('sheet');
    const body = sheet === 'UF Locations' ? '"Location","Address","Lat","Long"\n"Reitz Student Union","655 Reitz Union Drive, Gainesville, FL 32611","29.64631","-82.34788"' : sheet === 'Events' ? '"Event Name","Event Date","Start Time","Location","Room","Event Description","Published","Event ID"\n"Quantum Workshop","2027-03-24","6:00 PM","Reitz Student Union","2340","Build quantum circuits together.","Yes","phone-workshop"' : '"Budget Summary","Amount"\n"Total Approved","100"';
    return route.fulfill({ status: 200, contentType: 'text/csv', body });
  });
  await page.goto('/hackathon');
  await expect(page.locator('.app-splash')).toBeHidden();
});

test('clear controls, round navigation, all screens and appearance choices fit', async ({ page }, info) => {
  await expect(page.locator('.topbar-actions button:visible')).toHaveCount(1);
  await expect(page.locator('.bottom-nav .nav-item')).toHaveText(['Hackathon', 'Home', 'Check In', 'Profile']);
  const geometry = await page.locator('.bottom-nav').evaluate(el => {
    const b = el.getBoundingClientRect(); return { width: b.width, height: b.height, radius: parseFloat(getComputedStyle(el).borderRadius), right: b.right };
  });
  expect(geometry.radius).toBeGreaterThanOrEqual(geometry.height / 2);
  expect(geometry.right).toBeLessThanOrEqual(page.viewportSize().width);
  await expect(page.locator('.hack-hero h2')).toHaveCSS('color', 'rgb(245, 245, 247)');
  await page.screenshot({ animations: "disabled", path: `test-results/${info.project.name}-landing.png` });
  for (const name of ['Home', 'Check In', 'Profile', 'Hackathon']) {
    await goTab(page, name);
    await expect(nav(page, name)).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Open settings' }).click();
  for (const appearance of ['Dark', 'Light', 'System']) await page.getByRole('radio', { name: appearance, exact: true }).check();
  await page.screenshot({ animations: "disabled", path: `test-results/${info.project.name}-settings.png` });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(nav(page, 'Hackathon')).toHaveAttribute('aria-current', 'page');
  await goTab(page, 'Profile');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `test-results/${info.project.name}-profile.png` });
});

test('workshop story stays readable and interactive with expanded layers on phones', async ({ page }, info) => {
  const stats = await page.locator('.hackathon-landing').evaluate(el => ({
    viewport: { width: innerWidth, height: innerHeight },
    pageScreens: +(el.scrollHeight / innerHeight).toFixed(1),
    interestScreensDown: +(document.querySelector('#hackathon-interest').getBoundingClientRect().top / innerHeight).toFixed(1),
    captionPx: getComputedStyle(document.querySelector('.phase-experiment > small')).fontSize,
    mainCopyPx: getComputedStyle(document.querySelector('.workshop-copy > p:not(.hack-kicker)')).fontSize,
  }));
  console.log(info.project.name, JSON.stringify(stats));
  const originalSize = page.viewportSize();
  const compactDetails = page.locator('.workshop-phase > .workshop-depth');
  await expect(compactDetails).toHaveCount(originalSize.width <= 680 ? 2 : 0);
  await page.setViewportSize({ width: 750, height: 342 });
  await expect(compactDetails).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 664 });
  await expect(compactDetails).toHaveCount(2);
  await page.setViewportSize(originalSize);
  for (const photo of await page.locator('.hackathon-landing img').all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `test-results/audit-${info.project.name}-hero.png` });
  const phase = page.locator('[data-apply-h]');
  await phase.tap();
  await expect(page.locator('[data-phase-state="minus"]')).toHaveText('|1⟩');
  await expect(page.locator('[data-phase-state="plus"]')).toHaveText('|0⟩');
  await page.locator('.phase-experiment').screenshot({ path: `test-results/audit-${info.project.name}-phase.png` });
  for (const detail of await page.locator('.workshop-depth').all()) {
    await detail.locator('summary').tap();
    await expect(detail).toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const rounds = page.getByRole('slider', { name: 'Try a different number of rounds' });
  await rounds.focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#grover-probability')).toHaveText('0.024%');
  await page.keyboard.press('End');
  await expect(page.locator('#grover-probability')).toHaveText('<0.001%');
  await page.locator('.grover-experiment').screenshot({ path: `test-results/audit-${info.project.name}-grover.png` });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.locator('.phase-probabilities b').first().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(.001);
  await page.locator('.phase-experiment').screenshot({ path: `test-results/audit-${info.project.name}-dark.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('appearance follows the device and explicit preference survives reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: 'System', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce', contrast: 'more' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.locator('.nav-glass-lens').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(.001);
});

test('app gestures keep every screen at normal size and form focus does not zoom', async ({ page }) => {
  for (const name of ['Hackathon', 'Home', 'Check In', 'Profile']) {
    await goTab(page, name);
    const result = await page.evaluate(() => {
      const cancellations = ['gesturestart', 'gesturechange', 'gestureend'].map(name => {
        const event = new Event(name, { bubbles: true, cancelable: true });
        document.querySelector('#app').dispatchEvent(event);
        return event.defaultPrevented;
      });
      return { cancellations, scale: visualViewport.scale };
    });
    expect(result.cancellations).toEqual([true, true, true]);
    expect(result.scale).toBeCloseTo(1, 3);
  }
  const email = page.locator('#auth-identifier');
  await email.tap();
  expect(await email.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => visualViewport.scale)).toBeCloseTo(1, 3);
  await page.getByRole('button', { name: 'Open settings' }).click();
  expect(await page.evaluate(() => {
    const event = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true });
    document.querySelector('#app').dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
});

test('page pinch and double tap leave app scale fixed while one-finger scrolling works', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Raw multi-touch input uses Chromium device input.');
  const cdp = await page.context().newCDPSession(page);
  const center = { x: page.viewportSize().width / 2, y: 290 };
  const pinch = (type, distance) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: center.x-distance, y: center.y, id: 1 }, { x: center.x+distance, y: center.y, id: 2 }] });
  await pinch('touchStart', 20);
  for (let d = 30; d <= 120; d += 10) await pinch('touchMove', d);
  await pinch('touchEnd');
  await page.touchscreen.tap(center.x, center.y);
  await page.touchscreen.tap(center.x, center.y);
  expect(await page.evaluate(() => visualViewport.scale)).toBeCloseTo(1, 3);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center.x, y: 550, id: 1 }] });
  for (let y = 530; y >= 250; y -= 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
  expect(await page.evaluate(() => visualViewport.scale)).toBeCloseTo(1, 3);
});

test('double tap zooms once and zoom buttons work without losing pin details', async ({ page }) => {
  await goTab(page, 'Home');
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => window.__FQC_MAP__.setZoom(15, { animate: false }));
  const center = await page.evaluate(() => { const c = window.__FQC_MAP__.getCenter(); return { lat: c.lat, lng: c.lng }; });
  const p = await mapPoint(page);
  await page.touchscreen.tap(p.x, p.y);
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(() => zoom(page)).toBe(16);
  // Leaflet rounds projected centers to pixels; odd map heights can differ
  // by half a pixel. Measure visible drift rather than a fixed meter cutoff.
  expect(await page.evaluate(center => {
    const map = window.__FQC_MAP__;
    return map.latLngToContainerPoint(center).distanceTo(map.getSize().divideBy(2));
  }, center)).toBeLessThanOrEqual(1);
  await page.waitForTimeout(550);
  await expect.poll(() => zoom(page)).toBe(16);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => zoom(page)).toBe(15);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoom(page)).toBe(16);
  await page.locator('.event-map-pin').first().click();
  await expect(page.locator('.event-intro h2')).toContainText('Quantum Workshop');
});

test('mouse double click zooms in and shift double click zooms out', async ({ page }) => {
  await goTab(page, 'Home');
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => window.__FQC_MAP__.setZoom(15, { animate: false }));
  const p = await mapPoint(page);
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(() => zoom(page)).toBe(16);
  await page.keyboard.down('Shift');
  await page.mouse.dblclick(p.x, p.y);
  await page.keyboard.up('Shift');
  await expect.poll(() => zoom(page)).toBe(15);
});

test('one-finger double-tap drag zooms both ways and cancellation restores panning', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Raw touch sequences use Chromium device input; native double taps are tested in WebKit above.');
  await goTab(page, 'Home');
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => window.__FQC_MAP__.setZoom(16, { animate: false }));
  const p = await mapPoint(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x,y]) => ({ x,y,id:1 })) });
  for (const dy of [100, -100]) {
    const before = await zoom(page);
    await touch('touchStart', [[p.x,p.y]]); await touch('touchEnd', []);
    await touch('touchStart', [[p.x,p.y]]);
    for (let i=1;i<=10;i++) await touch('touchMove', [[p.x,p.y+dy*i/10]]);
    await touch('touchEnd', []);
    await expect.poll(() => zoom(page)).toBeCloseTo(before+dy/100, 5);
    await page.waitForTimeout(550);
  }
  await touch('touchStart', [[p.x,p.y]]); await touch('touchEnd', []);
  await touch('touchStart', [[p.x,p.y]]); await touch('touchCancel', []);
  expect(await page.evaluate(() => window.__FQC_MAP__.dragging.enabled())).toBe(true);
});

test('pinch zoom remains available', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Pinch injected through Chromium device input.');
  await goTab(page, 'Home');
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => window.__FQC_MAP__.setZoom(15, { animate: false }));
  const p = await mapPoint(page);
  const cdp = await page.context().newCDPSession(page);
  const pinch = (type, distance) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type==='touchEnd' ? [] : [{ x:p.x-distance,y:p.y,id:1 }, { x:p.x+distance,y:p.y,id:2 }] });
  await pinch('touchStart',20);
  for(let d=25;d<=65;d+=5) await pinch('touchMove',d);
  await pinch('touchEnd',0);
  await expect.poll(() => zoom(page)).toBeGreaterThan(15);
});

test('rapid reversing pinches keep loaded map tiles visible through release and cancellation', async ({ page, browserName }) => {
  await page.route('https://*.tile.openstreetmap.org/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 120));
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
  });
  await goTab(page, 'Home');
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => window.__FQC_MAP__.setZoom(16, { animate: false }));
  await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  await page.waitForTimeout(220); // Let the initial tiles become fully opaque.
  await page.evaluate(() => {
    window.__pinchFrames = { resets: 0, blank: 0, frames: 0, running: true, values: [] };
    window.__FQC_MAP__.on('viewprereset', () => window.__pinchFrames.resets++);
    const sample = () => {
      const state = window.__pinchFrames;
      state.frames++;
      if (![...document.querySelectorAll('.leaflet-tile-loaded')].some(tile => parseFloat(getComputedStyle(tile).opacity) > .1)) state.blank++;
      if (state.running) requestAnimationFrame(sample);
    };
    sample();
  });
  const p = await mapPoint(page);
  const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
  const pinch = (type, distance = 0) => {
    const points = ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x: p.x-distance, y: p.y, id: 1 }, { x: p.x+distance, y: p.y, id: 2 }];
    if (cdp) return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    // WebKit has no raw device-input API. Exercise its DOM touch event path.
    return page.evaluate(({ type, points }) => {
      const container = document.querySelector('#event-map');
      const event = new Event(type.toLowerCase(), { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: points.map(p => ({ identifier: p.id, clientX: p.x, clientY: p.y, target: container })) });
      container.dispatchEvent(event);
    }, { type, points });
  };
  for (const end of ['touchEnd', 'touchCancel', 'touchEnd']) {
    await pinch('touchStart', 35);
    for (const distance of [42, 60, 80, 55, 35, 22, 40]) {
      await pinch('touchMove', distance);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => { window.__pinchFrames.values.push(window.__FQC_MAP__.getZoom()); resolve(); })));
    }
    await pinch(end);
    await page.waitForTimeout(45);
  }
  const frames = await page.evaluate(() => { window.__pinchFrames.running = false; return window.__pinchFrames; });
  expect(frames.frames).toBeGreaterThan(15);
  expect(Math.max(...frames.values) - Math.min(...frames.values)).toBeGreaterThan(1);
  expect(frames.resets).toBe(0);
  expect(frames.blank).toBe(0);
  expect(await page.evaluate(() => window.__FQC_MAP__.dragging.enabled())).toBe(true);
  expect(await page.evaluate(() => visualViewport.scale)).toBeCloseTo(1, 3);
});


test('single-form signup survives live updates and fits the phone', async ({ page }, info) => {
  await goTab(page, 'Profile');
  await page.locator('#auth-mode-create').click();
  const dialog = page.getByRole('dialog', { name: 'Create your FQC account' });
  await dialog.getByLabel('UF email', { exact: true }).fill('q@ufl.edu');
  await dialog.locator('#signup-password').fill('quantum-safe-password');
  await dialog.locator('#signup-password-confirm').fill('quantum-safe-password');
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.setCheckIn({ eventId: 'phone-workshop', open: true, requireLocation: false }));
  await expect(dialog.locator('#signup-password')).toHaveValue('quantum-safe-password');
  await expect(dialog.getByLabel('UF email', { exact: true })).toHaveValue('q@ufl.edu');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ animations: 'disabled', path: `test-results/${info.project.name}-signup.png` });
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'q', exact: true })).toBeVisible();
});


test('navigation keeps the same bottom inset after scrolling, tab changes, and viewport resizing', async ({ page }) => {
  const size = page.viewportSize();
  // Include a home-indicator inset even when the emulator reports zero.
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-bottom', '34px'));
  for (const height of [size.height, Math.max(300, size.height - 100), size.height]) {
    await page.setViewportSize({ width: size.width, height });
    await goTab(page, 'Hackathon');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    for (const name of ['Profile', 'Home', 'Check In', 'Home', 'Hackathon']) {
      await goTab(page, name);
      await expect(nav(page, name)).toHaveAttribute('aria-current', 'page');
      const position = await page.locator('.bottom-nav').evaluate(element => {
        const box = element.getBoundingClientRect();
        return { gap: innerHeight - box.bottom, center: box.left + box.width / 2, height: box.height, fixedBody: getComputedStyle(document.body).position === 'fixed' };
      });
      expect(position.gap).toBeCloseTo(46, 0);
      expect(position.center).toBeCloseTo(size.width / 2, 0);
      expect(position.height).toBeCloseTo(76, 0);
      expect(position.fixedBody).toBe(false);
    }
  }
});


test.describe('event popup with a deterministic long list', () => {
test.use({ serviceWorkers: 'block' });
test('original event popup covers the dock, resizes, and keeps the last event tappable', async ({ page }, info) => {
  const header = '"Event Name","Event Date","Start Time","Location","Room","Event Description","Published","Event ID"';
  const rows = Array.from({ length: 16 }, (_, i) => `"Archived quantum workshop ${i + 1}","2020-03-${String(i + 1).padStart(2, '0')}","6:00 PM","Reitz Student Union","2315","A hands-on quantum computing workshop with circuits, discussion and exercises for members working together.","Yes","archive-${i + 1}"`);
  await page.route('https://docs.google.com/spreadsheets/**', route => new URL(route.request().url()).searchParams.get('sheet') === 'Events'
    ? route.fulfill({ status: 200, contentType: 'text/csv', body: [header, ...rows].join('\n') })
    : route.fallback());
  await page.reload();
  await goTab(page, 'Home');
  const planner = page.locator('.event-planner');
  await page.locator('#event-sheet-handle').tap();
  await page.getByRole('tab', { name: /^Past/ }).tap();
  await expect(page.locator('.past-event-list .event-card-select')).toHaveCount(16);
  const original = page.viewportSize();
  // Simulate the home-indicator inset and the larger status area in an installed iPhone app.
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-bottom', '34px'));
  if (original.width < original.height) await page.addStyleTag({ content: '.topbar { padding-top: 55px; }' });
  for (const height of [original.height, Math.max(300, original.height - 100), original.height, Math.max(300, original.height - 60)]) {
    await page.setViewportSize({ width: original.width, height });
    await expect.poll(() => planner.evaluate(el => {
      return Math.round(innerHeight - el.getBoundingClientRect().bottom);
    })).toBe(0);
    await expect(page.locator('.bottom-nav')).toBeHidden();
    await expect.poll(() => planner.evaluate(el => {
      const map = document.querySelector('#event-map').getBoundingClientRect();
      return el.getBoundingClientRect().top >= map.top;
    })).toBe(true);
    await expect(planner).toHaveCSS('border-bottom-left-radius', '0px');
    await expect(planner).toHaveCSS('border-bottom-right-radius', '0px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  }
  await page.setViewportSize(original);
  await page.waitForTimeout(450);
  await planner.evaluate(el => { el.scrollTop = 0; });
  // Drive the same touch-pointer path as swiping the expanded sheet.
  for (let swipe = 0; swipe < 24; swipe++) {
    const done = await planner.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    if (done) break;
    const box = await planner.boundingBox();
    const input = { button: 0, pointerId: 61, pointerType: 'touch', clientX: box.x + 20, clientY: box.y + box.height - 12 };
    await planner.dispatchEvent('pointerdown', input);
    await planner.dispatchEvent('pointermove', { ...input, clientY: box.y + 30 });
    await planner.dispatchEvent('pointerup', { ...input, clientY: box.y + 30 });
  }
  await expect.poll(() => planner.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(2);
  const last = page.locator('.past-event-list .event-card-select').last();
  expect(await last.evaluate(el => {
    const box = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  await page.waitForTimeout(300); // Let the swipe's accidental-click guard expire.
  await last.tap();
  await expect(page.locator('.event-intro h2')).toHaveText('Archived quantum workshop 1');
  await page.screenshot({ path: `test-results/${info.project.name}-original-popup.png` });
});
});

test('Home opens medium with navigation, swipes smaller and larger, and hides the dock only when large', async ({ page }) => {
  const original = page.viewportSize();
  const planner = page.locator('.event-planner');
  const handle = page.locator('#event-sheet-handle');
  const swipe = async direction => {
    await page.waitForTimeout(450);
    const box = await handle.boundingBox();
    const input = { button: 0, pointerId: 77, pointerType: 'touch', clientY: box.y + 12 };
    await handle.dispatchEvent('pointerdown', input);
    await handle.dispatchEvent('pointermove', { ...input, clientY: input.clientY + direction * 300 });
    await handle.dispatchEvent('pointerup', { ...input, clientY: input.clientY + direction * 300 });
  };
  for (const safe of [0, 34]) {
    await goTab(page, 'Profile');
    await page.evaluate(value => document.documentElement.style.setProperty('--safe-bottom', `${value}px`), safe);
    await goTab(page, 'Home');
    await expect(planner).toHaveAttribute('data-sheet-mode', 'medium');
    for (const height of [original.height, Math.max(300, original.height - 90)]) {
      await page.setViewportSize({ width: original.width, height });
      await expect.poll(() => page.locator('#event-map').evaluate(el => Math.abs(el.getBoundingClientRect().bottom - innerHeight))).toBeLessThan(1);
      await expect(page.locator('.bottom-nav')).toBeVisible();
      await expect.poll(() => planner.evaluate(el => Math.round(innerHeight - el.getBoundingClientRect().bottom))).toBe(0);
      expect(await planner.evaluate(el => {
        const map = document.querySelector('#event-map').getBoundingClientRect();
        // Both corners outside the capsule and the bottom safe area must hit the sheet.
        return [map.left + 4, map.right - 4].every(x =>
          [innerHeight - 2, document.querySelector('.bottom-nav').getBoundingClientRect().top - 2].every(y => el.contains(document.elementFromPoint(x, y))));
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    }
    await page.setViewportSize(original);
    await swipe(1);
    await expect(planner).toHaveAttribute('data-sheet-mode', 'low');
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(page.locator('.event-mode-panel[data-event-panel="list"]')).toHaveCSS('display', 'block');
    await expect.poll(() => page.locator('.event-explorer').evaluate(el => getComputedStyle(el, '::after').opacity)).toBe('1');
    await swipe(-1);
    if (await planner.getAttribute('data-sheet-mode') === 'medium') await swipe(-1);
    await expect(planner).toHaveAttribute('data-sheet-mode', 'high');
    await expect(page.locator('.bottom-nav')).toBeHidden();
    await expect.poll(() => planner.evaluate(el => Math.round(innerHeight - el.getBoundingClientRect().bottom))).toBe(0);
    await page.waitForTimeout(300);
    await handle.tap();
    await expect(planner).toHaveAttribute('data-sheet-mode', 'medium');
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect.poll(() => planner.evaluate(el => Math.round(innerHeight - el.getBoundingClientRect().bottom))).toBe(0);
    const point = await mapPoint(page);
    await page.touchscreen.tap(point.x, point.y);
    await expect(planner).toHaveAttribute('data-sheet-mode', 'closed');
    await page.locator('.event-map-pin').first().tap();
    await expect(planner).toHaveAttribute('data-sheet-mode', 'low');
    await expect(page.locator('.bottom-nav')).toBeVisible();
  }
});

test('pin highlight clears on tap-away and stays cleared through live refresh', async ({ page }) => {
  await goTab(page, 'Home');
  // Close the event sheet to expose the center pin on shorter phones.
  const background = await mapPoint(page);
  await page.touchscreen.tap(background.x, background.y);
  const pin = page.locator('.event-map-pin').first();
  await pin.click();
  await expect(pin).toHaveClass(/active/);
  await page.evaluate(() => window.__FQC_MAP__.stop());
  const p = await mapPoint(page);
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.event-map-pin.active')).toHaveCount(0);
  await page.evaluate(() => {
    window.__mapBeforeUpdate = window.__FQC_MAP__;
    window.__tileBeforeUpdate = document.querySelector('.leaflet-tile');
    window.__FQC_AUTH_TEST_API__.setCheckIn({ open: true });
  });
  await expect.poll(() => page.evaluate(() => window.__FQC_MAP__ === window.__mapBeforeUpdate)).toBe(true);
  expect(await page.evaluate(() => document.querySelector('.leaflet-tile') === window.__tileBeforeUpdate)).toBe(true);
  await expect(page.locator('.event-map-pin.active')).toHaveCount(0);
  expect(await page.locator('#event-map').evaluate(el => getComputedStyle(el).getPropertyValue('user-select') || getComputedStyle(el).getPropertyValue('-webkit-user-select'))).toBe('none');
  const cancelled = await page.locator('#event-map').evaluate(el => {
    const event = new Event('selectstart', { bubbles: true, cancelable: true });
    el.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(cancelled).toBe(true);
});

test('quick zoom renders fractional frames and preserves the map center during a live update', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Raw continuous touch input uses Chromium device input.');
  await goTab(page, 'Home');
  await page.evaluate(() => {
    const map = window.__FQC_MAP__;
    map.setZoom(16, { animate: false });
    window.__smoothZoom = { values: [], resets: 0, original: map };
    map.on('zoom', () => window.__smoothZoom.values.push(map.getZoom()));
    map.on('viewreset', () => window.__smoothZoom.resets++);
  });
  const p = await mapPoint(page);
  const anchor = await page.evaluate(p => {
    const ll = window.__FQC_MAP__.getCenter();
    return { lat: ll.lat, lng: ll.lng };
  }, p);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y, id: 1 }] });
  await touch('touchStart', p.y); await touch('touchEnd'); await touch('touchStart', p.y);
  for (let i = 1; i <= 13; i++) {
    await touch('touchMove', p.y + i * 7);
    if (i === 5) await page.evaluate(() => window.__FQC_AUTH_TEST_API__.setCheckIn({ open: true }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  }
  await touch('touchEnd');
  await expect.poll(() => zoom(page)).toBeCloseTo(16.91, 4);
  const result = await page.evaluate(anchor => {
    const map = window.__FQC_MAP__;
    const point = map.latLngToContainerPoint(anchor);
    const box = map.getContainer().getBoundingClientRect();
    return { sameMap: map === window.__smoothZoom.original, frames: new Set(window.__smoothZoom.values).size, resets: window.__smoothZoom.resets, x: point.x + box.x, y: point.y + box.y };
  }, anchor);
  expect(result.sameMap).toBe(true);
  expect(result.frames).toBeGreaterThan(8);
  expect(result.resets).toBeLessThanOrEqual(2);
  const mapBox = await page.locator('#event-map').boundingBox();
  expect(Math.abs(result.x - (mapBox.x + mapBox.width / 2))).toBeLessThan(3);
  expect(Math.abs(result.y - (mapBox.y + mapBox.height / 2))).toBeLessThan(3);
});

test('photo entrances happen once, respect reduced motion, and leave the invitation usable', async ({ page }) => {
  await page.addInitScript(() => {
    window.__photoEntrances = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(...args) {
      if (this.tagName === 'FIGURE') window.__photoEntrances.push(this.querySelector('img')?.getAttribute('src'));
      return animate.apply(this, args);
    };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect(page.locator('.app-splash')).toBeHidden();
  for (const figure of await page.locator('.hackathon-landing figure').all()) {
    await figure.scrollIntoViewIfNeeded();
    await expect.poll(() => figure.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__photoEntrances.length)).toBe(4);
  await page.waitForTimeout(400);
  await goTab(page, 'Home');
  await goTab(page, 'Hackathon');
  await page.locator('.workshop-outlook').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__photoEntrances.length)).toBe(4);
  await expect(page.locator('#hackathon-title')).toHaveText('Your turn to build');
  await page.locator('[data-hackathon-rsvp]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('.app-splash')).toBeHidden();
  for (const figure of await page.locator('.hackathon-landing figure').all()) {
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toBeVisible();
    expect(await figure.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  }
  expect(await page.evaluate(() => window.__photoEntrances.length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('map touch defaults cannot start the iOS loupe and taps still reach pins and controls once', async ({ page }) => {
  await goTab(page, 'Home');
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => {
    window.__touchDefaults = [];
    document.addEventListener('touchstart', event => {
      if (event.target.closest('#event-map')) window.__touchDefaults.push(event.defaultPrevented);
    });
    // A stale selection must be cleared when touching the map.
    const range = document.createRange(); range.selectNodeContents(document.querySelector('.map-status'));
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  const p = await mapPoint(page);
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.__touchDefaults.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__touchDefaults.every(Boolean))).toBe(true);
  expect(await page.evaluate(() => getSelection().isCollapsed)).toBe(true);
  expect(await page.locator('.leaflet-tile-pane').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await page.locator('.event-map-pin').first().tap();
  await expect(page.locator('.event-map-pin.active')).toHaveCount(1);
  await expect(page.locator('.event-intro h2')).toContainText('Quantum Workshop');
  const before = await zoom(page);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).tap();
  await expect.poll(() => zoom(page)).toBeCloseTo(before + 1, 5);
  await page.waitForTimeout(350);
  expect(await zoom(page)).toBeCloseTo(before + 1, 5);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).tap();
  await expect.poll(() => zoom(page)).toBeCloseTo(before, 5);
  // The guard must be removed with the old map and rebound to the next one.
  await goTab(page, 'Hackathon');
  await goTab(page, 'Home');
  const again = await mapPoint(page);
  await page.touchscreen.tap(again.x, again.y);
  expect(await page.evaluate(() => window.__touchDefaults.every(Boolean))).toBe(true);
  // Editable controls elsewhere keep their native selection and focus behavior.
  await goTab(page, 'Profile');
  const email = page.locator('#auth-identifier');
  await email.tap();
  await email.fill('member@ufl.edu');
  await expect(email).toHaveValue('member@ufl.edu');
  await expect(email).toBeFocused();
});

test('mobile scroll focus animates images while text and layout remain untransformed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const tile = page.locator('.workshop-hardware');
  const picture = tile.locator('figure img');
  const scale = () => picture.evaluate(el => parseFloat(getComputedStyle(el).scale));
  const centerTile = () => tile.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await centerTile();
  await expect.poll(scale).toBeGreaterThan(1.0075);
  await expect(tile).toHaveCSS('scale', 'none');
  await expect(tile).toHaveCSS('translate', 'none');
  const layout = await tile.evaluate(el => ({ height: el.offsetHeight, top: el.offsetTop }));
  await page.evaluate(() => scrollBy({ top: innerHeight * .45, behavior: 'instant' }));
  await expect.poll(scale).toBeLessThan(1.006);
  await expect.poll(scale).toBeGreaterThanOrEqual(1);
  expect(await tile.evaluate(el => ({ height: el.offsetHeight, top: el.offsetTop }))).toEqual(layout);
  await centerTile();
  await expect.poll(scale).toBeGreaterThan(1.0075);
  await page.locator('[data-apply-h]').tap();
  await expect(page.locator('[data-phase-state="minus"]')).toHaveText('|1⟩');
  for (const card of await page.locator('.story-focus-tile').all()) {
    await card.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(card).toHaveCSS('scale', 'none');
    await expect(card).toHaveCSS('translate', 'none');
    // No scroll transform on text, or any ancestor containing that text.
    expect(await card.evaluate(el => [...el.querySelectorAll('h2, p, summary, figcaption')].every(text => {
      for (let ancestor = text; ancestor && el.contains(ancestor); ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.scale !== 'none' || style.translate !== 'none') return false;
      }
      return true;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await centerTile();
  await expect(tile).toHaveCSS('scale', 'none');
  await expect(tile).toHaveCSS('translate', 'none');
  await expect(picture).toHaveCSS('scale', 'none');
  await expect(picture).toHaveCSS('translate', 'none');
  await goTab(page, 'Home');
  await goTab(page, 'Hackathon');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await centerTile();
  await expect.poll(scale).toBeGreaterThan(1.0075);
});

test('photo bubbles compress, spring back, cancel for scrolling, and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const figure = page.locator('.hack-hero-shot');
  await figure.scrollIntoViewIfNeeded();
  await expect.poll(() => figure.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.waitForTimeout(400);
  const box = await figure.boundingBox();
  const center = {x: box.x + box.width / 2, y: box.y + box.height / 2};
  const scale = () => figure.evaluate(el => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return Math.hypot(m.a, m.b); });
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await expect.poll(scale).toBeLessThan(.985);
  await page.mouse.up();
  await expect.poll(scale, {intervals:[20]}).toBeGreaterThan(1.005);
  await expect.poll(scale).toBeCloseTo(1, 4);
  await expect(figure).not.toHaveClass(/photo-is-pressed/);
  // Real touch taps must trigger the same response, not just mouse input.
  await figure.tap();
  await expect.poll(scale, {intervals:[20]}).toBeGreaterThan(1.005);
  await expect.poll(scale).toBeCloseTo(1, 4);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x, center.y + 30);
  await expect(figure).not.toHaveClass(/photo-is-pressed/);
  await page.mouse.up();
  await expect.poll(scale).toBeCloseTo(1, 4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await expect(figure).toHaveClass(/photo-is-pressed/);
  expect(await scale()).toBe(1);
  expect(await figure.evaluate(el => el.getAnimations().length)).toBe(0);
  await page.mouse.up();
  await expect(figure).not.toHaveClass(/photo-is-pressed/);
});
