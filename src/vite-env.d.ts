/// <reference types="vite/client" />

/**
 * Build-time settings, from the environment or the gitignored root .env. All
 * are optional: without the Firebase ones the app is a Guest-only build with
 * no Sign in button, and without VITE_API_URL nothing is sent to a server.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
