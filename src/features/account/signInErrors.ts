/**
 * One plain sentence for a failed sign-in, from the Firebase error code.
 * Null means "say nothing" (the Learner started another attempt).
 *
 * No imports, so Node runs this file and its tests as they are. Email and
 * password codes (auth/wrong-password, auth/email-already-in-use, ...) go here too.
 */

const MESSAGES: Record<string, string | null> = {
  'auth/popup-closed-by-user': 'The Google window was closed before sign-in finished.',
  'auth/cancelled-popup-request': null,
  'auth/popup-blocked': 'The browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'Could not reach Google. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts from this browser. Wait a minute and try again.',
  'auth/user-disabled': 'This Account has been disabled.',
  'auth/unauthorized-domain': 'Sign-in is not set up for this address yet.',
  'auth/operation-not-allowed': 'Sign-in with Google is not enabled yet.',
  'auth/web-storage-unsupported': 'This browser blocks the storage sign-in needs. Allow site data and try again.',
};

const FALLBACK = 'Sign-in did not work. Try again in a moment.';

export function signInErrorMessage(error: unknown): string | null {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return code in MESSAGES ? MESSAGES[code] : FALLBACK;
}
