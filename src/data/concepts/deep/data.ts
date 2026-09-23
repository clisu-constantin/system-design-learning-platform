import type { DepthMap } from './types';

export const dataDepth: DepthMap = {
  'sql-databases': {
    analogy: {
      title: 'A spreadsheet with a strict office manager',
      body:
        'Every sheet has fixed columns, and the manager refuses any row with a missing field, a wrong type, or a customer id that does not exist in the customers sheet. Annoying on the day you want to paste something quickly - priceless three years later, when nobody can explain how a row with a negative price and no owner got in. That enforcement is what a relational database sells you.',
    },
    deepDive: [
      {
        heading: 'The schema is a constraint you want',
        paragraphs: [
          'A relational database refuses to store data that breaks its rules: types, NOT NULL, unique keys, foreign keys, check constraints. Every one of those is a class of bug that becomes impossible rather than merely unlikely, enforced for all clients at once - including the ad-hoc script somebody runs at midnight.',
          'Application-level validation cannot achieve this, because there is always a second writer: a migration, a backfill, another service, a support tool. Rules that live in the database apply to all of them. That is the argument for constraints in one sentence.',
          'The cost is genuine. Changing a schema means a migration, and on a large table a careless ALTER can lock writes for minutes. That pain is real, and it is also the pain of being forced to think about what the data means before changing it.',
        ],
        bullets: [
          'Foreign key - this order must belong to a customer that exists.',
          'Unique - two accounts cannot share an email.',
          'Check - a price may not be negative.',
          'NOT NULL - a row without this field is meaningless, so refuse it.',
          'Transactions - either all these rows change, or none of them do.',
        ],
      },
      {
        heading: 'ACID, in plain words',
        paragraphs: [
          'Atomicity: a transaction is all or nothing. If the debit succeeds and the credit fails, both are rolled back, and no state exists where money vanished. Consistency: the database never ends a transaction in a state that violates its constraints. Isolation: concurrent transactions do not see each other half-finished. Durability: once committed, it survives a crash, because it was written to a log on disk first.',
          'Isolation is the one worth studying, because it has levels and the default is rarely the strictest. Read committed (the Postgres default) prevents dirty reads but allows the same query to return different results twice in one transaction. Repeatable read and serializable close more gaps at the cost of conflicts and retries.',
          'The practical lesson: if two requests can modify the same row concurrently, read-modify-write in application code is a race. Use an atomic update (UPDATE ... SET n = n + 1), a SELECT FOR UPDATE lock, or a version column with an optimistic check. This is one of the most common real bugs in application code, and it hides perfectly at low traffic.',
        ],
        code: {
          caption: 'The classic lost update, and three fixes',
          body: `BROKEN (read, then write)
  n = SELECT stock FROM items WHERE id=7      -- both read 10
  UPDATE items SET stock = n-1 WHERE id=7     -- both write 9, one sale lost

FIX 1 atomic write
  UPDATE items SET stock = stock - 1 WHERE id=7 AND stock > 0

FIX 2 pessimistic lock
  SELECT stock FROM items WHERE id=7 FOR UPDATE   -- second txn waits

FIX 3 optimistic version
  UPDATE items SET stock=9, version=6 WHERE id=7 AND version=5
  -- 0 rows updated means somebody beat you; re-read and retry`,
        },
      },
      {
        heading: 'Joins, and the thing SQL is genuinely best at',
        paragraphs: [
          'The real superpower of a relational database is that you do not have to know the questions in advance. Store the data normalised, and any future query - joins across five tables, a new report, an aggregation nobody planned - is expressible without changing how the data is stored.',
          'That flexibility is why SQL remains the correct default for most products. Early on you do not know your access patterns; a document store makes you commit to them at write time, while a relational schema lets you discover them and add an index later.',
          'Modern Postgres also closes most of the historical gaps. JSONB columns give you schemaless fields where you genuinely want them, with indexes on their contents. Partitioning, logical replication and full-text search are built in. The honest modern advice is to use Postgres until a specific measured requirement forces something else.',
        ],
      },
    ],
    examples: [
      {
        title: 'One transaction that prevents a whole class of support tickets',
        setup:
          'Placing an order must: create the order, reserve stock, and record a payment. Any of the three can fail.',
        walkthrough: [
          'Without a transaction: the order row is written, stock reservation succeeds, then the payment insert fails on a constraint. You now have an order that nobody paid for and stock that is not available.',
          'Support has to find these by hand, and the reconciliation script to detect them is more code than the feature itself.',
          'With BEGIN ... COMMIT around all three, the payment failure rolls back everything. The customer sees an error; the database holds no partial order.',
          'Note the limits: this works because all three tables live in one database. As soon as payment moves to another service, atomicity is gone and you need a saga or an outbox instead.',
          'Also note isolation: reserving stock must be an atomic conditional update, or two concurrent orders can both reserve the last unit even inside transactions.',
        ],
        result:
          'A transaction converted a permanent data-integrity problem into a normal error response. This is the single most valuable thing a relational database does for an application, and it is free.',
      },
    ],
    jargon: [
      { term: 'ACID', plain: 'Atomic, consistent, isolated, durable - the four promises a relational transaction makes.' },
      { term: 'Schema', plain: 'The declared shape of your tables. Enforced for every writer, not just your code.' },
      { term: 'Foreign key', plain: 'A rule that a value must exist in another table. Stops orphan rows.' },
      { term: 'Transaction', plain: 'A group of statements that commit together or not at all.' },
      { term: 'Isolation level', plain: 'How much concurrent transactions may see of each other. The default is usually not the strictest.' },
      { term: 'Optimistic locking', plain: 'Check a version column on write and retry if somebody changed the row first.' },
    ],
    remember: [
      'Constraints in the database apply to every writer, including the script you forgot about.',
      'Transactions turn multi-step operations into all-or-nothing ones.',
      'Read-then-write across requests is a race; use atomic updates, locks or versions.',
      'Normalised relational data answers questions you had not thought of yet.',
      'Postgres is the right default until a measured requirement says otherwise.',
    ],
  },

  'nosql-databases': {
    analogy: {
      title: 'A wall of labelled boxes',
      body:
        'Instead of a filing cabinet with strict folders, you have boxes with labels. Fetching the box with a given label is instant, and each box may hold anything you like. Finding every box that contains a red object, though, means opening all of them. That is the bargain: unbeatable at fetching by key, awkward at questions you did not plan for.',
    },
    deepDive: [
      {
        heading: 'NoSQL is four different things, not one',
        paragraphs: [
          'Lumping them together causes most of the confusion. Key-value stores (Redis, DynamoDB) map a key to a value and behave like a hash map, usually spread over many machines. Document stores (MongoDB) hold JSON documents and can index fields inside them. Wide-column stores (Cassandra, HBase) are built around a partition key plus a sorted clustering key, optimised for enormous write volume. Graph databases (Neo4j) store relationships as first-class objects for traversal queries.',
          'They share one design philosophy: give up some of what a relational database offers - joins, arbitrary queries, strong multi-row transactions - in exchange for horizontal scalability and a data model that matches a specific access pattern exactly.',
          'So the useful question is never "SQL or NoSQL". It is "which of these four shapes matches how I read and write this data, and can I live with what it cannot do?"',
        ],
        code: {
          caption: 'Same data, four shapes',
          body: `key-value     "user:42" -> {json blob}        get/put by key only
document      {_id:42, name, orders:[...]}    index any field
wide-column   pk=user42, ck=2024-05-01#ord9   huge writes, range scans
graph         (user42)-[:ORDERED]->(order9)   traverse relationships`,
        },
      },
      {
        heading: 'Design for the query, because there are no joins',
        paragraphs: [
          'In a relational database you model the data and write queries later. In most NoSQL stores you must invert that: list the queries first, then design the storage so that each query is a single lookup by key or a single partition scan. Getting this wrong is not a performance problem, it is a wall - the query you did not plan for may be impossible without scanning everything.',
          'The consequence is duplication. The same fact is written into several places so it can be read from each of them cheaply: an order stored under the customer and under the day and under the product. Storage is cheap and reads are fast, but now every write must update several copies, and keeping them consistent is your job, not the database.',
          'This is also why schema flexibility is oversold. There is always a schema; it just lives in application code instead of the database. Five services writing slightly different shapes into one collection is a migration problem you will discover during an incident rather than at deploy time.',
        ],
        bullets: [
          'Write down every read query before designing the tables.',
          'Choose the partition key so that one query touches one partition.',
          'Expect to duplicate data; budget the writes and the consistency work.',
          'Watch for hot partitions: a key like "today" concentrates all traffic on one node.',
          'Schemaless means the schema lives in your code - write validation there deliberately.',
        ],
      },
      {
        heading: 'What you actually gain',
        paragraphs: [
          'Horizontal write scaling is the headline. Partitioning is built into the model rather than bolted on, so adding nodes adds write capacity. A wide-column store absorbing a million writes per second is doing something a single relational primary cannot.',
          'Predictable latency at scale is the second gain. When every read is a single-key lookup in one partition, p99 stays flat as data grows, because no query plan can accidentally degrade into a sequential scan across a billion rows.',
          'Availability is the third: many of these systems are designed to keep serving during a partition, with tunable consistency per operation. You choose per query whether to wait for a quorum or accept a possibly stale local answer - a knob relational systems usually do not offer.',
        ],
      },
    ],
    examples: [
      {
        title: 'Choosing a partition key for a chat app',
        setup:
          'Messages must be read as "the last 50 messages of conversation X" and written constantly. You are designing a wide-column table.',
        walkthrough: [
          'Naive key: partition by message_id. Every message lands on a random node, writes spread perfectly - but reading a conversation requires touching every node. Wrong.',
          'Better: partition key = conversation_id, clustering key = timestamp descending. One conversation lives in one partition, sorted; "last 50 messages" is one sequential read.',
          'New problem: a conversation with two million messages makes one enormous partition, and one huge partition on one node is a hotspot and a slow compaction.',
          'Refinement: partition key = (conversation_id, month). Each partition stays bounded, and the common query - recent messages - touches the current month only.',
          'Cost of the refinement: reading across a month boundary needs two lookups, and searching old history means querying several partitions. That is the trade you accept for bounded partitions.',
        ],
        result:
          'The data model was decided entirely by the read pattern, not by the entities. That inversion - queries first, tables second - is the core skill for NoSQL, and the main thing that trips up people coming from SQL.',
      },
    ],
    jargon: [
      { term: 'Partition key', plain: 'The field that decides which node holds a row. The most important choice you make.' },
      { term: 'Clustering key', plain: 'How rows are sorted inside a partition, which makes range queries cheap.' },
      { term: 'Hot partition', plain: 'One key receiving a disproportionate share of traffic, so one node melts while others idle.' },
      { term: 'Denormalisation', plain: 'Writing the same fact in several places so each read is a single lookup.' },
      { term: 'Eventually consistent', plain: 'Replicas agree after a short delay; a read right after a write may be stale.' },
      { term: 'Tunable consistency', plain: 'Choosing per query how many replicas must answer before you accept the result.' },
    ],
    remember: [
      'NoSQL is four different tools - pick by data shape and access pattern.',
      'Design tables from the queries, not from the entities.',
      'No joins means deliberate duplication, and duplication means you own consistency.',
      'The partition key decides scalability; a bad one creates a hotspot.',
      'Schemaless does not remove the schema, it moves it into your application.',
    ],
  },

  'relational-vs-non-relational': {
    analogy: {
      title: 'A library versus a warehouse of crates',
      body:
        'A library indexes every book by author, subject and title, so you can answer questions nobody anticipated. A warehouse stores sealed crates by barcode: fetching a known crate is instantaneous, and the warehouse scales by adding aisles. Asking "which crates contain something blue" is where it falls apart. Both are excellent - at different questions.',
    },
    deepDive: [
      {
        heading: 'Ask about access patterns, not about scale',
        paragraphs: [
          'Most teams choose a database on an imagined future scale and regret it. The better question is the shape of the queries. If you mostly fetch one object by a known id, almost anything works. If you need to answer questions that combine several entities - and especially questions you cannot list today - a relational store is the low-effort fit, because it runs the join where the data lives.',
          'The second question is about transactions: does any single user action have to change several things atomically? Orders, payments, bookings and inventory almost always do. Feeding that requirement into a store without multi-object transactions means implementing sagas and compensations, which is a large amount of hand-written correctness work.',
          'Only the third question is scale, and be honest about the numbers. A single Postgres instance on decent hardware handles tens of thousands of transactions per second and terabytes of data. Most products never reach that, and the ones that do usually reach it for one table, not the whole database.',
        ],
        code: {
          caption: 'A decision path that actually works',
          body: `Do queries join or aggregate across entities?     -> relational
Must several rows change atomically?             -> relational
Is every access "get/put by a known key"?        -> key-value
Are writes > ~50k/sec on one entity?             -> wide-column
Is the data mostly relationships (paths, rings)? -> graph
Is it a cache or a leaderboard?                  -> Redis
Unsure / early product?                          -> Postgres`,
        },
      },
      {
        heading: 'Polyglot persistence: it is not one or the other',
        paragraphs: [
          'Real systems use several stores, each where it fits. Postgres for orders and accounts, Redis for sessions and rate limits, Elasticsearch for text search, S3 for files, maybe Cassandra for an event firehose. That is normal and correct; the mistake is using five stores from day one for a product with a thousand users.',
          'The rule that keeps it sane: one system of record per piece of data. Everything else is a derived copy that can be rebuilt. If two stores both claim to be the truth for orders, you will eventually spend a week reconciling them.',
          'Each additional store also has a fixed cost you keep paying: backups, upgrades, monitoring, a failover procedure, and somebody who understands it at 3am. That cost is the reason to add the second store later rather than earlier.',
        ],
        bullets: [
          'One system of record per fact; every other copy is derived and rebuildable.',
          'Derived stores (search indexes, caches, read models) should be re-creatable from the source.',
          'Every store adds backups, upgrades, monitoring and on-call knowledge.',
          'Postgres covers JSON documents, full-text search and queues well enough to delay the second store for a long time.',
        ],
      },
      {
        heading: 'What each side got better at',
        paragraphs: [
          'The old dividing lines have blurred. Relational databases now have JSONB with indexes, native partitioning, logical replication and distributed variants like CockroachDB and Vitess that scale writes horizontally while speaking SQL. The "SQL cannot scale" claim is a decade out of date.',
          'On the other side, document stores added transactions and stronger consistency options; MongoDB has multi-document ACID transactions and DynamoDB has transactional writes. The "NoSQL cannot do transactions" claim is also out of date, though the guarantees are narrower and usually more expensive.',
          'What has not changed is the underlying physics: joining data that lives on different machines is expensive, and coordinating writes across machines costs round trips. Every system that offers both flexibility and horizontal scale pays for it somewhere, usually in latency or in operational complexity.',
        ],
      },
    ],
    examples: [
      {
        title: 'The same feature in both worlds',
        setup:
          'Requirement: show the order history of a user with product names and current shipping status, 500 requests per second.',
        walkthrough: [
          'Relational: one query joining orders, order_items, products and shipments on indexed keys. Roughly 5 ms. Adding "filter by product category" later is a WHERE clause - no data migration.',
          'Document store: the order document must already embed product names and status, because there is no join. One read, about 1 ms - faster.',
          'But when a product is renamed, every order document containing it must be updated, or the history shows stale names. You now own that fan-out write.',
          'And "filter by category" requires either embedding the category too (another backfill of every document) or a secondary index that scans widely.',
          'At 500 requests per second, both are comfortable. The difference is not performance, it is which future change is cheap.',
        ],
        result:
          'Relational trades a few milliseconds for the ability to change your mind. Document trades flexibility for a single fast read. At small scale that trade is almost always worth making in favour of flexibility.',
      },
    ],
    jargon: [
      { term: 'System of record', plain: 'The one store that owns the truth for a piece of data. Everything else is a copy.' },
      { term: 'Polyglot persistence', plain: 'Using several databases, each for what it is good at.' },
      { term: 'NewSQL', plain: 'Distributed databases that keep SQL and transactions while scaling horizontally.' },
      { term: 'Access pattern', plain: 'How the data is actually read and written. The main input to the choice.' },
      { term: 'Impedance mismatch', plain: 'The friction between objects in code and rows in tables. Smaller than it used to be.' },
    ],
    remember: [
      'Choose on access patterns and transaction needs first; scale third.',
      'One system of record per fact - everything else is a derived, rebuildable copy.',
      'A single relational instance goes much further than people assume.',
      'Every extra datastore costs backups, monitoring and on-call knowledge forever.',
      'The dividing lines blurred: SQL scales further and NoSQL has transactions now.',
    ],
  },

  'database-indexing': {
    analogy: {
      title: 'The index at the back of a textbook',
      body:
        'To find every mention of "mitochondria" you could read all 900 pages, or use the index, which lists the word once with its page numbers. It is sorted, so you find the word in seconds. It also costs pages, and every time the book is revised the index must be regenerated. Exactly the deal a database index offers: much faster reads, slightly slower writes, more space.',
    },
    deepDive: [
      {
        heading: 'What a B-tree index actually does',
        paragraphs: [
          'A database does not read rows one at a time. It reads pages: fixed blocks of 8 KB in PostgreSQL, each holding many rows. Without an index, finding rows matching a condition means a sequential scan: read every page and test every row on it. A 5 million row table of about 100 rows per page is 50,000 pages. An index is a separate, sorted structure mapping column values to row locations, so the database can search it instead of reading everything.',
          'The shape used almost everywhere is a B-tree: a shallow tree of pages where each page holds hundreds of keys. Each level multiplies the reach of the tree by that many, so a table of a thousand rows and a table of a billion rows differ by only a couple of levels - typically 3 to 4 page reads to locate any row, then one more for the row itself. That is why indexes feel like magic: a table a few hundred times larger costs about one extra page read.',
          'The sorted order is a second gift. An index on created_at makes ORDER BY created_at LIMIT 20 cheap, because the data is already in order - the database reads the first 20 entries and stops, with no sort of the whole table. Range queries (BETWEEN, >, <) work for the same reason.',
        ],
        code: {
          caption: 'Same query, two plans',
          body: `SELECT * FROM users WHERE email = 'ana@example.com';

WITHOUT index
  Seq Scan on users   50,000 pages read   ~1,200 ms

WITH index on (email)
  Index Scan using users_email_idx
    3 index pages + 1 table page          ~0.3 ms

Cost of that index: ~200 MB, and every INSERT/UPDATE of email
now writes to the table AND the index.`,
        },
      },
      {
        heading: 'Composite indexes and the left-prefix rule',
        paragraphs: [
          'An index on (tenant_id, created_at) sorts by tenant first, then by date inside each tenant. That serves WHERE tenant_id = 7 and it serves WHERE tenant_id = 7 ORDER BY created_at. It does not serve WHERE created_at > x on its own, because the dates are only sorted within each tenant - a phone book sorted by surname then first name is useless for finding everyone called Ana.',
          'This left-prefix rule is the most valuable index fact to know. An index on (a, b, c) can be used for queries on a, on (a, b) and on (a, b, c), but not for b alone. Order the columns by putting equality filters first, then the range or sort column last.',
          'A covering index goes one step further: include every column the query needs, and the database can answer from the index alone and skip the table page (PostgreSQL calls this an index-only scan, and still checks the table for rows changed very recently). It removes one page read per lookup on a hot path, at the cost of a larger index.',
        ],
        bullets: [
          'Equality columns first, range or ORDER BY column last.',
          '(a, b) also covers queries on a alone - so do not create both.',
          'Low-selectivity columns (a boolean, a status with 3 values) rarely deserve their own index.',
          'A covering index answers the query without reading the table page - useful for one hot read path.',
          'Partial indexes (WHERE deleted_at IS NULL) are small and fast when most rows are irrelevant.',
        ],
      },
      {
        heading: 'The cost side, stated honestly',
        paragraphs: [
          'Every index must be updated on every insert, update of an indexed column, and delete. A table with eight indexes does nine writes per insert. On a write-heavy table that is the difference between comfortable and saturated, which is why "add an index for every query" is bad advice. Building an index costs too: a plain CREATE INDEX in PostgreSQL blocks writes to the table until it finishes, so large production tables use CREATE INDEX CONCURRENTLY.',
          'Indexes also consume memory. The reason an index is fast is that its upper levels stay cached in RAM; once the working set of indexes exceeds memory, every lookup starts hitting disk and the benefit collapses. Unused indexes are therefore not free even when nobody queries them - they evict useful pages.',
          'So the workflow is: find the slow queries, read the execution plan, add the narrowest index that fixes them, and periodically delete indexes that statistics show are never used. Most databases expose usage counts, and most mature systems have several indexes that have never been read.',
        ],
      },
    ],
    examples: [
      {
        title: 'Reading an execution plan and fixing it',
        setup:
          'A dashboard query takes 2.3 seconds: SELECT * FROM events WHERE tenant_id = 7 AND created_at > now() - interval 7 day ORDER BY created_at DESC LIMIT 50. The table has 80 million rows and an index on (created_at).',
        walkthrough: [
          'EXPLAIN shows an index scan on created_at, reading roughly 4 million rows from the last 7 days, then filtering for tenant 7 and discarding 99.9 percent of them.',
          'The index gets the date range right but cannot narrow by tenant, so almost all the work is thrown away.',
          'Create an index on (tenant_id, created_at DESC). Now equality on tenant comes first, and the dates are sorted inside that tenant.',
          'New plan: seek to tenant 7, walk backwards along created_at, stop after 50 rows. It reads 50 rows instead of 4 million.',
          'Runtime goes from 2,300 ms to about 1 ms, and the LIMIT is now genuinely a limit rather than a post-filter.',
          'Follow-up: the old (created_at) index is still used by a different report, so it stays. If it were not, it should be dropped - it costs a write on every insert.',
        ],
        result:
          'Column order in a composite index was the entire fix. Reading the plan told you which step was reading four million rows, which is a habit worth more than memorising any rule about indexes.',
      },
    ],
    jargon: [
      { term: 'Sequential scan', plain: 'Reading every row to find matches. Fine for small tables, fatal for large ones.' },
      { term: 'B-tree', plain: 'The sorted tree structure behind most indexes. Depth grows very slowly with data size.' },
      { term: 'Selectivity', plain: 'How much a condition narrows the rows. An email is highly selective; a boolean is not.' },
      { term: 'Page', plain: 'The block a database reads and writes, 8 KB in PostgreSQL. Query cost is counted in pages, not rows.' },
      { term: 'Covering index', plain: 'An index containing every column a query needs, so the table is never read.' },
      { term: 'EXPLAIN / query plan', plain: 'The database telling you how it intends to run a query. The first thing to look at.' },
    ],
    remember: [
      'An index turns a full scan of every page into one page per tree level - logarithmic, not linear.',
      'Composite indexes work left-to-right: equality columns first, range or sort last.',
      'Every index is a write tax on every insert and update.',
      'Read EXPLAIN before adding anything; guessing at indexes wastes writes and memory.',
      'Drop indexes that statistics show are never used - they still cost writes and RAM.',
    ],
  },

  replication: {
    analogy: {
      title: 'Photocopies of the master ledger',
      body:
        'One book holds the truth, and clerks in other rooms keep copies that are updated as entries are made. Anyone can read from a nearby copy, and if the master burns, a copy becomes the new master. The catch is timing: a copy might be a few seconds behind, so someone reading it can miss an entry that was just written.',
    },
    deepDive: [
      {
        heading: 'Why you replicate: three different reasons',
        paragraphs: [
          'The first is durability. More copies on more machines means the loss of one disk, one server or one datacenter does not lose data. This is the reason that is never optional for anything valuable.',
          'The second is availability. If the primary dies, a replica can be promoted, so an outage becomes a failover of seconds instead of a restore from backup taking hours. The third is read scalability: reads can be spread over replicas, which helps enormously for read-heavy workloads and not at all for write-heavy ones.',
          'Notice that none of the three helps with writes. All writes still go to one primary in a classic setup, and every replica has to replay every one of them, so replication never increases write capacity. That is what sharding is for, and confusing the two is a common planning mistake.',
        ],
      },
      {
        heading: 'Synchronous, asynchronous, and the choice you are really making',
        paragraphs: [
          'Asynchronous replication commits on the primary and streams the change to replicas afterwards. Writes are fast, because they never wait for the network, and replicas lag by milliseconds to seconds. If the primary dies before a change reaches any replica, that change is lost - which is why async replication has a real, nonzero data-loss window.',
          'Synchronous replication waits for replicas to confirm before the write is acknowledged. No acknowledged write can be lost, but every write now pays a round trip, and if a replica it waits for is slow or unreachable, writes stall or the system must fall back to async. Waiting for every replica is rarely done for exactly that reason: one bad node stops all writes.',
          'Semi-synchronous is the common compromise: wait for one replica - typically in the same region, a millisecond or two away - and stream asynchronously to the others. You get no data loss for the common failure - losing one machine - without paying cross-region latency on every write.',
        ],
        code: {
          caption: 'What each mode costs',
          body: `                    write latency   data loss on primary death
async               fastest         up to the lag (ms to seconds)
semi-sync (1 local) +1-2 ms         none, if the local replica survived
sync (all replicas) +RTT to slowest none, but one slow node stalls writes
sync cross-region   +60-150 ms      none, and every write feels it`,
        },
      },
      {
        heading: 'Replication lag is an application problem',
        paragraphs: [
          'The moment you read from replicas, your users can read their own writes and not see them: save a profile, get redirected, the replica has not caught up, and the old name is displayed. The user concludes the save failed and does it again. This is the single most common bug introduced by adding read replicas.',
          'The fixes are all application-level. Read-your-writes routing sends a user to the primary for a short window after they write. Sticky sessions per user keep them on one replica so they at least see monotonic state. Or the API returns the written object directly, so the UI never needs to re-read it.',
          'Lag also spikes exactly when you least want it: during a bulk import, a schema migration or a traffic peak. Alert on lag in seconds, not just on replica health, and make sure the failover procedure refuses to promote a replica that is badly behind unless a human accepts the data loss.',
        ],
        bullets: [
          'Route reads to the primary for N seconds after that user writes.',
          'Or return the written entity in the write response so no re-read is needed.',
          'Alert on replication lag, not just on "replica is up".',
          'Analytics and reports are ideal replica traffic - they tolerate seconds of staleness.',
          'Never promote a badly lagging replica without an explicit decision about data loss.',
        ],
      },
    ],
    examples: [
      {
        title: 'A failover that lost 4 seconds of orders',
        setup:
          'Single primary with two async replicas, lag normally about 200 ms. The primary host fails hard at 14:02 during a traffic peak when lag had grown to 4 seconds.',
        walkthrough: [
          'Health checks detect the failure after 15 seconds. Automation promotes the most up-to-date replica.',
          'That replica was 4 seconds behind, so roughly 4 seconds of committed orders exist nowhere - they were acknowledged to customers and then lost.',
          'Customers got confirmation emails (sent from the application) for orders that no longer exist in the database. Support spends a week on it.',
          'Fix 1: semi-synchronous replication to one local replica. Writes cost 1-2 ms more; the loss window becomes zero for a single-machine failure.',
          'Fix 2: do not send the confirmation from the write path. Emit it from an outbox written in the same transaction, so a lost write also loses its email.',
          'Fix 3: alert when lag exceeds 1 second, because the lag growing to 4 seconds was itself the early warning nobody saw.',
        ],
        result:
          'Async replication is not wrong, but its data-loss window must be a decision rather than a discovery. Two milliseconds per write bought the elimination of the entire class of incident.',
      },
    ],
    jargon: [
      { term: 'Primary / replica', plain: 'The node accepting writes, and the copies following it. Older docs say master/slave.' },
      { term: 'Replication lag', plain: 'How far behind a replica is, in time or bytes. The source of stale reads.' },
      { term: 'Read-your-writes', plain: 'The guarantee that you see your own change immediately after making it.' },
      { term: 'Failover', plain: 'Promoting a replica to primary after a failure.' },
      { term: 'Split brain', plain: 'Two nodes both believing they are primary. Causes divergent data; prevented by quorum or fencing.' },
      { term: 'WAL / binlog', plain: 'The ordered log of changes that replicas replay to stay in sync.' },
    ],
    remember: [
      'Replication buys durability, availability and read capacity - never write capacity.',
      'Async is fast and can lose data; sync is safe and costs a round trip per write.',
      'Any read from a replica may be stale; plan read-your-writes explicitly.',
      'Alert on lag in seconds, and refuse to promote a badly lagging replica silently.',
      'Replication copies mistakes instantly, so it is not a backup.',
    ],
  },

  sharding: {
    analogy: {
      title: 'Splitting one enormous filing cabinet into many',
      body:
        'One cabinet has become too heavy to move and too slow to search, so you split it: surnames A-F in room 1, G-M in room 2, and so on. Each room is manageable again. The price is that a question like "everyone who moved house last year" now means visiting every room and merging the answers - and the day room 2 fills up, rebalancing is a moving day.',
    },
    deepDive: [
      {
        heading: 'Sharding is the only thing that scales writes',
        paragraphs: [
          'Caching helps reads. Replicas help reads. Bigger machines help until the biggest machine. When the write volume or the dataset genuinely exceeds one machine, the only remaining option is to split the data across machines so each one owns a slice - and accepts the writes for that slice.',
          'That is also why it is a last resort. Sharding changes your application, not just your infrastructure: every query must either carry the shard key or be fanned out, cross-shard transactions largely stop existing, and unique constraints across shards become your problem to enforce.',
          'Exhaust the cheaper options first, and be specific about which limit you actually hit. Very often the answer is that one table is enormous while the rest of the database is small, in which case moving that one table out (or partitioning it locally) solves the problem without sharding anything else.',
        ],
      },
      {
        heading: 'Choosing the shard key is the whole design',
        paragraphs: [
          'The shard key determines which node holds a row. A good key spreads load evenly and keeps the rows a query needs together on one shard. Those two goals conflict, and resolving that conflict is the design work.',
          'Hash sharding (hash the user id, modulo the shard count) spreads beautifully and destroys range queries - consecutive ids land on different nodes, so "all records from last Tuesday" hits everything. Range sharding keeps ranges together and invites hotspots: shard by date and every write today goes to one node while the others idle.',
          'Directory sharding keeps an explicit lookup table from key to shard. It is flexible - you can move one noisy tenant to its own shard - at the cost of a lookup service that is now on every request path and must itself be fast and highly available.',
        ],
        code: {
          caption: 'Three strategies, three failure modes',
          body: `hash(user_id) % N     even spread, no range queries,
                      resharding moves almost everything

range by date         great for time queries,
                      today's shard takes 100% of writes

directory lookup      full control, can isolate big tenants,
                      one more critical service on every request

consistent hashing    adding a shard moves only ~1/N of keys
                      (this is why it is worth the complexity)`,
        },
      },
      {
        heading: 'What breaks, and what it costs to keep working',
        paragraphs: [
          'Cross-shard queries are the first casualty. Any query without the shard key must be sent to every shard and merged in the application - a scatter-gather whose latency is the slowest shard and whose cost grows with the shard count. JOINs across shards effectively do not exist; you denormalise or you do two round trips.',
          'Transactions are the second. Atomic changes across shards require two-phase commit or a saga, both of which are substantially more work than a local transaction. Most teams design so that a single business operation always stays inside one shard - which is another argument for choosing the shard key by the entity that owns the operation, usually the tenant or the user.',
          'Operations are the third: N times the backups, N times the migrations, and rebalancing when a shard grows too large. Modulo-based schemes are the painful case because changing N remaps nearly every key; consistent hashing or many small virtual shards mapped onto fewer physical nodes make rebalancing routine instead of an event.',
        ],
        bullets: [
          'Pick a shard key that appears in almost every query - usually tenant_id or user_id.',
          'Use many virtual shards (say 1024) mapped onto few physical nodes, so growth is a remap, not a reshard.',
          'Globally unique ids need a scheme that does not depend on one sequence: UUIDv7, Snowflake, or per-shard ranges.',
          'Accept that some queries become scatter-gather, and keep those off the hot path.',
          'Plan the rebalancing procedure before you need it, and rehearse it.',
          'Replicate every shard - sharding splits the data, it does not copy it, so a lost shard is lost for its users.',
        ],
      },
    ],
    examples: [
      {
        title: 'Sharding a multi-tenant SaaS database',
        setup:
          'A B2B product with 40,000 companies has outgrown one Postgres primary: 14 TB and 30,000 writes per second at peak.',
        walkthrough: [
          'Shard key: tenant_id. Almost every query already filters by tenant, so most queries stay single-shard with no application change at all.',
          'Use 1,024 virtual shards hashed from tenant_id, mapped onto 8 physical nodes (128 virtual shards each). Growth means moving virtual shards, not rehashing keys.',
          'Cross-tenant reporting is the exception. It moves to a separate analytics store fed by change data capture, so no scatter-gather query exists on the transactional path.',
          'Problem: three enterprise tenants are each larger than a thousand small ones, so their shards are hot.',
          'Fix: a directory override for those tenants pinning them to dedicated nodes. Hashing for the many, explicit placement for the few - a hybrid that is very common in practice.',
          'Unique ids move from a shared sequence to UUIDv7, which is time-sortable so index locality is preserved.',
        ],
        result:
          'Write capacity became roughly linear in node count, and the application changed very little because the shard key matched the natural access pattern. The hard parts were reporting and the outlier tenants - which is the usual story.',
      },
    ],
    jargon: [
      { term: 'Shard', plain: 'One slice of the data living on its own node, with its own writes.' },
      { term: 'Shard key', plain: 'The field that decides which shard a row belongs to. The whole design hangs on it.' },
      { term: 'Scatter-gather', plain: 'Sending a query to every shard and merging the results. Slow and fragile at scale.' },
      { term: 'Virtual shard', plain: 'A logical bucket mapped onto a physical node, so rebalancing moves buckets not keys.' },
      { term: 'Resharding', plain: 'Changing the number of shards and moving data. Painful with modulo, routine with consistent hashing.' },
      { term: 'Hotspot', plain: 'One shard receiving far more traffic than the others, usually from a bad key choice.' },
    ],
    remember: [
      'Sharding is the only way to scale writes past one machine - and the last thing to try.',
      'The shard key decides everything; choose the field that appears in nearly every query.',
      'Cross-shard joins and transactions effectively disappear - design so they are not needed.',
      'Many virtual shards on few nodes makes rebalancing a routine operation.',
      'Hotspots come from keys correlated with time or with a few huge tenants.',
    ],
  },

  partitioning: {
    analogy: {
      title: 'One filing cabinet, one drawer per month',
      body:
        'The cabinet stays in the same room with the same clerk - but instead of one giant drawer, there is one per month. Searching March means opening one drawer. Discarding data older than two years means removing whole drawers instead of picking out papers one by one. Everything is still in one place; it is just organised so most work touches a small part.',
    },
    deepDive: [
      {
        heading: 'Partitioning is inside one database; sharding is across machines',
        paragraphs: [
          'The two words are often used for the same thing - Designing Data-Intensive Applications calls splitting data across machines partitioning, and Kafka and Cassandra use the word that way too. This app uses the narrower meaning the database manuals use for table partitioning: one logical table split into physical pieces managed by the same database instance. The application sees one table, writes the same SQL, and the database routes each row to the right partition. Sharding, in this app, splits data across independent database servers, and something outside the database has to know where each row lives.',
          'Because it is local, partitioning keeps everything you like: transactions across partitions still work, joins still work, and unique constraints still work as long as they include the partition key. It costs no distributed systems complexity at all, which makes it a very cheap win compared with sharding.',
          'The limitation is equally clear. Partitioning does not add write capacity or storage beyond the one machine - it only makes that machine work less per query and makes maintenance operations cheaper. When the machine itself is the limit, you shard.',
        ],
        code: {
          caption: 'One table, three drawers',
          body: `CREATE TABLE events (id bigint, tenant_id int, created_at timestamptz, ...)
  PARTITION BY RANGE (created_at);

events_2026_01   Jan   pruned
events_2026_02   Feb   pruned
events_2026_03   Mar   read     <- WHERE created_at >= '2026-03-01'
                                     AND created_at <  '2026-04-01'

DROP TABLE events_2025_09;   -- deleting a month is instant,
                             -- versus DELETE of 200M rows`,
        },
      },
      {
        heading: 'Partition pruning is the payoff',
        paragraphs: [
          'When a query filters on the partition key, the planner skips every partition that cannot contain matching rows. A query for last week against a table with 36 monthly partitions reads one of them (two when the week crosses a month boundary), so the effective table size is 1/36 of the total for both the scan and the index.',
          'That pruning only happens if the partition key is in the WHERE clause. Queries that filter on something else must touch all partitions, and are then a little slower than they would have been on a single table, because every partition adds planning and opening overhead. So the partition key must match the dominant query filter - usually time for events and logs, or tenant for multi-tenant data.',
          'Indexes get better too. Each partition has its own smaller index, so index maintenance is cheaper and the hot partition index is far more likely to stay in memory. On large time-series tables this is often a bigger win than the pruning itself.',
        ],
        bullets: [
          'Range partitioning - time-series data, and anything with a retention policy.',
          'List partitioning - a fixed small set: region, country, status.',
          'Hash partitioning - even spread when there is no natural range, e.g. by tenant id.',
          'The partition key must be in the WHERE clause, or pruning does not happen.',
        ],
      },
      {
        heading: 'The operational reasons people adopt it',
        paragraphs: [
          'Retention is the first and most common. Deleting 200 million rows with a DELETE statement produces enormous write amplification, bloats the table and can run for hours. Dropping a partition is a metadata operation that takes milliseconds. Any table with "keep 90 days" in its requirements wants range partitioning by time.',
          'Maintenance is the second. VACUUM, index rebuilds, statistics gathering and bulk loads all operate on a partition-sized chunk rather than the whole table, which turns a maintenance window into a background job.',
          'The costs are real but modest: you must create future partitions ahead of time (a row that matches no partition is rejected, so you discover it at midnight on the 1st), queries without the partition key get slower, and PostgreSQL and MySQL both require every unique key to include the partition key. Too many partitions cost planning time and memory too - the PostgreSQL docs say a few thousand work only when queries prune to a handful. Compared with sharding, these are small problems.',
        ],
      },
    ],
    examples: [
      {
        title: 'A 90-day retention policy that used to take four hours',
        setup:
          'An events table holds 1.8 billion rows. Retention is 90 days, enforced by a nightly DELETE FROM events WHERE created_at < now() - interval 90 day.',
        walkthrough: [
          'The nightly DELETE removes about 20 million rows, runs for roughly 4 hours, and generates enough WAL to make replicas lag by minutes.',
          'The space is not returned either - the table keeps growing on disk until an expensive VACUUM FULL, which needs a maintenance window.',
          'Convert to monthly range partitions on created_at. Existing data is copied once during a planned migration.',
          'Retention becomes DROP TABLE events_2025_12 - a few milliseconds, no WAL flood, disk space returned immediately.',
          'Bonus: dashboard queries for the last 7 days now prune to one partition and drop from 900 ms to 40 ms.',
          'New chore: a scheduled job creates next month partitions in advance. Forgetting this is the classic partitioning outage, so it gets its own alert.',
        ],
        result:
          'The same retention rule went from a four-hour nightly job with replica lag to an instant metadata operation, and queries got 20x faster as a side effect. This is usually the highest-value, lowest-risk step before anybody mentions sharding.',
      },
    ],
    jargon: [
      { term: 'Partition', plain: 'One physical piece of a logical table, held by the same database instance.' },
      { term: 'Partition key', plain: 'The column that decides which partition a row lands in.' },
      { term: 'Pruning', plain: 'The planner skipping partitions that cannot match. The reason queries get faster.' },
      { term: 'Local vs global index', plain: 'An index per partition, or one across all of them. PostgreSQL only has local ones; Oracle also offers global indexes.' },
      { term: 'Retention policy', plain: 'How long data is kept. Partitioning makes enforcing it nearly free.' },
      { term: 'Write amplification', plain: 'Doing far more disk writes than the logical change, as with a huge DELETE.' },
    ],
    remember: [
      'Partitioning splits a table inside one database; sharding splits across machines.',
      'Pruning only happens when the partition key is in the WHERE clause.',
      'Dropping a partition is the cheapest possible way to enforce retention.',
      'It reduces work per query and per maintenance job, not the capacity ceiling of the machine.',
      'Automate the creation of future partitions, and alert if it fails.',
    ],
  },

  'database-normalization': {
    analogy: {
      title: 'Storing a phone number once',
      body:
        'If a customer address is written on every one of their fifty invoices, then a change of address means correcting fifty pieces of paper - and you will miss some, leaving the company with two answers to the same question. Write the address once in a customer file and point at it, and it can only ever be right or wrong in one place.',
    },
    deepDive: [
      {
        heading: 'Normalisation exists to prevent contradictions',
        paragraphs: [
          'The purpose is not elegance or saving disk. It is to make it structurally impossible for the database to hold two different answers to the same question. If a fact is stored once, an update either happens or does not; if it is stored in forty rows, an interrupted update leaves forty rows disagreeing, and no constraint can detect it.',
          'The classic anomalies are worth naming. Update anomaly: changing a fact requires many rows and can be partially applied. Insert anomaly: you cannot record a new product until somebody orders it, because product data only lives in order rows. Delete anomaly: removing the last order for a product erases the product itself.',
          'These are not theoretical. Every long-lived denormalised system accumulates rows where the same customer has three spellings of the same city, and reports quietly produce different totals depending on which column was grouped.',
        ],
        code: {
          caption: 'The same data, before and after',
          body: `DENORMALISED (one table)
  order_id | customer | city       | product | price
  1        | Ana      | Bucharest  | Mouse   | 25
  2        | Ana      | Bucuresti  | Keyboard| 60     <- same person, two cities

NORMALISED
  customers(id, name, city)        Ana lives in exactly one place
  products(id, name, price)        the price is defined once
  orders(id, customer_id, ...)
  order_items(order_id, product_id, qty, price_at_purchase)
                                   ^ deliberately copied: a historical fact`,
        },
      },
      {
        heading: 'The normal forms, in the order that matters',
        paragraphs: [
          'First normal form: one value per field, no arrays stuffed into a string, and no repeating columns like phone1, phone2, phone3. Second normal form: in a table with a composite key, every non-key column must depend on the whole key, not half of it. Third normal form: non-key columns must depend on the key only, not on each other - if city determines postal_region, postal_region does not belong in this table.',
          'For practical purposes, 3NF is the target and the rest is theory you can read later. The informal version - every fact depends on the key, the whole key, and nothing but the key - is enough to get almost every schema right.',
          'One important exception looks like a violation and is not: recording price_at_purchase on an order line. The current price lives in the products table, but the price paid is a different fact, frozen in time. Copying a value because it is a historical record is correct; copying it because reading the join felt slow is denormalisation, and it needs the discussion below.',
        ],
        bullets: [
          '1NF - atomic values, no repeating groups.',
          '2NF - no partial dependency on a composite key.',
          '3NF - no dependency between non-key columns.',
          'Informally: the key, the whole key, and nothing but the key.',
          'Historical values (price paid, address at time of shipping) are facts of their own, not duplication.',
        ],
      },
      {
        heading: 'When normalisation starts to hurt',
        paragraphs: [
          'The cost is joins. A well-normalised schema might need five joins to render one screen, and while modern databases do that in single-digit milliseconds on indexed keys, it stops being free when tables grow to hundreds of millions of rows or the query runs thousands of times per second.',
          'The correct order of operations is: normalise first, measure, and denormalise specific paths where measurement shows it matters. Starting denormalised because you assume joins will be slow is how teams acquire data-integrity problems in exchange for performance they never needed.',
          'And there are safer middle grounds before duplicating columns: a materialised view, a covering index, or a cached rendered result. Each gives the read speed of denormalisation while keeping one authoritative copy of the fact.',
        ],
      },
    ],
    examples: [
      {
        title: 'Finding the anomaly in a "simple" table',
        setup:
          'A team stores support tickets in one flat table: ticket_id, customer_name, customer_email, customer_plan, agent_name, agent_team, message.',
        walkthrough: [
          'A customer upgrades from Basic to Pro. Their plan is stored on every ticket row, so 240 rows must be updated - and rows written before the update now disagree with rows written after.',
          'Reports break: counting tickets by plan gives different results depending on when the ticket was created, which is not what the report intends to measure.',
          'An agent moves team. Same problem, and now historical tickets claim they were handled by a team that did not exist yet.',
          'Normalise: customers(id, name, email, plan), agents(id, name, team_id), tickets(id, customer_id, agent_id, message). Each fact lives once.',
          'Then ask what was actually historical: if the report wants the plan at the time the ticket was opened, add plan_at_open to tickets deliberately - a frozen fact, documented as such.',
        ],
        result:
          'The flat table was not simpler, it just moved the complexity into every future update. Separating "current fact" from "historical fact" is the distinction that resolves most normalisation arguments.',
      },
    ],
    jargon: [
      { term: 'Normalisation', plain: 'Organising data so each fact is stored exactly once.' },
      { term: '3NF', plain: 'The practical target: every column depends on the key, the whole key and nothing but the key.' },
      { term: 'Update anomaly', plain: 'A change that must touch many rows and can be left half-applied.' },
      { term: 'Foreign key', plain: 'The pointer that replaces a copied value, enforced by the database.' },
      { term: 'Surrogate key', plain: 'A meaningless id (auto-increment, UUID) used as the key instead of real-world data.' },
      { term: 'Materialised view', plain: 'A stored, refreshable result of a query. Read speed without a second source of truth.' },
    ],
    remember: [
      'Store every fact once so the data cannot contradict itself.',
      'The key, the whole key, and nothing but the key.',
      'Historical values are separate facts - copying them is correct, not duplication.',
      'Normalise first, measure, then denormalise the specific paths that need it.',
      'Materialised views and covering indexes give read speed without a second source of truth.',
    ],
  },

  denormalization: {
    analogy: {
      title: 'Printing the total on the receipt',
      body:
        'The total could always be recalculated from the line items, but the shop prints it on the receipt anyway, because it is read a hundred times more often than it changes. That is denormalisation: a deliberate, redundant copy that makes the common read instant. The discipline is remembering that if a line item is corrected, the printed total is now a lie.',
    },
    deepDive: [
      {
        heading: 'Trading write cost and correctness risk for read speed',
        paragraphs: [
          'Denormalisation duplicates data so a read does not have to join or aggregate. Storing comment_count on a post avoids a COUNT over a million comments. Copying author_name into the post avoids a join to users. Each of these makes one read cheaper and every related write more expensive and more fragile.',
          'The trade is worth making when the read/write ratio is extreme and the read is on a hot path. A post is read thousands of times and its comment count changes occasionally; precomputing is obviously right. Copying an address into an order because you might join sometimes is obviously wrong.',
          'The critical part is the discipline: once a fact exists twice, something must keep the copies in agreement, and that something is now part of your system. Denormalising without deciding on that mechanism is how systems end up with counters that are quietly wrong by 3 percent.',
        ],
        code: {
          caption: 'The same read, three ways',
          body: `NORMALISED
  SELECT p.*, (SELECT count(*) FROM comments WHERE post_id=p.id)
  -> correct always, ~120 ms on a hot post

DENORMALISED COUNTER
  SELECT p.*, p.comment_count      -> ~1 ms, can drift

KEPT IN SYNC BY
  a) same transaction: UPDATE posts SET comment_count = comment_count+1
  b) trigger in the database
  c) async consumer of a change event (fast, eventually consistent)
  d) periodic reconciliation job that recomputes and corrects`,
        },
      },
      {
        heading: 'Four ways to keep the copy honest',
        paragraphs: [
          'Inside the same transaction is the safest: insert the comment and increment the counter together, so they cannot disagree. It works only when both live in the same database, and it adds contention on the counter row if the rate is high.',
          'A database trigger moves that logic out of the application so every writer is covered, including migrations and manual fixes. The cost is invisible behaviour - the next engineer will not expect a write to another table, and triggers are notoriously hard to debug.',
          'Asynchronous updates driven by an event or a change stream scale best and give eventual consistency: the counter is right within a second or two. Finally, whichever you choose, run a periodic reconciliation job that recomputes the truth and fixes drift. Every long-lived denormalised counter drifts eventually, and the job that finds it should be yours rather than a customer.',
        ],
        bullets: [
          'Same transaction - strongest, limited to one database, contention on hot rows.',
          'Trigger - covers every writer, hides behaviour from the application.',
          'Async event consumer - scales, eventually consistent, needs idempotency.',
          'Reconciliation job - not optional, whichever of the above you pick.',
        ],
      },
      {
        heading: 'Where denormalisation is mandatory rather than optional',
        paragraphs: [
          'In most NoSQL stores there are no joins, so denormalisation is not a tuning decision but the data model itself. The same fact is written into several access paths on purpose, and the consistency work is accepted up front.',
          'The same is true of read models in CQRS and of search indexes. An Elasticsearch document containing the product, its category name and its brand is a denormalised copy by definition; its job is to answer one kind of query fast, and it is rebuilt from the source of truth when it drifts.',
          'That gives the safest framing: a denormalised structure should be a derived artefact that you can delete and rebuild. If losing it means losing data, you have created a second source of truth, which is the version of denormalisation that actually hurts.',
        ],
      },
    ],
    examples: [
      {
        title: 'A counter that drifted 3 percent',
        setup:
          'A social feed stores like_count on each post, incremented by the application after inserting into the likes table. After a year, spot checks show counts are 2-4 percent too high.',
        walkthrough: [
          'Cause 1: the increment is in a separate statement from the insert. When the request fails between them, the like is missing but the count moved.',
          'Cause 2: retries. A client retry inserts one like (deduplicated by a unique key) but increments twice, because the increment is not idempotent.',
          'Cause 3: an admin tool deletes spam likes directly in the database, and never touches the counter.',
          'Fix 1: put both statements in one transaction so partial application is impossible.',
          'Fix 2: derive the counter from the rows instead of incrementing blindly - UPDATE ... SET like_count = (SELECT count(*) ...) for that post, or make the increment conditional on the insert having actually created a row.',
          'Fix 3: a nightly job recomputes counts for posts modified in the last day and logs corrections, so drift is measured rather than assumed to be zero.',
        ],
        result:
          'The counter was right the moment it was written and wrong by every path that bypassed the application. Denormalised values need an owner, an update mechanism and a reconciliation job - all three, not one of them.',
      },
    ],
    jargon: [
      { term: 'Denormalisation', plain: 'Storing a fact in more than one place on purpose, to make reads cheap.' },
      { term: 'Derived data', plain: 'A copy that can be recomputed from the source of truth. The safe kind of duplication.' },
      { term: 'Drift', plain: 'The copy and the source disagreeing over time. Assume it will happen.' },
      { term: 'Reconciliation', plain: 'A job that recomputes the truth and corrects copies.' },
      { term: 'Materialised view', plain: 'Database-managed denormalisation with a refresh command.' },
      { term: 'Read model', plain: 'A shape of the data built specifically for one query, rebuilt from events or the source tables.' },
    ],
    remember: [
      'Denormalise when reads vastly outnumber writes and the read is hot.',
      'Every duplicated fact needs a named mechanism that keeps it in sync.',
      'Add a reconciliation job from day one - drift is a certainty, not a risk.',
      'Prefer derived data you can delete and rebuild over a second source of truth.',
      'Normalise first and measure; denormalising early trades correctness for imaginary speed.',
    ],
  },

  'read-replicas': {
    analogy: {
      title: 'Extra copies of the day newspaper',
      body:
        'One newsroom writes the paper; a hundred kiosks sell copies. Readers never queue at the newsroom, and the kiosks scale to any crowd. But a correction printed at 10:00 reaches the kiosks a few minutes later, so for those minutes some readers hold the old version - and no number of kiosks helps if the bottleneck is how fast the newsroom can write.',
    },
    deepDive: [
      {
        heading: 'The cheapest large win for a read-heavy system',
        paragraphs: [
          'Most applications read far more than they write - ratios of 10:1 to 1000:1 are typical. A read replica takes that dominant traffic off the primary, which then has spare capacity for the writes that only it can do. Adding two replicas can triple effective read capacity with no application redesign beyond routing.',
          'Replicas also let you isolate workloads that behave badly. Analytics queries, exports, and the nightly report that scans a year of data can run on a dedicated replica where a slow query cannot lock, saturate or evict cache on the machine serving customers.',
          'And they double as standby nodes. A replica that is already streaming changes can be promoted on failure, so the same machines that serve reads also provide your failover path - which is why read replicas are usually the first thing added after a single instance.',
        ],
        bullets: [
          'Customer-facing reads that tolerate a second of staleness.',
          'Analytics, BI and exports - keep them off the primary entirely.',
          'Backups taken from a replica, so the primary is not slowed.',
          'A promotion target for failover.',
          'Not: anything that must read its own write immediately, without routing care.',
        ],
      },
      {
        heading: 'Routing: the part the application must own',
        paragraphs: [
          'The database will not decide for you. Something must send each query to the primary or a replica, and the usual options are an application-level router (two connection pools), a proxy like Pgpool-II or ProxySQL that classifies statements, or an ORM feature that marks read-only blocks.',
          'Statement-based classification sounds convenient and misleads: a SELECT inside a write transaction must go to the primary, and a SELECT ... FOR UPDATE is a write in disguise. Explicit routing in the application, where the intent is known, is more reliable than inference from the SQL text.',
          'The essential rule to encode: after a user writes, route the reads of that user to the primary for a window longer than your typical lag - often 5 seconds. Everything else can use replicas. That single rule removes the great majority of stale-read bug reports.',
        ],
        code: {
          caption: 'A routing policy that survives contact with users',
          body: `write            -> primary, and set last_write_at for this session
read, within 5 s of that write  -> primary   (read-your-writes)
read, otherwise                 -> replica
read inside a transaction       -> primary
analytics / export              -> dedicated analytics replica
health of replica: lag < 2 s, else take it out of rotation`,
        },
      },
      {
        heading: 'The limits people discover late',
        paragraphs: [
          'Replicas do not help write capacity at all, and every replica actually adds a little work to the primary, which must ship its log to each one. A write-bound system gets nothing from replicas except a failover target.',
          'Lag is not constant. It grows during bulk imports, migrations and traffic peaks - exactly the moments when stale reads are most likely to confuse people. Monitor lag as a first-class metric and remove a replica from the read pool when it exceeds a threshold rather than serving increasingly old data.',
          'Long-running queries on a replica can also conflict with replication itself: in Postgres, a big analytics query can either be cancelled by incoming changes or delay their application, depending on configuration. That is a reason to give analytics its own replica with different settings, rather than mixing it with customer reads.',
        ],
      },
    ],
    examples: [
      {
        title: 'The profile update that "did not save"',
        setup:
          'A team adds two read replicas and routes all SELECTs to them. Support immediately receives reports that profile edits are not saving.',
        walkthrough: [
          'The user submits a new display name. The write goes to the primary and succeeds.',
          'The application redirects to the profile page, which issues a SELECT - routed to a replica that is 800 ms behind.',
          'The replica still holds the old name, so the page shows the old value. The user concludes the save failed and tries again.',
          'Fix A: after any write, pin that session to the primary for 5 seconds. Simple, effective, costs a little primary traffic.',
          'Fix B: have the update endpoint return the saved entity, and render from the response instead of re-reading. Removes the read entirely.',
          'Fix C (bigger hammer): track the replication position after the write and wait for a replica to reach it before reading. Correct and precise, but more machinery than most apps need.',
        ],
        result:
          'Nothing was broken in the database - the application simply asked a copy that had not caught up. Read-your-writes must be designed in the moment you introduce replicas, not after the first support ticket.',
      },
    ],
    jargon: [
      { term: 'Read replica', plain: 'A copy of the database that serves reads only and follows the primary.' },
      { term: 'Replication lag', plain: 'How far behind the replica is. Directly the staleness of what it returns.' },
      { term: 'Read-your-writes', plain: 'Guaranteeing a user sees their own change immediately after making it.' },
      { term: 'Connection routing', plain: 'The logic that sends a query to the primary or to a replica.' },
      { term: 'Promotion', plain: 'Turning a replica into the new primary after a failure.' },
      { term: 'Analytics replica', plain: 'A replica dedicated to heavy queries so they cannot affect customer traffic.' },
    ],
    remember: [
      'Replicas scale reads and provide failover; they do nothing for writes.',
      'Routing is the application job - a SELECT inside a transaction still belongs on the primary.',
      'Pin a user to the primary for a few seconds after their write.',
      'Lag spikes exactly during imports and peaks; drop lagging replicas out of rotation.',
      'Give heavy analytics its own replica rather than sharing with customer reads.',
    ],
  },

  'connection-pooling': {
    analogy: {
      title: 'Taxis waiting at the rank',
      body:
        'You do not build a new taxi each time you need a ride, use it once and scrap it. A small fleet waits at the rank; you take one, use it, and return it. Building is what costs - the trip itself is cheap. A database connection is the taxi, and a pool is the rank: a few reusable connections shared by many short requests.',
    },
    deepDive: [
      {
        heading: 'Why a connection is expensive',
        paragraphs: [
          'Opening a Postgres connection means a TCP handshake, a TLS handshake, authentication, and then - crucially - the server forks a dedicated backend process with its own memory. That is single-digit to tens of milliseconds and several megabytes of RAM, paid before a single query runs.',
          'In a request that does 3 ms of actual query work, paying 30 ms of setup is a tenfold waste, and at a thousand requests per second it is simply impossible. A pool amortises that cost: connections are opened once, kept alive, and handed to whichever request needs one.',
          'The pool also acts as a queue. When every connection is busy, the next request waits rather than opening connection number 501. That waiting is a feature - it is backpressure that protects the database from being overwhelmed - but it means pool exhaustion shows up as latency, which is why a slow endpoint is so often a pool problem rather than a query problem.',
        ],
        code: {
          caption: 'Where the time goes, per request',
          body: `WITHOUT pool
  TCP+TLS+auth+fork   ~25 ms
  query                 3 ms
  close                 1 ms     -> ~29 ms, a new backend each time

WITH pool (10 connections)
  acquire from pool   ~0.05 ms
  query                 3 ms
  release             ~0.01 ms   -> ~3 ms, 10 backends on the server`,
        },
      },
      {
        heading: 'Sizing the pool: smaller than you think',
        paragraphs: [
          'The instinct is that a bigger pool means more throughput. It does not. A database executes queries on a limited number of CPU cores and disks; beyond that, extra concurrent queries just context-switch and contend for locks, so total throughput falls while latency rises. The commonly cited starting point is roughly cores x 2 plus effective spindles - often 10 to 30 connections for a single database, not 500.',
          'The number that actually matters is the total across your fleet. Twenty application instances with a pool of 50 each is 1,000 connections requested from a server configured for 200. The failure looks like random connection errors under load and is one of the most common self-inflicted outages when scaling horizontally.',
          'When the total is genuinely too large - many instances, or serverless functions that each want their own connections - put a pooler like PgBouncer between them. In transaction mode it multiplexes thousands of client connections onto a few dozen server connections, at the cost of session-level features: SET, LISTEN and session advisory locks do not carry over between transactions, and protocol-level prepared statements work only when max_prepared_statements is set.',
        ],
        bullets: [
          'Start around (cores x 2) + spindles, then tune with measurements.',
          'pool_size x instance_count must stay below the server max_connections, with headroom for admin access.',
          'Use a separate, smaller pool for background jobs so they cannot starve web requests.',
          'PgBouncer in transaction mode for very high instance counts or serverless.',
          'Set a short acquire timeout (HikariCP defaults to 30 seconds), or a stuck pool becomes a long hang.',
        ],
      },
      {
        heading: 'How pools actually fail',
        paragraphs: [
          'Leaks are the classic: a code path that acquires a connection and never returns it, usually because an exception skipped the release. After enough errors, the pool is empty and every request hangs. Frameworks with a scoped block or context manager prevent this structurally, which is why manual acquire/release is worth avoiding.',
          'Holding across slow work is the second: opening a transaction, then calling an external API inside it. The connection is pinned for the duration of a network call you do not control, so a slow third party consumes your entire pool. Keep transactions short and never do IO to another system inside one.',
          'The third is silent death. Firewalls and load balancers drop idle TCP connections after some minutes, and the pool happily hands out a dead one, producing an error on first use. Configure a max lifetime shorter than the network idle timeout and a validation query on borrow, and this class of error disappears.',
        ],
      },
    ],
    examples: [
      {
        title: 'Pool exhaustion that looked like a slow database',
        setup:
          'An API reports p99 latency of 9 seconds. The database shows average query time of 4 ms and CPU at 20 percent. Nothing in the database looks wrong - because nothing is.',
        walkthrough: [
          'Pool size is 10 per instance. Metrics show connection acquire time averaging 8.6 seconds, which accounts for nearly all of the latency.',
          'One endpoint generates a PDF: it opens a transaction, then calls an external rendering service that takes 4-6 seconds, then commits.',
          'Those requests hold a connection for the whole external call. Two concurrent PDF requests occupy 2 of 10 connections; ten occupy all of them and everything else queues.',
          'Fix 1: move the external call outside the transaction. Read what is needed, release the connection, call the service, then reopen briefly to write the result.',
          'Fix 2: give PDF generation its own small pool (3 connections), so it can never consume the pool that serves normal traffic - a bulkhead.',
          'Fix 3: set an acquire timeout of 2 seconds so the failure becomes a fast 503 instead of a 9-second hang, and add an alert on acquire time.',
        ],
        result:
          'p99 dropped to 40 ms without touching a query or adding hardware. When latency is high and the database looks idle, measure time spent waiting for a connection before optimising anything else.',
      },
    ],
    jargon: [
      { term: 'Connection pool', plain: 'A set of reusable database connections shared by requests.' },
      { term: 'Pool exhaustion', plain: 'Every connection busy, so requests queue. Shows up as latency, not as errors at first.' },
      { term: 'Acquire timeout', plain: 'How long a request waits for a free connection before failing fast.' },
      { term: 'Max lifetime', plain: 'How long a connection may live before being recycled. Keep it under network idle timeouts.' },
      { term: 'PgBouncer / transaction mode', plain: 'An external pooler that multiplexes many clients onto few server connections.' },
      { term: 'Leak', plain: 'A connection acquired and never returned, usually on an error path.' },
    ],
    remember: [
      'Opening a connection costs far more than running a query - reuse them.',
      'Small pools outperform large ones; the database has limited cores either way.',
      'Multiply pool size by instance count before you scale out, or you will exhaust the server.',
      'Never hold a connection across a call to an external system.',
      'Set a short acquire timeout, and alert on acquire wait time.',
    ],
  },
};
