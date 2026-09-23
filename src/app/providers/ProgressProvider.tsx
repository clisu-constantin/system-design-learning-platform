import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CategoryId } from '@/types';
import { CONCEPTS, CONCEPTS_BY_CATEGORY } from '@/data/concepts';
import { MERGED_CONCEPTS } from '@/data/concepts/merged';
import { safeLocalStorage } from '@/utils/safeStorage';

const STORAGE_KEY = 'sdi:progress:v1';

export interface QuizResult {
  correct: number;
  total: number;
  at: number;
}

export interface ProgressState {
  visited: Record<string, number>;
  completed: Record<string, true>;
  quiz: Record<string, QuizResult>;
}

interface ProgressContextValue extends ProgressState {
  markVisited: (slug: string) => void;
  toggleCompleted: (slug: string) => void;
  recordQuiz: (slug: string, correct: number, total: number) => void;
  categoryProgress: (category: CategoryId) => { done: number; total: number; percent: number };
  overall: { done: number; total: number; percent: number };
  reset: () => void;
}

const EMPTY: ProgressState = { visited: {}, completed: {}, quiz: {} };

const ProgressContext = createContext<ProgressContextValue | null>(null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Keeps only the entries whose value passes `keep` - anything else in storage is dropped. */
function pick<T>(value: unknown, keep: (entry: unknown) => entry is T): Record<string, T> {
  if (!isRecord(value)) return {};
  const result: Record<string, T> = {};
  for (const [key, entry] of Object.entries(value)) {
    // `__proto__` is an own key after JSON.parse, but assigning it would swap the prototype.
    if (key !== '__proto__' && keep(entry)) result[key] = entry;
  }
  return result;
}

const isFiniteNumber = (entry: unknown): entry is number => typeof entry === 'number' && Number.isFinite(entry);
const isTrue = (entry: unknown): entry is true => entry === true;
const isQuizResult = (entry: unknown): entry is QuizResult =>
  isRecord(entry) &&
  isFiniteNumber(entry.correct) &&
  isFiniteNumber(entry.total) &&
  entry.total > 0 &&
  isFiniteNumber(entry.at);

/**
 * Storage is outside our control - an older schema, a manual edit or a
 * truncated write must not crash the app later in `recordQuiz` or the
 * progress page, so the saved state is rebuilt field by field.
 */
function load(): ProgressState {
  const raw = safeLocalStorage.get(STORAGE_KEY);
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY;
    return carryMerged({
      visited: pick(parsed.visited, isFiniteNumber),
      completed: pick(parsed.completed, isTrue),
      quiz: pick(parsed.quiz, isQuizResult),
    });
  } catch {
    return EMPTY;
  }
}

const quizRatio = (result: QuizResult) => result.correct / result.total;

/**
 * Progress saved under a merged Concept moves to the Concept it was merged
 * into: Done wins, the best quiz score and the first visit are kept. The
 * retired keys are dropped, so the next save no longer carries them.
 */
function carryMerged(state: ProgressState): ProgressState {
  const visited = { ...state.visited };
  const completed = { ...state.completed };
  const quiz = { ...state.quiz };
  for (const [retired, kept] of Object.entries(MERGED_CONCEPTS)) {
    const firstVisit = visited[retired];
    if (firstVisit !== undefined) visited[kept] = Math.min(firstVisit, visited[kept] ?? firstVisit);
    if (completed[retired]) completed[kept] = true;
    const result = quiz[retired];
    if (result && (!quiz[kept] || quizRatio(result) > quizRatio(quiz[kept]))) quiz[kept] = result;
    delete visited[retired];
    delete completed[retired];
    delete quiz[retired];
  }
  return { visited, completed, quiz };
}

/**
 * Learning progress lives entirely in localStorage - no account, no backend.
 * A concept counts as done when the learner marks it complete or passes its quiz.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(load);

  useEffect(() => {
    // Storage can be unavailable (private mode) - progress is a nice-to-have.
    safeLocalStorage.set(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const markVisited = useCallback((slug: string) => {
    setState((current) =>
      current.visited[slug] ? current : { ...current, visited: { ...current.visited, [slug]: Date.now() } },
    );
  }, []);

  const toggleCompleted = useCallback((slug: string) => {
    setState((current) => {
      const completed = { ...current.completed };
      if (completed[slug]) delete completed[slug];
      else completed[slug] = true;
      return { ...current, completed };
    });
  }, []);

  const recordQuiz = useCallback((slug: string, correct: number, total: number) => {
    setState((current) => {
      const previous = current.quiz[slug];
      const best = previous && previous.correct / previous.total > correct / total ? previous : { correct, total, at: Date.now() };
      const completed = { ...current.completed };
      if (total > 0 && correct / total >= 0.7) completed[slug] = true;
      return { ...current, quiz: { ...current.quiz, [slug]: best }, completed };
    });
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  const value = useMemo<ProgressContextValue>(() => {
    const isDone = (slug: string) => Boolean(state.completed[slug]);

    const categoryProgress = (category: CategoryId) => {
      const concepts = CONCEPTS_BY_CATEGORY[category] ?? [];
      const done = concepts.filter((concept) => isDone(concept.slug)).length;
      const total = concepts.length;
      return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
    };

    const done = CONCEPTS.filter((concept) => isDone(concept.slug)).length;

    return {
      ...state,
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
  }, [state, markVisited, toggleCompleted, recordQuiz, reset]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used inside ProgressProvider');
  return context;
}
