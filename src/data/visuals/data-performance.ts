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
      { from: 'db', to: 'cache', tone: 'muted', dashed: true, label: 'store' },
    ],
    steps: [
      { from: 'user', to: 'api', label: 'Read request arrives' },
      { from: 'api', to: 'cache', label: 'Check the cache first', outcome: 'cache-hit' },
      { from: 'api', to: 'db', label: 'Miss: query the database' },
      { from: 'db', to: 'cache', label: 'Store it for next time', outcome: 'cache-hit' },
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
      { from: 'app', to: 'cache', label: 'Write to cache' },
      { from: 'cache', to: 'db', label: 'Flush to database', outcome: 'warning' },
      { from: 'app', to: 'client', label: 'Acknowledge the caller' },
    ],
  },

  redis: {
    width: 760,
    height: 300,
    caption: 'One in-memory store doing four jobs: cache, sessions, counters, leaderboards.',
    nodes: [
      { id: 'api', kind: 'server', label: 'API servers', x: 60, y: 110, w: 160, h: 80 },
      { id: 'redis', kind: 'cache', label: 'Redis', sub: 'sub-millisecond', x: 300, y: 105, w: 170, h: 96, stat: ['Latency', '0.4 ms'] },
      { id: 'db', kind: 'sql', label: 'Database', sub: 'source of truth', x: 560, y: 30, w: 160, h: 80 },
      { id: 'session', kind: 'client', label: 'Sessions', sub: 'TTL 30 min', x: 560, y: 185, w: 160, h: 80 },
    ],
    edges: [
      { from: 'api', to: 'redis', tone: 'danger', rate: 4, outcome: 'cache-hit' },
      { from: 'redis', to: 'db', tone: 'muted', dashed: true, label: 'on miss' },
      { from: 'redis', to: 'session', tone: 'ok', rate: 1.6, outcome: 'cache-hit' },
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
      { from: 'scan', to: 'row', label: 'Found after 8,247 rows' },
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
      { from: 'primary', to: 'r1', label: 'Change streams to replicas', outcome: 'warning' },
      { from: 'primary', to: 'r2', label: 'Replica lags 120 ms', outcome: 'warning' },
      { from: 'primary', to: 'r3', label: 'Reads may be stale' },
    ],
  },

  'read-replicas': {
    width: 760,
    height: 300,
    caption: 'Reads leave the primary alone, so it keeps headroom for writes.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Application', x: 50, y: 105, w: 160, h: 84 },
      { id: 'primary', kind: 'sql', label: 'Primary', sub: 'writes only', x: 300, y: 20, w: 160, h: 80 },
      { id: 'replica', kind: 'sql', label: 'Read replica', sub: 'reads', x: 300, y: 185, w: 160, h: 80 },
      { id: 'bi', kind: 'search', label: 'Analytics', x: 560, y: 185, w: 150, h: 78 },
    ],
    edges: [
      { from: 'app', to: 'primary', tone: 'brand', rate: 1, label: 'writes' },
      { from: 'app', to: 'replica', tone: 'ok', rate: 4, label: 'reads' },
      { from: 'primary', to: 'replica', tone: 'violet', dashed: true, rate: 1, outcome: 'warning' },
      { from: 'replica', to: 'bi', tone: 'muted', rate: 0.6 },
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
      { from: 'app', to: 'router', label: 'Query carries the shard key' },
      { from: 'router', to: 'a', label: 'Bad key: hot shard', outcome: 'warning' },
      { from: 'router', to: 'b', label: 'Other shards sit idle' },
      { from: 'router', to: 'c', label: 'Cluster limited by one node' },
    ],
  },

  partitioning: {
    asymmetric: 'Only the September partition is scanned - pruning the others is the lesson.',
    width: 760,
    height: 290,
    caption: 'One logical table, several physical pieces. The planner skips the ones that cannot match.',
    nodes: [
      { id: 'query', kind: 'client', label: 'WHERE created_at >= Sep', x: 30, y: 105, w: 210, h: 76 },
      { id: 'p1', kind: 'sql', label: 'events_2026_07', sub: 'pruned', x: 320, y: 10, w: 170, h: 80, status: 'down' },
      { id: 'p2', kind: 'sql', label: 'events_2026_08', sub: 'pruned', x: 320, y: 100, w: 170, h: 80, status: 'down' },
      { id: 'p3', kind: 'sql', label: 'events_2026_09', sub: 'scanned', x: 320, y: 190, w: 170, h: 80 },
      { id: 'rows', kind: 'storage', label: 'Result', x: 580, y: 105, w: 140, h: 74 },
    ],
    edges: [
      { from: 'query', to: 'p3', tone: 'ok', rate: 3 },
      { from: 'query', to: 'p1', tone: 'muted', dashed: true },
      { from: 'query', to: 'p2', tone: 'muted', dashed: true },
      { from: 'p3', to: 'rows', tone: 'ok', rate: 2.4 },
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
      { id: 'pool', kind: 'api-gateway', label: 'PgBouncer', sub: '40 server connections', x: 300, y: 110, w: 180, h: 84 },
      { id: 'db', kind: 'sql', label: 'PostgreSQL', sub: 'max_connections 200', x: 570, y: 110, w: 160, h: 84 },
    ],
    edges: [
      { from: 'a1', to: 'pool', tone: 'brand', rate: 2 },
      { from: 'a2', to: 'pool', tone: 'brand', rate: 2 },
      { from: 'a3', to: 'pool', tone: 'brand', rate: 2 },
      { from: 'pool', to: 'db', tone: 'ok', rate: 2.2, label: 'multiplexed' },
    ],
  },

  denormalization: {
    width: 760,
    height: 290,
    caption: 'The expensive aggregate is computed on write, so the read is a single column.',
    nodes: [
      { id: 'write', kind: 'client', label: 'Like added', x: 40, y: 30, w: 150, h: 74 },
      { id: 'app', kind: 'server', label: 'Application', x: 280, y: 105, w: 160, h: 80 },
      { id: 'counter', kind: 'sql', label: 'posts.like_count', sub: 'precomputed', x: 540, y: 30, w: 180, h: 80 },
      { id: 'read', kind: 'client', label: 'Page view', x: 40, y: 190, w: 150, h: 74 },
    ],
    edges: [
      { from: 'write', to: 'app', tone: 'warn', rate: 1 },
      { from: 'app', to: 'counter', tone: 'violet', rate: 1, label: 'increment' },
      { from: 'read', to: 'app', tone: 'brand', rate: 4 },
      { from: 'counter', to: 'app', tone: 'ok', rate: 3.6, outcome: 'cache-hit' },
    ],
  },

  'database-normalization': {
    width: 760,
    height: 280,
    caption: 'Each fact is stored once, so two copies cannot disagree.',
    nodes: [
      { id: 'orders', kind: 'sql', label: 'orders', sub: 'id, customer_id, total', x: 90, y: 100, w: 200, h: 80 },
      { id: 'customers', kind: 'sql', label: 'customers', sub: 'id, name, email', x: 460, y: 30, w: 200, h: 80 },
      { id: 'items', kind: 'sql', label: 'order_items', sub: 'order_id, sku, qty', x: 460, y: 170, w: 200, h: 80 },
    ],
    edges: [
      { from: 'orders', to: 'customers', tone: 'info', rate: 1.4, label: 'customer_id' },
      { from: 'orders', to: 'items', tone: 'info', rate: 1.4, label: 'order_id' },
    ],
  },

  'sql-databases': {
    width: 760,
    height: 290,
    caption: 'One transaction, several tables, invariants enforced by the engine.',
    nodes: [
      { id: 'app', kind: 'server', label: 'BEGIN ... COMMIT', x: 50, y: 105, w: 180, h: 80 },
      { id: 'db', kind: 'sql', label: 'PostgreSQL', sub: 'ACID', x: 320, y: 100, w: 160, h: 96, stat: ['Isolation', 'serializable'] },
      { id: 'users', kind: 'storage', label: 'users', x: 570, y: 25, w: 150, h: 72 },
      { id: 'orders', kind: 'storage', label: 'orders', x: 570, y: 185, w: 150, h: 72 },
    ],
    edges: [
      { from: 'app', to: 'db', tone: 'brand', rate: 3 },
      { from: 'db', to: 'users', tone: 'info', rate: 1.6 },
      { from: 'db', to: 'orders', tone: 'info', rate: 1.6 },
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
  },

  'database-caching': {
    width: 760,
    height: 280,
    caption: 'The database caches too. Check the buffer pool before adding another cache.',
    nodes: [
      { id: 'q', kind: 'client', label: 'Query', x: 50, y: 100, w: 140, h: 74 },
      { id: 'plan', kind: 'server', label: 'Plan cache', x: 250, y: 100, w: 150, h: 74 },
      { id: 'buffer', kind: 'cache', label: 'Buffer pool', sub: 'hot pages in RAM', x: 450, y: 25, w: 170, h: 96, stat: ['Hit ratio', '99%'] },
      { id: 'disk', kind: 'storage', label: 'Disk', x: 450, y: 180, w: 170, h: 74 },
    ],
    edges: [
      { from: 'q', to: 'plan', tone: 'brand', rate: 3 },
      { from: 'plan', to: 'buffer', tone: 'ok', rate: 2.8, outcome: 'cache-hit' },
      { from: 'buffer', to: 'disk', tone: 'muted', dashed: true, rate: 0.3, label: 'on miss' },
    ],
  },

  'application-caching': {
    width: 760,
    height: 300,
    caption: 'Local caches are the fastest and the least consistent - each instance holds its own copy.',
    nodes: [
      { id: 'i1', kind: 'server', label: 'Instance A', sub: 'flags v7', x: 60, y: 40, w: 170, h: 80 },
      { id: 'i2', kind: 'server', label: 'Instance B', sub: 'flags v6', x: 60, y: 175, w: 170, h: 80, alert: true },
      { id: 'redis', kind: 'cache', label: 'Redis', sub: 'shared tier', x: 340, y: 105, w: 160, h: 82 },
      { id: 'db', kind: 'sql', label: 'Database', x: 580, y: 105, w: 150, h: 78 },
    ],
    edges: [
      { from: 'i1', to: 'redis', tone: 'ok', rate: 1.6, outcome: 'cache-hit' },
      { from: 'i2', to: 'redis', tone: 'ok', rate: 1.6, outcome: 'cache-hit' },
      { from: 'redis', to: 'db', tone: 'muted', dashed: true, rate: 0.4 },
    ],
  },
};
