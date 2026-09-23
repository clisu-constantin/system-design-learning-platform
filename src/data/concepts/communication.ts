import type { Concept } from '@/types';

export const communicationConcepts: Concept[] = [
  {
    slug: 'rest-apis',
    title: 'REST APIs',
    tagline: 'Resources, HTTP verbs and the cacheability that comes with them.',
    category: 'communication',
    difficulty: 'Beginner',
    keywords: ['http', 'resource', 'idempotent', 'versioning', 'pagination'],
    what: 'REST models an API as resources addressed by URLs and manipulated with HTTP methods, relying on the semantics HTTP already defines.',
    why: 'Because it uses HTTP properly, every intermediary understands it: browsers cache GETs, proxies retry idempotent methods, and any client can call it without a special library.',
    how: [
      'Model nouns, not verbs: /orders/123 rather than /getOrder?id=123.',
      'GET is safe and cacheable; PUT and DELETE are idempotent; POST is neither.',
      'Use status codes that mean what they say, and put errors in the status, not only the body.',
      'Paginate with cursors for large collections; offsets get slow and inconsistent.',
    ],
    when: ['Public APIs, CRUD-heavy services, anything that benefits from HTTP caching.'],
    diagram: `GET    /orders?cursor=eyJ...   200  list
POST   /orders                201  create   (not idempotent -> use a key)
GET    /orders/123            200  read     (cacheable)
PUT    /orders/123            200  replace  (idempotent)
DELETE /orders/123            204  remove   (idempotent)`,
    tradeoffs: [
      {
        approach: 'REST',
        gains: ['Universally understood', 'Cache- and proxy-friendly', 'Easy to debug with curl'],
        costs: ['Over- and under-fetching', 'Multiple round trips for composite screens', 'No schema unless you add OpenAPI'],
      },
    ],
    mistakes: ['Tunnelling everything through POST /api and losing caching, retries and readable logs.'],
    related: ['graphql', 'grpc', 'api-gateway', 'idempotency'],
  },
  {
    slug: 'graphql',
    title: 'GraphQL',
    tagline: 'One endpoint, a typed schema, and the client decides what it needs.',
    category: 'communication',
    difficulty: 'Intermediate',
    keywords: ['schema', 'resolver', 'n+1', 'over-fetching', 'persisted query'],
    what: 'GraphQL exposes a typed schema through a single endpoint; clients send a query describing exactly the fields they want and receive precisely that shape.',
    why: 'It solves over-fetching and under-fetching for clients that compose many entities per screen - especially mobile apps on slow networks.',
    how: [
      'The schema defines types and their relationships; resolvers fetch each field.',
      'The client sends one query, the server walks resolvers and assembles the response.',
      'DataLoader-style batching is essential to avoid N+1 database queries.',
      'Depth and complexity limits protect the server from expensive queries.',
    ],
    when: ['Rich clients with many entity relationships.', 'Multiple frontends needing different shapes of the same data.'],
    diagram: `query {
  order(id: "123") {
    total
    customer { name email }
    items { sku quantity }
  }
}
one round trip, exactly these fields`,
    tradeoffs: [
      {
        approach: 'GraphQL',
        gains: ['No over-fetching', 'Strong typing and introspection', 'Frontend iterates without backend changes'],
        costs: [
          'HTTP caching is largely lost (POST to one URL)',
          'N+1 risk in resolvers',
          'Clients can write expensive queries unless limited',
          'More server-side machinery',
        ],
      },
    ],
    mistakes: ['Exposing the whole database as a schema and discovering that a single query can take down the service.'],
    related: ['rest-apis', 'grpc', 'api-gateway'],
  },
  {
    slug: 'grpc',
    title: 'gRPC',
    tagline: 'Binary, schema-first RPC over HTTP/2 for service-to-service calls.',
    category: 'communication',
    difficulty: 'Intermediate',
    keywords: ['protobuf', 'http2', 'streaming', 'rpc', 'contract'],
    what: 'gRPC is a remote procedure call framework using Protocol Buffers for the contract and HTTP/2 for transport, with generated clients and servers in many languages.',
    why: 'Inside a cluster you control both sides. A compact binary format, a generated typed client and multiplexed streams beat hand-written JSON HTTP calls on latency, size and safety.',
    how: [
      'Define services and messages in a .proto file - it is the contract.',
      'Generate client and server stubs; the wire format is compact binary.',
      'HTTP/2 multiplexing allows many concurrent calls over one connection, plus client, server and bidirectional streaming.',
      'Evolve schemas by adding fields with new numbers; never reuse a field number.',
    ],
    when: ['Internal service-to-service communication.', 'Low-latency, high-volume calls.', 'Streaming between services.'],
    diagram: `service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchRequest) returns (stream Order);
}
-> generated typed clients, binary frames, one HTTP/2 connection`,
    tradeoffs: [
      {
        approach: 'gRPC',
        gains: ['Small payloads and low latency', 'Generated clients, compile-time safety', 'Native streaming'],
        costs: ['Not directly callable from a browser without a proxy', 'Harder to inspect than JSON', 'Requires schema tooling in the build'],
      },
    ],
    mistakes: ['Using gRPC for a public API that third parties must integrate with from browsers.'],
    related: ['rest-apis', 'microservices', 'websockets'],
  },
  {
    slug: 'websockets',
    title: 'WebSockets',
    tagline: 'One connection, both directions, kept open.',
    category: 'communication',
    difficulty: 'Intermediate',
    keywords: ['realtime', 'bidirectional', 'connection state', 'fan-out', 'reconnect'],
    what: 'WebSockets upgrade an HTTP connection into a persistent full-duplex channel where server and client can send messages at any time.',
    why: 'Chat, collaborative editing, live dashboards and games need server-initiated messages with low latency, and often client messages at the same rate. Polling for them wastes requests and adds delay; a separate HTTP request per client message adds headers to every one.',
    how: [
      'The client sends an HTTP GET with Upgrade: websocket; the server answers 101 Switching Protocols and the connection becomes a WebSocket.',
      'Both sides send frames (2-14 bytes of header each) until one closes; the server must track every open connection.',
      'Scaling out requires a shared pub/sub layer so any node can reach a user whose socket lives on another node.',
      'Clients must send heartbeats, reconnect with backoff and jitter, and resynchronise missed messages.',
    ],
    when: [
      'Chat, presence, multiplayer state, live collaboration and trading - traffic that flows both ways, often.',
      'Not for one-way updates (Server-Sent Events is simpler) or rare updates (polling is simpler).',
    ],
    advantages: [
      'Delivery in one network hop, with no request to wait for.',
      'Both directions on one connection, a few bytes of framing per message.',
      'Text and binary messages.',
    ],
    diagram: `client --upgrade--> gateway node 2   (connection lives here)
message for user A -> published to Redis/Kafka -> delivered by node 2

Connections are state: the user is pinned to one node for the life of the socket.`,
    tradeoffs: [
      {
        approach: 'WebSockets',
        gains: ['True push in one hop, a few bytes per message', 'Bidirectional on the same connection', 'Binary and text frames'],
        costs: [
          'Connection state makes the tier stateful: pub/sub between nodes, careful deploys',
          'Memory and a file descriptor per open connection',
          'Load balancers, proxies and mobile networks cut long-lived connections - heartbeats and reconnect logic are your job',
        ],
      },
      {
        approach: 'Server-Sent Events',
        gains: ['Plain HTTP, automatic reconnect and resume built in', 'Easy to proxy and debug'],
        costs: ['Server to client only - client messages are separate HTTP requests', 'UTF-8 text only'],
      },
      {
        approach: 'Polling',
        gains: ['Stateless and cacheable, works through anything'],
        costs: ['Delay of half an interval on average', 'Requests scale with clients, not with events'],
      },
    ],
    mistakes: [
      'Forgetting that a deploy drops every connection at once, causing a reconnect storm.',
      'Running two socket nodes with no pub/sub between them, so a message only reaches users on the node that received it.',
      'Treating the socket as a reliable message channel: messages sent while it was down are lost unless you add sequence numbers and replay.',
      'Reaching for WebSockets for one-way updates that Server-Sent Events would carry with less to operate.',
    ],
    related: ['server-sent-events', 'long-polling', 'polling', 'pub-sub', 'stateful-applications'],
    lab: 'realtime',
    labFocus: 'websockets',
    quiz: [
      {
        id: 'ws-1',
        prompt:
          'A chat app streams incoming messages with Server-Sent Events and sends each typed message as an HTTP POST. 10,000 users send 6 messages a minute each. What changes if the app moves to WebSockets?',
        options: [
          'Incoming messages arrive faster, because SSE adds a polling delay',
          'The 1,000 messages a second that users send ride the already-open socket as small frames, instead of 1,000 HTTP requests a second with full headers',
          'The server no longer holds one open connection per user',
          'Nothing changes: both are HTTP requests under the hood',
        ],
        answer: 1,
        explanation:
          'SSE already pushes in one hop, so incoming delay does not improve. What changes is the upstream: with SSE every client message is a separate HTTP request with hundreds of bytes of headers; on a WebSocket it is a frame of a few bytes on the open connection - in the Lab, the HTTP requests drop to zero. Both still hold one connection per user.',
      },
      {
        id: 'ws-2',
        prompt:
          'You run two WebSocket nodes. Alice is connected to node 1, Bob to node 2. Alice sends Bob a message, and node 1 receives it. How does it reach Bob?',
        options: [
          'Node 1 opens its own socket to Bob',
          'Sticky sessions on the load balancer route it to node 2',
          'Node 1 publishes it to a shared pub/sub layer that node 2 subscribes to, and node 2 writes it down the socket of Bob',
          'It cannot: users must be on the same node to talk',
        ],
        answer: 2,
        explanation:
          'Only the node holding the socket of Bob can write to it, so the nodes need a pub/sub layer (Redis, NATS, a broker) between them. Sticky sessions sound right but only decide where a connection lands - they do nothing for a message that was produced on a different node.',
      },
      {
        id: 'ws-3',
        prompt:
          'You deploy by restarting all socket nodes at once. 50,000 clients reconnect with a fixed 1 second retry. What happens, and what is the fix?',
        options: [
          'Nothing notable - reconnects are cheap',
          'The load balancer queues them evenly, so no fix is needed',
          'Clients should switch to polling during deploys',
          'A reconnect storm: 50,000 handshakes land in the same second. Reconnect with exponential backoff and jitter, and drain nodes one at a time',
        ],
        answer: 3,
        explanation:
          'A fixed retry keeps every client in step, so the handshakes, authentication and state resyncs all arrive together. Backoff with jitter spreads them out, and a rolling drain means only a slice of users reconnects at a time. The load balancer does not spread them - it forwards what arrives.',
      },
      {
        id: 'ws-4',
        prompt:
          'A phone switches from wifi to 4G. The chat client still believes its socket is open for several minutes, and messages sent to it in that time never arrive. What should the client do?',
        options: [
          'Send a ping every 20 s and treat two missed pongs as a dead connection; reconnect and ask for everything after the last sequence number it saw',
          'Nothing - TCP reports a dead connection within a second',
          'Open two sockets so one is always alive',
          'Switch to a shorter TCP keep-alive in the browser',
        ],
        answer: 0,
        explanation:
          'A TCP connection whose other end vanished can look alive for a long time, so the application needs its own heartbeat (WebSocket ping/pong frames). Detecting the drop is half of it; the sequence number lets the server replay what was missed. A browser cannot tune TCP keep-alive, and two sockets double the problem.',
      },
      {
        id: 'ws-5',
        prompt:
          'A live dashboard shows order counts. The server sends updates; the browser never sends anything back except an occasional button click. The team proposes WebSockets. What is the simplest option that meets the need?',
        options: [
          'WebSockets, because it is the only true push',
          'Server-Sent Events: one-way push over plain HTTP with reconnect built in, and the rare click as an ordinary request',
          'Polling every 100 ms',
          'Long polling, because it avoids open connections',
        ],
        answer: 1,
        explanation:
          'SSE is also true push, with one hop of delay. For one-way traffic it gives the same delay without a new protocol, and the browser reconnects and resumes on its own. WebSockets would work too, but you would be operating a two-way stateful channel for traffic that goes one way. Long polling still holds one request per client, so it does not avoid open connections.',
      },
      {
        id: 'ws-6',
        prompt:
          'At night the chat is quiet and sockets drop every 60 seconds, with no error on the server. The load balancer has a 60 s idle timeout. What fixes it?',
        options: [
          'A bigger load balancer',
          'Switch the sockets to HTTP/2',
          'Send heartbeat pings more often than the idle timeout (for example every 25 s), or raise the idle timeout above the ping interval',
          'Nothing - clients will reconnect anyway',
        ],
        answer: 2,
        explanation:
          'The balancer sees a silent connection and closes it. A ping every 25 s keeps it busy, and raising the timeout gives room. Letting clients reconnect every minute works in a way, but it turns every quiet minute into a reconnect with a gap where messages can be lost.',
      },
      {
        id: 'ws-7',
        prompt:
          'In the Lab, set WebSockets and 50,000 clients: the connection memory meter is full and red crosses appear as new sockets are turned away. CPU is low. What is the right next step?',
        options: [
          'A faster CPU',
          'Switch to polling every second to free the memory',
          'Lower the event rate',
          'Add socket nodes behind the load balancer and a pub/sub layer between them, so each node holds a share of the sockets',
        ],
        answer: 3,
        explanation:
          'The limit here is state - memory and file descriptors per open connection - not work, so CPU does not help and the event rate barely matters. Polling every second would move the problem to CPU: the Lab shows it far over capacity. More nodes hold more sockets, and pub/sub lets an event reach every node.',
      },
      {
        id: 'ws-8',
        prompt:
          'Some users sit behind a corporate proxy that strips the Upgrade header. What happens when their browser opens a WebSocket?',
        options: [
          'The server never answers 101 Switching Protocols, so the socket never opens - the app needs a fallback such as long polling',
          'The connection opens but is slower',
          'The browser silently tunnels it over SSE',
          'The proxy converts frames to HTTP requests',
        ],
        answer: 0,
        explanation:
          'The upgrade is an HTTP handshake; if an intermediary drops the header, the server sees a plain GET and the handshake fails. Browsers do not fall back on their own - libraries such as Socket.IO do it by starting with, or dropping back to, HTTP long polling.',
      },
      {
        id: 'ws-9',
        prompt:
          'A product manager says: WebSockets run on TCP, so no chat message can ever be lost. When is that wrong?',
        options: [
          'Never - TCP retransmits everything',
          'Only when the server runs out of memory',
          'When the connection drops: anything sent while it was down, or still in a buffer when it broke, is gone unless messages carry sequence numbers that the client uses to ask for a replay',
          'Only on HTTP/1.1',
        ],
        answer: 2,
        explanation:
          'TCP keeps bytes in order within one connection. It says nothing about messages sent between one connection and the next. Production chat adds sequence numbers, replay from storage, acknowledgements and idempotent message ids on top of the socket.',
      },
      {
        id: 'ws-10',
        prompt:
          'A user is removed from a private channel. Their socket was authenticated when it opened two hours ago and is still connected. What is the risk?',
        options: [
          'None - authentication covers the whole connection',
          'The socket keeps receiving the channel until it closes. Re-check authorisation for sensitive messages, or close the socket when access is revoked',
          'The socket closes by itself when permissions change',
          'The browser re-sends the cookie on every frame',
        ],
        answer: 1,
        explanation:
          'Cookies and tokens are checked once, at the upgrade. After that, frames carry no headers, so a revoked user keeps getting whatever the server sends until someone closes the socket or checks access per message.',
      },
      {
        id: 'ws-11',
        prompt:
          'A trading feed pushes 200 price updates a second. A client on a weak mobile link can read only 50. What happens on the server if nothing is done?',
        options: [
          'The extra updates are dropped by TCP',
          'The client slows the feed for every other client',
          'Nothing - WebSockets have flow control that drops old prices',
          'The send buffer for that socket grows until memory runs out; the server needs backpressure - coalesce to the latest price, drop, or disconnect the slow client',
        ],
        answer: 3,
        explanation:
          'TCP does not drop data; it slows the sender, so unsent messages pile up in the buffer of the server for that connection. WebSockets add no policy for this. For prices, sending only the latest value is the usual fix; for chat, you disconnect and let the client replay.',
      },
    ],
  },
  {
    slug: 'server-sent-events',
    title: 'Server-Sent Events',
    tagline: 'A one-way stream of updates over ordinary HTTP.',
    category: 'communication',
    difficulty: 'Beginner',
    keywords: ['sse', 'eventsource', 'streaming', 'reconnect', 'last-event-id'],
    what: 'SSE keeps an HTTP response open and streams UTF-8 text events from server to client, with built-in reconnection and event ids.',
    why: 'Many "real-time" features only need server-to-client updates. SSE gives you that with no new protocol, no upgrade, and automatic reconnect and resume in the browser.',
    how: [
      'The client opens an EventSource; the server responds with Content-Type: text/event-stream and keeps writing.',
      'Each event may carry an id; after a drop the browser reconnects and sends Last-Event-ID, so the server can resume from there.',
      'A comment line (starting with a colon) every 15-30 s keeps proxies from closing a quiet stream.',
      'Serve it over HTTP/2: on HTTP/1.1 a browser allows only about six connections per domain, and every stream holds one.',
    ],
    when: [
      'Notifications, live counters, job progress, price tickers, log tailing - updates that flow one way.',
      'Not when the client sends often (use WebSockets) or needs binary frames.',
    ],
    advantages: [
      'Delivery in one network hop over plain HTTP.',
      'Reconnect and resume-from-last-id handled by the browser.',
      'Readable with curl; proxies and logs already understand it.',
    ],
    diagram: `GET /events            HTTP/1.1
Accept: text/event-stream

id: 42
event: order.updated
data: {"id":"123","status":"shipped"}`,
    tradeoffs: [
      {
        approach: 'SSE',
        gains: ['Simple, HTTP-native', 'Automatic reconnect and resume', 'Easy to proxy and debug'],
        costs: [
          'Server to client only - client messages are separate HTTP requests',
          'UTF-8 text only',
          'Still one long-lived connection per client, and proxy buffering must be off',
        ],
      },
      {
        approach: 'WebSockets',
        gains: ['Two-way on one connection', 'Binary frames'],
        costs: ['A second protocol to run', 'Reconnect and resume are yours to write'],
      },
      {
        approach: 'Polling',
        gains: ['Stateless and cacheable'],
        costs: ['Half an interval of delay on average', 'Most answers carry nothing new'],
      },
    ],
    mistakes: [
      'Leaving proxy buffering on (nginx buffers by default), so the stream looks dead.',
      'Serving several streams per page over HTTP/1.1 and hitting the six-connections-per-domain limit.',
      'Sending events without an id, so a reconnect cannot resume and events are lost.',
      'Running it on a thread-per-request server, where every open stream holds a thread.',
    ],
    related: ['websockets', 'polling', 'long-polling'],
    lab: 'realtime',
    labFocus: 'server-sent-events',
    quiz: [
      {
        id: 'sse-1',
        prompt:
          'An SSE order-status stream works when you curl the app directly. Behind nginx, the browser receives nothing at all for minutes. What is the most likely cause?',
        options: [
          'nginx buffers the response and waits for it to finish, which it never does - disable buffering for that route (proxy_buffering off or X-Accel-Buffering: no)',
          'Browsers do not support SSE behind a proxy',
          'The events need to be binary',
          'The client must poll the stream',
        ],
        answer: 0,
        explanation:
          'nginx buffers upstream responses by default, which is fine for normal pages and fatal for a response that never ends. SSE is plain HTTP, so proxies do pass it - once buffering is off for that route.',
      },
      {
        id: 'sse-2',
        prompt:
          'Your site serves over HTTP/1.1 and each page opens one EventSource. A user opens seven tabs, and the seventh one never finishes loading. Why?',
        options: [
          'The server allows only six streams per user',
          'EventSource can only be used once per tab',
          'On HTTP/1.1 a browser allows about six connections per domain, and six open streams hold all of them. Serving over HTTP/2 lets many streams share one connection',
          'Seven streams exceed the memory of the browser',
        ],
        answer: 2,
        explanation:
          'Every open stream holds one of the few HTTP/1.1 connections the browser allows per domain, across all its tabs. Over HTTP/2 the streams are multiplexed on one connection, with about 100 allowed by default. The server has no such limit.',
      },
      {
        id: 'sse-3',
        prompt:
          'The connection of a client drops for 10 seconds. Events 1043, 1044 and 1045 are published in that time; the last event it got was 1042. How does it get them?',
        options: [
          'It cannot - SSE is fire and forget',
          'The browser reconnects on its own and sends Last-Event-ID: 1042; the server replays 1043-1045 from storage',
          'The client must reload the page',
          'The proxy replays them from its buffer',
        ],
        answer: 1,
        explanation:
          'EventSource remembers the last id it saw and sends it in the Last-Event-ID header on reconnect. The server still has to keep recent events and replay from that id - which only works if every event was sent with an id.',
      },
      {
        id: 'sse-4',
        prompt:
          'A notification stream goes quiet for long stretches, and the load balancer closes it after 60 s without traffic. What is the usual fix?',
        options: [
          'Switch to WebSockets, which never time out',
          'Send a fake event every second',
          'Ask users to refresh',
          'Send a comment line (": keep-alive") every 15-30 s, so the connection is never idle long enough to be cut',
        ],
        answer: 3,
        explanation:
          'Lines starting with a colon are ignored by EventSource but count as traffic for the proxy. WebSockets hit the same idle timeout and need pings for the same reason. A fake event every second would work but wakes every client for nothing.',
      },
      {
        id: 'sse-5',
        prompt:
          'A job-progress stream ends when the job is done: the server sends a final event and closes the response. The browser keeps reconnecting forever. What stops it?',
        options: [
          'Answer the reconnect with HTTP 204 No Content (or call close() on the EventSource in the client when the final event arrives)',
          'Send the retry field with a value of 0',
          'Close the TCP connection harder',
          'Return 500 so the browser gives up',
        ],
        answer: 0,
        explanation:
          'EventSource treats a closed stream as a dropped connection and reconnects - that is the feature. The spec says a 204 No Content tells it to stop. Retry 0 makes it reconnect at once, not stop.',
      },
      {
        id: 'sse-6',
        prompt:
          'In the Lab, pick Server-Sent Events with 10,000 clients and raise Client messages to 30 a minute. HTTP requests jump to about 5,000 a second and CPU turns red. Why?',
        options: [
          'The stream reconnects on every message',
          'The stream is one-way, so each message a client sends is a separate HTTP POST with its own headers; at this rate WebSockets would carry them as frames on the open connection',
          'SSE resends every event to every client twice',
          'The server has to parse the event stream',
        ],
        answer: 1,
        explanation:
          '10,000 clients times 30 messages a minute is 5,000 POSTs a second, each a full request. That is fine for an occasional click and expensive for chat-rate traffic, which is exactly where WebSockets earns its extra complexity.',
      },
      {
        id: 'sse-7',
        prompt:
          'A voice feature must push 50 small binary audio frames a second to the browser. Which fits?',
        options: [
          'SSE, as-is - it streams bytes',
          'Polling every 20 ms',
          'WebSockets, which carry binary frames; SSE is UTF-8 text only, so the audio would have to be base64-encoded, about a third bigger',
          'Long polling',
        ],
        answer: 2,
        explanation:
          'An event stream must be UTF-8 text. You can base64 binary into it, at about 33 percent extra size and an encode and decode for every frame. WebSockets have binary frames. Polling at 20 ms would be 50 requests a second per client.',
      },
      {
        id: 'sse-8',
        prompt:
          'The API runs on a server with a pool of 200 threads, one per request. You add an SSE stream and 5,000 users open it. What happens?',
        options: [
          'Nothing - SSE is just HTTP',
          'The server compresses the streams',
          'The streams share one thread',
          'The first 200 streams take every thread and hold them; everything else, including normal API calls, queues. Streams need an async or event-driven server',
        ],
        answer: 3,
        explanation:
          'A stream is a request that does not end, so on a thread-per-request server it holds its thread forever. Event-driven servers (Node, Go, async Python, Netty) keep a waiting stream as a cheap task and handle tens of thousands.',
      },
      {
        id: 'sse-9',
        prompt:
          'In the Lab, 10,000 clients poll every 5 s for 6 events a minute. You switch to Server-Sent Events. What changes?',
        options: [
          'Average delay drops from about 2.5 s to about one hop, HTTP requests drop from 2,000 a second to almost none, and the server now holds 10,000 open connections',
          'Nothing changes except the delay',
          'HTTP requests double, because every event is a request',
          'The server holds fewer connections than before',
        ],
        answer: 0,
        explanation:
          'Polling pays for freshness in requests: 10,000 clients every 5 s is 2,000 a second, most of them answering "nothing new". SSE removes the requests and the wait, and pays in open connections instead - the memory meter moves, the CPU meter drops.',
      },
      {
        id: 'sse-10',
        prompt:
          'You run the SSE endpoint on three nodes. A worker finishes a job and must notify the user, whose stream is open on node 3. How does the event get there?',
        options: [
          'The worker calls the browser directly',
          'The worker publishes to a pub/sub channel (for example Redis) that every node subscribes to; node 3 writes it into the open stream',
          'The load balancer broadcasts it',
          'The user polls node 3',
        ],
        answer: 1,
        explanation:
          'As with WebSockets, only the node holding the open response can write to it. A pub/sub layer lets any producer reach whichever node that is. The load balancer only forwards requests; it has no way to send into a response.',
      },
    ],
  },
  {
    slug: 'polling',
    title: 'Polling',
    tagline: 'Ask again every N seconds - simple, wasteful, and sometimes correct.',
    category: 'communication',
    difficulty: 'Beginner',
    keywords: ['interval', 'freshness', 'load', 'jitter', 'etag', '304'],
    what: 'The client repeatedly requests the current state on a fixed interval.',
    why: 'It needs no special infrastructure and survives any network. For data that changes rarely and tolerates delay, it is the cheapest thing that works.',
    how: [
      'Pick an interval from the freshness requirement, not from habit: average delay is half the interval.',
      'Request rate is clients divided by interval, whether or not anything changed.',
      'Add jitter so clients do not synchronise into a spike.',
      'Use ETag / If-None-Match so unchanged responses cost a cheap 304.',
    ],
    when: [
      'Data that changes rarely, where a delay of seconds or minutes is fine.',
      'When the server must stay stateless, or the endpoint can be cached at a CDN.',
      'Not when updates must arrive within a second, or the client count is large and the interval short.',
    ],
    advantages: [
      'Stateless: any server can answer any poll.',
      'Cacheable, and works through every proxy and firewall.',
      'Trivial to build and debug.',
    ],
    diagram: `10,000 clients polling every 5 s = 2,000 req/sec
                even when nothing changed
With ETags most of those are 304 Not Modified (cheap, but still requests)`,
    tradeoffs: [
      {
        approach: 'Short interval',
        gains: ['Fresher data'],
        costs: ['Load scales with client count, not with change rate'],
      },
      {
        approach: 'Long interval',
        gains: ['Low load'],
        costs: ['Users see stale data for up to one interval'],
      },
      {
        approach: 'Push (long polling, SSE, WebSockets)',
        gains: ['Delay of about one network hop', 'Almost no wasted requests'],
        costs: ['One open connection per client', 'A stateful server tier to operate'],
      },
    ],
    mistakes: [
      'Every client polling on the same second boundary, creating a periodic thundering herd.',
      'Choosing a 1 s interval for data that changes once an hour.',
      'Returning the full payload on every poll instead of a 304 or only what changed since a cursor.',
      'Polling from background tabs nobody is looking at.',
    ],
    related: ['long-polling', 'server-sent-events', 'websockets'],
    lab: 'realtime',
    labFocus: 'polling',
    quiz: [
      {
        id: 'poll-1',
        prompt:
          '10,000 clients poll every 5 s. The data changes about once a minute. How many requests does the server answer, and how many carry something new?',
        options: [
          'About 170 a second, all useful',
          'About 2,000 a second, and only about 1 in 12 carries a change',
          'About 2,000 a second, and about half carry a change',
          'About 10,000 a second, all useful',
        ],
        answer: 1,
        explanation:
          '10,000 / 5 s = 2,000 requests a second, whatever the data does. Each client sees the change once a minute and asks 12 times a minute, so 11 of every 12 answers say "nothing new". The Lab shows the same split as wasted responses.',
      },
      {
        id: 'poll-2',
        prompt: 'The product manager wants updates within 1 s instead of 5 s. The client count stays at 10,000. What does that cost?',
        options: [
          'Nothing - the server answers the same number of requests',
          'Twice the requests',
          'Five times the requests: 10,000 a second instead of 2,000, for an average delay of 0.5 s instead of 2.5 s',
          'Fewer requests, because each one is fresher',
        ],
        answer: 2,
        explanation:
          'Request rate is clients divided by interval, so a 5x shorter interval is 5x the requests. Average delay is half the interval. In the Lab, drag Poll interval from 5 s to 1 s and watch the CPU cross 100% while the event rate stays the same.',
      },
      {
        id: 'poll-3',
        prompt:
          'After a deploy, every client restarted at the same moment. The average load looks fine, but the server times out in a spike every 30 s. What is the fix?',
        options: [
          'Randomise each interval by plus or minus 10-20 percent (jitter) so the clients spread out',
          'A shorter interval, so the spikes are smaller',
          'A bigger server sized for the spike',
          'Restart the clients again',
        ],
        answer: 0,
        explanation:
          'Clients that start together poll together forever. Jitter breaks the lockstep and the same average load arrives smoothly. A shorter interval makes more, not smaller, spikes; a bigger server pays for a peak you created.',
      },
      {
        id: 'poll-4',
        prompt: 'You add ETag and If-None-Match to a polled endpoint. What changes?',
        options: [
          'Clients stop polling until the data changes',
          'The request rate halves',
          'Nothing, unless a CDN is in front',
          'Unchanged answers become a 304 with no body - still one request per poll, but far less bandwidth, and little server work if the ETag is cheap to compute',
        ],
        answer: 3,
        explanation:
          'A conditional request makes the answer cheap, not the question: the client still asks every interval. In the Lab, the ETag / 304 toggle lowers CPU while the HTTP requests count stays exactly the same.',
      },
      {
        id: 'poll-5',
        prompt:
          'A warehouse stock report updates once an hour. 500 staff look at it, and 5 minutes of staleness is fine. Which approach fits?',
        options: [
          'WebSockets, so the update is instant',
          'Polling every minute or so - stateless, cacheable, about 8 requests a second, nothing to operate',
          'Long polling with a 30 s hold',
          'Polling every second',
        ],
        answer: 1,
        explanation:
          'Rare updates and relaxed freshness are the case polling is made for. 500 clients every 60 s is about 8 requests a second. A socket per user would cost an open connection each to deliver one message an hour.',
      },
      {
        id: 'poll-6',
        prompt:
          'Measurements show 60 percent of open dashboards sit in background tabs, polling every 10 s. What is the cheapest large saving?',
        options: [
          'A longer interval for everyone',
          'Move everyone to WebSockets',
          'Pause polling while the tab is hidden (document.hidden) and poll once when it becomes visible again',
          'A faster database',
        ],
        answer: 2,
        explanation:
          'Nobody is looking at a hidden tab, so its polls buy no freshness at all. Pausing them removes about 60 percent of the load without making the visible dashboards any staler. A longer interval for everyone would.',
      },
      {
        id: 'poll-7',
        prompt: 'Each poll returns the full list of 2,000 orders (120 KB), although usually only one or two changed. What helps most?',
        options: [
          'Delta polling: ask for changes since a cursor ("since=1042") and return only what is new',
          'Gzip the response',
          'Poll less often',
          'Split the list into two endpoints',
        ],
        answer: 0,
        explanation:
          'A cursor makes the answer the size of the change, lets a client catch up after being offline, and lets the server read from an index. Gzip shrinks the payload but still sends 2,000 orders; polling less often trades freshness.',
      },
      {
        id: 'poll-8',
        prompt:
          'A public live-score endpoint is the same for every user. 50,000 fans poll it every 5 s. How do you cut the load on the origin without changing the interval?',
        options: [
          'Ask fans to poll less',
          'Add more origin servers',
          'Switch to POST requests',
          'Cache it at the CDN for a few seconds (s-maxage=5), so each edge asks the origin about once every 5 s and answers the fans itself',
        ],
        answer: 3,
        explanation:
          'Because the answer is identical for everyone and a few seconds old is fine, one origin request can serve thousands of polls. That is a property of polling a plain GET that push techniques do not have. POST responses are not cached.',
      },
      {
        id: 'poll-9',
        prompt: 'Clients poll every 30 s. How stale can the data on screen be?',
        options: [
          'At most 15 s',
          'Up to about 30 s, and 15 s on average',
          'At most 1 s',
          'It is never stale with ETags',
        ],
        answer: 1,
        explanation:
          'A change that lands right after a poll waits a whole interval for the next one; a change just before a poll waits almost nothing. On average that is half the interval. ETags change the cost of a poll, not when it happens.',
      },
      {
        id: 'poll-10',
        prompt:
          'In the Lab, 10,000 clients poll every 1 s for 6 events a minute and the server is at about 200 percent CPU. Which single change brings it under capacity without making updates any staler?',
        options: [
          'Raise the poll interval to 5 s',
          'Lower the number of events per minute',
          'Turn on ETag / 304, so the 9 in 10 unchanged answers cost a fraction of a full response',
          'Add client messages',
        ],
        answer: 2,
        explanation:
          'Most polls find nothing new, and with a cheap ETag a 304 costs about a third of a full answer in the model - enough to drop CPU to about 70 percent while the interval, and so the delay, stays at 1 s. A 5 s interval also works but makes the average delay five times longer.',
      },
    ],
  },
  {
    slug: 'long-polling',
    title: 'Long Polling',
    tagline: 'Hold the request open until there is something to say.',
    category: 'communication',
    difficulty: 'Intermediate',
    keywords: ['hanging get', 'timeout', 'fallback', 'realtime', 'cursor'],
    what: 'The client sends a request and the server holds it open until data is available or a timeout fires; the client then immediately issues the next request.',
    why: 'It gives near-real-time delivery over plain HTTP, where every response completes normally - which is why it remains the fallback when WebSockets are blocked or streams are buffered by intermediaries.',
    how: [
      'Server parks the request (no thread blocking in async runtimes) and completes it when an event arrives.',
      'A hold timeout (30 s is a common safe value) kept below every proxy idle timeout, so the request is never cut silently.',
      'Every request carries a cursor ("since=1042"), so events that land between two requests are returned at once, not lost.',
      'The server wakes waiting requests from pub/sub, not by querying the database per waiter.',
    ],
    when: [
      'Near-real-time updates where WebSockets are blocked, or proxies buffer streamed responses.',
      'A fallback rung below WebSockets and SSE.',
      'Not when events arrive several times a second per client - each one costs a full request and response.',
    ],
    advantages: [
      'Delay close to one network hop, over plain HTTP.',
      'Each response completes, so it passes proxies that break streams.',
      'Idle clients cost one request per hold timeout, not one per poll interval.',
    ],
    diagram: `client -> GET /updates?since=1042  (held open)
                         ...event...
       <- 200 {events}   (client immediately re-requests)`,
    tradeoffs: [
      {
        approach: 'Long polling',
        gains: ['Near real time with ordinary HTTP', 'Passes through nearly all proxies', 'Few empty answers'],
        costs: ['A held request per client', 'A full request and response per event', 'Needs an async server and aligned timeouts'],
      },
      {
        approach: 'Short polling',
        gains: ['Stateless, cacheable, nothing held open'],
        costs: ['Half an interval of delay on average', 'Most answers carry nothing new'],
      },
      {
        approach: 'SSE or WebSockets',
        gains: ['A few bytes per event, however often events come'],
        costs: ['A long-lived stream or socket that some proxies buffer or block'],
      },
    ],
    mistakes: [
      'A hold time longer than the idle timeout of a proxy or load balancer on the path, so every long poll dies as an error.',
      'No cursor, so events published between two requests are lost.',
      'Running it on a thread-per-request server, where every waiting client holds a thread.',
      'Waking waiters by querying the database every few hundred milliseconds per client.',
    ],
    related: ['polling', 'websockets', 'server-sent-events'],
    lab: 'realtime',
    labFocus: 'long-polling',
    quiz: [
      {
        id: 'lp-1',
        prompt:
          'The server holds long polls for 60 s. The load balancer closes connections that are idle for 30 s. What do users see?',
        options: [
          'Updates arrive 30 s late',
          'Every quiet long poll is cut at 30 s and fails as an error; set the hold to about 25 s, under every timeout on the path',
          'Nothing - the load balancer waits for the server',
          'The server answers twice',
        ],
        answer: 1,
        explanation:
          'A held request is idle until the server answers, so any proxy with a shorter idle timeout kills it first. The hold must be the shortest timeout on the path, with margin. The client retries after the error, so it looks like a flaky connection rather than a clean timeout.',
      },
      {
        id: 'lp-2',
        prompt:
          'Your server gives each request its own thread from a pool of 200. 5,000 clients start long polling. What happens?',
        options: [
          'The first 200 waiting requests hold every thread; all other requests queue until a hold ends. Waiting requests need an async server where they are cheap suspended tasks',
          'Nothing - a held request uses no resources',
          'The requests are answered faster',
          'The server switches to WebSockets',
        ],
        answer: 0,
        explanation:
          'On a thread-per-request model, waiting is blocking. Node, Go, Netty or async Python park a waiting request as a small task, so tens of thousands cost memory but almost no CPU. That is the server requirement people underestimate.',
      },
      {
        id: 'lp-3',
        prompt:
          'A response carrying event 1044 is on its way to the client. Event 1045 is published a few milliseconds later, before the next request arrives. How does the client get 1045?',
        options: [
          'It does not - it was published while nobody was listening',
          'The server pushes it down the closed connection',
          'The next request says "since=1044", and the server answers at once with 1045 from storage',
          'The client waits for the next event and gets both',
        ],
        answer: 2,
        explanation:
          'Between one response and the next request nothing is held, so nothing can be pushed. The cursor makes that gap harmless: the next request asks for everything after the last event it has. Without a cursor, 1045 would be lost - the cursor, not the holding, makes long polling correct.',
      },
      {
        id: 'lp-4',
        prompt:
          'To wake waiting requests, each one queries the database every 200 ms for new rows. 10,000 clients are waiting. What does that cost?',
        options: [
          'Almost nothing - the requests are waiting anyway',
          'One query per event',
          '10,000 queries a second in total',
          '50,000 queries a second - more load than short polling. Wait on a pub/sub subscription or notification instead',
        ],
        answer: 3,
        explanation:
          '10,000 waiters times 5 checks a second is 50,000 queries a second, which is short polling moved inside the server at a 200 ms interval. A pub/sub subscription wakes a waiter only when there is news.',
      },
      {
        id: 'lp-5',
        prompt:
          'In the Lab, 10,000 clients get 6 events a minute. You switch from polling every 5 s to long polling with a 30 s hold. What does the server pay instead of the wasted requests?',
        options: [
          'About 10,000 requests held open at any moment',
          'Twice as many HTTP requests',
          'A longer delay per event',
          'Nothing - long polling is free',
        ],
        answer: 0,
        explanation:
          'HTTP requests drop from 2,000 to about 1,000 a second, wasted answers from about 1,200 to about 50, and the delay from about 2.5 s to about one hop. The cost moves to open connections: nearly every client has a request parked at the server.',
      },
      {
        id: 'lp-6',
        prompt:
          'In the Lab, keep long polling and raise Events to 120 a minute (2 a second). HTTP requests climb to about 17,000 a second and CPU goes red. Why?',
        options: [
          'The hold timeout is too long',
          'Each event ends the held request, so every client makes a new full request for almost every event. At this rate a stream (SSE or WebSockets) costs a few bytes per event instead',
          'Long polling resends every event twice',
          'The clients are polling as well',
        ],
        answer: 1,
        explanation:
          'Long polling costs one request and response per delivery. With rare events that is nothing; with frequent events it becomes the dominant cost. A persistent stream pays for the connection once and then a few bytes per event.',
      },
      {
        id: 'lp-7',
        prompt:
          'A corporate network blocks WebSocket upgrades, and its proxy buffers streamed responses until they finish. The notification bell must update within a second. What works?',
        options: [
          'WebSockets over port 443',
          'Server-Sent Events',
          'Polling every 30 s',
          'Long polling: each held request ends with a normal, complete response, which the proxy passes on at once',
        ],
        answer: 3,
        explanation:
          'A buffering proxy holds an SSE stream until it ends, which it never does. A long poll response does end, so buffering only delays it until it is complete - which is immediately. Polling every 30 s misses the one-second target.',
      },
      {
        id: 'lp-8',
        prompt:
          'Five events were published while a client was between two long polls. What should its next request return?',
        options: [
          'Only the newest event',
          'The first event, then the client asks four more times',
          'All five in one response, found through the cursor - batching them cuts the per-event cost',
          'Nothing, and the client waits for the next event',
        ],
        answer: 2,
        explanation:
          'The cursor asks for everything after the last event the client has, so all five come back at once. One request for five events is far cheaper than five round trips, and nothing is skipped.',
      },
      {
        id: 'lp-9',
        prompt:
          'Nothing happens for an hour. How many requests does one idle client make with a 30 s hold, compared with polling every 5 s?',
        options: [
          'The same number',
          'About 120 with long polling (one per hold timeout) against 720 with polling',
          'None with long polling',
          'More with long polling, because each request is held',
        ],
        answer: 1,
        explanation:
          'An idle long poll ends only at the hold timeout: 3,600 s / 30 s = 120 empty answers an hour. Polling every 5 s makes 720. Long polling is not zero, which is why idle clients still show a small number of wasted responses in the Lab.',
      },
      {
        id: 'lp-10',
        prompt:
          'A server restart drops 20,000 held long polls. Every client re-requests the moment its request fails. What should the client do instead?',
        options: [
          'Wait a small random delay, growing with each failure, before asking again',
          'Re-request immediately - that is how long polling works',
          'Stop long polling until the page reloads',
          'Switch to polling every second',
        ],
        answer: 0,
        explanation:
          'Re-requesting at once is right after a normal response, and wrong after an error: 20,000 clients hitting a server that just restarted is a reconnect storm. Backoff with jitter spreads them out. Polling every second would be 20,000 requests a second from then on.',
      },
    ],
  },
];
