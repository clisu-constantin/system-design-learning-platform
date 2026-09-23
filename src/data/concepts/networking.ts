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
    tradeoffs: [
      {
        approach: 'HTTPS everywhere',
        gains: ['Confidentiality and integrity against anyone on the network path', 'Required by browsers for HTTP/2, service workers and many modern APIs'],
        costs: ['Extra handshake round trips on new connections', 'Certificates to issue, rotate and monitor for expiry'],
      },
      {
        approach: 'HTTP/2 or HTTP/3 instead of HTTP/1.1',
        gains: ['Many requests multiplexed over one connection', 'HTTP/3 removes TCP head-of-line blocking on lossy networks'],
        costs: ['Harder to debug with plain-text tools', 'HTTP/3 runs on UDP, which some firewalls and middleboxes block or throttle'],
      },
      {
        approach: 'Leaning on HTTP caching headers',
        gains: ['Browsers and CDNs answer repeat requests with no origin work', 'Standard behaviour every intermediary already understands'],
        costs: ['Clients may see stale data until max-age runs out', 'Wrong headers can cache private or per-user responses publicly'],
      },
    ],
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
    lab: 'proxy',
    labFocus: 'reverse-proxy',
    keywords: ['nginx', 'tls termination', 'routing', 'gateway', 'x-forwarded-for'],
    what: 'A reverse proxy sits in front of your servers and accepts requests on their behalf, then forwards them to the right backend. It acts for the servers: clients only ever see its address.',
    why: 'It gives you one place to terminate TLS, route by path or host, compress responses, cache, rate limit, and hide your internal topology.',
    how: [
      'Clients connect to the proxy; the proxy opens its own connection to a backend.',
      'Routing rules choose the backend by hostname, path prefix or header.',
      'The proxy can cache responses, add security headers and enforce limits before traffic reaches your code.',
      'Because the backend now sees the proxy as its caller, the proxy passes the client address on in X-Forwarded-For (or the standard Forwarded header).',
    ],
    when: ['Almost every production web system. NGINX, Envoy, HAProxy and cloud application load balancers all play this role.'],
    advantages: [
      'TLS certificates live in one place instead of on every server.',
      'Backends can move, split or change version without clients noticing.',
      'Caching, compression and buffering of slow clients happen before your code runs.',
      'Backends can sit on private addresses that nobody outside can reach.',
    ],
    diagram: `Client -> Reverse Proxy -> /api    -> API servers
                        -> /static -> object storage
                        -> /ws     -> realtime service

TLS terminated once, at the proxy.`,
    tradeoffs: [
      {
        approach: 'Reverse proxy that terminates TLS',
        gains: ['Central TLS, routing, caching and rate limiting', 'Backends can change without clients noticing'],
        costs: [
          'One more hop of latency',
          'Becomes critical infrastructure and needs redundancy',
          'Traffic behind it is plain HTTP unless you re-encrypt',
        ],
      },
      {
        approach: 'TLS passthrough (the proxy forwards encrypted bytes)',
        gains: ['Encryption runs end to end to the app server', 'The proxy never holds the private key'],
        costs: [
          'No caching, path routing or header changes - the proxy cannot read the request',
          'Every app server needs the certificate',
          'No X-Forwarded-For; the client address needs the PROXY protocol instead',
        ],
      },
      {
        approach: 'No proxy - clients reach app servers directly',
        gains: ['One less hop and one less component to run'],
        costs: [
          'Every app server is public and holds a certificate',
          'No single place for routing, caching or limits',
          'Moving a backend changes what clients connect to',
        ],
      },
    ],
    mistakes: [
      'Forgetting X-Forwarded-For, so every log line shows the proxy IP instead of the client.',
      'Trusting X-Forwarded-For from any sender, so anyone can fake their address and slip past per-IP rate limits.',
      'Mismatched timeouts between proxy and backend, producing confusing 502/504 errors.',
      'Leaving response buffering on for streaming routes, which then appear to hang.',
      'Running one proxy instance in front of everything - the front door becomes the single point of failure.',
    ],
    related: ['forward-proxy', 'load-balancing', 'api-gateway', 'cdn'],
    quiz: [
      {
        id: 'reverse-proxy-1',
        prompt:
          'You put nginx in front of your app. The next day every line in the app access log shows 10.0.0.2, and the per-client rate limiter throttles all users together. What happened, and what is the fix?',
        options: [
          'The app servers were given the wrong IP address; renumber them',
          'The proxy is now the TCP peer of every request; have it add X-Forwarded-For and make the app read that header, trusting it only from the proxy',
          'Rate limiting cannot work behind a proxy; remove the limiter',
          'Make the app read the client address from the TCP connection instead of the header',
        ],
        answer: 1,
        explanation:
          'Once a proxy forwards the request, the connection the app sees comes from the proxy - the Lab shows peer=10.0.0.2 on every log line. The proxy must pass the client address in X-Forwarded-For (nginx does not add it unless configured). Reading the TCP peer is exactly what produces 10.0.0.2, so that option changes nothing.',
      },
      {
        id: 'reverse-proxy-2',
        prompt:
          'Your app rate limits by the leftmost X-Forwarded-For value, and the app servers can also be reached directly from the internet. An abuser sends every request with a different made-up X-Forwarded-For. What happens?',
        options: [
          'Nothing - the proxy rewrites the header, so the fake values are dropped',
          'The requests fail, because a header with an unknown address is rejected',
          'Each request looks like a new client, so the per-IP limit never triggers; trust only the address your own proxy appended, and make the app reachable only through the proxy',
          'The limiter falls back to the TCP address automatically',
        ],
        answer: 2,
        explanation:
          'X-Forwarded-For is just a header: anyone can send one. Only the entry added by your own proxy is trustworthy, and only if requests cannot bypass the proxy. A proxy that appends (the usual nginx $proxy_add_x_forwarded_for) keeps the fake values on the left, so trusting the leftmost value is the bug - the proxy does not drop them.',
      },
      {
        id: 'reverse-proxy-3',
        prompt:
          'Security asks that TLS pass through the reverse proxy untouched, all the way to the app servers. The team also wanted the proxy to cache product pages and route /search to a new service. What do they lose?',
        options: [
          'Nothing - passthrough only changes where the certificate is stored',
          'Only compression; caching and routing still work on encrypted traffic',
          'Load balancing; a passthrough proxy can only send traffic to one server',
          'Caching, path routing and headers such as X-Forwarded-For - the proxy only sees encrypted bytes, so it cannot read the path or the response',
        ],
        answer: 3,
        explanation:
          'A proxy can only act on what it can read. With passthrough it can still spread connections across servers, but it cannot see /search or cache a page it cannot decrypt. In the Lab, switching TLS termination off disables the cache and the X-Forwarded-For toggles.',
      },
      {
        id: 'reverse-proxy-4',
        prompt:
          'A server-sent events endpoint works when you call the app directly, but behind nginx the browser receives nothing until the stream closes. What is the most likely cause?',
        options: [
          'Response buffering in the proxy holds the events until the response ends; turn buffering off for that route',
          'nginx cannot forward long-lived HTTP responses at all',
          'The browser blocks events that come through a proxy',
          'TLS termination breaks streaming; move TLS to the app',
        ],
        answer: 0,
        explanation:
          'nginx buffers upstream responses by default (proxy_buffering on), which protects app workers from slow clients but holds back a stream. Turn it off for streaming routes, for example with proxy_buffering off or the X-Accel-Buffering: no response header. TLS termination has nothing to do with it.',
      },
      {
        id: 'reverse-proxy-5',
        prompt:
          'A report endpoint takes about 90 seconds. Users get 504 Gateway Timeout after exactly 60 seconds, yet the app logs show the report finishing successfully at 90 seconds. What is going on?',
        options: [
          'The app crashed at 60 seconds and restarted',
          'The browser gave up after 60 seconds',
          'The proxy read timeout (60 seconds by default in nginx) is shorter than the backend work; choose the timeouts together, or make the report asynchronous',
          'The database timed out, and the app reported success by mistake',
        ],
        answer: 2,
        explanation:
          '504 means a gateway or proxy gave up waiting for the upstream. The backend keeps working and succeeds, but nobody is listening any more. A browser giving up would not produce a 504 response. Either raise the proxy timeout for that route or, better for 90 seconds of work, return a job id and let the client poll.',
      },
      {
        id: 'reverse-proxy-6',
        prompt:
          'You extract search from the monolith into a new service. Mobile apps already in the field call https://shop.example/search. What is the least disruptive way to send that traffic to the new service?',
        options: [
          'Ship a new app version that calls the new service address',
          'Add a route in the reverse proxy that sends /search to the new service; clients keep the same URL',
          'Give the new service its own public domain and a redirect from the monolith',
          'Keep search in the monolith until every user upgrades',
        ],
        answer: 1,
        explanation:
          'The proxy decouples the public URL from the internal layout, so moving a path is a proxy configuration change. A new app version or a new domain forces clients to change, which is exactly what the proxy lets you avoid.',
      },
      {
        id: 'reverse-proxy-7',
        prompt:
          'One nginx instance fronts your whole site. It has never crashed, and your manager asks whether a second one is worth the cost. What is the strongest argument?',
        options: [
          'Two proxies halve the latency of every request',
          'nginx needs a second instance to terminate TLS',
          'There is none; a proxy that never crashed does not need a spare',
          'Every request passes through it, so one instance is a single point of failure - a kernel update, a bad config reload or a lost zone takes the whole site down',
        ],
        answer: 3,
        explanation:
          'Anything that fronts the whole system must be redundant, which is why the Lab draws the proxy as x2. Outages usually come from maintenance and bad changes, not random crashes. A second proxy does not make requests faster; it keeps the front door open when one is gone.',
      },
      {
        id: 'reverse-proxy-8',
        prompt:
          'In the Proxy Lab, with the proxy on the server side and the cache on, a cache hit takes about 41 ms and a miss about 62 ms. On the client side a hit takes about 3 ms. Why does the reverse proxy cache save so much less time?',
        options: [
          'The request still crosses the internet to reach the reverse proxy; its cache saves app work and origin load, not the distance',
          'Reverse proxies store their cache on disk and forward proxies in memory',
          'The reverse proxy must decrypt every response, and the forward proxy does not',
          'The Lab is wrong: both caches save the same time',
        ],
        answer: 0,
        explanation:
          'A cache saves the part of the journey behind it. The forward proxy sits next to the laptops, so a hit skips the internet. The reverse proxy sits next to the servers, so a hit skips only the app. Cutting the distance is the job of a CDN, which puts caches near users. The Lab numbers are a simplified model, but the direction holds.',
      },
      {
        id: 'reverse-proxy-9',
        prompt:
          'Behind your reverse proxy the app servers speak plain HTTP on private addresses. Which machines need the TLS certificate and private key for shop.example?',
        options: [
          'Every app server, because the data is theirs',
          'The browsers, which must install your certificate',
          'Only the reverse proxy, because TLS terminates there',
          'Both the proxy and every app server, or the connection fails',
        ],
        answer: 2,
        explanation:
          'With TLS termination the encrypted session ends at the proxy, so only it holds the key. That is one of the main reasons to have a proxy: certificates and renewals live in one place. App servers need a certificate only with passthrough, or if you choose to re-encrypt inside the network.',
      },
      {
        id: 'reverse-proxy-10',
        prompt:
          'Large responses to users on slow mobile networks keep application workers busy for seconds each, and the app runs out of workers at peak. Nothing else about the load changed. Which proxy feature addresses this directly?',
        options: [
          'Path routing, to send mobile users to a separate server',
          'Response buffering: the proxy takes the whole response from the app quickly, frees the worker, and trickles it to the slow client itself',
          'X-Forwarded-For, so the app knows which users are slow',
          'TLS passthrough, so the app handles encryption more efficiently',
        ],
        answer: 1,
        explanation:
          'A proxy connection is cheap; an application worker is expensive. Buffering lets the proxy absorb the slow client while the worker moves on. It is the same buffering that must be turned off for streaming routes. Routing mobile users elsewhere just moves the stuck workers.',
      },
      {
        id: 'reverse-proxy-11',
        prompt:
          'A teammate says: we have a reverse proxy, so our servers never learn the addresses of our users. In the Lab, with the proxy on the server side, the app log shows xff=198.51.100.21. Who is right?',
        options: [
          'The teammate - a reverse proxy hides clients from the servers',
          'The teammate - X-Forwarded-For is removed before the request reaches the app',
          'The Lab - but only because the Lab has no NAT',
          'The Lab - a reverse proxy acts for the servers and hides them from clients; with X-Forwarded-For the app still learns each client address',
        ],
        answer: 3,
        explanation:
          'Direction is the whole point. A reverse proxy hides the servers: clients connect to 192.0.2.10 and never see 10.0.1.x. Hiding clients from servers is what a forward proxy does - and even that fails if it adds X-Forwarded-For. NAT has nothing to do with it.',
      },
    ],
  },
  {
    slug: 'forward-proxy',
    title: 'Forward Proxy',
    tagline: 'A client-side intermediary that speaks to the internet for you.',
    category: 'networking',
    difficulty: 'Beginner',
    lab: 'proxy',
    labFocus: 'forward-proxy',
    keywords: ['egress', 'corporate proxy', 'filtering', 'nat', 'allow-list', 'connect', 'squid'],
    what: 'A forward proxy sits in front of clients: outbound requests go through it, and it contacts the destination on their behalf. It acts for the clients: the destination sees the proxy address, not theirs.',
    why: 'It is where organisations enforce egress policy - filtering, auditing, caching and presenting a single outbound IP.',
    how: [
      'Clients are configured to send requests to the proxy instead of directly to the destination (for example with HTTP_PROXY and HTTPS_PROXY).',
      'The proxy applies policy (allow/deny lists, authentication), then forwards.',
      'HTTPS is usually tunnelled with CONNECT: the proxy sees the hostname, not the content.',
      'Responses it can read may be cached and shared between clients.',
    ],
    when: [
      'Corporate networks, CI runners that need a fixed egress IP, outbound API allow-listing.',
      'Production subnets with no direct internet route, where every outbound call must be approved.',
    ],
    advantages: [
      'One place to allow, deny and log everything that leaves the network.',
      'Destinations see one stable address instead of every client.',
      'A shared cache for repeated downloads it can read.',
    ],
    diagram: `Forward proxy:  [clients] -> proxy -> internet   (protects/serves the client)
Reverse proxy:  internet -> proxy -> [servers]  (protects/serves the server)`,
    tradeoffs: [
      {
        approach: 'Route client traffic through a forward proxy (CONNECT tunnels for HTTPS)',
        gains: [
          'One place to enforce egress policy, filtering and audit logs by hostname',
          'Destinations see one stable address for the whole network',
        ],
        costs: [
          'A new single point of failure and bottleneck for all outbound traffic',
          'Sees hostnames only, so it cannot cache or inspect HTTPS content',
        ],
      },
      {
        approach: 'Add TLS interception to the forward proxy',
        gains: ['Can inspect content, filter by path and cache HTTPS responses'],
        costs: [
          'A company root certificate must be installed on every client',
          'The proxy can read everything, which makes it a high-value target',
          'Apps that pin certificates stop working through it',
        ],
      },
      {
        approach: 'Direct egress with no proxy',
        gains: ['Lower latency and one less component to run', 'No certificate or configuration to push to clients'],
        costs: ['No central control over what clients can reach', 'Every client exposes its own address to the outside'],
      },
    ],
    mistakes: [
      'Confusing it with a reverse proxy - the difference is which side it represents.',
      'Forgetting NO_PROXY, so internal calls are sent out through the proxy and fail.',
      'Assuming it hides clients while it adds X-Forwarded-For with their addresses (Squid does by default).',
      'Expecting a cache to help with HTTPS that only passes through a CONNECT tunnel.',
      'Running a single instance: when it stops, every outbound call stops.',
    ],
    related: ['reverse-proxy', 'api-gateway'],
    quiz: [
      {
        id: 'forward-proxy-1',
        prompt:
          'A payments service runs in a subnet whose only way out is an allow-list proxy. After a new library is added, the service hangs for 30 seconds at startup in staging, and the proxy log shows a denied CONNECT to telemetry.example. What should you do?',
        options: [
          'Give the subnet a direct internet route so the library can reach its endpoint',
          'Decide whether that call is wanted - here, disable the telemetry - and put a short timeout on outbound calls so a blocked one cannot stall startup',
          'Add telemetry.example to the allow-list, since the library needs it',
          'Turn off the proxy log, which is causing the delay',
        ],
        answer: 1,
        explanation:
          'The proxy did its job: it turned a hidden outbound dependency into a log line and a decision. Bypassing the proxy throws that control away, and adding the host without asking why defeats the allow-list. The 30-second hang is a missing timeout, a separate bug worth fixing.',
      },
      {
        id: 'forward-proxy-2',
        prompt:
          'Your 40 CI runners each call a public API a few times a minute, well under its per-client limit, yet the provider rate limits all of them. All egress goes through one forward proxy. Why?',
        options: [
          'The proxy adds retries that multiply the traffic',
          'The runners are misconfigured and send each request twice',
          'The provider sees one source address - the proxy - for all 40 runners, so their requests add up against one limit',
          'Forward proxies are always rate limited by public APIs',
        ],
        answer: 2,
        explanation:
          'Sharing one address is the point of a forward proxy, and it also means a shared reputation and a shared rate limit. In the Lab the app sees one caller IP for both laptops. The fix is to authenticate per team with API keys, ask for a higher limit, or spread egress over more addresses - not to hunt for duplicate requests.',
      },
      {
        id: 'forward-proxy-3',
        prompt:
          'You run Squid as the office proxy to keep laptop addresses private. A partner site shows you its logs for a plain HTTP request: X-Forwarded-For lists the laptop address. What is going on?',
        options: [
          'Squid adds X-Forwarded-For with the client address by default; set forwarded_for to delete (or off) to hide it',
          'The laptop bypassed the proxy',
          'The partner site guessed the address from the TCP connection',
          'X-Forwarded-For is added by the browser, and the proxy cannot change it',
        ],
        answer: 0,
        explanation:
          'Squid ships with forwarded_for on, which appends the client address. The TCP peer the partner saw was still the proxy - the header is what leaked. Browsers do not add this header. In the Lab, turning on Add X-Forwarded-For on the client side brings the laptop address back into the log.',
      },
      {
        id: 'forward-proxy-4',
        prompt:
          'The proxy tunnels HTTPS with CONNECT and does not intercept TLS. Security wants to block uploads to files.example/upload while still allowing downloads from files.example. Can the proxy do it?',
        options: [
          'Yes - the proxy reads the path from the CONNECT request',
          'Yes - SNI carries the full URL',
          'Yes, but only for users who are logged in to the proxy',
          'No - in a tunnel it sees the hostname and port, not the path; it can block all of files.example, or intercept TLS with a root certificate on every device',
        ],
        answer: 3,
        explanation:
          'CONNECT names only host and port, and SNI carries only the hostname. The path travels inside the encrypted tunnel. Filtering by path needs TLS interception, which is a separate decision with real costs.',
      },
      {
        id: 'forward-proxy-5',
        prompt:
          'The build fleet downloads the same 300 MB package thousands of times a day from a public registry over HTTPS. You add a caching forward proxy that tunnels HTTPS with CONNECT. Egress does not drop at all. Why?',
        options: [
          'The cache is too small for a 300 MB file',
          'The proxy only relays encrypted bytes through the tunnel, so it has nothing it can cache; use a package mirror the builds fetch from, or intercept TLS',
          'Package registries forbid caching',
          'The builds bypass the proxy for large files',
        ],
        answer: 1,
        explanation:
          'A proxy can only cache what it can read. In the Lab, the Proxy cache toggle is disabled until TLS interception is on. A pull-through registry mirror is the usual answer, because the builds talk to it directly and it can cache. Cache size would lower the hit rate, not bring it to zero.',
      },
      {
        id: 'forward-proxy-6',
        prompt:
          'After HTTP_PROXY and HTTPS_PROXY are set in a container, calls to external APIs work, but calls to http://inventory.internal start failing. What is the most likely cause?',
        options: [
          'The internal hostname is not in NO_PROXY, so the call is sent to the proxy, which cannot or will not reach internal services',
          'The inventory service blocks requests that carry proxy headers',
          'HTTP_PROXY only works for HTTPS URLs',
          'DNS stops working once a proxy is configured',
        ],
        answer: 0,
        explanation:
          'Clients send everything to the proxy unless the host is listed in NO_PROXY. Internal names usually are not resolvable or allowed from the proxy. Add the internal domains to NO_PROXY. External calls working shows DNS and the proxy itself are fine.',
      },
      {
        id: 'forward-proxy-7',
        prompt:
          'In the Proxy Lab, on its Forward Proxy focus, some requests end as crosses at the proxy while TLS interception is still off. What does the blocked site see of those requests?',
        options: [
          'The request, with a flag saying the proxy objected',
          'An encrypted request it cannot read',
          'Nothing - the proxy denied the CONNECT by hostname, so the request never left the network',
          'The laptop address, because a denied request is sent directly',
        ],
        answer: 2,
        explanation:
          'Allow-list filtering works on the hostname, which the proxy sees even without decrypting. A denied request stops at the proxy with an error; nothing reaches the destination. That is why the crosses end at the proxy node instead of travelling on.',
      },
      {
        id: 'forward-proxy-8',
        prompt:
          'The company enables TLS interception on its proxy. Most sites keep working, but a banking app that pins its certificate fails on the office network. Why, and what is the usual fix?',
        options: [
          'The bank blocks company networks; ask the bank to allow your IP',
          'Interception slows the connection past the app timeout; raise the timeout',
          'The app needs HTTP_PROXY set on the phone',
          'The proxy presents a certificate signed by the company root, which the pinned app rejects; exempt that host from interception',
        ],
        answer: 3,
        explanation:
          'Interception works by the proxy impersonating each site with a certificate of its own. Clients that trust the company root accept it; an app that pins the real certificate refuses. Bypass lists for pinned or sensitive hosts are standard practice. Nothing about the failure points at timing.',
      },
      {
        id: 'forward-proxy-9',
        prompt:
          'All outbound traffic from production goes through one forward proxy instance. It stops during a routine upgrade. Your services are healthy. What do users notice?',
        options: [
          'Nothing - services fall back to direct internet access',
          'Everything that calls a third party fails at once: card payments, emails, address lookups',
          'Only employee web browsing stops',
          'Only uncached requests fail; everything else is served from the cache',
        ],
        answer: 1,
        explanation:
          'In a subnet with no direct route there is no fallback, so the proxy is on the path of every outbound call. That makes it production infrastructure: run it redundantly (the Lab draws it as x2) and monitor it. A cache inside a stopped proxy serves nothing.',
      },
      {
        id: 'forward-proxy-10',
        prompt:
          'A partner will accept your API calls only from one fixed address that they put on their firewall. Your 30 services run on autoscaled nodes whose addresses change every day. What gives the partner one stable address?',
        options: [
          'A reverse proxy in front of your services',
          'A CDN in front of the partner API',
          'Send all calls to the partner through a forward proxy (or NAT gateway) with a fixed public address; the partner sees only that address',
          'Give each node a fixed address from a reserved pool',
        ],
        answer: 2,
        explanation:
          'The partner cares about the source address of outbound calls, which is what a forward proxy replaces with its own. A reverse proxy fixes the address clients connect to, not the address you call from. Fixing addresses node by node fights autoscaling and still hands the partner a list, not one address.',
      },
    ],
  },
  {
    slug: 'cdn',
    title: 'CDN',
    tagline: 'Copies of your content close to the user, so distance stops mattering.',
    category: 'networking',
    difficulty: 'Beginner',
    lab: 'cdn',
    labFocus: 'cdn',
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
      'Assuming a purge is instant everywhere - it reaches locations one by one, and it never clears browser caches.',
      'Putting a CDN only in front of a region the users are not in - a hit still pays the trip to the edge.',
    ],
    realWorld: [
      'Video streaming is mostly a CDN problem: segments are cached at the edge and origin sees a fraction of requests.',
      'Static sites with hashed asset names can use effectively infinite TTLs.',
    ],
    related: ['caching', 'dns', 'cache-strategies', 'http-https'],
    quiz: [
      {
        id: 'cdn-1',
        prompt:
          'Your CDN hit rate is 55% for product images that never change once uploaded. The cache key is the URL alone. What is the most likely cause?',
        options: [
          'The CDN has too few edge locations',
          'Cache-Control TTLs are short or missing, so edges keep going back to the origin',
          'Users are too far away from the edges',
          'The origin is too slow to fill the edges',
        ],
        answer: 1,
        explanation:
          'With a clean cache key, hit rate is decided by how long each edge may keep a copy. Files that never change should carry a long max-age on content-hashed URLs, so every edge asks the origin once. More edge locations is the tempting answer, but it would split the same traffic across more caches and lower the hit rate, not raise it.',
      },
      {
        id: 'cdn-2',
        prompt:
          'In the CDN Lab with the CDN off, Asia Pacific users see about 240 ms per request and North America about 50 ms. The origin spends about 25 ms of that doing work. Someone proposes doubling the origin CPU. What happens to the Asia Pacific number?',
        options: [
          'It halves to about 120 ms',
          'It drops to about 13 ms, the same as with the CDN',
          'It barely moves: about 215 ms of it is the round trip across 11,500 km, which CPU cannot shorten',
          'It gets worse, because a bigger server takes longer to respond',
        ],
        answer: 2,
        explanation:
          'Almost all of the 240 ms is distance - light in fibre covers about 200 km per millisecond and real routes are longer than straight lines. Faster CPU can only shave the 25 ms of work. Halving is the tempting answer, but it assumes the time is spent on the server. Only moving the answer closer to the user, which is what an edge does, removes the distance.',
      },
      {
        id: 'cdn-3',
        prompt:
          'In the CDN Lab the CDN is on with a hit rate near 99%. You switch Edge locations to US only. What happens to latency for Europe users?',
        options: [
          'It climbs back to over 100 ms: their hits are now served from an edge an ocean away',
          'It stays around 11 ms, because the hit rate is still near 99%',
          'It drops further, because one edge holds every file',
          'Europe users get errors, because they have no edge of their own',
        ],
        answer: 0,
        explanation:
          'A hit only saves the trip from the edge to the origin; the user still has to reach the edge. With only a US edge, Europe users pay about 6,000 km each way even on a hit. Staying at 11 ms is the tempting answer, but hit rate says nothing about where the edge is. A CDN buys distance only where it has locations near the users.',
      },
      {
        id: 'cdn-4',
        prompt:
          'A logged-in dashboard API returns different data for every user and cannot be cached. Users are in Europe, the API is in Virginia. Is there any latency gain from sending it through the CDN?',
        options: [
          'No - a CDN only helps content it can cache',
          'No - it adds a hop, so it is always slower',
          'Only if the responses are compressed',
          'Yes - the TCP and TLS handshakes end at the nearby edge, and the edge reuses warm connections to the origin',
        ],
        answer: 3,
        explanation:
          'Setting up a connection costs several round trips before the first byte of the request. Ending them at an edge 20 km away turns each into a few milliseconds, and the long leg runs over a connection that is already open. The request still reaches the origin every time. "Only cached content benefits" is the tempting answer and the reason teams leave their APIs off the CDN.',
      },
      {
        id: 'cdn-5',
        prompt:
          'A team puts GET /account behind the CDN with the URL as the cache key and a 60 second TTL. Users report seeing the name of another customer. What is wrong, and what is the fix?',
        options: [
          'The TTL is too long - lower it to 5 seconds',
          'The response varies by user but the key does not - mark it Cache-Control: private (or no-store) so shared caches never keep it',
          'The edges are out of sync - purge them after every login',
          'The origin is returning the wrong user - fix the database query',
        ],
        answer: 1,
        explanation:
          'The first user to ask fills the edge copy, and everyone with the same URL gets it until it expires. A per-user response must not be stored by a shared cache at all, which is what private and no-store say. A shorter TTL is the tempting answer, but it only shrinks the leak to 5 seconds of other people seeing private data.',
      },
      {
        id: 'cdn-6',
        prompt:
          'At 10:00 you deploy a new styles.css at the same URL, served with Cache-Control: max-age=86400. At 10:05 some users see the new design, others the old one. You purge the CDN and many still see the old one. What is the long-term fix?',
        options: [
          'Put a hash of the content in the file name and keep the long max-age; keep the HTML that links to it short-lived',
          'Purge the CDN again, and keep purging until everyone has it',
          'Lower max-age to 60 seconds for every file',
          'Serve CSS from the origin, never from the CDN',
        ],
        answer: 0,
        explanation:
          'The old copy lives in two places: the edges, which a purge can clear, and the browsers, which it cannot - they keep it for up to a day. A new file name is a new URL, so no cache anywhere holds a wrong copy, and the long max-age stays safe. A 60 second TTL is the tempting answer, but it trades away the hit rate on every file forever to fix a deploy problem.',
      },
      {
        id: 'cdn-7',
        prompt:
          'Normally 10,000 requests per second hit your CDN with a 98% hit rate, so the origin sees 200 per second. A link goes viral and traffic grows to 200,000 per second while the hit rate holds at 98%. What does the origin see?',
        options: [
          'Still about 200 per second',
          'About 196,000 per second',
          'About 4,000 per second',
          'About 200,000 per second',
        ],
        answer: 2,
        explanation:
          'Origin traffic is total traffic times the miss rate: 200,000 x 2% = 4,000 per second, twenty times the usual load but a fiftieth of the spike. That is why origin offload matters most on the worst day. Staying at 200 is the tempting answer - it would need the hit rate to rise to 99.9%. In practice the hit rate often does rise with traffic, because popular files are asked for again before their copies expire.',
      },
      {
        id: 'cdn-8',
        prompt:
          'The origin goes down for ten minutes. Edges hold copies of most pages, but those copies expire during the outage and users start getting 502 errors. Which one-line change lets the edges keep answering with what they hold while the origin returns errors?',
        options: [
          'Cache-Control: no-cache',
          'Vary: *',
          'Cache-Control: private',
          'Cache-Control: stale-if-error=86400',
        ],
        answer: 3,
        explanation:
          'stale-if-error (RFC 5861) allows a cache to serve an expired copy when the origin answers with an error or cannot be reached. The outage becomes slightly old pages instead of error pages. no-cache is the tempting wrong one: it makes every use ask the origin first, which fails immediately when the origin is down.',
      },
      {
        id: 'cdn-9',
        prompt:
          'A user in Sydney types your domain. Nothing in your application knows where users are. How does the request end up at the Sydney edge rather than one in Europe?',
        options: [
          'The CDN DNS answers with an address near the user, or one anycast address is announced from every location and routing delivers it to the nearest',
          'The origin looks at the IP address and sends a redirect to the nearest edge',
          'The browser measures every edge and picks the fastest one',
          'It does not - every user reaches the same edge, which forwards the request',
        ],
        answer: 0,
        explanation:
          'Routing to the nearest edge happens before any request reaches you: either the CDN name server returns a nearby address, or the same address is advertised from every location and BGP routing takes the shortest path. A redirect from the origin is the tempting answer, but it would cost the full trip to the origin first, the very trip the CDN exists to avoid.',
      },
      {
        id: 'cdn-10',
        prompt:
          'In the CDN Lab, with hashed URLs on and a high hit rate, you change the cache key to Host + path + every query parameter. Shared links carry about 40 different utm_campaign values. What do you see, and why?',
        options: [
          'Nothing changes: query parameters never reach the edge',
          'The hit rate drops and origin traffic climbs: each file is now stored up to 40 times per edge, and each copy is fetched from the origin on its own',
          'Every request fails, because query strings make a response uncacheable',
          'The hit rate rises, because the edge now stores more copies',
        ],
        answer: 1,
        explanation:
          'The cache key decides whether two requests are the same object. The bytes do not depend on utm_campaign, but the key now does, so one file becomes 40 objects that each need their own miss. Query strings do not make a response uncacheable - they only split it. The fix is to leave tracking parameters out of the key and keep the ones that change the content, such as ?page=2.',
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
    advantages: [
      'Bad tokens, unknown routes and clients over quota are rejected before they cost a service anything.',
      'Auth, rate limits, logging and CORS are written once instead of once per service.',
      'Clients see one stable API while services are split, renamed or moved behind it.',
      'One call from a mobile app can fan out to several services inside the data centre.',
    ],
    diagram: `GET /api/orders/123
  |
  v
API Gateway               (2+ instances, multi-AZ)
  |-- JWT validation      (401 if invalid)
  |-- Rate limit check    (429 if over quota)
  |-- Route match         /api/orders/* -> Orders Service
  v
Orders Service -> Orders DB`,
    tradeoffs: [
      {
        approach: 'One shared API gateway',
        gains: ['One place for auth, limits, logging, versioning', 'Clients see a stable surface while services change'],
        costs: [
          'On every request path: a bottleneck and single point of failure unless it runs as several instances',
          'Can grow into a monolith of routing logic',
          'Adds a hop',
        ],
      },
      {
        approach: 'One gateway per client type (backend for frontend)',
        gains: ['Each app gets responses shaped for it', 'Mobile and web teams change their layer without waiting for each other'],
        costs: ['Several gateways to run and keep consistent', 'Shared rules like auth can drift between them'],
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
        prompt:
          'A bot sends 5,000 requests per second with forged tokens to /api/orders. Twelve services each verify tokens with their own library. Where should these requests be rejected, and why?',
        options: [
          'In each service, because only services can verify signatures',
          'At the gateway: it rejects them before they cost any service capacity, and the token rules live in one implementation',
          'At the database, which is the last line of defence',
          'Nowhere - TLS already stops forged tokens',
        ],
        answer: 1,
        explanation:
          'A forged token fails the signature check at the gateway, so none of the 5,000 requests reaches a service, and fixing a token rule means changing one place instead of twelve. Services usually still verify the token as defence in depth. TLS is the tempting wrong answer: it protects the connection, not the identity inside the request.',
      },
      {
        id: 'agw-2',
        prompt:
          'In the API Gateway Lab you switch "Token is valid" off and send GET /api/orders/123. Where does the request stop, and what does the client get back?',
        options: [
          'At the Orders Service, with 403 Forbidden',
          'At the rate limit check, with 429 Too Many Requests',
          'At the gateway JWT check, with 401 Unauthorized - the Orders Service is never called',
          'Nowhere - it reaches Orders, which returns 200',
        ],
        answer: 2,
        explanation:
          'Authentication is the first stage of the pipeline, and a bad signature fails it, so the gateway answers 401 and Backend cost stays at none. 403 is the tempting wrong answer: it means the caller is known but not allowed, which is a decision for the service that owns the data, not for an unauthenticated request.',
      },
      {
        id: 'agw-3',
        prompt:
          'In the API Gateway Lab, requests with an invalid token never use up the quota, and the rate limit check sits after JWT validation. Why is a per-client limit placed after authentication?',
        options: [
          'It needs the verified client identity to know whose quota to charge - before authentication it only has an IP address',
          'Rate limiting is slower than authentication, so it goes last',
          'The HTTP standard requires authentication first',
          'So that invalid tokens can use up the quota of a real client',
        ],
        answer: 0,
        explanation:
          'A per-client quota is keyed by who the caller is, and that is only known once the token is verified. Gateways often add a coarse per-IP limit before authentication as well, against floods. Charging whatever the token claims before checking it is the tempting shortcut, and it lets an attacker burn the quota of a real customer with forged tokens.',
      },
      {
        id: 'agw-4',
        prompt:
          'A partner reports that after 10 calls in a minute their integration starts getting errors, and it works again the next minute. Their token is valid. What is the gateway most likely returning?',
        options: [
          '401 Unauthorized, because the token expired',
          '503 Service Unavailable, because a service is down',
          '404 Not Found, because the route changed',
          '429 Too Many Requests, because they used up their quota for the window',
        ],
        answer: 3,
        explanation:
          'Errors that start after a fixed number of calls and clear when the window resets are a rate limit, and 429 (RFC 6585) is the status for it, often with a Retry-After header. 401 is tempting, but an expired token would keep failing in the next minute too. The right client behaviour is to back off and retry after the window, not to retry at once.',
      },
      {
        id: 'agw-5',
        prompt:
          'Your gateway runs as one instance. Every service behind it runs three replicas across zones. The gateway host is restarted for a kernel patch. What do users see?',
        options: [
          'Nothing - the services are redundant, so the system is too',
          'A full outage: every request passes through the gateway, so it has to run as several instances across zones behind a load balancer',
          'Only requests to one service fail',
          'Requests slow down but still succeed',
        ],
        answer: 1,
        explanation:
          'A system is only as available as the weakest part every request passes through. Three replicas of each service do not help when the one door in front of them is closed. That is why the Lab and the Diagram show the gateway as x2: it is on every path, so it needs the same redundancy as anything else that fronts the system.',
      },
      {
        id: 'agw-6',
        prompt:
          'To ship a discount campaign fast, a team adds price and discount rules to the gateway, with calls to two services to compute them. Six months later the gateway has 4,000 lines of business logic. What is the risk?',
        options: [
          'None - the gateway is the fastest place for logic because it runs first',
          'The gateway will reject valid tokens',
          'A bug in one business rule can now take down every route, and every team must coordinate changes in one shared component',
          'Clients will need to know the internal service layout',
        ],
        answer: 2,
        explanation:
          'The gateway is on the path of every request, so its code has the largest blast radius in the system, and shared business rules in it recreate the coupling microservices were meant to remove. Keep it thin: routing, auth, limits and light transformation. Running first is the tempting argument, but speed was never the problem - ownership and blast radius are.',
      },
      {
        id: 'agw-7',
        prompt:
          'The Orders Service trusts the X-User-Id header the gateway adds and does no checks of its own. It is also reachable from any machine on the internal network. What can go wrong?',
        options: [
          'Anything that reaches Orders directly can set X-User-Id to any user and act as them',
          'Nothing - the gateway already checked the token',
          'The gateway will return 429 for internal calls',
          'The header is too large for HTTP',
        ],
        answer: 0,
        explanation:
          'The header is only as trustworthy as the path it came from. A compromised internal host, or a mis-routed request, skips the gateway and sets whatever identity it likes. Services should verify the token themselves (or accept calls only over mTLS from the gateway) and not be reachable around it. "The gateway checked" is the tempting answer and exactly the mistake the Lab warns about.',
      },
      {
        id: 'agw-8',
        prompt:
          'User 42 has a valid token and calls GET /api/orders/999, an order that belongs to user 7. The gateway checks the token and routes the call. Which part must refuse it?',
        options: [
          'The gateway, with 401, because the token is invalid',
          'The client app, by hiding the order in the interface',
          'Nobody - a valid token means the request is allowed',
          'The Orders Service, which knows who owns order 999, with 403 or 404',
        ],
        answer: 3,
        explanation:
          'The token is valid, so authentication passes; the question is authorisation for one specific record, and only the service that owns the data knows who owns order 999. The gateway authenticates, services authorise. 401 is the tempting wrong answer, but nothing is wrong with the token itself. Hiding it in the app protects nothing, because anyone can call the API directly.',
      },
      {
        id: 'agw-9',
        prompt:
          'A mobile home screen makes six calls in a row to six services over a network with 80 ms round trips, about 700 ms before it renders. You add one gateway route, GET /mobile/home, that calls the six services in parallel inside the data centre, where each hop is about 2 ms and the slowest service takes 40 ms. Roughly how long does the screen wait now?',
        options: [
          'About 700 ms - the same services still do the same work',
          'About 120 ms: one 80 ms mobile round trip plus the slowest internal call',
          'About 480 ms: six 80 ms round trips',
          'About 12 ms: six 2 ms hops',
        ],
        answer: 1,
        explanation:
          'Aggregation moves the fan-out from the slow mobile network to the fast internal one. The phone pays one 80 ms round trip, and the parallel internal calls take as long as the slowest one, about 40 ms. 12 ms is the tempting answer, but it forgets the mobile round trip that remains and the service time of the slowest call.',
      },
      {
        id: 'agw-10',
        prompt:
          'The GET /mobile/home aggregation route waits for all six services. Recommendations sometimes take 2 seconds, and then the whole home screen takes 2 seconds. What should the route do?',
        options: [
          'Remove the timeout so recommendations always arrive',
          'Retry recommendations immediately when they are slow',
          'Give each dependency its own timeout, say 50 ms for recommendations, and return the screen without them when they are late',
          'Move the recommendations logic into the gateway',
        ],
        answer: 2,
        explanation:
          'A response that combines several calls is as slow as the slowest one, so each dependency needs its own time budget, and the product decides what the screen shows without it. Immediate retries are the tempting answer, but they add load to a service that is already slow and make the wait longer. Moving the logic into the gateway only moves the slowness.',
      },
      {
        id: 'agw-11',
        prompt:
          'The Orders Service needs to call the Payments Service. A developer routes the call out to the public gateway URL and back in, so it gets the same auth and limits. What is the problem?',
        options: [
          'Service-to-service calls pay an extra hop through a shared component and count against client quotas - they belong on internal routes or a service mesh',
          'None - every call should go through the public gateway',
          'The gateway cannot route to Payments',
          'Payments will reject the call because it came from inside',
        ],
        answer: 0,
        explanation:
          'The gateway handles north-south traffic, from the outside world in. East-west calls between services use internal addresses, often through a service mesh that adds mTLS, retries and tracing. Hair-pinning through the public gateway is tempting because it reuses the rules, but it adds latency, mixes internal load with client quotas, and makes the gateway a dependency of every internal call.',
      },
    ],
  },
];
