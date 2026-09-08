import L from 'leaflet';

// WebKit's selection loupe can ignore user-select/touch-callout CSS. Cancel
// native touch defaults (not propagation) so Leaflet still pans and pinches.
// iOS then suppresses compatibility clicks, so relay only short, unmoved taps.
// https://bugs.webkit.org/show_bug.cgi?id=231161
function bindMapTouchSelectionGuard(container, suppressTap) {
  let tap = null;
  const editable = target => target.closest?.('input, textarea, select, [contenteditable="true"]');
  const start = event => {
    if (editable(event.target)) { tap = null; return; }
    event.preventDefault();
    container.ownerDocument.getSelection()?.removeAllRanges();
    const first = event.touches[0];
    tap = event.touches.length === 1 ? { target: event.target, id: first.identifier, x: first.clientX, y: first.clientY, time: performance.now(), moved: false } : null;
  };
  const move = event => {
    if (editable(event.target)) return;
    event.preventDefault();
    if (!tap) return;
    const first = [...event.touches].find(point => point.identifier === tap.id);
    if (!first || event.touches.length !== 1) { tap = null; return; }
    if (Math.hypot(first.clientX - tap.x, first.clientY - tap.y) > 4) tap.moved = true;
  };
  const end = event => {
    if (editable(event.target)) return;
    event.preventDefault();
    const finished = tap;
    tap = null;
    if (!finished || event.type === 'touchcancel' || event.touches.length || finished.moved || performance.now() - finished.time >= 350 || suppressTap(finished.target) || !finished.target.isConnected) return;
    finished.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 0, clientX: finished.x, clientY: finished.y }));
  };
  const handlers = [['touchstart', start], ['touchmove', move], ['touchend', end], ['touchcancel', end]];
  handlers.forEach(([name, handler]) => container.addEventListener(name, handler, { capture: true, passive: false }));
  return () => handlers.forEach(([name, handler]) => container.removeEventListener(name, handler, true));
}

// Leaflet 1.9's non-animated pinch end calls _resetView, which fires
// viewprereset and discards every tile. Settle the existing view instead so
// loaded parent/child tiles remain visible while replacement tiles arrive.
function preservePinchTiles(map) {
  const pinch = map.touchZoom;
  const originalEnd = pinch._onTouchEnd;
  const container = map.getContainer();
  const ownerDocument = container.ownerDocument;
  const cleanup = () => {
    L.Util.cancelAnimFrame(pinch._animRequest);
    L.DomEvent.off(ownerDocument, 'touchmove', pinch._onTouchMove, pinch);
    L.DomEvent.off(ownerDocument, 'touchend touchcancel', pinch._onTouchEnd, pinch);
  };
  pinch._onTouchEnd = function () {
    const moved = this._moved && this._zooming;
    this._zooming = false;
    // Clean up even a stationary/cancelled pinch before the next gesture.
    cleanup();
    if (!moved) return;
    map._move(this._center, map._limitZoom(this._zoom), { pinch: true, round: false });
    map.fire('viewreset');
    map._moveEnd(true);
  };
  const start = event => {
    if (event.touches?.length === 2 && !pinch._zooming) map.fire('userzoomstart');
  };
  container.addEventListener('touchstart', start, { capture: true, passive: true });
  map.on('unload', () => {
    cleanup();
    pinch._zooming = false;
    pinch._onTouchEnd = originalEnd;
    container.removeEventListener('touchstart', start, true);
  });
}

