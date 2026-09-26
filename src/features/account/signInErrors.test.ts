import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signInErrorMessage } from './signInErrors.ts';

const withCode = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

test('a closed popup is explained, not reported as a failure', () => {
  assert.match(signInErrorMessage(withCode('auth/popup-closed-by-user')) ?? '', /closed/);
});

test('a second click that replaced the first popup says nothing', () => {
  assert.equal(signInErrorMessage(withCode('auth/cancelled-popup-request')), null);
});

test('a blocked popup tells the Learner what to do', () => {
  assert.match(signInErrorMessage(withCode('auth/popup-blocked')) ?? '', /allow pop-ups/i);
});

test('no network is named as such', () => {
  assert.match(signInErrorMessage(withCode('auth/network-request-failed')) ?? '', /connection/i);
});

test('anything else gets one plain sentence, never the raw Firebase text', () => {
  const message = signInErrorMessage(withCode('auth/internal-error'));
  assert.ok(message);
  assert.doesNotMatch(message, /Firebase|auth\//);
  assert.equal(signInErrorMessage(new Error('boom')), message);
  assert.equal(signInErrorMessage('not even an error'), message);
});
