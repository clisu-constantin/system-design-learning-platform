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
    lab: 'secrets',
    keywords: ['vault', 'kms', 'rotation', 'least privilege', 'env vars', 'dynamic secrets', 'lease'],
    what: 'Secrets management is how database passwords, API keys and signing keys are stored, delivered to workloads, rotated and audited.',
    why: 'Stolen and leaked credentials are among the most common ways attackers get in, and a secret committed to git stays in every clone and fork even after it is deleted.',
    how: [
      'Store secrets in one dedicated system (Vault, a cloud secret manager), encrypted at rest, with access control per identity and an audit log of every read.',
      'Deliver them at runtime - fetched by the service or mounted as a file; never write them into code, images or front-end bundles.',
      'Give each service its own credential, so a leak speaks for one service and a rotation touches only one.',
      'Prefer short-lived dynamic credentials, which expire by themselves, over static passwords.',
      'Rotate with a dual-key window: create the new credential, move every holder over, then revoke the old one.',
    ],
    when: [
      'Every system with a database password, API key, signing key or certificate.',
      'Most urgent where many services or people share one credential, or where a leak could go unnoticed for weeks.',
    ],
    advantages: [
      'A leak can be contained in minutes: one credential is rotated without an outage.',
      'Every read is logged, so a leaked credential can be traced to the one service that held it.',
      'Short-lived credentials limit how long a leak is useful, even when nobody notices it.',
    ],
    diagram: `Orders API --proves identity--> Vault --CREATE USER, 1 h lease--> Database
Orders API <----- v-orders-7f3a ----- Vault
Orders API --login as v-orders-7f3a-----------------------------> Database
lease ends: Vault drops the user. No static password in repo or image.`,
    tradeoffs: [
      {
        approach: 'Secret in the code',
        gains: ['No setup at all', 'Works wherever the code runs'],
        costs: [
          'In every clone, fork and image, forever',
          'Rotation needs a commit, a rebuild and a redeploy of every service',
          'Usually one password shared by every service and developer',
        ],
      },
      {
        approach: '.env file or environment variables',
        gains: ['Out of the repository', 'A different value per environment without a rebuild'],
        costs: [
          'Still static and usually shared',
          'Copied to every host and into backups',
          'Environment variables can end up in logs, crash dumps and child processes',
          'Rotation means editing every host and restarting',
        ],
      },
      {
        approach: 'Secrets manager with static secrets',
        gains: [
          'One encrypted copy with access control per identity',
          'Every read is audited',
          'Rotation is an API call, and versions allow a rollback',
        ],
        costs: [
          'A new critical service to run and secure',
          'Services must fetch or reload the secret',
          'Services need an identity to log in with (workload identity)',
        ],
      },
      {
        approach: 'Dynamic short-lived credentials',
        gains: ['A leak expires by itself', 'Rotation is automatic', 'One database user per service, so every login is traceable'],
        costs: [
          'The manager is on the critical path: if it is down when a lease ends, logins fail',
          'Applications must handle credential refresh',
          'Many short-lived database users to create and drop',
        ],
      },
    ],
    mistakes: [
      'Committing .env files.',
      'Deleting a committed secret without rotating it - the old commit is still in every clone and fork.',
      'Rotating without a dual-key window, so the rotation is an outage and gets postponed forever.',
      'One shared credential for every service, so a leak cannot be traced and a rotation touches everything.',
      'Baking secrets into container images or front-end bundles.',
      'Printing the configuration, secrets included, into logs at startup.',
    ],
    realWorld: [
      'The HashiCorp Vault database secrets engine creates a database user per request with a lease (1 hour in its example) and revokes it when the lease ends; the SQL username names the service.',
      'AWS Secrets Manager rotates database secrets with a single-user strategy (a short window where logins can be denied) or an alternating-users strategy (two valid users, for high availability).',
      'GitHub tells you to revoke or rotate a leaked secret first, before rewriting history, because clones and forks keep the old commits.',
    ],
    related: ['api-keys', 'tls-https', 'authentication'],
    quiz: [
      {
        id: 'sec-1',
        prompt:
          'A developer pushes a cloud access key to a public repository, notices 4 minutes later and pushes a commit that deletes it. What should happen first?',
        options: [
          'Rewrite history to remove the key and force push',
          'Revoke the key and issue a new one, then clean history if still wanted',
          'Make the repository private',
          'Nothing - the delete commit removed it',
        ],
        answer: 1,
        explanation:
          'The old commit is still in history, in every clone and in any fork, and scanners find public keys within minutes. Only revoking the key makes those copies useless. Rewriting history is tempting, but it cannot reach clones and forks, so a history rewrite without rotation leaves a working key in the wild. Making the repository private has the same gap.',
      },
      {
        id: 'sec-2',
        prompt:
          'In the Secrets Lab the password is In code, Dual-key window is off, and you press Rotate. What do you see?',
        options: [
          'Only the Orders API breaks, because its key leaked',
          'Nothing breaks, because the new password is committed with the rotation',
          'All three services break, and each one recovers only when its redeploy lands - the last after about 18 s',
          'The services keep working, but the attacker keeps access until the last redeploy',
        ],
        answer: 2,
        explanation:
          'All three share one password. Setting the new one ends the old one at once, but each service still runs the image built with the old value until it is rebuilt and redeployed, one after another. The last option describes the dual-key window: that is what you get with the toggle on, not off.',
      },
      {
        id: 'sec-3',
        prompt: 'You repeat the same rotation in the Lab with Dual-key window on. What changes?',
        options: [
          'No service goes down, but the leaked password keeps working until the last service is redeployed',
          'The rotation finishes much sooner',
          'The services still go down, but the attacker is locked out sooner',
          'Only the Orders API has to be redeployed',
        ],
        answer: 0,
        explanation:
          'While both passwords are valid, every service can log in with whichever one it has, so there is no outage. The price is that the old password - the leaked one - is revoked only after the last holder has moved. The redeploys take just as long, and all three still need one, because all three hold the shared password.',
      },
      {
        id: 'sec-4',
        prompt:
          'In the Lab you switch to Vault, leak the Orders API key and rotate it. What happens to the Billing worker and the Reports job?',
        options: [
          'They break too, because the vault rotates every credential at once',
          'They must be restarted to fetch the new credential',
          'They keep working with the leaked credential',
          'Nothing - they have their own credentials and never notice',
        ],
        answer: 3,
        explanation:
          'With a vault, each service gets its own database user, so the leaked credential only speaks for Orders, and only Orders has to move to a new one - which it fetches in seconds. The tempting answer is a restart, but that is the .env world, where the value is read once at start and shared by everyone.',
      },
      {
        id: 'sec-5',
        prompt:
          'A service gets a dynamic database credential at 09:40 with a lease whose maximum is 1 hour. An attacker copies it from a log line at 10:00 and nobody notices. When does it stop working?',
        options: [
          'Never, until someone rotates it',
          'At 10:40 at the latest, when the lease reaches its 1-hour maximum',
          'At 11:00, one hour after it was stolen',
          'Right away, because the vault sees a new address',
        ],
        answer: 1,
        explanation:
          'The lease is counted from when the credential was issued, not from when it was stolen, and when it ends the vault drops the database user. That is the point of dynamic credentials: a leak nobody noticed still expires. A vault does not watch client addresses, so it does not cut the attacker off by itself.',
      },
      {
        id: 'sec-6',
        prompt:
          'A team moves the database password out of the code into a gitignored .env file that a script copies to all 40 hosts. What is still weak?',
        options: [
          'Nothing - once it is out of git the problem is solved',
          'The .env file is encrypted by the operating system, so only rotation remains',
          'The password is static and shared, lives in 40 files and their backups, and rotating it means editing and restarting 40 hosts',
          'Environment variables cannot be read by anything but the service',
        ],
        answer: 2,
        explanation:
          'Moving it out of git removes the worst exposure, but the secret is still a long-lived value with 40 copies at rest, and it cannot be traced to one host or rotated without touching all of them. A .env file is plain text, and environment variables can end up in logs, crash dumps and child processes.',
      },
      {
        id: 'sec-7',
        prompt:
          'Your services will read their secrets from a vault. How does a service log in to the vault without putting a vault token in its image?',
        options: [
          'Workload identity: the platform (a Kubernetes service account, a cloud instance role) vouches for the service',
          'A vault token in a .env file on each host',
          'A token hardcoded in the code, but obfuscated',
          'The vault answers anonymous reads from inside the network',
        ],
        answer: 0,
        explanation:
          'The platform already knows which workload is running and can sign a statement about it, which the vault checks. No secret is provisioned by hand. A token in a .env file or in the code just moves the original problem one step back, and anonymous reads throw away access control and auditing.',
      },
      {
        id: 'sec-8',
        prompt:
          'Services use dynamic database credentials with 15-minute leases. The vault is down for 30 minutes. What happens?',
        options: [
          'Nothing - services keep their credentials until the vault is back',
          'Every service fails at the moment the vault goes down',
          'The database refuses all logins until the vault is back',
          'Services keep working until their current lease ends, then fail to log in until the vault is back',
        ],
        answer: 3,
        explanation:
          'A running service still holds a valid credential, so it works - until the lease ends and it cannot get a new one. Short leases put the vault on the critical path, which is why it is run highly available. Try Vault reachable off in the Lab. With static secrets from a vault, the cached value would keep working through the outage.',
      },
      {
        id: 'sec-9',
        prompt:
          'The database log shows a login from an unknown address. What does one database user per service give you in this investigation?',
        options: [
          'Faster queries for the attacker to be spotted by',
          'Nothing, until the attacker is blocked at the network',
          'The username names the one service whose credential leaked, so you rotate only that one',
          'The leaked credential cannot be used from another address',
        ],
        answer: 2,
        explanation:
          'With a shared app_user the log says only that one of many holders leaked, so everything must be rotated and nobody knows where to look. With a user per service the login names its source, and the vault audit log shows who read it. It does not stop the login itself - a credential works from any address.',
      },
      {
        id: 'sec-10',
        prompt:
          'Database passwords are meant to rotate every 90 days, but in two years it never happened, because each attempt caused an outage. What change makes rotation happen?',
        options: [
          'Rotate once a year instead',
          'Allow two valid credentials at once: create the new one, move every holder, check traffic, revoke the old one',
          'Keep the old password valid forever as a fallback',
          'Rotate only during a night maintenance window with downtime',
        ],
        answer: 1,
        explanation:
          'Rotation without overlap is a coordinated outage, so it is postponed. With two valid credentials, each holder can move at its own pace and the old one is revoked when nobody uses it. Rotating less often only makes the next outage rarer, and a fallback that is never revoked means the rotation achieved nothing.',
      },
      {
        id: 'sec-11',
        prompt:
          'A single-page app calls a payment API with a secret key read from the build variable VITE_PAYMENT_KEY. What is wrong?',
        options: [
          'The value is compiled into the JavaScript every browser downloads, so it is public; the call must go through a backend',
          'Nothing - build variables are never shipped',
          'It only leaks if the repository is public',
          'It is fine as long as the key is rotated every 90 days',
        ],
        answer: 0,
        explanation:
          'Front-end build variables are replaced by their values in the bundle, so anyone can read the key in the browser. A front end cannot keep a secret at all; a backend holds the key and calls the payment API. Rotating a public key only hands a new public key to everyone.',
      },
      {
        id: 'sec-12',
        prompt:
          'A Dockerfile contains ENV DB_PASSWORD=... and the image is pushed to a registry that 5 teams pull from. What is the exposure?',
        options: [
          'None - only the running container can see its environment',
          'Removing the ENV line in the next build fixes it',
          'Only people with shell access to the hosts can read it',
          'Anyone who can pull the image can read the password from its configuration; rotate it and inject it at runtime instead',
        ],
        answer: 3,
        explanation:
          'Values set with ENV are stored in the image configuration and visible to anyone who inspects the image, in every copy already pulled. A new build without the line does not change the images that already exist, so the password must be rotated, and the new one delivered at runtime.',
      },
    ],
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
