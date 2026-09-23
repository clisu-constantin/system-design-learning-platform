import type { Concept } from '@/types';

export const networkingConcepts: Concept[] = [
  {
    slug: 'dns',
    title: 'DNS',
    tagline: 'Turning a hostname into an address - with caching at every layer.',
    category: 'networking',
    difficulty: 'Beginner',
    lab: 'url-journey',
    labFocus: 'dns',
    keywords: ['resolution', 'ttl', 'records', 'anycast', 'resolver', 'cname'],
    what: 'DNS is the distributed directory that maps names such as example.com to IP addresses, using a hierarchy of resolvers, root, TLD and authoritative servers.',
    why: 'It is the first hop of every request. It is also a routing tool: DNS decides which region, CDN edge or load balancer a user talks to before a single byte of your application runs.',
    how: [
      'The browser checks its own cache, then the OS, then the configured recursive resolver.',
      'On a miss the resolver asks, in turn, a root server, the TLD servers (.com) and the authoritative nameserver.',
      'Every answer is cached for its TTL - the record for its own TTL, the .com referral for two days.',
      'Record types matter: A/AAAA for addresses, CNAME for aliases, MX for mail, TXT for verification.',
    ],
    when: ['Always. The design choice is TTL length and whether you use DNS for failover or geo-routing.'],
    advantages: [
      'Caching at every level makes most lookups nearly free.',
      'The same name can return different answers, which makes DNS a coarse routing tool (geo, weighted, failover).',
      'A CNAME lets the address behind a name change without touching your records.',
    ],
    diagram: `browser cache -> OS cache -> recursive resolver
                                 |  on a miss, asks in turn:
                                 +-> root           "ask the .com servers"
                                 +-> .com TLD       "ask ns1.example.com"
                                 +-> authoritative  "A 203.0.113.10, TTL 300"`,
    tradeoffs: [
      {
        approach: 'Short TTL (30-60s)',
        gains: ['Fast failover and traffic shifts', 'Useful for blue/green cutovers'],
        costs: ['More resolver traffic, and more users pay a full lookup', 'Some clients and resolvers hold answers longer than the TTL anyway'],
      },
      {
        approach: 'Long TTL (hours)',
        gains: ['Fewer lookups, slightly faster first byte', 'Resilient to short outages of your nameservers'],
        costs: ['Changing where traffic goes takes hours', 'Bad for incident response'],
      },
      {
        approach: 'DNS failover instead of a load balancer or anycast',
        gains: ['Works across regions and providers with no extra hop', 'Nothing new to run - the DNS provider does the health checks'],
        costs: ['Takes at least one TTL, often longer, to move clients', 'Cannot move a connection that is already open'],
      },
    ],
    mistakes: [
      'Relying on DNS as the only failover mechanism - clients and resolvers cache beyond the TTL.',
      'Forgetting that a DNS lookup is a real latency cost on a cold connection.',
      'Lowering the TTL only at the moment of a migration - caches still hold the old, long one.',
      'Hardcoding the IP of a managed service instead of pointing a CNAME at its name.',
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
          'DNS does not push changes. Caches hold the previous answer for up to the TTL, which is why cutovers use short TTLs set well in advance. "Did not propagate" is the tempting answer, but nothing propagates - the record changed at once, and caches are simply waiting out the TTL.',
      },
      {
        id: 'dns-2',
        prompt:
          'You will move your API to a new provider next Tuesday. The A record has a TTL of 86400 (one day). What do you do with the TTL?',
        options: [
          'Nothing - lower it on Tuesday, right before the switch',
          'Raise it, so the new address is cached longer',
          'Delete the record for a minute during the switch',
          'Lower it to 60 s at least a day before Tuesday, switch, wait for traffic on the old address to reach zero, then raise it again',
        ],
        answer: 3,
        explanation:
          'Caches keep an answer for the TTL they received with it. Lowering it on Tuesday does nothing for the caches that picked up the one-day TTL on Monday - they keep the old address for up to a day. Lower it at least one old TTL in advance, so every cache holds the short one by the time you switch.',
      },
      {
        id: 'dns-3',
        prompt:
          'In the Lab, the resolver last looked up example.com 10 minutes ago and the record TTL is 5 minutes. Which servers does the resolver ask this time?',
        options: [
          'The .com TLD server and the authoritative server - its copy expired, but it still knows the .com servers',
          'None - it answers from its cache',
          'Only the root server',
          'Root, .com TLD and authoritative, every time',
        ],
        answer: 0,
        explanation:
          'The answer expired after 5 minutes, so the resolver must ask again. The referral to the .com servers has its own TTL of two days, so it is still cached and the root is skipped. That is why "every time" is wrong: a busy resolver almost never asks a root server.',
      },
      {
        id: 'dns-4',
        prompt:
          'Same setup, but now the TTL is 1 hour. You change the A record right now. When do users of this resolver get the new address?',
        options: [
          'Immediately, because you changed the record',
          'After the resolver restarts',
          'In up to 50 minutes - it cached the old answer 10 minutes ago and may reuse it for the rest of the hour',
          'Never, until they clear their browser cache',
        ],
        answer: 2,
        explanation:
          'The resolver may reuse an answer until its TTL runs out: 60 minutes minus the 10 already passed. The Lab shows the same number as the time left on the resolver cache. "Immediately" is the tempting answer, but the authoritative server is not even asked until then.',
      },
      {
        id: 'dns-5',
        prompt:
          'A resolver has just restarted with an empty cache. A user asks it for www.example.com. Which servers does it ask, in order?',
        options: [
          'Only the authoritative server of example.com',
          'A root server, then the .com TLD servers, then the authoritative nameserver of example.com',
          'The .com TLD server, which asks the root for it',
          'The web server at www.example.com',
        ],
        answer: 1,
        explanation:
          'With nothing cached the resolver walks the hierarchy itself: the root refers it to .com, .com refers it to the nameservers of example.com, and those answer. It could not go straight to the authoritative server because it does not yet know where that is. The servers never forward the question for it - each one only refers the resolver onward.',
      },
      {
        id: 'dns-6',
        prompt:
          'app.example.com must point at a cloud load balancer. The provider gives you a hostname and warns that its IP addresses change. Which record do you create?',
        options: [
          'An A record with the IP the load balancer has today',
          'A TXT record with the hostname',
          'A CNAME from app.example.com to the load balancer hostname',
          'An MX record',
        ],
        answer: 2,
        explanation:
          'A CNAME points at a name, so the provider can change the addresses behind it without your records going stale. An A record with the current IP works until the day the provider moves the load balancer - a bug that fires months later. TXT and MX do not route web traffic at all.',
      },
      {
        id: 'dns-7',
        prompt:
          'You want the bare domain example.com to point at your CDN hostname, like www does. Your DNS provider refuses a CNAME on example.com. Why, and what do you use?',
        options: [
          'A CNAME cannot sit at the zone apex, next to the SOA and NS records; use the ALIAS or ANAME record (or CNAME flattening) of your provider',
          'The CDN does not allow bare domains; use a subdomain only',
          'CNAMEs are deprecated; use an A record for the CDN IP',
          'The TTL is too long; lower it and try again',
        ],
        answer: 0,
        explanation:
          'A CNAME may not share its name with any other record, and the apex always holds SOA and NS records. Providers solved this with ALIAS-style records that resolve the target name themselves and return plain A records. Hardcoding a CDN IP in an A record is the tempting fix, but CDN addresses change.',
      },
      {
        id: 'dns-8',
        prompt:
          'You use DNS failover with health checks and a TTL of 300 s. A region dies. How long until clients stop trying the dead address?',
        options: [
          'Under a second - DNS failover is instant',
          'Exactly 300 s for every client',
          'It depends on the load balancer, not on DNS',
          'Up to about 5 minutes for most clients, longer for some that hold answers beyond the TTL - it is a minutes-scale mechanism',
        ],
        answer: 3,
        explanation:
          'Clients holding the old answer keep using it until the TTL runs out, and some resolvers and client libraries hold it longer. For failover in seconds you need a load balancer or an anycast address in front. "Exactly 300 s" is tempting, but caches picked the answer up at different times, and not all honour the TTL.',
      },
      {
        id: 'dns-9',
        prompt: 'A popular site sets a 30-second TTL on its main record "to be safe". What does it pay for that?',
        options: [
          'Nothing - TTL only matters during migrations',
          'Far more queries to its authoritative servers, and more users paying a full lookup before their first byte',
          'Its certificate must be renewed more often',
          'Browsers refuse records with a TTL under 60 s',
        ],
        answer: 1,
        explanation:
          'Every cache has to ask again every 30 seconds, so the authoritative servers see many more queries and more requests start with a cache miss. That buys fast traffic changes. The trade-off is real, which is why TTLs are usually lowered only around planned changes - "nothing" is the tempting but wrong answer.',
      },
      {
        id: 'dns-10',
        prompt:
          'A user clicks a second link on the same site two seconds after the first page loaded. In the Lab terms, which DNS stages happen?',
        options: [
          'All four, because every request needs a lookup',
          'Only the root server',
          'None - the browser reuses the open connection to that host, so it needs no address at all',
          'Only the authoritative server',
        ],
        answer: 2,
        explanation:
          'Turn Warm connection on in the Lab: all DNS stages are skipped, together with TCP and TLS. The browser already has a connection to that host, and even for a new one the address would still be in its cache. A lookup happens per new host, not per request.',
      },
      {
        id: 'dns-11',
        prompt:
          'Users in Europe get the address of your EU region and users in the US get the US region, from the same name. How does DNS do that?',
        options: [
          'The authoritative server returns a different answer depending on where the query comes from (geo-routing)',
          'The browser picks the nearest address from a list it downloads',
          'The root servers route by country',
          'It cannot - this needs a load balancer in each country',
        ],
        answer: 0,
        explanation:
          'The authoritative server sees which resolver asked (and sometimes a hint about the client subnet) and answers with the region closest to it. It is a coarse routing tool with the same caching limits as any other answer. Root servers only refer resolvers to TLD servers; they know nothing about your regions.',
      },
    ],
  },
  {
    slug: 'http-https',
    title: 'HTTP / HTTPS',
    tagline: 'The request/response protocol everything else is built on.',
    category: 'networking',
    difficulty: 'Beginner',
    lab: 'url-journey',
    labFocus: 'http-https',
    keywords: ['http2', 'http3', 'tls', 'headers', 'status codes', 'cache-control', 'etag'],
    what: 'HTTP is a stateless request/response protocol: a method, a path, headers and an optional body in, a status code, headers and a body out. HTTPS is HTTP carried inside a TLS-encrypted connection.',
    why: 'Its semantics shape your API: which methods are safe to retry, what can be cached, and how intermediaries (proxies, CDNs) may treat your traffic.',
    how: [
      'Methods carry meaning: GET is safe and cacheable, PUT and DELETE are idempotent, POST is neither.',
      'Status codes drive client behaviour: 429 and 503 mean retry later, 4xx generally means do not retry.',
      'Cache-Control and ETag headers let browsers and CDNs avoid round trips entirely.',
      'HTTP/2 multiplexes many requests over one connection; HTTP/3 moves to QUIC over UDP to remove TCP head-of-line blocking.',
      'HTTPS wraps all of it in TLS: encrypted, protected from changes, and sent to a server that proved its name with a certificate.',
    ],
    when: ['Any public API or web frontend - over HTTPS.', 'Plain HTTP only for a redirect to HTTPS, or inside a network you fully trust.'],
    advantages: [
      'Every proxy, CDN, browser and library already understands it.',
      'Methods and status codes carry meaning that caches and clients act on without custom code.',
      'Cache headers let intermediaries answer repeat requests with no work at your origin.',
    ],
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
      'Marking a per-user response public, so a shared cache serves one user the page of another.',
    ],
    related: ['rest-apis', 'cdn', 'idempotency', 'tls-https', 'what-happens-when-you-type-a-url'],
    quiz: [
      {
        id: 'http-1',
        prompt:
          'A proxy retried POST /charge after a timeout, and a customer was charged twice. What went wrong, and what fixes it?',
        options: [
          'The proxy is broken - proxies must never retry anything',
          'The server should have returned 200 faster',
          'POST is neither safe nor idempotent, so a retry repeats the charge; send an idempotency key so the server can recognise the second attempt',
          'The request should have been a GET',
        ],
        answer: 2,
        explanation:
          'Doing a POST twice can do the work twice. An idempotency key lets the server store the first result and return it for the retry. Changing it to GET is the tempting shortcut, but GET must have no side effects - caches and prefetchers would then charge customers too.',
      },
      {
        id: 'http-2',
        prompt:
          'Your API answers a missing product with status 200 and the body {"error": "not found"}. What breaks?',
        options: [
          'Monitoring counts it as a success, clients must parse every body to spot errors, and a CDN may cache the error as a good response',
          'Nothing - the body is clear enough',
          'The browser refuses to show a 200 with an error body',
          'The TLS handshake fails',
        ],
        answer: 0,
        explanation:
          'Status codes are the contract every intermediary reads; bodies are not. Return 404 and dashboards, retries and caches all behave correctly. "The body is clear enough" is tempting, but only for a human reading it - no proxy or alert reads the body.',
      },
      {
        id: 'http-3',
        prompt:
          'A client gets 503 with a Retry-After header from one call, and 400 Bad Request from another. What should it do with each?',
        options: [
          'Retry both right away',
          'Retry neither',
          'Retry the 400 with backoff; give up on the 503',
          'Retry the 503 after the time it was given; do not retry the 400 - fix the request instead',
        ],
        answer: 3,
        explanation:
          '5xx means the server could not handle it right now, and 503 with Retry-After says when to try again. 4xx means the request itself is wrong, and sending it again gets the same answer. Retrying both at once is how a struggling service gets buried under retries.',
      },
      {
        id: 'http-4',
        prompt:
          'In the Lab, HTTPS is off and the request carries a login form. The user is on cafe Wi-Fi. What can someone on that network do?',
        options: [
          'Nothing - the password is in the body, not the URL',
          'Read the password and the cookies, and change the page on its way back - for example inject a script',
          'Only see which site the user visits',
          'Only slow the request down',
        ],
        answer: 1,
        explanation:
          'Plain HTTP is readable and changeable on every hop - the triangles on the wire in the Lab. The body is just more bytes on the same wire. HTTPS gives three things: encryption, protection against changes, and a certificate proving the server name. "Only which site" is what HTTPS still leaks, not what plain HTTP leaks.',
      },
      {
        id: 'http-5',
        prompt:
          'A response came with Cache-Control: max-age=300 and ETag "a91f". Six minutes later the browser needs it again, and it has not changed. What happens?',
        options: [
          'The browser uses the cached copy without asking',
          'The server sends the whole body again',
          'The browser asks with If-None-Match: "a91f" and the server answers 304 Not Modified with no body',
          'The browser shows an error, because the entry expired',
        ],
        answer: 2,
        explanation:
          'After 300 s the copy is stale, so the browser revalidates instead of trusting it. The ETag lets the server say "unchanged" in a tiny 304, and the cached body is reused. Using the copy without asking is what happens within the 300 s, not after.',
      },
      {
        id: 'http-6',
        prompt:
          'The /account page shows the name and orders of the logged-in user. Someone sets Cache-Control: public, max-age=3600 on it to reduce load. What happens behind a CDN?',
        options: [
          'The CDN may cache the page of the first user and serve it to other users for an hour',
          'Load drops and nothing else changes',
          'The browser ignores the header for logged-in pages',
          'The CDN refuses to cache HTTPS responses',
        ],
        answer: 0,
        explanation:
          '"public" allows shared caches to store it, and nothing in the URL tells users apart. Per-user responses need Cache-Control: private (browser only) or no-store. A CDN can cache HTTPS responses - it ends the TLS connection itself, as the Lab shows - so HTTPS does not protect you here.',
      },
      {
        id: 'http-7',
        prompt:
          'You serve index.html and app.js with max-age=31536000 (one year). You deploy a fix. What do returning users see, and what is the right setup?',
        options: [
          'The fix, because browsers check for updates on every deploy',
          'The fix after they restart the browser',
          'An error page',
          'The old version for up to a year; give hashed file names like app.4f2a1c.js a long max-age, and give index.html no-cache so it is revalidated every time',
        ],
        answer: 3,
        explanation:
          'A fresh cached entry is used without asking the server, so nobody sees the new files. Hashed names change whenever the content does, so they can be cached forever; the HTML that points at them must be revalidated, which usually costs a cheap 304. Browsers do not learn about deploys by themselves.',
      },
      {
        id: 'http-8',
        prompt:
          'A page loads 80 small files over HTTP/1.1, and the team spread them over four subdomains to get more parallel connections. You move to HTTP/2. What now?',
        options: [
          'Keep the subdomains - more connections are always faster',
          'Serve everything from one origin: HTTP/2 multiplexes all 80 requests over one connection, and each extra subdomain costs its own DNS lookup and handshakes',
          'Merge all files into one, since HTTP/2 allows only one request',
          'Nothing changes between versions',
        ],
        answer: 1,
        explanation:
          'Subdomain sharding was a workaround for HTTP/1.1 sending one request at a time per connection. HTTP/2 sends many at once on one connection, so the workaround now just adds DNS lookups and TCP and TLS handshakes. More connections are not free - each one pays setup again.',
      },
      {
        id: 'http-9',
        prompt:
          'Mobile users on a lossy network complain that a whole HTTP/2 page stalls when a few packets are lost. What does HTTP/3 change?',
        options: [
          'Nothing - loss hurts every protocol the same way',
          'It resends lost packets faster over TCP',
          'It runs over QUIC on UDP with separate delivery order per stream, so a lost packet stalls only its own stream, not every request on the connection',
          'It turns off encryption to save time',
        ],
        answer: 2,
        explanation:
          'HTTP/2 multiplexes over one TCP connection, and TCP delivers bytes strictly in order, so one lost packet holds back every stream. QUIC keeps the order per stream. It does not remove loss, and it is always encrypted - it builds TLS 1.3 in.',
      },
      {
        id: 'http-10',
        prompt:
          'A teammate refuses HTTPS because "it adds latency". The origin is 80 ms away and supports TLS 1.3. What does HTTPS actually cost, and how do you shrink it?',
        options: [
          'One extra round trip (about 80 ms) on each new connection only; connection reuse removes it for later requests, and a CDN edge nearby makes it a few milliseconds',
          'It doubles the time of every request',
          'About one second per page, because of the encryption',
          'Nothing at all, ever',
        ],
        answer: 0,
        explanation:
          'In the Lab, turn HTTPS on: one TLS stage appears, one round trip to whatever ends the connection. With Warm connection on it disappears, and with the CDN on it costs the 10 ms edge round trip. The data itself is encrypted with fast symmetric keys, so "every request doubles" is wrong - the cost is the handshake, once per connection.',
      },
      {
        id: 'http-11',
        prompt:
          'You browse https://example.com/orders/123?token=abc on an office network. Without installing anything on your laptop, what can the network admin see?',
        options: [
          'Everything, including the path and the token',
          'Nothing at all',
          'The path /orders/123, but not the token',
          'That you connected to example.com and how much data moved - but not the path, the query string, the headers or the body',
        ],
        answer: 3,
        explanation:
          'The IP address, the DNS lookup and the hostname in the TLS handshake (SNI) are visible; everything inside the HTTP request is encrypted, including the path and the query string. "Nothing" is wrong because that metadata still leaks, which the Lesson lists under what HTTPS does not give you.',
      },
    ],
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
