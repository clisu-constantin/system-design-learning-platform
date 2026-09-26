/**
 * Progress on this device, and its sync with the Account (docs/adr/0001).
 *
 * Local-first: every change is saved in localStorage at once, and the slug of
 * each Concept it touched goes into an outbox that is saved next to it, so it
 * survives a reload and a day offline. In the background, and only while
 * signed in, the outbox Concepts are sent to `POST /progress`; the answer is
 * the whole merged progress of the Account, which is merged in here too. A
 * Concept leaves the outbox only when the record that was sent is still the
 * one saved, so a change made while the request was on its way is sent next.
 * Every merge uses `mergeProgress`, the same rules as the server.
 *
 * Tabs of one browser share the storage: each save reads the saved progress
 * and merges into it instead of overwriting it, and the `storage` event shows
 * the other tab's change here. Theme and folded panels live under other keys
 * and are never sent.
 *
 * No React and no browser globals: storage, clock, timers and the request are
 * passed in, so Node runs this file and its tests as they are.
 */
import type { ApiResult } from '../account/api.ts';
import { EMPTY_PROGRESS, mergeProgress, parseProgress, resetProgress, serializeProgress } from './progressState.ts';
import type { ConceptProgress, ProgressState } from './progressState.ts';

export const PROGRESS_KEY = 'sdi:progress:v2';
/** The format before change times. Read once to migrate, removed once the new format is saved. */
export const LEGACY_PROGRESS_KEY = 'sdi:progress:v1';
/** The slugs changed on this device that the server has not confirmed yet. */
export const OUTBOX_KEY = 'sdi:progress:outbox';

/** A change waits this long for the next one, so a burst of clicks is one request. */
export const PUSH_DELAY_MS = 2_000;
/** Coming back to the tab after this long pulls the progress made on other devices. */
export const PULL_AFTER_MS = 60_000;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
/** The most Concepts the server takes in one request. */
const MAX_BATCH = 1_000;
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const MAX_COUNT = 1_000_000;

export interface SyncStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface SyncRequestInit {
  method?: 'GET' | 'POST';
  body?: unknown;
}

/** `useAccount().request`: never throws, and a 410 has signed out before it returns. */
export type SyncRequest = <T>(path: string, init?: SyncRequestInit) => Promise<ApiResult<T>>;

export interface ProgressSyncOptions {
  storage: SyncStorage;
  /** Retired slug -> the Concept it was merged into (MERGED_CONCEPTS). */
  merged: Readonly<Record<string, string>>;
  /** Every Concept of the app: a Reset clears them all, even those never opened here. */
  allSlugs: readonly string[];
  /** This browser holds the progress of an Account (the `sdi:account` mark), not of a Guest. */
  accountHere: boolean;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
  /** Where a sync that keeps failing for a reason a retry will not fix is reported (the console). */
  warn?: (message: string) => void;
}

/** 5 s, 10 s, 20 s ... up to 5 minutes between attempts while the server cannot be reached. */
export function retryDelay(failures: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, failures - 1), RETRY_MAX_MS);
}

/** The saved outbox, or none: storage is outside our control. */
export function parseOutbox(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((slug): slug is string => typeof slug === 'string'))];
  } catch {
    return [];
  }
}

/**
 * The records of a Guest without the "cleared at" times of their Resets, and
 * without the un-marks those Resets made. A Guest Reset had no other device
 * to reach, so when that Guest signs in it must not wipe the progress of the
 * Account - nothing is lost. What the Learner did after the Reset stays,
 * including an un-mark of their own; a record left with nothing is dropped.
 */
export function forgetResets(state: ProgressState): ProgressState {
  const concepts: Record<string, ConceptProgress> = {};
  for (const [slug, record] of Object.entries(state.concepts)) {
    if (record.clearedAt === undefined) {
      concepts[slug] = record;
      continue;
    }
    const unmarkedByReset = !record.done && record.doneAt <= record.clearedAt;
    const kept: ConceptProgress = { done: record.done, doneAt: unmarkedByReset ? 0 : record.doneAt, changedAt: record.changedAt };
    if (record.visitedAt !== undefined) kept.visitedAt = record.visitedAt;
    if (record.quiz) kept.quiz = record.quiz;
    if (kept.done || kept.doneAt > 0 || kept.visitedAt !== undefined || kept.quiz) concepts[slug] = kept;
  }
  return { concepts };
}

function sameRecord(a: ConceptProgress | undefined, b: ConceptProgress | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.done === b.done &&
    a.doneAt === b.doneAt &&
    a.changedAt === b.changedAt &&
    a.visitedAt === b.visitedAt &&
    a.clearedAt === b.clearedAt &&
    a.quiz?.correct === b.quiz?.correct &&
    a.quiz?.total === b.quiz?.total &&
    a.quiz?.at === b.quiz?.at
  );
}

