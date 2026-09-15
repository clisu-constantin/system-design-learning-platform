import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { QuizQuestion } from '@/types';
import { Button } from '@/components/ui';
import { useProgress } from '@/app/providers/ProgressProvider';

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
                    {reveal && isCorrect ? <Check className="h-4 w-4 shrink-0 text-ok" /> : null}
                    {reveal && isSelected && !isCorrect ? <X className="h-4 w-4 shrink-0 text-danger" /> : null}
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
            <span className="text-sm font-medium text-ink">
              {correctCount} / {questions.length} correct
            </span>
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
