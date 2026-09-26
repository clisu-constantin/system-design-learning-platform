import { Link } from 'react-router-dom';
import { LogIn, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, UserRound } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useProgress } from '@/app/providers/ProgressProvider';
import { useAccount } from '@/app/providers/AccountProvider';
import { LG_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
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
  // Only the wide-screen sidebar folds; below lg the same button opens a drawer, as it always did.
  const canFold = useMediaQuery(LG_QUERY);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-3 backdrop-blur lg:px-5">
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
        aria-expanded={sidebarExpanded}
        title={canFold ? (sidebarExpanded ? 'Fold navigation' : 'Open navigation') : undefined}
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
          <span className="block text-[11px] leading-tight text-faint">Learn. Visualize. Experiment. Design.</span>
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
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[11px] md:inline">Ctrl K</kbd>
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
        <span className="relative hidden h-1.5 w-16 overflow-hidden rounded-full bg-line sm:block">
          <span className="absolute inset-y-0 left-0 rounded-full bg-ok" style={{ width: `${overall.percent}%` }} />
        </span>
        <span className="font-mono tabular-nums">{overall.percent}%</span>
      </Link>

      <Button size="icon" variant="ghost" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <AccountButton />
    </header>
  );
}

/**
 * "Sign in" for a Guest, the Account (its initial, and its email from md up)
 * once signed in. Nothing at all in a build without Firebase. The initial is
 * text, not the Google photo, so the CSP img-src stays 'self' data:.
 */
function AccountButton() {
  const { available, status, email, openSignIn } = useAccount();
  if (!available) return null;

  if (status === 'guest') {
    return (
      <Button
        variant="primary"
        onClick={openSignIn}
        aria-label="Sign in"
        className="h-9 w-9 shrink-0 justify-center px-0 text-sm sm:w-auto sm:px-3"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
      </Button>
    );
  }

  const initial = email?.trim().charAt(0).toUpperCase();
  return (
    <Link
      to="/account"
      aria-label={status === 'restoring' ? 'Account' : `Account: ${email ?? 'signed in'}`}
      title={email ?? 'Account'}
      className="flex h-9 min-w-9 coarse:min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl text-sm text-muted transition-colors hover:bg-elevated hover:text-ink md:px-1.5"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          status === 'restoring' ? 'bg-elevated text-faint' : 'bg-brand/15 text-brand'
        }`}
        aria-hidden
      >
        {status === 'signed-in' && initial ? initial : <UserRound className="h-4 w-4" />}
      </span>
      {status === 'signed-in' && email ? <span className="hidden max-w-40 truncate md:inline">{email}</span> : null}
    </Link>
  );
}
