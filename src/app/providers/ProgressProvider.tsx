import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { CategoryId } from '@/types';
import { CONCEPTS, CONCEPTS_BY_CATEGORY } from '@/data/concepts';
import { MERGED_CONCEPTS } from '@/data/concepts/merged';
import { ACCOUNT_MARK_KEY } from '@/app/account/accountState';
import { safeLocalStorage } from '@/utils/safeStorage';
import { useAccount } from './AccountProvider';
import * as progress from './progressState';
import type { ProgressView } from './progressState';
import { createProgressSync } from './progressSync';

interface ProgressContextValue extends ProgressView {
  markVisited: (slug: string) => void;
  toggleCompleted: (slug: string) => void;
  recordQuiz: (slug: string, correct: number, total: number) => void;
  categoryProgress: (category: CategoryId) => { done: number; total: number; percent: number };
  overall: { done: number; total: number; percent: number };
  /** The progress here belongs to an Account: it is synced, and a Reset clears it on every device. */
  synced: boolean;
  reset: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

const ALL_SLUGS = CONCEPTS.map((concept) => concept.slug);

const hasAccountMark = () => safeLocalStorage.get(ACCOUNT_MARK_KEY) !== null;

/** One per page, like the Account store: the rules are in progressSync.ts and progressState.ts. */
const sync = createProgressSync({
  storage: safeLocalStorage,
  merged: MERGED_CONCEPTS,
  allSlugs: ALL_SLUGS,
  accountHere: hasAccountMark(),
  // A sync that keeps failing for a reason a retry will not fix (a wrong API address) is said once.
  warn: (message) => console.warn(message),
});

const isLocalStorageEvent = (event: StorageEvent) => {
  try {
    return event.storageArea === window.localStorage;
  } catch {
    return false;
  }
};

/**
 * Learning progress: saved in localStorage first, and while signed in also
 * synced with the Account in the background (progressSync.ts). Nothing waits
 * for the server. A concept counts as done when the learner marks it complete
 * or passes its quiz.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  const { status, request, onSignedOut } = useAccount();
  // Restoring, or signed in here but the sign-in SDK could not load yet: still the Account's progress.
  const synced = status !== 'guest' || hasAccountMark();
  const previousStatus = useRef(status);

  // Signing out (or a 410) leaves an empty Guest, so the next person on a shared
  // computer sees nothing. Emptied, not Reset: a Reset keeps "cleared at"
  // records that a later sign-in would sync to the Account and wipe it.
  useEffect(() => onSignedOut(sync.signedOut), [onSignedOut]);

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = status;
    if (status !== 'signed-in') return;
    // Restoring means the Account was already in this browser (at start, or signed in by another
    // tab): its stored progress is the Account one, not a Guest one to hand over.
    sync.start(request, { restored: previous === 'restoring' });
    return sync.stop;
  }, [status, request]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (isLocalStorageEvent(event)) sync.storageChanged(event.key, event.newValue);
    };
    const onOnline = () => sync.wake();
    const onVisibility = () => (document.visibilityState === 'visible' ? sync.wake() : sync.flush());
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const markVisited = useCallback(
    (slug: string) => sync.change((current, now) => progress.markVisited(current, slug, now)),
    [],
  );

  const toggleCompleted = useCallback(
    (slug: string) => sync.change((current, now) => progress.toggleDone(current, slug, now)),
    [],
  );

  const recordQuiz = useCallback(
    (slug: string, correct: number, total: number) =>
      sync.change((current, now) => progress.recordQuiz(current, slug, correct, total, now)),
    [],
  );

  const reset = useCallback(() => sync.reset(synced), [synced]);

  const view = useMemo(() => progress.progressView(state), [state]);

  const value = useMemo<ProgressContextValue>(() => {
    const isDone = (slug: string) => Boolean(view.completed[slug]);

    const categoryProgress = (category: CategoryId) => {
      const concepts = CONCEPTS_BY_CATEGORY[category] ?? [];
      const done = concepts.filter((concept) => isDone(concept.slug)).length;
      const total = concepts.length;
      return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
    };

    const done = CONCEPTS.filter((concept) => isDone(concept.slug)).length;

    return {
      ...view,
      markVisited,
      toggleCompleted,
      recordQuiz,
      categoryProgress,
      overall: {
        done,
        total: CONCEPTS.length,
        percent: CONCEPTS.length ? Math.round((done / CONCEPTS.length) * 100) : 0,
      },
      synced,
      reset,
    };
  }, [view, markVisited, toggleCompleted, recordQuiz, synced, reset]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used inside ProgressProvider');
  return context;
}
