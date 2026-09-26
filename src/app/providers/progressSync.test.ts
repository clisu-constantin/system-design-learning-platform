import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ApiResult } from '../account/api.ts';
import { EMPTY_PROGRESS, markVisited, mergeProgress, progressView, recordQuiz, resetProgress, serializeProgress, toggleDone } from './progressState.ts';
import type { ConceptProgress, ProgressState } from './progressState.ts';
import {
  LEGACY_PROGRESS_KEY,
  OUTBOX_KEY,
  PROGRESS_KEY,
  PUSH_DELAY_MS,
  createProgressSync,
  forgetResets,
  parseOutbox,
  retryDelay,
  type SyncRequest,
} from './progressSync.ts';

const ALL = ['caching', 'sharding', 'replication', 'queues'];

// ---------------------------------------------------------------------------
// Test doubles: one localStorage per browser (shared by its tabs), a clock and
// timers the test moves by hand, and a server that merges with the same rules.

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (key: string) => data.get(key) ?? null,
    set: (key: string, value: string) => void data.set(key, value),
    remove: (key: string) => void data.delete(key),
  };
}

function fakeClock(start = 10_000) {
  let time = start;
  let next = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => time,
    setTimer: (run: () => void, ms: number) => {
      const id = next++;
      timers.set(id, { at: time + ms, run });
      return id;
    },
    clearTimer: (id: unknown) => void timers.delete(id as number),
    pending: () => [...timers.values()].map((timer) => timer.at - time).sort((a, b) => a - b),
    /** Moves the clock, running every timer that falls due on the way. */
    advance(ms: number) {
      const until = time + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        time = due[1].at;
        due[1].run();
      }
      time = until;
    },
  };
}

type Call = { path: string; method: string; body?: { concepts: Record<string, ConceptProgress> } };

function fakeServer(initial: ProgressState = EMPTY_PROGRESS) {
  let stored = initial;
  const calls: Call[] = [];
  let failWith: 'offline' | 'gone' | 'rejected' | 'not-found' | null = null;
  let onGone: (() => void) | null = null;
  const request: SyncRequest = async <T>(path: string, init: { method?: string; body?: unknown } = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ path, method, body: init.body as Call['body'] });
    if (failWith === 'offline') return { ok: false, status: 0, reason: 'offline' } as ApiResult<T>;
    if (failWith === 'rejected') return { ok: false, status: 422, reason: 'rejected' } as ApiResult<T>;
    // A wrong API address or a proxy in the way: not about the body, so it is retried.
    if (failWith === 'not-found') return { ok: false, status: 404, reason: 'server' } as ApiResult<T>;
    if (failWith === 'gone') {
      // useAccount().request signs out before it returns a 410.
      onGone?.();
      return { ok: false, status: 410, reason: 'gone' } as ApiResult<T>;
    }
    if (method === 'POST') stored = mergeProgress(stored, { concepts: (init.body as { concepts: ProgressState['concepts'] }).concepts });
    return { ok: true, status: 200, data: JSON.parse(JSON.stringify({ concepts: stored.concepts })) as T };
  };
  return {
    request,
    calls,
    get progress() {
      return stored;
    },
    fail(reason: typeof failWith, gone?: () => void) {
      failWith = reason;
      onGone = gone ?? null;
    },
  };
}

