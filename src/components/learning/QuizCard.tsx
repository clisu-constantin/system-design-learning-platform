import { useState, type CSSProperties } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { QuizQuestion } from '@/types';
import { Button } from '@/components/ui';
import { useProgress } from '@/app/providers/ProgressProvider';
import { passMark } from '@/app/providers/progressState';

interface QuizCardProps {
  questions: QuizQuestion[];
  /** Concept slug the score is recorded against. */
  slug: string;
}

/**
 * Scenario-based quiz. Answers are revealed with an explanation immediately,
 * because the explanation is the teaching, not the score.
 */
export function QuizCard({ questions, slug }: QuizCardProps) {
  const { recordQuiz, quiz } = useProgress();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((question) => answers[question.id] === question.answer).length;
  const best = quiz[slug];

  const submit = () => {
    setSubmitted(true);
    recordQuiz(slug, correctCount, questions.length);
  };

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const selected = answers[question.id];
        return (
          <div key={question.id} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-medium text-ink">
              <span className="mr-2 font-mono text-xs text-faint">{index + 1}.</span>
              {question.prompt}
            </p>

            <div className="mt-3 space-y-2">
              {question.options.map((option, optionIndex) => {
                const isSelected = selected === optionIndex;
                const isCorrect = optionIndex === question.answer;
                const reveal = submitted;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={submitted}
                    aria-pressed={isSelected}
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors',
                      'disabled:cursor-default',
                      reveal && isCorrect && 'border-ok bg-ok/10 text-ink',
                      reveal && isSelected && !isCorrect && 'border-danger bg-danger/10 text-ink',
                      !reveal && isSelected && 'border-brand bg-brand/10 text-ink',
                      !reveal && !isSelected && 'border-line text-muted hover:border-brand/50 hover:text-ink',
                      reveal && !isCorrect && !isSelected && 'border-line text-faint',
                    )}
                  >
                    <span className="mt-0.5 font-mono text-xs text-faint">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {reveal && isCorrect ? (
                      <Check className="h-4 w-4 shrink-0 text-ok" role="img" aria-label="Right answer" />
                    ) : null}
                    {reveal && isSelected && !isCorrect ? (
                      <X className="h-4 w-4 shrink-0 text-danger" role="img" aria-label="Wrong answer" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {submitted ? (
              <p
                className={cn(
                  'mt-3 rounded-xl border p-3 text-sm leading-relaxed',
                  selected === question.answer
                    ? 'border-ok/30 bg-ok/5 text-muted'
                    : 'border-warn/30 bg-warn/5 text-muted',
                )}
              >
                <strong className="text-ink">
                  {selected === question.answer ? 'Correct. ' : 'Not quite. '}
                </strong>
                {question.explanation}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        {submitted ? (
          <>
            <QuizScore correct={correctCount} total={questions.length} />
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={answeredCount < questions.length} onClick={submit}>
            Check answers
            {answeredCount < questions.length ? (
              <span className="text-xs opacity-80">
                ({answeredCount}/{questions.length} answered)
              </span>
            ) : null}
          </Button>
        )}
        {best ? (
          <span className="text-xs text-faint">
            Best score: {best.correct}/{best.total}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The score as a row of bars, one per question, filled one right answer at a
 * time up to the pass mark. Passing is what makes the Concept Done, so the row
 * shows where that line is, and the sentence under it says which side the
 * Learner landed on (never color alone).
 */
function QuizScore({ correct, total }: { correct: number; total: number }) {
  const need = passMark(total);
  const passed = correct >= need;
  return (
    <div className="min-w-0 space-y-1.5" role="status">
      <div className="flex items-end gap-1" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className="flex items-end gap-1">
            <span
              className={cn(
                'block h-3 w-2.5 rounded-sm sm:w-3',
                index < correct ? (passed ? 'bg-ok' : 'bg-warn') : 'bg-line',
                index < correct && 'tally-in',
              )}
              style={index < correct ? { '--i': index } as CSSProperties : undefined}
            />
            {index === need - 1 && need < total ? <span className="block h-5 w-px bg-ink/40" /> : null}
          </span>
        ))}
      </div>
      <p className="tally-after text-sm text-ink" style={{ '--i': correct } as CSSProperties}>
        <span className="font-medium">
          {correct} / {total} correct.
        </span>{' '}
        <span className="text-muted">
          {passed ? 'Passed - this Concept is Done.' : `${need} right answers pass and make it Done.`}
        </span>
      </p>
    </div>
  );
}
