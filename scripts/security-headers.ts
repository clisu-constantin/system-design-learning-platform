/**
 * The Content-Security-Policy of the built app.
 *
 * The API and the Firebase auth domain differ per environment (local, staging,
 * production) and are only known at build time, from the VITE_* variables, so
 * the policy is written into dist/serve.json by vite-plugin-security-headers.ts
 * rather than fixed in public/serve.json. With neither variable set (a Guest-only
 * build, such as CI) the policy is exactly the one in public/serve.json.
 *
 * What Firebase sign-in with a popup needs, and nothing more:
 * - connect-src identitytoolkit.googleapis.com (sign-in, project config) and
 *   securetoken.googleapis.com (refreshing the ID token);
 * - script-src apis.google.com: the popup flow loads the Google API loader
 *   (apis.google.com/js/api.js) to talk to the auth domain;
 * - frame-src https://<auth domain>: that loader opens a hidden iframe at
 *   /__/auth/iframe, which receives the popup result. The popup itself is a
 *   window, which no directive governs.
 *
 * No imports, so Node runs this file and its test as they are.
 */

export interface CspSources {
  /** VITE_API_URL - only its origin is allowed. */
  apiUrl?: string;
  /** VITE_FIREBASE_AUTH_DOMAIN - a bare host name, such as my-app.firebaseapp.com. */
  firebaseAuthDomain?: string;
}

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function apiOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`VITE_API_URL is not a URL: ${JSON.stringify(value)}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error(`VITE_API_URL must be an http(s) URL: ${JSON.stringify(value)}`);
  return url.origin;
}

function authDomain(value: string): string {
  if (!HOST.test(value))
    throw new Error(`VITE_FIREBASE_AUTH_DOMAIN must be a bare host name such as my-app.firebaseapp.com: ${JSON.stringify(value)}`);
  return value.toLowerCase();
}

const present = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

export function contentSecurityPolicy(sources: CspSources): string {
  const api = present(sources.apiUrl);
  const auth = present(sources.firebaseAuthDomain);

  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", ...(auth ? ['https://apis.google.com'] : [])]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:']],
    ['font-src', ["'self'"]],
    [
      'connect-src',
      [
        "'self'",
        ...(api ? [apiOrigin(api)] : []),
        ...(auth ? ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'] : []),
      ],
    ],
    // Without it, frames fall back to default-src 'self'; the app itself has no frames.
    ...(auth ? [['frame-src', [`https://${authDomain(auth)}`]] as [string, string[]]] : []),
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
  ];

  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

interface Header {
  key: string;
  value: string;
}

interface ServeJson {
  headers: { source: string; headers: Header[] }[];
}

/** A copy of the parsed serve.json with its Content-Security-Policy replaced. */
export function withContentSecurityPolicy<T extends ServeJson>(serveJson: T, csp: string): T {
  let replaced = false;
  const headers = serveJson.headers.map((rule) => ({
    ...rule,
    headers: rule.headers.map((header) => {
      if (header.key !== 'Content-Security-Policy') return header;
      replaced = true;
      return { ...header, value: csp };
    }),
  }));
  if (!replaced) throw new Error('serve.json has no Content-Security-Policy header to replace');
  return { ...serveJson, headers };
}
