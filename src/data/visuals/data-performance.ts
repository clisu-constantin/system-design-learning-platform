import type { VisualSpec } from '@/components/architecture/FlowVisual';

export const dataVisuals: Record<string, VisualSpec> = {
  caching: {
    width: 760,
    height: 320,
    caption: 'A hit returns from memory in ~4 ms. A miss pays the database round trip, then fills the cache.',
    nodes: [
      { id: 'user', kind: 'client', label: 'User', x: 40, y: 120, w: 140, h: 74 },
      { id: 'api', kind: 'server', label: 'API', x: 230, y: 120, w: 140, h: 74 },
      { id: 'cache', kind: 'cache', label: 'Redis', sub: 'hit 4 ms', x: 430, y: 30, w: 160, h: 96, stat: ['Hit rate', '91%'] },
      { id: 'db', kind: 'sql', label: 'PostgreSQL', sub: 'miss 120 ms', x: 430, y: 200, w: 160, h: 82 },
    ],
    edges: [
      { from: 'user', to: 'api', tone: 'brand', rate: 4 },
      { from: 'api', to: 'cache', tone: 'ok', rate: 3.6, outcome: 'cache-hit' },
      { from: 'api', to: 'db', tone: 'violet', rate: 0.5, label: 'on miss' },
    ],
    steps: [
      { from: 'user', to: 'api', label: 'Read request arrives' },
      { from: 'api', to: 'cache', label: 'Check the cache: miss', outcome: 'warning' },
      { from: 'api', to: 'db', label: 'Query the database, 120 ms' },
      { from: 'db', to: 'api', label: 'Row comes back' },
      { from: 'api', to: 'cache', label: 'Store it with a TTL' },
      { from: 'api', to: 'user', label: 'Return the answer' },
      { from: 'api', to: 'cache', label: 'Next read: hit in 4 ms', outcome: 'cache-hit' },
    ],
  },

  'cache-strategies': {
    width: 760,
    height: 300,
    caption: 'Who writes to the cache, and when - that is the entire difference between the strategies.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 50, y: 110, w: 160, h: 78 },
      { id: 'cache', kind: 'cache', label: 'Cache', x: 310, y: 30, w: 150, h: 76 },
      { id: 'db', kind: 'sql', label: 'Database', x: 310, y: 190, w: 150, h: 76 },
      { id: 'client', kind: 'client', label: 'Caller', x: 570, y: 110, w: 150, h: 76 },
    ],
    edges: [
      { from: 'app', to: 'cache', tone: 'ok', rate: 2.4, outcome: 'cache-hit' },
      { from: 'app', to: 'db', tone: 'violet', rate: 1 },
      { from: 'cache', to: 'db', tone: 'muted', dashed: true, label: 'write behind' },
      { from: 'app', to: 'client', tone: 'brand', rate: 2.4 },
    ],
    steps: [
      { from: 'client', to: 'app', label: 'Caller sends a write' },
      { from: 'app', to: 'cache', label: 'Write lands in the cache' },
      { from: 'app', to: 'client', label: 'Acknowledged before the database' },
      { from: 'cache', to: 'db', label: 'Flushed to the database later', outcome: 'warning' },
    ],
  },

  redis: {
    width: 760,
    height: 300,
    caption: 'One in-memory store doing four jobs: cache, sessions, counters, leaderboards.',
    nodes: [
      { id: 'api', kind: 'server', label: 'API servers', x: 60, y: 110, w: 160, h: 80 },
      { id: 'redis', kind: 'cache', label: 'Redis', sub: 'sub-millisecond', x: 300, y: 20, w: 170, h: 96, stat: ['Latency', '0.4 ms'] },
      { id: 'db', kind: 'sql', label: 'Database', sub: 'source of truth', x: 300, y: 195, w: 170, h: 80 },
      { id: 'session', kind: 'client', label: 'Sessions', sub: 'TTL 30 min', x: 560, y: 28, w: 160, h: 80 },
    ],
    edges: [
      { from: 'api', to: 'redis', tone: 'danger', rate: 4, outcome: 'cache-hit' },
      { from: 'api', to: 'db', tone: 'muted', dashed: true, label: 'on miss' },
      { from: 'redis', to: 'session', tone: 'ok', rate: 1.6, outcome: 'cache-hit' },
    ],
    steps: [
      { from: 'api', to: 'redis', label: 'Command runs in RAM' },
      { from: 'redis', to: 'api', label: 'Hit: answered in 0.4 ms', outcome: 'cache-hit' },
      { from: 'redis', to: 'session', label: 'Sessions expire after 30 min' },
      { from: 'api', to: 'db', label: 'Miss: app reads the database' },
      { from: 'api', to: 'redis', label: 'App caches it with TTL' },
    ],
  },

  'database-indexing': {
    width: 760,
    height: 310,
    caption: 'Without an index the database reads every row. With one it reads about log2(n) nodes.',
    nodes: [
      { id: 'query', kind: 'client', label: 'SELECT by email', x: 40, y: 115, w: 170, h: 76 },
      { id: 'scan', kind: 'sql', label: 'Sequential scan', sub: '8,247 rows read', x: 300, y: 25, w: 180, h: 96, stat: ['Time', '350 ms'], alert: true },
      { id: 'index', kind: 'sql', label: 'B-tree index scan', sub: '13 nodes read', x: 300, y: 190, w: 180, h: 96, stat: ['Time', '4 ms'] },
      { id: 'row', kind: 'storage', label: 'Matching row', x: 580, y: 115, w: 150, h: 76 },
    ],
    edges: [
      { from: 'query', to: 'scan', tone: 'danger', rate: 3.4, outcome: 'warning' },
      { from: 'query', to: 'index', tone: 'ok', rate: 3.4 },
      { from: 'scan', to: 'row', tone: 'muted', rate: 0.5 },
      { from: 'index', to: 'row', tone: 'ok', rate: 2.4 },
    ],
    steps: [
      { from: 'query', to: 'scan', label: 'No index: read every row', outcome: 'warning' },
      { from: 'scan', to: 'row', label: 'Found after 8,247 rows', outcome: 'warning' },
      { from: 'query', to: 'index', label: 'With index: walk the tree' },
      { from: 'index', to: 'row', label: 'Found after 13 reads' },
    ],
  },

  replication: {
    width: 760,
    height: 343,
    caption: 'Writes go to the primary and stream to replicas. Replicas serve reads - slightly behind.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 305, y: 10, w: 150, h: 68 },
      { id: 'primary', kind: 'sql', label: 'Primary', sub: 'accepts writes', x: 295, y: 120, w: 170, h: 80 },
      { id: 'r1', kind: 'sql', label: 'Replica 1', x: 70, y: 245, w: 145, h: 84, stat: ['Lag', '40 ms'] },
      { id: 'r2', kind: 'sql', label: 'Replica 2', x: 305, y: 245, w: 145, h: 84, stat: ['Lag', '120 ms'] },
      { id: 'r3', kind: 'sql', label: 'Replica 3', x: 540, y: 245, w: 145, h: 84, stat: ['Lag', '90 ms'] },
    ],
    edges: [
      { from: 'app', to: 'primary', tone: 'brand', rate: 2, label: 'writes' },
      { from: 'primary', to: 'r1', tone: 'violet', rate: 1.6, outcome: 'warning' },
      { from: 'primary', to: 'r2', tone: 'violet', rate: 1.6, outcome: 'warning' },
      { from: 'primary', to: 'r3', tone: 'violet', rate: 1.6, outcome: 'warning' },
    ],
    steps: [
      { from: 'app', to: 'primary', label: 'Write hits the primary' },
      { from: 'primary', to: 'app', label: 'Acknowledged before replicas apply' },
      { from: 'primary', to: 'r1', label: 'Replica 1 applies after 40 ms', outcome: 'warning' },
      { from: 'primary', to: 'r2', label: 'Replica 2: stale for 120 ms', outcome: 'warning' },
      { from: 'primary', to: 'r3', label: 'Replica 3 applies after 90 ms', outcome: 'warning' },
    ],
  },

  'read-replicas': {
    width: 760,
    height: 300,
    caption: 'Reads leave the primary alone, so it keeps headroom for writes.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 30, y: 110, w: 160, h: 80 },
      { id: 'primary', kind: 'sql', label: 'Primary', sub: 'takes every write', x: 270, y: 20, w: 170, h: 80 },
      { id: 'replica', kind: 'sql', label: 'Read replica', sub: 'app reads', x: 270, y: 200, w: 170, h: 80 },
      { id: 'areplica', kind: 'sql', label: 'Analytics replica', sub: 'reports only', x: 530, y: 20, w: 200, h: 80 },
      { id: 'bi', kind: 'search', label: 'Analytics', x: 555, y: 200, w: 150, h: 78 },
    ],
    edges: [
      { from: 'app', to: 'primary', tone: 'brand', rate: 1, label: 'writes' },
      { from: 'app', to: 'replica', tone: 'ok', rate: 4, label: 'reads' },
      { from: 'primary', to: 'replica', tone: 'violet', dashed: true, rate: 1, outcome: 'warning' },
      { from: 'primary', to: 'areplica', tone: 'violet', dashed: true, rate: 1, outcome: 'warning' },
      { from: 'bi', to: 'areplica', tone: 'muted', rate: 0.6 },
    ],
    steps: [
      { from: 'app', to: 'primary', label: 'Write goes to the primary' },
      { from: 'primary', to: 'replica', label: 'Change copies over, slightly behind', outcome: 'warning' },
      { from: 'app', to: 'replica', label: 'Reads go to the replica' },
      { from: 'replica', to: 'app', label: 'Rows back, primary untouched' },
      { from: 'app', to: 'primary', label: 'Reload after save: read primary' },
      { from: 'primary', to: 'areplica', label: 'Analytics replica gets the stream', outcome: 'warning' },
      { from: 'bi', to: 'areplica', label: 'Heavy report runs apart' },
    ],
  },

  sharding: {
    width: 760,
    height: 350,
    caption: 'Each shard owns a slice of the data. A skewed key concentrates traffic on one of them.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 305, y: 10, w: 150, h: 68 },
      { id: 'router', kind: 'api-gateway', label: 'Shard router', sub: 'range(user_id)', x: 295, y: 118, w: 170, h: 80 },
      { id: 'a', kind: 'sql', label: 'Shard A', sub: 'users 1-3M', x: 70, y: 240, w: 150, h: 96, stat: ['Load', '90%'], alert: true },
      { id: 'b', kind: 'sql', label: 'Shard B', sub: 'users 3-6M', x: 305, y: 240, w: 150, h: 96, stat: ['Load', '20%'] },
      { id: 'c', kind: 'sql', label: 'Shard C', sub: 'users 6-10M', x: 540, y: 240, w: 150, h: 96, stat: ['Load', '18%'] },
    ],
    edges: [
      { from: 'app', to: 'router', tone: 'brand', rate: 5 },
      { from: 'router', to: 'a', tone: 'danger', rate: 4, outcome: 'warning' },
      { from: 'router', to: 'b', tone: 'ok', rate: 0.9 },
      { from: 'router', to: 'c', tone: 'ok', rate: 0.8 },
    ],
    steps: [
      { from: 'app', to: 'router', label: 'Query carries user_id, the key' },
      { from: 'router', to: 'b', label: 'user_id 4M: Shard B owns it' },
      { from: 'router', to: 'a', label: 'Busiest users crowd Shard A', outcome: 'warning' },
      { from: 'router', to: 'c', label: 'Shard C idles at 18%' },
    ],
  },

  partitioning: {
    asymmetric: 'Only the September partition is read - pruning the other two is the lesson.',
    width: 760,
    height: 290,
    caption: 'One logical table inside one database, stored as monthly partitions. The planner skips the ones that cannot match.',
    nodes: [
      { id: 'app', kind: 'server', label: 'App', sub: 'created_at >= Sep 1', x: 20, y: 105, w: 170, h: 76 },
      { id: 'planner', kind: 'sql', label: 'Planner', sub: 'events, one database', x: 250, y: 105, w: 170, h: 76 },
      { id: 'p1', kind: 'storage', label: 'events_2026_07', sub: 'July: pruned', x: 540, y: 10, w: 190, h: 76 },
      { id: 'p2', kind: 'storage', label: 'events_2026_08', sub: 'August: pruned', x: 540, y: 105, w: 190, h: 76 },
      { id: 'p3', kind: 'storage', label: 'events_2026_09', sub: 'September: read', x: 540, y: 200, w: 190, h: 76 },
    ],
    edges: [
      { from: 'app', to: 'planner', tone: 'brand', rate: 1.5 },
      { from: 'planner', to: 'p1', tone: 'muted', dashed: true },
      { from: 'planner', to: 'p2', tone: 'muted', dashed: true },
      { from: 'planner', to: 'p3', tone: 'ok', rate: 1.5 },
    ],
    steps: [
      { from: 'app', to: 'planner', label: 'Query filters on created_at' },
      { from: 'planner', to: 'p1', label: 'July cannot match: pruned', skipped: true },
      { from: 'planner', to: 'p2', label: 'August cannot match: pruned', skipped: true },
      { from: 'planner', to: 'p3', label: 'Only September is read' },
      { from: 'p3', to: 'planner', label: 'Rows come back' },
      { from: 'planner', to: 'app', label: 'Answer from one partition' },
    ],
  },

  'connection-pooling': {
    width: 760,
    height: 300,
    caption: '10 servers x 100 connections exhausts a database that serves the same traffic through 40.',
    nodes: [
      { id: 'a1', kind: 'server', label: 'API 1', x: 50, y: 25, w: 140, h: 74 },
      { id: 'a2', kind: 'server', label: 'API 2', x: 50, y: 115, w: 140, h: 74 },
      { id: 'a3', kind: 'server', label: 'API 3', x: 50, y: 205, w: 140, h: 74 },
      { id: 'pool', kind: 'api-gateway', label: 'PgBouncer x2', sub: '40 server conns in total', x: 300, y: 110, w: 180, h: 84 },
      { id: 'db', kind: 'sql', label: 'PostgreSQL', sub: 'max_connections 200', x: 570, y: 110, w: 160, h: 84 },
    ],
    edges: [
      { from: 'a1', to: 'pool', tone: 'brand', rate: 2 },
      { from: 'a2', to: 'pool', tone: 'brand', rate: 2 },
      { from: 'a3', to: 'pool', tone: 'brand', rate: 2 },
      { from: 'pool', to: 'db', tone: 'ok', rate: 2.2, label: 'multiplexed' },
    ],
    steps: [
      { from: 'a1', to: 'pool', label: 'API 1 asks for a connection' },
      { from: 'pool', to: 'db', label: 'Query uses one of 40' },
      { from: 'db', to: 'pool', label: 'Done: connection back in pool' },
      { from: 'a2', to: 'pool', label: 'API 2 reuses the same 40' },
      { from: 'a3', to: 'pool', label: 'API 3 shares them too' },
      { from: 'pool', to: 'db', label: 'Database sees only 40 connections' },
    ],
  },

  denormalization: {
    width: 760,
    height: 300,
    caption: 'The like count is kept on the post, so a page view reads one column instead of counting rows.',
    nodes: [
      { id: 'write', kind: 'client', label: 'Like added', x: 30, y: 30, w: 150, h: 74 },
      { id: 'read', kind: 'client', label: 'Page view', x: 30, y: 196, w: 150, h: 74 },
      { id: 'app', kind: 'server', label: 'Application', x: 280, y: 110, w: 160, h: 80 },
      { id: 'likes', kind: 'sql', label: 'likes', sub: 'one row per like', x: 550, y: 20, w: 180, h: 80 },
      { id: 'counter', kind: 'sql', label: 'posts.like_count', sub: 'precomputed copy', x: 550, y: 196, w: 180, h: 80 },
    ],
    edges: [
      { from: 'write', to: 'app', tone: 'warn', rate: 0.8 },
      { from: 'app', to: 'likes', tone: 'violet', rate: 0.8 },
      { from: 'read', to: 'app', tone: 'brand', rate: 3.2 },
      { from: 'app', to: 'counter', tone: 'ok', rate: 4 },
    ],
    steps: [
      { from: 'write', to: 'app', label: 'A like arrives' },
      { from: 'app', to: 'likes', label: 'Insert the like row' },
      { from: 'app', to: 'counter', label: 'Same transaction: increment like_count' },
      { from: 'read', to: 'app', label: 'Page view needs the count' },
      { from: 'app', to: 'counter', label: 'Read one column, no COUNT' },
      { from: 'counter', to: 'app', label: 'Count comes back in one row' },
      { from: 'app', to: 'read', label: 'Page renders' },
    ],
  },

  'database-normalization': {
    width: 760,
    height: 290,
    caption: 'The email is stored once: a change writes one row, and a read joins to it.',
    nodes: [
      { id: 'read', kind: 'client', label: 'Order page', x: 30, y: 30, w: 150, h: 74 },
      { id: 'change', kind: 'client', label: 'Email change', x: 30, y: 190, w: 150, h: 74 },
      { id: 'orders', kind: 'sql', label: 'orders', sub: 'id, customer_id, total', x: 300, y: 27, w: 200, h: 80 },
      { id: 'customers', kind: 'sql', label: 'customers', sub: 'id, name, email', x: 300, y: 187, w: 200, h: 80 },
    ],
    edges: [
      { from: 'read', to: 'orders', tone: 'brand', rate: 2 },
      { from: 'orders', to: 'customers', tone: 'info', rate: 2, label: 'join on customer_id' },
      { from: 'change', to: 'customers', tone: 'warn', rate: 0.6 },
    ],
    steps: [
      { from: 'change', to: 'customers', label: 'Email change writes one row' },
      { from: 'read', to: 'orders', label: 'Order page reads the order' },
      { from: 'orders', to: 'customers', label: 'Join customers on customer_id' },
      { from: 'customers', to: 'orders', label: 'The one email comes back' },
      { from: 'orders', to: 'read', label: 'Page shows the current email' },
    ],
  },

  'sql-databases': {
    width: 760,
    height: 290,
    caption: 'One transaction, several tables, invariants enforced by the engine.',
    nodes: [
      { id: 'app', kind: 'server', label: 'BEGIN ... COMMIT', x: 50, y: 105, w: 180, h: 80 },
      { id: 'db', kind: 'sql', label: 'PostgreSQL', sub: 'ACID', x: 320, y: 100, w: 160, h: 96, stat: ['Isolation', 'read committed'] },
      { id: 'products', kind: 'storage', label: 'products', x: 570, y: 25, w: 150, h: 72 },
      { id: 'orders', kind: 'storage', label: 'orders', x: 570, y: 185, w: 150, h: 72 },
    ],
    edges: [
      { from: 'app', to: 'db', tone: 'brand', rate: 3 },
      { from: 'db', to: 'products', tone: 'info', rate: 1.6 },
      { from: 'db', to: 'orders', tone: 'info', rate: 1.6 },
    ],
    steps: [
      { from: 'app', to: 'db', label: 'BEGIN a transaction' },
      { from: 'db', to: 'products', label: 'Reserve stock in products' },
      { from: 'db', to: 'orders', label: 'Insert the orders row' },
      { from: 'db', to: 'app', label: 'COMMIT: both or neither' },
    ],
  },

  'nosql-databases': {
    asymmetric: 'A key lookup reaches exactly one partition; the others are never touched.',
    width: 760,
    height: 290,
    caption: 'The partition key decides where a record lives - and it is in almost every query.',
    nodes: [
      { id: 'app', kind: 'server', label: 'get(user_42)', x: 50, y: 105, w: 170, h: 78 },
      { id: 'p1', kind: 'nosql', label: 'Partition 1', x: 320, y: 15, w: 160, h: 74 },
      { id: 'p2', kind: 'nosql', label: 'Partition 2', x: 320, y: 105, w: 160, h: 74 },
      { id: 'p3', kind: 'nosql', label: 'Partition 3', x: 320, y: 195, w: 160, h: 74 },
      { id: 'doc', kind: 'storage', label: 'One document', sub: 'read whole', x: 570, y: 105, w: 160, h: 80 },
    ],
    edges: [
      { from: 'app', to: 'p2', tone: 'ok', rate: 3.4 },
      { from: 'app', to: 'p1', tone: 'muted', dashed: true },
      { from: 'app', to: 'p3', tone: 'muted', dashed: true },
      { from: 'p2', to: 'doc', tone: 'ok', rate: 2.6 },
    ],
    steps: [
      { from: 'app', to: 'p2', label: 'Key hashes to Partition 2' },
      { from: 'p2', to: 'doc', label: 'Whole document in one read' },
      { from: 'app', to: 'p1', label: 'Partition 1 is never touched', skipped: true },
      { from: 'app', to: 'p3', label: 'Neither is Partition 3', skipped: true },
    ],
  },

  'relational-vs-non-relational': {
    width: 760,
    height: 300,
    caption: 'Both are fast. They differ in what they guarantee and how easily they partition.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 300, y: 10, w: 160, h: 70 },
      { id: 'sql', kind: 'sql', label: 'Relational', sub: 'joins, transactions', x: 80, y: 150, w: 190, h: 96, stat: ['Scale', 'replicas + sharding'] },
      { id: 'nosql', kind: 'nosql', label: 'Non-relational', sub: 'one access pattern', x: 480, y: 150, w: 190, h: 96, stat: ['Scale', 'partitioned'] },
    ],
    edges: [
      { from: 'app', to: 'sql', tone: 'info', rate: 2.4 },
      { from: 'app', to: 'nosql', tone: 'warn', rate: 2.4 },
    ],
    steps: [
      { from: 'app', to: 'sql', label: 'Join and transact across tables' },
      { from: 'sql', to: 'app', label: 'Any query, harder to shard' },
      { from: 'app', to: 'nosql', label: 'Get by partition key' },
      { from: 'nosql', to: 'app', label: 'One pattern, scales out easily' },
    ],
  },

  'database-caching': {
    width: 760,
    height: 300,
    caption: 'The database caches too. Check the buffer pool before adding another cache.',
    nodes: [
      { id: 'app', kind: 'server', label: 'App', x: 20, y: 108, w: 110, h: 74 },
      { id: 'engine', kind: 'sql', label: 'Query engine', sub: 'prepared plans', x: 175, y: 104, w: 160, h: 82 },
      { id: 'buffer', kind: 'cache', label: 'Buffer pool', sub: 'hot pages in RAM', x: 385, y: 96, w: 170, h: 98, stat: ['Hit ratio', '99%'] },
      { id: 'orders', kind: 'storage', label: 'Orders table', sub: 'on disk', x: 600, y: 20, w: 150, h: 82 },
      { id: 'view', kind: 'storage', label: 'Sales view', sub: 'materialized', x: 600, y: 196, w: 150, h: 82 },
    ],
    edges: [
      { from: 'app', to: 'engine', tone: 'brand', rate: 3 },
      { from: 'engine', to: 'buffer', tone: 'ok', rate: 2.8, outcome: 'cache-hit' },
      { from: 'buffer', to: 'orders', tone: 'muted', dashed: true, rate: 0.3 },
      { from: 'buffer', to: 'view', tone: 'muted', dashed: true, rate: 0.3 },
    ],
    steps: [
      { from: 'app', to: 'engine', label: 'Query arrives, plan reused' },
      { from: 'engine', to: 'buffer', label: 'Hot page found in RAM', outcome: 'cache-hit' },
      { from: 'buffer', to: 'engine', label: 'Rows back, no disk read', outcome: 'cache-hit' },
      { from: 'buffer', to: 'orders', label: 'Cold page: read from disk', outcome: 'warning' },
      { from: 'orders', to: 'buffer', label: 'Refresh reads every order' },
      { from: 'buffer', to: 'view', label: 'View stores the new totals' },
      { from: 'engine', to: 'app', label: 'View read: one precomputed row', outcome: 'cache-hit' },
    ],
  },

  'application-caching': {
    width: 760,
    height: 300,
    caption: 'Each instance holds its own copy; copies disagree for up to one local TTL.',
    nodes: [
      { id: 'lb', kind: 'load-balancer', label: 'Load balancer', sub: '2 nodes, round robin', x: 20, y: 110, w: 170, h: 80 },
      { id: 'i1', kind: 'server', label: 'Instance A', sub: 'local: flags v7', x: 270, y: 30, w: 170, h: 80 },
      { id: 'i2', kind: 'server', label: 'Instance B', sub: 'local: flags v6', x: 270, y: 190, w: 170, h: 80, alert: true },
      { id: 'redis', kind: 'cache', label: 'Redis', sub: 'shared L2', x: 560, y: 30, w: 170, h: 80 },
      { id: 'db', kind: 'sql', label: 'Database', x: 560, y: 190, w: 170, h: 80 },
    ],
    edges: [
      { from: 'lb', to: 'i1', tone: 'brand', rate: 2 },
      { from: 'lb', to: 'i2', tone: 'brand', rate: 2 },
      { from: 'i1', to: 'redis', tone: 'ok', rate: 0.6, outcome: 'cache-hit' },
      { from: 'i2', to: 'redis', tone: 'ok', rate: 0.6, outcome: 'cache-hit' },
      { from: 'i1', to: 'db', tone: 'muted', dashed: true, rate: 0.2 },
      { from: 'i2', to: 'db', tone: 'muted', dashed: true, rate: 0.2 },
    ],
    steps: [
      { from: 'lb', to: 'i1', label: 'Request lands on instance A' },
      { from: 'i1', to: 'redis', label: 'Local copy expired: ask Redis' },
      { from: 'i1', to: 'db', label: 'Redis missed too: query database' },
      { from: 'db', to: 'i1', label: 'A now caches flags v7', outcome: 'cache-hit' },
      { from: 'lb', to: 'i2', label: 'Next request lands on B' },
      { from: 'i2', to: 'lb', label: 'B still answers flags v6', outcome: 'warning' },
    ],
  },
};
