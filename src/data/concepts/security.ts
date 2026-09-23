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
    lab: 'waf',
    keywords: ['owasp', 'core rule set', 'paranoia level', 'rules', 'bot', 'false positive', 'virtual patch', 'detection mode'],
    what: 'A WAF inspects HTTP requests at the edge - path, headers, query string, body - and blocks the ones that match known attack patterns: SQL injection, cross-site scripting, path traversal, known bad bots and floods of HTTP requests.',
    why: 'It filters the noise of automated attacks in one place for every service, and it buys time: a virtual patch at the edge can block an exploit within minutes, long before the real fix is deployed everywhere.',
    how: [
      'It terminates TLS (or sits behind the TLS terminator), so it can read the plain HTTP request.',
      'Managed rule sets such as the OWASP Core Rule Set cover common attack classes; each match is logged with its rule id.',
      'Strictness is a dial: a higher paranoia level switches on more rules - more attacks caught, more real users blocked.',
      'Run new rules in detection-only (count) mode first to measure false positives, then switch to blocking.',
      'A blocked request gets a 403 from the WAF itself and never reaches the application.',
      'Combine with rate limiting and bot detection at the same layer.',
    ],
    when: [
      'Any public web app or API that receives the constant background of scanners and exploit kits.',
      'As a virtual patch between the disclosure of a vulnerability and the deployment of the fix.',
      'In front of many services, to apply IP reputation, size limits and rate-based rules once instead of in every codebase.',
    ],
    advantages: [
      'Blocks broad attack classes before they reach any code.',
      'One place to apply rules for a whole fleet of services.',
      'A lever during incidents: new rules deploy in minutes.',
      'Its log shows who is attacking, with what, and which rule matched.',
    ],
    diagram: `Internet -> CDN/WAF -> Load Balancer -> API
             |
             +-- blocked (403): SQLi patterns, XSS, path traversal, known bad bots
             +-- rate limited: bursts per IP / per token
             +-- every match logged: rule id + request id

Not visible to any rule:
  GET /invoices/9183  (belongs to another customer)  -> needs an ownership check`,
    tradeoffs: [
      {
        approach: 'WAF in blocking mode',
        gains: ['Blocks broad attack classes before they reach code', 'Virtual patching during incidents', 'One place for a whole fleet'],
        costs: ['False positives give real users a 403', 'Rules need tuning and maintenance', 'Not a substitute for secure code'],
      },
      {
        approach: 'Detection-only (count) mode',
        gains: ['No real user is blocked', 'Measures false positives on real traffic before blocking'],
        costs: ['Every attack still reaches the application', 'The log is only useful if someone reviews it'],
      },
      {
        approach: 'Higher rule strictness (paranoia level)',
        gains: ['Catches encoded and disguised attack variants', 'Fewer attacks reach the application'],
        costs: ['Many more false positives', 'Weeks of tuning at the highest level'],
      },
      {
        approach: 'A rule exclusion for one path and field',
        gains: ['Removes one known false positive', 'Keeps the rest of the rules at full strength'],
        costs: ['An attack placed in that field on that path is not inspected by the excluded rule', 'Exclusions pile up unless reviewed'],
      },
      {
        approach: 'Rate-based rules at the WAF',
        gains: ['Slows floods of HTTP requests and credential stuffing', 'Cheap to add next to the other rules'],
        costs: ['Shared IPs (offices, mobile carriers) hit the limit together', 'Network-layer floods need separate DDoS protection'],
      },
    ],
    mistakes: [
      'Treating a WAF as a replacement for input validation, parameterised queries and output encoding.',
      'Turning on a full managed rule set in blocking mode on day one, without a detection-only period.',
      'Fixing a false positive by disabling a whole rule set or lowering strictness for the whole site, instead of one narrow exclusion.',
      'Showing a bare 403 with no request id, so support cannot find the rule that matched.',
      'Expecting a WAF to stop logic flaws such as broken object-level authorisation (IDOR).',
    ],
    realWorld: [
      'The OWASP Core Rule Set runs on ModSecurity and Coraza; AWS WAF, Cloudflare and Azure offer managed rule sets with a count or log action.',
    ],
    related: ['rate-limiting', 'authorization', 'tls-https', 'cdn', 'api-gateway'],
    quiz: [
      {
        id: 'waf-1',
        prompt:
          'In the Lab the WAF runs at paranoia level 1 in Blocking mode, and Attacks missed keeps rising. You move the slider to level 4. What do you see a minute later?',
        options: [
          'Attacks missed falls to zero and nothing else changes',
          'Nothing changes, because the level only affects the log',
          'Attacks missed grows more slowly, and Real users blocked rises as support tickets with SQL-looking text get a 403',
          'Real users blocked falls, because stricter rules understand the request better',
        ],
        answer: 2,
        explanation:
          'A higher paranoia level switches on more rules. They catch encoded and disguised variants, and they also match real text that looks like an attack - so false positives rise with detection. Expecting only the good half is the tempting mistake; strictness is a dial between two kinds of error, and IDOR still passes at every level.',
      },
      {
        id: 'waf-2',
        prompt:
          'You are about to put a managed rule set in front of a busy checkout that has never had a WAF. What is the safest way to switch it on?',
        options: [
          'Run it in detection-only (count) mode for a week or two, review what it would have blocked, tune, then switch to blocking',
          'Switch it on in blocking mode at the highest strictness, then relax it when customers complain',
          'Switch it on in blocking mode only at night, when traffic is low',
          'Skip the managed rules and write your own from scratch',
        ],
        answer: 0,
        explanation:
          'Generic rules match legitimate traffic surprisingly often, and on a checkout a false positive is a lost sale with an unexplained 403. Detection-only mode logs every would-be block against real traffic, so you tune before anyone is blocked. Blocking first and relaxing later means customers find your false positives for you.',
      },
      {
        id: 'waf-3',
        prompt:
          'Rule 942100 (SQL injection) blocks support tickets in which customers paste SQL from their own reports. Attackers target the rest of the site. What is the narrowest fix?',
        options: [
          'Lower the paranoia level for the whole site',
          'Disable the SQL injection rules everywhere',
          'Switch the whole WAF to detection-only mode',
          'Exclude rule 942100 for the message field of the /support endpoint only',
        ],
        answer: 3,
        explanation:
          'An exclusion scoped to one rule, one path and one field removes this false positive and leaves every other request fully inspected. Lowering the level or disabling the rule set looks simpler but opens the whole site to the attacks those rules were catching.',
      },
      {
        id: 'waf-4',
        prompt:
          'In the Lab you turn on the exclusion for /support text. Real users blocked stops rising. What new thing should you watch?',
        options: [
          'Nothing - an exclusion has no cost',
          'SQL injection and XSS placed in the /support message field now reach the app uninspected, so that code path must be safe on its own',
          'Every bad bot now passes, because exclusions switch off bot rules',
          'Normal page requests start getting 403',
        ],
        answer: 1,
        explanation:
          'An exclusion is a hole of an exact size: the excluded rule no longer looks at that field. Attackers who find it can put their payload there, which is why the Insight counts attacks that passed only through the exclusion. It does not touch bot rules or other paths - that narrowness is the point.',
      },
      {
        id: 'waf-5',
        prompt:
          'Your WAF runs at paranoia level 4 in blocking mode. A logged-in attacker changes GET /invoices/9182 to /invoices/9183 and receives the invoice of another customer. Why did the WAF let it through, and what fixes it?',
        options: [
          'The level was too low; level 5 would catch it',
          'The WAF was in detection-only mode; blocking would stop it',
          'The request is well-formed and matches no attack pattern; only an ownership check in the application stops it',
          'The attacker used HTTPS; the WAF cannot read encrypted requests',
        ],
        answer: 2,
        explanation:
          'Broken object-level authorisation is a logic flaw: the request looks exactly like a valid one, so no pattern can tell them apart - in the Lab, IDOR has a 0% flag chance at every level. The fix is in the application: check that the object belongs to the caller. There is no level 5, and a WAF that terminates TLS does read HTTPS requests.',
      },
      {
        id: 'waf-6',
        prompt:
          'A reports endpoint still builds SQL by concatenating strings. A colleague says it can wait, because the WAF blocks SQL injection. What is the problem with that reasoning?',
        options: [
          'Pattern rules miss encoded and reshaped variants, so some injection still reaches the query; parameterised queries make injection structurally impossible',
          'None - the WAF blocks all SQL injection, so the code is safe',
          'The WAF only inspects GET requests, so POST bodies are never checked',
          'SQL injection is a network attack, so the WAF is the right place to fix it',
        ],
        answer: 0,
        explanation:
          'A WAF matches known shapes of attack, and attackers reshape payloads until one passes - in the Lab, SQL injection reaches the app at every level below 100%. A parameterised query sends the input as data, never as SQL, so there is nothing to bypass. Believing the WAF is the defence is exactly how the real fix never gets done.',
      },
      {
        id: 'waf-7',
        prompt:
          'A remote code execution flaw is disclosed on Friday in a logging library all your services use. The patched version needs three days of testing. What do you do in the first hour?',
        options: [
          'Nothing until the patched version is tested',
          'Add a WAF rule for the exploit pattern in blocking mode now, and still upgrade the library through the normal pipeline',
          'Add the WAF rule and cancel the upgrade, since the rule covers it',
          'Put the WAF into detection-only mode to watch the attacks',
        ],
        answer: 1,
        explanation:
          'This is virtual patching: the rule buys the days the real fix needs, and blocking mode is right because active exploitation costs more than a few false positives. The rule is not the fix - attackers publish encoded bypasses within hours - so cancelling the upgrade leaves you exposed. Detection-only would log the attacks while letting them run.',
      },
      {
        id: 'waf-8',
        prompt:
          'Support reports that some customers get a plain 403 when they submit the contact form, and nobody can say why. What would make this a five-minute diagnosis?',
        options: [
          'Turning the WAF off until the complaints stop',
          'Raising the paranoia level so the WAF is more precise',
          'Asking customers to try another browser',
          'A WAF log with the rule id and request id for every match, and the request id shown on the 403 page so support can look it up',
        ],
        answer: 3,
        explanation:
          'With the request id on the error page, support finds the log entry, sees which rule matched which field, and you can add a narrow exclusion. Turning the WAF off removes all protection to fix one rule, and a higher level would make more false positives, not fewer.',
      },
      {
        id: 'waf-9',
        prompt:
          'In the Lab you switch to Detection only. The WAF log keeps filling, yet Attacks that did harm starts rising. Is the Lab broken?',
        options: [
          'Yes - a WAF that logs an attack also stops it',
          'Yes - detection-only mode should block attacks and allow users',
          'No - detection-only (count) mode logs every match but forwards every request, so it measures false positives without protecting anything',
          'No - detection-only mode switches the application to vulnerable code',
        ],
        answer: 2,
        explanation:
          'Count mode is for measurement: every would-be block is written to the log (the COUNT rows) and every request continues to the app. That is exactly what makes it safe for tuning and useless as protection. Nothing about the application changes - the harm comes from attacks the WAF no longer stops.',
      },
      {
        id: 'waf-10',
        prompt:
          'A scraper copies your prices through ordinary-looking GET requests with a real browser User-Agent, from many addresses. The WAF at level 4 misses most of it, and fixing the app code does not help. What does?',
        options: [
          'Parameterised queries in the price endpoint',
          'Bot detection and rate-based rules at the same edge layer - behaviour, challenges and request rates, not payload patterns',
          'A stricter SQL injection rule',
          'Moving the WAF behind the application',
        ],
        answer: 1,
        explanation:
          'A scraping request is well-formed, so injection rules and fixed code have nothing to refuse - in the Lab, Secure app code does not stop Bad bot harm. What separates it from a person is behaviour: request rate, missing browser signals, failed challenges. That is the job of bot management and rate limiting, which usually run in the same edge layer as the WAF.',
      },
      {
        id: 'waf-11',
        prompt:
          'You put a WAF appliance on the network in front of an HTTPS API, passing traffic through without touching TLS. Weeks later it has never matched a single rule. Why?',
        options: [
          'It only sees encrypted bytes; it must terminate TLS (or sit behind the TLS terminator) to read the HTTP request',
          'There have been no attacks',
          'Managed rules only work for HTTP, and the API uses JSON',
          'The paranoia level was set too low to match anything',
        ],
        answer: 0,
        explanation:
          'Rules inspect the path, headers, query string and body - none of which is readable inside a TLS stream. That is why WAFs run at the CDN, load balancer or reverse proxy that terminates TLS. Public APIs receive scanner traffic constantly, so zero matches points at the placement, not at an absence of attacks.',
      },
      {
        id: 'waf-12',
        prompt:
          'A flood of 200 Gbps of UDP packets saturates the network link of your data centre. Your WAF has strict rules and rate-based rules. What happens?',
        options: [
          'The WAF drops the packets because they match no rule',
          'The rate-based rules block the flood per IP',
          'The WAF absorbs it, because it runs at the edge',
          'The WAF does not help: it inspects HTTP requests, and this flood fills the link before any request exists; it needs network-layer DDoS protection',
        ],
        answer: 3,
        explanation:
          'A WAF works on HTTP requests. Its rate-based rules help against floods of HTTP requests, but a network-layer flood never becomes a request - it is stopped by provider-scale DDoS protection that absorbs traffic before your link. Expecting the WAF to handle every kind of flood is the tempting mistake.',
      },
    ],
  },
];
