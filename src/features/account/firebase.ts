import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import type { AccountUser, FirebaseWebConfig } from '@/app/account/accountState';

/**
 * The ONLY module that imports firebase/*. It is reached by dynamic import
 * alone (AccountProvider's loadFirebase), so a Guest never downloads the SDK:
 * it loads when the Learner opens sign-in, or at start in a browser that was
 * signed in here. Keep every Firebase call in this file - email and password,
 * reset and delete belong here too - and keep its exports free of Firebase
 * types, so nothing else has a reason to import the SDK.
 */

export interface AuthSession {
  /** Called with the current user (or null) once Firebase has read its storage, and on every change after. */
  onUserChange(listener: (user: AccountUser | null) => void): () => void;
  /**
   * Opens the Google popup. Call it straight from the click handler, with no
   * await before it, or the browser blocks the popup.
   */
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** The Firebase ID token for the API, refreshed by Firebase when it is close to expiry. Null when signed out. */
  getIdToken(): Promise<string | null>;
}

let session: { key: string; app: FirebaseApp; auth: Auth } | null = null;

/** One Auth per page: initializeAuth throws when called twice (StrictMode, hot reload). */
function authFor(config: FirebaseWebConfig): Auth {
  const key = JSON.stringify(config);
  if (session?.key === key) return session.auth;
  const app = initializeApp(config);
  const auth = initializeAuth(app, {
    // localStorage, which signing out empties - the same place the app keeps everything else.
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  session = { key, app, auth };
  return auth;
}

const toUser = (user: { email: string | null } | null): AccountUser | null => (user ? { email: user.email } : null);

export function startAuth(config: FirebaseWebConfig): AuthSession {
  const auth = authFor(config);

  return {
    onUserChange: (listener) => onAuthStateChanged(auth, (user) => listener(toUser(user))),

    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      // Always offer the account chooser: on a shared computer the last Google account is not always the Learner.
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    },

    signOut: () => firebaseSignOut(auth),

    async getIdToken() {
      return auth.currentUser ? auth.currentUser.getIdToken() : null;
    },
  };
}
