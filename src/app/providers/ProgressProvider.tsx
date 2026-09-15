import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CategoryId } from '@/types';
import { CONCEPTS, CONCEPTS_BY_CATEGORY } from '@/data/concepts';

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

function load(): ProgressState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

/**
 * Learning progress lives entirely in localStorage - no account, no backend.
 * A concept counts as done when the learner marks it complete or passes its quiz.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode) - progress is a nice-to-have.
    }
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
