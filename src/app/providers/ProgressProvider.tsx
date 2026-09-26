import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CategoryId } from '@/types';
import { CONCEPTS, CONCEPTS_BY_CATEGORY } from '@/data/concepts';
import { MERGED_CONCEPTS } from '@/data/concepts/merged';
import { safeLocalStorage } from '@/utils/safeStorage';
import { useAccount } from './AccountProvider';
import * as progress from './progressState';
import type { ProgressState, ProgressView } from './progressState';

const STORAGE_KEY = 'sdi:progress:v2';
/** The format before change times. Read once to migrate, removed once the new format is saved. */
const LEGACY_STORAGE_KEY = 'sdi:progress:v1';

interface ProgressContextValue extends ProgressView {
  markVisited: (slug: string) => void;
  toggleCompleted: (slug: string) => void;
  recordQuiz: (slug: string, correct: number, total: number) => void;
  categoryProgress: (category: CategoryId) => { done: number; total: number; percent: number };
  overall: { done: number; total: number; percent: number };
  reset: () => void;
}

const ALL_SLUGS = CONCEPTS.map((concept) => concept.slug);

const ProgressContext = createContext<ProgressContextValue | null>(null);

function load(): ProgressState {
  return progress.parseProgress(
    { current: safeLocalStorage.get(STORAGE_KEY), legacy: safeLocalStorage.get(LEGACY_STORAGE_KEY) },
    MERGED_CONCEPTS,
  );
}

/**
 * Learning progress lives in localStorage; the rules for changing and merging
 * it are in progressState.ts. A concept counts as done when the learner marks
 * it complete or passes its quiz.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(load);
  const { onSignedOut } = useAccount();

  // Signing out leaves an empty Guest, so the next person on a shared computer
  // sees nothing. Emptied, not Reset: a Reset keeps "cleared at" records that a
  // later sign-in would sync to the Account and wipe it.
  useEffect(
    () =>
      onSignedOut(() => {
        safeLocalStorage.remove(STORAGE_KEY);
        safeLocalStorage.remove(LEGACY_STORAGE_KEY);
        setState(progress.EMPTY_PROGRESS);
      }),
    [onSignedOut],
  );

  useEffect(() => {
    // Storage can be unavailable (private mode) - progress is a nice-to-have.
    const saved = progress.serializeProgress(state);
    safeLocalStorage.set(STORAGE_KEY, saved);
    // Only once the new format is really stored, or a full storage would lose the old copy.
    if (safeLocalStorage.get(STORAGE_KEY) === saved) safeLocalStorage.remove(LEGACY_STORAGE_KEY);
  }, [state]);

  const markVisited = useCallback(
    (slug: string) => setState((current) => progress.markVisited(current, slug, Date.now())),
    [],
  );

  const toggleCompleted = useCallback(
    (slug: string) => setState((current) => progress.toggleDone(current, slug, Date.now())),
    [],
  );

  const recordQuiz = useCallback(
    (slug: string, correct: number, total: number) =>
      setState((current) => progress.recordQuiz(current, slug, correct, total, Date.now())),
    [],
  );

  const reset = useCallback(
    () => setState((current) => progress.resetProgress(current, ALL_SLUGS, Date.now())),
    [],
  );

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
      reset,
    };
  }, [view, markVisited, toggleCompleted, recordQuiz, reset]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used inside ProgressProvider');
  return context;
}
