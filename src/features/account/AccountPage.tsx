import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, LogIn, LogOut, MonitorSmartphone, UserRound } from 'lucide-react';
import { Button, Meter } from '@/components/ui';
import { useAccount } from '@/app/providers/AccountProvider';
import { useProgress } from '@/app/providers/ProgressProvider';

/** The Account of this device: who is signed in, and signing out. A Guest gets the way in. */
export function AccountPage() {
  const { status } = useAccount();

  return (
    <div className="px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Account</h1>
          <p className="mt-1.5 text-sm text-muted">Optional. Every page works the same for a Guest.</p>
        </header>

        {status === 'signed-in' ? <SignedIn /> : status === 'restoring' ? <Restoring /> : <Guest />}
      </div>
    </div>
  );
}

function SignedIn() {
  const { email, signOut } = useAccount();
  const { overall, visited } = useProgress();
  const [pending, setPending] = useState(false);
  const initial = email?.trim().charAt(0).toUpperCase();

  return (
    <>
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/15 text-lg font-semibold text-brand"
            aria-hidden
          >
            {initial || <UserRound className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="label">Signed in as</p>
            <p className="mt-0.5 break-all text-sm font-medium text-ink">{email ?? 'An Account with no email'}</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink">On this device</h2>
        <Link
          to="/progress"
          className="mt-3 flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-brand/50"
        >
          <span className="shrink-0 text-sm text-ink">Progress</span>
          <Meter value={overall.percent / 100} showValue={false} className="flex-1" />
          <span className="shrink-0 font-mono text-xs text-muted">
            {overall.done}/{overall.total} done, {Object.keys(visited).length} opened
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
        </Link>
      </section>

      <section className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-6">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setPending(true);
            // The page re-renders as a Guest when it resolves; nothing to reset.
            void signOut();
          }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {pending ? 'Signing out...' : 'Sign out'}
        </Button>
        <p className="min-w-0 flex-1 basis-60 text-xs text-muted">
          Signing out empties the progress on this device, so the next person here starts as an empty Guest.
        </p>
      </section>
    </>
  );
}

function Restoring() {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface p-5 text-sm text-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      Checking your sign-in...
    </div>
  );
}

function Guest() {
  const { available, openSignIn } = useAccount();

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated text-muted" aria-hidden>
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">You are a Guest</p>
          <p className="mt-1 text-sm text-muted">
            Your progress lives in this browser only. Clearing site data or switching device starts it over.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {available ? (
          <Button variant="primary" onClick={openSignIn}>
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
        ) : (
          <p className="text-xs text-faint">Sign-in is not available in this version of the app.</p>
        )}
        <Link
          to="/progress"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          See your progress
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export default AccountPage;
