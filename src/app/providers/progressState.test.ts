import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PROGRESS, markVisited, mergeProgress, toggleDone, parseProgress, recordQuiz, resetProgress, progressView, serializeProgress } from './progressState.ts';

const NO_MERGES = {};

test('progress saved in the old format loads with nothing lost', () => {
  const legacy = JSON.stringify({
    visited: { caching: 100, sharding: 200 },
    completed: { caching: true },
    quiz: { caching: { correct: 8, total: 10, at: 300 } },
  });

  const state = parseProgress({ current: null, legacy }, NO_MERGES);

  assert.deepEqual(progressView(state), {
    visited: { caching: 100, sharding: 200 },
    completed: { caching: true },
    quiz: { caching: { correct: 8, total: 10, at: 300 } },
  });
});

test('migrated progress is saved in the new format and loads back the same', () => {
  const legacy = JSON.stringify({ visited: { caching: 100 }, completed: { caching: true }, quiz: {} });
  const migrated = parseProgress({ current: null, legacy }, NO_MERGES);

  const saved = serializeProgress(migrated);
  // A stale copy in the old format is ignored once the new one exists.
  const reloaded = parseProgress({ current: saved, legacy: JSON.stringify({ completed: { sharding: true } }) }, NO_MERGES);

  assert.equal(JSON.parse(saved).version, 2);
  assert.deepEqual(reloaded, migrated);
});

test('progress on a merged Concept moves to the Concept it was merged into', () => {
  const merges = { tracing: 'distributed-tracing' };
  const legacy = JSON.stringify({
    visited: { tracing: 50, 'distributed-tracing': 100 },
    completed: { tracing: true },
    quiz: { tracing: { correct: 9, total: 10, at: 60 }, 'distributed-tracing': { correct: 6, total: 10, at: 110 } },
  });

  const state = parseProgress({ current: null, legacy }, merges);

  // Done wins, the first visit and the best score are kept, the retired slug is gone.
  assert.deepEqual(progressView(state), {
    visited: { 'distributed-tracing': 50 },
    completed: { 'distributed-tracing': true },
    quiz: { 'distributed-tracing': { correct: 9, total: 10, at: 60 } },
  });
});

test('a first visit records when the Concept changed, a later visit changes nothing', () => {
  const visited = markVisited(EMPTY_PROGRESS, 'caching', 1000);
  const again = markVisited(visited, 'caching', 2000);

  assert.deepEqual(visited.concepts.caching, { visitedAt: 1000, done: false, doneAt: 0, changedAt: 1000 });
  assert.equal(again, visited);
});

test('marking and un-marking Done record their time, and un-marking keeps the record', () => {
  const visited = markVisited(EMPTY_PROGRESS, 'caching', 1000);
  const marked = toggleDone(visited, 'caching', 2000);
  const unmarked = toggleDone(marked, 'caching', 3000);

  assert.deepEqual(marked.concepts.caching, { visitedAt: 1000, done: true, doneAt: 2000, changedAt: 2000 });
  assert.deepEqual(unmarked.concepts.caching, { visitedAt: 1000, done: false, doneAt: 3000, changedAt: 3000 });
  assert.deepEqual(progressView(unmarked).completed, {});
});

test('a Quiz keeps its best score, and a pass of 70% or more makes the Concept Done', () => {
  const failed = recordQuiz(EMPTY_PROGRESS, 'caching', 5, 10, 1000);
  const passed = recordQuiz(failed, 'caching', 7, 10, 2000);
  const worse = recordQuiz(passed, 'caching', 4, 10, 3000);

  assert.deepEqual(failed.concepts.caching, { done: false, doneAt: 0, quiz: { correct: 5, total: 10, at: 1000 }, changedAt: 1000 });
  assert.deepEqual(passed.concepts.caching, { done: true, doneAt: 2000, quiz: { correct: 7, total: 10, at: 2000 }, changedAt: 2000 });
  assert.equal(worse, passed);
});

test('passing the Quiz of a Concept already Done wins over an older un-mark on another device', () => {
  const laptop = toggleDone(EMPTY_PROGRESS, 'caching', 1000);
  const phone = toggleDone(laptop, 'caching', 2000);
  const passedLater = recordQuiz(laptop, 'caching', 9, 10, 3000);

  assert.deepEqual(passedLater.concepts.caching, { done: true, doneAt: 3000, quiz: { correct: 9, total: 10, at: 3000 }, changedAt: 3000 });
  assert.deepEqual(progressView(mergeProgress(phone, passedLater)).completed, { caching: true });
});

