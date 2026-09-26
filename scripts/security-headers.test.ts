import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicy, withContentSecurityPolicy } from './security-headers.ts';

const TEMPLATE = JSON.parse(readFileSync(new URL('../public/serve.json', import.meta.url), 'utf8'));

function cspOf(serveJson: typeof TEMPLATE): string {
  for (const rule of serveJson.headers)
    for (const header of rule.headers) if (header.key === 'Content-Security-Policy') return header.value;
  throw new Error('no CSP');
}

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.split(' ')
    .slice(1);

test('with no API and no Firebase the policy is exactly the one in public/serve.json', () => {
  assert.equal(contentSecurityPolicy({}), cspOf(TEMPLATE));
});

test('empty variables count as missing', () => {
  assert.equal(contentSecurityPolicy({ apiUrl: '  ', firebaseAuthDomain: '' }), cspOf(TEMPLATE));
});

test('the API is allowed by its origin only, for fetch only', () => {
  const csp = contentSecurityPolicy({ apiUrl: 'https://api.example.com/v1/' });

  assert.deepEqual(directive(csp, 'connect-src'), ["'self'", 'https://api.example.com']);
  assert.deepEqual(directive(csp, 'script-src'), ["'self'"]);
  assert.equal(directive(csp, 'frame-src'), undefined);
});

test('a local API keeps its port', () => {
  const csp = contentSecurityPolicy({ apiUrl: 'http://localhost:8000' });

  assert.deepEqual(directive(csp, 'connect-src'), ["'self'", 'http://localhost:8000']);
});

test('Firebase sign-in allows its token APIs, the Google script loader and the auth domain frame', () => {
  const csp = contentSecurityPolicy({ firebaseAuthDomain: 'demo.firebaseapp.com' });

  assert.deepEqual(directive(csp, 'connect-src'), [
    "'self'",
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
  ]);
  assert.deepEqual(directive(csp, 'script-src'), ["'self'", 'https://apis.google.com']);
  assert.deepEqual(directive(csp, 'frame-src'), ['https://demo.firebaseapp.com']);
});

test('both together, and nothing else changes', () => {
  const csp = contentSecurityPolicy({ apiUrl: 'https://api.example.com', firebaseAuthDomain: 'auth.example.com' });

  assert.equal(
    csp,
    "default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.com " +
      'https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; ' +
      "frame-src https://auth.example.com; object-src 'none'; base-uri 'none'; form-action 'none'; " +
      "frame-ancestors 'none'",
  );
});

test('a value that could inject a directive fails the build instead of widening the policy', () => {
  assert.throws(() => contentSecurityPolicy({ apiUrl: 'not a url' }), /VITE_API_URL/);
  assert.throws(() => contentSecurityPolicy({ apiUrl: 'javascript:alert(1)' }), /VITE_API_URL/);
  assert.throws(() => contentSecurityPolicy({ firebaseAuthDomain: "x.com; script-src 'unsafe-eval'" }), /VITE_FIREBASE_AUTH_DOMAIN/);
  assert.throws(() => contentSecurityPolicy({ firebaseAuthDomain: 'https://x.firebaseapp.com' }), /VITE_FIREBASE_AUTH_DOMAIN/);
  assert.throws(() => contentSecurityPolicy({ firebaseAuthDomain: '*.firebaseapp.com' }), /VITE_FIREBASE_AUTH_DOMAIN/);
});

test('the policy replaces the one in serve.json and leaves every other header as it was', () => {
  const csp = contentSecurityPolicy({ firebaseAuthDomain: 'demo.firebaseapp.com' });
  const result = withContentSecurityPolicy(TEMPLATE, csp);

  assert.equal(cspOf(result), csp);
  // The template is not modified.
  assert.notEqual(cspOf(TEMPLATE), csp);
  const strip = (json: typeof TEMPLATE) => JSON.stringify(json).replace(cspOf(json), '');
  assert.equal(strip(result), strip(TEMPLATE));
});

test('a serve.json with no policy to replace is an error, not a silent pass', () => {
  assert.throws(() => withContentSecurityPolicy({ headers: [] }, "default-src 'self'"), /Content-Security-Policy/);
});
