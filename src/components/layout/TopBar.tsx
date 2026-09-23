import { Link } from 'react-router-dom';
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useProgress } from '@/app/providers/ProgressProvider';
import type { Difficulty } from '@/types';

interface TopBarProps {
  onOpenSearch: () => void;
  /** Below lg this opens the drawer; from lg up it folds the sidebar into its icon strip. */
  onToggleSidebar: () => void;
  sidebarExpanded: boolean;
  difficulty: Difficulty | 'all';
  onDifficultyChange: (value: Difficulty | 'all') => void;
}

const DIFFICULTY_OPTIONS: { value: Difficulty | 'all'; label: string }[] = [
  { value: 'all', label: 'All levels' },
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
];

export function TopBar({ onOpenSearch, onToggleSidebar, sidebarExpanded, difficulty, onDifficultyChange }: TopBarProps) {
  const { theme, toggle } = useTheme();
  const { overall } = useProgress();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-3 backdrop-blur lg:px-5">
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
        aria-expanded={sidebarExpanded}
        title={sidebarExpanded ? 'Fold navigation' : 'Open navigation'}
      >
        <Menu className="h-5 w-5 lg:hidden" />
        {sidebarExpanded ? (
          <PanelLeftClose className="hidden h-5 w-5 lg:block" />
        ) : (
          <PanelLeftOpen className="hidden h-5 w-5 lg:block" />
        )}
      </Button>

      <Link to="/" className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-info text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <path d="M12 7v4M12 11H5v6M12 11h7v6" />
          </svg>
        </span>
        <span className="hidden sm:block">
          <span className="block text-sm font-semibold leading-tight text-ink">System Design Interactive</span>
          <span className="block text-[10px] leading-tight text-faint">Learn. Visualize. Experiment. Design.</span>
        </span>
      </Link>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 items-center gap-2 rounded-xl border border-line bg-elevated px-3 text-sm text-faint transition-colors hover:border-brand/50 hover:text-ink"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] md:inline">Ctrl K</kbd>
      </button>

      <div className="hidden xl:block">
        <Select
          value={difficulty}
          options={DIFFICULTY_OPTIONS}
          onChange={onDifficultyChange}
          className="w-36"
        />
      </div>

      <Link
        to="/progress"
        className="flex items-center gap-2 rounded-xl border border-line bg-elevated px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/50 hover:text-ink"
        title="Learning progress"
      >
        <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-line">
          <span className="absolute inset-y-0 left-0 rounded-full bg-ok" style={{ width: `${overall.percent}%` }} />
        </span>
        <span className="font-mono tabular-nums">{overall.percent}%</span>
      </Link>

      <Button size="icon" variant="ghost" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    </header>
  );
}