function sameState(a: ProgressState, b: ProgressState): boolean {
  const keys = Object.keys(a.concepts);
  return keys.length === Object.keys(b.concepts).length && keys.every((slug) => sameRecord(a.concepts[slug], b.concepts[slug]));
}

const changedSlugs = (before: ProgressState, after: ProgressState) =>
  Object.keys(after.concepts).filter((slug) => !sameRecord(before.concepts[slug], after.concepts[slug]));

const isTime = (value: number | undefined) => value === undefined || (Number.isSafeInteger(value) && value >= 0);
const isCount = (value: number, min: number) => Number.isSafeInteger(value) && value >= min && value <= MAX_COUNT;

/** What the server validates (server/app/schemas.py): anything else is a 422 for the whole request. */
function sendable(slug: string, record: ConceptProgress): boolean {
  const { quiz } = record;
  return (
    SLUG.test(slug) &&
    isTime(record.doneAt) &&
    isTime(record.changedAt) &&
    isTime(record.visitedAt) &&
    isTime(record.clearedAt) &&
    (!quiz || (isCount(quiz.correct, 0) && isCount(quiz.total, 1) && isTime(quiz.at)))
  );
}

export function createProgressSync(options: ProgressSyncOptions) {
  const { storage, merged, allSlugs } = options;
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
  const clearTimer = options.clearTimer ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  const warn = options.warn ?? (() => undefined);

  const parse = (raw: string | null) => parseProgress({ current: raw, legacy: null }, merged);

  function write(next: ProgressState) {
    // Storage can be unavailable (private mode): progress then lives in memory for this visit.
    const saved = serializeProgress(next);
    storage.set(PROGRESS_KEY, saved);
    // Only once the new format is really stored, or a full storage would lose the old copy.
    if (storage.get(PROGRESS_KEY) === saved) storage.remove(LEGACY_PROGRESS_KEY);
  }

  let accountHere = options.accountHere;
  let state = parseProgress({ current: storage.get(PROGRESS_KEY), legacy: storage.get(LEGACY_PROGRESS_KEY) }, merged);
  if (!accountHere) state = forgetResets(state);
  write(state);

  const listeners = new Set<() => void>();
  function show(next: ProgressState) {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  }

  /** This tab's progress merged with what other tabs saved since. */
  const latest = () => mergeProgress(parse(storage.get(PROGRESS_KEY)), state);

  // The outbox is kept in memory too, so a browser that cannot store it still syncs this visit.
  const memoryOutbox = new Set<string>();
  const outbox = () => [...new Set([...parseOutbox(storage.get(OUTBOX_KEY)), ...memoryOutbox])];
  function saveOutbox(slugs: string[]) {
    if (slugs.length) storage.set(OUTBOX_KEY, JSON.stringify(slugs));
    else storage.remove(OUTBOX_KEY);
  }
  function addToOutbox(slugs: string[]) {
    if (!slugs.length) return;
    for (const slug of slugs) memoryOutbox.add(slug);
    saveOutbox(outbox());
  }
  function removeFromOutbox(slugs: string[]) {
    if (!slugs.length) return;
    const drop = new Set(slugs);
    for (const slug of slugs) memoryOutbox.delete(slug);
    saveOutbox(parseOutbox(storage.get(OUTBOX_KEY)).filter((slug) => !drop.has(slug)));
  }
  function emptyOutbox() {
    memoryOutbox.clear();
    storage.remove(OUTBOX_KEY);
  }

  // ---- The sync, while signed in ------------------------------------------

  let request: SyncRequest | null = null;
  /** Bumped by every start and stop: an answer to an older session is not applied. */
  let session = 0;
  let inFlight = false;
  let again = false;
  let failures = 0;
  let lastSync = -Infinity;
  let timer: unknown = null;
  /** A 4xx that is not about the body is said once, not at every retry. */
  let warned = false;

  function cancelTimer() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  function schedule(ms: number) {
    cancelTimer();
    timer = setTimer(() => {
      timer = null;
      void syncNow();
    }, ms);
  }

  function schedulePush() {
    if (!request) return;
    // While the server cannot be reached, a new change does not cut the backoff short.
    if (failures > 0 && timer !== null) return;
    schedule(PUSH_DELAY_MS);
  }

  /** Sends the outbox, or pulls when it is empty; either way the answer is all the Account progress. */
  async function syncNow(): Promise<void> {
    const send = request;
    if (!send) return;
    if (inFlight) {
      again = true;
      return;
    }
    cancelTimer();
    const mine = session;
    const current = latest();
    show(sameState(current, state) ? state : current);

    const batch: Record<string, ConceptProgress> = {};
    const drop: string[] = [];
    let size = 0;
    for (const slug of outbox()) {
      const record = current.concepts[slug];
      if (!record || !sendable(slug, record)) drop.push(slug);
      else if (size < MAX_BATCH) {
        batch[slug] = record;
        size += 1;
      }
    }
    removeFromOutbox(drop);
    const sent = Object.keys(batch);

    inFlight = true;
    again = false;
    const result = sent.length
      ? await send<{ concepts?: unknown }>('/progress', { method: 'POST', body: { concepts: batch } })
      : await send<{ concepts?: unknown }>('/progress');
    inFlight = false;

    // Signed out meanwhile (a 410 signs out before its answer arrives), or restarted.
    if (mine !== session) {
      if (request) void syncNow();
      return;
    }

    if (result.ok) {
      failures = 0;
      lastSync = now();
      const base = latest();
      const confirmed = sent.filter((slug) => sameRecord(base.concepts[slug], batch[slug]));
      const account = parse(serializeProgress({ concepts: (result.data?.concepts ?? {}) as Record<string, ConceptProgress> }));
      const next = mergeProgress(base, account);
      write(next);
      show(sameState(next, state) ? state : next);
      removeFromOutbox(confirmed);
      if (again || outbox().length) schedule(PUSH_DELAY_MS);
    } else if (result.reason === 'rejected') {
      // A 4xx for the body: sending the same records again cannot succeed.
      removeFromOutbox(sent);
      if (again || outbox().length) schedule(PUSH_DELAY_MS);
    } else if (result.reason !== 'gone' && result.reason !== 'unavailable') {
      // A 401, 403 or 404 here usually means a wrong API address or Firebase project. It is retried
      // like an outage (a proxy can recover), but said once, so the mistake does not stay invisible.
      if (!warned && result.status >= 400 && result.status < 500) {
        warned = true;
        warn(`Progress sync: the API answered ${result.status}. Progress stays saved in this browser; retrying later.`);
      }
      failures += 1;
      schedule(retryDelay(failures));
    }
  }

  /** A change by the Learner: saved at once, sent in the background. */
  function change(update: (current: ProgressState, now: number) => ProgressState) {
    const base = latest();
    const next = update(base, now());
    if (next === base) {
      show(sameState(base, state) ? state : base);
      return;
    }
    write(next);
    addToOutbox(changedSlugs(base, next));
    show(next);
    schedulePush();
  }

  function stop() {
    request = null;
    session += 1;
    again = false;
    cancelTimer();
  }

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    change,

    /**
     * With an Account, a Reset is a "cleared at" record per Concept, sent like
     * any change, so it wins on every device. A Guest has no other device to
     * reach: their Reset empties this browser, and leaves no record that could
     * wipe an Account they sign in to later.
     */
    reset(everywhere: boolean) {
      if (everywhere) {
        change((current, time) => resetProgress(current, allSlugs, time));
        return;
      }
      write(EMPTY_PROGRESS);
      emptyOutbox();
      show(EMPTY_PROGRESS);
    },

    /** The `storage` event: another tab saved progress, or emptied it. */
    storageChanged(key: string | null, value: string | null) {
      if (key === null || key === PROGRESS_KEY) {
        const theirs = key === null ? EMPTY_PROGRESS : parse(value);
        // A sign-out or a Guest Reset in the other tab: empty here too, rather than save this copy back.
        if (!Object.keys(theirs.concepts).length) {
          show(EMPTY_PROGRESS);
          return;
        }
        const next = mergeProgress(theirs, state);
        show(sameState(next, state) ? state : next);
      } else if (key === OUTBOX_KEY && value) {
        schedulePush();
      }
    },

    /**
     * Signed in (or restored): sync now. From a Guest, all the progress of this
     * browser goes to the Account first, without the Guest's own Resets.
     * `restored`: the Account was already in this browser - a tab that loaded
     * as a Guest and followed a sign-in from another tab - so the stored
     * progress is the Account one, Resets included.
     */
    start(send: SyncRequest, { restored = false }: { restored?: boolean } = {}) {
      const fromGuest = !accountHere && !restored;
      accountHere = true;
      stop();
      request = send;
      failures = 0;
      if (fromGuest) {
        const guest = forgetResets(latest());
        write(guest);
        show(guest);
        addToOutbox(Object.keys(guest.concepts));
      }
      void syncNow();
    },

    /** Not signed in for now (the sign-in SDK is still loading or could not): changes wait in the outbox. */
    stop,

    /** The Account left this device: an empty Guest, with nothing left to send. */
    signedOut() {
      stop();
      accountHere = false;
      failures = 0;
      lastSync = -Infinity;
      storage.remove(PROGRESS_KEY);
      storage.remove(LEGACY_PROGRESS_KEY);
      emptyOutbox();
      show(EMPTY_PROGRESS);
    },

    /** Back online, or back on the tab: retry now, and pull if the last sync is old. */
    wake() {
      if (!request) return;
      if (failures > 0 || outbox().length || now() - lastSync >= PULL_AFTER_MS) void syncNow();
    },

    /** Leaving the tab: send what is waiting instead of waiting for the pause. */
    flush() {
      if (request && outbox().length) void syncNow();
    },

    syncNow,
  };
}

export type ProgressSync = ReturnType<typeof createProgressSync>;
