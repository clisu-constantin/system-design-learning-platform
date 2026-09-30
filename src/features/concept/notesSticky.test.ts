import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notesStickyTop } from './notesSticky.ts';

test('short notes stick 16px under the top of the visible area', () => {
  assert.equal(notesStickyTop({ visible: 800, notes: 500 }), 16);
});

test('notes that just fit with 16px above and below still stick at the top', () => {
  assert.equal(notesStickyTop({ visible: 800, notes: 768 }), 16);
});

test('tall notes stick with their bottom edge 16px above the bottom of the visible area', () => {
  // 800 visible, 1100 tall: the top sits 316px above the visible area, the bottom at 784.
  assert.equal(notesStickyTop({ visible: 800, notes: 1100 }), -316);
});

test('before anything is measured the notes stick at the top', () => {
  assert.equal(notesStickyTop({ visible: 0, notes: 0 }), 16);
});
