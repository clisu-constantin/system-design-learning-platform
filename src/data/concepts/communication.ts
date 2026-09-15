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
    what: 'WebSockets upgrade an HTTP connection into a persistent full-duplex channel where server and client can push messages at any time.',
    why: 'Chat, collaborative editing, live dashboards and games need server-initiated messages with low latency. Polling for them wastes requests and adds delay.',
    how: [
      'The client sends an HTTP upgrade request; the connection becomes a WebSocket.',
      'Both sides send frames until one closes; the server must track connections.',
      'Scaling out requires a shared pub/sub layer so any node can reach any connected user.',
      'Clients must reconnect with backoff and resynchronise missed state.',
    ],
    when: ['Chat, presence, live collaboration, trading and telemetry dashboards.'],
    diagram: `client --upgrade--> gateway node 2   (connection lives here)
message for user A -> published to Redis/Kafka -> delivered by node 2

Connections are state: this tier is stateful and needs sticky routing.`,
    tradeoffs: [
      {
        approach: 'WebSockets',
        gains: ['True push, minimal per-message overhead', 'Bidirectional'],
        costs: ['Connection state makes the tier stateful', 'Memory per connection', 'Load balancers, proxies and mobile networks complicate long-lived connections'],
      },
      {
        approach: 'Server-Sent Events',
        gains: ['Simpler, plain HTTP, auto-reconnect built in'],
        costs: ['Server to client only', 'Text only'],
      },
    ],
    mistakes: ['Forgetting that a deploy drops every connection at once, causing a reconnect storm.'],
    related: ['server-sent-events', 'long-polling', 'pub-sub', 'stateful-applications'],
  },
  {
    slug: 'server-sent-events',
    title: 'Server-Sent Events',
    tagline: 'A one-way stream of updates over ordinary HTTP.',
    category: 'communication',
    difficulty: 'Beginner',
    keywords: ['sse', 'eventsource', 'streaming', 'reconnect'],
    what: 'SSE keeps an HTTP response open and streams text events from server to client, with built-in reconnection and event ids.',
    why: 'Many "real-time" features only need server-to-client updates. SSE gives you that with no new protocol, no special proxy configuration and automatic reconnect.',
    how: [
      'The client opens an EventSource; the server responds with text/event-stream and keeps writing.',
      'Each event may carry an id, so the client can resume from Last-Event-ID after a drop.',
      'Works over HTTP/2, so the old six-connections-per-domain limit is not an issue.',
    ],
    when: ['Notifications, live counters, progress updates, log tailing.'],
    diagram: `GET /events            HTTP/1.1
Accept: text/event-stream

id: 42
event: order.updated
data: {"id":"123","status":"shipped"}`,
    tradeoffs: [
      {
        approach: 'SSE',
        gains: ['Simple, HTTP-native', 'Automatic reconnect and resume', 'Easy to proxy and debug'],
        costs: ['Server to client only', 'Text only', 'Still a long-lived connection to manage'],
      },
    ],
    related: ['websockets', 'polling', 'long-polling'],
  },
  {
    slug: 'polling',
    title: 'Polling',
    tagline: 'Ask again every N seconds - simple, wasteful, and sometimes correct.',
    category: 'communication',
    difficulty: 'Beginner',
    keywords: ['interval', 'freshness', 'load', 'jitter'],
    what: 'The client repeatedly requests the current state on a fixed interval.',
    why: 'It needs no special infrastructure and survives any network. For data that changes rarely and tolerates delay, it is the cheapest thing that works.',
    how: [
      'Pick an interval from the freshness requirement, not from habit.',
      'Add jitter so clients do not synchronise into a spike.',
      'Use ETag / If-None-Match so unchanged responses cost a cheap 304.',
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
    ],
    mistakes: ['Every client polling on the same second boundary, creating a periodic thundering herd.'],
    related: ['long-polling', 'server-sent-events', 'websockets'],
  },
  {
    slug: 'long-polling',
    title: 'Long Polling',
    tagline: 'Hold the request open until there is something to say.',
    category: 'communication',
    difficulty: 'Intermediate',
    keywords: ['hanging get', 'timeout', 'fallback', 'realtime'],
    what: 'The client sends a request and the server holds it open until data is available or a timeout fires; the client then immediately issues the next request.',
    why: 'It gives near-real-time delivery over plain HTTP, which is why it remains the fallback when WebSockets are blocked by intermediaries.',
    how: [
      'Server parks the request (no thread blocking in async runtimes) and completes it when an event arrives.',
      'A timeout (typically 20-60 s) keeps proxies from killing the connection silently.',
      'The client must handle the gap between responses and de-duplicate by event id.',
    ],
    diagram: `client -> GET /updates  (held open)
                         ...event...
       <- 200 {event}    (client immediately re-requests)`,
    tradeoffs: [
      {
        approach: 'Long polling',
        gains: ['Near real time with ordinary HTTP', 'Passes through nearly all proxies'],
        costs: ['A held connection per client', 'Reconnect overhead per message', 'Harder to reason about server resources'],
      },
    ],
    related: ['polling', 'websockets', 'server-sent-events'],
  },
];
