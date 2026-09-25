import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { ErrorBoundary } from '@/components/ui';
import { useLayout } from '@/app/providers/LayoutProvider';
import { LG_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import type { Difficulty } from '@/types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandSearch } from './CommandSearch';

/** True while focus is somewhere "/" is a character, not a shortcut. */
const isTyping = (element: Element | null) =>
  element instanceof HTMLElement &&
  (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));

/**
 * Two-column application layout: persistent navigation on the left, the active
 * workspace on the right. The sidebar collapses into an overlay below lg; from
 * lg up the learner can fold it into a strip of icons, and that choice persists.
 */
export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const location = useLocation();
  const { sidebarFolded, setFolded } = useLayout();
  const isWide = useMediaQuery(LG_QUERY);
  // A stored fold only applies to the static column; the small-screen drawer always shows everything.
  const folded = isWide && sidebarFolded;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === '/' && !isTyping(document.activeElement)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    // Any navigation closes the mobile drawer, including back/forward, which
    // never passes through the sidebar's own onNavigate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileNavOpen(false);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar
        onOpenSearch={() => setSearchOpen(true)}
        onToggleSidebar={() => (isWide ? setFolded('sidebarFolded', !sidebarFolded) : setMobileNavOpen((open) => !open))}
        sidebarExpanded={isWide ? !sidebarFolded : mobileNavOpen}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
      />

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'w-72 shrink-0 overflow-hidden border-r border-line bg-surface',
            'fixed inset-y-14 left-0 z-40 transition-[transform,width] duration-150 lg:static lg:inset-auto lg:translate-x-0',
            folded && 'lg:w-14',
            mobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          )}
        >
          <Sidebar
            difficulty={difficulty}
            folded={folded}
            onUnfold={() => setFolded('sidebarFolded', false)}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </aside>

        {mobileNavOpen ? (
          <div
            className="fixed inset-0 top-14 z-30 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
        ) : null}

        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* Keyed by path so that one crashed page does not keep every other route showing its error. */}
          <ErrorBoundary area="Workspace" key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
