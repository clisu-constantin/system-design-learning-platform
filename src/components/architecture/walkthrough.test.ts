import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barFill, canGoBack, canGoNext, isLive, nextStep, playStep, previousStep, LIVE } from './walkthrough.ts';

test('Live is the position before step 1, and no step is Live', () => {
  assert.equal(isLive(LIVE), true);
  assert.equal(isLive(0), false);
  assert.equal(isLive(previousStep(0)), true);
});

test('next from Live opens step 1, and next walks the steps up to the last', () => {
  assert.equal(nextStep(LIVE, 4), 0);
  assert.equal(nextStep(0, 4), 1);
  assert.equal(nextStep(3, 4), 3);
});

test('back from step 1 returns to Live, and back on Live stays on Live', () => {
  assert.equal(previousStep(2), 1);
  assert.equal(previousStep(0), LIVE);
  assert.equal(previousStep(LIVE), LIVE);
});

test('back is disabled on Live, next on the last step', () => {
  assert.equal(canGoBack(LIVE), false);
  assert.equal(canGoBack(0), true);
  assert.equal(canGoNext(LIVE, 4), true);
  assert.equal(canGoNext(2, 4), true);
  assert.equal(canGoNext(3, 4), false);
  assert.equal(canGoNext(LIVE, 0), false);
});

test('play loops from the last step back to step 1', () => {
  assert.equal(playStep(0, 4), 1);
  assert.equal(playStep(3, 4), 0);
});

test('on Live every step bar is empty', () => {
  assert.deepEqual([0, 1, 2].map((bar) => barFill(bar, LIVE, 0.4)), [0, 0, 0]);
});

test('in a step the walked bars are full, the current one fills and the rest are empty', () => {
  assert.deepEqual([0, 1, 2, 3].map((bar) => barFill(bar, 2, 0.4)), [1, 1, 0.4, 0]);
});
