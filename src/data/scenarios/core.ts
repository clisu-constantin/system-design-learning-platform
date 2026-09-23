import type { Scenario } from './types';

export const coreScenarios: Scenario[] = [
  {
    slug: 'url-shortener',
    title: 'Design a URL Shortener',
    tagline: 'The classic starter: extreme read/write skew and a key-generation problem.',
    difficulty: 'Beginner',
    functional: [
      { label: 'Shorten a long URL into a short code', core: true },
      { label: 'Redirect a short code to the original URL', core: true },
      { label: 'Custom aliases', core: false, note: 'Adds a uniqueness check on user input' },
      { label: 'Expiration dates', core: false },
      { label: 'Click analytics', core: false, note: 'Best done asynchronously via a queue' },
    ],
    nonFunctional: [
      { label: 'Redirect latency', target: 'p99 < 50 ms', implication: 'Cache aggressively; redirect must not touch a cold database' },
      { label: 'Availability', target: '99.99% on redirects', implication: 'Redirects matter more than creation - degrade writes first' },
      { label: 'Durability', target: 'No lost mappings', implication: 'Replicated storage plus backups' },
      { label: 'Consistency', target: 'Read-your-writes on create', implication: 'Return the code only after a durable write' },
    ],
    capacity: [
      { label: 'New URLs', formula: '100M new URLs / month / 2.6M sec', result: '~40 writes/sec' },
      { label: 'Redirects (100:1 read ratio)', formula: '40 x 100', result: '~4,000 reads/sec' },
      { label: 'Peak reads', formula: '4,000 x 3', result: '~12,000 reads/sec' },
      { label: 'Storage', formula: '100M/month x 500 B x 12 months x 5 years', result: '~3 TB over 5 years' },
      { label: 'Cache working set', formula: '345M reads/day x 20% x 500 B', result: '~35 GB - fits in one Redis node' },
    ],
    highLevel: `Client
  |
  v
CDN / Edge  (301 responses can be cached)
  |
  v
Load Balancer -> API servers ---- write ----> Key generator + SQL/KV store
                     |
                     +---- read ----> Redis (code -> long URL)
                                        miss -> database
Click events -> queue -> analytics store`,
    database: {
      choice: 'Key-value store (DynamoDB / Cassandra) or a single relational table with a primary key on the code',
      reasoning:
        'Access is a point lookup by short code. There are no joins and no relationships, so the simplest possible key-value access pattern wins.',
      alternatives:
        'Postgres is entirely adequate at this volume and gives you transactions for custom aliases. Only move to a distributed KV store when one primary can no longer hold the write rate or the data.',
    },
    api: [
      { method: 'POST', path: '/api/urls', note: 'Body { url, alias?, expires_at? } -> 201 { code, short_url }. Use an idempotency key.' },
      { method: 'GET', path: '/{code}', note: '301/302 redirect. The hot path - served from cache.' },
      { method: 'GET', path: '/api/urls/{code}/stats', note: 'Aggregated click counts, eventually consistent.' },
      { method: 'DELETE', path: '/api/urls/{code}', note: 'Owner-only; invalidate the cache entry.' },
    ],
    scaling: [
      'Reads dominate 100:1 - scale the read path with cache and replicas, not the write path.',
      'Generate codes with a counter encoded in base62 (no collision check) or random 7 chars with a uniqueness check.',
      'Range-allocate counter blocks per instance so id generation needs no coordination per request.',
      'Stateless API servers behind a load balancer; autoscale on request rate.',
    ],
    caching: [
      'Redis holding code -> long URL with a long TTL; hit rate should exceed 95% because access is heavily skewed.',
      '301 responses are cacheable by browsers and CDNs - use 302 if you need every click counted.',
      'Warm the cache on write so the first click after creation is also a hit.',
    ],
    reliability: [
      'Redirect path degrades gracefully: if analytics or the database is down, serve from cache.',
      'Creation can fail without taking down redirects - separate the paths.',
      'Multi-AZ database with automated failover; backups tested by restore.',
    ],
    bottlenecks: [
      { problem: 'Single database serving 12k redirect reads/sec', solution: 'Cache-aside with Redis; add read replicas for misses' },
      { problem: 'Code collisions under random generation', solution: 'Counter-based ids, or retry on unique-constraint violation' },
      { problem: 'Analytics writes competing with redirects', solution: 'Emit click events to a queue and aggregate offline' },
    ],
    tradeoffs: [
      {
        approach: 'Counter-based codes',
        gains: ['No collisions', 'Shortest possible codes', 'No extra read on write'],
        costs: ['Sequential and enumerable - anyone can walk your URLs', 'Needs a distributed counter or block allocation'],
      },
      {
        approach: 'Random codes',
        gains: ['Not enumerable', 'No shared counter'],
        costs: ['Needs a uniqueness check per insert', 'Collision probability grows as the space fills'],
      },
      {
        approach: '301 permanent redirect',
        gains: ['Browsers and CDNs cache it - almost no traffic reaches you'],
        costs: ['You lose per-click analytics', 'Changing the target later is very hard'],
      },
    ],
    concepts: ['caching', 'database-indexing', 'rate-limiting', 'capacity-estimation', 'cdn'],
  },
  {
    slug: 'instagram',
    title: 'Design Instagram',
    tagline: 'Media storage, feed generation and the celebrity problem.',
    difficulty: 'Intermediate',
    functional: [
      { label: 'Upload a photo with a caption', core: true },
      { label: 'Follow other users', core: true },
      { label: 'View a home feed of followed accounts', core: true },
      { label: 'Like and comment', core: true },
      { label: 'Stories', core: false, note: 'Different retention and read pattern' },
      { label: 'Direct messages', core: false, note: 'A chat system - see the WhatsApp scenario' },
    ],
    nonFunctional: [
      { label: 'Feed latency', target: 'p95 < 200 ms', implication: 'Precomputed timelines, not joins at read time' },
      { label: 'Availability', target: '99.9%+, reads over writes', implication: 'Feed must render even if uploads are failing' },
      { label: 'Consistency', target: 'Eventual for feeds', implication: 'A post appearing seconds later is acceptable' },
      { label: 'Durability', target: 'Never lose an uploaded photo', implication: 'Object storage with cross-region replication' },
    ],
    capacity: [
      { label: 'Daily active users', formula: 'assume 500M DAU', result: '500,000,000' },
      { label: 'Uploads', formula: '500M x 0.1 posts/day / 86,400', result: '~580 uploads/sec' },
      { label: 'Feed reads', formula: '500M x 20 opens/day / 86,400', result: '~116,000 reads/sec' },
      { label: 'Media storage', formula: '50M posts/day x 2 MB (+ thumbnails)', result: '~100 TB/day' },
      { label: 'Fan-out writes', formula: '580 uploads/sec x ~200 avg followers', result: '~116,000 timeline writes/sec' },
    ],
    highLevel: `Client -> CDN (images, thumbnails)
   |
   v
API Gateway -> Post Service ---> Object Storage (originals)
                    |                 |
                    |            Queue -> Transcode workers -> CDN
                    v
              Fan-out Service -> Timeline store (Redis / wide-column)
                    |
Feed Service <------+   reads precomputed timeline ids
                    -> hydrate post metadata from cache/DB`,
    database: {
      choice: 'Wide-column or key-value store for timelines, relational or document store for post metadata, object storage plus CDN for media',
      reasoning:
        'Timelines are append-and-read-recent per user - exactly what a partitioned log-structured store does well. Media never belongs in a database.',
      alternatives:
        'Redis lists work for timelines at moderate scale and are simpler to operate. Post metadata is fine in Postgres for a long time.',
    },
    api: [
      { method: 'POST', path: '/api/posts', note: 'Presigned upload to object storage, then metadata write' },
      { method: 'GET', path: '/api/feed?cursor=', note: 'Cursor pagination over the precomputed timeline' },
      { method: 'POST', path: '/api/users/{id}/follow', note: 'Triggers backfill or nothing, depending on fan-out strategy' },
      { method: 'POST', path: '/api/posts/{id}/likes', note: 'Denormalised counter updated asynchronously' },
    ],
    scaling: [
      'Fan-out on write for normal accounts: push the post id into each follower timeline.',
      'Fan-out on read for accounts with millions of followers - merge them in at read time.',
      'Media is uploaded directly to object storage with presigned URLs so it never passes through the API tier.',
      'Transcoding and thumbnailing happen in workers off a queue.',
    ],
    caching: [
      'CDN for all media - this is the majority of bytes served.',
      'Redis for hot timelines and post metadata.',
      'Counters (likes, comments) denormalised and updated asynchronously.',
    ],
    reliability: [
      'Uploads are idempotent with a client-generated id so retries do not duplicate posts.',
      'Feed degrades to a smaller page or a cached version rather than erroring.',
      'Object storage replicated across regions; metadata database multi-AZ.',
    ],
    bottlenecks: [
      { problem: 'A celebrity post fanning out to 50M timelines', solution: 'Hybrid fan-out: do not push for very large accounts, merge on read' },
      { problem: 'Feed queries joining posts, users and likes at read time', solution: 'Precompute timelines and denormalise counters' },
      { problem: 'Image traffic saturating origin bandwidth', solution: 'Serve everything from the CDN with long TTLs and hashed URLs' },
    ],
    tradeoffs: [
      {
        approach: 'Fan-out on write',
        gains: ['Feed read is a single lookup', 'Predictable read latency'],
        costs: ['Huge write amplification', 'Celebrity problem', 'Storage duplication'],
      },
      {
        approach: 'Fan-out on read',
        gains: ['Cheap writes', 'No duplication'],
        costs: ['Expensive reads merging hundreds of sources', 'Unpredictable p99'],
      },
      {
        approach: 'Hybrid',
        gains: ['Handles both normal and celebrity accounts'],
        costs: ['Two code paths to build, test and monitor'],
      },
    ],
    concepts: ['fan-out', 'cdn', 'caching', 'sharding', 'message-queues', 'denormalization'],
  },
  {
    slug: 'whatsapp',
    title: 'Design WhatsApp',
    tagline: 'Persistent connections, delivery guarantees and ordering.',
    difficulty: 'Advanced',
    functional: [
      { label: 'Send and receive 1:1 messages', core: true },
      { label: 'Group conversations', core: true },
      { label: 'Delivery and read receipts', core: true },
      { label: 'Online presence / last seen', core: true },
      { label: 'Media messages', core: false, note: 'Object storage plus CDN, same as any media system' },
      { label: 'Voice and video calls', core: false, note: 'A media-server problem, not a messaging one' },
    ],
    nonFunctional: [
      { label: 'Delivery latency', target: 'p95 < 300 ms when both online', implication: 'Persistent connections, not polling' },
      { label: 'Reliability', target: 'No message lost', implication: 'Persist before acknowledging; retry until delivered' },
      { label: 'Ordering', target: 'Per conversation', implication: 'Sequence numbers per chat, not a global order' },
      { label: 'Availability', target: '99.99%', implication: 'Multi-region gateways, queued offline delivery' },
    ],
    capacity: [
      { label: 'Users online', formula: '500M concurrent connections', result: 'Thousands of gateway nodes' },
      { label: 'Messages', formula: '100B messages/day / 86,400', result: '~1.1M messages/sec average' },
      { label: 'Peak', formula: '1.1M x 3', result: '~3.5M messages/sec' },
      { label: 'Connections per node', formula: '500M / 100k per node', result: '~5,000 gateway nodes' },
      { label: 'Storage (undelivered only)', formula: 'small - messages deleted after delivery', result: 'Bounded by offline users' },
    ],
    highLevel: `Client --WebSocket--> Connection Gateway (stateful: holds the socket)
                             |
                             v
                      Message Service --> Message store (undelivered)
                             |
                             +--> Pub/Sub (route to the gateway holding the recipient)
                             |
                             +--> Push notification service (recipient offline)
Session registry: user -> gateway node`,
    database: {
      choice: 'Wide-column store for message history and a fast key-value registry mapping user -> connected gateway',
      reasoning:
        'Writes dominate, access is per conversation ordered by time, and rows are small - the classic wide-column access pattern.',
      alternatives:
        'If messages are deleted after delivery, the store is small and a replicated relational database is enough.',
    },
    api: [
      { method: 'WS', path: '/ws', note: 'Persistent connection; frames for send, ack, receipt, typing, presence' },
      { method: 'POST', path: '/api/messages', note: 'Fallback HTTP send with a client message id for deduplication' },
      { method: 'GET', path: '/api/conversations/{id}/messages?before=', note: 'History pagination' },
      { method: 'POST', path: '/api/groups/{id}/members', note: 'Group membership changes' },
    ],
    scaling: [
      'The connection tier is stateful: route by user, and keep a registry of which node holds each connection.',
      'Group messages fan out to member connections; very large groups need batching and rate limits.',
      'Shard message storage by conversation id so a chat stays on one partition.',
      'Deploy gateways close to users; a deploy must drain connections gradually to avoid a reconnect storm.',
    ],
    caching: [
      'Presence and session registry in Redis with short TTLs.',
      'Recent messages cached per active conversation for fast history loads.',
    ],
    reliability: [
      'Persist a message before acknowledging the sender - the ack means durable, not delivered.',
      'Client-generated message ids make retries idempotent and deduplicate at the recipient.',
      'Undelivered messages queue until the recipient reconnects, then are pushed and deleted.',
      'Fall back to mobile push notifications when the socket is gone.',
    ],
    bottlenecks: [
      { problem: 'Millions of concurrent connections per region', solution: 'Many small gateway nodes, connection-aware routing, careful memory per socket' },
      { problem: 'Fan-out to a 1,000-member group', solution: 'Batch delivery, per-group rate limits, asynchronous receipts' },
      { problem: 'Reconnect storm after a deploy or network blip', solution: 'Staggered draining plus client reconnect with exponential backoff and jitter' },
    ],
    tradeoffs: [
      {
        approach: 'WebSockets',
        gains: ['True push, low per-message overhead', 'Bidirectional'],
        costs: ['Stateful tier', 'Memory per connection', 'Deploys disrupt every client'],
      },
      {
        approach: 'Long polling fallback',
        gains: ['Works through hostile proxies'],
        costs: ['Higher overhead per message', 'More server resources'],
      },
      {
        approach: 'Store messages forever',
        gains: ['Full history on every device'],
        costs: ['Enormous storage growth', 'Privacy and compliance obligations'],
      },
    ],
    concepts: ['websockets', 'stateful-applications', 'pub-sub', 'idempotency', 'exponential-backoff'],
  },
  {
    slug: 'youtube',
    title: 'Design YouTube',
    tagline: 'Asynchronous transcoding pipelines and bandwidth as the real cost.',
    difficulty: 'Advanced',
    functional: [
      { label: 'Upload a video', core: true },
      { label: 'Transcode into multiple resolutions', core: true },
      { label: 'Stream with adaptive bitrate', core: true },
      { label: 'Search and recommendations', core: false, note: 'A separate search/ML system' },
      { label: 'Comments and likes', core: false },
    ],
    nonFunctional: [
      { label: 'Startup latency', target: '< 2 s to first frame', implication: 'Segments served from a nearby CDN edge' },
      { label: 'Availability', target: '99.95% for playback', implication: 'Playback must survive upload pipeline outages' },
      { label: 'Durability', target: 'Never lose an uploaded original', implication: 'Replicated object storage, keep the source file' },
      { label: 'Cost', target: 'Bandwidth is the dominant cost', implication: 'Cache hit ratio at the edge is the key business metric' },
    ],
    capacity: [
      { label: 'Uploads', formula: '500 hours/min -> 30,000 hours/hour', result: 'Massive, bursty transcoding load' },
      { label: 'Views', formula: '5B views/day / 86,400', result: '~58,000 views/sec' },
      { label: 'Bandwidth', formula: '58,000 starts/sec x ~300 s watched x 3 Mbps', result: '~17M concurrent, ~50 Tbps (CDN, not origin)' },
      { label: 'Storage per video', formula: 'original + 6 renditions ~ 3x original', result: 'Petabytes per month' },
    ],
    highLevel: `Upload -> presigned URL -> Object Storage (original)
                                   |
                              Queue (chunks)
                                   |
                     Transcode workers (per resolution, parallel)
                                   |
                       Segmented output (HLS/DASH) -> Object Storage
                                   |
                                  CDN  <---- players request segments
Metadata Service -> catalogue DB (title, status, thumbnails)`,
    database: {
      choice: 'Object storage for media, relational or document store for metadata, a separate index for search',
      reasoning:
        'Video bytes are immutable blobs best served by storage plus CDN. Only the small metadata record needs a queryable database.',
      alternatives: 'A wide-column store for view counts and watch history, which are write-heavy and append-only.',
    },
    api: [
      { method: 'POST', path: '/api/videos', note: 'Create a record, return a presigned upload URL' },
      { method: 'GET', path: '/api/videos/{id}', note: 'Metadata plus manifest URL; status may be "processing"' },
      { method: 'GET', path: '/hls/{id}/{rendition}/{segment}.ts', note: 'Segment fetch - served by the CDN' },
      { method: 'POST', path: '/api/videos/{id}/views', note: 'Batched and aggregated asynchronously' },
    ],
    scaling: [
      'Split each video into chunks and transcode them in parallel across a worker fleet.',
      'Adaptive bitrate lets the client pick a rendition, which keeps playback working on poor networks.',
      'Popular videos are pre-warmed at edges; the long tail is fetched on demand.',
      'View counting is aggregated in a stream processor, never written per view to a database.',
    ],
    caching: [
      'Almost all bytes come from the CDN - origin egress should be a small fraction of total traffic.',
      'Segments are immutable, so TTLs can be effectively infinite.',
      'Metadata and manifests cached briefly at the edge too.',
    ],
    reliability: [
      'Keep the original file so any rendition can be rebuilt after a pipeline bug.',
      'Transcoding jobs are idempotent and retried; partial output is discarded.',
      'Playback and upload are independent - an upload outage must not affect viewers.',
    ],
    bottlenecks: [
      { problem: 'Transcoding queue backlog during upload spikes', solution: 'Autoscale workers on queue depth; prioritise short videos and paying creators' },
      { problem: 'Origin bandwidth saturation', solution: 'Increase edge hit ratio, pre-warm popular content, use tiered caching' },
      { problem: 'View counter write amplification', solution: 'Aggregate in a stream processor and flush periodically' },
    ],
    tradeoffs: [
      {
        approach: 'Transcode everything on upload',
        gains: ['Instant playback in every rendition'],
        costs: ['Huge compute cost for videos nobody watches'],
      },
      {
        approach: 'Transcode on demand for rare renditions',
        gains: ['Much lower compute cost'],
        costs: ['First viewer of a rendition waits', 'More complex pipeline'],
      },
    ],
    concepts: ['message-queues', 'cdn', 'background-workers', 'auto-scaling', 'capacity-estimation'],
  },
];
