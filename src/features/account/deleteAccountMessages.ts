/**
 * One plain sentence for a failed "Delete my Account". The flow stops at the
 * first failure - proving it is the Learner, then the server - before anything
 * is deleted, so every message says so. Null means "say nothing" (the Learner
 * started another attempt).
 *
 * No imports, so Node runs this file and its tests as they are.
 */

export type DeleteFailure = { step: 'confirm'; error: unknown } | { step: 'server'; reason: string };

const WRONG_PASSWORD = 'That password is not right, so nothing was deleted.';

const CONFIRM: Record<string, string | null> = {
  'auth/wrong-password': WRONG_PASSWORD,
  'auth/invalid-credential': WRONG_PASSWORD,
  'auth/invalid-login-credentials': WRONG_PASSWORD,
  'auth/missing-password': 'Type your password to confirm. Nothing was deleted.',
  'auth/user-mismatch': 'That is a different Google account, so nothing was deleted. Choose the one you are signed in with.',
  'auth/popup-closed-by-user': 'The Google window was closed, so nothing was deleted.',
  'auth/cancelled-popup-request': null,
  'auth/popup-blocked': 'The browser blocked the Google window, so nothing was deleted. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'Could not reach the sign-in service, so nothing was deleted. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts, so nothing was deleted. Wait a few minutes and try again.',
};

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

export function deleteAccountMessage(failure: DeleteFailure): string | null {
  if (failure.step === 'server') {
    return failure.reason === 'offline' || failure.reason === 'timeout'
      ? 'Could not reach the server, so nothing was deleted. Check your connection and try again.'
      : 'The server could not delete your Account right now, so nothing was deleted. Try again in a moment.';
  }
  const code = codeOf(failure.error);
  return code in CONFIRM ? CONFIRM[code] : 'Could not confirm it is you, so nothing was deleted. Try again.';
}
