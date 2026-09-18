import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, FlaskConical, FolderTree, Route, Search as SearchIcon, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { search, type SearchKind, type SearchResult } from '@/utils/search';
import { Badge } from '@/components/ui';

const KIND_META: Record<SearchKind, { label: string; Icon: typeof SearchIcon; tone: 'brand' | 'ok' | 'warn' | 'info' | 'neutral' }> = {
  lab: { label: 'Lab', Icon: FlaskConical, tone: 'brand' },
  concept: { label: 'Concept', Icon: BookMarked, tone: 'neutral' },
  scenario: { label: 'Scenario', Icon: Route, tone: 'warn' },
  glossary: { label: 'Glossary', Icon: BookMarked, tone: 'info' },
  category: { label: 'Section', Icon: FolderTree, tone: 'ok' },
};

interface CommandSearchProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Global search dialog (Ctrl/Cmd+K). Results are grouped by kind and keyboard
 * navigable with arrows and Enter.
 */
export function CommandSearch({ open, onClose }: CommandSearchProps) {
  // Mounted only while open, so every opening starts from an empty query.
  return open ? <SearchDialog onClose={onClose} /> : null;
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => search(query), [query]);

  // A new query means a new result list - the highlight goes back to the top.
  const changeQuery = (next: string) => {
    setQuery(next);
    setActive(0);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, []);

  const go = (result: SearchResult | undefined) => {
    if (!result) return;
    navigate(result.to);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search concepts, labs, scenarios, glossary..."
            aria-label="Search query"
            className="h-14 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="text-faint hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query && results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No matches for &ldquo;{query}&rdquo;. Try &ldquo;cache&rdquo;, &ldquo;shard&rdquo; or &ldquo;queue&rdquo;.
            </p>
          ) : null}

          {!query ? (
            <div className="px-3 py-6 text-center text-sm text-muted">
              Try{' '}
              {['load balancer', 'caching', 'sharding', 'circuit breaker'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => changeQuery(suggestion)}
                  className="mx-1 rounded-md border border-line px-2 py-0.5 text-xs text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {results.map((result, index) => {
            const meta = KIND_META[result.kind];
            return (
              <button
                key={result.id}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  index === active ? 'bg-elevated' : 'hover:bg-elevated',
                )}
              >
                <meta.Icon className="h-4 w-4 shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{result.title}</span>
                  <span className="block truncate text-xs text-faint">{result.subtitle}</span>
                </span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-faint">
          <span>
            <kbd className="rounded border border-line px-1">up</kbd>{' '}
            <kbd className="rounded border border-line px-1">down</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border border-line px-1">enter</kbd> open
          </span>
          <span>
            <kbd className="rounded border border-line px-1">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
