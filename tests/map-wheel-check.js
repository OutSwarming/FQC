import { expect } from '@playwright/test';

export async function checkContinuousWheel(page) {
  // The account fixture freezes Date; tile fades need elapsed time while the
  // fixture's calendar date stays fixed for event selection.
  await page.evaluate(() => {
    const FixtureDate = Date, epoch = Date.now(), started = performance.now();
    window.Date = class extends FixtureDate {
      constructor(...args) { super(...(args.length ? args : [epoch + performance.now() - started])); }
      static now() { return epoch + performance.now() - started; }
    };
  });
  await page.route('https://*.tile.openstreetmap.org/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 180));
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
  });
  await page.locator('.bottom-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => window.__FQC_MAP__.setZoom(16, { animate: false }));
  await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.leaflet-tile-loaded').evaluateAll(tiles => tiles.some(tile => parseFloat(getComputedStyle(tile).opacity) > .9))).toBe(true);
  const box = await page.locator('#event-map').boundingBox();
  const point = { x: box.x + box.width * .35, y: box.y + 85 };
  await page.evaluate(point => {
    const map = window.__FQC_MAP__;
    const anchor = map.containerPointToLatLng(map.mouseEventToContainerPoint({clientX:point.x, clientY:point.y}));
    const audit = window.__wheelAudit = { map, anchor, resets: 0, blank: 0, frames: 0, values: [], running: true, ended: 0 };
    map.on('viewprereset', () => audit.resets++);
    map.on('zoom', () => audit.values.push(map.getZoom()));
    map.on('zoomend', () => audit.ended++);
    const sample = () => {
      audit.frames++;
      const bounds = map.getContainer().getBoundingClientRect();
      if (![...map.getContainer().querySelectorAll('.leaflet-tile-loaded')].some(tile => {
        const rect = tile.getBoundingClientRect();
        return parseFloat(getComputedStyle(tile).opacity) > .1 && rect.right > bounds.left && rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom;
      })) audit.blank++;
      if (audit.running) requestAnimationFrame(sample);
    };
    sample();
  }, point);
  await page.mouse.move(point.x, point.y);
  // Real wheel input, reversals, inertia-sized deltas, and a live account update.
  for (const direction of [-1, 1, -1]) {
    for (let i = 0; i < 16; i++) {
      await page.mouse.wheel(0, direction * (i < 10 ? 16 : 4));
      if (i === 5) await page.evaluate(() => window.__FQC_AUTH_TEST_API__.setCheckIn({ open: true }));
      await page.waitForTimeout(16);
    }
  }
  await expect.poll(() => page.evaluate(() => window.__wheelAudit.ended)).toBeGreaterThan(0);
  await page.waitForTimeout(450);
  const result = await page.evaluate(() => {
    const a = window.__wheelAudit; a.running = false;
    return { sameMap: window.__FQC_MAP__ === a.map, resets: a.resets, blank: a.blank, frames: a.frames, values: [...new Set(a.values)], scale: visualViewport.scale, zoom: a.map.getZoom() };
  });
  console.log('wheel audit', JSON.stringify({resets: result.resets, blankFrames: result.blank, frames: result.frames, zoomSteps: result.values.length}));
  expect(result.sameMap).toBe(true);
  expect(result.resets).toBe(0);
  expect(result.blank).toBe(0);
  expect(result.values.length).toBeGreaterThan(20);
  expect(Math.max(...result.values) - Math.min(...result.values)).toBeGreaterThan(.2);
  expect(result.scale).toBeCloseTo(1, 3);
  expect(result.zoom).toBeGreaterThan(16);
  // Mouse-wheel line units and Ctrl-wheel pinch also zoom the map over a pin.
  for (const [deltaMode, deltaY, ctrlKey] of [[1, -3, false], [0, -48, true], [2, .1, false]]) {
    const before = await page.evaluate(() => window.__FQC_MAP__.getZoom());
    const ends = await page.evaluate(() => window.__wheelAudit.ended);
    await page.locator('.event-map-pin').first().evaluate((el, input) => {
      const box = el.getBoundingClientRect();
      el.dispatchEvent(new WheelEvent('wheel', {...input, clientX:box.x + box.width / 2, clientY:box.y + box.height / 2, bubbles:true, cancelable:true}));
    }, {deltaMode, deltaY, ctrlKey});
    await expect.poll(() => page.evaluate(() => window.__wheelAudit.ended)).toBeGreaterThan(ends);
    const after = await page.evaluate(() => window.__FQC_MAP__.getZoom());
    if (deltaY < 0) expect(after).toBeGreaterThan(before);
    else expect(after).toBeLessThan(before);
    expect(await page.evaluate(() => visualViewport.scale)).toBeCloseTo(1, 3);
  }
  // Pending wheel work must not leak into the next map instance.
  await page.mouse.wheel(0, -50);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Hackathon', exact: true }).click();
  await page.locator('.bottom-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.locator('#event-map')).toBeVisible();
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => Number.isFinite(window.__FQC_MAP__.getZoom()))).toBe(true);
}
