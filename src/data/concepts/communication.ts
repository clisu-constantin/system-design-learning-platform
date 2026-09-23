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
