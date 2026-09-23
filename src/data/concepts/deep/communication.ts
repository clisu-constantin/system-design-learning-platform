import type { DepthMap } from './types';

export const communicationDepth: DepthMap = {
  'rest-apis': {
    analogy: {
      title: 'A well-organised filing system anyone can navigate',
      body:
        'Every folder has a predictable address, and the verbs are the same everywhere: look at it, replace it, remove it. Once you have used one drawer you can use any drawer, because the naming and the operations do not change per department. That predictability is what REST sells - not a technology, a set of conventions that make an unfamiliar API guessable.',
    },
    deepDive: [
      {
        heading: 'Resources and verbs: the conventions that carry the weight',
        paragraphs: [
          'REST models the API as nouns - resources with addresses - and uses the HTTP methods as the verbs. /orders/42 is a thing; GET reads it, PUT replaces it, PATCH modifies part of it, DELETE removes it, and POST /orders creates a new one. Actions become resources rather than endpoints: cancelling an order is POST /orders/42/cancellation, not POST /cancelOrder.',
          'The payoff is that infrastructure understands your API for free. A GET is cacheable by browsers, CDNs and proxies because it is defined as safe. A PUT or DELETE can be retried safely because it is defined as idempotent. Break those conventions - a GET that mutates, a POST used for reads - and every layer between you and the client starts behaving wrongly.',
          'Good resource naming is plural nouns, hierarchical where there is real containment, and flat where there is not. /users/42/orders is fine; /users/42/orders/9/items/3/product/reviews is a sign the hierarchy has become a maze. Past two levels, prefer a top-level resource with query parameters.',
        ],
        code: {
          caption: 'Method semantics, and why infrastructure cares',
          body: `method   safe  idempotent  cacheable   typical use
GET      yes   yes         yes         read
HEAD     yes   yes         yes         metadata only
PUT      no    yes         no          full replace
DELETE   no    yes         no          remove
PATCH    no    no*         no          partial update
POST     no    no          rarely      create, or anything else

* PATCH can be made idempotent with an If-Match / version check.
A GET with side effects will eventually be replayed by a proxy or a prefetcher.`,
        },
      },
      {
        heading: 'Status codes, errors and the contract with clients',
        paragraphs: [
          'Use the codes as specified: 200 for a successful read, 201 with a Location header for a creation, 204 for a successful action with no body, 400 for malformed input, 401 for not authenticated, 403 for authenticated but not allowed, 404 for absent, 409 for a conflict, 422 for semantically invalid, 429 for rate limited, 5xx for your failures.',
          'The 4xx/5xx split is operationally important. 4xx means the client should change something and should generally not retry unchanged; 5xx means the server failed and a retry may work. Monitoring, alerting and client retry logic all key off this, so returning 500 for a validation error creates false pages and makes clients retry something that can never succeed.',
          'Give errors a consistent machine-readable body - a stable error code, a human message, and where relevant a field-level breakdown. Clients need to branch on something that does not change when you improve the wording, and RFC 9457 (problem+json, which replaced RFC 7807) is a perfectly good shape to adopt rather than invent.',
        ],
        bullets: [
          '201 Created + Location for creation; 202 Accepted when the work is asynchronous.',
          '409 for "the state has moved on"; 422 for "the input makes no sense".',
          '429 with Retry-After so clients back off correctly instead of guessing.',
          'Stable error codes in the body - clients must not parse your prose.',
        ],
      },
      {
        heading: 'The practical problems: versioning, pagination, chattiness',
        paragraphs: [
          'Versioning is unavoidable once external clients exist. URL versioning (/v1/orders) is the most visible and easiest to route; header versioning is cleaner in theory and harder to debug. Either way, the real discipline is to make additive changes wherever possible - new optional fields break nobody - and reserve version bumps for genuine breaking changes.',
          'Pagination should be cursor-based for anything large or live. Offset pagination (?page=5) re-scans rows and skips or duplicates items when the underlying data changes between pages; a cursor encoding the last seen sorted key is stable and stays fast at any depth.',
          'Chattiness is the structural weakness. A screen needing related resources makes one call per resource, and the calls come in waves: the items can only be requested once the orders have arrived with their ids. Each wave costs a full round trip, which on a mobile network is most of the perceived latency. The REST-native answers are sparse fieldsets (?fields=), embedding related resources (?include=), and a purpose-built aggregate endpoint for the screen - which is exactly the pressure that produced GraphQL and BFFs.',
        ],
      },
    ],
    examples: [
      {
        title: 'Designing the endpoints for an order flow',
        setup:
          'A team needs: place an order, cancel it, list a customer orders, and add a note. They start with verbs in URLs and refactor to resources.',
        walkthrough: [
          'First draft: POST /createOrder, POST /cancelOrder, GET /getOrdersForCustomer, POST /addNoteToOrder. Every endpoint is a bespoke RPC and nothing is cacheable or retryable.',
          'Refactor to resources: POST /orders, GET /customers/42/orders, POST /orders/42/notes.',
          'Cancellation as a resource: POST /orders/42/cancellation. It returns 201 the first time and 409 if the order already shipped - a clear, honest contract.',
          'Idempotency: POST /orders accepts an Idempotency-Key header, so a mobile retry after a timeout returns the original order rather than creating a second one.',
          'Listing: GET /customers/42/orders?limit=20&cursor=... with a cursor rather than a page number, so new orders arriving do not shift the pages.',
          'Caching: GET /orders/42 returns an ETag; the mobile app sends If-None-Match and usually gets a 304 with no body.',
        ],
        result:
          'The same four features became guessable, cacheable and safe to retry - purely by following conventions the rest of the stack already understands. That is the whole practical value of REST.',
      },
    ],
    jargon: [
      { term: 'Resource', plain: 'A thing with an address. The noun your API is organised around.' },
      { term: 'Safe / idempotent', plain: 'No side effects, and repeating it changes nothing further. Infrastructure relies on both.' },
      { term: 'HATEOAS', plain: 'Responses containing links to the next possible actions. Rarely implemented in practice.' },
      { term: 'Cursor pagination', plain: 'Paging by the last item seen rather than an offset. Stable and fast at depth.' },
      { term: 'ETag / If-None-Match', plain: 'A fingerprint that lets the server answer 304 Not Modified instead of resending.' },
      { term: 'problem+json', plain: 'A standard error body shape, so clients do not each invent one.' },
    ],
    remember: [
      'Nouns in URLs, HTTP methods as verbs - and honour what those methods promise.',
      'A GET with side effects will eventually be replayed by something you do not control.',
      '4xx means the client should change; 5xx means retry may help. Do not blur them.',
      'Cursor pagination over offsets for anything large or changing.',
      'Additive changes over new versions; version only for genuine breaks.',
    ],
  },

  graphql: {
    analogy: {
      title: 'Ordering a la carte instead of set menus',
      body:
        'A set menu gives you everything the kitchen decided, including the soup you will not eat. A la carte means you name exactly the dishes you want, in one order, and get exactly that. The kitchen has more work to do interpreting each order, and a customer can in principle order forty dishes at once - which is why the kitchen has to impose limits.',
    },
    deepDive: [
      {
        heading: 'One endpoint, a typed schema, and the client decides the shape',
        paragraphs: [
          'GraphQL replaces many endpoints with one, plus a schema that declares every type and field. The client sends a query naming the fields it wants, including nested relationships, and receives exactly that shape back. Two problems disappear: over-fetching (receiving fields you do not need) and under-fetching (making three more calls for related data).',
          'The schema is the real asset. It is strongly typed and introspectable, so tooling generates client types, editors autocomplete queries, and breaking changes are detectable automatically. For a large frontend team, that contract is often worth more than the query flexibility.',
          'Evolution works differently too. Instead of versioning the API, you add fields and deprecate old ones, and you can see from real query traffic when a deprecated field has no users left. That is a genuinely better lifecycle than maintaining /v1 and /v2 in parallel.',
        ],
        code: {
          caption: 'One request replacing four',
          body: `query {
  user(id: 42) {
    name
    orders(last: 3) {
      total
      items { product { name price } }
    }
  }
}

REST equivalent: GET /users/42, GET /users/42/orders?limit=3,
then GET /orders/{id}/items per order, then GET /products/{id} per item.
Mobile: 1 request instead of 8+, and 1 round trip
instead of 3 in a row.`,
        },
      },
      {
        heading: 'The N+1 problem and why DataLoader is mandatory',
        paragraphs: [
          'A GraphQL resolver runs per field, so a query asking for 50 orders and each order customer naively executes 1 query for the orders and 50 for the customers. This is the N+1 problem, and in GraphQL it is not an occasional mistake - it is the default behaviour of the execution model.',
          'The standard fix is batching with a per-request loader (DataLoader and its equivalents): resolvers do not query directly, they register a key, and at the end of the tick the loader issues one query for all 50 ids and distributes the results. It also deduplicates repeated keys within the request.',
          'This is why "GraphQL is slow" is usually a misdiagnosis. The transport is fine; the resolver implementation was issuing hundreds of queries. Any serious GraphQL service has batching in place from the first day, plus per-request caching so the same entity is not loaded twice.',
        ],
        bullets: [
          'Use a batching loader for every entity fetched inside a resolver.',
          'Cache per request, so repeated ids in one query cost one lookup.',
          'Watch the query depth - a deeply nested query can explode into enormous work.',
          'Trace resolver time per field; the slow field is rarely the one you expect.',
        ],
      },
      {
        heading: 'What it costs you compared with REST',
        paragraphs: [
          'HTTP caching largely goes away. Most clients send queries as POSTs to a single URL, and CDNs and browser caches do not cache POSTs. The GraphQL over HTTP spec allows GET for queries, and persisted queries (send a short id instead of the query text) make that practical for edge caching; a client-side normalised cache is the other answer. Both are extra machinery that REST gets for free.',
          'Security and cost control need explicit work. A public GraphQL endpoint lets a client request an arbitrarily expensive query, so you need depth limits, complexity scoring, query allow-lists in production, and per-field authorisation - because authorising at the endpoint level no longer means anything when there is one endpoint.',
          'And observability changes shape. Every request is a 200 POST /graphql, so your standard per-endpoint dashboards go blind. You need instrumentation by operation name and by resolver, plus error tracking that understands the partial-success model where a response can carry both data and errors.',
        ],
      },
    ],
    examples: [
      {
        title: 'A mobile screen, before and after',
        setup:
          'A dashboard shows a user, their last 3 orders, the items in each, and the product name for each item. Mobile round trip is 80 ms.',
        walkthrough: [
          'REST: 1 call for the user, 1 for orders, 3 for items, roughly 9 for products - about 14 requests. Sent in parallel wherever the ids allow, they still need 3 round trips in a row (about 240 ms), because items need order ids and products need item data; sent one by one they take over 1 second. And the responses contain many fields the screen never displays.',
          'GraphQL: one query describing the exact tree. One round trip, about 80 ms plus server time, and the payload is roughly a third of the size because unused fields are absent.',
          'Naive server implementation: that one query triggers 1 + 1 + 3 + 9 = 14 database queries - one for the user, one for the orders, one per order for items, one per item for products - and the server is now the bottleneck instead of the network.',
          'With DataLoader: the user is one query, orders one query by user id, items one query by order ids, products one query by product ids. Four database queries in total, one per level.',
          'Guardrails added before going public: max depth 8, complexity budget per request, and persisted queries so only known operations are accepted in production.',
        ],
        result:
          'Requests fell from 14 to 1, round trips from 3 in a row to 1, and database queries from 14 to 4 - but only after batching was added. GraphQL moves work from the network to the server, and the server has to be built for it.',
      },
    ],
    jargon: [
      { term: 'Schema', plain: 'The typed declaration of every type and field. The contract and the tooling source.' },
      { term: 'Resolver', plain: 'The function that produces the value for one field. Runs per field, per object.' },
      { term: 'N+1', plain: 'One query for a list plus one per item. The default failure mode of resolvers.' },
      { term: 'DataLoader', plain: 'A per-request batching and deduplicating loader. Effectively mandatory.' },
      { term: 'Persisted query', plain: 'Sending a hash of a known query instead of its text, enabling GET and edge caching.' },
      { term: 'Query complexity', plain: 'A computed cost per query, used to reject expensive ones before running them.' },
    ],
    remember: [
      'The client names the fields, so over-fetching and under-fetching both disappear.',
      'The typed schema is often worth more than the flexibility, especially for big frontends.',
      'Resolvers cause N+1 by default - batching is not optional.',
      'You lose free HTTP caching and per-endpoint metrics; plan replacements.',
      'A public endpoint needs depth limits, complexity budgets and per-field authorisation.',
    ],
  },

  grpc: {
    analogy: {
      title: 'A shared, pre-agreed order form',
      body:
        'Instead of writing a letter in prose and hoping the other office interprets it, both sides agree on a numbered form in advance. Filling it in is fast, it is compact to send, and nobody can submit a form with a field the other side does not know about. If the form changes, both offices must be given the new template - which is the cost of the efficiency.',
    },
    deepDive: [
      {
        heading: 'Contract first, binary on the wire',
        paragraphs: [
          'You write a .proto file declaring services, methods and message types, and a code generator produces client and server code in every supported language. The contract exists before the code and is shared, so an incompatible call fails at compile time in the client rather than at runtime in production.',
          'On the wire, messages are Protocol Buffers: a compact binary encoding where field names are replaced by numbers. Payloads are often several times smaller than the same data as JSON - numbers and field names shrink the most, long strings hardly at all - and parsing is much cheaper because there is no text to scan. Over HTTP/2, many calls multiplex on one connection with header compression.',
          'The result is the natural choice for internal service-to-service traffic: low latency, low CPU, strongly typed, with generated clients that remove a whole category of integration bug. Its weakness is the browser - gRPC needs HTTP/2 framing and trailers that browsers do not expose to page code, so web clients require grpc-web plus a proxy such as Envoy, and get only unary and server-streaming calls.',
          'What protobuf does not change is which fields travel. A method returns its whole response message, so a GetProduct that returns 30 fields sends 30 fields, however compactly. Over-fetching is fixed the same way as anywhere else: design methods around what callers need, or let the caller send a FieldMask listing the fields it wants.',
        ],
        code: {
          caption: 'The contract is the source of truth',
          body: `service Orders {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchRequest) returns (stream OrderEvent);
}

message Order {
  string id    = 1;      // field NUMBERS are the wire format
  int64  total = 2;      // never reuse a number; reserve retired ones
  string note  = 3;
}

Adding a field with a new number is backward compatible.
Changing a number or a type is a breaking change for every client.`,
        },
      },
      {
        heading: 'Four call types, and streaming as a first-class idea',
        paragraphs: [
          'Unary is the familiar request-response. Server streaming sends many messages back for one request - a live feed, a large result set delivered incrementally. Client streaming sends many messages up, useful for uploads or telemetry. Bidirectional streaming keeps both directions open over the same connection.',
          'Streaming is where gRPC pulls clearly ahead of plain REST for internal traffic. A paginated REST endpoint requires the client to loop and the server to re-execute queries; a server stream sends results as they are produced, with backpressure handled by the transport.',
          'Deadlines are also built in rather than bolted on. A client sets a deadline, and gRPC can propagate it through the call chain (on by default in Java and Go, opt-in in C++), so a downstream service knows how long it has left and can abandon work that can no longer be used. That single feature prevents a large class of cascading timeout problems.',
        ],
        bullets: [
          'Unary - normal RPC.',
          'Server streaming - feeds, large results, progress updates.',
          'Client streaming - uploads, batched telemetry.',
          'Bidirectional - chat-like protocols, long-lived coordination.',
          'Deadlines can propagate down the call chain; set one on every call.',
        ],
      },
      {
        heading: 'Schema evolution and the operational realities',
        paragraphs: [
          'Protobuf is designed for compatibility if you follow the rules: only add fields with new numbers, never reuse a retired number, never change a field type, and treat unknown fields as ignorable. Follow them and old clients keep working against new servers indefinitely, which is what makes independent deployment of services possible.',
          'Operationally, the binary format is the main friction. You cannot curl a gRPC endpoint and read the response, so you need grpcurl, server reflection, and logging that decodes messages. Teams that skip that tooling find debugging noticeably harder than with JSON.',
          'Load balancing also differs. gRPC holds long-lived HTTP/2 connections, so a simple L4 balancer pins all calls from one client to one backend, and adding a server receives no traffic. You need either client-side load balancing with service discovery, or an L7 proxy that balances per request - Envoy and modern service meshes exist substantially for this reason.',
        ],
      },
    ],
    examples: [
      {
        title: 'Moving an internal hot path from REST to gRPC',
        setup:
          'A pricing service is called 40,000 times per second by the checkout service. JSON over HTTP/1.1, average payload 4 KB, p99 latency 28 ms.',
        walkthrough: [
          'Measurement first: about 9 ms of the 28 is JSON serialisation and parsing on both sides, and a further 6 ms is connection handling under load.',
          'After moving to gRPC: the same message is roughly 700 bytes, and serialisation drops to under 1 ms on each side.',
          'HTTP/2 multiplexing means one connection per client instance carries all concurrent calls, removing the connection churn entirely.',
          'p99 falls to about 9 ms, and CPU on both services drops by roughly 30 percent - which removes four instances from each side.',
          'New problem: the L4 load balancer pins connections, so one pricing pod receives 60 percent of traffic. Fixed by moving to an L7 proxy that balances per request.',
          'The public API stays REST+JSON. Browsers and third parties keep the readable interface; only the internal hop changed.',
        ],
        result:
          'About five times less bandwidth (4 KB to 700 bytes), three times lower p99 (28 ms to 9 ms) and 30 percent less CPU on an internal path - with a new load balancing requirement as the cost. The usual answer is gRPC inside, REST outside.',
      },
    ],
    jargon: [
      { term: 'Protobuf', plain: 'The binary encoding and schema language gRPC uses.' },
      { term: '.proto file', plain: 'The contract declaring services and messages. Code is generated from it.' },
      { term: 'Field number', plain: 'The wire identity of a field. Never reuse or change one.' },
      { term: 'Deadline', plain: 'A time budget attached to a call and propagated to downstream calls.' },
      { term: 'Server reflection', plain: 'The service describing its own schema at runtime, so tools can call it.' },
      { term: 'grpc-web', plain: 'A browser-compatible variant requiring a proxy to translate.' },
    ],
    remember: [
      'Contract first: the .proto generates both sides and catches mismatches at build time.',
      'Binary plus HTTP/2 means far smaller payloads and far cheaper parsing.',
      'Streaming and propagated deadlines are built in, not add-ons.',
      'Add fields with new numbers; never reuse a number or change a type.',
      'Long-lived connections break naive L4 balancing - use L7 or client-side balancing.',
    ],
  },

  websockets: {
    analogy: {
      title: 'Keeping the phone line open',
      body:
        'Instead of calling, asking one question and hanging up each time, you dial once and leave the line open. Either side can speak at any moment with no new call setup. The cost is a line occupied for as long as the conversation lasts - and if you do that with a hundred thousand people, you need a switchboard built for it.',
    },
    deepDive: [
      {
        heading: 'How a connection becomes a socket',
        paragraphs: [
          'A WebSocket starts life as an ordinary HTTP GET carrying an Upgrade: websocket header. The server answers 101 Switching Protocols, and from that point the same TCP connection stops speaking HTTP and speaks a lightweight message framing instead. That is why it works over port 443 and passes through most firewalls.',
          'After the upgrade the connection is symmetric: either side can send a message at any time, with a few bytes of framing overhead rather than a full set of HTTP headers. Latency is one network trip and nothing else - no DNS, no handshake, no headers.',
          'The price is that the connection is stateful and long-lived. Every connected user occupies a socket and some memory on a specific server, which changes how you scale, how you deploy and how you balance load.',
        ],
        code: {
          caption: 'Overhead per message, why it matters at rate',
          body: `POLLING every 2 s
  request  ~500 bytes of headers + cookies
  response ~300 bytes
  -> ~400 bytes/s per idle user, and up to 2 s of staleness

WEBSOCKET
  handshake once (~500 bytes)
  then 2-14 bytes of framing per message
  -> a few bytes/s per idle user, delivery in ~1 RTT

10,000 users: polling ~4 MB/s of pure overhead; sockets, almost nothing.`,
        },
      },
      {
        heading: 'Scaling stateful connections',
        paragraphs: [
          'A user is connected to one specific server, so that server is the only one that can deliver a message to them directly. If the event that must reach them is produced elsewhere - another service, another socket server - you need a shared pub/sub layer: Redis, NATS or a broker that every socket server subscribes to. This is the standard architecture and it is not optional beyond one instance.',
          'Deploys become a real design consideration. Restarting a socket server disconnects everyone on it, and ten thousand clients reconnecting at once is a thundering herd. Clients must reconnect with exponential backoff and jitter, and the server should drain connections gradually rather than dropping them all at once.',
          'Resource limits matter too. Each connection costs a file descriptor and a memory buffer; tens of thousands per node is achievable with tuned limits and an event-driven server, but the numbers must be measured rather than assumed. Load balancers also need long idle timeouts, or they will silently cut connections that are simply quiet.',
        ],
        bullets: [
          'Pub/sub between socket servers, or a message can only reach users on one node.',
          'Reconnect with exponential backoff and jitter, always.',
          'Send periodic pings; TCP will not tell you a connection is dead quickly.',
          'Raise idle timeouts on load balancers and proxies above your ping interval.',
          'Authenticate at upgrade time, and re-check authorisation for sensitive messages.',
        ],
      },
      {
        heading: 'When not to use one',
        paragraphs: [
          'If updates only flow from server to client, server-sent events do the same job over plain HTTP with automatic reconnection and no new protocol. That covers notifications, live dashboards, progress indicators and feeds - a large share of what people reach for WebSockets to do.',
          'If updates are infrequent or staleness of a few seconds is acceptable, polling is simpler, cacheable and stateless. A socket that delivers one message every ten minutes is paying connection cost for nothing.',
          'Reach for WebSockets when you genuinely need low-latency bidirectional traffic: chat, collaborative editing, multiplayer state, live trading. And be aware you are inheriting responsibilities the framework will not handle for you - message ordering, delivery guarantees, reconnection with state resynchronisation, and backpressure when a client cannot keep up.',
        ],
      },
    ],
    examples: [
      {
        title: 'Chat that survives reconnection',
        setup:
          'A chat feature works perfectly in development and loses messages in production whenever a phone switches between wifi and 4G.',
        walkthrough: [
          'The socket drops silently. The client notices only when it next tries to send, so messages published in between are lost - they were delivered to a socket nobody was holding.',
          'Fix 1: heartbeat. Client pings every 20 seconds; if two pings go unanswered, treat the connection as dead and reconnect immediately rather than waiting for TCP to notice.',
          'Fix 2: resumable state. Every message carries a monotonically increasing sequence per conversation. On reconnect, the client sends the last sequence it saw and the server replays anything newer from storage.',
          'Fix 3: acknowledgements. A sent message is kept in a local outbox until the server acknowledges it, and is re-sent with the same client-generated id on reconnect. The id makes the re-send idempotent, so duplicates collapse.',
          'Fix 4: backoff. Reconnection uses exponential backoff with jitter, so a server restart does not produce ten thousand simultaneous reconnects.',
          'Note what this adds up to: sequence numbers, replay, acknowledgements and deduplication - a small messaging protocol on top of the socket.',
        ],
        result:
          'WebSockets give you a fast pipe, not a reliable message channel. Every production chat implementation ends up adding sequencing, replay and idempotent sends; budget for that from the start.',
      },
    ],
    jargon: [
      { term: 'Upgrade / 101', plain: 'The HTTP handshake that switches the connection to the WebSocket protocol.' },
      { term: 'Frame', plain: 'One WebSocket message on the wire, with a few bytes of header.' },
      { term: 'Heartbeat / ping-pong', plain: 'Periodic messages proving the connection is still alive.' },
      { term: 'Sticky connection', plain: 'A user bound to one server for the life of the socket. Inherent, not a choice.' },
      { term: 'Fan-out', plain: 'Delivering one event to many connected clients, usually via pub/sub across servers.' },
      { term: 'Backpressure', plain: 'What you do when a client cannot consume as fast as you produce.' },
    ],
    remember: [
      'One HTTP upgrade, then a persistent two-way channel with a few bytes per message.',
      'Connections are stateful, so multiple servers need a pub/sub layer between them.',
      'Assume disconnections; design reconnect with backoff, replay and idempotent sends.',
      'Heartbeat, because a dead TCP connection can look alive for a long time.',
      'If traffic is one-way, server-sent events are simpler and usually enough.',
    ],
  },

  'server-sent-events': {
    analogy: {
      title: 'A radio station you tune into',
      body:
        'The station broadcasts continuously and you listen; there is no channel for you to talk back, and if your reception drops the radio retunes itself automatically. For anything where the server has news and the client only needs to hear it, that one-way simplicity is exactly right - and much less equipment than a two-way call.',
    },
    deepDive: [
      {
        heading: 'A long-lived HTTP response, and that is the whole trick',
        paragraphs: [
          'The client makes an ordinary GET and the server replies with Content-Type: text/event-stream and never closes the body. Events are written as plain text lines separated by blank lines. No new protocol, no upgrade, no special framing - which means every proxy, load balancer and logging tool already understands it.',
          'The browser API does the tedious parts for you. EventSource reconnects automatically after a drop, remembers the last event id it received, and sends it back in a Last-Event-ID header so the server can resume from that point. Getting that behaviour with WebSockets means writing it yourself.',
          'The limitation is direction: server to client only. Anything the client needs to send goes over a normal HTTP request, which for most applications is perfectly natural - a dashboard receives updates and occasionally posts an action.',
        ],
        code: {
          caption: 'The entire wire format',
          body: `GET /events        Accept: text/event-stream

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no          <- nginx would otherwise buffer forever

id: 1042
event: price
data: {"symbol":"ACME","price":12.4}

: this is a comment, sent every 20 s as a keep-alive

id: 1043
event: price
data: {"symbol":"ACME","price":12.6}`,
        },
      },
      {
        heading: 'The gotchas that make it look broken',
        paragraphs: [
          'Proxy buffering is the classic. nginx buffers responses by default, so it holds your events until the buffer fills or the response ends - and the response never ends. The stream appears completely dead. Disabling buffering for that route (X-Accel-Buffering: no, or proxy_buffering off) fixes it, and every SSE deployment hits this once.',
          'Idle timeouts are the second: load balancers cut connections that have been silent for 60 seconds, so send a comment line as a keep-alive every 15-30 seconds. The third is HTTP/1.1 connection limits - browsers allow only about six connections per host, and each SSE stream permanently occupies one. Two tabs with three streams each and the site stops loading. HTTP/2 removes this, which is a strong reason to serve SSE over it.',
          'On the server side, each open stream holds a connection and usually a thread or task. Event-driven servers handle tens of thousands; a thread-per-request server will fall over far earlier. Check which model you are running before promising live updates to every user.',
        ],
        bullets: [
          'Disable proxy buffering on the stream route, or nothing is delivered.',
          'Send a keep-alive comment every 15-30 s to defeat idle timeouts.',
          'Serve over HTTP/2 to escape the six-connections-per-host limit.',
          'Send an id with every event so reconnection can resume precisely.',
          'Do not mix SSE with a thread-per-connection server model.',
        ],
      },
      {
        heading: 'Choosing between SSE, WebSockets and polling',
        paragraphs: [
          'Ask which direction the data flows. If it is server to client only, SSE is simpler in every respect: fewer moving parts, works with existing HTTP infrastructure, free reconnection and resumption, and text you can read with curl. That covers notifications, live metrics, job progress, price tickers and feed updates.',
          'Choose WebSockets when the client must also send frequently and with low latency - chat, collaborative editing, games. Sending occasional actions over normal HTTP alongside an SSE stream is fine; sending twenty messages a second is not.',
          'Choose polling when updates are rare, staleness of seconds is acceptable, or you want the response to be cacheable and the server to stay completely stateless. A 30-second poll of a cheap cached endpoint is often a better engineering decision than a persistent connection nobody has budgeted to operate.',
        ],
      },
    ],
    examples: [
      {
        title: 'Live job progress without a socket',
        setup:
          'Users upload a large file that is processed for 30-90 seconds. The team wants a live progress bar and is about to introduce WebSockets.',
        walkthrough: [
          'Data flow is one-way: the server has progress, the client only displays it. SSE fits exactly.',
          'The upload returns a job id; the client opens GET /jobs/{id}/events and receives progress events as the worker publishes them.',
          'The worker publishes progress to Redis; the HTTP process subscribes and forwards to the connected client. Each event carries an id equal to the percentage plus a timestamp.',
          'If the browser loses connectivity, EventSource reconnects on its own and sends Last-Event-ID, so the server replays from the last known percentage instead of restarting the bar at zero.',
          'On completion the server sends a final event and closes the stream; the client stops reconnecting because the server returns 204 for finished jobs.',
          'Deployment fix: nginx needed proxy_buffering off for that location, which was the only infrastructure change required.',
        ],
        result:
          'A live progress feature shipped with no new protocol, no pub/sub for client-to-server messages, and automatic reconnection handled by the browser. For one-way updates, this is usually the lowest-cost option that still feels real time.',
      },
    ],
    jargon: [
      { term: 'text/event-stream', plain: 'The content type that tells the browser this is an SSE stream.' },
      { term: 'EventSource', plain: 'The browser API that consumes an SSE stream and reconnects automatically.' },
      { term: 'Last-Event-ID', plain: 'The header the browser resends on reconnect so the server can resume.' },
      { term: 'Keep-alive comment', plain: 'A line starting with a colon, sent periodically so proxies do not time out.' },
      { term: 'Proxy buffering', plain: 'A proxy holding the response until it is complete. The default, and fatal for SSE.' },
      { term: 'Retry field', plain: 'A value the server sends to control how long the browser waits before reconnecting.' },
    ],
    remember: [
      'SSE is just an HTTP response that never ends - no new protocol anywhere in the stack.',
      'Reconnection and resume-from-last-id are handled by the browser for free.',
      'Server to client only; the client talks back with ordinary requests.',
      'Disable proxy buffering and send keep-alives, or it will look completely broken.',
      'Prefer it over WebSockets whenever the traffic is genuinely one-way.',
    ],
  },

  polling: {
    analogy: {
      title: 'Checking the letterbox every hour',
      body:
        'You walk downstairs on a schedule and look. Most trips find nothing, and anything that arrives just after you leave waits until the next trip. It is simple, requires no arrangement with the postman, and it is perfectly adequate when letters are rare and an hour of delay does not matter.',
    },
    deepDive: [
      {
        heading: 'The two costs: wasted requests and average staleness',
        paragraphs: [
          'Polling has exactly two dials and they pull against each other. A shorter interval means fresher data and more requests; a longer interval means fewer requests and staler data. Average staleness is about half the interval, and the request rate is clients divided by interval.',
          'The arithmetic gets uncomfortable quickly. Ten thousand clients polling every 5 seconds is 2,000 requests per second, and if the data changes once a minute, each client sees one change every 12 polls - 11 of every 12 requests (about 92 percent) return nothing new. You are paying full request cost - TLS, auth, query - for an answer of "still nothing".',
          'That waste is the whole argument for the alternatives. But notice what polling buys: complete statelessness, trivial implementation, natural load balancing, and responses that can be cached by a CDN. For infrequent updates those properties are genuinely valuable.',
        ],
        code: {
          caption: 'The trade, in numbers',
          body: `10,000 clients, data changes once a minute

interval  requests/sec  avg staleness  useful responses
1 s        10,000         0.5 s          1.7%
5 s         2,000         2.5 s          8.3%
30 s          333          15 s           50%
60 s          167          30 s          100%

With ETag + 304, each wasted request costs a round trip and
~100 bytes instead of a full payload - often enough to make
polling acceptable.`,
        },
      },
      {
        heading: 'Making polling much cheaper than the naive version',
        paragraphs: [
          'Conditional requests are the biggest win. The server sends an ETag or Last-Modified; the client sends it back, and unchanged data costs a 304 with no body. The request still happens but the payload and most of the server work disappear - and a CDN can answer it without touching your origin at all.',
          'Delta polling is the second: instead of "give me the current state", ask "give me everything since cursor X". Responses are small, the client can catch up after being offline, and the server can answer from an index rather than recomputing a full view.',
          'Adaptive intervals are the third. Poll quickly while the user is actively watching, slow down when the tab is hidden, back off when responses have been unchanged for a while, and stop entirely when the page is not visible. Combined, these three techniques often reduce polling cost by an order of magnitude or more.',
        ],
        bullets: [
          'ETag plus If-None-Match, so unchanged means a cheap 304.',
          'Cursor or since-timestamp parameters, so responses carry only what is new.',
          'Back off when nothing changes; pause when the tab is hidden.',
          'Add jitter to intervals, or all clients will synchronise into a spike.',
          'Cache the endpoint at the edge for a few seconds - many clients, one origin request.',
        ],
      },
      {
        heading: 'The synchronisation trap',
        paragraphs: [
          'Clients that start at the same moment poll at the same moment forever. A deploy, a restart or a scheduled event lines everybody up, and a smooth 300 requests per second becomes a spike of 10,000 every 30 seconds. The server looks fine on average and times out periodically.',
          'The fix is jitter: randomise each interval by plus or minus 10-20 percent so the population spreads out. The same principle appears in cache TTLs, retry backoff and cron schedules - any time many clients share a clock, deliberately desynchronise them.',
          'Watch for the same effect on the server side, where a cron that fires on the hour produces a load spike that has nothing to do with users. Spreading scheduled work over a window is usually a one-line change with a large effect on peak capacity.',
        ],
      },
    ],
    examples: [
      {
        title: 'Cutting polling cost by 95 percent without changing the interval',
        setup:
          'A dashboard polls /api/status every 10 seconds. With 8,000 concurrent users that is 800 requests per second, each running a 40 ms query and returning 120 KB.',
        walkthrough: [
          'Step 1: add an ETag derived from the latest updated_at. Clients send If-None-Match; unchanged responses become 304 with no body. Bandwidth drops by roughly 95 percent immediately.',
          'Step 2: cache the endpoint at the CDN with s-maxage=5. The origin now serves at most one request every 5 seconds per edge instead of 800 per second.',
          'Step 3: compute the ETag from a cheap source (a cached timestamp) so a 304 does not run the 40 ms query at all.',
          'Step 4: pause polling when document.hidden is true. Measurements show about 60 percent of open dashboards are in background tabs.',
          'Step 5: add plus or minus 15 percent jitter, removing the 10-second spike pattern visible in the request graph.',
          'Result: origin query load down about 99 percent, bandwidth down about 95 percent, and the user-visible freshness is unchanged.',
        ],
        result:
          'Polling was not the problem - unconditional, uncached, synchronised polling was. Before replacing it with sockets, apply conditional requests and edge caching; often the remaining cost is too small to justify a persistent connection.',
      },
    ],
    jargon: [
      { term: 'Polling interval', plain: 'How often the client asks. Sets both freshness and cost.' },
      { term: 'Conditional request', plain: 'Sending a validator so unchanged data returns 304 with no body.' },
      { term: 'Delta / cursor polling', plain: 'Asking only for what changed since a known point.' },
      { term: 'Jitter', plain: 'Randomising intervals so clients do not synchronise into spikes.' },
      { term: 'Backoff', plain: 'Increasing the interval when nothing has changed for a while.' },
      { term: 'Thundering herd', plain: 'Many clients arriving simultaneously, usually after a restart.' },
    ],
    remember: [
      'Average staleness is half the interval; request rate is clients over interval.',
      'ETag plus 304 and edge caching remove most of the cost without changing freshness.',
      'Ask for deltas, not full state.',
      'Always jitter intervals, or clients will synchronise into spikes.',
      'For rare updates, polling beats a persistent connection on total complexity.',
    ],
  },

  'long-polling': {
    analogy: {
      title: 'Waiting at the counter instead of coming back later',
      body:
        'Rather than returning every ten minutes to ask if your order is ready, you stand at the counter and the clerk serves you the moment it arrives - or tells you after twenty minutes that there is still nothing, and you immediately ask again. Almost as immediate as being called, using nothing but the ordinary counter.',
    },
    deepDive: [
      {
        heading: 'How it works and what it buys',
        paragraphs: [
          'The client sends a request; the server does not answer immediately. It holds the request open until either new data appears or a timeout (typically 20-60 seconds) is reached. Then it responds, and the client immediately opens another request. The result is near-real-time delivery over completely ordinary HTTP.',
          'Compared with short polling, the wasted requests collapse: instead of 12 empty responses per minute you get one empty response per timeout window, and genuine updates arrive in milliseconds rather than after half an interval.',
          'It was the technique that made real-time web applications possible before WebSockets existed, and it remains the pragmatic fallback where sockets are blocked, unavailable, or not worth the operational weight - which is why libraries like Socket.IO still include it.',
        ],
        code: {
          caption: 'The cycle, and the gap to design around',
          body: `client: GET /updates?since=1042
server: (holds the request, waiting on pub/sub or a condition)
        -> data arrives at t+8 s  -> 200 with the events
        -> or t+30 s with no data -> 204, client asks again

THE GAP
  between receiving a response and issuing the next request,
  the client is not listening. Events in that window must be
  retrievable by cursor, or they are lost.
  That is why "since=" is not optional.`,
        },
      },
      {
        heading: 'The server-side requirement people underestimate',
        paragraphs: [
          'Holding thousands of requests open only works if the server does not consume a thread per request. On a thread-per-request model, 5,000 waiting clients means 5,000 blocked threads and a machine that falls over. On an async or event-driven model - Node, Go, async Python, Netty - a waiting request is a cheap suspended task and tens of thousands are fine.',
          'Timeouts must be aligned all the way through. If the server holds for 60 seconds but a load balancer cuts idle connections at 30, every long poll dies as an error. Set the server hold shorter than every proxy and balancer timeout on the path, with margin.',
          'And the server needs a way to wake up. A loop that polls the database every 200 milliseconds per waiting client is worse than short polling. Wait on a pub/sub subscription, a condition variable or a notification channel so a waiting request costs nothing until there is news.',
        ],
        bullets: [
          'Async server model, or the waiting requests will consume all your threads.',
          'Hold time shorter than every proxy and load balancer idle timeout.',
          'Wake on pub/sub or notification, never by polling the database per waiter.',
          'Always include a cursor so events during the reconnect gap are not lost.',
        ],
      },
      {
        heading: 'Where it sits among the alternatives today',
        paragraphs: [
          'With SSE and WebSockets widely supported, long polling is rarely the first choice - but it is still the best choice in specific circumstances: corporate networks that break persistent connections, environments where you cannot change proxy configuration, or clients on old platforms.',
          'It also remains a good fallback tier. A client can try WebSocket, fall back to SSE, then fall back to long polling, so the feature degrades rather than disappears. Several real-time libraries implement exactly that ladder.',
          'The honest comparison: long polling gives similar latency to SSE, costs one full request-response cycle per event rather than a few bytes, and needs no special proxy configuration. If events are infrequent, that overhead is irrelevant; if they arrive several times a second, it becomes the dominant cost and a persistent connection wins clearly.',
        ],
      },
    ],
    examples: [
      {
        title: 'A notification feed with no lost events',
        setup:
          'A notification bell must update within a second. The infrastructure team will not enable WebSocket upgrades on the corporate proxy, so long polling it is.',
        walkthrough: [
          'Client calls GET /notifications?since=1042 and the server holds the request for up to 25 seconds (proxy idle timeout is 60).',
          'A notification is published to Redis. The waiting request wakes, returns events 1043-1044, and the client immediately issues GET /notifications?since=1044.',
          'Between those two requests there is a gap of a few milliseconds. An event published exactly then is not pushed to anyone - but because the next request carries since=1044, the server returns it straight away from storage. Nothing is lost.',
          'If no event arrives within 25 seconds, the server returns 204 and the client reconnects. Idle users cost one request every 25 seconds instead of one every second.',
          'Server model: async handlers with a Redis subscription per connection, so 20,000 waiting clients cost memory but almost no CPU.',
          'Safety: the client adds a small random delay before reconnecting after an error, so a server restart does not produce a synchronised reconnect storm.',
        ],
        result:
          'Sub-second delivery over plain HTTP, with no events lost during the reconnect gap because the cursor makes every response resumable. The cursor - not the holding - is what makes long polling correct.',
      },
    ],
    jargon: [
      { term: 'Hold / hang', plain: 'The server keeping a request open instead of answering immediately.' },
      { term: 'Reconnect gap', plain: 'The moment between one response and the next request, when nothing is listening.' },
      { term: 'Cursor / since', plain: 'The position marker that makes the gap harmless.' },
      { term: 'Async server', plain: 'A server that suspends waiting requests cheaply instead of blocking a thread.' },
      { term: 'Idle timeout', plain: 'How long a proxy tolerates a silent connection. Your hold time must be shorter.' },
      { term: 'Fallback ladder', plain: 'Trying WebSocket, then SSE, then long polling, so the feature always works.' },
    ],
    remember: [
      'Hold the request until there is news, then the client immediately asks again.',
      'Near-real-time latency over completely ordinary HTTP.',
      'Always carry a cursor - the reconnect gap is where events would otherwise be lost.',
      'Requires an async server; thread-per-request will collapse.',
      'Keep the hold shorter than every proxy timeout on the path.',
    ],
  },
};