/** Lets the awaited fake requests and their follow-ups finish. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function device({
  storage = fakeStorage(),
  clock = fakeClock(),
  accountHere = false,
  warn,
}: {
  storage?: ReturnType<typeof fakeStorage>;
  clock?: ReturnType<typeof fakeClock>;
  accountHere?: boolean;
  warn?: (message: string) => void;
} = {}) {
  const sync = createProgressSync({
    storage,
    merged: {},
    allSlugs: ALL,
    accountHere,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    warn,
  });
  return { sync, storage, clock };
}

const view = (state: ProgressState) => progressView(state);
const doneOf = (state: ProgressState) => Object.keys(view(state).completed).sort();
const outboxOf = (storage: ReturnType<typeof fakeStorage>) => parseOutbox(storage.get(OUTBOX_KEY)).sort();

function markDone(sync: ReturnType<typeof createProgressSync>, slug: string) {
  sync.change((state, now) => toggleDone(state, slug, now));
}

// ---------------------------------------------------------------------------
// The outbox: every change is saved in the browser first, and what changed is
// remembered until the server has it.

test('a change is saved in the browser at once and its Concept goes into a persisted outbox', () => {
  const { sync, storage, clock } = device({ accountHere: true });

  markDone(sync, 'caching');

  assert.deepEqual(doneOf(sync.getState()), ['caching']);
  assert.equal(storage.get(PROGRESS_KEY), serializeProgress(sync.getState()));
  assert.deepEqual(outboxOf(storage), ['caching']);

  // A reload (a new tab, a restart) finds both again.
  const reloaded = device({ storage, clock, accountHere: true });
  assert.deepEqual(doneOf(reloaded.sync.getState()), ['caching']);
  assert.deepEqual(outboxOf(storage), ['caching']);
});

test('opening a Concept again is not a change and sends nothing', () => {
  const { sync, storage } = device({ accountHere: true });
  sync.change((state, now) => markVisited(state, 'caching', now));
  storage.remove(OUTBOX_KEY);

  sync.change((state, now) => markVisited(state, 'caching', now));

  assert.deepEqual(outboxOf(storage), []);
});

test('only the changed Concepts are sent, after a short pause, and the answer is merged in', async () => {
  const laptop = recordQuiz(EMPTY_PROGRESS, 'sharding', 9, 10, 500);
  const server = fakeServer(laptop);
  const { sync, storage, clock } = device({ accountHere: true });
  sync.start(server.request);
  await settle();
  server.calls.length = 0;

  markDone(sync, 'caching');
  sync.change((state, now) => markVisited(state, 'queues', now));
  assert.equal(server.calls.length, 0, 'nothing is sent while the Learner is still clicking');

  clock.advance(PUSH_DELAY_MS);
  await settle();

  assert.equal(server.calls.length, 1);
  assert.equal(server.calls[0].method, 'POST');
  assert.deepEqual(Object.keys(server.calls[0].body!.concepts).sort(), ['caching', 'queues']);
  assert.deepEqual(doneOf(sync.getState()), ['caching', 'sharding']);
  assert.deepEqual(outboxOf(storage), []);
});

test('a Concept changed again while its save was on the way stays in the outbox and is sent next', async () => {
  const server = fakeServer();
  const { sync, storage, clock } = device({ accountHere: true });
  sync.start(server.request);
  await settle();

  markDone(sync, 'caching');
  markDone(sync, 'sharding');
  clock.advance(PUSH_DELAY_MS);
  // The POST is on its way; the Learner un-marks caching before it answers.
  clock.advance(1);
  markDone(sync, 'caching');
  await settle();

  assert.deepEqual(outboxOf(storage), ['caching'], 'sharding is confirmed, caching changed after it was sent');
  assert.deepEqual(doneOf(sync.getState()), ['sharding'], 'the answer does not undo the newer un-mark');

  clock.advance(PUSH_DELAY_MS);
  await settle();
  assert.deepEqual(outboxOf(storage), []);
  assert.deepEqual(doneOf(server.progress), ['sharding']);
});

test('offline: the change is kept, retried later with backoff, and sent as soon as the browser is back online', async () => {
  const server = fakeServer();
  const { sync, storage, clock } = device({ accountHere: true });
  sync.start(server.request);
  await settle();
  server.fail('offline');

  sync.change((state, now) => recordQuiz(state, 'caching', 8, 10, now));
  clock.advance(PUSH_DELAY_MS);
  await settle();
  assert.deepEqual(outboxOf(storage), ['caching']);
  assert.deepEqual(clock.pending(), [retryDelay(1)]);

  clock.advance(retryDelay(1));
  await settle();
  assert.deepEqual(clock.pending(), [retryDelay(2)], 'each failure waits longer');

  server.fail(null);
  sync.wake(); // the `online` event
  await settle();

  assert.deepEqual(outboxOf(storage), []);
  assert.deepEqual(view(server.progress).quiz, { caching: { correct: 8, total: 10, at: 10_000 } });
  assert.deepEqual(doneOf(server.progress), ['caching']);
  assert.deepEqual(clock.pending(), [], 'no retry left once it went through');
});

test('the backoff grows and stops growing at five minutes', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(retryDelay), [5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000]);
});

test('a record the server can never take is dropped from the outbox instead of being resent forever', async () => {
  const server = fakeServer();
  const storage = fakeStorage({
    [PROGRESS_KEY]: JSON.stringify({
      version: 2,
      concepts: {
        'Not A Slug': { done: true, doneAt: 1, changedAt: 1 },
        caching: { done: true, doneAt: 1.5, changedAt: 2 },
        sharding: { done: true, doneAt: 3, changedAt: 3 },
      },
    }),
    [OUTBOX_KEY]: JSON.stringify(['Not A Slug', 'caching', 'sharding', 'gone-from-this-device']),
  });
  const { sync } = device({ storage, accountHere: true });

  sync.start(server.request);
  await settle();

  assert.deepEqual(Object.keys(server.calls[0].body!.concepts), ['sharding']);
  assert.deepEqual(outboxOf(storage), []);

  // And a 422 for a record that looked fine drops what was sent.
  server.fail('rejected');
  markDone(sync, 'queues');
  await sync.syncNow();
  assert.deepEqual(outboxOf(storage), []);
});

// ---------------------------------------------------------------------------
// Signing in and opening the app.

test('opening the app signed in pulls the Account progress and merges it', async () => {
  const server = fakeServer(toggleDone(EMPTY_PROGRESS, 'sharding', 500));
  const storage = fakeStorage({ [PROGRESS_KEY]: serializeProgress(toggleDone(EMPTY_PROGRESS, 'caching', 400)) });
  const { sync } = device({ storage, accountHere: true });

  sync.start(server.request);
  await settle();

  assert.deepEqual(server.calls.map((call) => call.method), ['GET']);
  assert.deepEqual(doneOf(sync.getState()), ['caching', 'sharding']);
});

test('signing in on the phone: 10 Done in the Account and 5 others here as a Guest give 15 Done on both', async () => {
  const tens = Array.from({ length: 10 }, (_, index) => `laptop-${index}`);
  const fives = Array.from({ length: 5 }, (_, index) => `phone-${index}`);
  let account = EMPTY_PROGRESS;
  for (const slug of tens) account = toggleDone(account, slug, 1_000);
  const server = fakeServer(account);
  const phone = device();
  for (const slug of fives) markDone(phone.sync, slug);

  phone.sync.start(server.request);
  await settle();

  assert.equal(doneOf(phone.sync.getState()).length, 15);
  assert.equal(doneOf(server.progress).length, 15);
  assert.deepEqual(outboxOf(phone.storage), []);

  // The laptop gets them at its next sync.
  const laptop = device({ storage: fakeStorage({ [PROGRESS_KEY]: serializeProgress(account) }), accountHere: true });
  laptop.sync.start(server.request);
  await settle();
  assert.equal(doneOf(laptop.sync.getState()).length, 15);
});

test('un-marking on the phone un-marks on the laptop at its next sync', async () => {
  const server = fakeServer();
  const phone = device({ accountHere: true });
  const laptop = device({ clock: fakeClock(20_000), accountHere: true });
  phone.sync.start(server.request);
  laptop.sync.start(server.request);
  await settle();

  markDone(laptop.sync, 'caching');
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  assert.deepEqual(doneOf(phone.sync.getState()), ['caching']);

  phone.clock.advance(20_000);
  markDone(phone.sync, 'caching');
  await phone.sync.syncNow();
  await laptop.sync.syncNow();

  assert.deepEqual(doneOf(laptop.sync.getState()), []);
});

test('a higher Quiz score replaces a lower one on the other device, a lower one never does', async () => {
  const server = fakeServer();
  const phone = device({ accountHere: true });
  const laptop = device({ accountHere: true });
  phone.sync.start(server.request);
  laptop.sync.start(server.request);
  await settle();

  laptop.sync.change((state, now) => recordQuiz(state, 'caching', 6, 10, now));
  await laptop.sync.syncNow();
  phone.clock.advance(1_000);
  phone.sync.change((state, now) => recordQuiz(state, 'caching', 9, 10, now));
  await phone.sync.syncNow();
  await laptop.sync.syncNow();
  assert.equal(view(laptop.sync.getState()).quiz.caching.correct, 9);

  laptop.clock.advance(5_000);
  laptop.sync.change((state, now) => recordQuiz(state, 'caching', 4, 10, now));
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  assert.equal(view(phone.sync.getState()).quiz.caching.correct, 9);
});

test('the wake-up after a while away pulls, a quick one does not', async () => {
  const server = fakeServer();
  const { sync, clock } = device({ accountHere: true });
  sync.start(server.request);
  await settle();

  sync.wake();
  await settle();
  assert.equal(server.calls.length, 1, 'just synced: nothing to do');

  clock.advance(60_000);
  sync.wake();
  await settle();
  assert.equal(server.calls.length, 2);
});

// ---------------------------------------------------------------------------
// Two tabs of one browser share its storage.

test('two tabs changing different Concepts both end up saved', async () => {
  const storage = fakeStorage();
  const server = fakeServer();
  const tabA = device({ storage, accountHere: true });
  const tabB = device({ storage, clock: tabA.clock, accountHere: true });

  // Neither tab has heard of the other's change yet when it saves its own.
  markDone(tabA.sync, 'caching');
  markDone(tabB.sync, 'sharding');

  const saved = JSON.parse(storage.get(PROGRESS_KEY)!) as ProgressState;
  assert.deepEqual(doneOf(saved), ['caching', 'sharding']);
  assert.deepEqual(outboxOf(storage), ['caching', 'sharding']);

  // The storage event then shows the other tab's change.
  tabA.sync.storageChanged(PROGRESS_KEY, storage.get(PROGRESS_KEY));
  assert.deepEqual(doneOf(tabA.sync.getState()), ['caching', 'sharding']);

  tabA.sync.start(server.request);
  await settle();
  assert.deepEqual(doneOf(server.progress), ['caching', 'sharding']);
  assert.deepEqual(outboxOf(storage), []);
});

test('a tab does not confirm a Concept that another tab changed after the save was sent', async () => {
  const storage = fakeStorage();
  const server = fakeServer();
  const tabA = device({ storage, accountHere: true });
  const tabB = device({ storage, clock: tabA.clock, accountHere: true });
  tabA.sync.start(server.request);
  await settle();

  markDone(tabA.sync, 'caching');
  const sending = tabA.sync.syncNow();
  tabA.clock.advance(1);
  markDone(tabB.sync, 'caching'); // tab B un-marks while tab A's POST is on the way
  await sending;

  assert.deepEqual(outboxOf(storage), ['caching']);
  assert.deepEqual(doneOf(tabA.sync.getState()), []);
});

test('emptied in another tab (a sign-out or a Guest Reset) empties this tab instead of being saved back', () => {
  const storage = fakeStorage();
  const tabA = device({ storage });
  const tabB = device({ storage, clock: tabA.clock });
  markDone(tabA.sync, 'caching');
  tabB.sync.storageChanged(PROGRESS_KEY, storage.get(PROGRESS_KEY));

  tabA.sync.reset(false);
  tabB.sync.storageChanged(PROGRESS_KEY, storage.get(PROGRESS_KEY));
  assert.deepEqual(tabB.sync.getState(), EMPTY_PROGRESS);

  markDone(tabB.sync, 'caching');
  tabA.sync.storageChanged(PROGRESS_KEY, storage.get(PROGRESS_KEY));
  assert.deepEqual(doneOf(tabA.sync.getState()), ['caching']);
  storage.remove(PROGRESS_KEY);
  tabA.sync.storageChanged(PROGRESS_KEY, null);
  assert.deepEqual(tabA.sync.getState(), EMPTY_PROGRESS);
});

// ---------------------------------------------------------------------------
// Reset, signing out, and a deleted Account.

test('a signed-in Reset clears every Concept on the Account and on the other devices', async () => {
  const server = fakeServer();
  const phone = device({ accountHere: true });
  const laptop = device({ accountHere: true });
  phone.sync.start(server.request);
  laptop.sync.start(server.request);
  await settle();
  laptop.sync.change((state, now) => recordQuiz(markVisited(state, 'caching', now), 'caching', 9, 10, now));
  await laptop.sync.syncNow();

  phone.clock.advance(5_000);
  phone.sync.reset(true);
  assert.deepEqual(outboxOf(phone.storage), [...ALL].sort(), 'a cleared record for every Concept of the app');
  await phone.sync.syncNow();
  await laptop.sync.syncNow();

  assert.deepEqual(view(laptop.sync.getState()), { visited: {}, completed: {}, quiz: {} });

  // Progress made after the Reset, on any device, is kept.
  laptop.clock.advance(10_000);
  markDone(laptop.sync, 'sharding');
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  assert.deepEqual(doneOf(phone.sync.getState()), ['sharding']);
});

test('a device that was offline during the Reset does not bring the old progress back', async () => {
  const old = recordQuiz(markVisited(EMPTY_PROGRESS, 'caching', 1_000), 'caching', 9, 10, 2_000);
  const server = fakeServer(old);
  const offline = device({ storage: fakeStorage({ [PROGRESS_KEY]: serializeProgress(old), [OUTBOX_KEY]: '["caching"]' }), accountHere: true });
  const phone = device({ storage: fakeStorage({ [PROGRESS_KEY]: serializeProgress(old) }), accountHere: true });
  phone.sync.start(server.request);
  await settle();
  phone.sync.reset(true);
  await phone.sync.syncNow();

  offline.sync.start(server.request); // back online, still holding the old caching record in its outbox
  await settle();

  assert.deepEqual(view(offline.sync.getState()), { visited: {}, completed: {}, quiz: {} });
  assert.deepEqual(view(server.progress), { visited: {}, completed: {}, quiz: {} });
});

test('a Guest Reset empties this browser, exactly as before for the Learner, and leaves no cleared record behind', () => {
  const { sync, storage } = device();
  markDone(sync, 'caching');

  sync.reset(false);

  assert.deepEqual(sync.getState(), EMPTY_PROGRESS);
  assert.deepEqual(JSON.parse(storage.get(PROGRESS_KEY)!).concepts, {});
  assert.deepEqual(outboxOf(storage), []);
});

test('a Guest who reset and then signs in does not wipe the Account - nothing is lost', async () => {
  const account = recordQuiz(markVisited(toggleDone(EMPTY_PROGRESS, 'caching', 1_000), 'caching', 1_000), 'caching', 9, 10, 1_500);
  const server = fakeServer(account);
  // Cleared records left by a Guest Reset of an older version, then new progress on another Concept.
  // An open tab of an older version writes them after this tab loaded, so they reach the moment of sign-in.
  const guest = markVisited(resetProgress(EMPTY_PROGRESS, ALL, 5_000), 'sharding', 6_000);
  const phone = device();
  phone.storage.set(PROGRESS_KEY, serializeProgress(guest));
  phone.sync.storageChanged(PROGRESS_KEY, phone.storage.get(PROGRESS_KEY));
  assert.equal(phone.sync.getState().concepts.caching.clearedAt, 5_000);

  phone.sync.start(server.request);
  await settle();

  const expected = { visited: { caching: 1_000, sharding: 6_000 }, completed: { caching: true as const }, quiz: { caching: { correct: 9, total: 10, at: 1_500 } } };
  assert.deepEqual(view(server.progress), expected);
  assert.deepEqual(view(phone.sync.getState()), expected);
});

test('forgetResets drops the cleared times and the un-marks a Reset made, and keeps what came after', () => {
  let state = resetProgress(toggleDone(EMPTY_PROGRESS, 'queues', 1_000), ALL, 5_000);
  state = markVisited(state, 'caching', 6_000);
  state = recordQuiz(state, 'sharding', 8, 10, 7_000);
  state = toggleDone(toggleDone(state, 'replication', 8_000), 'replication', 9_000);

  assert.deepEqual(forgetResets(state).concepts, {
    caching: { done: false, doneAt: 0, changedAt: 6_000, visitedAt: 6_000 },
    sharding: { done: true, doneAt: 7_000, changedAt: 7_000, quiz: { correct: 8, total: 10, at: 7_000 } },
    // Un-marked by the Learner after the Reset: that un-mark still counts.
    replication: { done: false, doneAt: 9_000, changedAt: 9_000 },
  });
  const plain = markVisited(EMPTY_PROGRESS, 'caching', 1);
  assert.equal(forgetResets(plain).concepts.caching, plain.concepts.caching);
});

test('a Guest browser drops leftover cleared records when it loads; an Account browser keeps them', () => {
  const saved = serializeProgress(markVisited(resetProgress(EMPTY_PROGRESS, ALL, 5_000), 'caching', 6_000));

  const guest = device({ storage: fakeStorage({ [PROGRESS_KEY]: saved }) });
  const account = device({ storage: fakeStorage({ [PROGRESS_KEY]: saved }), accountHere: true });

  assert.deepEqual(Object.keys(guest.sync.getState().concepts), ['caching']);
  assert.equal(guest.sync.getState().concepts.caching.clearedAt, undefined);
  assert.equal(Object.keys(account.sync.getState().concepts).length, ALL.length);
});

test('signing out empties the progress and the outbox, and stops syncing; theme and panels stay', async () => {
  const server = fakeServer();
  const storage = fakeStorage({ 'sdi:theme': 'light', 'sdi:layout': '{}', [LEGACY_PROGRESS_KEY]: '{}' });
  const { sync, clock } = device({ storage, accountHere: true });
  sync.start(server.request);
  await settle();
  server.fail('offline');
  markDone(sync, 'caching');
  clock.advance(PUSH_DELAY_MS);
  await settle();

  sync.signedOut();

  assert.deepEqual(sync.getState(), EMPTY_PROGRESS);
  assert.deepEqual([...storage.data.keys()].sort(), ['sdi:layout', 'sdi:theme']);
  const calls = server.calls.length;
  clock.advance(10 * 60_000);
  await settle();
  assert.equal(server.calls.length, calls, 'no retry after signing out');
});

test('a 410 during a save signs out to an empty Guest and nothing is resent', async () => {
  const server = fakeServer();
  const { sync, storage, clock } = device({ accountHere: true });
  sync.start(server.request);
  await settle();
  server.fail('gone', () => sync.signedOut());

  markDone(sync, 'caching');
  clock.advance(PUSH_DELAY_MS);
  await settle();

  assert.deepEqual(sync.getState(), EMPTY_PROGRESS);
  assert.equal(storage.get(OUTBOX_KEY), null);
  assert.deepEqual(clock.pending(), []);
  const calls = server.calls.length;
  sync.wake();
  clock.advance(10 * 60_000);
  await settle();
  assert.equal(server.calls.length, calls);
});

test('an answer that arrives after signing out is not written into the empty Guest', async () => {
  const server = fakeServer(toggleDone(EMPTY_PROGRESS, 'sharding', 1));
  const { sync, storage } = device({ accountHere: true });
  sync.start(server.request); // the pull is on its way

  sync.signedOut();
  await settle();

  assert.deepEqual(sync.getState(), EMPTY_PROGRESS);
  assert.equal(storage.get(PROGRESS_KEY), null);
});

test('a 410 while pulling at start leaves an empty Guest too', async () => {
  const server = fakeServer();
  const storage = fakeStorage({ [PROGRESS_KEY]: serializeProgress(toggleDone(EMPTY_PROGRESS, 'caching', 1)) });
  const { sync, clock } = device({ storage, accountHere: true });
  server.fail('gone', () => sync.signedOut());

  sync.start(server.request);
  await settle();

  assert.deepEqual(sync.getState(), EMPTY_PROGRESS);
  assert.deepEqual(clock.pending(), []);
});

test('changes made before signing in again are sent once the new session starts', async () => {
  const server = fakeServer();
  const { sync, storage } = device({ accountHere: true });
  // Restoring, or the sign-in SDK could not load: not syncing, but the changes wait in the outbox.
  markDone(sync, 'caching');
  assert.deepEqual(outboxOf(storage), ['caching']);

  sync.start(server.request);
  await settle();
  assert.deepEqual(doneOf(server.progress), ['caching']);
});

test('a start, stop and start (React StrictMode) still syncs once the answers settle', async () => {
  const server = fakeServer();
  const { sync, storage } = device({ accountHere: true });
  markDone(sync, 'caching');

  sync.start(server.request);
  sync.stop();
  sync.start(server.request);
  await settle();
  await settle();

  assert.deepEqual(doneOf(server.progress), ['caching']);
  assert.deepEqual(outboxOf(storage), []);
});

test('the outbox survives broken storage values', () => {
  assert.deepEqual(parseOutbox(null), []);
  assert.deepEqual(parseOutbox('{not json'), []);
  assert.deepEqual(parseOutbox('{"a":1}'), []);
  assert.deepEqual(parseOutbox('["caching", 3, "caching", null, "sharding"]'), ['caching', 'sharding']);
});

test('a wake-up during a save that the server refused is not lost', async () => {
  const server = fakeServer();
  const { sync, clock } = device({ accountHere: true });
  sync.start(server.request);
  await settle();

  server.fail('rejected');
  markDone(sync, 'queues');
  const refused = sync.syncNow();
  sync.flush();
  await refused;

  assert.equal(clock.pending().length, 1);
});

test('an answer that is not about the body (a 404 from a wrong address) is retried, and said once in the console', async () => {
  const server = fakeServer();
  const warnings: string[] = [];
  const { sync, storage, clock } = device({ accountHere: true, warn: (message) => warnings.push(message) });
  server.fail('not-found');
  markDone(sync, 'caching');
  sync.start(server.request);
  await settle();
  clock.advance(retryDelay(1));
  await settle();

  assert.equal(server.calls.length, 2);
  assert.deepEqual(outboxOf(storage), ['caching']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /404/);
});

test('a tab that loaded as a Guest and follows a sign-in from another tab treats the progress as the Account one', async () => {
  // The other tab signed in, pulled the Account (with its Reset) and saved it to the shared storage.
  const account = resetProgress(EMPTY_PROGRESS, ALL, 5_000);
  const server = fakeServer(account);
  const storage = fakeStorage({ [PROGRESS_KEY]: serializeProgress(account) });
  const { sync } = device({ storage, accountHere: false });

  sync.start(server.request, { restored: true });
  await settle();

  assert.equal(sync.getState().concepts.caching.clearedAt, 5_000);
  assert.deepEqual(server.calls.map((call) => call.method), ['GET']);
});
