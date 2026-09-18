import type { VisualSpec } from '@/components/architecture/FlowVisual';

/** Networking, async, reliability, distributed, architecture, security, observability. */
export const systemVisuals: Record<string, VisualSpec> = {
  // ---- Networking ---------------------------------------------------------
  dns: {
    width: 800,
    height: 280,
    caption: 'Cached at every hop. That is why changing a record is not instant.',
    nodes: [
      { id: 'browser', kind: 'client', label: 'Browser cache', x: 30, y: 100, w: 160, h: 74 },
      { id: 'resolver', kind: 'dns', label: 'Resolver', sub: 'recursive', x: 240, y: 100, w: 150, h: 80 },
      { id: 'tld', kind: 'dns', label: '.com TLD', x: 440, y: 25, w: 150, h: 74 },
      { id: 'auth', kind: 'dns', label: 'Authoritative', sub: 'A record, TTL 60s', x: 440, y: 180, w: 180, h: 80 },
      { id: 'ip', kind: 'server', label: '93.184.216.34', x: 640, y: 100, w: 145, h: 74 },
    ],
    edges: [
      { from: 'browser', to: 'resolver', tone: 'brand', rate: 2.2 },
      { from: 'resolver', to: 'tld', tone: 'violet', rate: 1.2 },
      { from: 'tld', to: 'auth', tone: 'violet', rate: 1.2 },
      { from: 'auth', to: 'ip', tone: 'ok', rate: 1.4 },
    ],
    steps: [
      { from: 'browser', to: 'resolver', label: 'Cache miss, ask resolver' },
      { from: 'resolver', to: 'tld', label: 'Walk to the .com TLD' },
      { from: 'tld', to: 'auth', label: 'Ask the authoritative server' },
      { from: 'auth', to: 'ip', label: 'Answer cached for the TTL' },
    ],
  },

  cdn: {
    width: 760,
    height: 332,
    caption: 'Most users are served from an edge a few milliseconds away. Only misses reach the origin.',
    nodes: [
      { id: 'origin', kind: 'server', label: 'Origin', sub: 'us-east', x: 305, y: 12, w: 150, h: 80 },
      { id: 'eu', kind: 'cdn', label: 'Europe edge', x: 40, y: 130, w: 160, h: 84, stat: ['RTT', '11 ms'] },
      { id: 'us', kind: 'cdn', label: 'US edge', x: 300, y: 130, w: 160, h: 84, stat: ['RTT', '10 ms'] },
      { id: 'ap', kind: 'cdn', label: 'Asia edge', x: 560, y: 130, w: 160, h: 84, stat: ['RTT', '13 ms'] },
      { id: 'users', kind: 'client', label: 'Users worldwide', x: 290, y: 250, w: 180, h: 68 },
    ],
    edges: [
      { from: 'users', to: 'eu', tone: 'ok', rate: 2 },
      { from: 'users', to: 'us', tone: 'ok', rate: 2.2 },
      { from: 'users', to: 'ap', tone: 'ok', rate: 1.8 },
      { from: 'eu', to: 'origin', tone: 'muted', dashed: true, rate: 0.3, label: 'on miss' },
      { from: 'ap', to: 'origin', tone: 'muted', dashed: true, rate: 0.3 },
    ],
    steps: [
      { from: 'users', to: 'ap', label: 'User routed to nearest edge', outcome: 'cache-hit' },
      { from: 'ap', to: 'origin', label: 'Only a miss goes to origin', outcome: 'warning' },
      { from: 'users', to: 'eu', label: '13 ms instead of 220 ms', outcome: 'cache-hit' },
    ],
  },

  'cdn-caching': {
    width: 760,
    height: 280,
    caption: 'Cache key plus TTL decide the hit rate - not the vendor.',
    nodes: [
      { id: 'user', kind: 'client', label: 'GET /app.a91f.js', x: 40, y: 100, w: 180, h: 74 },
      { id: 'edge', kind: 'cdn', label: 'Edge cache', sub: 'max-age 1 year', x: 300, y: 95, w: 170, h: 96, stat: ['Hit rate', '98%'] },
      { id: 'origin', kind: 'server', label: 'Origin', x: 570, y: 100, w: 150, h: 74 },
    ],
    edges: [
      { from: 'user', to: 'edge', tone: 'brand', rate: 4 },
      { from: 'edge', to: 'origin', tone: 'muted', dashed: true, rate: 0.2, label: 'rarely' },
    ],
  },

  'api-gateway': {
    width: 760,
    height: 330,
    caption: 'Auth and limits are applied once, before anything reaches a service.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 40, y: 125, w: 140, h: 74 },
      { id: 'gw', kind: 'api-gateway', label: 'API Gateway', sub: 'JWT - limits - routing', x: 270, y: 110, w: 190, h: 96 },
      { id: 'users', kind: 'service', label: 'Users', x: 570, y: 20, w: 150, h: 74 },
      { id: 'orders', kind: 'service', label: 'Orders', x: 570, y: 125, w: 150, h: 74 },
      { id: 'pay', kind: 'service', label: 'Payments', x: 570, y: 230, w: 150, h: 74 },
    ],
    edges: [
      { from: 'client', to: 'gw', tone: 'brand', rate: 4 },
      { from: 'gw', to: 'users', tone: 'ok', rate: 1.2 },
      { from: 'gw', to: 'orders', tone: 'ok', rate: 2 },
      { from: 'gw', to: 'pay', tone: 'ok', rate: 1 },
    ],
    steps: [
      { from: 'client', to: 'gw', label: 'GET /api/orders/123' },
      { from: 'gw', to: 'orders', label: 'Token valid, quota free' },
      { from: 'gw', to: 'pay', label: 'Invalid token: 401 here', outcome: 'failure' },
    ],
  },

  'reverse-proxy': {
    width: 760,
    height: 300,
    caption: 'One front door: TLS, routing and caching before your code runs.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 40, y: 110, w: 140, h: 74 },
      { id: 'proxy', kind: 'api-gateway', label: 'Reverse proxy', sub: 'TLS terminated', x: 260, y: 105, w: 180, h: 84 },
      { id: 'api', kind: 'server', label: '/api', x: 560, y: 20, w: 160, h: 74 },
      { id: 'static', kind: 'storage', label: '/static', x: 560, y: 115, w: 160, h: 74 },
      { id: 'ws', kind: 'service', label: '/ws', x: 560, y: 210, w: 160, h: 74 },
    ],
    edges: [
      { from: 'client', to: 'proxy', tone: 'brand', rate: 4 },
      { from: 'proxy', to: 'api', tone: 'ok', rate: 2 },
      { from: 'proxy', to: 'static', tone: 'ok', rate: 1.6 },
      { from: 'proxy', to: 'ws', tone: 'ok', rate: 0.8 },
    ],
  },

  'forward-proxy': {
    width: 760,
    height: 260,
    caption: 'A forward proxy represents the client; a reverse proxy represents the server.',
    nodes: [
      { id: 'c1', kind: 'client', label: 'Employee laptop', x: 40, y: 30, w: 170, h: 74 },
      { id: 'c2', kind: 'client', label: 'CI runner', x: 40, y: 140, w: 170, h: 74 },
      { id: 'proxy', kind: 'api-gateway', label: 'Forward proxy', sub: 'policy + audit', x: 300, y: 85, w: 180, h: 84 },
      { id: 'net', kind: 'cdn', label: 'Internet', x: 580, y: 85, w: 150, h: 78 },
    ],
    edges: [
      { from: 'c1', to: 'proxy', tone: 'brand', rate: 2 },
      { from: 'c2', to: 'proxy', tone: 'brand', rate: 1.6 },
      { from: 'proxy', to: 'net', tone: 'ok', rate: 2.6 },
    ],
  },

  'http-https': {
    width: 760,
    height: 260,
    caption: 'Method and status carry meaning that proxies, caches and clients all act on.',
    nodes: [
      { id: 'client', kind: 'client', label: 'GET /products/42', x: 40, y: 90, w: 180, h: 76 },
      { id: 'cache', kind: 'cdn', label: 'Cache-Control', sub: 'max-age 300', x: 300, y: 85, w: 170, h: 84 },
      { id: 'server', kind: 'server', label: '200 OK', sub: 'ETag "a91f"', x: 560, y: 90, w: 160, h: 80 },
    ],
    edges: [
      { from: 'client', to: 'cache', tone: 'brand', rate: 3.4 },
      { from: 'cache', to: 'server', tone: 'violet', rate: 0.8, label: 'revalidate' },
    ],
  },

  'tcp-vs-udp': {
    width: 760,
    height: 280,
    caption: 'TCP retransmits and reorders. UDP just keeps sending.',
    nodes: [
      { id: 'send', kind: 'client', label: 'Sender', x: 40, y: 100, w: 150, h: 76 },
      { id: 'tcp', kind: 'server', label: 'TCP', sub: 'ordered, retried', x: 300, y: 25, w: 170, h: 80 },
      { id: 'udp', kind: 'server', label: 'UDP', sub: 'no guarantees', x: 300, y: 175, w: 170, h: 80 },
      { id: 'recv', kind: 'client', label: 'Receiver', x: 570, y: 100, w: 150, h: 76 },
    ],
    edges: [
      { from: 'send', to: 'tcp', tone: 'ok', rate: 2 },
      { from: 'tcp', to: 'recv', tone: 'ok', rate: 2 },
      { from: 'send', to: 'udp', tone: 'warn', rate: 3.4 },
      { from: 'udp', to: 'recv', tone: 'warn', rate: 2.8, outcome: 'warning' },
    ],
  },

  'what-happens-when-you-type-a-url': {
    width: 760,
    height: 352,
    caption: 'Twelve stages. The first four happen before your server does any work.',
    nodes: [
      { id: 'browser', kind: 'client', label: 'Browser', x: 30, y: 30, w: 140, h: 70 },
      { id: 'dns', kind: 'dns', label: 'DNS', sub: '60 ms', x: 220, y: 30, w: 130, h: 80 },
      { id: 'tls', kind: 'api-gateway', label: 'TCP + TLS', sub: '90 ms', x: 400, y: 30, w: 150, h: 80 },
      { id: 'cdn', kind: 'cdn', label: 'CDN edge', x: 600, y: 30, w: 130, h: 70 },
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', x: 590, y: 160, w: 150, h: 70 },
      { id: 'api', kind: 'server', label: 'Backend', x: 390, y: 160, w: 150, h: 70 },
      { id: 'cache', kind: 'cache', label: 'Cache', x: 210, y: 160, w: 140, h: 70 },
      { id: 'db', kind: 'sql', label: 'Database', x: 210, y: 270, w: 140, h: 68 },
      { id: 'render', kind: 'client', label: 'Render', sub: '120 ms', x: 30, y: 160, w: 140, h: 80 },
    ],
    edges: [
      { from: 'browser', to: 'dns', tone: 'brand', rate: 1.4 },
      { from: 'dns', to: 'tls', tone: 'brand', rate: 1.4 },
      { from: 'tls', to: 'cdn', tone: 'violet', rate: 1.4 },
      { from: 'cdn', to: 'lb', tone: 'violet', rate: 1, dashed: true },
      { from: 'lb', to: 'api', tone: 'ok', rate: 1.2 },
      { from: 'api', to: 'cache', tone: 'danger', rate: 1.2, outcome: 'cache-hit' },
      { from: 'cache', to: 'db', tone: 'muted', rate: 0.4, dashed: true },
      { from: 'cache', to: 'render', tone: 'ok', rate: 1.2 },
    ],
    steps: [
      { from: 'browser', to: 'dns', label: 'Resolve the hostname' },
      { from: 'dns', to: 'tls', label: 'Connect and encrypt' },
      { from: 'tls', to: 'cdn', label: 'Nearest edge answers' },
      { from: 'cdn', to: 'lb', label: 'Miss reaches your stack' },
      { from: 'lb', to: 'api', label: 'A healthy server handles it' },
      { from: 'api', to: 'cache', label: 'Cache hit, no query', outcome: 'cache-hit' },
      { from: 'cache', to: 'render', label: 'Browser paints the page' },
    ],
  },

  // ---- Async --------------------------------------------------------------
  'message-queues': {
    width: 760,
    height: 320,
    caption: '100 msg/sec in, 60 msg/sec out. The queue absorbs a burst, not a permanent deficit.',
    nodes: [
      { id: 'producer', kind: 'server', label: 'Producer', sub: '100 msg/sec', x: 40, y: 115, w: 160, h: 80 },
      { id: 'queue', kind: 'queue', label: 'Queue', sub: 'depth 240 and growing', x: 280, y: 105, w: 190, h: 96, stat: ['Wait', '4 s'], alert: true },
      { id: 'w1', kind: 'worker', label: 'Worker 1', x: 560, y: 15, w: 160, h: 84, stat: ['Rate', '20/s'] },
      { id: 'w2', kind: 'worker', label: 'Worker 2', x: 560, y: 115, w: 160, h: 84, stat: ['Rate', '20/s'] },
      { id: 'w3', kind: 'worker', label: 'Worker 3', x: 560, y: 215, w: 160, h: 84, stat: ['Rate', '20/s'] },
    ],
    edges: [
      { from: 'producer', to: 'queue', tone: 'brand', rate: 5 },
      { from: 'queue', to: 'w1', tone: 'ok', rate: 1 },
      { from: 'queue', to: 'w2', tone: 'ok', rate: 1 },
      { from: 'queue', to: 'w3', tone: 'ok', rate: 1 },
    ],
    steps: [
      { from: 'producer', to: 'queue', label: 'Producer never waits' },
      { from: 'queue', to: 'w1', label: 'Workers pull at their pace' },
      { from: 'queue', to: 'w2', label: 'Consumption below arrivals', outcome: 'warning' },
      { from: 'queue', to: 'w3', label: 'Depth grows 40 per second', outcome: 'warning' },
    ],
  },

  kafka: {
    asymmetric: 'Each partition is assigned to one consumer per group - that is how groups divide work.',
    width: 760,
    height: 310,
    caption: 'Ordered per partition, replayable, and read independently by each consumer group.',
    nodes: [
      { id: 'prod', kind: 'server', label: 'Producer', x: 40, y: 110, w: 150, h: 78 },
      { id: 'p0', kind: 'queue', label: 'Partition 0', x: 270, y: 20, w: 170, h: 74 },
      { id: 'p1', kind: 'queue', label: 'Partition 1', x: 270, y: 110, w: 170, h: 74 },
      { id: 'p2', kind: 'queue', label: 'Partition 2', x: 270, y: 200, w: 170, h: 74 },
      { id: 'ga', kind: 'worker', label: 'Group A', sub: 'offset 8,412', x: 540, y: 55, w: 180, h: 80 },
      { id: 'gb', kind: 'worker', label: 'Group B', sub: 'offset 120', x: 540, y: 175, w: 180, h: 80 },
    ],
    edges: [
      { from: 'prod', to: 'p0', tone: 'brand', rate: 1.4 },
      { from: 'prod', to: 'p1', tone: 'brand', rate: 1.4 },
      { from: 'prod', to: 'p2', tone: 'brand', rate: 1.4 },
      { from: 'p0', to: 'ga', tone: 'ok', rate: 1.4 },
      { from: 'p1', to: 'ga', tone: 'ok', rate: 1.2 },
      { from: 'p2', to: 'gb', tone: 'violet', rate: 1.2 },
    ],
  },

  'pub-sub': {
    width: 760,
    height: 300,
    caption: 'One event, every subscriber gets its own copy and its own backlog.',
    nodes: [
      { id: 'pub', kind: 'server', label: 'Publisher', sub: 'user.signed_up', x: 40, y: 110, w: 170, h: 80 },
      { id: 'topic', kind: 'queue', label: 'Topic', x: 300, y: 110, w: 150, h: 80 },
      { id: 's1', kind: 'worker', label: 'Welcome email', x: 550, y: 15, w: 180, h: 74 },
      { id: 's2', kind: 'worker', label: 'CRM sync', x: 550, y: 110, w: 180, h: 74 },
      { id: 's3', kind: 'worker', label: 'Analytics', x: 550, y: 205, w: 180, h: 74 },
    ],
    edges: [
      { from: 'pub', to: 'topic', tone: 'brand', rate: 2 },
      { from: 'topic', to: 's1', tone: 'ok', rate: 2 },
      { from: 'topic', to: 's2', tone: 'ok', rate: 2 },
      { from: 'topic', to: 's3', tone: 'ok', rate: 2 },
    ],
  },

  'event-driven-architecture': {
    width: 760,
    height: 310,
    caption: 'The publisher does not know who reacts. Adding a consumer changes nothing upstream.',
    nodes: [
      { id: 'order', kind: 'service', label: 'Order Service', sub: 'OrderPlaced', x: 40, y: 110, w: 180, h: 84 },
      { id: 'bus', kind: 'queue', label: 'Event bus', x: 310, y: 110, w: 150, h: 84 },
      { id: 'pay', kind: 'service', label: 'Payments', x: 550, y: 10, w: 170, h: 74 },
      { id: 'inv', kind: 'service', label: 'Inventory', x: 550, y: 105, w: 170, h: 74 },
      { id: 'notif', kind: 'service', label: 'Notifications', x: 550, y: 200, w: 170, h: 74 },
    ],
    edges: [
      { from: 'order', to: 'bus', tone: 'brand', rate: 2 },
      { from: 'bus', to: 'pay', tone: 'ok', rate: 2 },
      { from: 'bus', to: 'inv', tone: 'ok', rate: 2 },
      { from: 'bus', to: 'notif', tone: 'ok', rate: 2 },
    ],
  },

  'background-workers': {
    width: 820,
    height: 290,
    caption: 'The API answers in milliseconds; the slow work happens after the response.',
    nodes: [
      { id: 'user', kind: 'client', label: 'POST /export', x: 40, y: 100, w: 160, h: 76 },
      { id: 'api', kind: 'server', label: 'API', sub: '202 Accepted', x: 270, y: 100, w: 150, h: 80 },
      { id: 'queue', kind: 'queue', label: 'Job queue', x: 480, y: 25, w: 150, h: 74 },
      { id: 'worker', kind: 'worker', label: 'Workers x4', x: 480, y: 175, w: 150, h: 78 },
      { id: 'store', kind: 'storage', label: 'Object storage', x: 655, y: 175, w: 150, h: 78 },
    ],
    edges: [
      { from: 'user', to: 'api', tone: 'brand', rate: 2.6 },
      { from: 'api', to: 'queue', tone: 'warn', rate: 2 },
      { from: 'queue', to: 'worker', tone: 'ok', rate: 1.8 },
      { from: 'worker', to: 'store', tone: 'info', rate: 1.2 },
    ],
  },

  'task-queues': {
    width: 760,
    height: 290,
    caption: 'Separate queues per priority, so a bulk import cannot delay a password reset.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 40, y: 105, w: 160, h: 80 },
      { id: 'high', kind: 'queue', label: 'transactional', sub: 'high priority', x: 290, y: 25, w: 180, h: 80 },
      { id: 'bulk', kind: 'queue', label: 'bulk', sub: 'low priority', x: 290, y: 175, w: 180, h: 80 },
      { id: 'w1', kind: 'worker', label: 'Fast workers', x: 560, y: 25, w: 160, h: 78 },
      { id: 'w2', kind: 'worker', label: 'Bulk workers', x: 560, y: 175, w: 160, h: 78 },
    ],
    edges: [
      { from: 'app', to: 'high', tone: 'ok', rate: 1.6 },
      { from: 'app', to: 'bulk', tone: 'warn', rate: 3 },
      { from: 'high', to: 'w1', tone: 'ok', rate: 1.6 },
      { from: 'bulk', to: 'w2', tone: 'warn', rate: 1.4 },
    ],
  },

  'rabbitmq-concepts': {
    width: 760,
    height: 290,
    caption: 'The broker routes: publishers pick a routing key, bindings decide the queues.',
    nodes: [
      { id: 'pub', kind: 'server', label: 'publish', sub: 'order.created', x: 40, y: 105, w: 170, h: 80 },
      { id: 'ex', kind: 'api-gateway', label: 'Topic exchange', x: 280, y: 105, w: 180, h: 80 },
      { id: 'q1', kind: 'queue', label: 'orders queue', x: 540, y: 25, w: 180, h: 74 },
      { id: 'q2', kind: 'queue', label: 'audit queue', x: 540, y: 175, w: 180, h: 74 },
    ],
    edges: [
      { from: 'pub', to: 'ex', tone: 'brand', rate: 2.4 },
      { from: 'ex', to: 'q1', tone: 'ok', rate: 2.4, label: 'order.*' },
      { from: 'ex', to: 'q2', tone: 'ok', rate: 2.4, label: '*.created' },
    ],
  },

  // ---- Reliability --------------------------------------------------------
  'circuit-breaker': {
    width: 760,
    height: 310,
    caption: 'Open circuit: calls fail in microseconds instead of waiting 30 seconds for a timeout.',
    nodes: [
      { id: 'api', kind: 'server', label: 'API Service', x: 40, y: 115, w: 160, h: 80 },
      { id: 'cb', kind: 'api-gateway', label: 'Circuit breaker', sub: 'OPEN', x: 280, y: 105, w: 180, h: 96, stat: ['Failures', '11/20'], alert: true },
      { id: 'pay', kind: 'service', label: 'Payment Service', sub: 'timing out', x: 550, y: 20, w: 180, h: 82, status: 'down' },
      { id: 'fallback', kind: 'cache', label: 'Fallback', sub: 'cached response', x: 550, y: 195, w: 180, h: 82 },
    ],
    edges: [
      { from: 'api', to: 'cb', tone: 'brand', rate: 3.4 },
      { from: 'cb', to: 'pay', tone: 'muted', dashed: true, label: 'blocked' },
      { from: 'cb', to: 'fallback', tone: 'warn', rate: 3, outcome: 'warning' },
    ],
    steps: [
      { from: 'api', to: 'cb', label: 'Call goes through the breaker' },
      { from: 'cb', to: 'pay', label: 'Failures cross the threshold', outcome: 'failure' },
      { from: 'cb', to: 'fallback', label: 'Circuit opens, fail fast', outcome: 'warning' },
      { from: 'cb', to: 'pay', label: 'Half-open: one trial call' },
    ],
  },

  retry: {
    asymmetric: 'The first two attempts fail and the third succeeds - the sequence is the lesson.',
    width: 760,
    height: 289,
    caption: 'Retry transient errors only, with a cap - and only when the operation is idempotent.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 60, y: 100, w: 150, h: 78 },
      { id: 'a1', kind: 'service', label: 'Attempt 1', sub: '503', x: 300, y: 15, w: 150, h: 80, status: 'down' },
      { id: 'a2', kind: 'service', label: 'Attempt 2', sub: 'timeout', x: 300, y: 105, w: 150, h: 80, status: 'degraded' },
      { id: 'a3', kind: 'service', label: 'Attempt 3', sub: '200 OK', x: 300, y: 195, w: 150, h: 80 },
      { id: 'ok', kind: 'server', label: 'Success', x: 570, y: 105, w: 150, h: 74 },
    ],
    edges: [
      { from: 'client', to: 'a1', tone: 'danger', rate: 1.2, outcome: 'failure' },
      { from: 'client', to: 'a2', tone: 'warn', rate: 1.2, outcome: 'warning' },
      { from: 'client', to: 'a3', tone: 'ok', rate: 1.2 },
      { from: 'a3', to: 'ok', tone: 'ok', rate: 1.2 },
    ],
  },

  'exponential-backoff': {
    width: 760,
    height: 280,
    caption: 'Each wait doubles, and jitter spreads clients that all failed at the same moment.',
    nodes: [
      { id: 'c', kind: 'client', label: '10,000 clients', x: 40, y: 100, w: 170, h: 78 },
      { id: 'w1', kind: 'queue', label: 'wait ~1 s', x: 280, y: 15, w: 140, h: 70 },
      { id: 'w2', kind: 'queue', label: 'wait ~2 s', x: 280, y: 105, w: 140, h: 70 },
      { id: 'w4', kind: 'queue', label: 'wait ~4 s', x: 280, y: 195, w: 140, h: 70 },
      { id: 'svc', kind: 'service', label: 'Recovering service', x: 520, y: 100, w: 200, h: 84, stat: ['Peak load', 'flattened'] },
    ],
    edges: [
      { from: 'c', to: 'w1', tone: 'warn', rate: 1.6, outcome: 'warning' },
      { from: 'c', to: 'w2', tone: 'warn', rate: 1.2, outcome: 'warning' },
      { from: 'c', to: 'w4', tone: 'warn', rate: 0.8, outcome: 'warning' },
      { from: 'w1', to: 'svc', tone: 'ok', rate: 0.8 },
      { from: 'w2', to: 'svc', tone: 'ok', rate: 0.6 },
      { from: 'w4', to: 'svc', tone: 'ok', rate: 0.4 },
    ],
  },

  'health-checks': {
    asymmetric: 'api-2 failed its probes and was ejected from the pool, which is the point.',
    width: 760,
    height: 294,
    caption: 'Three consecutive failures eject an instance; successes put it back.',
    nodes: [
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', sub: 'probes every 5 s', x: 40, y: 100, w: 180, h: 84 },
      { id: 'h1', kind: 'server', label: 'api-1', sub: '200 OK', x: 320, y: 10, w: 150, h: 80 },
      { id: 'h2', kind: 'server', label: 'api-2', sub: '3 failures', x: 320, y: 105, w: 150, h: 80, status: 'down' },
      { id: 'h3', kind: 'server', label: 'api-3', sub: '200 OK', x: 320, y: 200, w: 150, h: 80 },
      { id: 'pool', kind: 'client', label: 'Serving pool', sub: '2 of 3', x: 570, y: 105, w: 160, h: 80 },
    ],
    edges: [
      { from: 'lb', to: 'h1', tone: 'ok', rate: 1.6 },
      { from: 'lb', to: 'h2', tone: 'danger', dashed: true, label: 'ejected' },
      { from: 'lb', to: 'h3', tone: 'ok', rate: 1.6 },
      { from: 'h1', to: 'pool', tone: 'ok', rate: 1.2 },
      { from: 'h3', to: 'pool', tone: 'ok', rate: 1.2 },
    ],
  },

  failover: {
    width: 760,
    height: 300,
    caption: 'Detect, promote, fence, repoint. Every step costs seconds you must budget for.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 40, y: 110, w: 160, h: 78 },
      { id: 'old', kind: 'sql', label: 'Old primary', sub: 'fenced', x: 300, y: 20, w: 170, h: 80, status: 'down' },
      { id: 'new', kind: 'sql', label: 'Promoted replica', sub: 'new primary', x: 300, y: 185, w: 190, h: 80 },
      { id: 'replica', kind: 'sql', label: 'Replica', x: 580, y: 185, w: 150, h: 76 },
    ],
    edges: [
      { from: 'app', to: 'old', tone: 'muted', dashed: true, label: 'unreachable' },
      { from: 'app', to: 'new', tone: 'ok', rate: 2.4 },
      { from: 'new', to: 'replica', tone: 'violet', rate: 1.2, outcome: 'warning' },
    ],
  },

  redundancy: {
    width: 760,
    height: 290,
    caption: 'N+1: losing one instance still leaves enough capacity for peak traffic.',
    nodes: [
      { id: 'traffic', kind: 'client', label: 'Peak traffic', x: 40, y: 105, w: 160, h: 78 },
      { id: 's1', kind: 'server', label: 'Zone A', x: 300, y: 15, w: 160, h: 84, stat: ['CPU', '60%'] },
      { id: 's2', kind: 'server', label: 'Zone B', x: 300, y: 105, w: 160, h: 84, stat: ['CPU', '60%'] },
      { id: 's3', kind: 'server', label: 'Zone C', x: 300, y: 195, w: 160, h: 76, status: 'down' },
      { id: 'ok', kind: 'client', label: 'Still serving', x: 560, y: 105, w: 160, h: 78 },
    ],
    edges: [
      { from: 'traffic', to: 's1', tone: 'ok', rate: 2 },
      { from: 'traffic', to: 's2', tone: 'ok', rate: 2 },
      { from: 'traffic', to: 's3', tone: 'muted', dashed: true },
      { from: 's1', to: 'ok', tone: 'ok', rate: 1.6 },
      { from: 's2', to: 'ok', tone: 'ok', rate: 1.6 },
    ],
  },

  'single-point-of-failure': {
    width: 760,
    height: 290,
    caption: 'A redundant app tier in front of one database has the availability of that database.',
    nodes: [
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer x2', x: 40, y: 105, w: 180, h: 78 },
      { id: 's1', kind: 'server', label: 'API 1', x: 300, y: 15, w: 140, h: 72 },
      { id: 's2', kind: 'server', label: 'API 2', x: 300, y: 105, w: 140, h: 72 },
      { id: 's3', kind: 'server', label: 'API 3', x: 300, y: 195, w: 140, h: 72 },
      { id: 'db', kind: 'sql', label: 'Single database', sub: 'SPOF', x: 540, y: 105, w: 190, h: 84, alert: true },
    ],
    edges: [
      { from: 'lb', to: 's1', tone: 'ok', rate: 1.4 },
      { from: 'lb', to: 's2', tone: 'ok', rate: 1.4 },
      { from: 'lb', to: 's3', tone: 'ok', rate: 1.4 },
      { from: 's1', to: 'db', tone: 'danger', rate: 1.4, outcome: 'warning' },
      { from: 's2', to: 'db', tone: 'danger', rate: 1.4, outcome: 'warning' },
      { from: 's3', to: 'db', tone: 'danger', rate: 1.4, outcome: 'warning' },
    ],
  },

  'fault-tolerance': {
    width: 760,
    height: 290,
    caption: 'The page renders without recommendations rather than not rendering at all.',
    nodes: [
      { id: 'user', kind: 'client', label: 'User', x: 40, y: 105, w: 140, h: 76 },
      { id: 'api', kind: 'server', label: 'API', sub: 'timeout 200 ms', x: 260, y: 100, w: 170, h: 84 },
      { id: 'recs', kind: 'service', label: 'Recommendations', sub: 'down', x: 520, y: 15, w: 200, h: 80, status: 'down' },
      { id: 'popular', kind: 'cache', label: 'Popular items', sub: 'fallback', x: 520, y: 180, w: 200, h: 80 },
    ],
    edges: [
      { from: 'user', to: 'api', tone: 'brand', rate: 3 },
      { from: 'api', to: 'recs', tone: 'muted', dashed: true, label: 'fails fast' },
      { from: 'api', to: 'popular', tone: 'ok', rate: 2.6, outcome: 'cache-hit' },
    ],
  },

  'high-availability': {
    width: 760,
    height: 316,
    caption: 'Two zones, automatic promotion, no manual step on the recovery path.',
    nodes: [
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', x: 300, y: 10, w: 170, h: 70 },
      { id: 'a', kind: 'server', label: 'Zone A - API x3', x: 60, y: 120, w: 190, h: 78 },
      { id: 'b', kind: 'server', label: 'Zone B - API x3', x: 510, y: 120, w: 190, h: 78 },
      { id: 'dba', kind: 'sql', label: 'Primary', x: 90, y: 230, w: 150, h: 72 },
      { id: 'dbb', kind: 'sql', label: 'Standby', x: 530, y: 230, w: 150, h: 72 },
    ],
    edges: [
      { from: 'lb', to: 'a', tone: 'ok', rate: 2.4 },
      { from: 'lb', to: 'b', tone: 'ok', rate: 2.4 },
      { from: 'a', to: 'dba', tone: 'info', rate: 1.6 },
      { from: 'dba', to: 'dbb', tone: 'violet', rate: 1.2, label: 'sync', outcome: 'warning' },
    ],
  },

  'disaster-recovery': {
    width: 760,
    height: 280,
    caption: 'A backup that has never been restored is an untested hypothesis.',
    nodes: [
      { id: 'prod', kind: 'sql', label: 'Production', sub: 'region A', x: 50, y: 100, w: 170, h: 80 },
      { id: 'backup', kind: 'storage', label: 'Backups', sub: 'region B, separate account', x: 300, y: 95, w: 200, h: 88 },
      { id: 'restore', kind: 'server', label: 'Restore drill', sub: 'RTO 1 h, RPO 5 min', x: 570, y: 95, w: 170, h: 88 },
    ],
    edges: [
      { from: 'prod', to: 'backup', tone: 'violet', rate: 1.4, label: 'continuous' },
      { from: 'backup', to: 'restore', tone: 'ok', rate: 1, label: 'monthly' },
    ],
  },

  // ---- Distributed --------------------------------------------------------
  'cap-theorem': {
    width: 760,
    height: 300,
    caption: 'During a partition: reject the write (CP), or accept it and diverge (AP).',
    nodes: [
      { id: 'ca', kind: 'client', label: 'Client A', x: 60, y: 20, w: 150, h: 70 },
      { id: 'cb', kind: 'client', label: 'Client B', x: 550, y: 20, w: 150, h: 70 },
      { id: 'na', kind: 'sql', label: 'Node A', sub: 'majority', x: 60, y: 155, w: 170, h: 96, stat: ['Writes', 'accepted'] },
      { id: 'nb', kind: 'sql', label: 'Node B', sub: 'minority', x: 530, y: 155, w: 170, h: 96, stat: ['Writes', 'rejected'], status: 'degraded' },
    ],
    edges: [
      { from: 'ca', to: 'na', tone: 'ok', rate: 2 },
      { from: 'cb', to: 'nb', tone: 'danger', rate: 2, outcome: 'failure' },
      { from: 'na', to: 'nb', tone: 'danger', dashed: true, label: 'X partition X' },
    ],
    steps: [
      { from: 'ca', to: 'na', label: 'Write on the majority side' },
      { from: 'na', to: 'nb', label: 'Replication is cut', outcome: 'failure' },
      { from: 'cb', to: 'nb', label: 'CP: reject to stay correct', outcome: 'failure' },
    ],
  },

  'strong-consistency': {
    width: 760,
    height: 294,
    caption: 'The write is acknowledged only after a quorum stores it.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Write', x: 40, y: 105, w: 140, h: 74 },
      { id: 'leader', kind: 'sql', label: 'Leader', x: 260, y: 100, w: 160, h: 84 },
      { id: 'f1', kind: 'sql', label: 'Follower 1', sub: 'ack', x: 520, y: 20, w: 170, h: 80 },
      { id: 'f2', kind: 'sql', label: 'Follower 2', sub: 'ack', x: 520, y: 110, w: 170, h: 80 },
      { id: 'f3', kind: 'sql', label: 'Follower 3', sub: 'slow', x: 520, y: 200, w: 170, h: 80, status: 'degraded' },
    ],
    edges: [
      { from: 'client', to: 'leader', tone: 'brand', rate: 2 },
      { from: 'leader', to: 'f1', tone: 'ok', rate: 2 },
      { from: 'leader', to: 'f2', tone: 'ok', rate: 2 },
      { from: 'leader', to: 'f3', tone: 'muted', dashed: true },
    ],
  },

  'eventual-consistency': {
    width: 760,
    height: 290,
    caption: 'Every replica answers immediately; they agree a little later.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Write', x: 40, y: 105, w: 140, h: 74 },
      { id: 'a', kind: 'nosql', label: 'Replica A', sub: 'v5', x: 260, y: 100, w: 160, h: 80 },
      { id: 'b', kind: 'nosql', label: 'Replica B', sub: 'v5', x: 520, y: 20, w: 170, h: 80 },
      { id: 'c', kind: 'nosql', label: 'Replica C', sub: 'v4 - stale', x: 520, y: 180, w: 170, h: 80, alert: true },
    ],
    edges: [
      { from: 'client', to: 'a', tone: 'brand', rate: 2.4 },
      { from: 'a', to: 'b', tone: 'ok', rate: 1.4, outcome: 'warning' },
      { from: 'a', to: 'c', tone: 'warn', rate: 0.6, outcome: 'warning', dashed: true, label: '2 s behind' },
    ],
  },

  consensus: {
    asymmetric: 'A lagging node does not acknowledge; a majority commits without it.',
    width: 760,
    height: 294,
    caption: 'An entry commits once a majority has stored it - so no two quorums can disagree.',
    nodes: [
      { id: 'leader', kind: 'server', label: 'Leader', sub: 'term 7', x: 40, y: 105, w: 150, h: 84 },
      { id: 'n1', kind: 'server', label: 'Node 1', sub: 'ack', x: 290, y: 10, w: 150, h: 80 },
      { id: 'n2', kind: 'server', label: 'Node 2', sub: 'ack', x: 290, y: 105, w: 150, h: 80 },
      { id: 'n3', kind: 'server', label: 'Node 3', sub: 'lagging', x: 290, y: 200, w: 150, h: 80, status: 'degraded' },
      { id: 'commit', kind: 'storage', label: 'Committed', sub: 'quorum 3 of 5', x: 550, y: 105, w: 180, h: 80 },
    ],
    edges: [
      { from: 'leader', to: 'n1', tone: 'ok', rate: 1.8 },
      { from: 'leader', to: 'n2', tone: 'ok', rate: 1.8 },
      { from: 'leader', to: 'n3', tone: 'muted', dashed: true },
      { from: 'n1', to: 'commit', tone: 'ok', rate: 1.4 },
      { from: 'n2', to: 'commit', tone: 'ok', rate: 1.4 },
    ],
  },

  'leader-election': {
    width: 760,
    height: 280,
    caption: 'Missed heartbeats start an election; a majority vote prevents two leaders.',
    nodes: [
      { id: 'old', kind: 'server', label: 'Old leader', sub: 'unreachable', x: 40, y: 100, w: 160, h: 80, status: 'down' },
      { id: 'c1', kind: 'server', label: 'Candidate', sub: 'term 8', x: 290, y: 100, w: 160, h: 84 },
      { id: 'v1', kind: 'server', label: 'Voter', x: 550, y: 20, w: 150, h: 72 },
      { id: 'v2', kind: 'server', label: 'Voter', x: 550, y: 175, w: 150, h: 72 },
    ],
    edges: [
      { from: 'old', to: 'c1', tone: 'muted', dashed: true, label: 'no heartbeat' },
      { from: 'c1', to: 'v1', tone: 'brand', rate: 1.6 },
      { from: 'c1', to: 'v2', tone: 'brand', rate: 1.6 },
    ],
  },

  'distributed-locks': {
    width: 760,
    height: 280,
    caption: 'A paused holder can wake up after its lease expired - the fencing token stops its write.',
    nodes: [
      { id: 'w1', kind: 'worker', label: 'Worker 1', sub: 'token 41, paused', x: 40, y: 20, w: 170, h: 80, status: 'degraded' },
      { id: 'w2', kind: 'worker', label: 'Worker 2', sub: 'token 42', x: 40, y: 165, w: 170, h: 80 },
      { id: 'lock', kind: 'cache', label: 'Lease', sub: 'TTL 30 s', x: 300, y: 95, w: 160, h: 84 },
      { id: 'store', kind: 'storage', label: 'Storage', sub: 'rejects token < 42', x: 550, y: 95, w: 180, h: 84 },
    ],
    edges: [
      { from: 'w1', to: 'lock', tone: 'muted', dashed: true },
      { from: 'w2', to: 'lock', tone: 'ok', rate: 1.4 },
      { from: 'w1', to: 'store', tone: 'danger', rate: 0.8, outcome: 'failure', label: 'stale token', labelT: 0.3 },
      { from: 'w2', to: 'store', tone: 'ok', rate: 1.4 },
    ],
  },

  idempotency: {
    width: 760,
    height: 290,
    caption: 'The same key returns the stored result instead of charging the card twice.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', sub: 'retries on timeout', x: 40, y: 100, w: 170, h: 82 },
      { id: 'api', kind: 'server', label: 'Payments API', sub: 'Idempotency-Key 8f2c', x: 290, y: 95, w: 200, h: 92 },
      { id: 'store', kind: 'cache', label: 'Key store', sub: 'key -> result', x: 570, y: 15, w: 160, h: 80 },
      { id: 'charge', kind: 'sql', label: 'ch_77', sub: 'charged once', x: 570, y: 175, w: 160, h: 80 },
    ],
    edges: [
      { from: 'client', to: 'api', tone: 'brand', rate: 3 },
      { from: 'api', to: 'store', tone: 'ok', rate: 2.4, outcome: 'cache-hit' },
      { from: 'api', to: 'charge', tone: 'violet', rate: 0.5 },
    ],
    steps: [
      { from: 'client', to: 'api', label: 'First request with a key' },
      { from: 'api', to: 'charge', label: 'Charge created once' },
      { from: 'client', to: 'api', label: 'Timeout, client retries' },
      { from: 'api', to: 'store', label: 'Same key, stored result', outcome: 'cache-hit' },
    ],
  },

  // ---- Architecture -------------------------------------------------------
  monolith: {
    width: 760,
    height: 299,
    caption: 'One deployable unit, one database, in-process calls between features.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Clients', x: 305, y: 10, w: 150, h: 68 },
      { id: 'app', kind: 'server', label: 'Application', sub: 'users | orders | payments', x: 240, y: 105, w: 280, h: 86 },
      { id: 'db', kind: 'sql', label: 'Database', x: 305, y: 215, w: 150, h: 70 },
    ],
    edges: [
      { from: 'client', to: 'app', tone: 'brand', rate: 4 },
      { from: 'app', to: 'db', tone: 'info', rate: 3 },
    ],
  },

  'modular-monolith': {
    width: 760,
    height: 280,
    caption: 'Service-shaped boundaries with no network between them - extraction stays cheap.',
    nodes: [
      { id: 'orders', kind: 'service', label: 'orders', sub: 'own tables', x: 40, y: 100, w: 160, h: 80 },
      { id: 'payments', kind: 'service', label: 'payments', sub: 'own tables', x: 230, y: 100, w: 160, h: 80 },
      { id: 'catalog', kind: 'service', label: 'catalog', sub: 'own tables', x: 420, y: 100, w: 160, h: 80 },
      { id: 'users', kind: 'service', label: 'users', sub: 'own tables', x: 600, y: 100, w: 130, h: 80 },
    ],
    edges: [
      { from: 'orders', to: 'payments', tone: 'ok', rate: 2 },
      { from: 'payments', to: 'catalog', tone: 'ok', rate: 1.4 },
      { from: 'catalog', to: 'users', tone: 'ok', rate: 1.4 },
    ],
  },

  microservices: {
    width: 760,
    height: 320,
    caption: 'Independent deployment, own data - and a network call between every box.',
    nodes: [
      { id: 'gw', kind: 'api-gateway', label: 'API Gateway', x: 300, y: 12, w: 170, h: 70 },
      { id: 'users', kind: 'service', label: 'Users Service', x: 40, y: 120, w: 170, h: 76 },
      { id: 'orders', kind: 'service', label: 'Orders Service', x: 295, y: 120, w: 180, h: 76 },
      { id: 'pay', kind: 'service', label: 'Payments Service', x: 560, y: 120, w: 180, h: 76 },
      { id: 'udb', kind: 'sql', label: 'Users DB', x: 55, y: 235, w: 140, h: 70 },
      { id: 'odb', kind: 'sql', label: 'Orders DB', x: 315, y: 235, w: 140, h: 70 },
      { id: 'pdb', kind: 'sql', label: 'Payments DB', x: 580, y: 235, w: 140, h: 70 },
    ],
    edges: [
      { from: 'gw', to: 'users', tone: 'ok', rate: 1.4 },
      { from: 'gw', to: 'orders', tone: 'ok', rate: 2.4 },
      { from: 'gw', to: 'pay', tone: 'ok', rate: 1.4 },
      { from: 'users', to: 'udb', tone: 'info', rate: 1.2 },
      { from: 'orders', to: 'odb', tone: 'info', rate: 1.8 },
      { from: 'pay', to: 'pdb', tone: 'info', rate: 1.2 },
      { from: 'orders', to: 'pay', tone: 'warn', dashed: true, label: 'sync call', rate: 1, outcome: 'warning' },
    ],
  },

  cqrs: {
    width: 760,
    height: 290,
    caption: 'Writes shape the domain model; reads are served from a model built for the screen.',
    nodes: [
      { id: 'cmd', kind: 'client', label: 'Command', x: 40, y: 20, w: 150, h: 72 },
      { id: 'write', kind: 'sql', label: 'Write model', sub: 'invariants', x: 280, y: 20, w: 170, h: 80 },
      { id: 'proj', kind: 'worker', label: 'Projection', x: 530, y: 100, w: 160, h: 78 },
      { id: 'read', kind: 'nosql', label: 'Read model', sub: 'denormalised', x: 280, y: 190, w: 170, h: 80 },
      { id: 'query', kind: 'client', label: 'Query', x: 40, y: 190, w: 150, h: 72 },
    ],
    edges: [
      { from: 'cmd', to: 'write', tone: 'brand', rate: 1.4 },
      { from: 'write', to: 'proj', tone: 'violet', rate: 1.4, outcome: 'warning' },
      { from: 'proj', to: 'read', tone: 'violet', rate: 1.4, outcome: 'warning' },
      { from: 'query', to: 'read', tone: 'ok', rate: 4 },
    ],
  },

  'event-sourcing': {
    width: 760,
    height: 280,
    caption: 'Append-only events; current state is a fold over them, with snapshots for speed.',
    nodes: [
      { id: 'cmd', kind: 'client', label: 'Deposit 100', x: 40, y: 100, w: 160, h: 74 },
      { id: 'stream', kind: 'queue', label: 'account-42 stream', sub: 'immutable events', x: 270, y: 95, w: 200, h: 88 },
      { id: 'snap', kind: 'storage', label: 'Snapshot', sub: 'event 1000', x: 550, y: 20, w: 170, h: 80 },
      { id: 'state', kind: 'sql', label: 'balance 70', sub: 'derived', x: 550, y: 175, w: 170, h: 80 },
    ],
    edges: [
      { from: 'cmd', to: 'stream', tone: 'brand', rate: 2 },
      { from: 'stream', to: 'snap', tone: 'muted', rate: 0.5, dashed: true },
      { from: 'stream', to: 'state', tone: 'ok', rate: 2 },
    ],
  },

  serverless: {
    asymmetric: 'The cold-starting instance is not serving yet, which is the cost being shown.',
    width: 760,
    height: 283,
    caption: 'One instance per concurrent request - and one database connection per instance.',
    nodes: [
      { id: 'events', kind: 'client', label: '1,000 events', x: 40, y: 100, w: 160, h: 78 },
      { id: 'f1', kind: 'service', label: 'fn instance', sub: 'cold start', x: 290, y: 15, w: 160, h: 80, status: 'starting' },
      { id: 'f2', kind: 'service', label: 'fn instance', x: 290, y: 105, w: 160, h: 74 },
      { id: 'f3', kind: 'service', label: 'fn instance', x: 290, y: 195, w: 160, h: 74 },
      { id: 'pool', kind: 'api-gateway', label: 'Connection pooler', sub: 'or the DB falls over', x: 530, y: 100, w: 200, h: 84 },
    ],
    edges: [
      { from: 'events', to: 'f1', tone: 'warn', rate: 1.4 },
      { from: 'events', to: 'f2', tone: 'ok', rate: 1.8 },
      { from: 'events', to: 'f3', tone: 'ok', rate: 1.8 },
      { from: 'f2', to: 'pool', tone: 'info', rate: 1.6 },
      { from: 'f3', to: 'pool', tone: 'info', rate: 1.6 },
    ],
  },

  'service-oriented-architecture': {
    width: 760,
    height: 280,
    caption: 'Logic in the bus is the mistake microservices learned from.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 40, y: 100, w: 140, h: 74 },
      { id: 'bus', kind: 'api-gateway', label: 'Enterprise bus', sub: 'routing + transformation', x: 260, y: 95, w: 210, h: 88, alert: true },
      { id: 'billing', kind: 'service', label: 'Billing', x: 560, y: 20, w: 160, h: 74 },
      { id: 'crm', kind: 'service', label: 'CRM', x: 560, y: 175, w: 160, h: 74 },
    ],
    edges: [
      { from: 'client', to: 'bus', tone: 'brand', rate: 3 },
      { from: 'bus', to: 'billing', tone: 'warn', rate: 1.6 },
      { from: 'bus', to: 'crm', tone: 'warn', rate: 1.6 },
    ],
  },

  // ---- Security -----------------------------------------------------------
  'rate-limiting': {
    width: 760,
    height: 300,
    caption: 'Allowed requests reach the API; the rest get 429 with Retry-After.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', sub: '100 requests', x: 40, y: 110, w: 150, h: 80 },
      { id: 'limiter', kind: 'api-gateway', label: 'Rate limiter', sub: 'token bucket 10/s', x: 270, y: 100, w: 190, h: 96, stat: ['Tokens', '3 / 10'] },
      { id: 'api', kind: 'server', label: 'API', x: 560, y: 15, w: 160, h: 76 },
      { id: 'reject', kind: 'client', label: 'HTTP 429', sub: 'Too Many Requests', x: 545, y: 190, w: 190, h: 80 },
    ],
    edges: [
      { from: 'client', to: 'limiter', tone: 'brand', rate: 5 },
      { from: 'limiter', to: 'api', tone: 'ok', rate: 2 },
      { from: 'limiter', to: 'reject', tone: 'danger', rate: 3, outcome: 'failure' },
    ],
    steps: [
      { from: 'client', to: 'limiter', label: 'Burst of 100 arrives' },
      { from: 'limiter', to: 'api', label: 'Tokens available: allowed' },
      { from: 'limiter', to: 'reject', label: 'Bucket empty: 429', outcome: 'failure' },
    ],
  },

  authentication: {
    width: 760,
    height: 270,
    caption: 'Verify the credential once, then carry proof on every later request.',
    nodes: [
      { id: 'user', kind: 'client', label: 'Login', x: 40, y: 95, w: 150, h: 76 },
      { id: 'auth', kind: 'api-gateway', label: 'Auth service', sub: 'verify hash', x: 280, y: 90, w: 180, h: 86 },
      { id: 'token', kind: 'cache', label: 'Session / JWT', x: 560, y: 90, w: 170, h: 80 },
    ],
    edges: [
      { from: 'user', to: 'auth', tone: 'brand', rate: 2 },
      { from: 'auth', to: 'token', tone: 'ok', rate: 2 },
    ],
  },

  authorization: {
    width: 760,
    height: 280,
    caption: 'Authentication says who you are. Authorization checks this object belongs to you.',
    nodes: [
      { id: 'req', kind: 'client', label: 'GET /invoices/9182', sub: 'user 42, tenant 3', x: 40, y: 95, w: 200, h: 84 },
      { id: 'check', kind: 'api-gateway', label: 'Ownership check', sub: 'invoice tenant = 7', x: 310, y: 90, w: 190, h: 90 },
      { id: 'deny', kind: 'client', label: '403 Forbidden', x: 570, y: 20, w: 160, h: 74 },
      { id: 'allow', kind: 'sql', label: 'Invoice', x: 570, y: 175, w: 160, h: 74 },
    ],
    edges: [
      { from: 'req', to: 'check', tone: 'brand', rate: 3 },
      { from: 'check', to: 'deny', tone: 'danger', rate: 2, outcome: 'failure' },
      { from: 'check', to: 'allow', tone: 'ok', rate: 1 },
    ],
  },

  jwt: {
    width: 760,
    height: 289,
    caption: 'Every service verifies the signature locally - no lookup, and no easy revocation.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Bearer eyJhbGc...', x: 40, y: 95, w: 180, h: 78 },
      { id: 's1', kind: 'service', label: 'Service A', sub: 'verifies locally', x: 320, y: 15, w: 180, h: 80 },
      { id: 's2', kind: 'service', label: 'Service B', sub: 'verifies locally', x: 320, y: 105, w: 180, h: 80 },
      { id: 's3', kind: 'service', label: 'Service C', sub: 'verifies locally', x: 320, y: 195, w: 180, h: 80 },
      { id: 'keys', kind: 'storage', label: 'Public key', x: 590, y: 105, w: 140, h: 76 },
    ],
    edges: [
      { from: 'client', to: 's1', tone: 'brand', rate: 1.6 },
      { from: 'client', to: 's2', tone: 'brand', rate: 1.6 },
      { from: 'client', to: 's3', tone: 'brand', rate: 1.6 },
      // Every service fetches the public key, not just one of them - that is
      // exactly what makes local verification possible everywhere.
      { from: 's1', to: 'keys', tone: 'muted', dashed: true },
      { from: 's2', to: 'keys', tone: 'muted', dashed: true },
      { from: 's3', to: 'keys', tone: 'muted', dashed: true },
    ],
  },

  oauth: {
    width: 760,
    height: 280,
    caption: 'The app never sees the password - only a scoped, revocable token.',
    nodes: [
      { id: 'user', kind: 'client', label: 'User', x: 40, y: 95, w: 130, h: 74 },
      { id: 'app', kind: 'server', label: 'Client app', x: 230, y: 95, w: 150, h: 78 },
      { id: 'auth', kind: 'api-gateway', label: 'Authorization server', sub: 'login + consent', x: 480, y: 15, w: 200, h: 82 },
      { id: 'res', kind: 'service', label: 'Resource server', sub: 'checks scopes', x: 480, y: 180, w: 200, h: 82 },
    ],
    edges: [
      { from: 'user', to: 'app', tone: 'brand', rate: 1.6 },
      { from: 'app', to: 'auth', tone: 'violet', rate: 1.4 },
      { from: 'app', to: 'res', tone: 'ok', rate: 2, label: 'access token' },
    ],
  },

  'tls-https': {
    width: 760,
    height: 270,
    caption: 'One handshake, then everything on the wire is encrypted.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Browser', x: 50, y: 95, w: 150, h: 78 },
      { id: 'tls', kind: 'api-gateway', label: 'TLS 1.3', sub: '1 round trip', x: 290, y: 90, w: 180, h: 88 },
      { id: 'server', kind: 'server', label: 'Server', sub: 'certificate', x: 560, y: 95, w: 160, h: 80 },
    ],
    edges: [
      { from: 'client', to: 'tls', tone: 'brand', rate: 2.4 },
      { from: 'tls', to: 'server', tone: 'ok', rate: 2.4 },
    ],
  },

  waf: {
    width: 760,
    height: 280,
    caption: 'Known-bad requests are dropped at the edge, before they reach your code.',
    nodes: [
      { id: 'net', kind: 'client', label: 'Internet', x: 40, y: 95, w: 150, h: 78 },
      { id: 'waf', kind: 'api-gateway', label: 'WAF', sub: 'OWASP rules', x: 280, y: 90, w: 170, h: 90 },
      { id: 'blocked', kind: 'client', label: 'Blocked', sub: 'SQLi, bots', x: 550, y: 15, w: 170, h: 80 },
      { id: 'app', kind: 'server', label: 'Application', x: 550, y: 175, w: 170, h: 76 },
    ],
    edges: [
      { from: 'net', to: 'waf', tone: 'brand', rate: 4 },
      { from: 'waf', to: 'blocked', tone: 'danger', rate: 1.6, outcome: 'failure' },
      { from: 'waf', to: 'app', tone: 'ok', rate: 2.4 },
    ],
  },

  'api-keys': {
    width: 760,
    height: 260,
    caption: 'The key identifies the integration, so you can meter and revoke it alone.',
    nodes: [
      { id: 'i1', kind: 'client', label: 'Integration A', sub: 'sk_live_9f2c', x: 40, y: 30, w: 180, h: 80 },
      { id: 'i2', kind: 'client', label: 'Integration B', sub: 'sk_live_44ab', x: 40, y: 140, w: 180, h: 80 },
      { id: 'gw', kind: 'api-gateway', label: 'Gateway', sub: 'quota per key', x: 320, y: 85, w: 170, h: 84 },
      { id: 'api', kind: 'server', label: 'API', x: 580, y: 85, w: 150, h: 80 },
    ],
    edges: [
      { from: 'i1', to: 'gw', tone: 'ok', rate: 2 },
      { from: 'i2', to: 'gw', tone: 'danger', rate: 3.4, outcome: 'failure', label: 'over quota' },
      { from: 'gw', to: 'api', tone: 'ok', rate: 2 },
    ],
  },

  'secrets-management': {
    width: 760,
    height: 270,
    caption: 'Short-lived credentials issued at runtime - nothing static in the repo or the image.',
    nodes: [
      { id: 'wl', kind: 'server', label: 'Workload', sub: 'IAM identity', x: 40, y: 95, w: 170, h: 80 },
      { id: 'vault', kind: 'storage', label: 'Secret manager', sub: 'rotates automatically', x: 290, y: 90, w: 200, h: 88 },
      { id: 'db', kind: 'sql', label: 'Database', sub: 'credential valid 15 min', x: 560, y: 90, w: 180, h: 88 },
    ],
    edges: [
      { from: 'wl', to: 'vault', tone: 'brand', rate: 1.4 },
      { from: 'vault', to: 'db', tone: 'ok', rate: 1.4 },
    ],
  },

  // ---- Communication ------------------------------------------------------
  'rest-apis': {
    width: 760,
    height: 280,
    caption: 'GET is cacheable and safe to retry. POST is neither.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 40, y: 95, w: 140, h: 78 },
      { id: 'cache', kind: 'cdn', label: 'Cache / proxy', sub: 'understands GET', x: 260, y: 90, w: 180, h: 88 },
      { id: 'api', kind: 'server', label: '/orders/123', x: 540, y: 90, w: 180, h: 84 },
    ],
    edges: [
      { from: 'client', to: 'cache', tone: 'brand', rate: 3.4 },
      { from: 'cache', to: 'api', tone: 'ok', rate: 1.2, label: 'on miss' },
    ],
  },

  graphql: {
    width: 760,
    height: 290,
    caption: 'One query, exactly the requested fields - and an N+1 risk behind every resolver.',
    nodes: [
      { id: 'client', kind: 'client', label: 'One query', x: 40, y: 100, w: 150, h: 78 },
      { id: 'gql', kind: 'api-gateway', label: 'GraphQL server', sub: 'resolvers + batching', x: 270, y: 95, w: 200, h: 90 },
      { id: 'orders', kind: 'sql', label: 'orders', x: 560, y: 15, w: 160, h: 72 },
      { id: 'customers', kind: 'sql', label: 'customers', x: 560, y: 100, w: 160, h: 72 },
      { id: 'items', kind: 'sql', label: 'items', x: 560, y: 185, w: 160, h: 72 },
    ],
    edges: [
      { from: 'client', to: 'gql', tone: 'brand', rate: 2 },
      { from: 'gql', to: 'orders', tone: 'info', rate: 1.6 },
      { from: 'gql', to: 'customers', tone: 'info', rate: 1.6 },
      { from: 'gql', to: 'items', tone: 'info', rate: 1.6 },
    ],
  },

  grpc: {
    width: 760,
    height: 270,
    caption: 'Binary frames over one multiplexed HTTP/2 connection, from a generated client.',
    nodes: [
      { id: 'a', kind: 'service', label: 'Service A', sub: 'generated stub', x: 60, y: 90, w: 180, h: 84 },
      { id: 'conn', kind: 'api-gateway', label: 'HTTP/2', sub: 'multiplexed streams', x: 300, y: 90, w: 180, h: 84 },
      { id: 'b', kind: 'service', label: 'Service B', sub: '.proto contract', x: 540, y: 90, w: 180, h: 84 },
    ],
    edges: [
      { from: 'a', to: 'conn', tone: 'brand', rate: 5 },
      { from: 'conn', to: 'b', tone: 'ok', rate: 5 },
    ],
  },

  websockets: {
    asymmetric: 'The socket lives on one gateway node; the other reaches the user through pub/sub.',
    width: 760,
    height: 290,
    caption: 'The connection is state: the node holding it must be reachable to deliver a message.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 40, y: 100, w: 140, h: 78 },
      { id: 'gw', kind: 'service', label: 'Gateway node 2', sub: 'holds the socket', x: 260, y: 95, w: 190, h: 88 },
      { id: 'bus', kind: 'queue', label: 'Pub/Sub', x: 540, y: 15, w: 170, h: 74 },
      { id: 'other', kind: 'service', label: 'Gateway node 7', x: 540, y: 180, w: 170, h: 76 },
    ],
    edges: [
      { from: 'client', to: 'gw', tone: 'brand', rate: 2.6 },
      { from: 'gw', to: 'client', tone: 'ok', rate: 2.6, curvature: 0.9 },
      { from: 'other', to: 'bus', tone: 'warn', rate: 1.4 },
      { from: 'bus', to: 'gw', tone: 'warn', rate: 1.4 },
    ],
  },

  'server-sent-events': {
    width: 760,
    height: 260,
    caption: 'One long-lived HTTP response, server to client only, with automatic reconnect.',
    nodes: [
      { id: 'client', kind: 'client', label: 'EventSource', x: 60, y: 90, w: 170, h: 78 },
      { id: 'server', kind: 'server', label: 'text/event-stream', sub: 'id + data frames', x: 320, y: 85, w: 200, h: 88 },
      { id: 'src', kind: 'queue', label: 'Updates', x: 600, y: 90, w: 130, h: 78 },
    ],
    edges: [
      { from: 'src', to: 'server', tone: 'warn', rate: 1.6 },
      { from: 'server', to: 'client', tone: 'ok', rate: 2.4 },
    ],
  },

  polling: {
    width: 760,
    height: 270,
    caption: '10,000 clients every 5 s is 2,000 req/sec - even when nothing changed.',
    nodes: [
      { id: 'clients', kind: 'client', label: '10,000 clients', sub: 'every 5 s', x: 60, y: 90, w: 180, h: 82 },
      { id: 'api', kind: 'server', label: 'API', sub: '2,000 req/sec', x: 330, y: 90, w: 170, h: 82, alert: true },
      { id: 'resp', kind: 'storage', label: '304 Not Modified', x: 570, y: 90, w: 170, h: 78 },
    ],
    edges: [
      { from: 'clients', to: 'api', tone: 'brand', rate: 6 },
      { from: 'api', to: 'resp', tone: 'muted', rate: 5, outcome: 'warning' },
    ],
  },

  'long-polling': {
    width: 760,
    height: 260,
    caption: 'The request is held open until there is something to send.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 60, y: 90, w: 150, h: 78 },
      { id: 'server', kind: 'server', label: 'Held request', sub: 'up to 30 s', x: 300, y: 85, w: 180, h: 88 },
      { id: 'event', kind: 'queue', label: 'Event arrives', x: 570, y: 90, w: 160, h: 78 },
    ],
    edges: [
      { from: 'client', to: 'server', tone: 'brand', rate: 1 },
      { from: 'event', to: 'server', tone: 'warn', rate: 1 },
      { from: 'server', to: 'client', tone: 'ok', rate: 1, curvature: 0.9 },
    ],
  },

  // ---- Observability ------------------------------------------------------
  'distributed-tracing': {
    width: 760,
    height: 309,
    caption: 'One trace id crosses every hop, including the queue - otherwise half the trace is missing.',
    nodes: [
      { id: 'gw', kind: 'api-gateway', label: 'Gateway', sub: '40 ms', x: 30, y: 100, w: 150, h: 80 },
      { id: 'order', kind: 'service', label: 'Order', sub: '80 ms', x: 220, y: 100, w: 150, h: 80 },
      { id: 'pay', kind: 'service', label: 'Payment', sub: '120 ms', x: 410, y: 100, w: 150, h: 80, alert: true },
      { id: 'db', kind: 'sql', label: 'Database', sub: '25 ms', x: 600, y: 100, w: 140, h: 80 },
      { id: 'queue', kind: 'queue', label: 'Kafka', sub: 'context propagated', x: 400, y: 215, w: 190, h: 80 },
    ],
    edges: [
      { from: 'gw', to: 'order', tone: 'brand', rate: 2 },
      { from: 'order', to: 'pay', tone: 'warn', rate: 2, outcome: 'warning' },
      { from: 'pay', to: 'db', tone: 'info', rate: 2 },
      { from: 'order', to: 'queue', tone: 'muted', dashed: true, rate: 0.8 },
    ],
    steps: [
      { from: 'gw', to: 'order', label: 'traceparent created' },
      { from: 'order', to: 'pay', label: 'Payment owns 120 ms', outcome: 'warning' },
      { from: 'pay', to: 'db', label: 'Database only 25 ms' },
      { from: 'order', to: 'queue', label: 'Context crosses the broker' },
    ],
  },

  tracing: {
    width: 760,
    height: 280,
    caption: 'Spans form a tree, and the widest bar is where the time went.',
    nodes: [
      { id: 'gw', kind: 'api-gateway', label: 'Gateway span', x: 40, y: 100, w: 170, h: 80 },
      { id: 'svc', kind: 'service', label: 'Service span', x: 290, y: 100, w: 170, h: 80 },
      { id: 'db', kind: 'sql', label: 'DB span', x: 540, y: 100, w: 170, h: 80 },
    ],
    edges: [
      { from: 'gw', to: 'svc', tone: 'brand', rate: 2 },
      { from: 'svc', to: 'db', tone: 'info', rate: 2 },
    ],
  },

  monitoring: {
    width: 760,
    height: 290,
    caption: 'Four golden signals in, one decision out: does a human need to wake up?',
    nodes: [
      { id: 'api', kind: 'server', label: 'Services', x: 40, y: 100, w: 150, h: 80 },
      { id: 'metrics', kind: 'monitoring', label: 'Metrics', sub: 'latency, errors', x: 280, y: 15, w: 170, h: 80 },
      { id: 'logs', kind: 'storage', label: 'Logs', sub: 'trace_id', x: 280, y: 105, w: 170, h: 80 },
      { id: 'traces', kind: 'search', label: 'Traces', x: 280, y: 195, w: 170, h: 76 },
      { id: 'alert', kind: 'client', label: 'Page on-call', sub: 'burn rate 14x', x: 540, y: 105, w: 180, h: 80 },
    ],
    edges: [
      { from: 'api', to: 'metrics', tone: 'ok', rate: 2 },
      { from: 'api', to: 'logs', tone: 'ok', rate: 2 },
      { from: 'api', to: 'traces', tone: 'ok', rate: 1.4 },
      { from: 'metrics', to: 'alert', tone: 'danger', rate: 1.2, outcome: 'failure' },
    ],
  },

  logging: {
    width: 760,
    height: 260,
    caption: 'Structured lines with a trace id reconstruct one request across every service.',
    nodes: [
      { id: 's1', kind: 'service', label: 'Service A', x: 40, y: 30, w: 160, h: 72 },
      { id: 's2', kind: 'service', label: 'Service B', x: 40, y: 135, w: 160, h: 72 },
      { id: 'pipe', kind: 'queue', label: 'Log pipeline', x: 300, y: 85, w: 170, h: 80 },
      { id: 'search', kind: 'search', label: 'Search by trace_id', x: 550, y: 85, w: 190, h: 80 },
    ],
    edges: [
      { from: 's1', to: 'pipe', tone: 'ok', rate: 2.4 },
      { from: 's2', to: 'pipe', tone: 'ok', rate: 2.4 },
      { from: 'pipe', to: 'search', tone: 'brand', rate: 2.4 },
    ],
  },

  metrics: {
    width: 760,
    height: 260,
    caption: 'Cheap aggregates at high resolution - percentiles, not averages.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Instrumented app', x: 40, y: 90, w: 190, h: 80 },
      { id: 'tsdb', kind: 'monitoring', label: 'Time series DB', sub: 'p50 / p95 / p99', x: 310, y: 85, w: 190, h: 88 },
      { id: 'dash', kind: 'client', label: 'Dashboard', x: 580, y: 90, w: 150, h: 80 },
    ],
    edges: [
      { from: 'app', to: 'tsdb', tone: 'ok', rate: 4 },
      { from: 'tsdb', to: 'dash', tone: 'brand', rate: 2 },
    ],
  },

  // ---- Patterns -----------------------------------------------------------
  'fan-out': {
    width: 760,
    height: 310,
    caption: 'Fan-out on write makes reads cheap and celebrity posts expensive.',
    nodes: [
      { id: 'post', kind: 'client', label: 'New post', x: 40, y: 115, w: 150, h: 76 },
      { id: 'fan', kind: 'worker', label: 'Fan-out worker', x: 260, y: 110, w: 180, h: 84 },
      { id: 't1', kind: 'nosql', label: 'Timeline 1', x: 540, y: 15, w: 170, h: 70 },
      { id: 't2', kind: 'nosql', label: 'Timeline 2', x: 540, y: 105, w: 170, h: 70 },
      { id: 't3', kind: 'nosql', label: 'Timeline 5,000', x: 540, y: 195, w: 180, h: 70 },
    ],
    edges: [
      { from: 'post', to: 'fan', tone: 'brand', rate: 1.4 },
      { from: 'fan', to: 't1', tone: 'ok', rate: 2.4 },
      { from: 'fan', to: 't2', tone: 'ok', rate: 2.4 },
      { from: 'fan', to: 't3', tone: 'warn', rate: 2.4, outcome: 'warning' },
    ],
  },

  backpressure: {
    width: 760,
    height: 290,
    caption: 'A bounded queue refuses work instead of buffering until memory runs out.',
    nodes: [
      { id: 'prod', kind: 'server', label: 'Producer', sub: '1,000/s', x: 40, y: 105, w: 160, h: 80 },
      { id: 'queue', kind: 'queue', label: 'Bounded queue', sub: '10,000 max', x: 280, y: 100, w: 190, h: 96, stat: ['Full', 'yes'], alert: true },
      { id: 'reject', kind: 'client', label: 'HTTP 429', x: 560, y: 15, w: 160, h: 74 },
      { id: 'cons', kind: 'worker', label: 'Consumers', sub: '400/s', x: 560, y: 180, w: 160, h: 80 },
    ],
    edges: [
      { from: 'prod', to: 'queue', tone: 'brand', rate: 5 },
      { from: 'queue', to: 'reject', tone: 'danger', rate: 3, outcome: 'failure' },
      { from: 'queue', to: 'cons', tone: 'ok', rate: 2 },
    ],
  },

  bulkhead: {
    width: 760,
    height: 294,
    caption: 'Separate pools: a hung dependency cannot consume the threads checkout needs.',
    nodes: [
      { id: 'api', kind: 'server', label: 'API', x: 40, y: 100, w: 140, h: 80 },
      { id: 'p1', kind: 'api-gateway', label: 'recs pool', sub: '40 threads', x: 270, y: 10, w: 170, h: 80, status: 'down' },
      { id: 'p2', kind: 'api-gateway', label: 'checkout pool', sub: '80 threads', x: 270, y: 105, w: 170, h: 80 },
      { id: 'p3', kind: 'api-gateway', label: 'search pool', sub: '40 threads', x: 270, y: 200, w: 170, h: 80 },
      { id: 'ok', kind: 'client', label: 'Checkout still works', x: 530, y: 105, w: 200, h: 80 },
    ],
    edges: [
      { from: 'api', to: 'p1', tone: 'muted', dashed: true },
      { from: 'api', to: 'p2', tone: 'ok', rate: 2.4 },
      { from: 'api', to: 'p3', tone: 'ok', rate: 1.6 },
      { from: 'p2', to: 'ok', tone: 'ok', rate: 2.4 },
    ],
  },

  'saga-pattern': {
    width: 760,
    height: 300,
    caption: 'Step 3 failed, so steps 2 and 1 are compensated in reverse order.',
    nodes: [
      { id: 's1', kind: 'service', label: '1. Reserve stock', x: 30, y: 30, w: 170, h: 76 },
      { id: 's2', kind: 'service', label: '2. Charge card', x: 245, y: 30, w: 170, h: 76 },
      { id: 's3', kind: 'service', label: '3. Ship', sub: 'FAILED', x: 460, y: 30, w: 170, h: 80, status: 'down' },
      { id: 'c2', kind: 'worker', label: 'Refund payment', x: 245, y: 190, w: 170, h: 76 },
      { id: 'c1', kind: 'worker', label: 'Release stock', x: 30, y: 190, w: 170, h: 76 },
    ],
    edges: [
      { from: 's1', to: 's2', tone: 'ok', rate: 1.4 },
      { from: 's2', to: 's3', tone: 'danger', rate: 1.4, outcome: 'failure' },
      { from: 's3', to: 'c2', tone: 'warn', rate: 1.4, outcome: 'warning' },
      { from: 'c2', to: 'c1', tone: 'warn', rate: 1.4, outcome: 'warning' },
    ],
    steps: [
      { from: 's1', to: 's2', label: 'Stock reserved' },
      { from: 's2', to: 's3', label: 'Card charged, shipping fails', outcome: 'failure' },
      { from: 's3', to: 'c2', label: 'Compensate: refund', outcome: 'warning' },
      { from: 'c2', to: 'c1', label: 'Compensate: release stock', outcome: 'warning' },
    ],
  },

  'outbox-pattern': {
    width: 760,
    height: 280,
    caption: 'One transaction writes both rows, so an event can never be lost or invented.',
    nodes: [
      { id: 'app', kind: 'server', label: 'One transaction', x: 40, y: 95, w: 170, h: 84 },
      { id: 'db', kind: 'sql', label: 'orders + outbox', sub: 'committed together', x: 280, y: 90, w: 190, h: 92 },
      { id: 'relay', kind: 'worker', label: 'Relay', x: 540, y: 15, w: 150, h: 74 },
      { id: 'broker', kind: 'queue', label: 'Kafka', x: 540, y: 180, w: 150, h: 74 },
    ],
    edges: [
      { from: 'app', to: 'db', tone: 'brand', rate: 2 },
      { from: 'db', to: 'relay', tone: 'ok', rate: 1.6 },
      { from: 'relay', to: 'broker', tone: 'warn', rate: 1.6 },
    ],
  },

  'leader-follower': {
    width: 760,
    height: 280,
    caption: 'One node orders the writes; the rest copy that order.',
    nodes: [
      { id: 'w', kind: 'client', label: 'Writes', x: 40, y: 100, w: 140, h: 74 },
      { id: 'leader', kind: 'sql', label: 'Leader', x: 260, y: 95, w: 160, h: 84 },
      { id: 'f1', kind: 'sql', label: 'Follower', x: 520, y: 15, w: 160, h: 74 },
      { id: 'f2', kind: 'sql', label: 'Follower', x: 520, y: 180, w: 160, h: 74 },
    ],
    edges: [
      { from: 'w', to: 'leader', tone: 'brand', rate: 2 },
      { from: 'leader', to: 'f1', tone: 'violet', rate: 1.6, outcome: 'warning' },
      { from: 'leader', to: 'f2', tone: 'violet', rate: 1.6, outcome: 'warning' },
    ],
  },

  'producer-consumer': {
    width: 760,
    height: 280,
    caption: 'The buffer decouples the rates; consumption must still match production on average.',
    nodes: [
      { id: 'p', kind: 'server', label: 'Producers', x: 40, y: 95, w: 160, h: 80 },
      { id: 'buf', kind: 'queue', label: 'Bounded buffer', x: 280, y: 90, w: 180, h: 88 },
      { id: 'c', kind: 'worker', label: 'Consumers', x: 550, y: 95, w: 170, h: 80 },
    ],
    edges: [
      { from: 'p', to: 'buf', tone: 'brand', rate: 3 },
      { from: 'buf', to: 'c', tone: 'ok', rate: 3 },
    ],
  },

  'request-response': {
    width: 760,
    height: 270,
    caption: 'Each synchronous hop multiplies failure probability and adds its latency.',
    nodes: [
      { id: 'a', kind: 'service', label: 'A', sub: '99.9%', x: 40, y: 95, w: 130, h: 80 },
      { id: 'b', kind: 'service', label: 'B', sub: '99.9%', x: 230, y: 95, w: 130, h: 80 },
      { id: 'c', kind: 'service', label: 'C', sub: '99.9%', x: 420, y: 95, w: 130, h: 80 },
      { id: 'd', kind: 'sql', label: 'D', sub: 'combined ~99.7%', x: 600, y: 95, w: 140, h: 80 },
    ],
    edges: [
      { from: 'a', to: 'b', tone: 'brand', rate: 2.4 },
      { from: 'b', to: 'c', tone: 'brand', rate: 2.4 },
      { from: 'c', to: 'd', tone: 'warn', rate: 2.4, outcome: 'warning' },
    ],
  },

  'publish-subscribe': {
    width: 760,
    height: 280,
    caption: 'Adding a fourth subscriber requires no change to the publisher.',
    nodes: [
      { id: 'pub', kind: 'server', label: 'payment.captured', x: 40, y: 95, w: 190, h: 80 },
      { id: 'topic', kind: 'queue', label: 'Topic', x: 320, y: 95, w: 140, h: 80 },
      { id: 's1', kind: 'worker', label: 'Accounting', x: 560, y: 15, w: 160, h: 72 },
      { id: 's2', kind: 'worker', label: 'Email', x: 560, y: 100, w: 160, h: 72 },
      { id: 's3', kind: 'worker', label: 'Analytics', x: 560, y: 185, w: 160, h: 72 },
    ],
    edges: [
      { from: 'pub', to: 'topic', tone: 'brand', rate: 2 },
      { from: 'topic', to: 's1', tone: 'ok', rate: 2 },
      { from: 'topic', to: 's2', tone: 'ok', rate: 2 },
      { from: 'topic', to: 's3', tone: 'ok', rate: 2 },
    ],
  },

  'circuit-breaker-pattern': {
    width: 760,
    height: 300,
    caption: 'The same three states wrap any call that can fail repeatedly.',
    nodes: [
      { id: 'closed', kind: 'service', label: 'CLOSED', sub: 'calls pass', x: 60, y: 25, w: 170, h: 80 },
      { id: 'open', kind: 'service', label: 'OPEN', sub: 'fail fast', x: 500, y: 25, w: 170, h: 80, status: 'down' },
      { id: 'half', kind: 'service', label: 'HALF-OPEN', sub: 'trial calls', x: 280, y: 195, w: 170, h: 80, status: 'degraded' },
    ],
    edges: [
      { from: 'closed', to: 'open', tone: 'danger', rate: 1.2, outcome: 'failure', label: 'threshold' },
      { from: 'open', to: 'half', tone: 'warn', rate: 1.2, outcome: 'warning', label: 'cooldown' },
      { from: 'half', to: 'closed', tone: 'ok', rate: 1.2, curvature: 1.1, label: 'success' },
    ],
  },
};
