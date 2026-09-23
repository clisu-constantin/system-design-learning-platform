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
          'The change is still propagating outward from the authoritative server to every resolver',
          'Resolvers and clients cache the old answer until the TTL expires',
          'DNS requires a restart of the authoritative server',
          'The new load balancer is failing its health checks',
        ],
        answer: 1,
        explanation:
          'DNS does not push changes. Caches hold the previous answer for up to the TTL, which is why cutovers use short TTLs set well in advance. "Still propagating" is the tempting answer, but nothing propagates - the record changed at once, and caches are simply waiting out the TTL.',
      },
      {
        id: 'dns-2',
        prompt:
          'You will move your API to a new provider next Tuesday. The A record has a TTL of 86400 (one day). What do you do with the TTL?',
        options: [
          'Leave it for now, then lower it to 60 s on Tuesday right before you make the switch',
          'Raise it to a week, so resolvers hold the new address longer once it is live',
          'Delete the record for a minute during the switch, so caches drop the old address',
          'Lower it to 60 s a day or more ahead, switch, then raise it once the old address is idle',
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
          'The .com TLD server and the authoritative server',
          'None - an expired answer is still served until the authoritative server pushes a new one',
          'Only the root server, to find out again where .com lives',
          'Root, .com TLD and authoritative, since a lookup always starts at the root',
        ],
        answer: 0,
        explanation:
          'The answer expired after 5 minutes, so the resolver must ask again. The referral to the .com servers has its own TTL of two days, so it is still cached and the root is skipped. That is why "always starts at the root" is wrong: a busy resolver almost never asks a root server.',
      },
      {
        id: 'dns-4',
        prompt:
          'Same setup, but now the TTL is 1 hour. You change the A record right now. When do users of this resolver get the new address?',
        options: [
          'Immediately - the authoritative server notifies every resolver that cached the record',
          'After the resolver restarts and its whole cache is emptied',
          'In up to 50 minutes, when its cached answer runs out',
          'Never, until each user clears the DNS cache in their browser',
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
          'A root server, then the .com TLD servers, then the example.com nameservers',
          'The root server only, which forwards the question down to .com and relays the answer back',
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
          'A TXT record with the load balancer hostname',
          'A CNAME from app.example.com to the load balancer hostname',
          'An MX record pointing at that hostname',
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
          'A CNAME cannot sit at the apex beside SOA and NS records; use an ALIAS or ANAME record',
          'CDNs refuse bare domains because they cannot issue certificates for them; use www with a redirect',
          'CNAMEs are deprecated for new zones; create an A record with one of the CDN edge IPs instead',
          'The TTL on the apex is too long for a CNAME; lower it to 300 s and add it again',
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
          'Under a second - health checks pull the dead address the moment the region fails',
          'Exactly 300 s for every client, since all their caches expire together',
          'None of it is DNS - the load balancer in the dead region redirects clients to the healthy one',
          'Up to about 5 minutes for most, longer for clients that hold answers past the TTL',
        ],
        answer: 3,
        explanation:
          'Clients holding the old answer keep using it until the TTL runs out, and some resolvers and client libraries hold it longer. For failover in seconds you need a load balancer or an anycast address in front. "Exactly 300 s" is tempting, but caches picked the answer up at different times, and not all honour the TTL.',
      },
      {
        id: 'dns-9',
        prompt: 'A popular site sets a 30-second TTL on its main record "to be safe". What does it pay for that?',
        options: [
          'Nothing - resolvers cache for at least 5 minutes whatever TTL the record carries',
          'Many more queries to its nameservers, and more users waiting on a full lookup',
          'Its TLS certificate must be renewed more often',
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
          'All four, because the browser resolves the name again for every request it sends',
          'Only the root server, to find the .com servers again',
          'None - it reuses the open connection to that host',
          'Only the authoritative server, to check the record has not changed since the first page',
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
          'The authoritative server answers based on where the query comes from',
          'The browser gets both addresses, pings each one and connects to the faster',
          'The root servers route each query by country',
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
          'Proxies must never retry; turn retries off in the proxy and let the customer click again',
          'The server should have returned 200 faster',
          'POST is not idempotent, so the retry charged again; add an idempotency key',
          'Make it a GET, which HTTP defines as safe to retry, so the retry does no harm',
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
          'Monitoring counts it as success, and a CDN may cache it as a good page',
          'Nothing - clients read the error field, and the body is clear enough for anyone debugging',
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
          'Retry both at once, since a second attempt costs little and often succeeds',
          'Retry neither',
          'Retry the 400 with backoff; give up on the 503',
          'Retry the 503 after Retry-After; fix the 400 instead of retrying it',
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
          'Nothing - the password is in the POST body, and only the URL is visible on the network',
          'Read the password and cookies, and inject a script into the page',
          'Only see which site the user visits, the same as with HTTPS',
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
          'The browser uses the cached copy, because the ETag shows it has not changed',
          'The server sends the full body again, since max-age has run out',
          'It revalidates with If-None-Match and gets a 304 with no body',
          'The browser shows an error, because the cached entry has expired',
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
          'Load drops, and each user still gets their own copy because the request carries their cookie',
          'The browser ignores the header for logged-in pages',
          'Nothing is cached - the CDN cannot read HTTPS responses, so it passes them through',
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
          'The fix after their next browser restart, which clears the memory cache',
          'An error page',
          'Old files for up to a year; hash the asset names and serve index.html with no-cache',
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
          'Keep the four subdomains, since four multiplexed connections carry four times the requests',
          'Serve from one origin: HTTP/2 multiplexes all 80 over one connection',
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
          'It keeps TCP but tunes its retransmit timer, so lost packets are resent in a few ms',
          'It runs over QUIC, where a lost packet stalls only its own stream',
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
          'One extra round trip, about 80 ms, per new connection; reuse and a nearby edge shrink it',
          'It doubles every request, because each request and response is encrypted with RSA',
          'About one second per page, because the certificate chain is verified on every request',
          'Nothing at all, ever',
        ],
        answer: 0,
        explanation:
          'In the Lab, turn HTTPS on: one TLS stage appears, one round trip to whatever ends the connection. With Warm connection on it disappears, and with the CDN on it costs the 10 ms edge round trip. The data itself is encrypted with fast symmetric keys, so "it doubles every request" is wrong - the cost is the handshake, once per connection.',
      },
      {
        id: 'http-11',
        prompt:
          'You browse https://example.com/orders/123?token=abc on an office network. Without installing anything on your laptop, what can the network admin see?',
        options: [
          'Everything, including the path and token, because the query string is sent before TLS starts',
          'Nothing at all',
          'The path /orders/123 from the request line, but not the token, which is encrypted',
          'The hostname example.com and how much data moved, not the path, token or body',
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
    lab: 'transport',
    keywords: ['transport', 'handshake', 'packet loss', 'head-of-line blocking', 'retransmission', 'quic'],
    what: 'TCP gives the app an ordered, reliable byte stream: it sets up a connection with a handshake, numbers and acknowledges every byte, resends what is lost and slows down when the network is congested. UDP sends independent datagrams with none of those guarantees.',
    why: 'Reliability is not free: the handshake, the resends and the in-order rule all cost time. Some workloads would rather lose a packet than get it late.',
    how: [
      'TCP: a three-way handshake (SYN, SYN-ACK, ACK) costs one round trip before the first byte of data.',
      'TCP numbers every byte. The receiver ACKs what arrived; a lost packet is resent after 3 duplicate ACKs or a timeout, so it arrives at least one round trip late.',
      'TCP hands bytes to the app strictly in order, so everything behind a lost packet waits for its resend: head-of-line blocking.',
      'UDP: no handshake, no ACKs, no resends and no ordering. Each datagram arrives whole, late, out of order or not at all, and the app decides what to do.',
      'QUIC (the transport under HTTP/3) runs over UDP and builds its own reliability per stream, so one lost packet stalls only its own stream.',
    ],
    when: [
      'TCP: APIs, databases, file transfer, messaging - anything where every byte must arrive and a little extra latency is fine.',
      'UDP: live voice and video, game state, metrics samples and small DNS queries - anything where late data is worthless or the next update replaces the lost one.',
      'UDP as a base for your own protocol, as QUIC does, when you want reliability without the single ordered stream of TCP.',
    ],
    advantages: [
      'TCP: the app never sees a missing, duplicated or reordered byte, and congestion control protects the network.',
      'UDP: no setup round trip, and a lost datagram never holds up the ones behind it.',
    ],
    diagram: `TCP                           UDP
SYN ->                        data ->
   <- SYN-ACK                 data ->
ACK + data ->                 data ->  (lost: nobody resends)
   <- ACK                     data ->
lost data resent, 1 RTT late  the rest keep arriving
ordered, complete, later      unordered, lossy, on time`,
    tradeoffs: [
      {
        approach: 'TCP',
        gains: ['No lost, duplicated or reordered data reaches the app', 'Congestion control protects the network without app code'],
        costs: [
          'One round trip of handshake before any data',
          'Head-of-line blocking: one lost packet delays everything behind it by at least a round trip',
        ],
      },
      {
        approach: 'UDP',
        gains: ['No handshake: the first datagram carries data', 'Loss of one datagram does not stall the rest'],
        costs: [
          'The app must handle loss, ordering and congestion itself',
          'Some networks block or quickly time out UDP, so a TCP fallback is often needed',
        ],
      },
      {
        approach: 'QUIC (reliability built on UDP)',
        gains: [
          'Reliable, ordered streams where one lost packet stalls only its own stream',
          'Transport and TLS 1.3 set up together in one round trip',
        ],
        costs: [
          'Runs in user space, so it costs more CPU per byte than kernel TCP today',
          'Still needs a TCP fallback where UDP is blocked',
        ],
      },
    ],
    mistakes: [
      'Sending live voice or game state over TCP, so each lost packet turns into a stutter while everything behind it waits.',
      'Moving a file transfer to UDP for speed, then finding files with holes - and rebuilding ACKs, resends and ordering badly in the app.',
      'Opening a new TCP connection per request instead of reusing one, paying the handshake every time and piling up sockets in TIME_WAIT.',
      'Sending UDP datagrams bigger than the path MTU (about 1,500 bytes), so they fragment and one lost fragment loses the whole datagram.',
    ],
    related: ['http-https', 'websockets', 'dns', 'connection-pooling'],
    quiz: [
      {
        id: 'tcpudp-1',
        prompt:
          'Your video call app sends audio over TCP. On hotel Wi-Fi with about 3% packet loss, users hear short stutters several times a minute, yet no audio is ever missing. What is going on?',
        options: [
          'The audio codec is too slow for the phone CPU',
          'Each lost packet is resent a round trip later, and the audio behind it waits in order',
          'UDP would lose those same frames, so switching transport would only trade stutter for gaps of silence',
          'TCP has no congestion control, so the Wi-Fi gets overloaded',
        ],
        answer: 1,
        explanation:
          'TCP never loses the audio, but the resend comes at least a round trip later and TCP will not hand over the frames behind it until the gap is filled. In the Lab, a Voice call on TCP shows one drop turning into several "Too late to play" frames. UDP would not stutter the same way: it loses one 20 ms frame, which the codec can hide, and plays everything after it on time.',
      },
      {
        id: 'tcpudp-2',
        prompt:
          'To make firmware downloads faster, a team sends the 1,000-packet image over plain UDP. The network loses 1% of packets. What happens?',
        options: [
          'Every download arrives complete, just a little slower',
          'Every download arrives complete and about 1% faster',
          'Almost every download misses packets, so the device must add ACKs and resends',
          'UDP resends each lost datagram up to three times',
        ],
        answer: 2,
        explanation:
          'The chance that all 1,000 packets survive 1% loss is 0.99 to the power 1,000, about 0.004%. UDP never resends, so nearly every image has holes, and a firmware image with a hole is useless. The Lab shows the same with File over UDP: most files finish with packets missing. "UDP resends three times" is the tempting wrong answer - resending is exactly what UDP does not do.',
      },
      {
        id: 'tcpudp-3',
        prompt:
          'Your service opens a new TCP connection for every call to a dependency 40 ms away (one way), with no TLS. How long before the request bytes can even leave?',
        options: [
          'One round trip, 80 ms, for the three-way handshake',
          'Nothing: TCP sends the request with the first packet',
          'Three round trips, 240 ms, one for each handshake packet',
          '40 ms, half a round trip',
        ],
        answer: 0,
        explanation:
          'SYN goes out, SYN-ACK comes back - one round trip, 80 ms - and the client sends its request along with the final ACK. Three packets is not three round trips: the third one already carries data. The Lab shows this as "Handshake: 1 round trip" on the TCP client. Reusing connections (keep-alive, pooling) pays it once instead of on every call.',
      },
      {
        id: 'tcpudp-4',
        prompt:
          'A TCP receiver already holds packets #11 to #15 in its buffer. Packet #10 was lost and has not been resent yet. The app calls read(). What does it get?',
        options: [
          'Packets #11 to #15 right away; #10 is handed over on a later read() once it is resent',
          'An error saying #10 is missing',
          'Packets #11 to #15 with a gap marker where #10 should be',
          'Nothing until the resend of #10 arrives; then #10 to #15 together, in order',
        ],
        answer: 3,
        explanation:
          'TCP promises an in-order byte stream, so it cannot hand over #11 before #10. The TCP receivers in the Lab (Voice player, TCP and File saver, TCP) show this as "Held back" and "Waiting for #10": head-of-line blocking. Handing over #11 to #15 first is what UDP does - there each datagram goes to the app the moment it arrives.',
      },
      {
        id: 'tcpudp-5',
        prompt:
          'A multiplayer game sends each player position 30 times a second over UDP. One position update is lost. What should the game do?',
        options: [
          'Resend it until the server acknowledges it, so no player ever sees a wrong position',
          'Ignore it: the next update replaces it about 33 ms later',
          'Switch the connection to TCP until the packet loss stops',
          'Pause the game for everyone until the lost update arrives',
        ],
        answer: 1,
        explanation:
          'A position is only useful while it is fresh, and the next one supersedes it in 33 ms. Resending the old one wastes bandwidth and delivers a stale position late. Switching to TCP would make it worse: every later update would wait behind the lost one.',
      },
      {
        id: 'tcpudp-6',
        prompt:
          'A DNS answer for a domain with many records is too large for the UDP response the resolver accepts. What happens?',
        options: [
          'The answer is cut to fit, and the resolver uses the records it got, which is enough to connect',
          'The query fails and the name cannot be resolved',
          'The resolver switches to QUIC',
          'The server sets the truncated (TC) flag and the resolver asks again over TCP',
        ],
        answer: 3,
        explanation:
          'DNS uses UDP for small, fast queries and falls back to TCP when the answer does not fit: the server marks the reply truncated and the resolver retries over TCP (RFC 7766 requires DNS servers to support TCP). Using a cut answer would be wrong - the TC flag exists so the resolver knows it is incomplete.',
      },
      {
        id: 'tcpudp-7',
        prompt:
          'A page loads 20 images over one HTTP/2 connection, which runs over TCP. One packet carrying part of image 3 is lost. What happens to the other 19 images?',
        options: [
          'They stall too until the resend, since TCP knows nothing of the HTTP/2 streams',
          'Only image 3 waits, because HTTP/2 gives each image its own stream with its own ordering',
          'The other images are resent as well',
          'The connection resets and all 20 images start again',
        ],
        answer: 0,
        explanation:
          'HTTP/2 multiplexes streams, but TCP underneath sees only bytes in order, so a gap stalls every stream whose bytes come after it. "Only image 3 waits" is what HTTP/3 over QUIC gives you: QUIC orders bytes per stream, so a loss stalls only its own stream.',
      },
      {
        id: 'tcpudp-8',
        prompt:
          'In the Lab you set Packet loss to 0% and raise Jitter to 100 ms, with the voice call over UDP and its 60 ms playout buffer. What do you see?',
        options: [
          'Nothing changes, because with 0% loss every frame arrives',
          'UDP starts resending the late frames',
          'Some frames arrive after their playout time and count as too late, with none dropped',
          'Every frame is lost',
        ],
        answer: 2,
        explanation:
          'Jitter delays some packets more than others, so later ones overtake earlier ones, and any frame delayed more than the 60 ms buffer misses its turn to play. Loss is not the only enemy of real-time audio - lateness is. UDP never resends, so the "resending" option cannot happen.',
      },
      {
        id: 'tcpudp-9',
        prompt:
          'Voice over TCP, 2% packet loss. You raise the one-way delay from 20 ms to 100 ms. What happens to the damage each lost packet does?',
        options: [
          'Nothing: the loss rate is the same, so the damage is the same',
          'It gets worse: the resend takes longer, so more frames miss their playout time',
          'It gets better: a longer delay stretches the playout buffer, giving the resend time to land',
          'TCP stops resending once the delay is above 100 ms',
        ],
        answer: 1,
        explanation:
          'A resend costs at least a round trip. In the Lab at 20 ms one way, a lost frame comes back about 40 ms past its playout time and makes 2 frames late; at 100 ms it comes back about 200 ms late and makes about 10 frames late. Same loss rate, five times the stutter. The playout buffer is fixed at 60 ms after the normal arrival, so it does not grow with the delay.',
      },
      {
        id: 'tcpudp-10',
        prompt: 'A colleague asks why HTTP/3 runs over UDP, when web pages must arrive complete. What is the best answer?',
        options: [
          'Web pages do not need reliability, so UDP is enough',
          'UDP has no handshake and no ACKs, so pages load faster even if a few packets go missing',
          'Firewalls prefer UDP over TCP',
          'QUIC builds its own per-stream reliability on UDP, in user space',
        ],
        answer: 3,
        explanation:
          'HTTP/3 is fully reliable - QUIC adds numbering, ACKs and resends on top of UDP. It uses UDP because it wants to own that logic: per-stream ordering avoids head-of-line blocking across streams, and user-space code can change without waiting for every OS kernel. Firewalls do not prefer UDP; many block it, which is why browsers keep a TCP fallback.',
      },
      {
        id: 'tcpudp-11',
        prompt:
          'Your new UDP-based video protocol works in every test, but some users on corporate networks cannot connect at all. What is the most likely cause and fix?',
        options: [
          'Their networks block or time out UDP; add a TCP fallback, as QUIC does',
          'Their datagrams are too small for the corporate MTU; pack more frames into each one',
          'Their TCP handshake fails; add a second handshake',
          'Their machines cannot decode UDP; ship a new codec',
        ],
        answer: 0,
        explanation:
          'Many firewalls and middleboxes block UDP or drop its state after a short idle time, because most business traffic is TCP. The standard answer is a TCP fallback. Making datagrams larger makes things worse: above the path MTU they fragment.',
      },
      {
        id: 'tcpudp-12',
        prompt:
          'A service sends 8 KB UDP datagrams over a network with 1,500-byte packets and 1% packet loss. Far more than 1% of the datagrams go missing. Why?',
        options: [
          'UDP drops large datagrams on purpose',
          'The receiver socket rejects any datagram over 1,500 bytes, so the big ones are dropped',
          'Each is split into about 6 fragments, and losing any one loses it all',
          'Large datagrams trigger TCP congestion control',
        ],
        answer: 2,
        explanation:
          'An 8 KB datagram does not fit one 1,500-byte packet, so IP fragments it into about 6 pieces. If any piece is lost, the whole datagram is discarded: 1 - 0.99 to the power 6 is about 6%. That is why UDP protocols keep datagrams under about 1,400 bytes. The receiver does accept large datagrams - the problem is that they arrive in pieces.',
      },
      {
        id: 'tcpudp-13',
        prompt:
          'A service opens and closes thousands of short TCP connections per second to one backend. CPU and memory are fine, but new connections start failing. What is the likely cause?',
        options: [
          'The backend is out of CPU',
          'Closed connections sit in TIME_WAIT for 60 s and use up the local ports',
          'TCP allows each host at most 1,000 open connections to one remote port, and the service hits it',
          'The handshake packets are lost more often at high rates',
        ],
        answer: 1,
        explanation:
          'The side that closes a TCP connection keeps it in TIME_WAIT for twice the maximum segment lifetime, 60 seconds on Linux, to catch stray packets. Thousands of connections per second times 60 seconds can use up the roughly 28,000 ephemeral ports Linux uses by default. Keep-alive and connection pooling fix it. There is no fixed 1,000-connection limit in TCP.',
      },
    ],
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
          'The proxy is now the TCP peer; have it send X-Forwarded-For and trust that only from it',
          'Rate limiting cannot work behind a proxy; remove the limiter',
          'Make the app read the client address from the TCP connection, which a client cannot forge like a header',
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
          'Nothing - nginx replaces X-Forwarded-For with the real peer address, so the fake values are dropped',
          'The requests fail, because a header with an unknown address is rejected',
          'Each request looks like a new client; trust only the entry your proxy appended',
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
          'Only compression; caching and path routing still work, because the proxy reads the URL from SNI',
          'Load balancing; a passthrough proxy can only send traffic to one server',
          'Caching, path routing and X-Forwarded-For - it sees only encrypted bytes',
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
          'Proxy response buffering holds the events until the end; turn it off for that route',
          'nginx cannot forward long-lived HTTP responses at all',
          'The browser blocks events that come through a proxy',
          'TLS termination at the proxy re-encrypts in large records, so events wait; move TLS to the app',
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
          'The browser gave up after 60 seconds, its default wait for a response that sends no bytes',
          'The proxy read timeout, 60 s by default in nginx, fired before the backend finished',
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
          'Route /search to the new service in the reverse proxy; clients keep the URL',
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
          'Two proxies split the load, so each request waits half as long in the proxy queue',
          'nginx needs a second instance to terminate TLS',
          'There is none; a proxy that never crashed does not need a spare',
          'Every request passes through it, so a bad reload or kernel update takes the site down',
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
          'A hit still crosses the internet to reach it; it saves app work, not distance',
          'Reverse proxies keep their cache on disk and forward proxies in memory, so each hit reads the disk',
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
          'Every app server, because the data they serve is theirs',
          'The browsers, which must each install your certificate',
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
          'Path routing, so mobile users go to a separate pool of app servers that has twice the workers',
          'Response buffering: the proxy takes the response fast and feeds the slow client itself',
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
          'The teammate - the proxy strips X-Forwarded-For before the request reaches the app servers',
          'The Lab - but only because the Lab has no NAT',
          'The Lab - a reverse proxy hides servers from clients, not clients from servers',
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
          'Decide if the call is wanted (here, disable telemetry) and time out outbound calls',
          'Add telemetry.example to the allow-list, since the library needs it to start in under a second',
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
          'The proxy retries every 429 it gets, so each rate limited call is sent several more times',
          'The runners are misconfigured and send each request twice',
          'The provider sees one source address, the proxy, so all 40 share one limit',
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
          'Squid adds X-Forwarded-For by default; set forwarded_for to delete',
          'The laptop bypassed the proxy and connected to the partner directly',
          'The partner site guessed the laptop address from the TCP connection',
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
          'Yes - the CONNECT request line carries the full URL, so the proxy can match /upload',
          'Yes - SNI in the TLS hello carries the full URL, path included, in plain text',
          'Yes, but only for users who have logged in to the proxy with their account',
          'No - in a tunnel it sees only the hostname and port, not the path',
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
          'The cache is too small: 300 MB objects are evicted before the next build asks for them',
          'In a CONNECT tunnel it sees only encrypted bytes, so there is nothing to cache',
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
          'The internal host is not in NO_PROXY, so the call goes to the proxy',
          'The inventory service rejects requests that carry Via and Proxy-Authorization headers',
          'HTTP_PROXY only applies to HTTPS URLs, so the plain http:// call breaks',
          'DNS resolution inside the container stops working once a proxy is set',
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
          'An encrypted request it cannot read, since the proxy only tunnels HTTPS without interception',
          'Nothing - the proxy denied the CONNECT, so no request left the network',
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
          'The proxy signs with the company root, which the pinned app rejects; exempt that host',
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
          'Only uncached calls fail; cached answers are still served',
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
          'Route partner calls through a forward proxy or NAT gateway with one fixed address',
          'Give every node a fixed public address from a reserved pool and send the partner that range',
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
          'The CDN has too few edge locations near its users',
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
          'It halves to about 120 ms, since twice the CPU answers every request in half the time',
          'It drops to about 13 ms, the same as with the CDN',
          'It barely moves: about 215 ms of it is distance, which CPU cannot shorten',
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
          'No - every request still goes to Virginia, and the extra hop through the edge only adds time',
          'Only if the responses are compressed',
          'Yes - handshakes end at the nearby edge, which keeps warm connections to the origin',
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
          'The TTL is too long; drop it to 5 seconds so a stale copy never lives long enough to matter',
          'The response varies by user but the key does not; mark it private or no-store',
          'The edges are out of sync with each other; purge all of them after every login',
          'The origin returns the wrong user under load; fix the session lookup in the database query',
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
          'Hash the content into the file name, keep the long max-age, keep the HTML short-lived',
          'Purge the CDN after every deploy, then wait a few minutes for all edges to drop the old file',
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
          'Cache-Control: private, max-age=86400',
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
          'The CDN DNS answers with a nearby edge address, or anycast routing picks the nearest',
          'The origin reads the client IP, looks up its country and sends a redirect to the nearest edge',
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
          'The hit rate drops: each file is now cached up to 40 times, one miss per copy',
          'Nothing is cached any more, because a query string makes a response uncacheable at the edge',
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
          'In each service, since only the service that owns the data can verify the token signature',
          'At the gateway: before they cost service capacity, with token rules in one place',
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
          'It needs the verified identity to know whose quota to charge',
          'Rate limiting is slower than authentication, so it must go last',
          'The HTTP standard requires authentication before any other check',
          'So that invalid tokens can use up the quota of a real paying client',
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
          '401 Unauthorized, because the gateway treats the token as expired after 10 uses',
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
          'Nothing - the services are redundant, so the whole system is too',
          'A full outage: every request passes through that one gateway',
          'Only requests to the one service deployed beside the gateway fail',
          'Requests slow down but still succeed, since each service has three replicas',
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
          'None - logic in the gateway runs first, so prices are computed before any service is called',
          'The gateway will reject valid tokens',
          'One buggy business rule can break every route, and all teams share one component',
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
          'The gateway, with 401, because the token was issued to user 42, not user 7',
          'The client app, by never showing order 999 to user 42 in the interface',
          'Nobody - once the token is valid, the request is allowed for any order',
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
          'Remove the timeout, so recommendations always arrive and the screen is complete',
          'Retry recommendations right away when they pass 50 ms, since a second try is usually fast',
          'Give each dependency a timeout, say 50 ms, and render without the late ones',
          'Move the recommendations logic into the gateway, so it no longer needs a network call',
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
          'An extra hop through a shared component, and internal calls use up client quotas',
          'None - routing every call through the public gateway keeps auth and limits in one place',
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
