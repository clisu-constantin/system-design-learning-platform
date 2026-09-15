import type { Scenario } from './types';

export const moreScenarios: Scenario[] = [
  {
    slug: 'uber',
    title: 'Design Uber',
    tagline: 'Geospatial indexing, real-time matching and state machines that must not lose a trip.',
    difficulty: 'Advanced',
    functional: [
      { label: 'Drivers publish their location continuously', core: true },
      { label: 'Riders request a trip from A to B', core: true },
      { label: 'Match a rider with a nearby driver', core: true },
      { label: 'Track the trip live and complete it', core: true },
      { label: 'Fare estimation and payment', core: true },
      { label: 'Ride sharing / pooling', core: false, note: 'A much harder matching problem' },
    ],
    nonFunctional: [
      { label: 'Matching latency', target: '< 2 s to find a driver', implication: 'Geospatial index in memory, not SQL distance queries' },
      { label: 'Location freshness', target: '< 5 s', implication: 'High-frequency writes accepted into a fast store' },
      { label: 'Consistency', target: 'Strong for trip state and payment', implication: 'One authoritative trip record; no double assignment' },
      { label: 'Availability', target: '99.99% in active markets', implication: 'Regional isolation so one city outage is contained' },
    ],
    capacity: [
      { label: 'Active drivers', formula: '5M drivers online at peak', result: '5,000,000' },
      { label: 'Location updates', formula: '5M / 4 s interval', result: '~1.25M writes/sec' },
      { label: 'Trip requests', formula: '20M trips/day / 86,400 x 3 peak', result: '~700 requests/sec peak' },
      { label: 'Location payload', formula: '1.25M/s x 100 B', result: '~125 MB/sec ingest' },
    ],
    highLevel: `Driver app --location--> Ingest (gRPC/WS) -> Redis geo index (per city shard)
                                              |
Rider app --request--> Matching Service ------+ (query nearby drivers)
                              |
                              v
                        Trip Service  ->  Trip DB (authoritative state machine)
                              |
                              +--> Events -> pricing, ETA, notifications, analytics`,
    database: {
      choice: 'In-memory geospatial index (Redis GEO / QuadTree / H3 cells) for locations, relational store for trips and payments',
      reasoning:
        'Location data is high-volume, short-lived and queried by proximity. Trip and payment state is low-volume and needs transactions.',
      alternatives: 'A wide-column store for the location history archive, written asynchronously from the stream.',
    },
    api: [
      { method: 'WS', path: '/driver/location', note: 'Streaming location updates, ~1 every 4 seconds' },
      { method: 'POST', path: '/api/trips', note: 'Request a trip; idempotency key prevents duplicate requests' },
      { method: 'GET', path: '/api/trips/{id}', note: 'Current trip state and driver position' },
      { method: 'POST', path: '/api/trips/{id}/complete', note: 'Ends the trip and triggers payment, idempotent' },
    ],
    scaling: [
      'Shard everything by city or geohash prefix - trips almost never cross shards.',
      'Index locations by cell (geohash / H3) so "nearby" is a lookup of a few cells, never a table scan.',
      'Location writes go to memory; durable history is written asynchronously from the stream.',
      'Matching runs per shard, so it scales by adding cities independently.',
    ],
    caching: [
      'Driver positions live in memory with short TTLs - stale positions must disappear automatically.',
      'ETA and pricing surfaces cached per cell for a few seconds.',
    ],
    reliability: [
      'The trip is a state machine with a single authoritative record; transitions are idempotent.',
      'A driver may only be assigned to one active trip - enforced with a conditional update, not a read-then-write.',
      'Payments use idempotency keys and a saga with compensation for refunds.',
      'Each city region degrades independently; a failure in one does not stop another.',
    ],
    bottlenecks: [
      { problem: '1.25M location writes/sec against a relational database', solution: 'Write to an in-memory geo index; archive asynchronously' },
      { problem: 'Matching scanning all drivers in a city', solution: 'Cell-based index so only a handful of cells are examined' },
      { problem: 'Double-assigning a driver under concurrency', solution: 'Conditional update / compare-and-set on driver state' },
    ],
    tradeoffs: [
      {
        approach: 'In-memory location index',
        gains: ['Handles the write rate', 'Proximity queries in microseconds'],
        costs: ['Data lost on node failure (acceptable - it refreshes in seconds)', 'Memory sized to active drivers'],
      },
      {
        approach: 'Strongly consistent trip state',
        gains: ['No double bookings or lost trips'],
        costs: ['Coordination cost on every transition', 'Regional failover needs care'],
      },
    ],
    concepts: ['sharding', 'redis', 'idempotency', 'websockets', 'saga-pattern'],
  },
  {
    slug: 'notification-system',
    title: 'Design a Notification System',
    tagline: 'Fan-out, per-channel providers, retries and not spamming your users.',
    difficulty: 'Intermediate',
    functional: [
      { label: 'Send push, email and SMS notifications', core: true },
      { label: 'Per-user channel preferences and opt-outs', core: true },
      { label: 'Templates with variables and localisation', core: true },
      { label: 'Scheduled and recurring notifications', core: false },
      { label: 'Delivery and open tracking', core: false },
    ],
    nonFunctional: [
      { label: 'Throughput', target: 'Millions per campaign', implication: 'Queue-based fan-out with worker pools per channel' },
      { label: 'Latency', target: 'Transactional < 5 s, bulk best-effort', implication: 'Separate priority queues' },
      { label: 'Reliability', target: 'At-least-once with deduplication', implication: 'Idempotency keys per (user, event)' },
      { label: 'Compliance', target: 'Honour opt-outs absolutely', implication: 'Preference check inside the send path, not before enqueue' },
    ],
    capacity: [
      { label: 'Events', formula: '50M notifications/day / 86,400', result: '~580/sec average' },
      { label: 'Campaign burst', formula: '10M users in 10 minutes', result: '~17,000/sec peak' },
      { label: 'Worker pool', formula: '17,000 / 50 per worker per sec', result: '~340 workers at peak' },
    ],
    highLevel: `Event source -> Notification API -> [ priority queues ]
                                   transactional | bulk
                                          |
                        Fan-out workers (expand audience, apply preferences)
                                          |
                +----------------+--------+--------+----------------+
                v                v                 v                v
            Push worker     Email worker      SMS worker      In-app worker
                |                |                 |                |
            APNs/FCM         SES/SendGrid       Twilio         Websocket/DB
                            (rate limited, retried, dead-lettered)`,
    database: {
      choice: 'Relational store for templates, preferences and delivery records; a queue for the pipeline',
      reasoning:
        'Preferences are small, relational and must be correct. Delivery records are append-only and can be partitioned by time.',
      alternatives: 'A wide-column store if delivery receipts are retained at very high volume.',
    },
    api: [
      { method: 'POST', path: '/api/notifications', note: 'Body { template, audience, channel, dedupe_key } -> 202 Accepted' },
      { method: 'GET', path: '/api/notifications/{id}', note: 'Status: queued / sent / failed per channel' },
      { method: 'PUT', path: '/api/users/{id}/preferences', note: 'Channel opt-in/opt-out, quiet hours' },
    ],
    scaling: [
      'Separate queues per channel and per priority so a bulk campaign cannot delay a password reset.',
      'Fan-out expands an audience into individual messages in batches, not in one transaction.',
      'Autoscale workers on queue depth per channel.',
      'Respect provider rate limits with a token bucket per provider.',
    ],
    caching: ['User preferences cached with short TTLs, invalidated on change.', 'Rendered templates cached per locale.'],
    reliability: [
      'Dedupe on (user, event, channel) so a retry never double-sends.',
      'Retry with exponential backoff; dead-letter after a bounded number of attempts.',
      'Circuit-break a failing provider and fail over to a secondary where the channel allows it.',
      'Quiet hours and frequency caps enforced at send time.',
    ],
    bottlenecks: [
      { problem: 'A campaign starving transactional notifications', solution: 'Separate priority queues and worker pools' },
      { problem: 'Provider rate limits causing mass failures', solution: 'Token bucket per provider plus backoff on 429' },
      { problem: 'Duplicate sends after a worker crash', solution: 'Idempotency key checked before dispatch' },
    ],
    tradeoffs: [
      {
        approach: 'At-least-once delivery',
        gains: ['Nothing is lost if a worker dies'],
        costs: ['Duplicates possible - deduplication is mandatory'],
      },
      {
        approach: 'At-most-once delivery',
        gains: ['Never sends twice'],
        costs: ['Notifications can be silently lost'],
      },
    ],
    concepts: ['message-queues', 'rate-limiting', 'idempotency', 'circuit-breaker', 'background-workers'],
  },
  {
    slug: 'netflix',
    title: 'Design Netflix',
    tagline: 'Pre-positioned content, personalised rows and graceful degradation.',
    difficulty: 'Advanced',
    functional: [
      { label: 'Browse a personalised home page', core: true },
      { label: 'Stream a title with adaptive bitrate', core: true },
      { label: 'Resume playback across devices', core: true },
      { label: 'Search the catalogue', core: false },
      { label: 'Downloads for offline viewing', core: false },
    ],
    nonFunctional: [
      { label: 'Startup time', target: '< 1.5 s', implication: 'Manifests and first segments must come from a nearby edge' },
      { label: 'Availability', target: 'Playback above all else', implication: 'Home page degrades to a non-personalised version before playback fails' },
      { label: 'Rebuffer ratio', target: 'Near zero', implication: 'Adaptive bitrate plus edge placement' },
    ],
    capacity: [
      { label: 'Concurrent streams', formula: 'assume 10M peak', result: '10,000,000' },
      { label: 'Bandwidth', formula: '10M x 4 Mbps', result: '~40 Tbps - entirely from edge caches' },
      { label: 'Home page requests', formula: '200M sessions/day / 86,400 x 4 peak', result: '~9,000/sec' },
      { label: 'Playback events', formula: 'heartbeat every 30 s x 10M', result: '~330,000 events/sec' },
    ],
    highLevel: `Client -> Edge appliances (content pre-positioned inside ISP networks)
   |
   v
API tier -> Personalisation service (precomputed rows per profile)
              |         |
          Redis      Recommendation pipeline (offline, batch)
   |
   +-> Playback service -> licence + manifest
   +-> Viewing history service (write-heavy, eventually consistent)`,
    database: {
      choice: 'Wide-column store for viewing history and per-profile rows, relational for catalogue and billing',
      reasoning:
        'Viewing history is enormous, append-only and read by profile. Catalogue and billing are small, relational and transactional.',
      alternatives: 'Precomputed personalisation rows can live in Redis if the working set fits.',
    },
    api: [
      { method: 'GET', path: '/api/home', note: 'Precomputed rows per profile; falls back to popular content' },
      { method: 'GET', path: '/api/titles/{id}/manifest', note: 'Renditions and segment URLs' },
      { method: 'POST', path: '/api/playback/heartbeat', note: 'Batched, fire-and-forget resume position' },
    ],
    scaling: [
      'Recommendations are computed offline in batch and stored as ready-to-serve rows - never computed per request.',
      'Content is pre-positioned at edges before release, not pulled on first view.',
      'Playback heartbeats are batched and written asynchronously.',
    ],
    caching: [
      'Video segments cached at ISP-level edges with effectively infinite TTLs.',
      'Home rows cached per profile with a short TTL and a non-personalised fallback.',
    ],
    reliability: [
      'Every non-playback dependency has a fallback: generic rows, cached metadata, default artwork.',
      'Chaos testing verifies that losing a dependency degrades rather than breaks.',
      'Regional failover for the control plane; playback continues from edges meanwhile.',
    ],
    bottlenecks: [
      { problem: 'Personalisation computed at request time', solution: 'Precompute rows offline and serve them from a fast store' },
      { problem: 'Origin egress during a popular release', solution: 'Pre-position content at edges ahead of launch' },
      { problem: 'Heartbeat writes overwhelming the history store', solution: 'Batch client-side, aggregate in a stream, write periodically' },
    ],
    tradeoffs: [
      {
        approach: 'Precomputed personalisation',
        gains: ['Fast, predictable home page', 'Recommendation cost moved offline'],
        costs: ['Rows are hours stale', 'Storage per profile'],
      },
      {
        approach: 'Real-time personalisation',
        gains: ['Reacts instantly to what you just watched'],
        costs: ['Expensive per request', 'Hard latency ceiling'],
      },
    ],
    concepts: ['cdn', 'caching', 'fault-tolerance', 'denormalization', 'metrics'],
  },
  {
    slug: 'ecommerce',
    title: 'Design an E-commerce Platform',
    tagline: 'Inventory correctness against a read-heavy catalogue.',
    difficulty: 'Intermediate',
    functional: [
      { label: 'Browse and search the catalogue', core: true },
      { label: 'Add to cart', core: true },
      { label: 'Place an order and pay', core: true },
      { label: 'Reserve inventory so it cannot be oversold', core: true },
      { label: 'Reviews and recommendations', core: false },
    ],
    nonFunctional: [
      { label: 'Catalogue latency', target: 'p95 < 150 ms', implication: 'Heavy caching and a search index' },
      { label: 'Inventory correctness', target: 'Never oversell', implication: 'Strong consistency and conditional updates on the stock row' },
      { label: 'Checkout availability', target: '99.99%', implication: 'Checkout must work even when recommendations are down' },
      { label: 'Payment consistency', target: 'Exactly-once effect', implication: 'Idempotency keys plus a saga for order fulfilment' },
    ],
    capacity: [
      { label: 'Catalogue views', formula: '50M views/day / 86,400 x 5 peak', result: '~2,900/sec peak' },
      { label: 'Orders', formula: '500k orders/day / 86,400 x 10 peak (sale)', result: '~58/sec peak' },
      { label: 'Read/write ratio', formula: '2,900 : 58', result: '~50:1 - cache the reads' },
    ],
    highLevel: `Client -> CDN (images, static)
   |
   v
API Gateway -> Catalogue Service -> Redis -> Product DB
            -> Search Service    -> Search index
            -> Cart Service      -> Redis (cart state, TTL)
            -> Order Service     -> Orders DB (transactional)
                     |
                     +-> Saga: reserve stock -> charge payment -> schedule fulfilment
                                 (each step compensable and idempotent)`,
    database: {
      choice: 'Relational database for orders, payments and inventory; cache plus search index for the catalogue',
      reasoning:
        'Inventory and orders need transactions and invariants. The catalogue is read-heavy and tolerates staleness, so it belongs in a cache and an index.',
      alternatives: 'A document store for product data if attributes vary wildly per category.',
    },
    api: [
      { method: 'GET', path: '/api/products?q=&facets=', note: 'Served by the search index, cached' },
      { method: 'POST', path: '/api/cart/items', note: 'Cart lives in Redis with a TTL; no stock reserved yet' },
      { method: 'POST', path: '/api/orders', note: 'Idempotency key required; starts the checkout saga' },
      { method: 'GET', path: '/api/orders/{id}', note: 'Order status as the saga progresses' },
    ],
    scaling: [
      'Catalogue reads scale through CDN, cache and read replicas.',
      'Checkout is the transactional core and stays deliberately small.',
      'Flash sales need queue-based admission control rather than raw capacity.',
    ],
    caching: [
      'Product pages cached with short TTLs and purged on price or stock-state change.',
      'Never cache the authoritative stock count - cache "in stock / low stock" instead.',
    ],
    reliability: [
      'Reserve stock with a conditional decrement; if it fails, the item is sold out.',
      'Reservations expire so abandoned checkouts release inventory.',
      'The checkout saga compensates: refund payment and release stock if fulfilment fails.',
      'Payment calls are idempotent and circuit-broken.',
    ],
    bottlenecks: [
      { problem: 'Hot product row during a flash sale', solution: 'Queue admission, shard stock into buckets, or reserve in a fast atomic store' },
      { problem: 'Catalogue queries hitting the transactional database', solution: 'Search index plus cache in front of it' },
      { problem: 'Payment provider latency during peaks', solution: 'Asynchronous capture with a saga and clear pending-order UX' },
    ],
    tradeoffs: [
      {
        approach: 'Reserve stock at checkout start',
        gains: ['Never oversell', 'Clear user experience'],
        costs: ['Abandoned carts hold inventory until expiry', 'Contention on hot rows'],
      },
      {
        approach: 'Reserve at payment confirmation',
        gains: ['No inventory held by browsers'],
        costs: ['Users can be told "sold out" after paying - requires refunds'],
      },
    ],
    concepts: ['caching', 'saga-pattern', 'idempotency', 'strong-consistency', 'read-replicas'],
  },
];