test('Reset leaves a cleared record per Concept, and the Concept can be studied again', () => {
  let state = markVisited(EMPTY_PROGRESS, 'caching', 1000);
  state = recordQuiz(state, 'caching', 9, 10, 2000);
  state = markVisited(state, 'sharding', 3000);

  const reset = resetProgress(state, ['caching', 'sharding'], 5000);
  const revisited = markVisited(reset, 'caching', 6000);

  assert.deepEqual(reset.concepts, {
    caching: { done: false, doneAt: 5000, clearedAt: 5000, changedAt: 5000 },
    sharding: { done: false, doneAt: 5000, clearedAt: 5000, changedAt: 5000 },
  });
  assert.deepEqual(progressView(reset), { visited: {}, completed: {}, quiz: {} });
  assert.deepEqual(progressView(revisited).visited, { caching: 6000 });
});

test('merging two devices: the latest change to Done wins, in either order', () => {
  const laptop = toggleDone(EMPTY_PROGRESS, 'caching', 2000);
  const phone = toggleDone(toggleDone(EMPTY_PROGRESS, 'caching', 1000), 'caching', 3000);

  assert.deepEqual(progressView(mergeProgress(laptop, phone)).completed, {});
  assert.deepEqual(progressView(mergeProgress(phone, laptop)).completed, {});

  const markedLater = toggleDone(phone, 'caching', 4000);
  assert.deepEqual(progressView(mergeProgress(laptop, markedLater)).completed, { caching: true });
});

test('merging two devices keeps the best Quiz score, the earliest visit and every Concept', () => {
  const laptop = recordQuiz(markVisited(EMPTY_PROGRESS, 'caching', 1000), 'caching', 9, 10, 1500);
  const phone = markVisited(recordQuiz(markVisited(EMPTY_PROGRESS, 'caching', 500), 'caching', 6, 10, 4000), 'sharding', 4500);

  assert.deepEqual(progressView(mergeProgress(laptop, phone)), {
    visited: { caching: 500, sharding: 4500 },
    completed: { caching: true },
    quiz: { caching: { correct: 9, total: 10, at: 1500 } },
  });
});

test('merging two devices: a Reset beats older progress, but not progress made after it', () => {
  const stale = recordQuiz(markVisited(EMPTY_PROGRESS, 'caching', 1000), 'caching', 9, 10, 2000);
  const reset = resetProgress(stale, ['caching'], 5000);
  const staleThenNewer = markVisited(recordQuiz(stale, 'sharding', 8, 10, 6000), 'sharding', 6000);

  assert.deepEqual(progressView(mergeProgress(stale, reset)), { visited: {}, completed: {}, quiz: {} });
  assert.deepEqual(progressView(mergeProgress(reset, staleThenNewer)), {
    visited: { sharding: 6000 },
    completed: { sharding: true },
    quiz: { sharding: { correct: 8, total: 10, at: 6000 } },
  });
});

test('Done Concepts are listed in the order they became Done', () => {
  let state = markVisited(markVisited(EMPTY_PROGRESS, 'caching', 1000), 'sharding', 1100);
  state = toggleDone(state, 'sharding', 2000);
  state = toggleDone(state, 'caching', 3000);

  assert.deepEqual(Object.keys(progressView(state).completed), ['sharding', 'caching']);
});

test('broken or foreign storage loads as empty progress instead of crashing', () => {
  for (const raw of ['{not json', '[]', 'null', JSON.stringify({ version: 2, concepts: { caching: { done: 'yes' } } })]) {
    assert.deepEqual(progressView(parseProgress({ current: raw, legacy: null }, NO_MERGES)), {
      visited: {},
      completed: {},
      quiz: {},
    });
  }
});

test('an old-format Concept that was never Done cannot un-mark it on another device', () => {
  const migrated = parseProgress({ current: null, legacy: JSON.stringify({ visited: { caching: 5000 } }) }, NO_MERGES);
  const laptop = toggleDone(EMPTY_PROGRESS, 'caching', 3000);

  assert.deepEqual(progressView(mergeProgress(migrated, laptop)).completed, { caching: true });
});

test('Reset clears every Concept, also ones this device never opened', () => {
  const reset = resetProgress(markVisited(EMPTY_PROGRESS, 'caching', 1000), ['caching', 'sharding'], 5000);
  const stale = recordQuiz(markVisited(EMPTY_PROGRESS, 'sharding', 2000), 'sharding', 9, 10, 2500);

  assert.deepEqual(progressView(mergeProgress(stale, reset)), { visited: {}, completed: {}, quiz: {} });
});

test('two equal Quiz scores at the same time merge the same in either order', () => {
  const small = recordQuiz(EMPTY_PROGRESS, 'caching', 7, 10, 1000);
  const large = recordQuiz(EMPTY_PROGRESS, 'caching', 14, 20, 1000);

  assert.deepEqual(mergeProgress(small, large), mergeProgress(large, small));
});
