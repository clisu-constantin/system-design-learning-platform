import type { DepthMap } from './types';

export const networkingDepth: DepthMap = {
  dns: {
    analogy: {
      title: 'The phone book nobody reprints',
      body:
        'You know the name of a shop but not its number, so you look it up. The directory is not one book - it is a chain: a national index tells you which regional book to open, and that one has the actual number. Everyone who looks it up writes the number on a sticky note for a while (the TTL), which is why the shop cannot change its number and be reachable at the new one instantly.',
    },
    deepDive: [
      {
        heading: 'The lookup is a hierarchy, and every level caches',
        paragraphs: [
          'A lookup for shop.example.com walks down a tree. The resolver asks a root server, which says "ask the .com servers". The .com servers say "ask the nameservers for example.com". Those authoritative servers hold the actual record and answer with an IP. That full walk costs several round trips, which is why it almost never happens.',
          'Caching is everywhere on this path: the browser has a cache, the operating system has one, the resolver has the biggest one, and each level honours the TTL on the record. The resolver even caches the referrals: the list of .com servers comes with a TTL of two days, so a busy resolver almost never asks a root server. In practice, popular names are answered from a nearby cache in under a millisecond, and only the unlucky first request pays the full walk.',
          'The practical consequence is that DNS changes are not instant and are not uniform. After you change a record, some clients see the new value immediately and others keep the old one until their cached copy expires. You are never in a state where "everyone" has switched.',
        ],
        code: {
          caption: 'A cold lookup, one level at a time',
          body: `browser -> OS cache -> resolver
resolver -> root         "try .com at 192.5.6.30"
resolver -> .com         "try ns1.example.com"
resolver -> ns1.example  "shop.example.com = 203.0.113.10, TTL 300"
resolver caches for 300 s, answers the browser

warm lookup: browser or OS cache, ~0 ms`,
        },
      },
      {
        heading: 'The record types you actually use',
        paragraphs: [
          'A and AAAA map a name to an IPv4 or IPv6 address - the basic case. CNAME maps a name to another name, which is how you point app.example.com at a load balancer hostname whose IP changes without telling you. A CNAME cannot exist at the zone apex (example.com itself), which is why providers invented ALIAS or ANAME records.',
          'MX routes mail, TXT holds arbitrary text and has become the universal proof-of-ownership mechanism (SPF, DKIM, domain verification). NS delegates a subdomain to other nameservers, and SRV advertises a service with a port, used by protocols like SIP and by some service discovery systems.',
          'Knowing CNAME versus A is worth more than it sounds. Pointing at a name rather than an address is what lets a cloud provider replace the machine behind your load balancer without your DNS ever changing - and it is why hardcoding the IP of a managed service is a bug that fires months later.',
        ],
        bullets: [
          'A / AAAA - name to IP address.',
          'CNAME - name to another name. Not allowed at the apex; use ALIAS there.',
          'TXT - free text; used for SPF, DKIM and ownership verification.',
          'MX - where mail for this domain goes.',
          'NS - which nameservers are authoritative for this zone.',
        ],
      },
      {
        heading: 'DNS as a routing and failover tool - and where it falls short',
        paragraphs: [
          'Because you can return different answers to different resolvers, DNS became a coarse traffic manager. Geo-routing returns the nearest region, weighted routing splits traffic for a canary, and failover routing stops returning an address whose health check is failing. CDNs are built on exactly this trick.',
          'The limitation is the cache. If a region dies and your TTL is 300 seconds, clients holding a cached answer keep trying the dead address for up to five minutes, and some misbehaving resolvers and client libraries ignore the TTL entirely. DNS failover is therefore a minutes-scale mechanism, not a seconds-scale one.',
          'The standard pattern is to use DNS for slow, coarse decisions - which region, which provider - and a load balancer or anycast address for fast ones. Before any planned migration, drop the TTL to 60 seconds a day or two in advance, do the switch, then raise it again.',
        ],
      },
    ],
    examples: [
      {
        title: 'A migration that half-worked for a day',
        setup:
          'A team moves their API to a new provider. They update the A record from the old IP to the new one at 10:00, with the TTL still set to the default 86400 (24 hours).',
        walkthrough: [
          'New visitors whose resolver had no cached entry get the new IP immediately and everything looks perfect from the office.',
          'Resolvers that cached the old record at 09:55 keep serving the old IP for the next 24 hours. Those users hit the old servers.',
          'The team shuts down the old servers at 12:00 believing the migration is complete. A large share of users starts seeing connection errors.',
          'Emergency fix: bring the old servers back and put a proxy on them that forwards to the new ones, so both addresses work.',
          'What should have happened: lower the TTL to 60 seconds two days before the change, switch, watch traffic drain from the old IP, then decommission after it reaches zero.',
        ],
        result:
          'The record was correct within seconds; the internet still took a day to agree. Plan DNS changes as a drain, not a switch, and always keep the old endpoint alive until traffic on it is actually zero.',
      },
    ],
    jargon: [
      { term: 'Resolver', plain: 'The DNS server that does the recursive lookup for you and caches the result. Usually your ISP or 8.8.8.8.' },
      { term: 'Authoritative server', plain: 'The nameserver that actually owns the answer for a domain.' },
      { term: 'TTL', plain: 'How many seconds a cached answer may be reused. It sets how slow your DNS changes are.' },
      { term: 'Zone apex', plain: 'The bare domain (example.com). It cannot hold a CNAME, which is a constant source of confusion.' },
      { term: 'Anycast', plain: 'The same IP announced from many locations; the network routes you to the closest one.' },
      { term: 'Propagation', plain: 'The informal word for waiting out TTLs. Nothing is actually pushed anywhere.' },
    ],
    remember: [
      'DNS turns names into addresses through a cached hierarchy - the cache is the whole story.',
      'TTL is the delay on every change you make. Lower it before a migration, raise it after.',
      'CNAME points at a name so the address behind it can change without you.',
      'DNS failover works in minutes; use a load balancer or anycast for seconds.',
      'Never decommission the old endpoint until its traffic is actually zero.',
    ],
  },

  'http-https': {
    analogy: {
      title: 'Postcards versus sealed envelopes',
      body:
        'HTTP is a postcard: every post office it passes can read it, and a dishonest one could rewrite it before passing it on. HTTPS is a sealed, tamper-evident envelope addressed to a recipient whose identity was checked by a notary. The letter inside is the same words - the difference is who can read it, who can change it, and whether you are sure you are talking to the right company.',
    },
    deepDive: [
      {
        heading: 'HTTP is a request, a response, and a pile of headers',
        paragraphs: [
          'Every HTTP exchange is the same shape: a method and a path, some headers, optionally a body - and back comes a status code, some headers, optionally a body. That is the whole protocol. Everything else you know about the web is a convention built on top of those four parts.',
          'Methods carry meaning that infrastructure depends on. GET is safe (no side effects) and cacheable; PUT and DELETE are idempotent (doing it twice equals doing it once); POST is neither. This is not pedantry: proxies, CDNs and load balancers all decide whether they may cache or retry a request based on its method, so a GET that mutates data will eventually be replayed by something and surprise you.',
          'Status codes are the other contract. 2xx worked, 3xx go elsewhere, 4xx you made a mistake, 5xx we made a mistake. The 4xx/5xx split matters operationally: 4xx should not page anybody, 5xx should, and mislabelling a validation failure as 500 is how alert fatigue starts.',
        ],
        code: {
          caption: 'The whole protocol, in one exchange',
          body: `GET /api/users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
If-None-Match: "a3f9"

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: max-age=60
ETag: "a3f9"

{"id":42,"name":"Ana"}

(if nothing changed, the server may answer 304 Not Modified with no body)`,
        },
      },
      {
        heading: 'What HTTPS actually gives you: three guarantees, not one',
        paragraphs: [
          'Encryption is the famous one: nobody between you and the server can read the traffic. But it is the least of the three in practice. Integrity means nobody can modify it in flight - without it, any coffee-shop router or ISP can inject advertising or malicious scripts into your pages, which used to be routine.',
          'Authentication is the one people forget and the one that makes the others possible. The certificate proves that this server really is api.example.com, vouched for by an authority your device trusts. Without it, encryption is useless - you would have a perfectly private conversation with an attacker.',
          'Modern TLS 1.3 also cut the handshake to one round trip, so the performance objection to HTTPS is gone; with HTTP/2 and connection reuse, secure is usually faster than the plaintext setups it replaced. And features like service workers, HTTP/2 and geolocation simply refuse to work without it.',
        ],
        bullets: [
          'Confidentiality - the bytes are unreadable in transit.',
          'Integrity - the bytes cannot be modified without detection.',
          'Authentication - you are talking to the server the certificate names.',
          'Not included: the server itself is not made trustworthy, and the hostname you visit is still visible via DNS and SNI (the path and query string are not).',
        ],
      },
      {
        heading: 'HTTP/1.1, /2 and /3 in one paragraph each',
        paragraphs: [
          'HTTP/1.1 sends one request at a time per connection. Browsers worked around it by opening six connections per host, which is why asset sharding and sprite sheets were once good ideas. Head-of-line blocking is at the request level: one slow response holds up everything behind it on that connection.',
          'HTTP/2 multiplexes many streams over a single TCP connection and adds header compression (it also added server push, which browsers have since dropped). The old workarounds became counterproductive - six connections now hurt. But head-of-line blocking moved down a layer: one lost TCP packet stalls every stream in that connection, because TCP insists on delivering bytes in order.',
          'HTTP/3 replaces TCP with QUIC over UDP, giving each stream its own delivery order, so a lost packet only stalls the stream it belonged to. It also folds the transport and TLS handshakes together, cutting setup to one round trip - and resuming a connection can cost zero. On lossy mobile networks the difference is large; on a clean wired link it is modest.',
        ],
      },
    ],
    examples: [
      {
        title: 'The cache header that broke a deploy',
        setup:
          'A team ships a single-page app. index.html and the JavaScript bundle are both served with Cache-Control: max-age=31536000 (one year), because "caching is good".',
        walkthrough: [
          'Users load the app once. Both files are now cached in every browser for a year.',
          'The team deploys a fix. Nothing changes for existing users - their browsers never ask again, because a fresh cached entry is used without revalidation.',
          'Worse, users who partially reload get the new index.html referencing a new bundle hash, while an old cached bundle is still used elsewhere - a mix that produces impossible errors.',
          'Correct pattern: hashed asset filenames (app.4f2a1c.js) get max-age=31536000, immutable, because the name changes whenever the content does.',
          'index.html gets no-cache, meaning it must be revalidated every time. The revalidation is cheap - usually a 304 with no body - and it always points at the current asset hashes.',
        ],
        result:
          'Cache the files whose names change; never cache the file that points at them. That one rule is most of what static asset caching requires.',
      },
    ],
    jargon: [
      { term: 'Idempotent', plain: 'Doing it twice has the same effect as doing it once. GET, PUT and DELETE are; POST is not.' },
      { term: 'Header', plain: 'Metadata about the request or response - content type, caching rules, authentication, cookies.' },
      { term: 'ETag', plain: 'A fingerprint of a response. The client sends it back so the server can reply "304, unchanged".' },
      { term: 'TLS handshake', plain: 'The round trips that agree on keys and verify the certificate before any data flows.' },
      { term: 'Head-of-line blocking', plain: 'One slow or lost item holding up everything queued behind it.' },
      { term: 'HSTS', plain: 'A header that tells the browser to only ever use HTTPS for this domain, closing the first-visit gap.' },
    ],
    remember: [
      'Every HTTP exchange is method + path + headers + body, and a status code coming back.',
      'GET must be safe and PUT/DELETE idempotent, because infrastructure retries and caches based on that.',
      'HTTPS gives encryption, integrity and authentication - the third one makes the others meaningful.',
      'HTTP/2 multiplexes over one connection; HTTP/3 removes TCP head-of-line blocking with QUIC.',
      'Cache hashed assets forever, never cache the HTML that references them.',
    ],
  },

  'tcp-vs-udp': {
    analogy: {
      title: 'Registered post versus shouting across the street',
      body:
        'Registered post guarantees delivery, in order, with a signature - and if something is lost it is sent again, which takes time. Shouting is instant and free, but a word swallowed by a passing bus is simply gone, and you may be understood out of order. Neither is better. For a contract you want registered post; for calling out a live score, shouting is exactly right.',
    },
    deepDive: [
      {
        heading: 'What TCP actually does for you',
        paragraphs: [
          'TCP gives four guarantees: every byte arrives, in the order sent, without duplication, and the sender slows down when the network is congested. It achieves this with sequence numbers, acknowledgements, retransmission timers and congestion control - all of it invisible to your code, which just reads a stream.',
          'Those guarantees have a price, and the price is time. Connection setup is a round trip before any data moves. A lost packet means waiting for a retransmission, and everything behind it waits too, because the stream must be delivered in order. Congestion control deliberately starts slow and ramps up, so short connections never reach full speed.',
          'For almost everything - HTTP, databases, SSH, message brokers - this is the right trade. Losing a byte of a JSON payload is not an acceptable outcome, and the latency cost is invisible next to the work being done.',
        ],
        code: {
          caption: 'The cost and the guarantee, side by side',
          body: `                   TCP                    UDP
setup              1 RTT handshake        none, send immediately
delivery           guaranteed, in order   best effort, any order
lost packet        retransmitted (wait)   gone
congestion         backs off automatically  your problem
header             20 bytes               8 bytes
head-of-line       yes (ordered stream)   no
used by            HTTP, SQL, SSH, Kafka  DNS, QUIC, video, games`,
        },
      },
      {
        heading: 'Why anyone chooses UDP',
        paragraphs: [
          'UDP is a thin wrapper over IP: send a datagram, hope it arrives. No handshake, no ordering, no retransmission, no congestion control. That sounds worse in every way until you notice the category of applications for which late data is worthless data.',
          'In a voice call, a packet that arrives 400 ms late cannot be played - the conversation has moved on. Retransmitting it wastes bandwidth and delays the packets behind it. Better to drop it and let the codec conceal the gap. The same logic applies to live video and multiplayer game state: the next update supersedes the lost one.',
          'The second reason is control. QUIC (and therefore HTTP/3) runs over UDP not because it wants unreliability, but because it wants to implement reliability itself, per stream, in user space - free from the in-order delivery rule baked into TCP and from the slow pace of changing kernel networking stacks.',
        ],
        bullets: [
          'Use TCP when every byte matters: APIs, databases, file transfer, messaging.',
          'Use UDP when fresh beats complete: voice, video, game state, telemetry samples.',
          'Use UDP when you want your own reliability model: QUIC, some RPC frameworks.',
          'DNS uses UDP for small queries and falls back to TCP for large responses.',
        ],
      },
      {
        heading: 'Things that bite people in practice',
        paragraphs: [
          'TCP connections are not free and not infinite. Each one holds kernel buffers, and a server has a finite number of ports and file descriptors. Connection pooling and keep-alive exist because opening a connection per request wastes a round trip and exhausts resources at scale.',
          'The TIME_WAIT state surprises everyone at least once: a closed connection lingers for a minute or two to catch stray packets. A service that opens thousands of short-lived connections per second can accumulate tens of thousands of sockets in TIME_WAIT and start failing to connect, with plenty of CPU and memory free.',
          'On the UDP side, the hazards are size and firewalls. A datagram larger than the path MTU gets fragmented, and one lost fragment loses the whole datagram - so keep them under roughly 1,400 bytes. And many corporate networks block or aggressively time out UDP, which is why QUIC implementations always keep a TCP fallback.',
        ],
      },
    ],
    examples: [
      {
        title: 'Why a video call and an API call want opposite things',
        setup:
          'The same network drops 2 percent of packets. Compare what happens to a JSON API request and to a voice stream.',
        walkthrough: [
          'API over TCP: a packet in the middle of the response is lost. TCP detects it and retransmits, costing one round trip (say 60 ms).',
          'Everything after the lost packet was already received but is held back until the gap is filled, because the application must see bytes in order. The response arrives 60 ms late but complete - perfectly acceptable.',
          'Voice over TCP: the same 20 ms of audio is retransmitted and arrives 60 ms late. By then the playback buffer has moved on, so it is useless - and the audio after it was delayed too, producing an audible stutter.',
          'Voice over UDP: the packet is simply lost. The codec interpolates 20 ms of audio, which most listeners cannot detect, and everything after it plays on time.',
          'Note the asymmetry: TCP turned one lost packet into a stutter, UDP turned it into an inaudible blip. Same loss rate, opposite outcomes.',
        ],
        result:
          'The question is never which protocol is more reliable. It is whether late data still has value. If yes, use TCP; if no, use UDP and handle loss in the codec or the application.',
      },
    ],
    jargon: [
      { term: 'Datagram', plain: 'One self-contained UDP message. It arrives whole or not at all.' },
      { term: 'Three-way handshake', plain: 'SYN, SYN-ACK, ACK - the round trip TCP spends before sending your data.' },
      { term: 'Congestion control', plain: 'TCP slowing itself down when the network shows signs of overload.' },
      { term: 'MTU', plain: 'The largest packet the path accepts, typically about 1,500 bytes. Exceed it and packets fragment.' },
      { term: 'Keep-alive', plain: 'Holding a TCP connection open to reuse it and avoid paying the handshake again.' },
      { term: 'QUIC', plain: 'A reliable, multiplexed protocol built on UDP. The transport under HTTP/3.' },
    ],
    remember: [
      'TCP: ordered, reliable, congestion-aware - and therefore sometimes late.',
      'UDP: no promises, no waiting - and therefore always fresh.',
      'Choose by asking whether late data is still useful.',
      'TCP head-of-line blocking means one lost packet delays everything behind it.',
      'QUIC uses UDP to build its own reliability, per stream, without the in-order rule.',
    ],
  },

  'reverse-proxy': {
    analogy: {
      title: 'The reception desk of an office building',
      body:
        'Visitors never wander into the building looking for a person. They talk to reception, which checks who they are, knows which floor each department is on, and sends them to someone available. The departments never deal with the street. A reverse proxy is that desk: clients only ever know one address, and it decides what happens behind it.',
    },
    deepDive: [
      {
        heading: 'Reverse means it acts for the server, not the client',
        paragraphs: [
          'A forward proxy sits with the client and hides who is asking. A reverse proxy sits with the server and hides what is answering. Clients believe they are talking to your application; in reality they are talking to nginx, Envoy, HAProxy or a cloud load balancer, which then forwards to whatever is actually running.',
          'That indirection is where most production infrastructure lives. Because every request passes one place, that place is the natural home for TLS termination, compression, caching, rate limiting, request logging, header rewriting, blue-green switching and routing by path. Adding any of those in the proxy means you add them once instead of in every service.',
          'It also decouples the public interface from the internal layout. You can split one service into three, move a path to a new implementation, or run two versions side by side, and no client has to know - the proxy config changes, the URL does not.',
        ],
        bullets: [
          'TLS termination - certificates live in one place, not in every service.',
          'Path routing - /api to the API, /static to object storage, /ws to the socket tier.',
          'Buffering slow clients so an application worker is not held hostage by a 3G connection.',
          'Compression, caching and static file serving, which application frameworks do poorly.',
          'A single, consistent access log for everything that enters the system.',
        ],
      },
      {
        heading: 'Reverse proxy or load balancer?',
        paragraphs: [
          'The honest answer is that the categories overlap and the vocabulary is inconsistent. A load balancer is defined by what it decides (which backend gets this request); a reverse proxy is defined by where it sits (in front, acting on behalf of the servers). The HTTP load balancers most teams run are reverse proxies that also pick a backend; not every reverse proxy balances load, and some network load balancers only forward packets without opening connections of their own.',
          'In practice teams run both roles in one process. nginx in front of three app servers is a reverse proxy doing load balancing. A cloud application load balancer is a managed reverse proxy with health checks and autoscaling integration.',
          'Where the distinction matters is in layering. A common shape is a cloud L4 balancer at the edge for raw distribution and DDoS absorption, then nginx or Envoy inside for routing, retries and per-route policy. Each layer has one job, and each is scaled and configured separately.',
        ],
        code: {
          caption: 'A typical front door',
          body: `internet
   |
[cloud LB]        L4: spread across zones, absorb floods
   |
[nginx / Envoy]   L7: TLS, route by path, compress, rate limit
   |     |     |
 api   static  ws   -> internal services, plain HTTP, no certs`,
        },
      },
      {
        heading: 'The details that cause incidents',
        paragraphs: [
          'The first is the client IP. Once a proxy forwards a request, the backend sees the proxy address, not the user. The proxy must set X-Forwarded-For (or the standard Forwarded header, RFC 7239) - nginx does not add it unless you configure it - and the application must be configured to trust it, but only from the proxy, otherwise anyone can spoof their IP and defeat your rate limiting.',
          'The second is timeouts. A proxy has its own read and connect timeouts (60 seconds each by default in nginx), and if they are shorter than the application timeout, users get a 504 while the backend is still happily working. If they are longer, a stuck backend holds proxy connections until the proxy exhausts its own limits. These numbers should be chosen together, with the proxy slightly more patient than the intended request budget and considerably less patient than infinity.',
          'The third is buffering. Proxies buffer responses by default, which is what protects slow clients from occupying a worker - but it also breaks streaming responses, server-sent events and long-polling, which appear to hang until the whole response is ready. Those routes need buffering explicitly turned off.',
        ],
      },
    ],
    examples: [
      {
        title: 'One proxy, three jobs, zero application changes',
        setup:
          'A monolith serves everything, including images, on a single Rails process. The team adds nginx in front and changes no application code.',
        walkthrough: [
          'Static files: nginx serves /assets directly from disk. Those requests never reach Ruby, freeing roughly 40 percent of worker time.',
          'Gzip: nginx compresses JSON responses. Payloads drop by about 70 percent with no framework middleware involved.',
          'Slow clients: nginx buffers responses, so a user on a poor mobile connection occupies an nginx connection (cheap) instead of an application worker (expensive).',
          'TLS: certificates move to nginx. The app speaks plain HTTP on localhost and no longer needs certificate handling or renewal logic.',
          'Later, the team extracts the search feature into a Go service. nginx routes /search there; clients see the same URL and nothing else changes.',
        ],
        result:
          'Capacity roughly doubled without touching the application, and the first step of a migration became a five-line config change. That is the case for having a proxy before you think you need one.',
      },
    ],
    jargon: [
      { term: 'Reverse proxy', plain: 'A server that accepts requests on behalf of your backends and forwards them.' },
      { term: 'Upstream', plain: 'The backend the proxy forwards to. nginx vocabulary, widely borrowed.' },
      { term: 'X-Forwarded-For', plain: 'The header carrying the original client IP through proxies. Trust it only from your own proxy.' },
      { term: 'TLS termination', plain: 'Decrypting HTTPS at the proxy so backends can speak plain HTTP internally.' },
      { term: 'Buffering', plain: 'The proxy holding a full response before sending it on. Protects workers, breaks streaming.' },
      { term: 'Edge', plain: 'The outermost layer that faces the internet. Where TLS, WAF and rate limiting usually live.' },
    ],
    remember: [
      'A reverse proxy is one public address hiding any internal layout you like.',
      'It is the right home for TLS, routing, compression, caching and rate limits - configured once.',
      'An HTTP load balancer is a reverse proxy that picks a backend; not every reverse proxy balances load.',
      'Forward the client IP explicitly, and only trust that header from your own proxy.',
      'Disable buffering on streaming routes or they will appear to hang.',
    ],
  },

  'forward-proxy': {
    analogy: {
      title: 'The company post room',
      body:
        'All outgoing mail goes through one room. It stamps everything with the company address, so recipients never see which desk it came from, it refuses to send letters to certain addresses, and it keeps a log of what left the building. A forward proxy is that room for outbound network traffic: it acts for the clients inside, not for the servers outside.',
    },
    deepDive: [
      {
        heading: 'Forward proxies act for the client',
        paragraphs: [
          'The direction is the whole distinction. A reverse proxy is deployed by the owner of a service and hides the backends. A forward proxy is deployed by the owner of a network and hides the clients: the destination server sees one source address for the whole company or the whole cluster.',
          'That gives you a single control point for everything leaving your network. You can allow or deny destinations, log every outbound call, cache frequently fetched resources, enforce authentication, and strip or add headers. For a corporate network this is policy enforcement; for a production cluster it is usually security and cost control.',
          'The same mechanism serves a completely different purpose for consumers: a VPN or a public proxy hides the user address from the destination. Same technology, opposite motivation - one hides employees from the internet, the other hides a person from a service.',
        ],
      },
      {
        heading: 'Where backend engineers actually meet one',
        paragraphs: [
          'The most common encounter is the egress proxy in a locked-down production environment. Services run in a subnet with no direct internet route, and all outbound calls must go through a proxy that only allows an approved list of destinations. This is how an organisation makes "our servers can only talk to these five third parties" a fact rather than a policy document.',
          'It matters because it changes how your code behaves. Your HTTP client must honour HTTP_PROXY and HTTPS_PROXY, TLS to external services is usually tunnelled with CONNECT, and a forgotten NO_PROXY entry means internal calls get sent out through the proxy and fail confusingly. Container images that ignore proxy environment variables cause a very specific class of "works locally, hangs in staging" bug.',
          'The second encounter is caching for cost. A build fleet pulling the same packages thousands of times a day, or services fetching the same third-party data, benefit from a shared caching proxy - it reduces egress bills and removes a dependency on the third party being up for every single call.',
        ],
        code: {
          caption: 'Which way the proxy faces',
          body: `FORWARD proxy (acts for clients)
  [your laptops / services] -> [proxy] -> internet
  destination sees the proxy IP

REVERSE proxy (acts for servers)
  internet -> [proxy] -> [your backends]
  client sees the proxy address`,
        },
      },
      {
        heading: 'Limits and honest caveats',
        paragraphs: [
          'A forward proxy sees very little of HTTPS traffic. With CONNECT it just tunnels bytes, so it can log and allow by the hostname the CONNECT request names (and the SNI in the TLS handshake) but not inspect or cache the content. Inspecting content requires TLS interception - installing a company certificate on every device and decrypting traffic - which is powerful, invasive, and creates a high-value target.',
          'It is also a single point of failure and a bottleneck by construction. If everything outbound goes through it, its capacity and availability become your capacity and availability for every third-party call. Run it redundantly and monitor it like a production service, because it is one.',
          'Finally, on a proxy that many clients share, the destination sees one IP for all of them. That is the point, but it means one misbehaving client can get the whole organisation rate limited or blocked by an API provider.',
          'Hiding the clients is also not automatic. On requests it can read, a proxy may add X-Forwarded-For with the client address - Squid does so by default (its forwarded_for setting is on) - so a proxy meant to hide its clients must be configured to leave the header out.',
        ],
      },
    ],
    examples: [
      {
        title: 'Catching an unexpected outbound call',
        setup:
          'A payments service is deployed into a subnet with no internet gateway. All egress goes through a proxy with an allow-list of three domains. A new library is added to the service.',
        walkthrough: [
          'On the developer laptop everything works: the laptop has open internet access.',
          'In staging the service hangs on startup for 30 seconds and then errors. The proxy log shows a denied CONNECT to a telemetry endpoint the library calls on boot.',
          'Nobody had read that the library phones home. The proxy log is the only reason it was noticed at all - this is exactly the class of thing an allow-list is for.',
          'Decision: the telemetry is not needed, so it is disabled in the library configuration rather than added to the allow-list.',
          'Follow-up: the startup hang was a missing timeout on that outbound call. It gets a 2-second timeout so a blocked destination can never again delay a deploy.',
        ],
        result:
          'The proxy turned an invisible, unauthorised outbound dependency into a log line and a decision. That visibility is the main reason production networks run egress proxies at all.',
      },
    ],
    jargon: [
      { term: 'Egress', plain: 'Traffic leaving your network. Ingress is traffic coming in.' },
      { term: 'Allow-list', plain: 'The explicit set of destinations permitted. Everything else is denied by default.' },
      { term: 'CONNECT', plain: 'The HTTP method used to tunnel an encrypted connection through a proxy.' },
      { term: 'NO_PROXY', plain: 'The environment variable listing hosts that must bypass the proxy, usually internal ones.' },
      { term: 'TLS interception', plain: 'Decrypting HTTPS at the proxy using a trusted company certificate, to inspect content.' },
      { term: 'NAT gateway', plain: 'A simpler egress device that rewrites addresses but applies no policy or logging by hostname.' },
    ],
    remember: [
      'Forward proxy acts for clients, reverse proxy acts for servers - direction is the difference.',
      'It is the one place to allow, deny, log and cache everything leaving your network.',
      'Your HTTP client must respect the proxy environment variables, including NO_PROXY.',
      'HTTPS through a forward proxy is tunnelled, so it sees hostnames, not content.',
      'It becomes a shared dependency and a shared reputation - treat it as production.',
    ],
  },

  cdn: {
    analogy: {
      title: 'Local branches of a warehouse',
      body:
        'A central warehouse in Frankfurt can serve all of Europe, but every parcel takes days. Put small stocked branches in each city and the popular items ship the same hour; only rare items are fetched from Frankfurt. A CDN is that network of branches for bytes: hundreds of locations near users, each holding copies of whatever people keep asking for.',
    },
    deepDive: [
      {
        heading: 'Distance is the problem a CDN solves',
        paragraphs: [
          'Light in fibre covers roughly 200 km per millisecond, and real routes are far from straight. A round trip from Bucharest to Virginia is about 120 ms, and a page needs several of them - DNS, TCP, TLS, then the request itself. No backend optimisation touches any of that; it is geography.',
          'A CDN attacks the distance directly. The user connects to an edge node perhaps 20 km away, so the handshake round trips cost 2 ms instead of 120 ms. For cached content the response comes straight back from that node. Even for content the edge cannot serve itself, you still win: the handshakes happen locally and the edge-to-origin leg often runs over a pre-warmed, optimised connection.',
          'This is why a CDN helps dynamic APIs too, which surprises people. You are not caching the response; you are removing three round trips of connection setup from the user path.',
        ],
        code: {
          caption: 'Same content, two paths',
          body: `NO CDN (Bucharest user, Virginia origin)
  DNS 40 + TCP 120 + TLS 120 + request 120 + 40 server = ~440 ms

WITH CDN, cache hit at Bucharest edge
  DNS 10 + TCP 4 + TLS 4 + request 4 = ~22 ms

WITH CDN, cache miss
  ~12 ms local setup + edge->origin 130 ms (warm connection) = ~145 ms`,
        },
      },
      {
        heading: 'Cache keys, TTLs and the invalidation problem',
        paragraphs: [
          'An edge decides what it is holding by a cache key, normally the URL plus a few chosen headers. Getting the key wrong is the classic CDN bug in both directions: include too much (say, the full cookie header) and every user gets their own copy, so the hit rate collapses to nearly zero; include too little (ignore Accept-Language or the auth header) and you serve the private content of one user to another.',
          'TTL decides how long an edge may answer without asking the origin. Long TTLs give great hit rates and slow updates. The industry solution is to avoid the conflict entirely with content-addressed filenames: app.4f2a1c.js can be cached for a year because a change produces a different name, so nothing ever needs invalidating.',
          'When you do need invalidation, know that a purge is a request to hundreds of locations and takes seconds to minutes to complete globally. Designs that depend on instant global purge are fragile; designs that depend on immutable URLs are not.',
        ],
        bullets: [
          'Hashed filenames + max-age=31536000, immutable - never purge anything.',
          'HTML and API responses - short TTL (seconds) or no-cache with revalidation.',
          'stale-while-revalidate - serve the slightly old copy instantly, refresh in the background.',
          'Vary carefully: each value of a Vary header multiplies the number of cached copies.',
          'Never cache a response that depends on a cookie unless the cookie is part of the key.',
        ],
      },
      {
        heading: 'What you get besides speed',
        paragraphs: [
          'Origin offload is often the bigger commercial win. If 95 percent of requests are answered at the edge, your origin serves one twentieth of the traffic, which means fewer servers, less bandwidth, and a much flatter load curve during a spike. A viral link that would have melted the origin lands on the CDN instead.',
          'Availability improves for the same reason. Many CDNs can serve stale content while the origin is down, so a backend outage becomes a degraded experience rather than a blank page - if you configured stale-if-error, which is one line and almost always worth it.',
          'And the edge is a natural security boundary: DDoS absorption, WAF rules, bot filtering and TLS all live there, in front of everything you own. That is why CDNs and security products converged into the same vendors.',
        ],
      },
    ],
    examples: [
      {
        title: 'The cookie that destroyed the hit rate',
        setup:
          'A team puts a CDN in front of their site and sees a 4 percent hit rate. Images, CSS and JS are all being fetched from the origin almost every time.',
        walkthrough: [
          'Investigation: the origin sets an analytics cookie on every response, and the CDN configuration includes the Cookie header in the cache key.',
          'Every visitor has a unique cookie value, so every visitor gets a unique cache key. Each edge stores millions of copies of the same logo and serves almost none of them twice.',
          'Fix 1: strip cookies from the cache key for static paths. Static assets do not vary by user, so the key should be the URL alone.',
          'Fix 2: stop setting cookies on static responses at the origin - the analytics cookie only needs to be set on HTML.',
          'Fix 3: serve assets from a separate hostname (static.example.com) that has no cookies at all, so the mistake cannot recur.',
          'Hit rate after the change: 96 percent. Origin bandwidth dropped by a factor of twenty.',
        ],
        result:
          'A CDN is only as good as its cache key. When the hit rate is bad, look at what makes two requests for the same bytes look different - it is almost always a cookie, a query parameter or an over-broad Vary.',
      },
    ],
    jargon: [
      { term: 'Edge / PoP', plain: 'A CDN location near users. PoP means point of presence.' },
      { term: 'Origin', plain: 'Your servers - where the edge fetches from on a miss.' },
      { term: 'Cache key', plain: 'What the edge uses to decide whether two requests are the same. Usually URL plus selected headers.' },
      { term: 'Hit rate', plain: 'The share of requests answered at the edge. The single number that says if the CDN is working.' },
      { term: 'Purge / invalidation', plain: 'Telling edges to drop a cached object. Takes seconds to minutes globally.' },
      { term: 'stale-while-revalidate', plain: 'Serve the old copy immediately and refresh in the background. Great for perceived speed.' },
    ],
    remember: [
      'A CDN buys distance, and distance is the part backend work cannot fix.',
      'Even uncacheable requests get faster, because the handshakes happen nearby.',
      'The cache key decides everything - cookies and query strings are the usual saboteurs.',
      'Immutable hashed filenames remove the invalidation problem instead of solving it.',
      'Origin offload and stale-if-error make the CDN an availability tool, not just a speed tool.',
    ],
  },

  'api-gateway': {
    analogy: {
      title: 'The concierge desk of a hotel',
      body:
        'A guest does not phone housekeeping, the kitchen and the spa separately, and does not need to know their extension numbers. They call the concierge, who checks the room key, knows who handles what, and calls the right department. If the spa is renamed or moved, the guest still calls the same number. That is an API gateway: one entrance, one identity check, many services behind it.',
    },
    deepDive: [
      {
        heading: 'One door, and the cross-cutting concerns behind it',
        paragraphs: [
          'When a system has twenty services, every one of them needs authentication, rate limiting, request logging, CORS handling and TLS. Implementing those twenty times produces twenty subtly different behaviours and twenty places to fix a security bug. The gateway exists so those concerns are implemented once, at the entrance.',
          'That has a second effect: the public API stops being tied to the internal service layout. You can split a service, rename it, move a route to a new implementation or run two versions in parallel, and clients keep calling the same paths. For a system in migration, the gateway is what makes the change invisible.',
          'The typical feature list is therefore routing, authentication and token validation, rate limiting and quotas, request and response transformation, protocol translation (public REST to internal gRPC), caching, and a consistent access log for everything entering the system.',
        ],
        code: {
          caption: 'Where responsibility sits',
          body: `client
  |
[API gateway]   authn, rate limit, route, log, transform
  |     |     |
users  orders  search        <- services trust the gateway,
  \\     |     /                 do their own authorisation
   [service mesh / internal calls]`,
        },
      },
      {
        heading: 'Gateway versus load balancer versus service mesh',
        paragraphs: [
          'A load balancer answers "which instance of this service?". A gateway answers "which service, and is this caller allowed?". A service mesh answers "how do services call each other safely?" - it handles east-west traffic between services, while the gateway handles north-south traffic from the outside world.',
          'They stack rather than compete. A common production shape is a cloud load balancer at the very edge, a gateway behind it for API policy, and a mesh sidecar inside for service-to-service mTLS, retries and tracing. Small systems collapse all three into nginx and are entirely correct to do so.',
          'The BFF pattern (backend for frontend) sits next to this: instead of one gateway for everyone, each client type gets its own thin aggregation layer, because a mobile app wants a few fat responses and a web app wants many small ones. A gateway can host BFFs as routes, or they can be separate services behind it.',
        ],
      },
      {
        heading: 'The failure modes to design against',
        paragraphs: [
          'The gateway is on the path of every request, so it is a single point of failure by construction. It must run redundantly across zones, and it must be boring: heavy custom logic in a gateway is code that takes down everything when it has a bug. Keep transformations thin and push business logic into services.',
          'Authentication at the gateway is not authorisation in the services. The gateway can verify that a token is valid and attach a user id; it usually cannot decide whether this user may edit that specific document. Services that assume "the gateway checked it" become wide open the moment anything reaches them another way - so keep internal authorisation checks, and do not let services be reachable without the gateway.',
          'Finally, watch the latency and the coupling. Every hop adds milliseconds, and a gateway that aggregates three downstream calls inherits the slowest of them plus their failure probabilities. Use timeouts per route, circuit breakers on downstreams, and return partial responses where the product allows it.',
        ],
        bullets: [
          'Run at least two gateway instances across zones; it is on every request path.',
          'Verify tokens at the gateway, but keep per-resource authorisation in the services.',
          'Per-route timeouts and circuit breakers, so one slow service cannot consume all gateway capacity.',
          'Keep it thin - a gateway full of business rules is a distributed monolith with extra hops.',
        ],
      },
    ],
    examples: [
      {
        title: 'Turning six mobile calls into one',
        setup:
          'A mobile home screen needs profile, unread count, recent orders, recommendations, active promotions and feature flags. Today the app makes six calls to six services over a 4G connection with about 80 ms round trip.',
        walkthrough: [
          'Six sequential calls: 6 x 80 ms of network alone, plus service time - roughly 700 ms before anything renders.',
          'Parallel calls help, but the app now holds six TLS connections, each needing its own auth header, and the slowest one still sets the total.',
          'Add a gateway aggregation route: GET /mobile/home. The app makes one call; the gateway fans out to all six services inside the datacenter where each hop is about 2 ms.',
          'Total becomes 80 ms of mobile network plus the slowest internal call, say 40 ms - about 120 ms, and the phone holds one connection.',
          'Add per-dependency timeouts: recommendations get 50 ms, and if they are late the response ships without them. The home screen renders with a placeholder rather than failing.',
          'Cache flags and promotions at the gateway for 30 seconds, removing two downstream calls entirely for most requests.',
        ],
        result:
          'Roughly 700 ms became roughly 120 ms, and the screen now degrades in pieces instead of failing as a whole. The cost is a new component on the critical path that must be kept thin, redundant and well monitored.',
      },
    ],
    jargon: [
      { term: 'North-south traffic', plain: 'Traffic between the outside world and your system. East-west is service to service.' },
      { term: 'BFF', plain: 'Backend for frontend: a thin per-client layer that shapes responses for one kind of app.' },
      { term: 'Aggregation', plain: 'One inbound request fanning out to several services and returning a combined response.' },
      { term: 'Rate limit / quota', plain: 'A cap on requests per second, or per month, enforced per client or per key.' },
      { term: 'Protocol translation', plain: 'Accepting REST or GraphQL outside while speaking gRPC or something else inside.' },
      { term: 'Service mesh', plain: 'Sidecar proxies handling service-to-service concerns: mTLS, retries, tracing.' },
    ],
    remember: [
      'One entrance for cross-cutting concerns: auth, rate limits, routing, logging - written once.',
      'It decouples your public API from your internal service layout, which makes migrations invisible.',
      'Gateway authentication is not service authorisation; keep both.',
      'It is on every request path, so make it redundant and keep it thin.',
      'Aggregating calls at the gateway turns many slow mobile round trips into one.',
    ],
  },
};
