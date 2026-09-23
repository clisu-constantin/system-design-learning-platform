import type { Concept } from '@/types';

export const securityConcepts: Concept[] = [
  {
    slug: 'authentication',
    title: 'Authentication',
    tagline: 'Proving who the caller is.',
    category: 'security',
    difficulty: 'Beginner',
    lab: 'auth',
    labFocus: 'authentication',
    keywords: ['identity', 'session', 'password', 'mfa', 'token', '401'],
    what: 'Authentication establishes the identity of the caller: a user logging in, a service calling another service, or a device presenting a certificate.',
    why: 'Every access decision depends on it. If identity can be forged, no amount of authorization logic helps.',
    how: [
      'Verify a credential (password, passkey, API key, certificate) against a trusted record.',
      'Issue a session id in a cookie, or a signed token, that proves the identity on every later request.',
      'Store passwords only as slow salted hashes (Argon2id, scrypt, bcrypt) - never reversible, never fast.',
      'Answer 401 Unauthorized when a request carries no valid credential: the caller must authenticate first.',
      'Add a second factor for anything sensitive; a stolen password alone is then not enough.',
    ],
    when: [
      'Every endpoint that is not deliberately public.',
      'Service-to-service calls, with API keys, mutual TLS or client-credential tokens.',
      'Again before sensitive actions (change email, pay out), even inside a valid session.',
    ],
    advantages: [
      'Every later decision - permissions, quotas, audit logs - has a known identity to hang on.',
      'Revoking one session or key cuts off one caller without touching the others.',
    ],
    diagram: `POST /login  (email, password)
  -> verify the salted hash (Argon2id / bcrypt)
  -> Set-Cookie: sid=7f3a...; HttpOnly; Secure; SameSite=Lax

GET /invoices/4711   Cookie: sid=7f3a...
  -> session found: user 42  -> on to the permission check

GET /invoices/4711   (no cookie)
  -> 401 Unauthorized + WWW-Authenticate`,
    tradeoffs: [
      {
        approach: 'Server-side sessions',
        gains: ['Instant revocation: delete the session row', 'Small opaque cookie', 'Server controls the truth'],
        costs: ['Session store lookup per request', 'Shared state to operate'],
      },
      {
        approach: 'Stateless tokens (JWT)',
        gains: ['No lookup', 'Scales across services and regions'],
        costs: ['Revocation before expiry needs a denylist - the lookup comes back', 'Token bloat on every request'],
      },
      {
        approach: 'Multi-factor authentication',
        gains: ['A stolen or reused password alone no longer logs in', 'Ends credential stuffing as an attack class'],
        costs: ['Friction at login', 'Recovery flows for lost devices, which are an attack path themselves', 'SMS codes stay phishable; passkeys need newer devices'],
      },
    ],
    mistakes: [
      'Confusing authentication with authorization - knowing who someone is says nothing about what they may do.',
      'Storing passwords with a fast hash such as SHA-256, or encrypted instead of hashed.',
      'Answering 403 for a missing or expired login: 401 tells the client to authenticate again, 403 tells it not to bother.',
      'Different messages for "no such user" and "wrong password", which lets an attacker list the valid accounts.',
    ],
    related: ['authorization', 'api-keys', 'jwt', 'oauth', 'stateless-applications'],
    quiz: [
      {
        id: 'authn-1',
        prompt:
          'In the Auth Lab you pick "Anonymous - no credential" and send GET /invoices/4711. Which component answers, and with what?',
        options: [
          'The invoices service, with 403 Forbidden',
          'The API gateway, with 401 Unauthorized',
          'The database, with 404 Not Found',
          'The API gateway, with 403 Forbidden',
        ],
        answer: 1,
        explanation:
          'With no credential there is no identity, so the gateway stops the request at the first checkpoint with 401 - nothing reaches the service or the database. 403 is the tempting pick, but 403 means "we know who you are and you may not"; here nobody is known yet.',
      },
      {
        id: 'authn-2',
        prompt:
          'Alice has been idle for 45 minutes and the session idle timeout is 30 minutes. Her next request gets a 401. What should the web client do?',
        options: [
          'Show "you do not have permission" and stop',
          'Retry the same request with exponential backoff',
          'Send her to log in again, then repeat the request',
          'Ask an admin to grant her a role',
        ],
        answer: 2,
        explanation:
          'A 401 says the credential is missing or no longer valid, and the fix is to authenticate again - the Lab shows the gateway rejecting the expired session after the store lookup. Retrying the same expired cookie gets the same 401, and asking for a role treats it like a 403, which it is not.',
      },
      {
        id: 'authn-3',
        prompt:
          'An attacker tries 5 million email and password pairs leaked from another site, spread over 10,000 IP addresses. You already rate limit per IP. Which added control ends this attack?',
        options: [
          'Multi-factor authentication, so a correct password alone does not log in',
          'Stricter per-IP limits',
          'Requiring a digit and a symbol in every password',
          'Forcing every user to change password every 90 days',
        ],
        answer: 0,
        explanation:
          'Credential stuffing works because the password is correct; MFA makes a correct password insufficient. Per-IP limits only slow an attacker with 10,000 addresses. Composition rules and forced periodic changes are what NIST SP 800-63B now forbids: they push people to predictable patterns and do nothing about a password reused from another breach.',
      },
      {
        id: 'authn-4',
        prompt:
          'Your user table leaks. The attacker has one RTX 4090 and a list of 1 billion likely passwords. What does storing bcrypt at cost 12 instead of unsalted SHA-256 change?',
        options: [
          'Nothing - a leaked hash is a leaked password',
          'Only that rainbow tables stop working; the speed is the same',
          'bcrypt can be decrypted with the server key, SHA-256 cannot',
          'Each guess costs about 15 million times more: the list takes about 8 days per hash instead of under a second',
        ],
        answer: 3,
        explanation:
          'Hashcat benchmarks on that GPU give about 22 billion SHA-256 guesses per second and about 1,400 bcrypt cost-12 guesses per second, so 1 billion guesses take 0.05 s against 8 days - per user, because each has its own salt. Salting alone would stop rainbow tables but not fast guessing, and no password hash is meant to be decrypted.',
      },
      {
        id: 'authn-5',
        prompt:
          'A requirement says: "an admin must be able to log a stolen account out everywhere, immediately". You are choosing between server-side sessions and 24-hour JWTs with no denylist. What follows?',
        options: [
          'JWTs, because they are verified without a lookup',
          'Server-side sessions: deleting the session row makes the next request a 401',
          'Either one - both can be revoked instantly',
          'Neither - revocation is impossible over HTTP',
        ],
        answer: 1,
        explanation:
          'A session lives in the store, so deleting it makes the next lookup fail - exactly the 401 path the Lab shows for a session that is not found. A signed JWT stays valid until it expires unless you add a denylist, which brings back the per-request lookup that JWTs were chosen to avoid.',
      },
      {
        id: 'authn-6',
        prompt:
          'Your login endpoint answers "No account with this email" or "Wrong password", depending on the case. What is the problem?',
        options: [
          'None - clear errors help users',
          'It is slower than a single message',
          'An attacker can test millions of emails and learn which ones have accounts here',
          'It breaks password managers',
        ],
        answer: 2,
        explanation:
          'Two different answers turn the login form into an account-lookup service, which feeds targeted phishing and credential stuffing. Use one message and similar timing for both cases. The "helps users" option is the tempting one, but a password reset link can help the real user without telling a stranger anything.',
      },
      {
        id: 'authn-7',
        prompt:
          'A pen test finds a cross-site scripting bug on your site. The session cookie was set without HttpOnly. What would HttpOnly have changed?',
        options: [
          'The injected script could not read the cookie from document.cookie, so it could not send the session away',
          'The XSS bug would not run at all',
          'The cookie would only be sent over HTTPS',
          'The cookie would not be sent on cross-site requests',
        ],
        answer: 0,
        explanation:
          'HttpOnly hides the cookie from JavaScript, which blocks the classic "steal the session id" payload. It does not fix the XSS itself. HTTPS-only is the Secure attribute and cross-site sending is SameSite - both matter, but neither stops a script on your own page from reading a readable cookie.',
      },
      {
        id: 'authn-8',
        prompt:
          'Your API answers 403 Forbidden when a request has no Authorization header at all. Mobile clients never show their login screen. What is the fix?',
        options: [
          'Answer 500 so clients retry',
          'Answer 404 so the endpoint stays hidden',
          'Keep 403 and add a message in the body',
          'Answer 401 Unauthorized with a WWW-Authenticate header',
        ],
        answer: 3,
        explanation:
          'RFC 9110 defines 401 as "lacks valid authentication credentials", and a server that sends it must include WWW-Authenticate - that is the signal client libraries use to start a login. 403 means the caller is known and refused, so a well-behaved client does not try to log in again.',
      },
      {
        id: 'authn-9',
        prompt:
          'Users receive one-time codes by SMS as a second factor, and a phishing site that relays codes in real time is taking over accounts. Which second factor stops this?',
        options: [
          'Longer SMS codes',
          'Passkeys (WebAuthn), which are bound to the real site origin',
          'Codes from an authenticator app',
          'A security question as the second step',
        ],
        answer: 1,
        explanation:
          'A passkey signs a challenge for the real origin only, so a look-alike domain gets nothing it can reuse - NIST lists this as phishing resistance. App codes are stronger than SMS but can still be typed into a phishing page and relayed. A security question is a second thing you know, so it is not a second factor at all.',
      },
      {
        id: 'authn-10',
        prompt:
          'Alice is logged in with a valid session. She changes the URL from /invoices/4711 to /invoices/9182, which belongs to another company. The gateway accepts her session. What stops the leak?',
        options: [
          'Nothing more is needed - she is authenticated',
          'Making her log in again',
          'An authorization check in the invoices service that compares the tenant of the invoice with hers',
          'A shorter session timeout',
        ],
        answer: 2,
        explanation:
          'Authentication only proved she is Alice; whether invoice 9182 is hers is a separate question that needs the invoice row. In the Lab this is the service answering 403 after the gateway passed her. Logging in again or shortening the session changes nothing, because her identity was never the problem.',
      },
      {
        id: 'authn-11',
        prompt:
          'Your password reset email contains a link that never expires and can be used many times. Why is that an authentication problem?',
        options: [
          'The link is a credential: anyone who finds the email later can take over the account, so make it single-use and short-lived',
          'It is not - reset links are not part of login',
          'It only matters if the password is weak',
          'The link should instead contain the new password',
        ],
        answer: 0,
        explanation:
          'Account recovery is another way to prove identity, and often the weakest one. A link that works forever turns every old email, forwarded message or leaked mailbox into a login. The tempting "it is not part of login" is exactly how recovery ends up less protected than the login form.',
      },
    ],
  },
  {
    slug: 'authorization',
    title: 'Authorization',
    tagline: 'Deciding what an authenticated caller is allowed to do.',
    category: 'security',
    difficulty: 'Beginner',
    lab: 'auth',
    labFocus: 'authorization',
    keywords: ['rbac', 'abac', 'permissions', 'idor', 'bola', 'policy', '403'],
    what: 'Authorization evaluates whether a given identity may perform a given action on a given resource.',
    why: 'Broken access control is number one in the OWASP Top 10 (2021), and broken object level authorization is number one in the OWASP API Security Top 10 (2023): change an object id in a URL and the data of someone else comes back.',
    how: [
      'RBAC: permissions attach to roles, roles attach to users - simple and auditable.',
      'ABAC/policy: decisions consider attributes (owner, tenant, time, IP) - flexible but harder to reason about.',
      'Check ownership on every object access, not just the route - ideally by querying scoped to the caller.',
      'Deny by default; make the permissive path explicit.',
      'Answer 403 Forbidden to a known caller who may not - or 404 when even the existence of the object is private.',
    ],
    when: [
      'Every request that reads or changes data owned by someone.',
      'Multi-tenant products: every query scoped by the tenant of the caller.',
      'Admin and destructive actions: role checks on the server, not only hidden buttons.',
    ],
    advantages: [
      'Limits each identity to its own data, so one stolen account is not a stolen database.',
      'Roles and scopes make least privilege something you can audit.',
    ],
    diagram: `GET /invoices/9182     Cookie: sid=7f3a...
  gateway:  session found -> user 42, tenant 3      (authentication)
  service:  invoice 9182 belongs to tenant 7
            7 is not 3 -> 403, or 404 to hide it    (authorization)

Missing that check = IDOR / BOLA, number one in the OWASP API Top 10.`,
    tradeoffs: [
      {
        approach: 'Centralised policy service',
        gains: ['One place to audit and change rules', 'Consistent across services'],
        costs: ['Extra call on the hot path', 'Becomes a critical dependency'],
      },
      {
        approach: 'In-service checks',
        gains: ['Fast, no extra hop', 'Local context available'],
        costs: ['Rules drift between services', 'Hard to audit centrally'],
      },
      {
        approach: 'RBAC (roles)',
        gains: ['Simple to explain and audit', 'Cheap to evaluate'],
        costs: ['Cannot express "only their own documents" without a role per object or tenant'],
      },
      {
        approach: 'ABAC / ReBAC (attributes, relationships)',
        gains: ['Expresses ownership, sharing and folder inheritance', 'Fits per-document permissions'],
        costs: ['Harder to reason about and audit', 'A check can walk a graph, so it needs caching or batching'],
      },
      {
        approach: '404 instead of 403 for private objects',
        gains: ['Does not confirm that an object id exists'],
        costs: ['Harder for honest clients and support to tell "missing" from "not allowed"'],
      },
    ],
    mistakes: [
      'Enforcing permissions only in the UI.',
      'Trusting a tenant id supplied by the client instead of the one from the authenticated identity.',
      'Loading an object by id and never checking who owns it (IDOR).',
      'Answering 401 to a known caller who lacks permission - the client asks for a login that cannot help.',
    ],
    related: ['authentication', 'api-keys', 'jwt', 'oauth', 'api-gateway'],
    quiz: [
      {
        id: 'authz-1',
        prompt:
          'In the Auth Lab, Alice (tenant 3) with a valid session sends GET /invoices/9182, which belongs to tenant 7. Where is the request stopped, and with what?',
        options: [
          'At the gateway, with 401, because the session is wrong',
          'At the database, which refuses the query',
          'At the invoices service, with 403, after the gateway accepted her identity',
          'Nowhere - it returns 200',
        ],
        answer: 2,
        explanation:
          'Her session is valid, so the gateway passes her on as user 42. Only the service can see that invoice 9182 is tenant 7, because that needs the row - so the service answers 403. A 401 would claim her identity is the problem, which it is not.',
      },
      {
        id: 'authz-2',
        prompt: 'In the same Lab setup you turn the Ownership check off. What happens, and what is it called?',
        options: [
          'Alice gets the invoice of tenant 7 with 200 OK - an IDOR, broken object level authorization',
          'Alice now gets 401, because the service cannot verify her',
          'The gateway starts checking ownership instead',
          'Nothing changes; roles still protect the invoice',
        ],
        answer: 0,
        explanation:
          'With only the role checked, any member may read any invoice, so the service returns data of another tenant with a success status - the Lab counts it as "200 to the wrong caller". Roles do not help: Alice may read invoices in general, just not this one.',
      },
      {
        id: 'authz-3',
        prompt:
          'You have an API gateway in front of a documents service. Where should the rule "user 42 may edit document 881 only if they own it" be enforced?',
        options: [
          'Only at the gateway, so the service stays simple',
          'In the browser, by hiding the Edit button',
          'In the database, with one account per user',
          'In the documents service, which has the document and its owner; the gateway can still do coarse checks',
        ],
        answer: 3,
        explanation:
          'The gateway sees a token and a URL, not who owns document 881. The owner is in the data, so the check belongs where the data is. In the Lab the gateway can refuse a DELETE by key scope on its own, but the tenant check has to wait for the invoice row in the service.',
      },
      {
        id: 'authz-4',
        prompt:
          'Members do not see a Delete button; only admins do. A member sends DELETE /invoices/4711 with curl. What should happen?',
        options: [
          'The invoice is deleted - the member got around the UI',
          'The server checks the role and answers 403 Forbidden',
          'The server answers 401 and asks the member to log in',
          'The request fails because curl cannot send cookies',
        ],
        answer: 1,
        explanation:
          'Hiding a button is a UI nicety, not a control; the server has to check the role on every request. In the Lab, Alice (member) gets 403 for DELETE while Bob (admin) gets 200. 401 is wrong because the member is authenticated - logging in again changes nothing.',
      },
      {
        id: 'authz-5',
        prompt:
          'A handler runs SELECT * FROM invoices WHERE id = ?, then compares invoice.tenant_id with the caller. It works, but new handlers keep forgetting the compare. What structural change fixes the class?',
        options: [
          'Add a code review checklist item',
          'Log every invoice read',
          'Query scoped to the caller: WHERE id = ? AND tenant_id = ?, enforced in a shared data-access layer',
          'Use random UUIDs instead of numeric ids',
        ],
        answer: 2,
        explanation:
          'A query that filters by the tenant of the caller cannot return another tenant row, so a forgotten check becomes impossible instead of discouraged. Random ids make guessing harder but an id that leaks through a link still works - that is obscurity, not authorization.',
      },
      {
        id: 'authz-6',
        prompt:
          'The API reads tenant_id from the JSON body of each request and uses it to scope queries. What is wrong?',
        options: [
          'The tenant must come from the authenticated identity on the server, not from input the client controls',
          'Nothing, as long as the request is over HTTPS',
          'It should be in a header instead of the body',
          'It should be in the URL instead',
        ],
        answer: 0,
        explanation:
          'Anything the client sends can be changed by the client, so a caller from tenant 3 sets tenant_id to 7 and reads their data. Moving the field to a header or the URL is the same mistake in a different place; HTTPS protects the value in transit, not from its own sender.',
      },
      {
        id: 'authz-7',
        prompt:
          'Invoice ids are sequential. Your API answers 403 for invoices of other tenants and 404 for ids that do not exist. What does an attacker learn, and what is the fix?',
        options: [
          'Nothing useful - 403 already refuses',
          'The attacker learns the invoice contents',
          'Which user owns each invoice; fix it with rate limiting',
          'Which invoice ids exist, and roughly how many invoices each tenant has; answer 404 for both cases',
        ],
        answer: 3,
        explanation:
          'Different answers for "exists but not yours" and "does not exist" turn the API into an existence oracle. RFC 9110 allows a server to answer 404 to hide a forbidden resource - the Lab toggle "Hide other tenants with 404" does exactly this. The contents stay safe either way, which is why the 403 looks sufficient.',
      },
      {
        id: 'authz-8',
        prompt:
          'Alice logged in at 09:00 with an 8-hour session. At 10:00 her admin role is removed. The service reads her role from the session, where it was copied at login. What happens?',
        options: [
          'She loses admin rights at 10:00',
          'She keeps admin rights until 17:00, unless permissions are re-checked on each request or the copy is invalidated',
          'She is logged out at 10:00',
          'She loses admin rights at the next login only if she changes her password',
        ],
        answer: 1,
        explanation:
          'A permission copied at login is a snapshot; revoking the role changes the database, not the snapshot. Re-check permissions on every request, or cache them briefly and invalidate on change. Nothing logs her out, because her identity did not change - only what she may do.',
      },
      {
        id: 'authz-9',
        prompt:
          'Your product adds document sharing: a user may edit a document if they own it, or belong to a group that edits a folder that contains it. RBAC now needs a role per folder. Which model fits?',
        options: [
          'Keep RBAC and create a role per folder',
          'Give everyone the editor role',
          'Relationship-based access control (ReBAC), as in Google Zanzibar',
          'Check permissions only in the UI',
        ],
        answer: 2,
        explanation:
          'Ownership, groups and folder inheritance are relationships, and ReBAC answers "is this user related to this object in a way that grants edit". A role per folder explodes in number and is hard to audit. RBAC stays the right start; it is the sharing and hierarchy that push you past it.',
      },
      {
        id: 'authz-10',
        prompt:
          'A central policy service decides every check. A listing page shows 50 documents and asks the policy service once per document, adding 50 network calls. What is the usual fix?',
        options: [
          'Skip the check for listings',
          'Move the check into the browser',
          'Check only the first document',
          'Batch the check ("which of these 50 may this user read") or evaluate the shared policy as a library in the service',
        ],
        answer: 3,
        explanation:
          'Centralise the policy, not necessarily the call: one batched question or a local policy library keeps the rules consistent without 50 hops. Skipping checks on listings is the classic leak - the report or search endpoint that returns rows of every tenant.',
      },
    ],
  },
  {
    slug: 'jwt',
    title: 'JWT',
    tagline: 'A signed claim set the server can verify without a lookup.',
    category: 'security',
    difficulty: 'Intermediate',
    lab: 'stateless',
    labFocus: 'jwt',
    keywords: ['token', 'claims', 'signature', 'revocation', 'refresh token', 'jwks', 'bearer'],
    what: 'A JSON Web Token carries claims (subject, expiry, scopes) in a base64url-encoded payload with a signature. Any service holding the verification key - a shared secret, or the public key of the issuer - can verify it without contacting an auth server.',
    why: 'It makes authentication stateless, which is what lets any instance in any region serve any request without a shared session store.',
    how: [
      'Sign with a strong algorithm and validate alg, issuer, audience and expiry on every request.',
      'Keep access tokens short-lived (5-15 minutes) and pair them with a longer-lived refresh token stored server-side.',
      'Store the refresh token where XSS cannot reach it - an HttpOnly cookie.',
      'Maintain a denylist of token ids for the short access-token window when immediate revocation matters.',
    ],
    when: [
      'Many services or regions must check identity without all calling one session store.',
      'An identity provider issues tokens that other services only verify (OAuth 2.0 and OpenID Connect).',
      'Machine-to-machine calls that need a signed, expiring credential instead of a static key.',
    ],
    advantages: [
      'Verification is local: no network hop, and no store that can go down.',
      'Any instance can serve any request, so the app tier stays disposable.',
      'The claims travel with the request, so downstream services know the caller without asking.',
    ],
    diagram: `header.payload.signature

{ "sub": "42", "exp": 1789..., "scope": "orders:read" }

Verification is local: no database call, any service can do it.
Consequence: a stolen token is valid until it expires.`,
    tradeoffs: [
      {
        approach: 'JWT access tokens',
        gains: ['No session lookup', 'Works across services and domains', 'Scales trivially'],
        costs: [
          'Cannot be revoked before expiry without extra state',
          'Payload is readable by anyone holding it - never put secrets in it',
          'Key rotation must be designed in',
        ],
      },
      {
        approach: 'Opaque session id + server-side store',
        gains: ['Instant revocation: delete one key', 'Tiny cookie, nothing readable inside it'],
        costs: ['A store lookup on every request', 'The store becomes a critical dependency'],
      },
      {
        approach: 'Short access token + refresh token',
        gains: ['Exposure after revocation is bounded by the access token lifetime', 'Most requests still need no lookup'],
        costs: ['A refresh flow in every client', 'The refresh tokens need a server-side store again'],
      },
      {
        approach: 'JWT + denylist check',
        gains: ['Revoked tokens rejected at once'],
        costs: ['A lookup on every request - the main advantage of JWT is gone', 'The denylist store must stay up, or requests fail'],
      },
    ],
    mistakes: [
      'Long-lived access tokens with no revocation path.',
      'Accepting alg: none or failing to pin the expected algorithm.',
      'Storing tokens in localStorage, where any XSS can read them.',
      'Skipping the aud check, so a token issued for another service is accepted.',
      'Removing the old signing key the moment a new one is published, which rejects every token still signed with it.',
    ],
    related: ['authentication', 'oauth', 'stateless-applications', 'api-gateway'],
    quiz: [
      {
        id: 'jwt-1',
        prompt:
          'In the Lab on Stateless JWT with 15-minute tokens, you click Revoke user A. What happens to the next requests that carry the stolen token of A?',
        options: [
          'Rejected at once, because every server learns about the logout',
          'Rejected by the server that issued the token, accepted by the others',
          'Accepted by every server until the exp claim passes, about 15 minutes later, then rejected',
          'Accepted forever, because a JWT never expires',
        ],
        answer: 2,
        explanation:
          'Verification uses only the key and the token, so nothing on the servers says it was revoked. The token is good until it expires. The issuing server is not special - they all hold the same key - and exp does end it.',
      },
      {
        id: 'jwt-2',
        prompt: 'Still in JWT mode, you kill Server 1 and Server 2. What happens to logged-in users?',
        options: [
          'Nothing they notice: Server 3 verifies every token with the same key',
          'Users whose token was issued by Server 1 or 2 must log in again',
          'Everyone is logged out, because the tokens were stored on the dead servers',
          'Requests queue until a second server comes back',
        ],
        answer: 0,
        explanation:
          'The session state is in the token the client carries, so no server holds anything to lose. The tempting answer assumes the issuing server matters; it does not, because any holder of the key can verify.',
      },
      {
        id: 'jwt-3',
        prompt:
          'A code review finds that the JWT payload carries the home address of the user and a password-reset code. What is wrong?',
        options: [
          'Nothing - the signature keeps the payload secret',
          'The token is now too long to sign',
          'Only the reset code is a problem, the address is harmless',
          'The payload is only base64url-encoded, so anyone who holds the token can read both',
        ],
        answer: 3,
        explanation:
          'A signature proves who made the token and that it was not changed; it does not hide anything. Paste any JWT into a decoder and the claims are plain JSON. Keep payloads to identifiers and scopes, or use an encrypted token (JWE).',
      },
      {
        id: 'jwt-4',
        prompt:
          'A verifier reads the algorithm from the token header. An attacker sends a token with alg: none and no signature. What happens?',
        options: [
          'The library rejects it, because every JWT has a signature',
          'It may be accepted as valid with no signature at all - so pin the expected algorithm in the verifier',
          'It is accepted only for read-only scopes',
          'The token is re-signed automatically',
        ],
        answer: 1,
        explanation:
          'The header is attacker-controlled. Trusting it enables alg: none and HS/RS confusion attacks, both described in the JWT best current practice (RFC 8725). The verifier, not the token, must decide which algorithm is allowed.',
      },
      {
        id: 'jwt-5',
        prompt:
          'The billing API and the reports API trust the same identity provider. A token issued for the reports API is replayed against the billing API. Which check stops it?',
        options: [
          'The exp check',
          'The signature check',
          'The aud (audience) check: the token says it was issued for reports, not billing',
          'Nothing can stop it',
        ],
        answer: 2,
        explanation:
          'The signature is valid - the same provider signed it - and it may not have expired. Only aud says who the token is for, so a service must reject a token whose audience is not itself.',
      },
      {
        id: 'jwt-6',
        prompt:
          'Access tokens live 60 minutes, and an abusive user must be cut off now. Which change does that, and at what cost?',
        options: [
          'Delete the token from the localStorage of the user - no cost',
          'Rotate the signing key - it logs out only that user',
          'Shorten new tokens to 5 minutes - the current token dies at once',
          'Add the token id to a denylist that every server checks - at the cost of a lookup on every request',
        ],
        answer: 3,
        explanation:
          'Deleting the client copy does nothing to a copy the attacker holds, and a shorter lifetime only affects tokens issued later. Rotating the key does cut the token off, but it logs out every user. The Lab shows the denylist trade: revoked tokens are rejected at once while Store lookups climbs with every request.',
      },
      {
        id: 'jwt-7',
        prompt:
          'Users complain that 10-minute access tokens force them to log in every 10 minutes. What keeps the short lifetime without the logins?',
        options: [
          'A refresh token: long-lived, stored server-side and revocable, used to get new access tokens silently',
          'Raise the access token lifetime to 30 days',
          'Store the password in the browser and log in automatically',
          'Turn off the exp check',
        ],
        answer: 0,
        explanation:
          'The access token stays short, so a stolen one is useful for at most 10 minutes. Revoking the refresh token stops new access tokens from being minted. A 30-day access token removes the logins but makes every leak last a month.',
      },
      {
        id: 'jwt-8',
        prompt:
          'One identity provider issues tokens and 30 microservices verify them. The team is choosing between HS256 (shared secret) and RS256 (key pair). What does RS256 change?',
        options: [
          'Tokens become encrypted',
          'The services hold only the public key, which can verify but not create tokens - so one compromised service cannot forge tokens for all',
          'Verification needs a call to the identity provider',
          'Nothing, the two are interchangeable',
        ],
        answer: 1,
        explanation:
          'With HS256 the same secret signs and verifies, so all 30 services could mint tokens. With RS256 only the provider holds the private key. Neither encrypts the payload, and both verify locally.',
      },
      {
        id: 'jwt-9',
        prompt:
          'A single-page app keeps its access token in localStorage. A compromised third-party script runs on the page. What can it do, and what reduces the risk?',
        options: [
          'Nothing - localStorage is sandboxed per script',
          'Only change the page layout',
          'Read the token and send it anywhere; an HttpOnly cookie keeps it out of JavaScript, paired with SameSite and a CSRF token',
          'Read the token, but it is useless outside the original browser',
        ],
        answer: 2,
        explanation:
          'Any script on the origin can read localStorage. A bearer token works from any machine that holds it - there is no binding to the browser. Cookies cannot be read by script when HttpOnly, but they are sent automatically, so CSRF defence comes with them.',
      },
      {
        id: 'jwt-10',
        prompt:
          'You publish a new signing key and remove the old one from the JWKS at the same moment. Access tokens live 15 minutes. What happens?',
        options: [
          'For up to 15 minutes, every token still signed with the old key fails verification and those users get errors',
          'Nothing - verifiers switch keys smoothly',
          'Old tokens keep working until they expire',
          'Every token is re-signed with the new key',
        ],
        answer: 0,
        explanation:
          'Verifiers find the key by kid. Remove it and the old tokens cannot be checked, so they are rejected. Keep the old public key published until the last token signed with it has expired, then retire it.',
      },
      {
        id: 'jwt-11',
        prompt:
          'In the Lab you turn on the denylist check in JWT mode and then click Kill Redis. What happens, and what does it show?',
        options: [
          'Nothing - JWT does not need Redis',
          'Only revoked tokens fail',
          'Servers skip the denylist and accept everything',
          'Every request fails, because the servers fail closed when they cannot check the denylist - JWT is now as dependent on a store as a session was',
        ],
        answer: 3,
        explanation:
          'Adding the denylist brought back a shared store and a lookup per request. Failing open would let every revoked token in during the outage, so the Lab fails closed, and Redis becomes as critical as it was for sessions.',
      },
    ],
  },
  {
    slug: 'oauth',
    title: 'OAuth 2.0',
    tagline: 'Delegated access: letting an app act for a user without their password.',
    category: 'security',
    difficulty: 'Advanced',
    lab: 'oauth',
    keywords: ['authorization code', 'pkce', 'scopes', 'refresh token', 'openid connect', 'redirect uri', 'state'],
    what: 'OAuth 2.0 is a delegation framework: a user authorises a client application to access a resource server on their behalf, and the client receives a scoped access token.',
    why: 'It removes the anti-pattern of giving your password to a third party, and it makes access narrow (scopes) and revocable.',
    how: [
      'Authorization code + PKCE is the flow for web, single-page and mobile apps.',
      'The user signs in and consents at the authorization server, which redirects back with a one-time code.',
      'The app swaps the code plus its code_verifier for a short-lived access token (and often a refresh token) in a direct call to the token endpoint.',
      'Scopes limit what the token can do; the resource server enforces them.',
      'OpenID Connect adds an identity layer (the ID token) on top of OAuth.',
    ],
    when: [
      'A third-party app needs access to user data held by another service - photos, a calendar, repositories.',
      'Signing users in with an external identity provider - through OpenID Connect, which is built on OAuth.',
      'A service calling an API as itself, with no user present - the client credentials grant.',
    ],
    advantages: [
      'The client app never handles the password of the user.',
      'Access is narrow (scopes) and can be revoked per app without changing the password.',
      'One authorization server can issue tokens for many apps and APIs.',
    ],
    diagram: `user (browser) -> client app          click Sign in
client app -> browser -> auth server  redirect: scope, state, code_challenge
user -> auth server                   password + consent (only here)
auth server -> browser -> client app  redirect: one-time code + state
client app -> auth server /token      code + code_verifier
auth server -> client app             access token (+ refresh token)
client app -> resource server         Bearer access token, scope checked`,
    tradeoffs: [
      {
        approach: 'Authorization code + PKCE',
        gains: [
          'Only a one-time code crosses the browser; tokens come back in a direct call',
          'A stolen code is useless without the code_verifier',
          'Works for web, single-page and mobile apps',
        ],
        costs: [
          'Two redirects, state and a token exchange to get right',
          'Every environment needs its exact redirect URI registered',
        ],
      },
      {
        approach: 'Implicit grant (legacy)',
        gains: ['One redirect and no token endpoint call'],
        costs: [
          'The access token arrives in the URL, where history, logs and Referer headers leak it',
          'Nothing binds the token to the app that asked; RFC 9700 says clients should not use it',
        ],
      },
      {
        approach: 'Password grant (legacy)',
        gains: ['No redirect: the app shows its own login form'],
        costs: [
          'The app sees the password - the exact thing OAuth exists to avoid',
          'Does not fit multi-factor or federated login; RFC 9700 says it must not be used',
        ],
      },
      {
        approach: 'Client credentials',
        gains: ['Simple machine-to-machine access with no user and no redirect'],
        costs: [
          'The token acts as the app itself, never on behalf of a user',
          'The client secret or key must be kept safe on a server',
        ],
      },
    ],
    mistakes: [
      'Using the implicit flow in new applications - superseded by code + PKCE.',
      'Matching redirect URIs by prefix or wildcard, so codes can be sent to an attacker - PKCE does not stop this.',
      'Skipping state and PKCE because the flow already works in testing.',
      'Treating an OAuth access token as proof of identity instead of using OpenID Connect.',
      'Requesting broad scopes up front instead of the minimum the feature needs.',
    ],
    realWorld: [
      'Sign in with Google, Microsoft or GitHub is OpenID Connect on top of the OAuth authorization code flow.',
      'Current guidance is RFC 9700 (OAuth 2.0 Security Best Current Practice, 2025) and the OAuth 2.1 draft, which drop the implicit and password grants.',
    ],
    related: ['jwt', 'authentication', 'authorization', 'api-keys'],
    quiz: [
      {
        id: 'oauth-1',
        prompt:
          'A photo-printing app wants to read the photos a user keeps at PhotoHub. The first design asks the user to type their PhotoHub password into the print app. What does OAuth change?',
        options: [
          'The print app stores the password encrypted instead of in plain text',
          'The user types the password only at the PhotoHub authorization server, and the print app receives a scoped token the user can revoke',
          'The print app sends the password to PhotoHub once and keeps the session cookie it gets back',
          'Nothing - OAuth only standardises how PhotoHub hashes the password',
        ],
        answer: 1,
        explanation:
          'OAuth takes the password out of the client entirely: the user signs in at the authorization server and the app gets a token limited by scope that can be revoked on its own. Encrypting or forwarding the password once still gives the print app the full credential, which is the problem OAuth exists to remove.',
      },
      {
        id: 'oauth-2',
        prompt:
          'In the Lab, PKCE is on. A malicious app on the phone catches the redirect, so it has the authorization code and the correct state value. It posts the code to /token. What happens?',
        options: [
          'Tokens are issued, because the state value matched',
          'Tokens are issued, but only with the photos.read scope',
          'The server answers invalid_grant: the attacker has no code_verifier that hashes to the stored code_challenge',
          'The tokens are issued, and the resource server refuses them later because they went to another device',
        ],
        answer: 2,
        explanation:
          'With PKCE the authorization server stored the code_challenge with the code and only redeems it for the matching code_verifier, which never left the real app. State does not help the attacker or the defender here: state is checked by the app at its callback, and the attacker skips the callback and goes straight to /token.',
      },
      {
        id: 'oauth-3',
        prompt:
          'A team says: we have PKCE, so we can relax redirect URI matching to a prefix check. An attacker then sends victims a real /authorize link for your client_id with redirect_uri=https://app.example.attacker.test/cb. What happens?',
        options: [
          'The code is sent to the attacker, who redeems it with its own verifier - the attacker built the link, so it made the challenge',
          'PKCE blocks it, because the attacker does not know the code_verifier',
          'The state check blocks it, because the attacker does not know the state',
          'Nothing, because the consent screen shows the attacker domain and every user will notice',
        ],
        answer: 0,
        explanation:
          'PKCE proves that whoever redeems the code started the flow - and here the attacker started it, with its own verifier and challenge. Only the authorization server comparing redirect_uri exactly with the registered value stops the code from being sent away. The Lab shows this: Tampered redirect_uri gets through with PKCE on until you turn on exact matching.',
      },
      {
        id: 'oauth-4',
        prompt:
          'Your callback does not check state and you have not added PKCE. An attacker gets a code for an account the attacker controls and makes the browser of a victim open https://app.example/cb?code=<that code>. What is the risk?',
        options: [
          'None - the code belongs to the attacker, so the victim loses nothing',
          'The attacker receives the tokens of the victim',
          'The authorization server locks the account of the victim',
          'The victim is signed in to the account of the attacker, so what the victim saves there the attacker can read',
        ],
        answer: 3,
        explanation:
          'This is CSRF on the callback: the app redeems a code it never asked for and links the victim session to the attacker account. The attacker does not get the victim tokens - the tokens are for the attacker account - which is why the harm is easy to miss. A state check, or PKCE, makes the app refuse a callback its own browser never started.',
      },
      {
        id: 'oauth-5',
        prompt:
          'The user granted only photos.read. The app calls DELETE /photos/7 with a valid, unexpired access token. What should the resource server do?',
        options: [
          'Allow it, because the token signature and expiry are valid',
          'Refuse with 403 and error="insufficient_scope" - the token is valid, but not for this action',
          'Refuse with 401 and ask the user to type their password again',
          'Forward the request to the authorization server to ask the user',
        ],
        answer: 1,
        explanation:
          'A valid token is necessary but not enough: the resource server must also check that its scope covers the action. RFC 6750 defines insufficient_scope with 403 for this case. A 401 means the token itself is missing or invalid, which it is not. In the Lab, pick photos.read and the DELETE call to see the refusal.',
      },
      {
        id: 'oauth-6',
        prompt:
          'Your backend logs a user in whenever the browser presents any valid Google access token for them. What is the problem?',
        options: [
          'None - a valid access token always proves the user is present in your app',
          'Access tokens expire too quickly to be used for login',
          'An access token is for calling an API and is not bound to your app - a token issued to another app for that user could be replayed to log in as them',
          'Only Google can check an access token, so your backend cannot verify it at all',
        ],
        answer: 2,
        explanation:
          'An access token says what may be done at an API, not who signed in to which app. Any other app the user authorised holds a valid token for the same user and could replay it to you. Login needs OpenID Connect: the id_token, whose aud must equal your client id. Short lifetimes do not fix this - the replay happens within the lifetime.',
      },
      {
        id: 'oauth-7',
        prompt:
          'A nightly billing job must call your internal invoices API. No user is involved. Which grant fits?',
        options: [
          'Client credentials: the job authenticates as itself and gets a token for its own access',
          'Authorization code with PKCE, with an engineer clicking consent every night',
          'The implicit grant, because it has the fewest steps',
          'The password grant with a shared service account password',
        ],
        answer: 0,
        explanation:
          'With no user there is nobody to delegate for, so the client acts as itself: client credentials. The authorization code flow exists to get the consent of a user, which a nightly job cannot give. The implicit and password grants are both deprecated and solve problems this job does not have.',
      },
      {
        id: 'oauth-8',
        prompt:
          'A smart TV app needs access to the video library of the user. Typing a password with a remote is painful, and the TV has no good browser. Which approach fits?',
        options: [
          'Ask for the password on the TV once and store it',
          'The implicit grant in the TV built-in browser',
          'Client credentials, with the TV as the client',
          'The device authorization grant: the TV shows a short code and a URL, the user approves on a phone, and the TV polls for the token',
        ],
        answer: 3,
        explanation:
          'The device grant (RFC 8628) moves sign-in and consent to a device with a proper browser, while the TV only polls the token endpoint. Client credentials would give the TV its own access, not access to the library of the user. Asking for the password on the TV is the anti-pattern OAuth removes.',
      },
      {
        id: 'oauth-9',
        prompt:
          'A security review flags an old single-page app that uses the implicit grant: the access token comes back in the URL fragment. What should you do?',
        options: [
          'Keep it, but shorten the token lifetime to 5 minutes',
          'Move to the authorization code flow with PKCE, so only a one-time code crosses the URL and the token comes from a direct call',
          'Move the token from the fragment into a query parameter so the server can log it',
          'Switch to the password grant so no redirect is needed',
        ],
        answer: 1,
        explanation:
          'Tokens in a URL leak through browser history, logs and Referer headers, and nothing binds them to the app that asked. Code + PKCE is what current guidance (RFC 9700) points single-page apps to. A shorter lifetime narrows the window but leaves the leak; the password grant hands the password to the app, which is worse.',
      },
      {
        id: 'oauth-10',
        prompt:
          'A user clicks Remove access for a misbehaving app at the provider. The app holds a self-contained JWT access token that the API verifies locally and that is valid for 50 more minutes, plus a refresh token. What happens next?',
        options: [
          'Every token stops working at that instant, everywhere',
          'Nothing changes until the user also changes their password',
          'The refresh token is revoked, so no new access tokens; the current access token can keep working until it expires, unless the API checks revocation',
          'The app keeps access forever, because OAuth tokens cannot be revoked',
        ],
        answer: 2,
        explanation:
          'Revocation reaches the authorization server at once, so the refresh token is dead. An API that only checks the signature and expiry of a self-contained token cannot know about the revocation until the token expires - which is why access tokens are kept short. Changing the password is not needed: the grant is what was revoked.',
      },
      {
        id: 'oauth-11',
        prompt:
          'In the Lab, you turn PKCE off, keep the state check on, and replay Stolen authorization code. Does the state check stop the attack?',
        options: [
          'Yes - the attacker does not know the state value',
          'Yes - the token endpoint compares the state before issuing tokens',
          'Only if the state value is long enough',
          'No - the state came in the same stolen URL, and the attacker goes straight to /token, where state is not checked',
        ],
        answer: 3,
        explanation:
          'state protects the callback of the app against forged responses (CSRF); it never protects the code. The attacker caught the whole redirect, state included, and the token endpoint does not look at state at all. That is why PKCE exists: it binds the code to a secret the attacker never sees.',
      },
      {
        id: 'oauth-12',
        prompt:
          'A calendar-sync app asks for full access to the Google account of the user in case a future feature needs it. Consent rates drop. What should the team do?',
        options: [
          'Request only the calendar read scope now, and ask for more scopes later when a feature needs them',
          'Keep the broad scope, because asking twice annoys users',
          'Ask for the Google password instead, so no consent screen is shown',
          'Request no scopes, and let the resource server decide what the token may do',
        ],
        answer: 0,
        explanation:
          'Users grant what they are asked for, so a narrow request is both easier to accept and less damaging if the token leaks. Asking again later (incremental consent) costs one more screen, not the trust of every user now. With no scopes the token could do nothing useful - the resource server enforces scopes, it does not invent them.',
      },
    ],
  },
  {
    slug: 'rate-limiting',
    title: 'Rate Limiting',
    tagline: 'Bounding how much traffic one caller can send - and returning 429 for the rest.',
    category: 'security',
    difficulty: 'Intermediate',
    lab: 'rate-limiting',
    keywords: ['token bucket', 'leaky bucket', 'fixed window', 'sliding window', '429', 'quota'],
    what: 'Rate limiting caps the number of requests a client may make in a period, rejecting or delaying the excess.',
    why: 'It protects capacity from abuse, runaway clients and retry storms, and it keeps one tenant from consuming the service for everyone else.',
    how: [
      'Fixed window: count per calendar window. Simple, but allows a 2x burst across the boundary.',
      'Sliding window: weight the previous window, smoothing the boundary problem.',
      'Token bucket: tokens refill at a steady rate, a request consumes one - allows controlled bursts.',
      'Leaky bucket: requests queue and drain at a constant rate - smooths output completely.',
      'Reject with 429 plus Retry-After so well-behaved clients back off correctly.',
    ],
    when: ['Public APIs, login endpoints, expensive operations, per-tenant quotas.'],
    diagram: `User -> 100 requests -> Rate Limiter
                          |-- allowed -> API
                          +-- rejected -> HTTP 429 Too Many Requests

TOKEN BUCKET (capacity 10, refill 5/s)
  . . . . . . . . . .      bucket full: a burst of 10 passes instantly
  request -> take one token; empty bucket -> 429

FIXED WINDOW boundary problem
  59.9s: 100 requests   |   60.1s: 100 requests   -> 200 in 0.2s`,
    tradeoffs: [
      {
        approach: 'Token bucket',
        gains: ['Allows bursts while bounding the average rate', 'Cheap: two numbers per client'],
        costs: ['Bursts can still overwhelm a fragile downstream', 'Needs shared state across instances'],
      },
      {
        approach: 'Leaky bucket',
        gains: ['Perfectly smooth output rate', 'Protects fragile downstreams'],
        costs: ['Adds queueing latency', 'No burst allowance for legitimate spikes'],
      },
      {
        approach: 'Fixed window',
        gains: ['Trivial to implement with a counter and TTL'],
        costs: ['Up to 2x the limit across a window boundary'],
      },
      {
        approach: 'Sliding window',
        gains: ['Accurate, no boundary spike'],
        costs: ['More state and computation per request'],
      },
    ],
    mistakes: [
      'Per-instance limits behind a load balancer, so the real limit is N times the intended one.',
      'Returning 429 without Retry-After, leaving clients to guess.',
      'Rate limiting by IP alone - shared NATs punish innocent users.',
    ],
    realWorld: ['Redis counters or token buckets with Lua scripts are the usual shared implementation.'],
    related: ['api-gateway', 'backpressure', 'exponential-backoff', 'redis'],
    quiz: [
      {
        id: 'rl-1',
        prompt: 'A fixed window of 100 requests per minute is in place. How can a client send 200 requests in about one second?',
        options: [
          'It cannot',
          'By sending 100 at the end of one window and 100 at the start of the next',
          'By using HTTP/2',
          'By changing the User-Agent',
        ],
        answer: 1,
        explanation:
          'The classic boundary problem. Sliding windows or token buckets avoid it by not resetting the whole count at a fixed instant.',
      },
      {
        id: 'rl-2',
        prompt: 'Which algorithm intentionally allows short bursts above the average rate?',
        options: ['Leaky bucket', 'Token bucket', 'Fixed window', 'None of them'],
        answer: 1,
        explanation:
          'Tokens accumulate up to the bucket capacity while a client is idle, so it can spend them in a burst - bounded by capacity.',
      },
    ],
  },
  {
    slug: 'api-keys',
    title: 'API Keys',
    tagline: 'Identifying the calling application - not the user.',
    category: 'security',
    difficulty: 'Beginner',
    lab: 'auth',
    labFocus: 'api-keys',
    keywords: ['secret', 'rotation', 'quota', 'scopes', 'revocation', 'leak'],
    what: 'An API key is a long random string identifying a client application, sent with each request and used for attribution, quotas and coarse access control.',
    why: 'It is the simplest way to know which integration is calling, to meter usage and to cut off an abusive client.',
    how: [
      'Generate at least 128 random bits with a readable prefix (sk_live_...), so scanners can spot a leaked key.',
      'Store only a hash; a fast hash such as SHA-256 is fine, because a random key cannot be guessed like a password.',
      'Scope each key (invoices:read), so a leak is limited to what that key may do.',
      'Support two active keys, so rotation needs no downtime; revoke a leaked key at once.',
      'Never put secret keys in frontend code, mobile apps or URLs - they end up in logs and browser history.',
    ],
    when: [
      'Server-to-server integrations, webhooks, CI jobs and scripts.',
      'Metering, quotas and billing per customer integration.',
      'Not for identifying end users - use sessions or OAuth for them.',
    ],
    advantages: [
      'Simple for the caller: one header on every request.',
      'Every request is attributable to one integration, for quotas, billing and audit.',
      'One key can be revoked without touching any other client.',
    ],
    diagram: `Authorization: Bearer sk_live_9f2c...
  -> gateway hashes the key and looks the hash up
  -> identity: Integration A, scope invoices:read
  -> quota and rate limit applied per key

leaked?  whoever holds the string IS Integration A
  -> rotate: issue sk_live_77e1, move traffic, revoke sk_live_9f2c`,
    tradeoffs: [
      {
        approach: 'API keys',
        gains: ['Simple for server-to-server', 'Easy metering and revocation per integration'],
        costs: ['A bearer secret: anyone holding it is the client', 'No user identity', 'Rotation must be designed'],
      },
      {
        approach: 'Short-lived tokens (OAuth client credentials)',
        gains: ['A leaked token expires within minutes', 'Scopes are part of the standard'],
        costs: ['An extra token endpoint and a refresh step', 'The client secret behind it still needs the same care as a key'],
      },
      {
        approach: 'HMAC-signed requests',
        gains: ['The secret never crosses the wire', 'A captured request cannot be changed or replayed after its timestamp window'],
        costs: ['Harder for clients to implement correctly', 'Clock skew and signing bugs cause confusing failures'],
      },
    ],
    mistakes: [
      'Shipping a key in a mobile app or SPA and treating it as a secret.',
      'One unscoped key with full account access, so any leak is a full incident.',
      'Only one active key per integration, so rotating means an outage and nobody rotates.',
      'Storing keys in plain text in the database.',
    ],
    realWorld: [
      'Stripe keys carry prefixes (sk_live_, rk_live_, pk_live_), and when a key is rotated the old one can stay valid for up to 7 days, so the swap needs no downtime.',
      'Stripe shows a key it did not generate for you only once, at creation; a lost key is rotated, not recovered.',
    ],
    related: ['authentication', 'authorization', 'oauth', 'rate-limiting', 'secrets-management'],
    quiz: [
      {
        id: 'key-1',
        prompt:
          'In the Auth Lab, an attacker sends GET /invoices/4711 with the leaked key sk_live_9f2c while the key is still active. What happens?',
        options: [
          'The gateway spots the attacker by IP and answers 401',
          'The gateway believes it is Integration A and the request gets 200 OK',
          'The service answers 403, because the attacker has no role',
          'The key store refuses because the key is hashed',
        ],
        answer: 1,
        explanation:
          'Possession of an API key is the whole credential: the hash matches, so the gateway identifies the caller as Integration A and the invoice comes back - the Lab counts it as "200 to the wrong caller". Nothing in the request says it is someone else, and hashing protects the stored keys, not the one in the request.',
      },
      {
        id: 'key-2',
        prompt:
          'In the Lab you set the key to Revoked, then pick Integration A itself. What does Integration A get, and what would have avoided it?',
        options: [
          '200 OK - revocation only affects the attacker',
          '403 Forbidden until an admin grants a role',
          '429 Too Many Requests',
          '401 Unauthorized, the same as the attacker; rotating (new key first, then revoke) would have avoided the outage',
        ],
        answer: 3,
        explanation:
          'Both hold the same string, so revoking it cuts off both. Rotation issues a second key to Integration A, moves its traffic, and only then revokes the old key - set the key to Rotated in the Lab and only the attacker is left with 401. It is a 401, not a 403, because the key no longer proves any identity.',
      },
      {
        id: 'key-3',
        prompt:
          'The leaked key has scope invoices:read. The attacker sends DELETE /invoices/4711 with it. What happens in the Lab, and why does it matter?',
        options: [
          '403 Forbidden at the gateway: the scope does not include invoices:write, so the leak is limited to reading',
          '200 OK: a valid key may do anything',
          '401 Unauthorized, because DELETE needs a password',
          '404 Not Found, to hide the invoice',
        ],
        answer: 0,
        explanation:
          'The identity check passes, but the gateway refuses the action by scope - it needs no invoice data for that, so it answers 403 itself. Scoping is what keeps a leaked key from becoming a full-account incident. 401 is the tempting pick, but the key did prove an identity; it just is not allowed to delete.',
      },
      {
        id: 'key-4',
        prompt:
          'Your mobile app calls a paid maps API directly, with the key compiled into the app. The monthly bill triples. What is the structural fix?',
        options: [
          'Obfuscate the key in the binary',
          'Rotate the key every month',
          'Have the app call your backend, which calls the maps API with a key that never leaves your servers',
          'Move the key into the app settings screen',
        ],
        answer: 2,
        explanation:
          'Any string the app must send can be extracted from the app, so obfuscation and rotation only buy time - the new key is extracted too. Proxying through your backend keeps the key on your servers and lets you authenticate your own users, rate limit and cache.',
      },
      {
        id: 'key-5',
        prompt:
          'A database dump leaks the api_keys table, which stores SHA-256 hashes of keys made from 32 random bytes. How worried should you be about the attacker recovering keys?',
        options: [
          'Very - SHA-256 is fast, so the keys fall like passwords would',
          'Not much for the keys themselves: 256 random bits cannot be brute-forced, however fast the hash',
          'Not at all, because SHA-256 cannot be reversed or guessed in any case',
          'Only if the keys have a prefix',
        ],
        answer: 1,
        explanation:
          'Fast hashes are wrong for passwords because people pick guessable passwords; a random 256-bit key has no guessable list to try. That is the whole reason SHA-256 is acceptable here. The third option overreaches: the same hash on a human password would be cracked quickly - the randomness of the input is what protects it.',
      },
      {
        id: 'key-6',
        prompt:
          'A developer pushes a live key to a public GitHub repository and deletes the commit 10 minutes later. What now?',
        options: [
          'Nothing - the commit is gone',
          'Make the repository private',
          'Ask GitHub to purge the cache, then carry on',
          'Treat the key as compromised: rotate it now and check the usage log of that key',
        ],
        answer: 3,
        explanation:
          'Public repositories are scanned by bots within minutes, and a deleted commit can still be reachable from forks and caches. Assume the key is in the hands of someone else: rotate it, so the integration keeps working on the new key, then look at what the old key did. Hiding the repository afterwards does not un-leak it.',
      },
      {
        id: 'key-7',
        prompt: 'A customer lost their API key and asks support to show it to them again. What should your system allow?',
        options: [
          'Nothing to show: only a hash is stored, so the customer creates a new key and revokes the lost one',
          'Support decrypts the key from the database',
          'Support emails the key to the account owner',
          'The dashboard shows the full key on request',
        ],
        answer: 0,
        explanation:
          'If you store only hashes you cannot recover a key - and that is the point: a database dump then hands no working credentials to anyone. Show a key once at creation, and identify it later by prefix and last four characters. Emailing it adds another place for it to leak.',
      },
      {
        id: 'key-8',
        prompt:
          'A B2B customer wants to know which of their employees made each change through your API. Their integration uses one API key. What do you recommend?',
        options: [
          'Issue one API key per employee and ask them to share nothing',
          'Put the employee name in a request header next to the key',
          'Keep the key for the integration, and let employees sign in with sessions or OAuth so each call carries a user identity',
          'Log the IP address of each request',
        ],
        answer: 2,
        explanation:
          'An API key identifies an application, not a person. A user identity comes from authenticating the user - a session or an OAuth token issued for that user. A header with a name is just a claim anyone can type, and per-employee keys spread long-lived secrets across laptops.',
      },
      {
        id: 'key-9',
        prompt: 'An API takes its key as a query parameter: GET /reports?api_key=sk_live_9f2c... Why is that a problem?',
        options: [
          'Query parameters are not encrypted by HTTPS',
          'Full URLs are written to access logs, proxy logs and browser history, so the key spreads to places nobody guards',
          'Query parameters are limited to 64 characters',
          'Servers cannot read query parameters on GET',
        ],
        answer: 1,
        explanation:
          'HTTPS does encrypt the query string on the wire - that is the tempting wrong answer. The leak happens at the ends: every log line and history entry that records the URL now holds a working key. Send it in the Authorization header instead.',
      },
      {
        id: 'key-10',
        prompt:
          'Two partner integrations share one API key. One of them goes rogue and floods the API. What can you do, and what should you have done?',
        options: [
          'You can only revoke the shared key, which cuts off both partners; give each integration its own key',
          'Rate limit the rogue partner by key - it works fine',
          'Revoke the key for the rogue partner only',
          'Nothing, because keys cannot be revoked',
        ],
        answer: 0,
        explanation:
          'A key is how you tell callers apart, so a shared key makes the two partners one caller: every quota, bill and revocation hits both. With one key each, the gateway meters and revokes them separately, as the Diagram shows with Integration A and B.',
      },
      {
        id: 'key-11',
        prompt: 'Why do providers put a readable prefix such as sk_live_ or sk_test_ on their keys?',
        options: [
          'It makes the key harder to guess',
          'It encodes the permissions of the key',
          'Secret scanners can find leaked keys in code and logs, and a live key pasted into a test config is obvious',
          'It is required by the HTTP standard',
        ],
        answer: 2,
        explanation:
          'The random part carries the security; the prefix carries meaning for people and tools. A distinctive prefix is what lets automated scanning spot a key in a commit, and makes live versus test visible at a glance. It adds no entropy and says nothing about scopes, which live in the key store.',
      },
    ],
  },
  {
    slug: 'tls-https',
    title: 'TLS / HTTPS',
    tagline: 'Encryption and server identity for data in transit.',
    category: 'security',
    difficulty: 'Beginner',
    lab: 'url-journey',
    keywords: ['handshake', 'certificate', 'termination', 'mtls', 'hsts'],
    what: 'TLS encrypts the connection and authenticates the server through a certificate chain; HTTPS is HTTP carried over TLS.',
    why: 'Without it, anyone on the path can read and modify traffic. It is also a prerequisite for HTTP/2, service workers and most modern browser APIs.',
    how: [
      'The handshake negotiates parameters and establishes session keys; TLS 1.3 needs one round trip (or zero on resumption).',
      'The certificate proves the server owns the hostname, validated against trusted roots.',
      'TLS is commonly terminated at the load balancer or CDN; encrypt internal hops too if the network is not trusted.',
      'mTLS authenticates both sides and is the usual approach inside service meshes.',
    ],
    diagram: `ClientHello -> ServerHello + certificate -> key exchange -> encrypted
TLS 1.3: 1-RTT handshake, 0-RTT on resumption

Client --TLS--> CDN --TLS--> Load Balancer --?--> services
                         (encrypt internal hops in zero-trust networks)`,
    tradeoffs: [
      {
        approach: 'Terminate TLS at the edge',
        gains: ['Cheaper backends', 'Central certificate management', 'Edge can inspect and cache'],
        costs: ['Traffic inside the network is plaintext unless re-encrypted'],
      },
    ],
    mistakes: ['Expired certificates - still a leading cause of outages.', 'Serving mixed content that browsers block.'],
    related: ['http-https', 'cdn', 'secrets-management'],
  },
  {
    slug: 'secrets-management',
    title: 'Secrets Management',
    tagline: 'Credentials that are injected, rotated and audited - never committed.',
    category: 'security',
    difficulty: 'Intermediate',
    keywords: ['vault', 'kms', 'rotation', 'least privilege', 'env vars'],
    what: 'Secrets management is how database passwords, API keys and signing keys are stored, delivered to workloads, rotated and audited.',
    why: 'Leaked credentials are one of the most common breach causes, and a secret in git history is leaked permanently.',
    how: [
      'Store secrets in a dedicated system (Vault, cloud secret manager) encrypted with a KMS key.',
      'Inject at runtime via environment or a mounted file; never bake them into images.',
      'Prefer short-lived, automatically rotated credentials over static ones.',
      'Scope each secret to the smallest workload that needs it, and log every access.',
    ],
    diagram: `workload -> identity (IAM role / service account)
         -> secret manager issues a short-lived database credential (15 min)
         -> automatic rotation, full audit trail
No static password anywhere in the repo or image.`,
    tradeoffs: [
      {
        approach: 'Dynamic short-lived credentials',
        gains: ['Leaks expire quickly', 'Rotation is automatic', 'Per-workload audit'],
        costs: ['More infrastructure', 'Applications must handle credential refresh'],
      },
    ],
    mistakes: ['Committing .env files.', 'Rotating a secret without a dual-key window, causing an outage.'],
    related: ['api-keys', 'tls-https', 'authentication'],
  },
  {
    slug: 'waf',
    title: 'Web Application Firewall',
    tagline: 'Filtering known-bad requests before they reach your code.',
    category: 'security',
    difficulty: 'Intermediate',
    keywords: ['owasp', 'rules', 'bot', 'ddos', 'false positive'],
    what: 'A WAF inspects HTTP traffic at the edge and blocks requests matching known attack patterns: injection attempts, path traversal, malicious bots, volumetric floods.',
    why: 'It buys time. A virtual patch at the edge can block an exploit within minutes, long before a fix is deployed everywhere.',
    how: [
      'Managed rule sets (OWASP core rules) cover common attack classes.',
      'Run new rules in count/monitor mode first to measure false positives.',
      'Combine with rate limiting and bot detection at the same layer.',
    ],
    diagram: `Internet -> CDN/WAF -> Load Balancer -> API
             |
             +-- blocked: SQLi patterns, path traversal, known bad bots
             +-- rate limited: bursts per IP / per token`,
    tradeoffs: [
      {
        approach: 'WAF at the edge',
        gains: ['Blocks broad attack classes', 'Virtual patching during incidents', 'Absorbs volumetric attacks'],
        costs: ['False positives break legitimate traffic', 'Rules need tuning and maintenance', 'Not a substitute for secure code'],
      },
    ],
    mistakes: ['Treating a WAF as a replacement for input validation and parameterised queries.'],
    related: ['rate-limiting', 'cdn', 'api-gateway'],
  },
];
