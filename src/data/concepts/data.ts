import type { Concept } from '@/types';

export const dataConcepts: Concept[] = [
  {
    slug: 'sql-databases',
    title: 'SQL Databases',
    tagline: 'Relations, schemas and transactions you can reason about.',
    category: 'data',
    difficulty: 'Beginner',
    lab: 'data-models',
    labFocus: 'sql-databases',
    keywords: ['postgres', 'mysql', 'acid', 'joins', 'schema', 'transaction', 'relational'],
    what: 'Relational databases store data in tables with a declared schema, express relationships through keys, and support multi-row transactions with ACID guarantees.',
    why: 'Most business data is relational, and most business rules are invariants across several rows. A transactional engine enforces those invariants for every writer instead of leaving them to application code.',
    how: [
      'Model entities as tables with primary keys; express relationships with foreign keys.',
      'The query planner decides how to satisfy a query using available indexes and statistics.',
      'Transactions provide atomicity, consistency, isolation and durability - commit or nothing.',
      'Scale reads with replicas; scale writes vertically first, then by partitioning or sharding.',
    ],
    when: [
      'Data with relationships and invariants: orders, payments, inventory, accounts.',
      'Query patterns that are not known in advance - SQL is good at ad-hoc questions.',
      'An early product whose access patterns are still being discovered.',
    ],
    advantages: [
      'Constraints (types, foreign keys, unique, check) apply to every writer, not just your code.',
      'One transaction makes a multi-step change all-or-nothing.',
      'Joins answer new questions without changing how the data is stored.',
    ],
    diagram: `carts                 products          orders
-----                 --------          ------
user_id               id (PK)           id (PK)
product_id (FK) ----> stock             user_id
qty                   price_cents       total_cents

BEGIN;
  SELECT c.qty, p.price_cents
    FROM carts c JOIN products p ON p.id = c.product_id
   WHERE c.user_id = 42;
  UPDATE products SET stock = stock - 1 WHERE id = 7 AND stock > 0;
  INSERT INTO orders (user_id, total_cents) VALUES (42, 1999);
COMMIT;   -- a failure anywhere rolls back all three`,
    tradeoffs: [
      {
        approach: 'One relational primary',
        gains: ['Transactions across rows and tables', 'Flexible ad-hoc queries and joins', 'Schema catches bad data early'],
        costs: [
          'Every write goes through one machine; beyond it you need sharding',
          'Changing a column type on a huge table rewrites it under a lock',
          'Joins over very large tables get expensive',
        ],
      },
      {
        approach: 'Distributed SQL (CockroachDB, Spanner, Vitess)',
        gains: ['Writes scale across machines', 'Keeps SQL and transactions'],
        costs: [
          'Transactions that span machines pay extra round trips',
          'More moving parts to operate and understand',
          'Some features of single-node SQL are limited or behave differently',
        ],
      },
    ],
    mistakes: [
      'Assuming "SQL does not scale" - a single well-tuned Postgres instance handles very large workloads.',
      'Read-then-write in application code (read stock, then write stock - 1), which loses updates under concurrency.',
      'Running ALTER COLUMN TYPE on a large production table without planning for the table rewrite and its lock.',
      'Polling a table as a job queue without FOR UPDATE SKIP LOCKED, so workers block each other.',
    ],
    realWorld: [
      'PostgreSQL defaults to the read committed isolation level; serializable must be asked for, and then transactions must be retried on serialization failures.',
      'In PostgreSQL 11 and later, adding a column with a constant default is a metadata change; changing a column type usually rewrites the table.',
    ],
    related: ['nosql-databases', 'relational-vs-non-relational', 'database-indexing', 'replication'],
    quiz: [
      {
        id: 'sql-1',
        prompt:
          'Two customers buy the last unit of a product at the same moment. Your code runs SELECT stock, subtracts 1 in the application, then runs UPDATE ... SET stock = <new value>. PostgreSQL is on its default isolation level. What can happen?',
        options: [
          'The database detects the conflict and rejects the second purchase automatically',
          'The second request waits until the first commits, then reads 0',
          'Both read 1, both write 0, and two orders are placed for one unit',
          'Both transactions deadlock and are rolled back',
        ],
        answer: 2,
        explanation:
          'Read committed does not stop a lost update: both reads see 1 before either write lands. It is tempting to expect the database to catch it, but it only sees two valid writes. The fix is an atomic conditional write (UPDATE ... SET stock = stock - 1 WHERE stock > 0), a SELECT FOR UPDATE lock, or a version check.',
      },
      {
        id: 'sql-2',
        prompt:
          'A checkout runs BEGIN, reserves stock, inserts the order, then inserts the payment - and the payment insert fails on a constraint. What does the database hold afterwards?',
        options: [
          'Nothing from this checkout: the stock and the order are rolled back with the payment',
          'The order and the stock reservation, but no payment',
          'The stock reservation only, because it ran first',
          'Whatever the application decides to delete in its error handler',
        ],
        answer: 0,
        explanation:
          'A transaction is all or nothing: one failed statement means none of its changes are kept. The Lab shows this as triangles - a checkout that failed half-way and was undone. Expecting the earlier writes to stay is the mental model of separate writes, which is exactly what a transaction removes.',
      },
      {
        id: 'sql-3',
        prompt:
          'Payments move out of your PostgreSQL database into a separate payment service with its own database. The checkout still wants "order, stock and payment together or not at all". What changes?',
        options: [
          'Nothing - wrap the HTTP call to the payment service inside BEGIN ... COMMIT',
          'Switch the isolation level to serializable so the payment is included',
          'Use a longer transaction timeout so the payment has time to finish',
          'One database transaction can no longer cover it; you need a saga or an outbox with compensating steps',
        ],
        answer: 3,
        explanation:
          'Atomicity ends at the edge of one database. Wrapping an HTTP call in BEGIN only holds locks while the call runs - if it succeeds and your COMMIT then fails, the payment still happened. Isolation levels and timeouts do not reach another system either.',
      },
      {
        id: 'sql-4',
        prompt:
          'You must widen orders.total_cents from integer to bigint on a 500-million-row PostgreSQL table during business hours. What does a plain ALTER TABLE ... ALTER COLUMN ... TYPE bigint do?',
        options: [
          'It changes only the table metadata, so it finishes instantly',
          'It rewrites the whole table under an ACCESS EXCLUSIVE lock, so order writes wait until it finishes',
          'It converts rows lazily the next time each one is read',
          'It fails, because column types can never be changed',
        ],
        answer: 1,
        explanation:
          'Integer to bigint is not binary compatible, so PostgreSQL rewrites the table and its indexes while holding its strongest lock - the Lab Schema change workload shows writes waiting. Instant metadata changes exist, but for adding a column with a constant default, not for a type change. The safe path is expand, backfill in batches, then switch.',
      },
      {
        id: 'sql-5',
        prompt:
          'On PostgreSQL 14 you add a new column: ALTER TABLE orders ADD COLUMN priority integer DEFAULT 0. The table has 200 million rows. What do you expect?',
        options: [
          'A multi-hour rewrite of every row',
          'The column is added, but existing rows stay NULL forever',
          'A fast change: the default is stored in the table metadata and no rewrite happens',
          'An error, because a default needs NOT NULL',
        ],
        answer: 2,
        explanation:
          'Since PostgreSQL 11 a constant default is stored once in the metadata and returned for old rows, so the ALTER is fast even on huge tables. The rewrite fear is right for a type change, not here. It still needs a brief exclusive lock, so it can wait behind a long-running query - set a lock timeout.',
      },
      {
        id: 'sql-6',
        prompt:
          'Data is stored normalised in PostgreSQL. The product manager asks for a report nobody planned: revenue by product category per country for last quarter. What is the usual cost?',
        options: [
          'Write a new query joining orders, products and users - no data has to move',
          'Duplicate the category and country into every order row first',
          'Export everything and join it in application code',
          'Create a new table for this one report and backfill it',
        ],
        answer: 0,
        explanation:
          'Answering questions you did not plan for is what normalised relational data is good at: the join happens at query time. You might add an index if it runs often. Pre-joining or duplicating data is the document-store habit, needed there because joins are missing - see the Join-heavy report workload in the Lab.',
      },
      {
        id: 'sql-7',
        prompt:
          'Orders are written by the web app, a nightly import job and a support admin script. Last month an order appeared for a customer id that does not exist. Where should the rule "an order belongs to an existing customer" live?',
        options: [
          'In the web app validation, since it writes most orders',
          'In a nightly clean-up job that deletes orphan orders',
          'In a code review checklist for every new writer',
          'In a foreign key constraint in the database',
        ],
        answer: 3,
        explanation:
          'A constraint in the database applies to every writer at once, including the script someone runs at midnight. Validation in one app is tempting but misses the other two writers, and a clean-up job only repairs damage after customers have seen it.',
      },
      {
        id: 'sql-8',
        prompt:
          'You switch a transfer transaction to SERIALIZABLE isolation. Under load, some transactions fail with SQLSTATE 40001 ("could not serialize access"). What should the application do?',
        options: [
          'Treat it as a bug and switch back to read committed',
          'Retry the whole transaction from the beginning',
          'Retry only the last statement that failed',
          'Ignore it - the database already applied the changes',
        ],
        answer: 1,
        explanation:
          'Serializable isolation gives its guarantee by aborting transactions that would break it, and the PostgreSQL docs say applications must retry the entire transaction. Retrying just the last statement is not possible - the transaction is already aborted. Switching back gives up the protection you asked for.',
      },
      {
        id: 'sql-9',
        prompt:
          'A product catalogue on one PostgreSQL primary hits its CPU limit. 95% of queries are reads of product pages. Someone proposes rewriting everything for a NoSQL store. What is the proportionate first step?',
        options: [
          'Shard the database by product id straight away',
          'Rewrite the data model for a document store',
          'Add read replicas or a cache for the reads, and measure',
          'Buy a bigger machine and turn off the indexes to save CPU',
        ],
        answer: 2,
        explanation:
          'Relational databases scale reads with replicas and caches; that is cheap and keeps the transactions and the schema. Sharding and rewrites solve write scaling, which is not the problem here. Dropping indexes would make every read a scan and burn more CPU, not less.',
      },
      {
        id: 'sql-10',
        prompt:
          'Ten workers poll a jobs table with SELECT ... FOR UPDATE LIMIT 1. Most of the time nine of them are waiting on the row the first one locked. What is the fix?',
        options: [
          'Add FOR UPDATE SKIP LOCKED so each worker takes the next unlocked job',
          'Remove the lock so every worker reads freely',
          'Run only one worker',
          'Raise the isolation level to serializable',
        ],
        answer: 0,
        explanation:
          'SKIP LOCKED makes a worker pass over rows another transaction holds, which the PostgreSQL docs name as the way to avoid contention on a queue-like table. Removing the lock lets two workers take the same job. One worker and serializable both make the waiting worse, not better.',
      },
      {
        id: 'sql-11',
        prompt:
          'In the Lab, on the relational side, you raise Checkouts per second past 4,000 and the PostgreSQL node turns red. What limit are you looking at?',
        options: [
          'The carts table is full',
          'Transactions cannot run in parallel, so only one checkout runs at a time',
          'The join is wrong and needs an index',
          'Every write goes through the one primary, so its capacity caps checkouts until you scale it up or shard',
        ],
        answer: 3,
        explanation:
          'A relational database takes all writes on one primary; the Lab frame says it: one machine, every table, every write. Transactions do run in parallel - thousands per second here - so the limit is the machine, not serial execution. The numbers are simplified; the shape is the lesson.',
      },
    ],
  },
  {
    slug: 'nosql-databases',
    title: 'NoSQL Databases',
    tagline: 'Data models built around a specific access pattern.',
    category: 'data',
    difficulty: 'Beginner',
    lab: 'data-models',
    labFocus: 'nosql-databases',
    keywords: ['mongodb', 'cassandra', 'dynamodb', 'key value', 'document', 'wide column', 'graph', 'partition key'],
    what: 'NoSQL covers several families: key-value stores, document stores, wide-column stores and graph databases. Each trades general-purpose querying for a specific shape of access.',
    why: 'When you know the access pattern in advance and need it to stay fast at very large scale, a store designed around that pattern can partition and replicate more easily than a general relational engine.',
    how: [
      'Key-value (Redis, DynamoDB): lookup by key, no joins.',
      'Document (MongoDB): store an aggregate as one document, read it in one operation.',
      'Wide-column (Cassandra, HBase): partition key plus clustering key, optimised for huge write volumes.',
      'Graph (Neo4j): relationships are first-class, traversals are cheap.',
      'In a partitioned store the partition key decides which machine holds a record, so a lookup by key touches one machine.',
    ],
    when: [
      'High read or write throughput on a known partition key.',
      'Documents that are always read as a whole (a product page, a user profile).',
      'Data whose shape varies a lot between records.',
    ],
    advantages: [
      'Partitioning is part of the model, so adding machines adds capacity for key traffic.',
      'Predictable latency for the access pattern the data was designed for.',
      'One read returns a whole aggregate, with no join.',
    ],
    diagram: `Document store               Wide column store

{ _id: "u_42",               partition: user_id
  name: "Ada",               cluster:   created_at desc
  addresses: [ ... ],        -> reads of one user timeline are
  orders: [ ... ] }             one contiguous disk scan`,
    tradeoffs: [
      {
        approach: 'Key-value or document store',
        gains: ['Partitioning is built in', 'Predictable latency for the designed access pattern', 'Flexible record shape'],
        costs: [
          'Multi-item transactions are limited or cost extra',
          'Queries the key was not designed for need a scan, an index or a second copy of the data',
          'Denormalised data must be kept in sync by your code',
        ],
      },
      {
        approach: 'Wide-column store',
        gains: ['Very high write throughput across many machines', 'Cheap range reads inside one partition'],
        costs: ['Tables are designed per query, so data is duplicated', 'A bad partition key creates hot or huge partitions'],
      },
      {
        approach: 'Graph database',
        gains: ['Multi-hop traversals (friends of friends) stay cheap'],
        costs: ['Aggregations over the whole dataset are not its strength', 'A smaller ecosystem to hire and operate for'],
      },
    ],
    mistakes: [
      'Choosing NoSQL for "speed" and then implementing joins in the application layer.',
      'Picking a partition key that concentrates traffic on one partition.',
      'Assuming schema-less means you have no schema - it means the schema lives in your code.',
      'Doing several separate writes that must succeed together, with no transaction or compensation.',
    ],
    realWorld: [
      'MongoDB supports multi-document transactions, and its docs still advise modelling so that most writes touch one document.',
      'DynamoDB transactions do two underlying writes per item (prepare and commit), so they consume twice the write capacity.',
      'Each DynamoDB partition serves up to 3,000 read units and 1,000 write units per second, which is why a hot key is a real limit.',
    ],
    related: ['sql-databases', 'relational-vs-non-relational', 'sharding', 'eventual-consistency'],
    quiz: [
      {
        id: 'nosql-1',
        prompt:
          'A chat app stores messages in a wide-column store partitioned by message_id. The main screen shows the last 50 messages of one conversation. What goes wrong, and what is the usual fix?',
        options: [
          'Nothing - random partitioning is always best for reads',
          'Each screen touches many partitions; partition by conversation id and sort by time inside it',
          'Writes become slow; switch to partitioning by user name',
          'The store runs out of space; add a TTL to every message',
        ],
        answer: 1,
        explanation:
          'In a partitioned store you design the key from the query. Partitioning by message_id spreads writes well but scatters one conversation over every node. Partitioning by conversation (bounded by a time bucket for huge chats) makes the screen one read of one sorted partition.',
      },
      {
        id: 'nosql-2',
        prompt:
          'In the Lab you turn on One hot key: half of all requests ask for the same cart and Partition 1 turns red. You raise partitions from 4 to 6. What happens?',
        options: [
          'The hot key is split across the new partitions and the load evens out',
          'Every partition slows down equally',
          'The store rejects all requests until you rebalance by hand',
          'Nothing improves for that key - one key lives on one partition, so its machine stays overloaded',
        ],
        answer: 3,
        explanation:
          'More partitions spread more keys, but one key still hashes to one partition. The tempting answer assumes the load is split per request; it is split per key. The fixes are a better key (for example adding a suffix to spread writes), or a cache in front of the hot reads.',
      },
      {
        id: 'nosql-3',
        prompt:
          'A forum stores each post as a document that embeds the author display name, so a post page needs one read. A user changes their display name. What happens to their old posts?',
        options: [
          'They keep showing the old name until your code updates every post that embeds it',
          'The store updates them automatically, like a foreign key',
          'They show an error because the reference is broken',
          'Only the newest post is updated',
        ],
        answer: 0,
        explanation:
          'Embedding copies the value, and a document store keeps no link between copies - there is no join to fetch the current name. Automatic updates are the relational picture, where the name is stored once. Denormalising buys a one-read page and costs you this fan-out write.',
      },
      {
        id: 'nosql-4',
        prompt:
          'Users are stored in a key-value store keyed by user id. A new feature needs "all users in Berlin". What is the honest cost?',
        options: [
          'None - key-value stores filter on any field quickly',
          'You need a join, which the store runs for you',
          'Without planning it is a full scan; you add a secondary index or a second copy keyed by city, and keep it in sync',
          'You must move all users to a new store',
        ],
        answer: 2,
        explanation:
          'A key-value store answers by key. A question on another field means scanning everything, unless you build an access path for it - an index or a duplicate table - which costs storage and write work. This is why the NoSQL habit is to list the queries before designing the keys.',
      },
      {
        id: 'nosql-5',
        prompt:
          'Five services write order documents into one collection with no validation. A year later a report crashes on orders where total is a string. What is the lesson?',
        options: [
          'Document stores corrupt types over time',
          'Schema-less still has a schema - it lives in your code, so validate and version it on write',
          'Reports should not read orders',
          'Use a bigger machine for the report',
        ],
        answer: 1,
        explanation:
          'The store accepted whatever each service wrote, so five slightly different shapes piled up. Blaming the store misses the point: nothing enforced a shape, so your code has to - with validation rules, a version field, or a schema check on write.',
      },
      {
        id: 'nosql-6',
        prompt:
          'In the Lab the document store runs checkouts without a transaction: read the cart, update stock, write the order. The Half-done checkouts counter keeps growing. What does each one mean?',
        options: [
          'A checkout that was retried and succeeded',
          'An order written twice',
          'A request rejected because a partition was full',
          'Stock was reserved, then the order write failed - and nothing undid the stock update',
        ],
        answer: 3,
        explanation:
          'Separate writes to different documents succeed or fail on their own. When the second fails, the first stays. Turning on Multi-document transaction makes it all-or-nothing at the price of more operations per checkout; the other options are to put both changes in one document, or to write a compensating step.',
      },
      {
        id: 'nosql-7',
        prompt:
          'You plan one DynamoDB transaction per second, each writing three items of 500 bytes with TransactWriteItems. How many write capacity units do you provision?',
        options: ['6, because each item is written twice: prepare and commit', '3, one per item', '1, one per transaction', '0, transactions are free'],
        answer: 0,
        explanation:
          'The DynamoDB docs use this exact example: every item in a transaction costs two writes, so three items need six WCUs. Counting one per item is the non-transactional price - the Lab shows the same doubling as more operations per checkout when the transaction is on.',
      },
      {
        id: 'nosql-8',
        prompt:
          'In the Lab on the document side, 4 partitions share 120,000 key requests per second and the busiest runs at 75%. Traffic will double. Keys are spread evenly. What keeps it healthy?',
        options: [
          'Nothing - a document store cannot take more traffic',
          'A join index on the carts',
          'More partitions, so each machine takes a smaller share of the keys',
          'Turning on multi-document transactions',
        ],
        answer: 2,
        explanation:
          'With keys spread evenly, capacity grows with the number of partitions: each get or put touches only the partition that holds its key. Transactions add cost rather than capacity, and joins are not involved in key lookups at all.',
      },
      {
        id: 'nosql-9',
        prompt:
          'A team chose a document store "because it is faster", and now builds a monthly revenue report by loading 5 million order documents into the app and joining them with products in code. It takes minutes. What is the better move?',
        options: [
          'Add more application servers to join faster',
          'Run the report on a store built for it - a relational replica or an analytics store fed from the orders',
          'Embed every product inside every order and scan again',
          'Cache the report result for one second',
        ],
        answer: 1,
        explanation:
          'The Lab Join-heavy report shows why: without a join in the database, every matching order crosses the network before the answer exists. More app servers do not remove the shipping. Reports usually belong in a second system built for scans and joins.',
      },
      {
        id: 'nosql-10',
        prompt:
          'A user saves their new address, reloads immediately, and sees the old one. The store is read with its default eventually consistent reads. What is going on?',
        options: [
          'The write was lost',
          'The partition key is wrong',
          'The document is too large',
          'The read reached a replica that had not caught up yet; read this one request with strong consistency',
        ],
        answer: 3,
        explanation:
          'Eventually consistent reads may return a value from before a recent write. The write is not lost - it arrives a moment later. Stores like DynamoDB let you ask for a strongly consistent read per request, which costs more, so you use it where read-your-writes matters.',
      },
      {
        id: 'nosql-11',
        prompt:
          'A catalogue holds TVs with 40 attributes and T-shirts with 6. A product page always loads one product with all its attributes. Which model fits this access most directly?',
        options: [
          'One document per product, read by product id',
          'A graph database with an edge per attribute',
          'A wide-column table partitioned by attribute name',
          'One relational table with a column for every possible attribute',
        ],
        answer: 0,
        explanation:
          'The page reads one aggregate whole, and the shape varies per category - the case documents are built for. A wide table with every possible column is mostly empty; partitioning by attribute scatters one product across machines. A relational design with a JSONB column is also workable, but among these options the document is the direct fit.',
      },
    ],
  },
  {
    slug: 'relational-vs-non-relational',
    title: 'Relational vs Non-Relational',
    tagline: 'Not fast vs slow - different guarantees and different query freedom.',
    category: 'data',
    difficulty: 'Beginner',
    lab: 'data-models',
    labFocus: 'relational-vs-non-relational',
    keywords: ['comparison', 'trade-offs', 'choice', 'sql vs nosql', 'polyglot persistence'],
    what: 'A comparison of relational and non-relational stores along the dimensions that actually differ: data model, query flexibility, transactions, scaling story and operational cost.',
    why: 'The common shorthand ("SQL is slow, NoSQL is fast") is wrong and leads to bad choices. Both families can be fast; they differ in what they guarantee and what they make easy.',
    how: [
      'Ask whether your query patterns are known and stable. If yes, a purpose-built store can fit them exactly.',
      'Ask whether you need multi-entity transactions. If yes, relational is the low-effort path.',
      'Ask what your write volume and partition key look like at 10x current scale.',
      'Ask who will operate it at 3am.',
    ],
    when: [
      'Choosing the store for a new product or a new service.',
      'A workload outgrows the store it started on, and you must decide what to add.',
      'Deciding which store is the system of record when data lives in several.',
    ],
    advantages: [
      'Choosing on access patterns and transactions avoids an expensive migration later.',
      'Knowing what each side costs lets you add a second store for one workload instead of replacing the first.',
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
      {
        approach: 'Both (polyglot persistence)',
        gains: ['Each workload runs on a store shaped for it'],
        costs: ['Every store adds backups, upgrades, monitoring and on-call knowledge', 'You must decide which store owns each fact'],
      },
    ],
    mistakes: [
      'Choosing based on popularity rather than on transaction and query requirements.',
      'Mixing both without a clear rule about which system owns which data.',
      'Choosing for an imagined future scale instead of the queries you run today.',
    ],
    related: ['sql-databases', 'nosql-databases', 'denormalization', 'cap-theorem'],
    quiz: [
      {
        id: 'rvn-1',
        prompt:
          'A teammate wants to move the order history page (500 requests per second) from PostgreSQL to a document store "because NoSQL is faster". What is the accurate reply?',
        options: [
          'Agreed - NoSQL databases are always faster than relational ones',
          'No - relational databases are always faster because of their query planner',
          'Both handle 500 requests per second comfortably; the real difference is guarantees, query freedom and how easily each partitions',
          'It does not matter, because neither needs a data model',
        ],
        answer: 2,
        explanation:
          'Speed depends on the access pattern and the hardware, not on the family. At this load both are comfortable, so the choice rests on transactions, which future queries stay cheap, and how writes scale. Both "always faster" claims are the shorthand this Concept exists to correct.',
      },
      {
        id: 'rvn-2',
        prompt:
          'A ticket booking system must reserve a seat, record the payment and issue the ticket - all together or not at all. The team is choosing a store. What points to relational?',
        options: [
          'The need to change several records atomically, which one relational transaction gives for free',
          'The number of seats in a venue',
          'The size of each ticket record',
          'The fact that seats have numbers',
        ],
        answer: 0,
        explanation:
          'Multi-entity invariants are the strongest signal for relational: BEGIN ... COMMIT makes them all-or-nothing. Document stores can do it with multi-document transactions, at extra cost and with narrower limits; the other options do not bear on the choice at all.',
      },
      {
        id: 'rvn-3',
        prompt:
          'An IoT platform ingests 200,000 sensor readings per second. They are only ever read as "readings of device X between two times". No joins, no multi-row transactions. Which fits this workload most directly?',
        options: [
          'One relational primary with a foreign key from readings to devices',
          'A graph database with an edge per reading',
          'A document per device that embeds every reading',
          'A wide-column store partitioned by device and time bucket, sorted by time',
        ],
        answer: 3,
        explanation:
          'Huge write volume on a known key, read by range inside that key - the shape wide-column stores are built for, with writes spread over many machines. One primary takes every write on one machine; one ever-growing document per device hits size limits and rewrites the whole document on every reading.',
      },
      {
        id: 'rvn-4',
        prompt:
          'A three-person startup is building its first product. Nobody knows yet which screens and reports will matter. What is the lower-risk starting store?',
        options: [
          'A wide-column store, to be ready for scale',
          'A relational database such as PostgreSQL, because it answers queries you have not planned yet',
          'Three different stores, one per future workload',
          'Plain JSON files on disk',
        ],
        answer: 1,
        explanation:
          'When access patterns are unknown, the store that lets you discover them is the safe bet: normalised tables plus joins answer new questions without moving data. A wide-column store asks you to commit to the queries up front, and several stores multiply the operational cost before there is any need.',
      },
      {
        id: 'rvn-5',
        prompt:
          'In the Lab with both stores shown: at 80,000 key requests per second the relational side fails requests and the document side is fine. You switch to Join-heavy report and the document side takes seconds while relational answers fast. What does that show?',
        options: [
          'The document store is faster overall',
          'The relational database is faster overall',
          'Neither is faster in general - each makes a different workload cheap',
          'The Lab numbers are random',
        ],
        answer: 2,
        explanation:
          'Key traffic splits across partitions, so the document store scales it; the report needs a join, which the relational database runs where the data lives. Picking a winner from one workload is exactly the mistake. The Lab numbers are simplified, but the shapes follow how each store works.',
      },
      {
        id: 'rvn-6',
        prompt:
          'Orders live in PostgreSQL and are copied into a search index. After a bug, the two disagree about an order status. Which store should be trusted, and how do you repair the other?',
        options: [
          'PostgreSQL is the system of record; rebuild or re-sync the search index from it',
          'The search index, because it is newer',
          'Whichever store the customer looked at last',
          'Average the two values',
        ],
        answer: 0,
        explanation:
          'With several stores, one must own each fact and every other copy must be rebuildable from it. Trusting the newer copy just picks whichever bug wrote last. Deciding the owner before the incident is what keeps polyglot persistence sane.',
      },
      {
        id: 'rvn-7',
        prompt:
          'You run PostgreSQL and need a background job queue for about 50 jobs per second. A teammate wants to add a message broker and a cache as well. What is the proportionate choice?',
        options: [
          'Add the broker and the cache now, for future scale',
          'Keep jobs in application memory',
          'Poll a jobs table without any locking',
          'Use a jobs table with SELECT ... FOR UPDATE SKIP LOCKED, and add a dedicated broker when a measured need appears',
        ],
        answer: 3,
        explanation:
          'Postgres handles a modest queue well, and every extra store costs backups, upgrades, monitoring and on-call knowledge forever. Memory loses jobs on restart, and polling without locks lets two workers take the same job.',
      },
      {
        id: 'rvn-8',
        prompt:
          'The core feature is "people within three hops of you who liked this event", run constantly on a large social graph. Among these, which store is shaped for that query?',
        options: ['A key-value store', 'A graph database', 'A wide-column store', 'A document store'],
        answer: 1,
        explanation:
          'Multi-hop traversal is what graph databases make cheap: relationships are stored as first-class links. Key-value and wide-column stores would need one lookup per hop per person, and documents do not model many-to-many links well.',
      },
      {
        id: 'rvn-9',
        prompt:
          'Every order now needs a currency field. On the document store the team says "no migration needed". In the Lab Schema change workload, what is the full picture?',
        options: [
          'The document store rewrites every order in the background',
          'Nothing changes at all',
          'Nothing is locked, but old orders lack the field - your code must read both shapes or you run a backfill',
          'The document store rejects writes until the field is added everywhere',
        ],
        answer: 2,
        explanation:
          'Schema-on-read avoids the lock a relational rewrite can take, which is real. The cost moves into your code: two shapes to read until you backfill, and nothing in the database stops a third. "No migration needed" is half the truth.',
      },
      {
        id: 'rvn-10',
        prompt:
          'A team says: "we will need to scale writes across machines, so we cannot use SQL". What is the missing option?',
        options: [
          'Distributed SQL (CockroachDB, Spanner, Vitess) scales writes across machines while keeping SQL - at the cost of cross-machine coordination',
          'None - SQL databases only run on one machine',
          'Turning off transactions in PostgreSQL',
          'Adding read replicas, which also scale writes',
        ],
        answer: 0,
        explanation:
          'Distributed SQL shards and replicates behind a SQL interface, so "horizontal writes" and "SQL" are not exclusive. Read replicas only add read capacity - every write still lands on the primary. Transactions that span machines pay extra round trips, which is the price.',
      },
      {
        id: 'rvn-11',
        prompt:
          'All order data lives in a key-value store. The business now wants ad-hoc dashboards: revenue by region, by week, by product line. What is the usual approach?',
        options: [
          'Scan the key-value store from the dashboard on every page load',
          'Add a secondary index for every possible dashboard filter',
          'Stop building dashboards',
          'Stream the data into an analytics store or warehouse built for scans and joins',
        ],
        answer: 3,
        explanation:
          'A store shaped for key access is not shaped for ad-hoc analysis, which is why analytics usually needs a second system fed from the first. Scanning on every page load competes with live traffic, and an index per filter multiplies write cost without giving you joins.',
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
