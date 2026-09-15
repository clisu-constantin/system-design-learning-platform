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
    keywords: ['authorization code', 'pkce', 'scopes', 'refresh token', 'openid connect'],
    what: 'OAuth 2.0 is a delegation framework: a user authorises a client application to access a resource server on their behalf, and the client receives a scoped access token.',
    why: 'It removes the anti-pattern of giving your password to a third party, and it makes access narrow (scopes) and revocable.',
    how: [
      'Authorization Code + PKCE is the flow for web and mobile apps.',
      'The client receives a short-lived access token and a refresh token.',
      'Scopes limit what the token can do; the resource server enforces them.',
      'OpenID Connect adds an identity layer (the ID token) on top of OAuth.',
    ],
    diagram: `user -> client -> authorization server (login + consent)
        <- authorization code
client + code_verifier -> token endpoint -> access token (+ refresh)
client -> resource server with access token`,
    tradeoffs: [
      {
        approach: 'OAuth delegation',
        gains: ['No password sharing', 'Scoped and revocable', 'Standard, widely supported'],
        costs: ['Many flows and subtleties to get right', 'Redirect handling is a common source of bugs'],
      },
    ],
    mistakes: [
      'Using the implicit flow in new applications - superseded by code + PKCE.',
      'Not validating redirect URIs exactly, enabling token theft.',
      'Treating an OAuth access token as proof of identity instead of using OpenID Connect.',
    ],
    related: ['jwt', 'authentication', 'authorization', 'api-keys'],
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
