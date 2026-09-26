import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailFromSignInError, passwordResetErrorMessage, signInErrorMessage, type SignInAction } from './signInErrors.ts';

const withCode = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

/** No Firebase wording, no code, one sentence or two. */
function assertPlain(message: string | null) {
  assert.ok(message, 'expected a message');
  assert.doesNotMatch(message, /Firebase|auth\/|\(|_/);
}

test('a closed popup is explained, not reported as a failure', () => {
  assert.match(signInErrorMessage(withCode('auth/popup-closed-by-user')) ?? '', /closed/);
});

test('a second click that replaced the first popup says nothing', () => {
  assert.equal(signInErrorMessage(withCode('auth/cancelled-popup-request')), null);
});

test('a blocked popup tells the Learner what to do', () => {
  assert.match(signInErrorMessage(withCode('auth/popup-blocked')) ?? '', /allow pop-ups/i);
});

test('no network is named as such, for every way to sign in', () => {
  for (const action of ['google', 'sign-in', 'sign-up'] as SignInAction[])
    assert.match(signInErrorMessage(withCode('auth/network-request-failed'), action) ?? '', /connection/i);
});

test('anything else gets one plain sentence, never the raw Firebase text', () => {
  const message = signInErrorMessage(withCode('auth/internal-error'));
  assertPlain(message);
  assert.equal(signInErrorMessage(new Error('boom')), message);
  assert.equal(signInErrorMessage('not even an error'), message);
});

// --- email and password ------------------------------------------------------

test('a wrong password, an unknown email and a bad credential read the same, so no one learns who has an Account', () => {
  const invalid = signInErrorMessage(withCode('auth/invalid-credential'), 'sign-in');
  assertPlain(invalid);
  assert.match(invalid ?? '', /email or password/i);
  assert.equal(signInErrorMessage(withCode('auth/wrong-password'), 'sign-in'), invalid);
  assert.equal(signInErrorMessage(withCode('auth/user-not-found'), 'sign-in'), invalid);
});

test('a wrong password points a Google Learner to the Google button', () => {
  assert.match(signInErrorMessage(withCode('auth/invalid-credential'), 'sign-in') ?? '', /Continue with Google/);
});

test('an email that already has an Account says how to get in instead', () => {
  const message = signInErrorMessage(withCode('auth/email-already-in-use'), 'sign-up');
  assertPlain(message);
  assert.match(message ?? '', /already has an Account/);
  assert.match(message ?? '', /Sign in/);
  assert.match(message ?? '', /Google/);
});

test('a Google sign-in for an email that has a password points to the password', () => {
  const message = signInErrorMessage(withCode('auth/account-exists-with-different-credential'), 'google');
  assertPlain(message);
  assert.match(message ?? '', /password/i);
});

test('a weak password names the rule', () => {
  assert.match(signInErrorMessage(withCode('auth/weak-password'), 'sign-up') ?? '', /6 characters/);
  assertPlain(signInErrorMessage(withCode('auth/password-does-not-meet-requirements'), 'sign-up'));
});

test('a malformed or missing email, or a missing password, is named', () => {
  assert.match(signInErrorMessage(withCode('auth/invalid-email'), 'sign-in') ?? '', /email address/i);
  assert.match(signInErrorMessage(withCode('auth/missing-email'), 'sign-up') ?? '', /email/i);
  assert.match(signInErrorMessage(withCode('auth/missing-password'), 'sign-in') ?? '', /password/i);
});

test('too many tries asks the Learner to wait, and offers a reset when signing in', () => {
  assert.match(signInErrorMessage(withCode('auth/too-many-requests'), 'google') ?? '', /wait/i);
  assert.match(signInErrorMessage(withCode('auth/too-many-requests'), 'sign-in') ?? '', /Forgot password/);
});

test('a method that is switched off names that method', () => {
  assert.match(signInErrorMessage(withCode('auth/operation-not-allowed'), 'google') ?? '', /Google/);
  assert.match(signInErrorMessage(withCode('auth/operation-not-allowed'), 'sign-in') ?? '', /email and password/);
  assert.match(signInErrorMessage(withCode('auth/admin-restricted-operation'), 'sign-up') ?? '', /cannot be created/);
});

test('every mapped code is plain for every action', () => {
  const codes = [
    'auth/invalid-credential',
    'auth/wrong-password',
    'auth/user-not-found',
    'auth/email-already-in-use',
    'auth/weak-password',
    'auth/invalid-email',
    'auth/missing-email',
    'auth/missing-password',
    'auth/too-many-requests',
    'auth/network-request-failed',
    'auth/operation-not-allowed',
    'auth/user-disabled',
    'auth/account-exists-with-different-credential',
    'auth/admin-restricted-operation',
    'auth/password-does-not-meet-requirements',
  ];
  for (const action of ['google', 'sign-in', 'sign-up'] as SignInAction[])
    for (const code of codes) assertPlain(signInErrorMessage(withCode(code), action));
});

// --- password reset ----------------------------------------------------------

test('a reset for an unknown email looks sent, so it does not reveal who has an Account', () => {
  assert.equal(passwordResetErrorMessage(withCode('auth/user-not-found')), null);
});

test('a reset that really failed says why, in plain words', () => {
  assert.match(passwordResetErrorMessage(withCode('auth/invalid-email')) ?? '', /email address/i);
  assert.match(passwordResetErrorMessage(withCode('auth/network-request-failed')) ?? '', /connection/i);
  assert.match(passwordResetErrorMessage(withCode('auth/too-many-requests')) ?? '', /wait/i);
  const other = passwordResetErrorMessage(withCode('auth/internal-error'));
  assertPlain(other);
  assert.match(other ?? '', /reset email/i);
  assert.equal(passwordResetErrorMessage(new Error('boom')), other);
});

// --- the email of a clashing Google sign-in ----------------------------------

test('the email Firebase attaches to a clashing Google sign-in is read, and nothing else', () => {
  const clash = Object.assign(withCode('auth/account-exists-with-different-credential'), {
    customData: { email: 'ada@example.com' },
  });
  assert.equal(emailFromSignInError(clash), 'ada@example.com');
  assert.equal(emailFromSignInError(withCode('auth/account-exists-with-different-credential')), null);
  assert.equal(emailFromSignInError(Object.assign(withCode('x'), { customData: { email: 42 } })), null);
  assert.equal(emailFromSignInError(null), null);
});
