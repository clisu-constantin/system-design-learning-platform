import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterAuthChange, afterMarkChange, firebaseConfigFrom, startStatus } from './accountState.ts';

test('a browser that was never signed in starts as a Guest and does not load Firebase', () => {
  assert.equal(startStatus({ configured: true, marked: false }), 'guest');
});

test('a browser that was signed in here restores the Account', () => {
  assert.equal(startStatus({ configured: true, marked: true }), 'restoring');
});

test('a build without Firebase is a Guest even with a mark left from another build', () => {
  assert.equal(startStatus({ configured: false, marked: true }), 'guest');
});

test('a signed-in user sets the mark and keeps the progress on this device', () => {
  assert.deepEqual(afterAuthChange({ email: 'ada@example.com' }, { previous: 'guest', marked: false }), {
    status: 'signed-in',
    email: 'ada@example.com',
    mark: 'set',
    clearProgress: false,
    confirmPending: false,
  });
});

test('a restored user keeps the progress on this device', () => {
  const next = afterAuthChange({ email: null }, { previous: 'restoring', marked: true });

  assert.equal(next.status, 'signed-in');
  assert.equal(next.email, null);
  assert.equal(next.clearProgress, false);
});

test('signing out clears the progress on this device and the mark', () => {
  assert.deepEqual(afterAuthChange(null, { previous: 'signed-in', marked: true }), {
    status: 'guest',
    email: null,
    mark: 'remove',
    clearProgress: true,
    confirmPending: false,
  });
});

test('a mark with no user behind it (session ended elsewhere) still leaves an empty Guest', () => {
  const next = afterAuthChange(null, { previous: 'restoring', marked: true });

  assert.equal(next.status, 'guest');
  assert.equal(next.clearProgress, true);
  assert.equal(next.mark, 'remove');
});

test('a tab still signed in clears its own progress even after another tab removed the mark', () => {
  // The other tab cleared storage, but this one still holds the progress in memory and would save it back.
  assert.equal(afterAuthChange(null, { previous: 'signed-in', marked: false }).clearProgress, true);
});

test('a Guest who opens sign-in and gets no user is left alone', () => {
  assert.deepEqual(afterAuthChange(null, { previous: 'guest', marked: false }), {
    status: 'guest',
    email: null,
    mark: 'keep',
    clearProgress: false,
    confirmPending: false,
  });
});

test('signing out twice clears once', () => {
  const first = afterAuthChange(null, { previous: 'signed-in', marked: true });
  const second = afterAuthChange(null, { previous: first.status, marked: false });

  assert.equal(second.clearProgress, false);
});

const FULL_ENV = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
};

test('the Firebase config needs all four variables', () => {
  assert.deepEqual(firebaseConfigFrom(FULL_ENV), {
    apiKey: 'key',
    authDomain: 'demo.firebaseapp.com',
    projectId: 'demo',
    appId: '1:2:web:3',
  });
  assert.equal(firebaseConfigFrom({ ...FULL_ENV, VITE_FIREBASE_APP_ID: undefined }), null);
  assert.equal(firebaseConfigFrom({ ...FULL_ENV, VITE_FIREBASE_API_KEY: '  ' }), null);
  assert.equal(firebaseConfigFrom({}), null);
});

test('a password Account whose email is not confirmed yet is reported, so the Account page can ask for it', () => {
  assert.equal(afterAuthChange({ email: 'ada@example.com', confirmPending: true }, { previous: 'guest', marked: false }).confirmPending, true);
  assert.equal(afterAuthChange({ email: 'ada@example.com' }, { previous: 'guest', marked: false }).confirmPending, false);
});

test('a Guest tab restores the Account when another tab of this browser signs in', () => {
  assert.equal(afterMarkChange({ status: 'guest', configured: true, marked: true }), 'restore');
});

test('the mark changing in another tab means nothing to a tab that is signed in, or with no Firebase', () => {
  assert.equal(afterMarkChange({ status: 'signed-in', configured: true, marked: true }), 'none');
  assert.equal(afterMarkChange({ status: 'restoring', configured: true, marked: true }), 'none');
  assert.equal(afterMarkChange({ status: 'guest', configured: false, marked: true }), 'none');
  // Signing out in another tab: Firebase tells this tab itself, if it has Firebase at all.
  assert.equal(afterMarkChange({ status: 'guest', configured: true, marked: false }), 'none');
});
