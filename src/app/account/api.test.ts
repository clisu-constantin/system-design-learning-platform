import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, apiUrlFrom } from './api.ts';

type FetchCall = { url: string; init: RequestInit };

function fakeFetch(respond: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('sends the token as a bearer header and returns the JSON body', async () => {
  const { fetch, calls } = fakeFetch(() => json(200, { email: 'ada@example.com' }));

  const result = await apiFetch<{ email: string }>('/me', { baseUrl: 'https://api.example.com', token: 't0k', fetch });

  assert.deepEqual(result, { ok: true, status: 200, data: { email: 'ada@example.com' } });
  assert.equal(calls[0].url, 'https://api.example.com/me');
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer t0k');
  assert.equal(calls[0].init.method, 'GET');
});

test('a body is sent as JSON', async () => {
  const { fetch, calls } = fakeFetch(() => json(200, { concepts: {} }));

  await apiFetch('/progress', { baseUrl: 'https://api.example.com', token: 't', method: 'POST', body: { concepts: {} }, fetch });

  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, '{"concepts":{}}');
  assert.equal(new Headers(calls[0].init.headers).get('Content-Type'), 'application/json');
});

test('204 is a success with no data', async () => {
  const { fetch } = fakeFetch(() => new Response(null, { status: 204 }));

  assert.deepEqual(await apiFetch('/me', { baseUrl: 'https://api.example.com', token: 't', method: 'DELETE', fetch }), {
    ok: true,
    status: 204,
    data: undefined,
  });
});

test('each failure has its own reason, so the caller can react to a deleted Account only', async () => {
  const cases: [number, string][] = [
    [401, 'unauthorized'],
    [410, 'gone'],
    [400, 'rejected'],
    [413, 'rejected'],
    [422, 'rejected'],
    // Not about the body: a proxy, a rate limit or a timeout. Sending again later can work.
    [404, 'server'],
    [408, 'server'],
    [429, 'server'],
    [500, 'server'],
    [503, 'server'],
  ];
  for (const [status, reason] of cases) {
    const { fetch } = fakeFetch(() => json(status, { detail: 'x' }));
    const result = await apiFetch('/me', { baseUrl: 'https://api.example.com', token: 't', fetch });
    assert.deepEqual(result, { ok: false, status, reason }, `status ${status}`);
  }
});

test('no network is a quiet failure, not a throw', async () => {
  const { fetch } = fakeFetch(() => {
    throw new TypeError('Failed to fetch');
  });

  assert.deepEqual(await apiFetch('/me', { baseUrl: 'https://api.example.com', token: 't', fetch }), {
    ok: false,
    status: 0,
    reason: 'offline',
  });
});

test('a server that does not answer in time is aborted', async () => {
  const { fetch } = fakeFetch(
    ({ init }) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );

  const result = await apiFetch('/me', { baseUrl: 'https://api.example.com', token: 't', timeoutMs: 20, fetch });

  assert.deepEqual(result, { ok: false, status: 0, reason: 'timeout' });
});

test('a success whose body is not JSON counts as a server failure', async () => {
  const { fetch } = fakeFetch(() => new Response('<html>proxy error</html>', { status: 200 }));

  const result = await apiFetch('/me', { baseUrl: 'https://api.example.com', token: 't', fetch });

  assert.deepEqual(result, { ok: false, status: 200, reason: 'server' });
});

test('the API address is trimmed of a trailing slash, and missing means no server', () => {
  assert.equal(apiUrlFrom('https://api.example.com/'), 'https://api.example.com');
  assert.equal(apiUrlFrom(' http://localhost:8000 '), 'http://localhost:8000');
  assert.equal(apiUrlFrom(''), null);
  assert.equal(apiUrlFrom(undefined), null);
});
