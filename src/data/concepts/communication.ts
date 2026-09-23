import type { Concept } from '@/types';

export const communicationConcepts: Concept[] = [
  {
    slug: 'rest-apis',
    title: 'REST APIs',
    tagline: 'Resources, HTTP verbs and the cacheability that comes with them.',
    category: 'communication',
    difficulty: 'Beginner',
    keywords: ['http', 'resource', 'idempotent', 'versioning', 'pagination'],
    lab: 'api-styles',
    labFocus: 'rest-apis',
    what: 'REST models an API as resources addressed by URLs and manipulated with HTTP methods, relying on the semantics HTTP already defines.',
    why: 'Because it uses HTTP properly, every intermediary understands it: browsers and CDNs cache GETs, clients and proxies can retry idempotent methods, and any client can call it without a special library.',
    how: [
      'Model nouns, not verbs: /orders/123 rather than /getOrder?id=123.',
      'GET is safe and cacheable; PUT and DELETE are idempotent; POST is neither.',
      'Use status codes that mean what they say, and put errors in the status, not only the body.',
      'Paginate with cursors for large collections; offsets get slow and inconsistent.',
      'A screen that needs related resources makes one call per resource, in round trips that wait for each other - unless the API offers ?include= and ?fields=.',
    ],
    when: [
      'Public APIs that any client, language or browser must be able to call.',
      'CRUD-heavy services, and anything that benefits from HTTP caching.',
    ],
    diagram: `GET    /orders?cursor=eyJ...   200  list
POST   /orders                201  create   (not idempotent -> use a key)
GET    /orders/123            200  read     (cacheable)
PUT    /orders/123            200  replace  (idempotent)
DELETE /orders/123            204  remove   (idempotent)`,
    tradeoffs: [
      {
        approach: 'REST, one call per resource',
        gains: ['Universally understood', 'GETs cached by browsers, CDNs and proxies', 'Easy to debug with curl'],
        costs: [
          'Over-fetching: each resource comes back whole',
          'Under-fetching: a composite screen needs several round trips in a row',
          'No schema unless you add OpenAPI',
        ],
      },
      {
        approach: 'REST with ?include= and ?fields=',
        gains: ['One round trip for a composite screen', 'Only the fields the screen shows'],
        costs: [
          'Every endpoint must implement and maintain the parameters',
          'Many URL variants mean more cache keys and a lower CDN hit rate',
        ],
      },
    ],
    mistakes: [
      'Tunnelling everything through POST /api and losing caching, retries and readable logs.',
      'A GET that changes state - a prefetcher, crawler or proxy will eventually replay it.',
      'Returning 500 for a validation error, so clients retry something that can never succeed.',
    ],
    related: ['graphql', 'grpc', 'api-gateway', 'idempotency'],
    quiz: [
      {
        id: 'rest-1',
        prompt:
          'In the Lab, a mobile app loads the Order history screen with one REST call per resource: 11 requests in 3 round trips in a row. Why can the app not send all 11 at once?',
        options: [
          'HTTP/2 allows only two requests in flight per connection',
          'The item calls need order ids from the orders response, and the product calls need product ids from the items',
          'REST requires GET requests to be sent one after another',
          'The server rate-limits the app to four requests per round trip',
        ],
        answer: 1,
        explanation:
          'This is under-fetching: each response holds the ids the next calls need, so the calls form waves that wait for each other. HTTP/2 has no two-request limit - the calls inside one wave do go out together - and nothing in REST forces GETs to be sequential.',
      },
      {
        id: 'rest-2',
        prompt:
          'GET /users/42 returns 1.8 KB with addresses and preferences, but the screen shows only the name. Which REST-native change cuts the bytes without changing the number of calls?',
        options: [
          'Move the call to POST /users/search',
          'Split the name into its own second call',
          'Support ?fields=name so the server returns only the requested fields',
          'Raise the CDN cache lifetime of the response',
        ],
        answer: 2,
        explanation:
          'Sparse fieldsets let the client name the fields it needs, which removes the over-fetching (turn on Sparse fields in the Lab and "Never shown" drops). A POST loses cacheability and does not shrink anything; a longer cache lifetime saves repeat trips but still ships the whole object.',
      },
      {
        id: 'rest-3',
        prompt:
          'A team adds GET /orders/42/cancel to cancel orders. A week later, orders are being cancelled that nobody cancelled. What is the most likely cause?',
        options: [
          'A race condition in the database',
          'An expired token being reused',
          'The CDN serving a stale order',
          'Something replayed the GET - a link prefetcher, crawler or proxy - because GET is defined as safe',
        ],
        answer: 3,
        explanation:
          'HTTP defines GET as safe, so browsers, crawlers and proxies are free to send it without asking - and each one cancelled an order. State changes belong in unsafe methods, for example POST /orders/42/cancellation. A stale cache would show old data, not cancel anything.',
      },
      {
        id: 'rest-4',
        prompt:
          'A mobile app sends POST /orders, the response times out, the app retries, and the customer is charged twice. What should the API offer?',
        options: [
          'An Idempotency-Key header, so a repeat with the same key returns the original order',
          'A 500 status on timeouts, so the client knows not to retry',
          'Order creation over GET, so the result can be cached',
          'A longer server timeout, so the first request always answers',
        ],
        answer: 0,
        explanation:
          'POST is not idempotent, so a blind retry creates a second order. With an idempotency key the server recognises the repeat and returns the first result. A longer timeout only makes the lost-response case rarer, and GET must never create anything.',
      },
      {
        id: 'rest-5',
        prompt:
          'An API returns 500 when a request fails validation. What goes wrong in production?',
        options: [
          'Nothing, as long as the error message in the body is clear',
          'Clients retry a request that can never succeed, and monitoring pages the on-call team for errors that are not the server failing',
          'Browsers cache the 500 and stop calling the API',
          'The load balancer removes the server from the pool at once',
        ],
        answer: 1,
        explanation:
          '5xx tells clients and dashboards that the server failed and a retry may work. A bad input should be a 400 or 422, which says the client must change the request. The body message does not help, because retry logic and alerts key off the status code.',
      },
      {
        id: 'rest-6',
        prompt:
          'An infinite-scroll feed pages with ?page=5&size=20. Users report seeing the same post twice while new posts are arriving. What fixes it?',
        options: [
          'Larger pages, so fewer page boundaries exist',
          'Caching every page in the CDN',
          'Cursor pagination: ask for the items after the last one seen',
          'A new API version for the feed',
        ],
        answer: 2,
        explanation:
          'With offsets, a new post at the top shifts every item one position down, so the next page repeats the last item of the previous one. A cursor names the last item seen, so inserts do not shift anything - and it stays fast deep into the list. Bigger pages only make the duplicates rarer.',
      },
      {
        id: 'rest-7',
        prompt:
          'In the Lab you switch REST to Embed (?include=). Round trips drop from 3 to 1, but "Never shown" stays around 96%. Why?',
        options: [
          'Embedding adds a JSON wrapper that is larger than the data',
          'The Lab counts the headers of the embedded calls',
          'One round trip always downloads more than three',
          'The embedded orders, items and products still come back whole - ?include= fixes round trips, not fields',
        ],
        answer: 3,
        explanation:
          '?include= removes the waves by embedding related resources, but each one is still the full object. Adding ?fields= (Sparse fields in the Lab) is what cuts the bytes. The two fix different problems: under-fetching and over-fetching.',
      },
      {
        id: 'rest-8',
        prompt:
          'You add an optional giftMessage field to the order response. Existing mobile apps ignore fields they do not know. Do you need /v2?',
        options: [
          'No - an additive, optional field breaks no client; save new versions for breaking changes',
          'Yes - every change to a response needs a new version',
          'Yes - old apps will crash on the unknown field',
          'No - but you must remove an old field to keep the size the same',
        ],
        answer: 0,
        explanation:
          'Clients that ignore unknown fields keep working when a field is added, so the change is backward compatible. Versions are for genuine breaks, such as removing or renaming a field or changing its type. Bumping the version for every addition leaves you maintaining many parallel APIs.',
      },
      {
        id: 'rest-9',
        prompt:
          'A mobile app refreshes GET /orders/42 every 30 seconds, and the order almost never changes. How do you stop resending the full body?',
        options: [
          'Switch the refresh to POST',
          'Return an ETag; the app sends If-None-Match and gets 304 Not Modified with no body when nothing changed',
          'Add ?fields= to the refresh',
          'Make the app call less often and accept stale data',
        ],
        answer: 1,
        explanation:
          'A conditional GET lets the server answer "unchanged" in a few bytes, and the app keeps its copy. That is HTTP caching working for you because the API uses GET properly. ?fields= trims every response but still resends it each time.',
      },
      {
        id: 'rest-10',
        prompt:
          'A public API routes everything through POST /api with an "action" field in the body. What does it lose compared with resource URLs and HTTP methods?',
        options: [
          'Nothing - HTTP methods are only a naming convention',
          'Only the ability to use JSON',
          'Caching of reads by browsers and CDNs, safe automatic retries of idempotent calls, and per-route logs and metrics',
          'Support for authentication headers',
        ],
        answer: 2,
        explanation:
          'Intermediaries decide what to cache and what is safe to retry from the method and URL. When every call is the same POST, none of them can help, and every log line reads POST /api. JSON and auth headers still work - which is why the loss is easy to miss.',
      },
      {
        id: 'rest-11',
        prompt:
          'In the Lab, keep REST with one call per resource and switch the caller from the mobile app (100 ms) to a service in the same data centre (1 ms). Screen ready drops from about 317 ms to under 10 ms. What does that tell you?',
        options: [
          'REST is only slow on mobile phones',
          'The service caller downloads fewer bytes',
          'Server-side REST calls skip the database',
          'The cost of round trips in a row is paid per round trip time - it matters most on slow, far networks',
        ],
        answer: 3,
        explanation:
          'Three waves cost three round trip times. At 1 ms that is almost nothing; at 100 ms it is most of the wait. The bytes and the database queries are the same for both callers - only the network changed.',
      },
    ],
  },
  {
    slug: 'graphql',
    title: 'GraphQL',
    tagline: 'One endpoint, a typed schema, and the client decides what it needs.',
    category: 'communication',
    difficulty: 'Intermediate',
    keywords: ['schema', 'resolver', 'n+1', 'over-fetching', 'persisted query'],
    lab: 'api-styles',
    labFocus: 'graphql',
    what: 'GraphQL exposes a typed schema through a single endpoint; clients send a query describing exactly the fields they want and receive precisely that shape.',
    why: 'It solves over-fetching and under-fetching for clients that compose many entities per screen - especially mobile apps on slow networks, where every round trip in a row costs a full round trip time.',
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
        gains: ['No over-fetching', 'One round trip for a composite screen', 'Strong typing and introspection', 'Frontend iterates without backend changes'],
        costs: [
          'HTTP caching is largely lost: most queries are POSTs to one URL',
          'N+1 risk in resolvers',
          'Clients can write expensive queries unless limited',
          'More server-side machinery',
        ],
      },
      {
        approach: 'GraphQL with persisted queries',
        gains: ['Queries sent as GET with a short id, so CDNs can cache them', 'Only known operations run in production'],
        costs: ['A build step to register every query', 'A new query needs a client release'],
      },
    ],
    mistakes: [
      'Exposing the whole database as a schema and discovering that a single query can take down the service.',
      'Resolvers without batching: one database query per object, the N+1 problem.',
      'Checking authorisation only at the endpoint, when one query can reach any field.',
    ],
    related: ['rest-apis', 'grpc', 'api-gateway'],
    quiz: [
      {
        id: 'gql-1',
        prompt:
          'In the Lab, turn Batch resolver queries off and raise Orders on the screen to 8. DB queries jump to 26 while Requests stays at 1. What is happening?',
        options: [
          'Each item and product resolver runs its own query - the N+1 problem',
          'The client is sending 26 requests over one HTTP/2 connection',
          'The query is invalid and the server retries it',
          'The database is scanning the whole table',
        ],
        answer: 0,
        explanation:
          'Resolvers run per field, per object, so without batching every item and product costs one query. The network numbers do not move because the caller still sends one query; the extra work is all on the server. Batching brings it back to one query per level.',
      },
      {
        id: 'gql-2',
        prompt:
          'A team moves its mobile dashboard from REST to GraphQL. Round trips fall from 3 to 1, but database load triples. What is the most likely cause?',
        options: [
          'GraphQL responses are larger than REST responses',
          'GraphQL cannot use database indexes',
          'The resolvers are not batched, so one query fans out into one database query per object',
          'The mobile app sends the query three times',
        ],
        answer: 2,
        explanation:
          'GraphQL moves work from the network to the server, and naive resolvers issue a query per object. A per-request batching loader such as DataLoader collects the ids and issues one query per level. Response size went down, not up - the fields are exactly the ones asked for.',
      },
      {
        id: 'gql-3',
        prompt:
          'Someone sends your public GraphQL endpoint a query nested ten levels deep through friends { friends { ... } }. One request takes the database down. What protects you?',
        options: [
          'A limit of 100 requests per minute per client',
          'Depth limits, complexity scoring, and in production only allow-listed (persisted) queries',
          'Moving the endpoint to a new URL',
          'Returning the response as a stream',
        ],
        answer: 1,
        explanation:
          'In GraphQL the cost is inside one request, so counting requests does not help - one query can be enormous. Limits on depth and computed complexity reject it before it runs, and an allow-list means unknown queries never run at all.',
      },
      {
        id: 'gql-4',
        prompt:
          'You put a CDN in front of /graphql and its cache hit rate is 0%. What is the reason, and the usual fix?',
        options: [
          'CDNs cannot cache JSON; switch to protobuf',
          'The TTL is too short; raise it to one hour',
          'The schema is too large to cache',
          'Queries are POSTs to one URL, which CDNs do not cache; send persisted queries as GET with a query id so the URL identifies the response',
        ],
        answer: 3,
        explanation:
          'CDNs cache by method and URL, and a POST body is invisible to that. The GraphQL over HTTP spec allows GET for queries, and persisted queries keep that URL short. A longer TTL changes nothing when no response is stored in the first place.',
      },
      {
        id: 'gql-5',
        prompt:
          'Your dashboards show all traffic as "POST /graphql 200" and you cannot find which screen got slow. What do you add?',
        options: [
          'Metrics and traces by operation name and resolver timing',
          'A separate URL for every query',
          'A second GraphQL endpoint for slow queries',
          'Nothing - GraphQL is always 200, so it is healthy',
        ],
        answer: 0,
        explanation:
          'With one endpoint, per-URL dashboards go blind. Naming operations and timing resolvers gives you the per-screen and per-field view back. A 200 also says little: a GraphQL response can carry an errors array next to its data.',
      },
      {
        id: 'gql-6',
        prompt:
          'A response comes back 200 with data where one field is null and an errors array explaining that the field failed. The client shows the screen as if all went well. What should it do?',
        options: [
          'Nothing - 200 means the request succeeded',
          'Retry until the status is not 200',
          'Check the errors array as well as the data, and handle partial success',
          'Treat any null as an empty string',
        ],
        answer: 2,
        explanation:
          'GraphQL can return partial success: the fields that resolved, plus errors for the ones that failed, often with HTTP 200. The status code alone does not tell the client whether every field worked. Retrying on a 200 would loop forever.',
      },
      {
        id: 'gql-7',
        prompt:
          'The team checks that the caller is logged in at the /graphql endpoint. A user then reads a colleague salary with me { manager { salary } }. What was missing?',
        options: [
          'HTTPS on the endpoint',
          'Authorisation per type and field in the resolvers, not only at the endpoint',
          'A rate limit on the manager field',
          'A separate endpoint for HR data',
        ],
        answer: 1,
        explanation:
          'With one endpoint, "may call /graphql" says nothing about which data a query reaches. Every sensitive field needs its own check. HTTPS protects the data in transit but still delivers it to the wrong user.',
      },
      {
        id: 'gql-8',
        prompt:
          'The web app and the mobile app need different fields of the same product. The REST team is building /products/web and /products/mobile. What does GraphQL offer instead?',
        options: [
          'Automatic caching of both endpoints',
          'Faster database queries for each client',
          'A separate server for each client',
          'Each client queries the fields it needs from one schema, with no new endpoint per client',
        ],
        answer: 3,
        explanation:
          'The client decides the shape, so a new screen or client usually needs a new query, not new backend work. The cost is the machinery on the server: batching, limits and per-field authorisation.',
      },
      {
        id: 'gql-9',
        prompt: 'You want to remove the legacyPrice field from the schema. How is that usually done in GraphQL?',
        options: [
          'Mark it @deprecated, watch query traffic until no operation asks for it, then remove it',
          'Publish a /v2 endpoint without the field',
          'Remove it at once - clients ignore missing fields',
          'Rename it so old clients get an error',
        ],
        answer: 0,
        explanation:
          'Because every client names its fields, the server can see exactly who still uses one. Deprecate, wait for usage to reach zero, then remove - no parallel versions. Removing it at once breaks every query that still asks for it: the query fails validation.',
      },
      {
        id: 'gql-10',
        prompt:
          'In the Lab, compare GraphQL with REST per resource for a service in the same data centre (1 ms), then for the mobile app (100 ms). When is the one-round-trip gain of GraphQL largest?',
        options: [
          'Inside the data centre, where calls are cheapest',
          'It is the same for every caller',
          'On a slow, far network like mobile, for a screen that needs several related resources',
          'Only for screens that need a single resource',
        ],
        answer: 2,
        explanation:
          'Every round trip in a row costs one round trip time. At 1 ms, three waves cost a few ms; at 100 ms they are most of the wait. A screen with one resource needs one call in any style, so there is nothing to save.',
      },
      {
        id: 'gql-11',
        prompt:
          'One query loads 20 comments, all written by the same user. With a per-request DataLoader, how many times is that user loaded?',
        options: ['20 times, once per comment', 'Once - the loader deduplicates keys within the request', 'Never - GraphQL caches users globally', 'Twice - once per resolver level'],
        answer: 1,
        explanation:
          'The loader collects the keys asked for during one tick and deduplicates them, so the 20 lookups become one. The cache lives for one request only, which keeps it from serving stale data across users.',
      },
    ],
  },
  {
    slug: 'grpc',
    title: 'gRPC',
    tagline: 'Binary, schema-first RPC over HTTP/2 for service-to-service calls.',
    category: 'communication',
    difficulty: 'Intermediate',
    keywords: ['protobuf', 'http2', 'streaming', 'rpc', 'contract'],
    lab: 'api-styles',
    labFocus: 'grpc',
    what: 'gRPC is a remote procedure call framework using Protocol Buffers for the contract and HTTP/2 for transport, with generated clients and servers in many languages.',
    why: 'Inside a cluster you control both sides, so both can be generated from one contract. That buys smaller payloads, cheaper parsing, a typed client and multiplexed streams - paid for with schema tooling and weak browser support.',
    how: [
      'Define services and messages in a .proto file - it is the contract.',
      'Generate client and server stubs; the wire format is compact binary.',
      'HTTP/2 multiplexing allows many concurrent calls over one connection, plus client, server and bidirectional streaming.',
      'Evolve schemas by adding fields with new numbers; never reuse a field number.',
      'Protobuf shrinks the encoding, not the choice of fields: a method still returns whatever its message holds.',
    ],
    when: ['Internal service-to-service communication.', 'Low-latency, high-volume calls.', 'Streaming between services.'],
    diagram: `service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchRequest) returns (stream Order);
}
-> generated typed clients, binary frames, one HTTP/2 connection`,
    tradeoffs: [
      {
        approach: 'gRPC between services',
        gains: ['Small payloads and cheap parsing', 'Generated clients, compile-time safety', 'Native streaming and deadlines'],
        costs: [
          'Harder to inspect than JSON',
          'Requires schema tooling in the build',
          'Long-lived HTTP/2 connections need L7 or client-side load balancing',
        ],
      },
      {
        approach: 'gRPC-Web from browsers',
        gains: ['The same typed contract in the browser'],
        costs: ['Needs a proxy such as Envoy to translate', 'Only unary and server-streaming calls'],
      },
    ],
    mistakes: [
      'Using gRPC for a public API that third parties must integrate with from browsers.',
      'Reusing a retired field number, so old clients read new data as the old field.',
      'Putting gRPC behind a plain L4 load balancer, so new servers receive no traffic.',
    ],
    related: ['rest-apis', 'microservices', 'websockets'],
    quiz: [
      {
        id: 'grpc-1',
        prompt:
          'In the Lab, gRPC with one RPC per resource makes the same 11 calls as REST. Downloaded drops to about 40%, but "Never shown" stays around 96%. Why?',
        options: [
          'The Lab does not count protobuf correctly',
          'gRPC always sends every field twice',
          'Binary encoding makes each field smaller, but the methods still return whole resources the screen does not show',
          'HTTP/2 headers are counted as unused bytes',
        ],
        answer: 2,
        explanation:
          'Protobuf shrinks how each field is encoded, not which fields the message carries. To stop over-fetching you design the method for the need (RPC for the screen in the Lab) or use a field mask. The headers are not counted at all in the Lab.',
      },
      {
        id: 'grpc-2',
        prompt: 'The front-end team wants the browser to call your gRPC service directly. What does it take?',
        options: [
          'Nothing - every modern browser speaks gRPC because it speaks HTTP/2',
          'A grpc-web client plus a proxy such as Envoy that translates to gRPC, because browsers do not expose the HTTP/2 framing gRPC needs',
          'Converting the .proto file to JSON on the server',
          'Opening a WebSocket to each service',
        ],
        answer: 1,
        explanation:
          'Browsers use HTTP/2 but do not give page code control of its frames and trailers, which gRPC relies on. gRPC-Web works around that through a proxy, and supports only unary and server-streaming calls. Pick Browser as the caller in the Lab and the proxy appears on the diagram.',
      },
      {
        id: 'grpc-3',
        prompt:
          'You scale the pricing service from 2 to 6 pods behind an L4 load balancer. The 4 new pods receive almost no gRPC traffic. Why?',
        options: [
          'Each client holds one long-lived HTTP/2 connection and sends all its calls on it, so the balancer never gets to pick again',
          'The new pods failed their health checks',
          'gRPC only works with two servers',
          'Protobuf messages are too large to balance',
        ],
        answer: 0,
        explanation:
          'An L4 balancer chooses a backend per connection, and gRPC multiplexes every call over the same connection. Balancing per call needs an L7 proxy such as Envoy, or client-side load balancing with service discovery. Failing health checks would show as errors, not as idle pods.',
      },
      {
        id: 'grpc-4',
        prompt:
          'A developer deletes the field note = 3 and later adds string coupon = 3. Old clients start showing coupons as notes. What rule was broken?',
        options: [
          'Field names must stay in alphabetical order',
          'A message can have at most three fields',
          'Every change needs a new service name',
          'Never reuse a field number - mark retired numbers as reserved',
        ],
        answer: 3,
        explanation:
          'On the wire a field is its number, not its name. Old clients still read number 3 as note, so they decode coupons into it. Reserving retired numbers makes the compiler refuse the reuse.',
      },
      {
        id: 'grpc-5',
        prompt: 'You add string currency = 4 to the Order message and deploy the server first. What happens to clients built from the old .proto?',
        options: [
          'They crash on the unknown field',
          'They must all be redeployed before the server',
          'They keep working and skip the unknown field',
          'They receive currency in place of field 1',
        ],
        answer: 2,
        explanation:
          'Protobuf is built for this: a parser skips field numbers it does not know. Adding a field with a new number is backward compatible, which is what lets services deploy independently. Changing the type or number of an existing field is what breaks clients.',
      },
      {
        id: 'grpc-6',
        prompt:
          'Checkout calls Pricing, which calls Tax. The user request has a 300 ms budget, but Tax keeps working for 2 seconds after Checkout has given up. Which gRPC feature addresses this?',
        options: [
          'Server streaming',
          'Deadlines, propagated down the call chain so Tax knows the time left and stops',
          'Field masks',
          'Server reflection',
        ],
        answer: 1,
        explanation:
          'A deadline travels with the call, and gRPC can pass the remaining time to downstream calls (on by default in Java and Go, opt-in in C++). Tax then abandons work nobody will use. Streaming and reflection have nothing to do with time budgets.',
      },
      {
        id: 'grpc-7',
        prompt:
          'Partner companies will call your new API from many languages, including browser apps, and their developers debug with curl. What is the usual choice?',
        options: [
          'REST with JSON for the public API, with gRPC on internal hops if it helps',
          'gRPC only, and give partners the .proto file',
          'gRPC with server reflection turned on',
          'GraphQL with persisted queries only',
        ],
        answer: 0,
        explanation:
          'Third parties and browsers need something any HTTP client can call and a human can read. gRPC shines where you control both sides. Persisted-only GraphQL would block partners from writing their own queries at all.',
      },
      {
        id: 'grpc-8',
        prompt: 'The inventory service must push every stock change to the pricing service as it happens. Which gRPC call type fits?',
        options: ['Unary, polled every second', 'Client streaming', 'A new unary call per change from pricing', 'Server streaming: pricing calls once and receives a stream of changes'],
        answer: 3,
        explanation:
          'One request, many responses over time is server streaming, and HTTP/2 flow control handles backpressure. Polling adds delay and empty calls. Client streaming is the other direction: many messages up, one answer back.',
      },
      {
        id: 'grpc-9',
        prompt: 'During an incident, the on-call engineer cannot read gRPC traffic with curl. What should have been set up beforehand?',
        options: [
          'JSON encoding for every message',
          'A REST copy of every method',
          'grpcurl with server reflection, and logging that decodes messages',
          'A larger HTTP/2 window size',
        ],
        answer: 2,
        explanation:
          'The binary format is not human readable, so gRPC teams need tools that know the schema: reflection lets grpcurl discover and call methods, and decoded logs show the fields. Switching everything to JSON gives up the reason for choosing gRPC.',
      },
      {
        id: 'grpc-10',
        prompt:
          'In the Lab on the gRPC focus, 11 RPCs in 3 round trips take about 9 ms between two services. Switch the caller to the mobile app and it becomes about 310 ms. What does this show?',
        options: [
          'gRPC is slow on mobile networks',
          'Binary encoding shrinks bytes, not round trips - chatty per-resource methods are cheap inside a data centre and expensive over a slow network',
          'The mobile app downloads more fields than the service',
          'HTTP/2 does not work on mobile',
        ],
        answer: 1,
        explanation:
          'The calls and the bytes are the same for both callers; only the round trip time changed, from 1 ms to 100 ms, and it is paid three times. For a far caller, a method designed for the screen (RPC for the screen) cuts the waves to one.',
      },
      {
        id: 'grpc-11',
        prompt:
          'An internal pricing call runs 40,000 times per second with 4 KB JSON bodies, and a third of its latency is JSON parsing. What is the main gain from moving it to gRPC?',
        options: [
          'Smaller payloads and much cheaper parsing, so lower latency and CPU on both sides',
          'Fewer round trips, because gRPC merges calls',
          'Automatic caching of responses',
          'No more need for load balancing',
        ],
        answer: 0,
        explanation:
          'Protobuf is compact binary and quick to parse, and HTTP/2 carries many calls on one connection. gRPC does not merge calls or cache responses, and it makes load balancing harder, not unnecessary - that is the cost that comes with the gain.',
      },
    ],
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
