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
    lab: 'partitioning',
    keywords: ['range partition', 'list partition', 'hash partition', 'pruning', 'retention', 'drop partition'],
    what: 'Partitioning divides a large table into smaller physical pieces - by range (usually time), by list, or by hash - while keeping one logical table inside one database.',
    why: 'It keeps indexes small, lets the planner skip irrelevant partitions, and makes deleting old data an instant DROP instead of a multi-hour DELETE.',
    how: [
      'Choose a partition key that appears in most queries - created_at for event data, tenant_id for multi-tenant data.',
      'The application still reads and writes one table; the database routes each row to its partition.',
      'The planner prunes partitions that cannot match the WHERE clause, and reads only the rest.',
      'Retention becomes DROP TABLE on the oldest partition rather than a bulk DELETE and vacuum.',
    ],
    when: [
      'Time-series and event tables with a retention rule such as "keep 90 days".',
      'Tables larger than the memory of the database server, where index maintenance and scans start to hurt.',
      'Most queries filter on one column that can serve as the partition key.',
    ],
    advantages: [
      'Queries that filter on the partition key read only the partitions that can match.',
      'Each partition has its own smaller index, which is far more likely to stay in memory.',
      'Dropping an old partition takes milliseconds and returns its disk space at once.',
      'Still one database: transactions, joins and SQL work as before.',
    ],
    diagram: `events (logical table)
  |- events_2026_07   <- pruned
  |- events_2026_08   <- pruned
  |- events_2026_09   <- scanned
WHERE created_at >= '2026-09-01'`,
    tradeoffs: [
      {
        approach: 'Range partitioning (by time)',
        gains: ['Recent-data queries prune to one partition', 'Retention is a DROP of the oldest partition', 'Old partitions can move to cheaper storage'],
        costs: ['Every new row lands in the newest partition, so writes are not spread', 'Future partitions must be created ahead of time, or inserts fail'],
      },
      {
        approach: 'List partitioning (by a fixed set of values)',
        gains: ['One partition per region or status, easy to reason about', 'Queries for one value prune to one partition'],
        costs: ['Sizes follow the data, so one big value makes one big partition', 'A new value needs a new partition or a DEFAULT partition'],
      },
      {
        approach: 'Hash partitioning (by tenant or user id)',
        gains: ['Rows spread evenly when there is no natural range', 'Queries for one key prune to one partition'],
        costs: ['Range queries and retention by time touch every partition', 'Changing the number of partitions means moving rows'],
      },
      {
        approach: 'One plain table (no partitioning)',
        gains: ['No partitions to create, name or monitor', 'No rule that unique keys must include the partition key'],
        costs: ['Every scan and index covers the whole table', 'Retention is a slow bulk DELETE that leaves dead space behind'],
      },
    ],
    mistakes: [
      'Confusing partitioning with sharding - partitioning stays inside one database and does not add write capacity.',
      'Choosing a partition key the main queries do not filter on, so every query opens every partition.',
      'Forgetting to create next month partition in advance - inserts for the new month fail.',
      'Creating thousands of tiny partitions - planning time and memory grow with the partitions a query keeps.',
      'Enforcing retention with DELETE on a range-partitioned table instead of dropping the old partition.',
    ],
    realWorld: [
      'PostgreSQL, MySQL and Oracle all support range, list and hash partitioning of a single table.',
      'Log, audit and event tables are commonly partitioned by day or month and expire by dropping partitions.',
    ],
    related: ['sharding', 'database-indexing', 'sql-databases'],
    quiz: [
      {
        id: 'pt-1',
        prompt:
          'An events table holds 170M rows over six months and is range-partitioned by month on created_at. On 20 September a dashboard asks for WHERE created_at >= now() - 7 days. What does the planner read?',
        options: [
          'All six partitions, because the table is still one logical table',
          'Only the current month partition - the other five cannot match and are pruned',
          'Only the index of the whole table, never a partition',
          'The oldest partition first, then newer ones until it finds 7 days of rows',
        ],
        answer: 1,
        explanation:
          'The WHERE clause filters on the partition key, so the planner rules out every partition whose range cannot overlap the last 7 days - in the Lab, five wires go dashed. Being one logical table does not force a full read: pruning is the whole point of partitioning.',
      },
      {
        id: 'pt-2',
        prompt:
          'The same table, range-partitioned by created_at, gets a report of all failed events, filtering only on the status column. How does it compare with running it on one unpartitioned table of the same size?',
        options: [
          'About six times faster, because the table is split into six',
          'It fails, because status is not the partition key',
          'It reads every partition, and is a little slower than one plain table because each partition adds overhead',
          'It reads only the newest partition, because failures are recent',
        ],
        answer: 2,
        explanation:
          'Pruning only happens when the query filters on the partition key. status is not the key, so all partitions are opened, each with its own planning cost. Splitting the table does not make an unrelated filter faster - in the Lab, pick "failed events" and every wire lights up.',
      },
      {
        id: 'pt-3',
        prompt:
          'Retention is 90 days. Every night DELETE FROM events WHERE created_at < now() - 90 days removes about 20M rows, runs for hours and makes replicas lag. The table is range-partitioned by month. What do you change?',
        options: [
          'Run the DELETE in smaller batches every hour instead',
          'Keep the DELETE and add a replica to absorb the lag',
          'Switch to hash partitioning so the DELETE is spread evenly',
          'Drop (or detach) the oldest monthly partition instead of deleting its rows',
        ],
        answer: 3,
        explanation:
          'A month that is its own partition can be removed with DROP TABLE, a metadata change that takes milliseconds, writes almost no WAL and returns the space at once. Batching the DELETE spreads the pain but still writes every row to the WAL and leaves dead space; hash partitioning scatters each month over every partition, so it could never be dropped whole.',
      },
      {
        id: 'pt-4',
        prompt:
          'A nightly DELETE removed 30M old rows from an unpartitioned table. The next morning the table still uses the same disk space. Why?',
        options: [
          'The DELETE was rolled back',
          'Deleted rows leave dead space that VACUUM makes reusable inside the table but does not hand back to the disk; only a table rewrite such as VACUUM FULL does',
          'The rows were copied into the write-ahead log and still count as table data',
          'Deleted rows are hidden but stay readable until the next backup',
        ],
        answer: 1,
        explanation:
          'In PostgreSQL a DELETE marks rows dead; regular VACUUM lets the table reuse that space but normally keeps the file size, and VACUUM FULL needs an exclusive lock to rewrite it. The Lab shows this as "GB dead" after a DELETE. Nothing was rolled back - the rows are gone, only their space remains.',
      },
      {
        id: 'pt-5',
        prompt:
          'Your team says: "Our single PostgreSQL primary is at 95% CPU from writes. Let us partition the orders table to add write capacity." What do you tell them?',
        options: [
          'Good plan - each partition gets its own CPU',
          'Partitioning keeps every partition on the same machine, so it does not add write capacity; that needs a bigger machine or sharding',
          'Partition by hash, because hash partitions run on separate cores',
          'Partition by range, because only the newest partition takes writes',
        ],
        answer: 1,
        explanation:
          'Partitions are tables inside one database instance, sharing its CPU, memory and disk. Partitioning reduces work per query and per maintenance job, not the ceiling of the machine. Spreading writes over machines is sharding. Hash partitions do not get their own cores.',
      },
      {
        id: 'pt-6',
        prompt:
          'A SaaS app runs almost every query with WHERE tenant_id = ? and has no time-based retention. Tenants are roughly the same size. Which partitioning fits?',
        options: [
          'Hash partitioning on tenant_id, so rows spread evenly and each query prunes to one partition',
          'Range partitioning on created_at, because every table should be partitioned by time',
          'List partitioning with one partition per tenant for 40,000 tenants',
          'No key at all - let the database pick partitions at random',
        ],
        answer: 0,
        explanation:
          'The dominant filter is tenant_id, so it should be the key, and hash spreads it evenly when there is no natural range. Range on created_at would force every tenant query to open all partitions. One list partition per tenant means 40,000 partitions, far past the few thousand the PostgreSQL planner handles well.',
      },
      {
        id: 'pt-7',
        prompt:
          'The events table is range-partitioned by month and has partitions up to September. On 1 October at 00:00 inserts start failing. What most likely happened?',
        options: [
          'The September partition is full',
          'The partition key index is corrupted',
          'Nobody created the October partition, and there is no default partition, so new rows have nowhere to go',
          'The planner pruned the insert',
        ],
        answer: 2,
        explanation:
          'A row whose key matches no partition is rejected with an error. Partitions have no size limit, so September is not "full". This is the classic partitioning outage: create future partitions with a scheduled job and alert when it fails.',
      },
      {
        id: 'pt-8',
        prompt:
          'You want a PRIMARY KEY (id) on an events table partitioned by range on created_at. PostgreSQL refuses. What is the fix, and why?',
        options: [
          'Use PRIMARY KEY (id, created_at): each partition can only check uniqueness inside itself, so the key must include the partition key',
          'Add a global index across all partitions',
          'Switch to hash partitioning on created_at',
          'Drop the primary key - partitioned tables cannot have one',
        ],
        answer: 0,
        explanation:
          'Indexes on a partitioned table are really one index per partition, so uniqueness is only checked inside a partition. Including the partition key guarantees two equal keys land in the same partition. PostgreSQL has no global index, and partitioned tables can have a primary key as long as it contains the partition columns.',
      },
      {
        id: 'pt-9',
        prompt:
          'Someone proposes daily partitions for 20 years of data, about 7,300 partitions, "for maximum pruning". Most queries are monthly reports. What is the risk?',
        options: [
          'None - more partitions always means faster queries',
          'The table will not fit on one disk',
          'Queries will return duplicate rows',
          'Monthly reports still open about 30 partitions each, and planning time and memory grow with the partition count - monthly partitions match the queries',
        ],
        answer: 3,
        explanation:
          'Too many partitions cost planning time and per-session memory, and the PostgreSQL docs say the planner copes with a few thousand only when queries prune to a few. Partition size should follow the typical query range. More partitions is not free, and it changes nothing about disk size or correctness.',
      },
      {
        id: 'pt-10',
        prompt:
          'An orders table of 2 GB fits easily in the memory of the database server. Queries are fast and there is no retention rule. A developer wants to partition it "to be ready". What do you say?',
        options: [
          'Yes - partition every table from day one',
          'Hold off: the benefit usually appears when a table outgrows memory; today it adds partitions to manage and key rules for no gain',
          'Shard it instead, since partitioning is not enough',
          'Partition it by hash so it uses all CPU cores',
        ],
        answer: 1,
        explanation:
          'The PostgreSQL docs give a rule of thumb: partitioning is worthwhile when a table would otherwise exceed the memory of the server. A small, fast table gains nothing and still pays the costs - future partitions, key rules, per-partition overhead. Sharding a 2 GB table adds far more cost.',
      },
      {
        id: 'pt-11',
        prompt:
          'In the Lab you switch to list partitioning by region and try to remove April. Why is the DROP button disabled, and what happens with DELETE?',
        options: [
          'DROP is disabled because list partitions cannot be dropped; DELETE is instant',
          'DROP is disabled only while queries run; pause and it works',
          'April rows are spread over every region partition, so no single partition holds April; the DELETE has to walk all of them for hours',
          'DELETE is pruned to the DE partition, because DE is the biggest',
        ],
        answer: 2,
        explanation:
          'Only a time-based range key puts one month in one piece. With list partitioning by region, April lives in every partition, so removing it means deleting rows everywhere - slow, WAL-heavy and leaving dead space. List partitions themselves can be dropped; dropping one would remove a whole region, not a month.',
      },
    ],
  },
  {
    slug: 'database-normalization',
    title: 'Database Normalization',
    tagline: 'Store each fact once so it cannot contradict itself.',
    category: 'data',
    difficulty: 'Beginner',
    lab: 'schema-design',
    labFocus: 'database-normalization',
    keywords: ['3nf', 'schema design', 'redundancy', 'integrity', 'update anomaly'],
    what: 'Normalization organises tables so that each piece of information is stored in exactly one place, with relationships expressed by keys.',
    why: 'Duplicated data drifts. If a customer email is copied into every one of their orders, a change has to reach every copy, and a change that stops part way leaves the rows disagreeing - with no constraint to notice and no query that can tell you which one is right.',
    how: [
      'Give every entity its own table and a primary key.',
      'Move repeating groups into child tables linked by foreign keys.',
      'Ensure non-key columns depend on the key, the whole key and nothing but the key (third normal form is usually enough).',
      'Keep historical values, such as the price paid, as facts of their own - copying them is not duplication.',
    ],
    when: [
      'Transactional systems where correctness of writes matters most.',
      'Any fact that changes and is referenced from many rows: names, emails, plans, prices.',
      'As the starting point of every schema - denormalise specific read paths later, once measurement shows they need it.',
    ],
    advantages: [
      'A change writes one row, so it either happens or it does not.',
      'No update, insert or delete anomalies.',
      'Constraints (foreign keys, unique keys) can protect the data.',
    ],
    diagram: `DENORMALISED                    NORMALISED
orders                          orders        customers
 id, customer_name,              id,           id (PK)
 customer_email, total           customer_id,  name
 (email repeated per order)      total         email`,
    tradeoffs: [
      {
        approach: 'Normalized schema',
        gains: ['No update anomalies', 'A change writes one row', 'One source of truth'],
        costs: ['Reads need joins', 'Very hot read paths may become join-heavy'],
      },
      {
        approach: 'Copying the fact into every row',
        gains: ['A read answers from one row, no join', 'Simple queries for one screen'],
        costs: ['A change must reach every copy', 'A half-done change leaves rows that disagree', 'More storage and more rows written'],
      },
    ],
    mistakes: [
      'Treating a historical value (price paid, address at shipping time) as duplication and joining to the current value, which rewrites history.',
      'Denormalising up front because joins "will be slow", before any measurement.',
      'Relying on application code to update every copy - every other writer (an admin tool, a script, another service) will miss one.',
    ],
    related: ['denormalization', 'sql-databases', 'database-indexing'],
    quiz: [
      {
        id: 'norm-1',
        prompt:
          'An orders table stores customer_email on every order. A customer with 120 orders changes email, and the job that rewrites the rows crashes after 70 of them. What state is the data in?',
        options: [
          'The database notices the rows disagree and rolls the 70 rows back',
          'Only the customers table is wrong; the orders are fine',
          'The customer now has two emails across their orders, and no constraint flags it',
          'Nothing changed, because email is not part of the primary key',
        ],
        answer: 2,
        explanation:
          'Each of the 120 rows is valid on its own, so no constraint can see that 70 say one thing and 50 say another. That is the update anomaly. The database only rolls back what was inside one failed transaction - it has no idea the 120 copies are the same fact.',
      },
      {
        id: 'norm-2',
        prompt:
          'In the Schema Design Lab you switch to Normalized and raise Changes left half-done to 10%. The disagreeing-copies counter stays at 0. Why?',
        options: [
          'The Lab turns failures off in the normalized schema',
          'Foreign keys block every write that fails',
          'The normalized schema retries failed changes automatically',
          'The email lives in one customers row, so a change either writes that row or does not - there is no second copy to disagree with',
        ],
        answer: 3,
        explanation:
          'Half-done changes still happen in the normalized schema; they just cannot split one fact in two. A single-row write is atomic. Foreign keys are tempting but they check that a reference points somewhere, not that copies agree.',
      },
      {
        id: 'norm-3',
        prompt:
          'order_items stores price_at_purchase, while products stores the current price. A reviewer says this is duplication and asks you to join to products.price instead. What do you answer?',
        options: [
          'Agree - the price should live in exactly one place',
          'The price paid is a different fact, frozen in time; joining to the current price would change old orders whenever the price changes',
          'Agree, but keep a nightly job that copies products.price into order_items',
          'Store the price only in order_items and drop it from products',
        ],
        answer: 1,
        explanation:
          'Normalization is about storing each fact once, and "what this customer paid on that day" is not the same fact as "what the product costs today". Joining to the current price is tempting because it looks normalised, but it silently rewrites every past invoice after a price change.',
      },
      {
        id: 'norm-4',
        prompt:
          'A university keeps one table: enrollments(student_id, student_name, course_id, course_title, instructor). It wants to publish a new course before anyone has enrolled. What goes wrong?',
        options: [
          'The course cannot be recorded without inventing a fake enrollment row - an insert anomaly',
          'Nothing - just insert a row with an empty student_id',
          'The instructor column must be dropped first',
          'The course is recorded, but the student names are duplicated',
        ],
        answer: 0,
        explanation:
          'Course data only lives on enrollment rows, so no enrollment means nowhere to put the course. An empty student_id is the tempting workaround, but it is the fake row: it breaks the key and every count of students. The fix is a courses table that exists on its own.',
      },
      {
        id: 'norm-5',
        prompt:
          'In a flat sales table, the only row for the product "Blue Lamp" is deleted when its last order is cancelled. The next day nobody can find the lamp price or supplier. Which change prevents this?',
        options: [
          'Soft-delete sales rows instead of deleting them',
          'Add an index on product_name',
          'Keep a backup of the sales table',
          'Move product data into its own products table that sales rows reference by product_id',
        ],
        answer: 3,
        explanation:
          'This is a delete anomaly: removing one fact (the order) removed another (the product). Soft-deleting hides the symptom but keeps product data hostage to order rows. Giving products their own table makes each fact live and die on its own.',
      },
      {
        id: 'norm-6',
        prompt: 'employees(id, name, department_id, department_name). Which column breaks third normal form, and what is the fix?',
        options: [
          'name - move it to a people table',
          'department_name - it depends on department_id, not on the employee id; move it to a departments table',
          'department_id - foreign keys are not allowed in 3NF',
          'None - every column depends on id somehow',
        ],
        answer: 1,
        explanation:
          'department_name is determined by department_id, a non-key column, so it depends on the key only through another column (a transitive dependency). "Depends on id somehow" is the tempting answer, but 3NF asks for the key and nothing but the key. Renaming a department would otherwise touch every employee row.',
      },
      {
        id: 'norm-7',
        prompt:
          'order_lines has the composite key (order_id, product_id) and the columns qty and product_name. What is wrong with product_name here?',
        options: [
          'Nothing - it is in the same row as the key',
          'It should be part of the key',
          'It depends on only half of the key (product_id), so every order line repeats it - a second normal form violation',
          'It is a historical fact and must stay',
        ],
        answer: 2,
        explanation:
          'qty needs both order_id and product_id to be known, but product_name needs only product_id - a partial dependency. The historical-fact answer is tempting, but a product name is not frozen at purchase the way the price paid is; renaming the product would have to rewrite every line.',
      },
      {
        id: 'norm-8',
        prompt:
          'A normalised order page joins 3 tables on indexed keys and takes 8 ms at 300 reads per second. A teammate wants to copy the customer name and the total into orders "to make it fast". What do you do?',
        options: [
          'Keep it normalised - measure first; denormalise a path only when measurement shows the joins are the problem',
          'Copy the columns now, before traffic grows',
          'Drop the foreign keys to speed up the joins',
          'Move the whole schema to a document database',
        ],
        answer: 0,
        explanation:
          'At 8 ms the joins are not the bottleneck, and copying the columns buys every future email or name change a set of copies to keep in sync. "Before traffic grows" is the tempting argument, but it trades certain integrity work for a speed-up nobody has measured yet.',
      },
      {
        id: 'norm-9',
        prompt:
          'In the Lab on the Database Normalization focus, the database is over budget at 200 reads/sec and 20 email changes/sec with 100 orders per customer. Switching to Normalized fixes it even though each read now touches 6 rows instead of 1. Why?',
        options: [
          'The normalized schema is faster on every workload',
          'Normalizing adds an index the denormalized schema did not have',
          'Reads stop going to the database after normalizing',
          'Each email change drops from 101 row writes to 1, and at only 200 reads/sec that saving is far bigger than the extra read rows',
        ],
        answer: 3,
        explanation:
          '20 changes x 101 rows is about 2,000 row writes per second, while 200 reads x 6 rows is 1,200 cheap row reads. The workload was write-heavy, so the copies cost more than the joins. "Faster on every workload" is exactly what the Denormalization focus disproves with 1,500 reads per second.',
      },
      {
        id: 'norm-10',
        prompt:
          'To stop half-done email changes, a team keeps the copied email on orders but wraps the customers row and all order rows in one transaction. What does that fix, and what does it leave?',
        options: [
          'It fixes everything - the copies can no longer disagree',
          'It stops an interrupted change from leaving rows half-updated, but a writer that never touches the copies (an admin tool, another service) still leaves them stale, and each change still writes every copy',
          'It fixes nothing, because transactions do not cover UPDATE statements',
          'It removes the need for the orders table',
        ],
        answer: 1,
        explanation:
          'A transaction makes one change all-or-nothing, which is real progress. But the schema still permits disagreement: any code path that updates only customers leaves the copies behind, and every change still rewrites all the rows. Normalising removes the copies, so there is nothing left to forget.',
      },
      {
        id: 'norm-11',
        prompt:
          'orders.customer_id is a foreign key to customers(id) with the default ON DELETE behaviour. Someone deletes a customer who still has orders. What happens in PostgreSQL?',
        options: [
          'The customer is deleted and the orders keep a customer_id that points nowhere',
          'The orders are deleted with the customer',
          'The delete is rejected with an error, because orders still reference that customer',
          'customer_id on those orders is set to NULL',
        ],
        answer: 2,
        explanation:
          'The default is NO ACTION: if referencing rows still exist when the constraint is checked, the delete fails. Cascading or setting NULL only happens when you ask for ON DELETE CASCADE or SET NULL. Orphaned references are what the foreign key exists to prevent.',
      },
    ],
  },
  {
    slug: 'denormalization',
    title: 'Denormalization',
    tagline: 'Deliberately duplicating data to make a read path fast.',
    category: 'data',
    difficulty: 'Intermediate',
    lab: 'schema-design',
    labFocus: 'denormalization',
    keywords: ['read optimization', 'precomputation', 'materialized view', 'fan-out', 'derived data'],
    what: 'Denormalization stores redundant copies of data - a counter, an embedded document, a materialised view - so that a frequent read does not have to join or aggregate.',
    why: 'Some read paths are so hot that joins and aggregates dominate your database load. Precomputing the answer moves the cost to write time, where it is paid once per change instead of once per read.',
    how: [
      'Identify the expensive, frequent query, and check that an index does not already fix it.',
      'Precompute its result on write, or maintain a materialised view.',
      'Decide how the copy is kept in sync: in the same transaction, via triggers, or asynchronously through events.',
      'Accept and document a staleness window if the update is asynchronous.',
      'Run a reconciliation job that recomputes the copy from the source and fixes drift.',
    ],
    when: [
      'Feeds, counters, leaderboards, product pages, anything read far more than written.',
      'Stores without joins (most NoSQL), where writing the data once per access path is the data model.',
    ],
    advantages: ['Reads answer from one row or one document', 'Predictable read cost under heavy load'],
    diagram: `Normalized read:  SELECT COUNT(*) FROM likes WHERE post_id = ?
                  -> counts every like row on every page view

Denormalized:     posts.like_count  (maintained on write)
                  -> one column read, updated when a like happens`,
    tradeoffs: [
      {
        approach: 'Denormalization',
        gains: ['Much faster and cheaper reads', 'Predictable query cost'],
        costs: ['Two copies that can diverge', 'Write path becomes more complex', 'Backfills needed when logic changes'],
      },
      {
        approach: 'Staying normalised (index, join at read time)',
        gains: ['One source of truth, nothing to reconcile', 'Writes stay one row'],
        costs: ['Every read pays the join or the aggregate', 'Hot read paths can dominate database load'],
      },
    ],
    mistakes: [
      'Denormalising before measuring - an index often solves the same problem with no duplication.',
      'Having no reconciliation job, so drift is never detected.',
      'Letting the copy become the only copy, so it can no longer be rebuilt from a source of truth.',
      'Copying a fact that changes often into many places, so every change fans out into many writes.',
    ],
    related: ['database-normalization', 'caching', 'cqrs', 'fan-out'],
    quiz: [
      {
        id: 'denorm-1',
        prompt:
          'A post page runs COUNT(*) over the likes table on every view. Views are 5,000 per second, new likes are 20 per second, and the count dominates database load. What is the fitting change?',
        options: [
          'Add more read replicas and keep counting on every view',
          'Store like_count on posts, update it in the same transaction as the like insert, and run a reconciliation job',
          'Cache the page for 24 hours',
          'Delete old likes so the count is faster',
        ],
        answer: 1,
        explanation:
          'The read is 250 times more frequent than the write, the textbook case for precomputing on write. The same transaction keeps the two copies from splitting, and the reconciliation job catches drift from paths that bypass it. Replicas are tempting but they only spread the same wasted counting over more machines.',
      },
      {
        id: 'denorm-2',
        prompt:
          'An order page takes 400 ms. EXPLAIN shows a sequential scan on orders.customer_id in the join. Someone proposes copying the customer columns into orders. What do you try first?',
        options: [
          'Add an index on orders.customer_id and measure again',
          'Copy the columns - joins are always slow',
          'Move the orders into a document database',
          'Cache the whole page for an hour',
        ],
        answer: 0,
        explanation:
          'The join is slow because it scans, not because it is a join. An index often solves the same problem with no duplication and nothing to keep in sync. Denormalising here would hide a missing index behind copies that now need maintenance.',
      },
      {
        id: 'denorm-3',
        prompt:
          'like_count is incremented by the application in a statement separate from the like insert. After a year, spot checks show counts that do not match the likes table. Which change stops requests that fail between the two statements from splitting them?',
        options: [
          'Run the increment before the insert instead of after',
          'Increment by 2 to compensate',
          'Put the insert and the increment in one transaction',
          'Read the count from a replica',
        ],
        answer: 2,
        explanation:
          'Two separate statements can be split by any failure in between, whichever runs first. One transaction makes them all-or-nothing. Swapping the order is tempting but it only changes the direction of the error, not whether it happens.',
      },
      {
        id: 'denorm-4',
        prompt:
          'Clients retry the Like request on timeout. The likes table has a unique key on (user_id, post_id), so the second insert is rejected, yet like_count still goes up twice. What is the fix?',
        options: [
          'Turn off client retries',
          'Only increment when the insert actually created a row - or derive the count from the rows',
          'Remove the unique key so both inserts succeed',
          'Lower the timeout',
        ],
        answer: 1,
        explanation:
          'The insert is idempotent thanks to the unique key; the blind increment is not. Tie the increment to the effect of the insert (for example INSERT ... ON CONFLICT DO NOTHING and increment only if a row was inserted). Turning off retries is tempting but it trades a counting bug for user-visible failures.',
      },
      {
        id: 'denorm-5',
        prompt:
          'An admin tool deletes spam likes directly in the database, and like_count never goes down. Which sync mechanism would have kept the counter right for those deletes too?',
        options: [
          'An increment in the application code',
          'A longer cache TTL',
          'A read replica for the admin tool',
          'A database trigger on the likes table',
        ],
        answer: 3,
        explanation:
          'A trigger runs for every writer, including tools and scripts that bypass the application. Its cost is invisible behaviour that the next engineer may not expect. Application code is the tempting answer, but it is exactly what the admin tool bypassed.',
      },
      {
        id: 'denorm-6',
        prompt:
          'In the Lab on the Denormalization focus you switch to Denormalized: database load drops from over budget to about 25%, but the disagreeing-copies counter starts to climb. What is the Lab telling you?',
        options: [
          'The copies need a mechanism that keeps them honest - turn on the reconciliation job, and keep changes in one transaction',
          'Denormalization is broken and should be undone',
          'The counter is a display bug and can be ignored',
          'Raise the database budget',
        ],
        answer: 0,
        explanation:
          'The read path is now cheap, and the price is copies that can drift when a change stops part way. That is expected, and it is why every denormalised value needs a sync mechanism and a reconciliation job. Switching back is tempting but it brings the read overload back.',
      },
      {
        id: 'denorm-7',
        prompt:
          'A product stock level changes 1,000 times per second and is read 50 times per second. A teammate wants to copy it into 30 denormalised listing documents. What happens?',
        options: [
          'Reads get faster at no cost',
          'Nothing changes, because the reads are few',
          'Every stock change becomes 30 writes - about 30,000 writes per second to save 50 lookups',
          'The listings become the source of truth',
        ],
        answer: 2,
        explanation:
          'Denormalisation pays off when reads vastly outnumber writes. Here writes win by 20 to 1, so the copy multiplies the expensive side. "Reads get faster" is true but ignores the write fan-out that pays for it.',
      },
      {
        id: 'denorm-8',
        prompt:
          'Product search documents embed the brand name and are updated by an asynchronous consumer of change events. A brand is renamed, and for about 2 seconds search still shows the old name. What does this mean?',
        options: [
          'The search index is corrupt and must be deleted',
          'It is the expected staleness window of an asynchronous copy - document it, and make sure the consumer is idempotent and the index can be rebuilt',
          'Asynchronous copies never go stale',
          'The rename must be rolled back',
        ],
        answer: 1,
        explanation:
          'An asynchronous copy is eventually consistent: it scales well and is briefly behind. That is the trade chosen, so it should be documented, not treated as a failure. The search document is derived data, so if it ever drifts further it can be rebuilt from the source.',
      },
      {
        id: 'denorm-9',
        prompt:
          'To save a join, a team copies author_name into every post and drops the name column from users. A year later nobody can say what an author is actually called. What went wrong?',
        options: [
          'Nothing - the posts hold the name',
          'The join should have been cached instead',
          'The posts needed an index on author_name',
          'The copy became the only copy - a second source of truth that can no longer be rebuilt from anything',
        ],
        answer: 3,
        explanation:
          'Safe denormalisation is derived data: you can delete it and recompute it from the source. Removing the source turns the copies into competing originals, and after one partial rename they disagree forever. "The posts hold the name" is the tempting answer, but which of the posts?',
      },
      {
        id: 'denorm-10',
        prompt:
          'You move orders to a key-value store without joins. The app needs "orders by customer" and "orders by product". What is the usual design?',
        options: [
          'Write each order into two tables, one keyed by customer and one by product, and accept keeping them in sync',
          'Run a join in the application for every request by scanning all orders',
          'Store only by customer and scan for product queries',
          'Store only one table and add a secondary index on every column',
        ],
        answer: 0,
        explanation:
          'Without joins, denormalisation is the data model: each access path gets its own copy of the data, and keeping them in agreement is accepted up front. Scanning all orders is the tempting fallback, and it grows with the whole dataset on every request.',
      },
      {
        id: 'denorm-11',
        prompt:
          'A dashboard aggregates 50 million rows on every request. The business is fine with numbers up to 5 minutes old. What fits best?',
        options: [
          'Run the aggregate on every request, on a bigger machine',
          'Copy the totals into every row of the source table',
          'A materialised view refreshed every 5 minutes',
          'Remove the dashboard',
        ],
        answer: 2,
        explanation:
          'A materialised view stores the query result and is refreshed on command, so reads are cheap and the source stays the only truth. Its data is as old as the last refresh, which the 5-minute budget allows. Copying totals into every row creates many copies to keep in sync for one screen.',
      },
      {
        id: 'denorm-12',
        prompt:
          'A viral post gets 3,000 likes per second, and each like updates posts.like_count in the same transaction as the insert. Like requests start queueing. Why, and what is a common fix?',
        options: [
          'The likes table is too big - partition it',
          'Every transaction waits for the lock on the same counter row; buffer the increments and apply them asynchronously in batches, and reconcile from the likes table',
          'The count column is the wrong type',
          'Retries are too aggressive',
        ],
        answer: 1,
        explanation:
          'The same transaction is the safest sync, but it serialises every writer on one hot row. Batching increments asynchronously removes the contention at the price of a short staleness window, and the reconciliation job keeps it honest. Partitioning likes is tempting but the lock is on the posts row, not on likes.',
      },
    ],
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
    lab: 'connection-pool',
    keywords: ['pgbouncer', 'max connections', 'acquire timeout', 'pool exhaustion', 'hikaricp'],
    what: 'A connection pool keeps a bounded set of established database connections and lends them to requests, instead of creating a new connection each time.',
    why: 'Database connections are expensive: opening one costs handshakes worth tens of milliseconds, and in Postgres each one is a server process with its own memory. Ten app servers opening 100 connections each will exhaust a database that happily serves the same traffic through 40 pooled connections.',
    how: [
      'Open the connections once and lend one to each request for the length of its query or transaction, then take it back.',
      'Size the pools from the database, not from the request rate: start the total near (database cores x 2) + disk spindles - often 10 to 30 - and tune by measuring.',
      'Multiply pool size by instance count: the total across all instances must stay under max_connections, with headroom for admin access.',
      'Set a short acquire timeout so a saturated pool fails fast instead of making requests wait 30 seconds or forever.',
      'Use an external pooler (PgBouncer) when you have many application instances or serverless functions.',
    ],
    when: [
      'Any application that talks to a relational database more than a few times a second.',
      'Any application tier that scales horizontally in front of one database - that is where the connection multiplier bites.',
    ],
    advantages: [
      'Each query skips the connection setup, often several times longer than the query itself.',
      'The pool caps how many queries reach the database at once - backpressure that keeps it responsive.',
      'The connection count on the database stays predictable as traffic changes.',
    ],
    diagram: `10 app servers x 100 connections = 1000 -> database max_connections 200  ->  refused

With pooling: 10 servers x 20 = 200, requests queue briefly inside the app
With PgBouncer: thousands of client connections multiplexed onto ~40 server connections`,
    tradeoffs: [
      {
        approach: 'No pool (connect per request)',
        gains: ['Simplest code, no pool settings to tune', 'No idle connections held on the database'],
        costs: [
          'Every request pays the connection setup (~25 ms) before its query',
          'Nothing caps connections, so a slow database is flooded until it refuses new ones',
        ],
      },
      {
        approach: 'Small pool (close to cores x 2 in total)',
        gains: ['Database stays responsive', 'Queueing happens in the app, where it is visible and can time out'],
        costs: ['Requests wait for a connection under burst', 'Needs an acquire timeout and an alert on wait time'],
      },
      {
        approach: 'Large pool',
        gains: ['No waiting in the application while the database still has headroom'],
        costs: [
          'Database context-switches and contends for locks; latency collapses for everyone at saturation',
          'Easy to pass max_connections when the instance count grows',
        ],
      },
      {
        approach: 'External pooler (PgBouncer)',
        gains: [
          'Thousands of client connections share a few dozen server connections',
          'Database connections stop multiplying with instance count',
        ],
        costs: [
          'One more hop and one more component to run redundantly',
          'Transaction mode breaks session features: SET, LISTEN, session advisory locks',
        ],
      },
    ],
    mistakes: [
      'Autoscaling the app tier without accounting for the connection multiplier.',
      'Raising the pool size to fix slow requests when the database is already at what its cores can do.',
      'Infinite or very long acquire timeouts, turning a slow database into a fully stalled service.',
      'Holding a connection (often inside a transaction) across a call to an external service.',
      'Leaking connections on error paths, so the pool slowly empties until every request hangs.',
    ],
    related: ['horizontal-scaling', 'backpressure', 'bulkhead', 'serverless', 'read-replicas'],
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
          'Pool size multiplies by instance count: 4 x 20 = 80 connections became 20 x 20 = 400 against a max_connections of 200. The load balancer holds sockets to the API instances, not to the database, so it cannot be the cause. Size pools with the maximum fleet in mind, or put a shared pooler in front of the database.',
      },
      {
        id: 'cp-2',
        prompt:
          'In the Lab at 1,200 req/s with 5 ms queries, p95 is about 5 ms. You switch the pool off and p95 jumps to about 30 ms, although the database is nowhere near busy. Where did the extra 25 ms go?',
        options: [
          'The database runs each query slower when it is not pooled',
          'Requests now wait in a queue inside the app',
          'Each request first opens a new connection: TCP, TLS and auth handshakes plus a new backend process',
          'Without a pool the database has to parse every query twice',
        ],
        answer: 2,
        explanation:
          'Without a pool, connection setup happens on every request, and it costs several times the 5 ms query. There is no queue in the app when the pool is off - every request connects at once - so waiting in the app is the tempting but wrong reading. A pool pays the setup once and reuses the connection.',
      },
      {
        id: 'cp-3',
        prompt:
          'An API reports p99 of 9 seconds. The database shows 4 ms average query time and 20% CPU. Each instance has a pool of 10. What do you measure first?',
        options: [
          'How long requests wait to acquire a connection from the pool',
          'Which query is missing an index',
          'Whether the database needs a bigger machine',
          'Whether max_connections on the database is too low',
        ],
        answer: 0,
        explanation:
          'A calm database with slow requests points at the waiting before the query, not the query itself. Pool exhaustion shows up as latency in the app while the database looks idle. An index or a bigger machine speeds up work the database is barely doing, so it would not touch 9 seconds.',
      },
      {
        id: 'cp-4',
        prompt:
          'In the Lab, queries slow from 5 to 20 ms and requests start timing out. A teammate raises each of the 4 pools from 5 to 50 connections. Throughput falls and every query gets slower. Why?',
        options: [
          'Pools of 50 still are not enough for this load',
          'The acquire timeout is now too short',
          'Each new connection has to repeat the TLS handshake',
          'About 200 queries now run at once on 8 cores; they context-switch and fight over locks, so the database does less work',
        ],
        answer: 3,
        explanation:
          'The database works best with roughly 2 x its cores in flight. Letting 200 in only adds contention - the Lab shows most of its work lost - so fewer connections serve more requests. A bigger pool looks like the fix for waiting, but here the bottleneck is the database, and the waiting belongs in the app.',
      },
      {
        id: 'cp-5',
        prompt:
          'In the Lab, each of 4 instances has a pool of 1 connection. Requests hit the acquire timeout, while the database shows only 4 queries in flight against a best of about 16. What helps?',
        options: [
          'Shrink the pool further to protect the database',
          'Raise the pool size a little, since the database has room for more parallel work',
          'Raise the acquire timeout to 30 seconds',
          'Switch the pool off',
        ],
        answer: 1,
        explanation:
          'Here the pool, not the database, is the bottleneck: 4 connections cannot carry the load, and the database is under-used. Raising the pool to a total near 16 lets it work in parallel. A longer timeout only makes requests wait longer before failing, and switching the pool off adds connection setup to every request.',
      },
      {
        id: 'cp-6',
        prompt:
          'The database slows down for a minute. Your pool uses the library default acquire timeout of 30 seconds. What happens to the API, and what should you change?',
        options: [
          'Nothing happens: requests fail fast on their own',
          'The pool opens extra connections past its maximum to absorb the burst',
          'Requests pile up waiting up to 30 seconds each, holding threads and memory until the whole API stalls; set a short timeout so they fail fast',
          'The database cancels the slow queries for you',
        ],
        answer: 2,
        explanation:
          'A request waiting for a connection still holds a thread and memory in the app. With 30 seconds of patience the backlog grows until the whole service stops. A short acquire timeout turns the stall into fast errors the caller can handle. A pool never grows past its maximum - that cap is the point of it.',
      },
      {
        id: 'cp-7',
        prompt:
          'You move an API to serverless functions. At peak 2,000 run at once, each opening its own connection, and Postgres refuses them. What is the usual fix?',
        options: [
          'Put an external pooler such as PgBouncer between the functions and the database',
          'Raise max_connections to 2,000',
          'Give each function a pool of 10 connections',
          'Add a read replica',
        ],
        answer: 0,
        explanation:
          'Functions cannot share an in-process pool, so a shared pooler multiplexes their many client connections onto a few dozen server connections. Raising max_connections to 2,000 means 2,000 backend processes contending for a handful of cores, and a pool per function multiplies the problem by 10.',
      },
      {
        id: 'cp-8',
        prompt:
          'After putting PgBouncer in transaction mode in front of the database, a feature that runs SET search_path once per session starts reading the wrong schema at random. Why?',
        options: [
          'PgBouncer rewrites SQL statements',
          'The database lost the setting in a restart',
          'search_path is not supported by Postgres behind a proxy',
          'Each transaction may run on a different server connection, so session state set on one is not there on the next',
        ],
        answer: 3,
        explanation:
          'Transaction mode lends a server connection for one transaction only. Session state - SET, LISTEN, session advisory locks - stays on whichever server connection ran it. PgBouncer does not rewrite SQL; the fix is to set the value inside each transaction (SET LOCAL) or use session mode for that client.',
      },
      {
        id: 'cp-9',
        prompt:
          'One endpoint opens a transaction, calls a payment provider that takes 5 seconds, then commits. Under traffic, every other endpoint gets slow. What is going on?',
        options: [
          'The payment provider is rate limiting the other endpoints',
          'Each payment request holds a pooled connection for the whole external call, so the pool empties and everything else waits',
          'The transaction locks every table in the database',
          'The database is overloaded by the payment queries',
        ],
        answer: 1,
        explanation:
          'A connection held across a network call you do not control is idle for the database but unavailable to the pool. Ten slow calls occupy a pool of 10. Move the call outside the transaction, or give that endpoint its own small pool (a bulkhead). The database is not busy at all, so it is not overloaded.',
      },
      {
        id: 'cp-10',
        prompt:
          'Every morning the first few queries fail with "connection reset", then everything works. At night the app is idle for hours. What is the likely cause?',
        options: [
          'The database restarts every night',
          'The pool is too small for the morning traffic',
          'A firewall dropped the idle connections, and the pool handed out dead ones; set a max lifetime shorter than the idle timeout',
          'The acquire timeout is too short',
        ],
        answer: 2,
        explanation:
          'Firewalls and load balancers silently drop idle TCP connections. The pool does not know, and the first borrower gets an error. Recycling connections before the network idle timeout (max lifetime) and checking a connection on borrow removes this class of error. A small pool would cause waiting, not resets.',
      },
      {
        id: 'cp-11',
        prompt:
          'After a few hundred errors from one code path, every request hangs, and the pool reports 0 idle connections while the database shows almost nothing running. What happened?',
        options: [
          'A leak: that code path acquires a connection and never releases it when it throws',
          'The database crashed',
          'Traffic suddenly grew',
          'The pool shrank to save memory',
        ],
        answer: 0,
        explanation:
          'Connections that are borrowed and never returned drain the pool one error at a time, and the database sees them as idle. More traffic would show queries running. Use the scoped block of the framework (try-with-resources, a context manager) so the release happens even on an exception.',
      },
      {
        id: 'cp-12',
        prompt:
          'The database has 16 cores and SSD storage, max_connections is 200, and the API runs on 6 instances. Which pool size per instance is a sensible starting point?',
        options: [
          '100 per instance, to be safe',
          '50 per instance, so bursts never wait',
          '33 per instance, which is 198 in total, just under the limit',
          'About 5 per instance, around 30 in total',
        ],
        answer: 3,
        explanation:
          'The (cores x 2) + spindles starting point, about 33 here, is for the database total, not for each instance. 6 x 5 = 30 keeps the database near what its cores can use. 33 per instance fits under max_connections, but lets about 200 queries contend for 16 cores - fitting under the limit is not the same as being fast. 50 or 100 per instance (300 or 600 in total) pass max_connections outright.',
      },
    ],
  },
];
