/**
 * One plain sentence for a failed sign-in, from the Firebase error code - the
 * Learner never sees a code. Null means "say nothing" (the Learner started
 * another attempt).
 *
 * Some codes mean different things for different ways in, so the message
 * depends on the action. A wrong password, an unknown email and a bad
 * credential read the same: Firebase answers all three with
 * auth/invalid-credential when email enumeration protection is on (the default),
 * and the app does not tell them apart either, so no one learns from it who has
 * an Account.
 *
 * No imports, so Node runs this file and its tests as they are.
 */

export type SignInAction = 'google' | 'sign-in' | 'sign-up';

type Messages = Record<string, string | null>;

const WRONG_EMAIL_OR_PASSWORD =
  'The email or password is not right. If you signed up with Google, use Continue with Google instead.';

const COMMON: Messages = {
  'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts from this browser. Wait a few minutes and try again.',
  'auth/user-disabled': 'This Account has been disabled.',
  'auth/unauthorized-domain': 'Sign-in is not set up for this address yet.',
  'auth/web-storage-unsupported': 'This browser blocks the storage sign-in needs. Allow site data and try again.',
};

const PASSWORD: Messages = {
  'auth/invalid-credential': WRONG_EMAIL_OR_PASSWORD,
  'auth/wrong-password': WRONG_EMAIL_OR_PASSWORD,
  'auth/user-not-found': WRONG_EMAIL_OR_PASSWORD,
  'auth/invalid-email': 'That does not look like an email address. Check it and try again.',
  'auth/missing-email': 'Type your email address.',
  'auth/missing-password': 'Type your password.',
  'auth/email-already-in-use':
    'This email already has an Account. Choose Sign in and use its password, or Continue with Google.',
  'auth/weak-password': 'Choose a longer password, at least 6 characters.',
  'auth/password-does-not-meet-requirements':
    'That password is too easy to guess. Try a longer one that mixes letters, numbers and symbols.',
  'auth/operation-not-allowed': 'Sign-in with email and password is not turned on yet.',
  'auth/admin-restricted-operation': 'New Accounts cannot be created right now.',
  'auth/account-exists-with-different-credential': WRONG_EMAIL_OR_PASSWORD,
};

const BY_ACTION: Record<SignInAction, Messages> = {
  google: {
    'auth/popup-closed-by-user': 'The Google window was closed before sign-in finished.',
    'auth/cancelled-popup-request': null,
    'auth/popup-blocked': 'The browser blocked the Google window. Allow pop-ups for this site and try again.',
    'auth/operation-not-allowed': 'Sign-in with Google is not turned on yet.',
    'auth/admin-restricted-operation': 'New Accounts cannot be created right now.',
    // One Account per email: this email signed up with a password, and Google is not trusted to merge it.
    'auth/account-exists-with-different-credential':
      'This email already has an Account with a password. Sign in with your email and password below.',
    'auth/invalid-credential': 'Google did not confirm the sign-in. Try again.',
  },
  'sign-in': {
    ...PASSWORD,
    'auth/too-many-requests': 'Too many tries. Wait a few minutes, or use "Forgot password?" to set a new one.',
  },
  'sign-up': PASSWORD,
};

const FALLBACK = 'Sign-in did not work. Try again in a moment.';

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

export function signInErrorMessage(error: unknown, action: SignInAction = 'google'): string | null {
  const code = codeOf(error);
  const own = BY_ACTION[action];
  if (code in own) return own[code];
  return code in COMMON ? COMMON[code] : FALLBACK;
}

/**
 * The message for a failed "Forgot password?", or null when the dialog should
 * say the email is on its way. An unknown email counts as sent - the same answer
 * every time, so the form does not reveal who has an Account. (Firebase already
 * answers that way with email enumeration protection on.)
 */
export function passwordResetErrorMessage(error: unknown): string | null {
  const code = codeOf(error);
  if (code === 'auth/user-not-found') return null;
  if (code === 'auth/invalid-email' || code === 'auth/missing-email') return PASSWORD[code];
  if (code in COMMON) return COMMON[code];
  return 'The reset email could not be sent. Try again in a moment.';
}

/** The email Firebase attaches to a Google sign-in that clashed with a password Account, to fill the form. */
export function emailFromSignInError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('customData' in error)) return null;
  const data = error.customData;
  if (typeof data !== 'object' || data === null || !('email' in data)) return null;
  return typeof data.email === 'string' && data.email ? data.email : null;
}