// Leaflet 1.9's native pinch renderer also powers quick and wheel zoom. _move with
// pinch:true transforms existing tiles each display frame; setZoomAround on
// every pointer event instead resets the view and quantizes the gesture.
export function bindMapQuickZoom(map) {
  preservePinchTiles(map);
  const container = map.getContainer();
  let touch = null;
  let lastTap = null;
  let suppressUntil = 0;
  let motion = null;
  let frame = 0;
  const pointers = new Set();
  const ignore = target => target.closest?.('.leaflet-marker-icon, .leaflet-control, .leaflet-popup');
  const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const clamp = zoom => Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), zoom));

  const paint = zoom => {
    if (!motion) return;
    motion.zoom = clamp(zoom);
    const offset = motion.point.subtract(map.getSize().divideBy(2));
    const center = motion.kind === 'center' ? motion.anchor : map.unproject(map.project(motion.anchor, motion.zoom).subtract(offset), motion.zoom);
    map._move(center, motion.zoom, { pinch: true, round: false });
  };
  const finish = () => {
    cancelAnimationFrame(frame); frame = 0;
    if (!motion) return;
    paint(motion.target);
    motion = null;
    // Settle/prune tiles once at the end, not for every input event.
    map.fire('viewreset');
    map._moveEnd(true);
  };
  const begin = (point, kind = 'touch') => {
    map.fire('userzoomstart');
    if (motion) { motion.target = map.getZoom(); finish(); }
    map._stop();
    motion = { point, kind, anchor: kind === 'center' ? map.getCenter() : map.containerPointToLatLng(point), zoom: map.getZoom(), target: map.getZoom() };
    map._moveStart(true, false);
  };
  const animateZoom = (point, target, kind = 'touch') => {
    begin(point, kind);
    const start = map.getZoom();
    motion.target = clamp(target);
    const end = motion.target;
    const started = performance.now();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = now => {
      if (!motion) return;
      const progress = reducedMotion ? 1 : Math.min(1, (now - started) / 240);
      paint(start + (end - start) * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
  };
  const down = event => {
    if (event.pointerType !== 'touch') {
      if (motion) { motion.target = map.getZoom(); finish(); }
      return;
    }
    pointers.add(event.pointerId);
    if (motion) { motion.target = map.getZoom(); finish(); }
    if (pointers.size > 1 || ignore(event.target)) {
      if (touch && container.hasPointerCapture(touch.id)) container.releasePointerCapture(touch.id);
      touch = null; lastTap = null; return;
    }
    const now = performance.now();
    const second = lastTap && now - lastTap.time < 320 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 28;
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY, time: now, second, moved: false, zoom: map.getZoom(), point: map.mouseEventToContainerPoint(event) };
    if (second) {
      lastTap = null;
      suppressUntil = now + 500;
      container.setPointerCapture(event.pointerId);
      stop(event);
    }
  };
  const move = event => {
    if (!touch || touch.id !== event.pointerId) return;
    const dy = event.clientY - touch.y;
    if (Math.hypot(event.clientX - touch.x, dy) > 4) touch.moved = true;
    if (!touch.second) return;
    suppressUntil = performance.now() + 500;
    stop(event);
    if (!touch.moved) return;
    if (!motion) begin(map.getSize().divideBy(2), 'center');
    // Google Maps convention: down = in, up = out. Fractional, no snapping.
    motion.target = clamp(touch.zoom + dy / 100);
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (motion) paint(motion.target); });
  };
  const up = event => {
    pointers.delete(event.pointerId);
    if (!touch || touch.id !== event.pointerId) return;
    const finished = touch;
    touch = null;
    if (finished.second) {
      suppressUntil = performance.now() + 500;
      stop(event);
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
      if (motion) finish();
      if (event.type !== 'pointercancel' && !finished.moved) animateZoom(map.getSize().divideBy(2), finished.zoom + 1, 'center');
    } else if (event.type !== 'pointercancel' && !finished.moved && performance.now() - finished.time < 300) {
      lastTap = { x: finished.x, y: finished.y, time: performance.now() };
    } else lastTap = null;
  };
  const suppressClick = event => { if (performance.now() < suppressUntil && !ignore(event.target)) stop(event); };
  const doubleClick = event => {
    if (performance.now() < suppressUntil) return;
    const direction = event.originalEvent.shiftKey ? -1 : 1;
    animateZoom(event.containerPoint, map.getZoom() + direction);
  };
  const preventSelection = event => {
    if (!event.target.closest?.('input, textarea, select, [contenteditable="true"]')) event.preventDefault();
  };
  // Native wheel zoom calls setZoomAround repeatedly. With CSS zoom disabled,
  // that resets the view and removes loaded tiles during trackpad reversals.
  // Share the pinch renderer and settle once the wheel stream has ended.
  map.scrollWheelZoom.disable();
  let lastWheelAt = 0;
  let lastWheelFrame = 0;
  const wheelTick = now => {
    frame = 0;
    if (motion?.kind !== 'wheel') return;
    const elapsed = Math.min(64, now - lastWheelFrame);
    lastWheelFrame = now;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    paint(motion.zoom + (motion.target - motion.zoom) * (reducedMotion ? 1 : 1 - Math.exp(-elapsed / 45)));
    if (now - lastWheelAt >= 140 && Math.abs(motion.target - motion.zoom) < .0001) finish();
    else frame = requestAnimationFrame(wheelTick);
  };
  const wheel = event => {
    if (event.target.closest?.('.leaflet-control, .leaflet-popup') || !Number.isFinite(event.deltaY) || !event.deltaY) return;
    stop(event);
    if (pointers.size || map.touchZoom._zooming) return;
    const now = performance.now();
    if (motion?.kind !== 'wheel') {
      begin(map.mouseEventToContainerPoint(event), 'wheel');
      lastWheelFrame = now;
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? map.getSize().y : 1;
    const pixels = Math.max(-240, Math.min(240, event.deltaY * unit));
    motion.target = clamp(motion.target - pixels / 240);
    lastWheelAt = now;
    if (!frame) frame = requestAnimationFrame(wheelTick);
  };
  container.addEventListener('pointerdown', down, { capture: true, passive: false });
  container.addEventListener('pointermove', move, { capture: true, passive: false });
  container.addEventListener('pointerup', up, { capture: true, passive: false });
  container.addEventListener('pointercancel', up, { capture: true, passive: false });
  container.addEventListener('click', suppressClick, true);
  container.addEventListener('dblclick', suppressClick, true);
  container.addEventListener('selectstart', preventSelection);
  container.addEventListener('contextmenu', preventSelection);
  container.addEventListener('dragstart', preventSelection);
  container.addEventListener('wheel', wheel, { passive: false });
  const removeTouchSelectionGuard = bindMapTouchSelectionGuard(container, target => performance.now() < suppressUntil && !ignore(target));
  map.on('dblclick', doubleClick);
  map.on('unload', () => {
    removeTouchSelectionGuard();
    cancelAnimationFrame(frame); motion = null; touch = null;
    for (const [name, handler] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['click', suppressClick], ['dblclick', suppressClick]]) container.removeEventListener(name, handler, true);
    for (const [name, handler] of [['selectstart', preventSelection], ['contextmenu', preventSelection], ['dragstart', preventSelection], ['wheel', wheel]]) container.removeEventListener(name, handler);
    map.off('dblclick', doubleClick);
  });
}
