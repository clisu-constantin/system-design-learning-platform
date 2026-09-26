import { Link } from 'react-router-dom';
import { Check, LogIn, RotateCcw } from 'lucide-react';
import { Button, Meter } from '@/components/ui';
import { useAccount } from '@/app/providers/AccountProvider';
import { CATEGORIES } from '@/data/categories';
import { CONCEPTS_BY_CATEGORY, CONCEPT_BY_SLUG } from '@/data/concepts';
import { useProgress } from '@/app/providers/ProgressProvider';

export function ProgressPage() {
  const { overall, categoryProgress, completed, quiz, visited, synced, reset } = useProgress();
  const { available, openSignIn } = useAccount();
  const quizEntries = Object.entries(quiz);
  const visitedCount = Object.keys(visited).length;

  return (
    <div className="px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">System Design Progress</h1>
            <p className="mt-1.5 text-sm text-muted">
              {synced
                ? 'Saved in this browser and to your Account, so it follows you to every device you sign in on.'
                : available
                  ? 'Saved in this browser only. Sign in to keep it on every device.'
                  : 'Saved in this browser only.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!synced && available ? (
              <Button variant="secondary" onClick={openSignIn}>
                <LogIn className="h-4 w-4" />
                Sign in
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                const question = synced
                  ? 'This clears your progress on every device. It cannot be undone.'
                  : 'Reset all progress? This cannot be undone.';
                if (window.confirm(question)) reset();
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset progress
            </Button>
          </div>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="label">Completed</p>
            <p className="metric-value mt-1 text-ok">
              {overall.done}
              <span className="text-sm font-normal text-faint"> / {overall.total}</span>
            </p>
            <Meter value={overall.percent / 100} showValue={false} className="mt-3" />
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="label">Concepts opened</p>
            <p className="metric-value mt-1 text-ink">{visitedCount}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="label">Quizzes taken</p>
            <p className="metric-value mt-1 text-ink">{quizEntries.length}</p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">By section</h2>
          <div className="mt-3 space-y-2">
            {CATEGORIES.map((category) => {
              const progress = categoryProgress(category.id);
              return (
                <Link
                  key={category.id}
                  to={`/categories/${category.id}`}
                  className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-brand/50"
                >
                  <span className="w-44 shrink-0 text-sm text-ink">{category.title}</span>
                  <Meter value={progress.percent / 100} showValue={false} className="flex-1" />
                  <span className="w-20 shrink-0 text-right font-mono text-xs text-muted">
                    {progress.done}/{progress.total}
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-ok">{progress.percent}%</span>
                </Link>
              );
            })}
          </div>
        </section>

        {quizEntries.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-ink">Quiz results</h2>
            <div className="mt-3 space-y-2">
              {quizEntries.map(([slug, result]) => {
                const concept = CONCEPT_BY_SLUG.get(slug);
                if (!concept) return null;
                const ratio = result.total ? result.correct / result.total : 0;
                return (
                  <Link
                    key={slug}
                    to={`/concepts/${slug}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-brand/50"
                  >
                    <span className="text-sm text-ink">{concept.title}</span>
                    <span className={`font-mono text-xs ${ratio >= 0.7 ? 'text-ok' : 'text-warn'}`}>
                      {result.correct}/{result.total}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">Completed concepts</h2>
          {Object.keys(completed).length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Nothing completed yet. Mark a concept complete, or score 70% on its quiz.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.keys(completed).map((slug) => {
                const concept = CONCEPT_BY_SLUG.get(slug);
                if (!concept) return null;
                return (
                  <Link
                    key={slug}
                    to={`/concepts/${slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/5 px-3 py-1.5 text-xs text-ok transition-colors hover:border-ok"
                  >
                    <Check className="h-3 w-3" />
                    {concept.title}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-10 text-xs text-faint">
          {CONCEPTS_BY_CATEGORY['getting-started'].length > 0
            ? 'Tip: start with Getting Started, then Scaling - the later sections assume both.'
            : null}
        </p>
      </div>
    </div>
  );
}

export default ProgressPage;
