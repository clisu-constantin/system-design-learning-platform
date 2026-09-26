import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteAccountMessage } from './deleteAccountMessages.ts';

const confirm = (code: string) => ({ step: 'confirm' as const, error: { code } });

test('every failure says that nothing was deleted, or needs no message', () => {
  const failures = [
    confirm('auth/popup-closed-by-user'),
    confirm('auth/user-mismatch'),
    confirm('auth/invalid-credential'),
    confirm('auth/network-request-failed'),
    confirm('auth/something-new'),
    { step: 'server' as const, reason: 'server' },
  ];
  for (const failure of failures) assert.match(deleteAccountMessage(failure) ?? '', /nothing was deleted/i);
});

test('a wrong password and a different Google account are named plainly', () => {
  assert.equal(deleteAccountMessage(confirm('auth/wrong-password')), 'That password is not right, so nothing was deleted.');
  assert.equal(deleteAccountMessage(confirm('auth/invalid-credential')), 'That password is not right, so nothing was deleted.');
  assert.match(deleteAccountMessage(confirm('auth/user-mismatch'))!, /different Google account/);
});

test('a second click that replaced the popup says nothing', () => {
  assert.equal(deleteAccountMessage(confirm('auth/cancelled-popup-request')), null);
});

test('no connection to the server reads differently from a server that failed', () => {
  assert.notEqual(
    deleteAccountMessage({ step: 'server', reason: 'timeout' }),
    deleteAccountMessage({ step: 'server', reason: 'server' }),
  );
  assert.equal(deleteAccountMessage({ step: 'server', reason: 'timeout' }), deleteAccountMessage({ step: 'server', reason: 'offline' }));
});

test('a lost answer from the server does not claim that nothing was deleted - the delete may have finished', () => {
  for (const reason of ['offline', 'timeout']) {
    const message = deleteAccountMessage({ step: 'server', reason }) ?? '';
    assert.doesNotMatch(message, /nothing was deleted/i);
    assert.match(message, /try again/i);
  }
});
