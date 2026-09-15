import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Check, ChevronDown, FlaskConical, Layers3, BookMarked, Route, GitCompare, Waypoints } from 'lucide-react';
import { CategoryIcon } from '@/data/categoryIcons';
import { cn } from '@/utils/cn';
import { CATEGORIES } from '@/data/categories';
import { CONCEPTS_BY_CATEGORY } from '@/data/concepts';
import { useProgress } from '@/app/providers/ProgressProvider';
import type { Difficulty } from '@/types';

const DIFFICULTY_DOT: Record<Difficulty, string> = {
  Beginner: 'bg-ok',
  Intermediate: 'bg-warn',
  Advanced: 'bg-danger',
};

const TOOLS = [
  { to: '/labs', label: 'Interactive Labs', Icon: FlaskConical },
  { to: '/playground', label: 'Playground', Icon: Layers3 },
  { to: '/evolution', label: 'System Evolution', Icon: Waypoints },
  { to: '/compare', label: 'Compare Mode', Icon: GitCompare },
  { to: '/scenarios', label: 'Scenarios', Icon: Route },
  { to: '/glossary', label: 'Glossary', Icon: BookMarked },
];

interface SidebarProps {
  /** Difficulty filter shared with the topbar control. */
  difficulty: Difficulty | 'all';
  onNavigate?: () => void;
}

export function Sidebar({ difficulty, onNavigate }: SidebarProps) {
  const { completed, categoryProgress } = useProgress();
  const [open, setOpen] = useState<Record<string, boolean>>({ 'getting-started': true, scaling: true });

  return (
    <nav aria-label="Concept navigation" className="flex h-full flex-col gap-1 overflow-y-auto px-3 pb-8 pt-4">
      <div className="mb-2 space-y-0.5">
        {TOOLS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-elevated hover:text-ink',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="my-2 h-px bg-line" />

      {CATEGORIES.map((category) => {
        const concepts = (CONCEPTS_BY_CATEGORY[category.id] ?? []).filter(
          (concept) => difficulty === 'all' || concept.difficulty === difficulty,
        );
        if (concepts.length === 0) return null;
        const isOpen = open[category.id] ?? false;
        const progress = categoryProgress(category.id);

        return (
          <div key={category.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen((current) => ({ ...current, [category.id]: !isOpen }))}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-elevated"
            >
              <CategoryIcon name={category.icon} className="h-4 w-4 shrink-0 text-faint" />
              <span className="flex-1 truncate">{category.title}</span>
              <span className="font-mono text-[10px] tabular-nums text-faint">
                {progress.done}/{progress.total}
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen ? (
              <ul className="ml-[22px] space-y-0.5 border-l border-line pl-2">
                {concepts.map((concept) => (
                  <li key={concept.slug}>
                    <NavLink
                      to={`/concepts/${concept.slug}`}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                          isActive ? 'bg-brand/10 font-medium text-brand' : 'text-muted hover:bg-elevated hover:text-ink',
                        )
                      }
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DIFFICULTY_DOT[concept.difficulty])}
                        title={concept.difficulty}
                      />
                      <span className="flex-1 truncate">{concept.title}</span>
                      {concept.lab ? (
                        <FlaskConical className="h-3 w-3 shrink-0 text-brand" aria-label="Has an interactive lab" />
                      ) : null}
                      {completed[concept.slug] ? (
                        <Check className="h-3 w-3 shrink-0 text-ok" aria-label="Completed" />
                      ) : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
