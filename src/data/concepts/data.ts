import type { Concept } from '@/types';

export const dataConcepts: Concept[] = [
  {
    slug: 'sql-databases',
    title: 'SQL Databases',
    tagline: 'Relations, schemas and transactions you can reason about.',
    category: 'data',
    difficulty: 'Beginner',
    keywords: ['postgres', 'mysql', 'acid', 'joins', 'schema'],
    what: 'Relational databases store data in tables with a declared schema, express relationships through keys, and support multi-row transactions with ACID guarantees.',
    why: 'Most business data is relational, and most business rules are invariants across several rows. A transactional engine enforces those invariants for you instead of leaving them to application code.',
    how: [
      'Model entities as tables with primary keys; express relationships with foreign keys.',
      'The query planner decides how to satisfy a query using available indexes and statistics.',
      'Transactions provide atomicity, consistency, isolation and durability - commit or nothing.',
      'Scale reads with replicas; scale writes vertically first, then by partitioning or sharding.',
    ],
    when: [
      'Data with relationships and invariants: orders, payments, inventory, accounts.',
      'Query patterns that are not known in advance - SQL is good at ad-hoc questions.',
    ],
    diagram: `users            orders
------           ------
id (PK)   <----  user_id (FK)
email            id (PK)
country          total_cents
                 status

SELECT u.email, SUM(o.total_cents)
FROM users u JOIN orders o ON o.user_id = u.id
GROUP BY u.email;`,
    tradeoffs: [
      {
        approach: 'Relational database',
        gains: ['Transactions across rows and tables', 'Flexible ad-hoc queries', 'Schema catches bad data early'],
        costs: ['Horizontal write scaling needs deliberate sharding', 'Schema changes on huge tables need care', 'Joins get expensive at very large scale'],
      },
    ],
    mistakes: [
      'Assuming "SQL does not scale" - a single well-tuned Postgres instance handles very large workloads.',
      'Using a relational store as a queue or a cache because it is already there.',
    ],
    related: ['nosql-databases', 'relational-vs-non-relational', 'database-indexing', 'replication'],
  },
  {
    slug: 'nosql-databases',
    title: 'NoSQL Databases',
    tagline: 'Data models built around a specific access pattern.',
    category: 'data',
    difficulty: 'Beginner',
    keywords: ['mongodb', 'cassandra', 'dynamodb', 'key value', 'document', 'wide column'],
    what: 'NoSQL covers several families: key-value stores, document stores, wide-column stores and graph databases. Each trades general-purpose querying for a specific shape of access.',
    why: 'When you know the access pattern in advance and need it to stay fast at very large scale, a store designed around that pattern can partition and replicate more easily than a general relational engine.',
    how: [
      'Key-value (Redis, DynamoDB): O(1) lookup by key, no joins.',
      'Document (MongoDB): store an aggregate as one document, read it in one operation.',
      'Wide-column (Cassandra, HBase): partition key plus clustering key, optimised for huge write volumes.',
      'Graph (Neo4j): relationships are first-class, traversals are cheap.',
    ],
    when: [
      'High write throughput with a known partition key.',
      'Documents that are always read as a whole (a product page, a user profile).',
      'Flexible or rapidly changing shape of data.',
    ],
    diagram: `Document store               Wide column store

{ _id: "u_42",               partition: user_id
  name: "Ada",               cluster:   created_at desc
  addresses: [ ... ],        -> reads of one user timeline are
  orders: [ ... ] }             one contiguous disk scan`,
    tradeoffs: [
      {
        approach: 'NoSQL store',
        gains: ['Partitioning is built in', 'Predictable latency for the designed access pattern', 'Schema flexibility'],
        costs: [
          'Cross-entity transactions are limited or absent',
          'New query patterns may require re-modelling or duplicating data',
          'Denormalised data must be kept in sync by your code',
        ],
      },
    ],
    mistakes: [
      'Choosing NoSQL for "speed" and then implementing joins in the application layer.',
      'Picking a partition key that concentrates traffic on one partition.',
      'Assuming schema-less means you have no schema - it means the schema lives in your code.',
    ],
    related: ['sql-databases', 'relational-vs-non-relational', 'sharding', 'eventual-consistency'],
  },
  {
    slug: 'relational-vs-non-relational',
    title: 'Relational vs Non-Relational',
    tagline: 'Not fast vs slow - different guarantees and different query freedom.',
    category: 'data',
    difficulty: 'Beginner',
    keywords: ['comparison', 'trade-offs', 'choice'],
    what: 'A comparison of relational and non-relational stores along the dimensions that actually differ: data model, query flexibility, transactions, scaling story and operational cost.',
    why: 'The common shorthand ("SQL is slow, NoSQL is fast") is wrong and leads to bad choices. Both families can be fast; they differ in what they guarantee and what they make easy.',
    how: [
      'Ask whether your query patterns are known and stable. If yes, a purpose-built store can win.',
      'Ask whether you need multi-entity transactions. If yes, relational is the low-effort path.',
      'Ask what your write volume and partition key look like at 10x current scale.',
      'Ask who will operate it at 3am.',
    ],
    diagram: `SQL (PostgreSQL)          NoSQL (document / wide column)
-----------------         ------------------------------
Tables and rows           Documents or wide rows
Declared schema           Schema enforced by application
JOINs across entities     Denormalised aggregates
Multi-row ACID            Per-key or limited transactions
Ad-hoc queries            Queries the model was designed for
Scale reads via replicas  Partitioning built into the product
Shard deliberately        Shard key is a modelling decision`,
    tradeoffs: [
      {
        approach: 'Start relational',
        gains: ['Fewer irreversible decisions', 'Transactions and constraints prevent data bugs', 'Easy ad-hoc analysis'],
        costs: ['Write scaling eventually requires work', 'Schema migrations need planning'],
      },
      {
        approach: 'Start non-relational',
        gains: ['Horizontal scale from day one', 'Model matches one access pattern exactly'],
        costs: ['Consistency handled in application code', 'Changing access patterns is expensive', 'Analytics usually needs a second system'],
      },
    ],
    mistakes: [
      'Choosing based on popularity rather than on transaction and query requirements.',
      'Mixing both without a clear rule about which system owns which data.',
    ],
    related: ['sql-databases', 'nosql-databases', 'denormalization', 'cap-theorem'],
    quiz: [
      {
        id: 'rvn-1',
        prompt: 'Which statement is accurate?',
        options: [
          'NoSQL databases are always faster than relational databases',
          'Relational databases cannot scale beyond one machine',
          'Both can be fast; they differ in transactional guarantees and how easily they partition',
          'NoSQL databases do not need a data model',
        ],
        answer: 2,
        explanation:
          'Performance depends on the access pattern and the hardware. The real differences are guarantees, query flexibility and how partitioning is handled.',
      },
    ],
  },
  {
    slug: 'database-indexing',
    title: 'Database Indexing',
    tagline: 'Trading write cost and storage for dramatically faster reads.',
    category: 'data',
    difficulty: 'Beginner',
    lab: 'indexing',
    keywords: ['b-tree', 'full scan', 'query plan', 'composite index', 'selectivity'],
    what: 'An index is an auxiliary data structure - usually a B-tree - that lets the database find rows matching a predicate without scanning the whole table.',
    why: 'Without an index, finding one row in ten million means reading ten million rows. With a B-tree index it means a handful of page reads, because each step discards most of the remaining rows.',
    how: [
      'A B-tree keeps keys sorted; each node narrows the search range, giving O(log n) lookups.',
      'The planner uses table statistics to decide whether the index is cheaper than a scan.',
      'A composite index on (a, b) serves queries filtering on a, or on a and b - but not on b alone.',
      'Covering indexes include the selected columns so the table itself is never touched.',
    ],
    when: [
      'Columns used in WHERE, JOIN and ORDER BY clauses.',
      'High-selectivity columns (email, user_id) - an index on a boolean rarely helps.',
    ],
    diagram: `WITHOUT INDEX (sequential scan)
row 1, row 2, row 3 ... row 8247 -> FOUND
rows scanned: 8,247      time: ~350 ms

WITH B-TREE INDEX ON email
        [ m ]
       /     \\
   [ f ]     [ s ]
   /   \\     /   \\
 ...   [john@example.com] -> row pointer
rows inspected: ~13      time: ~4 ms`,
    advantages: [
      'Turns linear scans into logarithmic lookups.',
      'Speeds up sorting and range queries when the order matches the index.',
      'Unique indexes enforce correctness, not just speed.',
    ],
    tradeoffs: [
      {
        approach: 'Adding an index',
        gains: ['Much faster reads for matching queries', 'Cheaper sorts and joins'],
        costs: [
          'Every INSERT, UPDATE and DELETE must maintain it',
          'Extra storage, often 10-30% of the table per index',
          'More indexes means a slower write path and more cache pressure',
        ],
      },
    ],
    mistakes: [
      'Indexing every column "just in case" and halving write throughput.',
      'Wrapping the indexed column in a function (LOWER(email)) so the index cannot be used.',
      'Creating (b, a) when queries filter on a - column order in composite indexes matters.',
      'Forgetting that adding an index to a huge table can lock writes unless built concurrently.',
    ],
    realWorld: [
      'EXPLAIN / EXPLAIN ANALYZE is how you check whether an index is actually used.',
      'Write-heavy tables (event logs) are often deliberately under-indexed.',
    ],
    related: ['sql-databases', 'read-replicas', 'denormalization', 'caching'],
    quiz: [
      {
        id: 'idx-1',
        prompt: 'A table has an index on (country, created_at). Which query can use it efficiently?',
        options: [
          'WHERE created_at > ?',
          'WHERE country = ? AND created_at > ?',
          'WHERE LOWER(country) = ?',
          'WHERE email = ?',
        ],
        answer: 1,
        explanation:
          'A composite index is usable from the leftmost column onwards. Filtering on created_at alone skips the leading column, and wrapping a column in a function prevents index use.',
      },
      {
        id: 'idx-2',
        prompt: 'What is the main cost of adding an index?',
        options: [
          'Reads become slower',
          'Writes become slower and storage grows, because the index must be maintained',
          'The database can no longer use transactions',
          'Replication stops working',
        ],
        answer: 1,
        explanation:
          'Indexes are a read/write trade. Every mutation updates every affected index, and each index occupies storage and cache.',
      },
    ],
  },
  {
    slug: 'replication',
    title: 'Replication',
    tagline: 'Copies of your data on other machines - for reads, and for surviving failure.',
    category: 'data',
    difficulty: 'Intermediate',
    lab: 'replication',
    keywords: ['primary', 'replica', 'failover', 'lag', 'synchronous', 'asynchronous'],
    what: 'Replication keeps copies of a dataset on multiple nodes. Writes go to a primary (in the common leader-based model) and are streamed to replicas that can serve reads and take over on failure.',
    why: 'One database instance is both a capacity limit and a single point of failure. Replicas give you read capacity, a failover target, and a copy in another availability zone.',
    how: [
      'The primary writes changes to a log (WAL / binlog) and streams it to replicas.',
      'Asynchronous replication acknowledges the client before replicas have applied the change.',
      'Synchronous replication waits for at least one replica, trading latency for durability.',
      'On primary failure, an orchestrator promotes the most up-to-date replica and repoints traffic.',
    ],
    when: [
      'Read-heavy workloads that can tolerate slightly stale data.',
      'Any system with an availability target that a single instance cannot meet.',
      'Geographic distribution of reads.',
    ],
    diagram: `         WRITE
           |
           v
       [ PRIMARY ]
        /   |   \\   replication stream
       v    v    v
   Replica Replica Replica
      ^       ^       ^
     READS   READS   READS

FAILOVER
Primary DOWN -> promote Replica 1 -> repoint writes`,
    advantages: [
      'Read throughput scales with the number of replicas.',
      'A replica in another zone survives the loss of a whole datacentre.',
      'Replicas can serve analytics without touching the write path.',
    ],
    tradeoffs: [
      {
        approach: 'Asynchronous replication',
        gains: ['Writes are fast - no waiting for replicas', 'Replica outages do not block writes'],
        costs: ['Replication lag means stale reads', 'A failover can lose recently acknowledged writes'],
      },
      {
        approach: 'Synchronous replication',
        gains: ['No acknowledged write is lost on failover', 'Replicas are always current'],
        costs: ['Every write pays a network round trip', 'A slow or unreachable replica stalls writes unless quorum-based'],
      },
    ],
    mistakes: [
      'Reading your own write from a replica immediately after writing, and showing the user stale data.',
      'Assuming failover is instant - detection, promotion and DNS/connection repointing all take time.',
      'Treating replicas as backups. A deleted row replicates in milliseconds; a backup lets you go back in time.',
    ],
    realWorld: [
      'Read-your-writes is commonly solved by routing a user to the primary for a short window after they write.',
      'Managed services (RDS Multi-AZ, Cloud SQL HA) automate promotion but still have a measurable failover window.',
    ],
    related: ['read-replicas', 'sharding', 'failover', 'eventual-consistency', 'high-availability'],
    quiz: [
      {
        id: 'rep-1',
        prompt: 'A user updates their profile and immediately sees the old value. Writes go to the primary, reads to replicas. What is happening?',
        options: [
          'The write failed silently',
          'Replication lag - the replica has not applied the change yet',
          'The cache is broken',
          'The primary is down',
        ],
        answer: 1,
        explanation:
          'With asynchronous replication the replica is slightly behind. Read-your-writes requires routing that user to the primary or waiting for the replica to catch up.',
      },
      {
        id: 'rep-2',
        prompt: 'Why is a replica not a backup?',
        options: [
          'Replicas are slower',
          'Replicas faithfully copy destructive changes, including an accidental DELETE',
          'Replicas cannot be restored',
          'Replicas do not store all columns',
        ],
        answer: 1,
        explanation:
          'Replication propagates mistakes as quickly as it propagates good data. Backups and point-in-time recovery protect against logical errors.',
      },
    ],
  },
  {
    slug: 'sharding',
    title: 'Sharding',
    tagline: 'Splitting one dataset across many databases, by key.',
    category: 'data',
    difficulty: 'Advanced',
    lab: 'sharding',
    keywords: ['shard key', 'hot shard', 'partition', 'routing', 'resharding'],
    what: 'Sharding splits a dataset horizontally across independent database instances. A shard key decides which shard owns each row, and a router sends each query to the right shard.',
    why: 'Replication scales reads, but every replica still holds the whole dataset and every write still goes through one primary. Sharding is how you scale writes and data volume beyond one machine.',
    how: [
      'Choose a shard key present in almost every query - user_id, tenant_id, or a hash of it.',
      'Map key to shard by range, by hash, or through a lookup/directory service.',
      'Route queries: single-shard queries are fast; cross-shard queries must scatter and gather.',
      'Plan resharding before you need it - consistent hashing or virtual buckets reduce the pain.',
    ],
    when: [
      'The working set no longer fits on the largest reasonable machine.',
      'Write throughput exceeds what one primary can absorb.',
      'Regulatory requirements force data to live in specific regions.',
    ],
    diagram: `                Shard Router
        +------------+------------+
        v            v            v
    Shard A      Shard B      Shard C
   users 1-3M   users 3-6M   users 6-10M

BAD SHARD KEY (country, skewed traffic)
Shard A  ################# 90%   <- hot shard
Shard B  #####             20%
Shard C  #####             18%`,
    advantages: [
      'Write capacity and storage grow with shard count.',
      'Failure of one shard affects only part of the users.',
      'Enables data residency per region.',
    ],
    tradeoffs: [
      {
        approach: 'Hash sharding',
        gains: ['Even distribution', 'No hot ranges from sequential keys'],
        costs: ['Range queries must hit every shard', 'Resharding moves data unless you use consistent hashing'],
      },
      {
        approach: 'Range sharding',
        gains: ['Efficient range scans', 'Simple to reason about and rebalance by split'],
        costs: ['Sequential keys create a hot shard at the end', 'Uneven growth needs active rebalancing'],
      },
      {
        approach: 'Directory / lookup sharding',
        gains: ['Full control over placement', 'Easy to move a single tenant'],
        costs: ['The directory is an extra dependency and a single point of failure', 'One more lookup per query'],
      },
    ],
    mistakes: [
      'Sharding by something skewed (country, "enterprise customer") and creating a hot shard.',
      'Designing queries that need joins across shards - they become scatter-gather with the slowest shard setting latency.',
      'Sharding before exhausting vertical scaling, replicas and caching. It is a one-way door.',
      'Forgetting that cross-shard transactions need sagas or two-phase commit.',
    ],
    realWorld: [
      'Multi-tenant SaaS often shards by tenant_id, which keeps almost every query single-shard.',
      'Instagram-style systems shard by user id and generate globally unique ids that embed the shard.',
    ],
    related: ['partitioning', 'replication', 'nosql-databases'],
    quiz: [
      {
        id: 'sh-1',
        prompt: 'You shard a social app by country. One country produces 70% of traffic. What is the result?',
        options: [
          'Perfectly balanced load',
          'A hot shard that saturates while others idle - the cluster is limited by one node',
          'Faster queries for that country',
          'Reduced storage usage',
        ],
        answer: 1,
        explanation:
          'A shard key must distribute both data and traffic. Skewed keys mean one shard becomes the bottleneck and adding shards does not help.',
      },
      {
        id: 'sh-2',
        prompt: 'What should you usually try before sharding?',
        options: [
          'Nothing - shard as early as possible',
          'Vertical scaling, read replicas, caching and query tuning',
          'Switching programming language',
          'Adding more application servers',
        ],
        answer: 1,
        explanation:
          'Sharding permanently complicates queries, transactions and operations. Cheaper options usually buy years of headroom.',
      },
    ],
  },
  {
    slug: 'partitioning',
    title: 'Partitioning',
    tagline: 'Splitting one table into manageable pieces inside a single database.',
    category: 'data',
    difficulty: 'Intermediate',
    keywords: ['range partition', 'list partition', 'pruning', 'retention'],
    what: 'Partitioning divides a large table into smaller physical pieces - by range (usually time), by list, or by hash - while keeping one logical table inside one database.',
    why: 'It keeps indexes small, lets the planner skip irrelevant partitions, and makes deleting old data an instant DROP instead of a multi-hour DELETE.',
    how: [
      'Choose a partition column that appears in most queries - created_at for event data.',
      'The planner prunes partitions that cannot match the predicate.',
      'Retention becomes DROP PARTITION rather than a bulk delete and vacuum.',
    ],
    when: ['Time-series and event tables.', 'Tables large enough that index maintenance hurts.'],
    diagram: `events (logical table)
  |- events_2026_07   <- pruned
  |- events_2026_08   <- pruned
  |- events_2026_09   <- scanned
WHERE created_at >= '2026-09-01'`,
    tradeoffs: [
      {
        approach: 'Partitioning',
        gains: ['Smaller indexes', 'Partition pruning', 'Cheap retention'],
        costs: ['Queries without the partition key touch every partition', 'More objects to manage', 'Unique constraints must include the partition key'],
      },
    ],
    mistakes: ['Confusing partitioning with sharding - partitioning stays inside one database and does not add write capacity.'],
    related: ['sharding', 'database-indexing', 'sql-databases'],
  },
  {
    slug: 'database-normalization',
    title: 'Database Normalization',
    tagline: 'Store each fact once so it cannot contradict itself.',
    category: 'data',
    difficulty: 'Beginner',
    keywords: ['3nf', 'schema design', 'redundancy', 'integrity'],
    what: 'Normalization organises tables so that each piece of information is stored in exactly one place, with relationships expressed by keys.',
    why: 'Duplicated data drifts. If a customer address exists in three tables, sooner or later they disagree, and no query can tell you which one is right.',
    how: [
      'Give every entity its own table and a primary key.',
      'Move repeating groups into child tables linked by foreign keys.',
      'Ensure non-key columns depend on the whole key and nothing else (third normal form is usually enough).',
    ],
    when: ['Transactional systems where correctness of writes matters most.'],
    diagram: `DENORMALISED                    NORMALISED
orders                          orders        customers
 id, customer_name,              id,           id (PK)
 customer_email, total           customer_id,  name
 (name repeated per order)       total         email`,
    tradeoffs: [
      {
        approach: 'Normalized schema',
        gains: ['No update anomalies', 'Smaller storage', 'One source of truth'],
        costs: ['Reads need joins', 'Very hot read paths may become join-heavy'],
      },
    ],
    related: ['denormalization', 'sql-databases', 'database-indexing'],
  },
  {
    slug: 'denormalization',
    title: 'Denormalization',
    tagline: 'Deliberately duplicating data to make a read path fast.',
    category: 'data',
    difficulty: 'Intermediate',
    keywords: ['read optimization', 'precomputation', 'materialized view', 'fan-out'],
    what: 'Denormalization stores redundant copies of data - a counter, an embedded document, a materialised view - so that a frequent read does not have to join or aggregate.',
    why: 'Some read paths are so hot that joins and aggregates dominate your database load. Precomputing the answer moves the cost to write time, where it is usually cheaper and rarer.',
    how: [
      'Identify the expensive, frequent query.',
      'Precompute its result on write, or maintain a materialised view.',
      'Decide how the copy is kept in sync: transactionally, via triggers, or asynchronously through events.',
      'Accept and document a staleness window if the update is asynchronous.',
    ],
    when: ['Feeds, counters, leaderboards, product pages, anything read far more than written.'],
    diagram: `Normalized read:  SELECT COUNT(*) FROM likes WHERE post_id = ?
                  -> scans thousands of rows per page view

Denormalized:     posts.like_count  (maintained on write)
                  -> one column read, updated when a like happens`,
    tradeoffs: [
      {
        approach: 'Denormalization',
        gains: ['Much faster and cheaper reads', 'Predictable query cost'],
        costs: ['Two copies that can diverge', 'Write path becomes more complex', 'Backfills needed when logic changes'],
      },
    ],
    mistakes: [
      'Denormalising before measuring - an index often solves the same problem with no duplication.',
      'Having no reconciliation job, so drift is never detected.',
    ],
    related: ['database-normalization', 'caching', 'cqrs', 'fan-out'],
  },
  {
    slug: 'read-replicas',
    title: 'Read Replicas',
    tagline: 'Send reads somewhere else so the primary can keep writing.',
    category: 'data',
    difficulty: 'Beginner',
    lab: 'replication',
    keywords: ['read scaling', 'lag', 'routing', 'analytics'],
    what: 'Read replicas are copies of the primary database that serve read-only queries.',
    why: 'Most applications read far more than they write. Moving reads off the primary frees it for writes and gives you a warm failover target at the same time.',
    how: [
      'Point read-only queries at a replica endpoint, writes at the primary.',
      'Route reads that must be fresh (read-your-writes) back to the primary.',
      'Watch replication lag as a first-class metric and stop routing to a lagging replica.',
    ],
    when: ['Read-heavy workloads.', 'Reporting and analytics that would otherwise compete with production traffic.'],
    diagram: `app --writes--> PRIMARY --stream--> REPLICA 1 <--reads-- app
                   |                 REPLICA 2 <--reads-- analytics
                   +--stream-------->`,
    tradeoffs: [
      {
        approach: 'Routing reads to replicas',
        gains: ['Primary keeps headroom for writes', 'Read capacity scales with replica count'],
        costs: ['Stale reads under lag', 'Application must decide per query where it is safe to read'],
      },
    ],
    mistakes: ['Routing every read to replicas including the one right after a write.'],
    related: ['replication', 'caching', 'connection-pooling'],
  },
  {
    slug: 'connection-pooling',
    title: 'Connection Pooling',
    tagline: 'Reuse a small number of database connections instead of opening one per request.',
    category: 'data',
    difficulty: 'Intermediate',
    keywords: ['pgbouncer', 'max connections', 'saturation', 'thundering herd'],
    what: 'A connection pool keeps a bounded set of established database connections and lends them to requests, instead of creating a new connection each time.',
    why: 'Database connections are expensive: each one costs memory and, in Postgres, a backend process. Ten app servers opening 100 connections each will exhaust a database that happily serves the same traffic through 40 pooled connections.',
    how: [
      'Size the pool from the database limit, not from the request rate: total connections across all instances must stay under max_connections.',
      'Keep pool size close to the number of cores the database can actually use in parallel.',
      'Set acquisition timeouts so a saturated pool fails fast instead of queueing forever.',
      'Use an external pooler (PgBouncer) when you have many application instances or serverless functions.',
    ],
    when: ['Any application tier that scales horizontally in front of a relational database.'],
    diagram: `10 app servers x 100 connections = 1000 -> database max_connections 200  ->  refused

With pooling: 10 servers x 20 = 200, requests queue briefly inside the app
With PgBouncer: thousands of client connections multiplexed onto ~40 server connections`,
    tradeoffs: [
      {
        approach: 'Small pool',
        gains: ['Database stays responsive', 'Queueing happens in the app, where it is visible'],
        costs: ['Requests wait for a connection under burst'],
      },
      {
        approach: 'Large pool',
        gains: ['No waiting in the application'],
        costs: ['Database context-switches and memory pressure', 'Latency collapses for everyone at saturation'],
      },
    ],
    mistakes: [
      'Autoscaling the app tier without accounting for the connection multiplier.',
      'Infinite acquisition timeouts, turning a slow database into a fully stalled service.',
    ],
    related: ['horizontal-scaling', 'backpressure', 'read-replicas'],
    quiz: [
      {
        id: 'cp-1',
        prompt: 'Autoscaling grows the API tier from 4 to 20 instances and the database starts refusing connections. Why?',
        options: [
          'The database ran out of disk',
          'Each instance holds its own pool, so total connections grew 5x past the server limit',
          'Replication lag increased',
          'The load balancer opened too many sockets',
        ],
        answer: 1,
        explanation:
          'Pool size multiplies by instance count. Either size pools with the maximum fleet in mind, or put a shared pooler in front of the database.',
      },
    ],
  },
];
