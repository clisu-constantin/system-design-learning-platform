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
          'Each lost packet is resent a round trip later, and the audio behind it waits to be delivered in order, so several frames miss their playout time',
          'UDP would lose the same frames and stutter in exactly the same way',
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
          'Almost every download is missing some packets, so the device must add its own ACKs and resends - rebuilding part of TCP',
          'UDP resends each lost datagram up to three times, so only a few downloads fail',
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
          'Packets #11 to #15 right away, and #10 later',
          'An error saying #10 is missing',
          'Packets #11 to #15 with a gap marker where #10 should be',
          'Nothing until the resend of #10 arrives; then #10 to #15 together, in order',
        ],
        answer: 3,
        explanation:
          'TCP promises an in-order byte stream, so it cannot hand over #11 before #10. The Server node in the Lab shows this as "Held back" and "Waiting for #10": head-of-line blocking. Handing over #11 to #15 first is what UDP does - there each datagram goes to the app the moment it arrives.',
      },
      {
        id: 'tcpudp-5',
        prompt:
          'A multiplayer game sends each player position 30 times a second over UDP. One position update is lost. What should the game do?',
        options: [
          'Resend it until the server acknowledges it',
          'Ignore it: the next update arrives about 33 ms later and replaces it, and the client can smooth the gap',
          'Switch the connection to TCP until the loss stops',
          'Pause the game until the lost update arrives',
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
          'The answer is silently cut and the resolver uses the part it got',
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
          'The data behind the gap stalls too until the packet is resent, because TCP delivers one ordered byte stream and knows nothing about the HTTP/2 streams inside it',
          'Only image 3 waits; the others keep flowing',
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
          'Nothing changes, because UDP drops nothing',
          'UDP starts resending the late frames',
          'Frames arrive out of order and some arrive after their playout time, so they count as too late to play although none was dropped',
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
          'It gets worse: the resend takes a longer round trip, so more frames pile up behind the gap and miss their playout time',
          'It gets better, because a longer delay gives the playout buffer more room',
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
          'UDP is faster than TCP on every network',
          'Firewalls prefer UDP over TCP',
          'QUIC uses UDP as a thin base and builds its own reliability, per stream and in user space, avoiding the single ordered stream of TCP and slow kernel upgrades',
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
          'Their networks block or quickly time out UDP; keep a fallback over TCP, as QUIC implementations do',
          'Their datagrams are too small; make them larger',
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
          'The receiver rejects datagrams over 1,500 bytes',
          'Each datagram is split into about 6 fragments, and losing any one loses the whole datagram - about 6% of datagrams',
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
          'Closed connections linger in TIME_WAIT (60 seconds on Linux) and use up the local ports; reuse connections instead',
          'TCP limits each host to 1,000 connections',
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
