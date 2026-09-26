import { useId, useState } from 'react';
import { Loader2, UserRound, X } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { signInErrorMessage } from './signInErrors';

interface SignInDialogProps {
  /** Firebase is loaded: the Google button can open its popup straight from the click. */
  ready: boolean;
  /** Must be called synchronously from the click - see AuthSession.signInWithGoogle. */
  onGoogle: () => Promise<void>;
  onClose: () => void;
}

/**
 * The sign-in dialog, on the shared Modal. Each way to sign in is its own
 * section inside `methods`; an email and password form goes under the Google
 * button, with its own pending and error state.
 */
export function SignInDialog({ ready, onGoogle, onClose }: SignInDialogProps) {
  const titleId = useId();
  const errorId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueWithGoogle = () => {
    setError(null);
    setPending(true);
    // No await before this call: the popup has to open inside the click.
    onGoogle().then(onClose, (reason: unknown) => {
      setPending(false);
      setError(signInErrorMessage(reason));
    });
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy={titleId}
      className="items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm short:pt-4"
      panelClassName="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-brand">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold text-ink">
              Sign in
            </h2>
            <p className="mt-0.5 text-xs text-muted">Optional. Every page works the same without an Account.</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 px-5 py-5">
        <section aria-label="Sign in with Google">
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={continueWithGoogle}
            disabled={!ready || pending}
            aria-describedby={error ? errorId : undefined}
          >
            {!ready || pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GoogleMark />}
            {!ready ? 'Loading sign-in...' : pending ? 'Waiting for Google...' : 'Continue with Google'}
          </Button>
          {pending ? (
            <p className="mt-2 text-xs text-muted">Finish in the Google window. Closing it cancels.</p>
          ) : null}
          {error ? (
            <p id={errorId} role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}

/** A monochrome "G", drawn in the text color - no brand hex values, no image request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.45-1.66 4.25-5.35 4.25-3.22 0-5.85-2.67-5.85-5.96S8.78 6.41 12 6.41c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.85 14.54 2.9 12 2.9 6.97 2.9 2.9 6.97 2.9 12s4.07 9.1 9.1 9.1c5.25 0 8.74-3.69 8.74-8.89 0-.6-.07-1.05-.15-1.51z" />
    </svg>
  );
}

export default SignInDialog;
