import { initializeApp, type FirebaseApp, type FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser as firebaseDeleteUser,
  initializeAuth,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type OAuthCredential,
  type User,
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
  /** Signs in with an email and a password. Same Account as Google for the same email (one Account per email). */
  signInWithEmail(email: string, password: string): Promise<void>;
  /**
   * Creates the Account and signs in at once, then sends the confirm email in
   * the background. Confirming is not required: nothing checks email_verified.
   */
  signUpWithEmail(email: string, password: string): Promise<void>;
  /** Sends Firebase's reset email. Resolves for an unknown email too when enumeration protection is on. */
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** The Firebase ID token for the API, refreshed by Firebase when it is close to expiry. Null when signed out. */
  getIdToken(): Promise<string | null>;
  /**
   * How the signed-in Learner proves it is them again before deleting the
   * Account: Google when the Account has it, else the password. Null when signed out.
   */
  reauthMethod(): 'google' | 'password' | null;
  /** The Google popup again, for the same user - straight from the click, like signInWithGoogle. */
  reauthenticateWithGoogle(): Promise<void>;
  reauthenticateWithPassword(password: string): Promise<void>;
  /**
   * Deletes the Firebase user (it needs a recent sign-in - reauthenticate
   * first). Call it after the server deleted the Account; Firebase then
   * reports no user, which signs this device out.
   */
  deleteUser(): Promise<void>;
  /** Sends the confirm email again, for a password Account that has not confirmed it yet. */
  sendConfirmEmail(): Promise<void>;
  /**
   * Reads the user again from Firebase: a confirm link clicked in the email
   * changes nothing on this device until then. Null when signed out.
   */
  refreshUser(): Promise<AccountUser | null>;
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

/** A password Account with no confirmed email is flagged: a Google sign-in for that Gmail address would replace its password. */
const toUser = (user: User | null): AccountUser | null =>
  user
    ? {
        email: user.email,
        confirmPending: !user.emailVerified && user.providerData.some((info) => info.providerId === 'password'),
      }
    : null;

export function startAuth(config: FirebaseWebConfig): AuthSession {
  const auth = authFor(config);
  /**
   * A Google sign-in that failed because its email already has a password
   * Account. When the Learner then signs in with that password, Google is
   * linked to the Account, so the next Google sign-in opens it directly.
   */
  let pendingGoogle: { email: string; credential: OAuthCredential } | null = null;
  /**
   * The user who just proved it is them, kept for deleteUser: a 410 seen by
   * another tab can sign this browser out (Firebase shares the sign-in between
   * tabs) before the delete runs, and then there is no current user left.
   */
  let proven: User | null = null;

  return {
    onUserChange: (listener) => onAuthStateChanged(auth, (user) => listener(toUser(user))),

    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      // Always offer the account chooser: on a shared computer the last Google account is not always the Learner.
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        const clash = error as FirebaseError;
        const email = clash.customData?.email;
        const credential = GoogleAuthProvider.credentialFromError(clash);
        if (clash.code === 'auth/account-exists-with-different-credential' && typeof email === 'string' && credential)
          pendingGoogle = { email: email.toLowerCase(), credential };
        throw error;
      }
    },

    async signInWithEmail(email, password) {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const pending = pendingGoogle;
      pendingGoogle = null;
      // Best effort: the Learner is signed in either way.
      if (pending && pending.email === user.email?.toLowerCase())
        await linkWithCredential(user, pending.credential).catch(() => undefined);
    },

    async signUpWithEmail(email, password) {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      // Not awaited, and a failure is silent: the Learner is signed in and saving already.
      void sendEmailVerification(user).catch(() => undefined);
    },

    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),

    signOut: () => firebaseSignOut(auth),

    async getIdToken() {
      return auth.currentUser ? auth.currentUser.getIdToken() : null;
    },

    reauthMethod() {
      if (!auth.currentUser) return null;
      const providers = auth.currentUser.providerData.map((info) => info.providerId);
      return providers.includes('password') && !providers.includes('google.com') ? 'password' : 'google';
    },

    async reauthenticateWithGoogle() {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await reauthenticateWithPopup(user, provider);
      proven = user;
    },

    async reauthenticateWithPassword(password) {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('Not signed in');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      proven = user;
    },

    async deleteUser() {
      const user = proven ?? auth.currentUser;
      proven = null;
      if (!user) throw new Error('Not signed in');
      await firebaseDeleteUser(user);
    },

    async sendConfirmEmail() {
      if (!auth.currentUser) throw new Error('Not signed in');
      await sendEmailVerification(auth.currentUser);
    },

    async refreshUser() {
      await auth.currentUser?.reload();
      return toUser(auth.currentUser);
    },
  };
}
