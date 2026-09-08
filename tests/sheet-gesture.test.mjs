import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSheetDestination } from '../sheet-gesture.js';
const metrics = { low: 200, medium: 350, high: 700 };
const destination = (startHeight, height, velocity) => chooseSheetDestination({ metrics, startHeight, height, velocity });
test('short flicks stop at the adjacent position even with a high speed sample', () => {
  for (const velocity of [.6, 1.5, 3]) {
    assert.equal(destination(700, 652, -velocity), 'medium');
    assert.equal(destination(200, 248, velocity), 'medium');
  }
});
test('long travel or a strong sustained flick can skip the middle', () => {
  assert.equal(destination(700, 390, -.7), 'low');
  assert.equal(destination(200, 510, .7), 'high');
  assert.equal(destination(700, 590, -3), 'low');
  assert.equal(destination(200, 310, 3), 'high');
});
test('pausing ignores old momentum and settles near release', () => {
  assert.equal(destination(700, 360, 0), 'medium');
  assert.equal(destination(200, 340, 0), 'medium');
  assert.equal(destination(700, 220, 0), 'low');
});
test('reversal and catching a moving sheet use its rendered starting position', () => {
  assert.equal(destination(350, 400, -1.5), 'low');
  assert.equal(destination(420, 460, .7), 'high');
});
