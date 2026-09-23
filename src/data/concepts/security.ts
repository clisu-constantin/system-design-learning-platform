import type { Concept } from '@/types';

export const securityConcepts: Concept[] = [
  {
    slug: 'authentication',
    title: 'Authentication',
    tagline: 'Proving who the caller is.',
    category: 'security',
    difficulty: 'Beginner',
    keywords: ['identity', 'session', 'password', 'mfa', 'token'],
    what: 'Authentication establishes the identity of the caller: a user logging in, a service calling another service, or a device presenting a certificate.',
    why: 'Every access decision depends on it. If identity can be forged, no amount of authorization logic helps.',
    how: [
      'Verify a credential (password, token, certificate, passkey) against a trusted record.',
      'Issue a session identifier or a signed token representing the authenticated identity.',
      'Store passwords only as slow salted hashes (bcrypt, scrypt, Argon2) - never reversible.',
      'Add a second factor for anything sensitive; it defeats credential stuffing.',
    ],
    diagram: `POST /login (email, password)
  -> verify hash
  -> issue session cookie (HttpOnly, Secure, SameSite) or JWT
  -> subsequent requests carry it`,
    tradeoffs: [
      {
        approach: 'Server-side sessions',
        gains: ['Instant revocation', 'Small cookie', 'Server controls the truth'],
        costs: ['Session store lookup per request', 'Shared state to operate'],
      },
      {
        approach: 'Stateless tokens',
        gains: ['No lookup', 'Scales across services and regions'],
        costs: ['Revocation before expiry needs extra machinery', 'Token bloat on every request'],
      },
    ],
    mistakes: ['Confusing authentication with authorization - knowing who someone is says nothing about what they may do.'],
    related: ['authorization', 'jwt', 'oauth', 'stateless-applications'],
  },
  {
    slug: 'authorization',
    title: 'Authorization',
    tagline: 'Deciding what an authenticated caller is allowed to do.',
    category: 'security',
    difficulty: 'Beginner',
    keywords: ['rbac', 'abac', 'permissions', 'idor', 'policy'],
    what: 'Authorization evaluates whether a given identity may perform a given action on a given resource.',
    why: 'Most real-world breaches are authorization bugs, not broken cryptography: an object id changed in a URL returns someone else data.',
    how: [
      'RBAC: permissions attach to roles, roles attach to users - simple and auditable.',
      'ABAC/policy: decisions consider attributes (owner, tenant, time, IP) - flexible but harder to reason about.',
      'Check ownership on every object access, not just the route.',
      'Deny by default; make the permissive path explicit.',
    ],
    diagram: `GET /invoices/9182
  authenticated as user 42  (authentication)
  invoice 9182 belongs to tenant 7
  user 42 belongs to tenant 3  -> 404/403      (authorization)

Missing that check = IDOR, the most common serious API vulnerability.`,
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
    ],
    mistakes: ['Enforcing permissions only in the UI.', 'Trusting a tenant id supplied by the client.'],
    related: ['authentication', 'jwt', 'api-gateway'],
  },
  {
    slug: 'jwt',
    title: 'JWT',
    tagline: 'A signed claim set the server can verify without a lookup.',
    category: 'security',
    difficulty: 'Intermediate',
    lab: 'stateless',
    keywords: ['token', 'claims', 'signature', 'revocation', 'refresh token'],
    what: 'A JSON Web Token carries claims (subject, expiry, scopes) in a base64 payload with a signature. Any service holding the key can verify it without contacting an auth server.',
    why: 'It makes authentication stateless, which is what lets any instance in any region serve any request without a shared session store.',
    how: [
      'Sign with a strong algorithm and validate alg, issuer, audience and expiry on every request.',
      'Keep access tokens short-lived (minutes) and pair them with a longer-lived refresh token.',
      'Store the refresh token where XSS cannot reach it - an HttpOnly cookie.',
      'Maintain a revocation list for the short access-token window when immediate revocation matters.',
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
    ],
    mistakes: [
      'Long-lived access tokens with no revocation path.',
      'Accepting alg: none or failing to pin the expected algorithm.',
      'Storing tokens in localStorage, where any XSS can read them.',
    ],
    related: ['authentication', 'oauth', 'stateless-applications', 'api-gateway'],
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
    keywords: ['secret', 'rotation', 'quota', 'scopes'],
    what: 'An API key is a long random string identifying a client application, sent with each request and used for attribution, quotas and coarse access control.',
    why: 'It is the simplest way to know which integration is calling, to meter usage and to cut off an abusive client.',
    how: [
      'Generate high-entropy keys; store only a hash, like a password.',
      'Prefix keys so they can be detected in leaks (sk_live_...).',
      'Scope keys and support multiple active keys so rotation needs no downtime.',
      'Never put keys in frontend code or URLs - they end up in logs and browser history.',
    ],
    diagram: `Authorization: Bearer sk_live_9f2c...
  -> identifies the integration
  -> quota + rate limit applied per key
  -> compromised key revoked without touching other clients`,
    tradeoffs: [
      {
        approach: 'API keys',
        gains: ['Simple for server-to-server', 'Easy metering and revocation'],
        costs: ['A bearer secret: anyone holding it is the client', 'No user identity', 'Rotation must be designed'],
      },
    ],
    mistakes: ['Shipping a key in a mobile app or SPA and treating it as a secret.'],
    related: ['oauth', 'rate-limiting', 'secrets-management'],
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
