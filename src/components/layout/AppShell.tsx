import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { ErrorBoundary } from '@/components/ui';
import type { Difficulty } from '@/types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandSearch } from './CommandSearch';

/**
 * Two-column application layout: persistent navigation on the left, the active
 * workspace on the right. The sidebar collapses into an overlay below lg.
 */
export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const location = useLocation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar
        onOpenSearch={() => setSearchOpen(true)}
        onToggleSidebar={() => setMobileNavOpen((open) => !open)}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
      />

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'w-72 shrink-0 border-r border-line bg-surface',
            'fixed inset-y-14 left-0 z-40 transition-transform lg:static lg:inset-auto lg:translate-x-0',
            mobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          )}
        >
          <Sidebar difficulty={difficulty} onNavigate={() => setMobileNavOpen(false)} />
        </aside>

        {mobileNavOpen ? (
          <div
            className="fixed inset-0 top-14 z-30 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
        ) : null}

        <main className="min-w-0 flex-1 overflow-y-auto">
          <ErrorBoundary area="Workspace">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
