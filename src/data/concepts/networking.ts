import type { Concept } from '@/types';

export const networkingConcepts: Concept[] = [
  {
    slug: 'dns',
    title: 'DNS',
    tagline: 'Turning a hostname into an address - with caching at every layer.',
    category: 'networking',
    difficulty: 'Beginner',
    lab: 'url-journey',
    keywords: ['resolution', 'ttl', 'records', 'anycast'],
    what: 'DNS is the distributed directory that maps names such as example.com to IP addresses, using a hierarchy of resolvers, root, TLD and authoritative servers.',
    why: 'It is the first hop of every request. It is also a routing tool: DNS decides which region, CDN edge or load balancer a user talks to before a single byte of your application runs.',
    how: [
      'The browser checks its own cache, then the OS, then the configured recursive resolver.',
      'On a miss the resolver walks root -> TLD -> authoritative nameserver.',
      'The answer is cached for the record TTL at every level on the way back.',
      'Record types matter: A/AAAA for addresses, CNAME for aliases, MX for mail, TXT for verification.',
    ],
    when: ['Always. The design choice is TTL length and whether you use DNS for failover or geo-routing.'],
    diagram: `browser cache -> OS cache -> recursive resolver
                                      |
                        root -> .com TLD -> authoritative
                                      |
                              A record + TTL (e.g. 60s)`,
    tradeoffs: [
      {
        approach: 'Short TTL (30-60s)',
        gains: ['Fast failover and traffic shifts', 'Useful for blue/green cutovers'],
        costs: ['More resolver traffic', 'Some clients ignore short TTLs anyway'],
      },
      {
        approach: 'Long TTL (hours)',
        gains: ['Fewer lookups, slightly faster first byte', 'Resilient to resolver outages'],
        costs: ['Changing where traffic goes takes hours', 'Bad for incident response'],
      },
    ],
    mistakes: [
      'Relying on DNS as the only failover mechanism - clients and resolvers cache beyond the TTL.',
      'Forgetting that a DNS lookup is a real latency cost on a cold connection.',
    ],
    related: ['cdn', 'load-balancing', 'what-happens-when-you-type-a-url'],
    quiz: [
      {
        id: 'dns-1',
        prompt: 'You change an A record with a 24-hour TTL to point at a new load balancer. Some users still hit the old one hours later. Why?',
        options: [
          'The record did not propagate correctly',
          'Resolvers and clients cache the old answer until the TTL expires',
          'DNS requires a restart of the authoritative server',
          'The new load balancer is unhealthy',
        ],
        answer: 1,
        explanation:
          'DNS does not push changes. Caches hold the previous answer for up to the TTL, which is why cutovers use short TTLs set well in advance.',
      },
    ],
  },
  {
    slug: 'http-https',
    title: 'HTTP / HTTPS',
    tagline: 'The request/response protocol everything else is built on.',
    category: 'networking',
    difficulty: 'Beginner',
    keywords: ['http2', 'http3', 'tls', 'headers', 'status codes'],
    what: 'HTTP is a stateless request/response protocol: a method, a path, headers and an optional body in, a status code, headers and a body out. HTTPS is HTTP carried inside a TLS-encrypted connection.',
    why: 'Its semantics shape your API: which methods are safe to retry, what can be cached, and how intermediaries (proxies, CDNs) may treat your traffic.',
    how: [
      'Methods carry meaning: GET is safe and cacheable, PUT and DELETE are idempotent, POST is neither.',
      'Status codes drive client behaviour: 429 and 503 mean retry later, 4xx generally means do not retry.',
      'Cache-Control and ETag headers let browsers and CDNs avoid round trips entirely.',
      'HTTP/2 multiplexes many requests over one connection; HTTP/3 moves to QUIC over UDP to remove head-of-line blocking.',
    ],
    when: ['Any public API or web frontend.'],
    diagram: `GET /api/products/42 HTTP/1.1
Host: example.com
Cache-Control: max-age=0

HTTP/1.1 200 OK
Cache-Control: public, max-age=300
ETag: "a91f"
Content-Type: application/json`,
    mistakes: [
      'Using POST for everything, which makes retries unsafe and caching impossible.',
      'Returning 200 with an error body - clients, proxies and monitoring all misread it.',
      'Ignoring Cache-Control and paying for traffic a CDN could have served.',
    ],
    related: ['rest-apis', 'cdn', 'idempotency', 'tls-https'],
  },
  {
    slug: 'tcp-vs-udp',
    title: 'TCP vs UDP',
    tagline: 'Ordered and reliable, or fast and lossy.',
    category: 'networking',
    difficulty: 'Beginner',
    keywords: ['transport', 'handshake', 'packet loss', 'quic'],
    what: 'TCP provides an ordered, reliable byte stream with connection setup, retransmission and congestion control. UDP sends independent datagrams with none of those guarantees.',
    why: 'Reliability is not free: retransmission and ordering add latency. Some workloads prefer a lost packet over a late one.',
    how: [
      'TCP: three-way handshake, sequence numbers, acknowledgements, retransmit on loss, flow control.',
      'UDP: fire and forget, no handshake, no ordering, no congestion control unless you add it.',
      'QUIC (HTTP/3) is built on UDP and implements its own reliability and streams to avoid head-of-line blocking.',
    ],
    when: [
      'TCP: APIs, databases, file transfer - anything where correctness beats latency.',
      'UDP: live voice and video, gaming, metrics shipping, DNS queries.',
    ],
    diagram: `TCP                        UDP
SYN ->                     data ->
   <- SYN/ACK              data ->
ACK ->                     data ->   (one lost, nobody notices)
data (ordered, retried)
ordering guaranteed        no ordering, no retries`,
    tradeoffs: [
      {
        approach: 'TCP',
        gains: ['No lost or reordered data', 'Congestion control protects the network'],
        costs: ['Handshake latency', 'Head-of-line blocking: one lost packet stalls the stream'],
      },
      {
        approach: 'UDP',
        gains: ['Minimal latency', 'Loss of one datagram does not stall the rest'],
        costs: ['You must handle loss, ordering and congestion yourself', 'More likely to be blocked by middleboxes'],
      },
    ],
    related: ['http-https', 'websockets', 'dns'],
  },
  {
    slug: 'reverse-proxy',
    title: 'Reverse Proxy',
    tagline: 'A server-side front door that clients never see past.',
    category: 'networking',
    difficulty: 'Beginner',
    keywords: ['nginx', 'tls termination', 'routing', 'gateway'],
    what: 'A reverse proxy sits in front of your servers and accepts requests on their behalf, then forwards them to the right backend.',
    why: 'It gives you one place to terminate TLS, route by path or host, compress responses, cache, rate limit, and hide your internal topology.',
    how: [
      'Clients connect to the proxy; the proxy opens its own connection to a backend.',
      'Routing rules choose the backend by hostname, path prefix or header.',
      'The proxy can cache responses, add security headers and enforce limits before traffic reaches your code.',
    ],
    when: ['Almost every production web system. NGINX, Envoy, HAProxy and cloud ALBs all play this role.'],
    diagram: `Client -> Reverse Proxy -> /api   -> API servers
                        -> /static-> object storage
                        -> /ws    -> realtime service

TLS terminated once, at the proxy.`,
    tradeoffs: [
      {
        approach: 'Reverse proxy in front of services',
        gains: ['Central TLS, routing, caching and rate limiting', 'Backends can change without clients noticing'],
        costs: ['One more hop of latency', 'Becomes critical infrastructure and needs redundancy'],
      },
    ],
    mistakes: [
      'Forgetting X-Forwarded-For, so every log line shows the proxy IP instead of the client.',
      'Mismatched timeouts between proxy and backend, producing confusing 502/504 errors.',
    ],
    related: ['forward-proxy', 'load-balancing', 'api-gateway', 'cdn'],
  },
  {
    slug: 'forward-proxy',
    title: 'Forward Proxy',
    tagline: 'A client-side intermediary that speaks to the internet for you.',
    category: 'networking',
    difficulty: 'Beginner',
    keywords: ['egress', 'corporate proxy', 'filtering', 'nat'],
    what: 'A forward proxy sits in front of clients: outbound requests go through it, and it contacts the destination on their behalf.',
    why: 'It is where organisations enforce egress policy - filtering, auditing, caching and presenting a single outbound IP.',
    how: [
      'Clients are configured to send requests to the proxy instead of directly to the destination.',
      'The proxy applies policy (allow/deny lists, authentication), then forwards.',
      'Responses may be cached and shared between clients.',
    ],
    when: ['Corporate networks, CI runners that need a fixed egress IP, outbound API allow-listing.'],
    diagram: `Forward proxy:  [clients] -> proxy -> internet   (protects/serves the client)
Reverse proxy:  internet -> proxy -> [servers]  (protects/serves the server)`,
    mistakes: ['Confusing it with a reverse proxy - the difference is which side it represents.'],
    related: ['reverse-proxy', 'api-gateway'],
  },
  {
    slug: 'cdn',
    title: 'CDN',
    tagline: 'Copies of your content close to the user, so distance stops mattering.',
    category: 'networking',
    difficulty: 'Beginner',
    lab: 'cdn',
    keywords: ['edge', 'cache', 'latency', 'origin', 'invalidation'],
    what: 'A content delivery network is a global fleet of edge caches. Users are routed to a nearby edge, which serves cached content directly and only contacts your origin on a miss.',
    why: 'The speed of light is a hard constraint: a round trip from Sydney to Virginia costs about 200 ms no matter how fast your servers are. Serving from an edge 50 km away turns that into single-digit milliseconds.',
    how: [
      'DNS or anycast routes the user to the nearest edge location.',
      'The edge checks its cache. A hit is served immediately.',
      'A miss is fetched from the origin (often over an optimised backbone), stored, and then served.',
      'Cache-Control headers and TTLs decide how long the copy stays valid; purges invalidate it early.',
    ],
    when: [
      'Static assets: images, JS, CSS, fonts, video segments.',
      'Cacheable API responses (public catalogues, configuration).',
      'Any global audience where origin round trips dominate latency.',
    ],
    diagram: `                  Origin Server
                       |
        +--------------+--------------+
        v              v              v
    Europe edge     US edge       Asia edge
        ^              ^              ^
    users nearby   users nearby   users nearby

CDN OFF: every user -> origin        (120-300 ms)
CDN ON : most users -> nearest edge  (5-30 ms)`,
    advantages: [
      'Dramatically lower latency for distant users.',
      'Absorbs traffic spikes and takes load off the origin.',
      'Provides DDoS absorption and TLS termination at the edge.',
    ],
    tradeoffs: [
      {
        approach: 'Long edge TTLs',
        gains: ['Higher hit ratio', 'Less origin traffic and cost'],
        costs: ['Stale content until TTL expires or you purge', 'Purges are eventually consistent across the fleet'],
      },
      {
        approach: 'Caching personalised responses',
        gains: ['Even dynamic pages get edge speed'],
        costs: ['Easy to leak one user data to another if the cache key is wrong', 'Needs careful Vary headers'],
      },
    ],
    mistakes: [
      'Caching responses that vary by user without including the user in the cache key.',
      'Content-hashed filenames missing, so you cannot cache aggressively and still deploy.',
      'Assuming a purge is instant everywhere - design for a window of staleness.',
    ],
    realWorld: [
      'Video streaming is mostly a CDN problem: segments are cached at the edge and origin sees a fraction of requests.',
      'Static sites with hashed asset names can use effectively infinite TTLs.',
    ],
    related: ['caching', 'dns', 'cache-strategies', 'http-https'],
    quiz: [
      {
        id: 'cdn-1',
        prompt: 'Your CDN hit rate is 55% for images that never change. What is the most likely cause?',
        options: [
          'The CDN has too few edge locations',
          'Cache-Control TTLs are short or missing, so edges keep revalidating with the origin',
          'Users are too far away',
          'The origin is too slow',
        ],
        answer: 1,
        explanation:
          'Hit rate is mostly a function of cache keys and TTLs. Immutable assets should be served with long max-age and content-hashed URLs.',
      },
    ],
  },
  {
    slug: 'api-gateway',
    title: 'API Gateway',
    tagline: 'One entrance where auth, limits and routing are applied once.',
    category: 'networking',
    difficulty: 'Intermediate',
    lab: 'api-gateway',
    keywords: ['routing', 'jwt', 'rate limiting', 'bff', 'aggregation'],
    what: 'An API gateway is the single entry point for client traffic into a set of backend services. It authenticates, applies rate limits, routes to the correct service and can transform or aggregate responses.',
    why: 'Without it, every service re-implements authentication, throttling, CORS and logging - inconsistently. The gateway makes those concerns cross-cutting instead of copy-pasted.',
    how: [
      'Validate the credential (JWT signature, API key) and reject early if invalid.',
      'Apply per-client rate limits and quotas.',
      'Match the route and forward to the owning service, adding correlation headers.',
      'Optionally aggregate several backend calls into one client response.',
    ],
    when: [
      'Microservice systems with many public endpoints.',
      'Public APIs that need keys, quotas and versioning.',
      'Mobile clients that would otherwise make ten calls to render one screen.',
    ],
    diagram: `GET /api/orders/123
  |
  v
API Gateway
  |-- JWT validation      (401 if invalid)
  |-- Rate limit check    (429 if over quota)
  |-- Route match         /api/orders/* -> Orders Service
  v
Orders Service -> Orders DB`,
    tradeoffs: [
      {
        approach: 'Single API gateway',
        gains: ['One place for auth, limits, logging, versioning', 'Clients see a stable surface while services change'],
        costs: ['Potential bottleneck and single point of failure', 'Can grow into a monolith of routing logic', 'Adds a hop'],
      },
      {
        approach: 'Direct client-to-service calls',
        gains: ['Fewer hops, lower latency', 'No shared component to scale'],
        costs: ['Each service repeats cross-cutting concerns', 'Client must know the topology, which then cannot change'],
      },
    ],
    mistakes: [
      'Putting business logic in the gateway until it becomes the thing microservices were meant to avoid.',
      'Running one gateway instance and calling the system highly available.',
      'Validating tokens at the gateway but leaving services reachable without authentication internally.',
    ],
    related: ['microservices', 'rate-limiting', 'jwt', 'reverse-proxy'],
    quiz: [
      {
        id: 'agw-1',
        prompt: 'Why validate JWTs at the gateway rather than in each service?',
        options: [
          'Services cannot verify signatures',
          'It rejects unauthenticated traffic before it consumes backend capacity, and keeps one implementation of the rules',
          'It makes tokens shorter',
          'It removes the need for TLS',
        ],
        answer: 1,
        explanation:
          'Early rejection protects backends and centralises the logic. Services usually still verify the token as defence in depth.',
      },
    ],
  },
];
