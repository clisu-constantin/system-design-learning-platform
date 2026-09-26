/**
 * The rules of the Account on this device, apart from React and Firebase.
 *
 * The "was signed in here" mark (`sdi:account` in localStorage) decides
 * whether Firebase loads at start: a Guest never downloads it. When the
 * Account goes away on this device - a sign-out, a 410 from the server, or a
 * session that ended elsewhere - the progress on this device goes with it, so
 * the next person on a shared computer is an empty Guest.
 *
 * No imports, so Node runs this file and its tests as they are.
 */

export type AccountStatus = 'guest' | 'restoring' | 'signed-in';

/** What the app needs to know about a Firebase user. */
export interface AccountUser {
  email: string | null;
  /**
   * A password Account whose email is not confirmed yet. Saving works anyway,
   * but until it is confirmed, a Google sign-in for the same Gmail address
   * replaces the password (Firebase trusts Google over an unconfirmed email).
   */
  confirmPending?: boolean;
}

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export const ACCOUNT_MARK_KEY = 'sdi:account';

/** Firebase loads at start only in a browser that was signed in here. */
export function startStatus({ configured, marked }: { configured: boolean; marked: boolean }): AccountStatus {
  return configured && marked ? 'restoring' : 'guest';
}

export interface AuthChange {
  status: AccountStatus;
  email: string | null;
  mark: 'set' | 'remove' | 'keep';
  /** True once per Account that left this device: empty its local progress. */
  clearProgress: boolean;
  confirmPending: boolean;
}

/**
 * What follows when Firebase reports the user (or none). "Was signed in" is
 * the mark OR this tab believing it was: another tab may already have removed
 * the mark, but this tab still holds the progress in memory and would save it
 * back.
 */
export function afterAuthChange(
  user: AccountUser | null,
  { previous, marked }: { previous: AccountStatus; marked: boolean },
): AuthChange {
  if (user)
    return { status: 'signed-in', email: user.email, mark: 'set', clearProgress: false, confirmPending: Boolean(user.confirmPending) };
  const wasSignedIn = marked || previous !== 'guest';
  return { status: 'guest', email: null, mark: wasSignedIn ? 'remove' : 'keep', clearProgress: wasSignedIn, confirmPending: false };
}

/**
 * Another tab set or removed the mark. A tab that loaded as a Guest never
 * loaded Firebase, so it cannot hear of a sign-in in another tab by itself:
 * the mark appearing is its cue to restore the Account, so its top bar, its
 * Account page and its Reset all agree. A sign-out needs nothing here - a tab
 * with Firebase hears of it from Firebase.
 */
export function afterMarkChange({
  status,
  configured,
  marked,
}: {
  status: AccountStatus;
  configured: boolean;
  marked: boolean;
}): 'restore' | 'none' {
  return status === 'guest' && configured && marked ? 'restore' : 'none';
}

/** The Firebase web config from the VITE_FIREBASE_* variables, or null when any is missing: a Guest-only build. */
export function firebaseConfigFrom(env: Record<string, string | undefined>): FirebaseWebConfig | null {
  const value = (key: string) => env[key]?.trim() || null;
  const apiKey = value('VITE_FIREBASE_API_KEY');
  const authDomain = value('VITE_FIREBASE_AUTH_DOMAIN');
  const projectId = value('VITE_FIREBASE_PROJECT_ID');
  const appId = value('VITE_FIREBASE_APP_ID');
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}
