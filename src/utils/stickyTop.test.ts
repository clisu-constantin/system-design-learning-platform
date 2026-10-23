import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stickyTop } from './stickyTop.ts';

test('a short column sticks 16px under the top of the visible area', () => {
  assert.equal(stickyTop({ visible: 800, column: 500 }), 16);
});

test('a column that just fits with 16px above and below still sticks at the top', () => {
  assert.equal(stickyTop({ visible: 800, column: 768 }), 16);
});

test('a tall column sticks with its bottom edge 16px above the bottom of the visible area', () => {
  // 800 visible, 1100 tall: the top sits 316px above the visible area, the bottom at 784.
  assert.equal(stickyTop({ visible: 800, column: 1100 }), -316);
});

test('before anything is measured the column sticks at the top', () => {
  assert.equal(stickyTop({ visible: 0, column: 0 }), 16);
});
