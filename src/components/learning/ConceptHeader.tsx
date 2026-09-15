import { Link } from 'react-router-dom';
import { Check, FlaskConical } from 'lucide-react';
import type { Concept } from '@/types';
import { Badge, Button, difficultyTone } from '@/components/ui';
import { CATEGORY_BY_ID } from '@/data/categories';
import { useProgress } from '@/app/providers/ProgressProvider';

export function ConceptHeader({ concept }: { concept: Concept }) {
  const { completed, toggleCompleted } = useProgress();
  const isDone = Boolean(completed[concept.slug]);
  const category = CATEGORY_BY_ID[concept.category];

  return (
    <header className="border-b border-line bg-surface px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2 text-xs text-faint">
          <Link to={`/categories/${category.id}`} className="transition-colors hover:text-brand">
            {category.title}
          </Link>
          <span aria-hidden>/</span>
          <span>{concept.title}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink lg:text-3xl">{concept.title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-muted">{concept.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={difficultyTone(concept.difficulty)}>{concept.difficulty}</Badge>
              <Badge>{category.title}</Badge>
              {concept.lab ? (
                <Badge tone="brand">
                  <FlaskConical className="h-3 w-3" />
                  Interactive lab
                </Badge>
              ) : null}
            </div>
          </div>

          <Button
            variant={isDone ? 'success' : 'secondary'}
            onClick={() => toggleCompleted(concept.slug)}
            aria-pressed={isDone}
          >
            <Check className="h-4 w-4" />
            {isDone ? 'Completed' : 'Mark as complete'}
          </Button>
        </div>
      </div>
    </header>
  );
}
