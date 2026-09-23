import type { DepthMap } from './types';

export const patternsDepth: DepthMap = {
  'fan-out': {
    analogy: {
      title: 'Posting the same letter to a mailing list',
      body:
        'You can write one letter and copy it to ten thousand addresses now, so every recipient finds it waiting when they check. Or you can keep one copy and let people come and read it when they want. The first is expensive at writing time, the second at reading time - and which is cheaper depends entirely on how many people ever read it.',
    },
    deepDive: [
      {
        heading: 'Fan-out on write versus fan-out on read',
        paragraphs: [
          'Fan-out on write means doing the distribution at the moment something is created: when a user posts, the post is written into the feed of every follower. Reads then become a single cheap lookup, which is why timelines feel instant. The cost is at write time and it is proportional to the number of followers.',
          'Fan-out on read means storing the post once and assembling each feed on demand by querying the people a user follows. Writes are trivial, reads are expensive, and the expense is proportional to how many accounts a user follows.',
          'The choice is a straightforward read/write ratio question - except for the tail. An account with fifty million followers makes fan-out on write catastrophic: one post becomes fifty million writes, and if that account posts frequently the system never catches up.',
        ],
        code: {
          caption: 'The arithmetic, and why hybrids exist',
          body: `typical user, 200 followers, 5 posts/day
  on write:  5 x 200 = 1,000 timeline writes/day
             each feed read = 1 lookup of a built list
  on read:   5 writes/day, one row per post
             each feed read merges every account the
             reader follows (say 200 queries)

celebrity, 50,000,000 followers, 20 posts/day
  on write:  1,000,000,000 writes/day for ONE account
  on read:   20 writes, and their posts are read anyway

HYBRID (what real systems do)
  normal users -> fan-out on write
  celebrities  -> fan-out on read, merged in at read time`,
        },
      },
      {
        heading: 'The hybrid, and the other meaning of fan-out',
        paragraphs: [
          'Large social platforms use a threshold: accounts below some follower count are pushed into follower timelines at write time, accounts above it are pulled at read time and merged. A feed read becomes "my precomputed timeline, plus recent posts from the few celebrities I follow, merged by time". Twitter described this design publicly: home timelines held in an in-memory cache, pushed for most accounts, with the largest accounts merged in at read time. It is more code, and it is what lets one system serve both ends of the follower distribution.',
          'Fan-out also has a second, simpler meaning: one request triggering several parallel calls. A page that needs profile, orders, recommendations and notifications fans out to four services and merges the responses. Here the concern is different - latency is the slowest branch, and availability is the product of all of them.',
          'For that second kind, the important discipline is per-branch timeouts and partial results. If recommendations are slow, the page should render without them rather than waiting. Treating every branch as mandatory turns four services at 99.9 percent into a page at 99.6 percent for no product reason.',
        ],
        bullets: [
          'Read-heavy with modest fan-out -> precompute on write.',
          'Write-heavy or extreme fan-out -> assemble on read.',
          'Mixed distribution -> hybrid with a follower threshold.',
          'For parallel request fan-out: per-branch timeouts, partial responses, and a budget for the slowest branch.',
        ],
      },
      {
        heading: 'What precomputing costs you besides writes',
        paragraphs: [
          'Storage multiplies. One post stored in a million timelines is a million references, and while each is small, the total across a large user base becomes a serious cost. Most systems bound it by keeping only recent entries per timeline (Twitter kept 800 per home timeline) and falling back to a query for older pages.',
          'Deletion and editing become fan-out operations too. Removing a post means removing it from every timeline it was written into, which is the same expensive operation again - and it must be reliable, because a deleted post still appearing is a serious problem.',
          'And a new follower has an empty relationship until it is backfilled. Following someone must either trigger a backfill of their recent posts into your timeline, or the read path must merge recent posts for recently followed accounts. Both are extra machinery that the on-read approach never needs.',
        ],
      },
    ],
    examples: [
      {
        title: 'Designing a feed that survives a celebrity',
        setup:
          'A social product with 10 million users. Median follower count is 150; the largest account has 8 million followers.',
        walkthrough: [
          'Pure fan-out on write: the top account posting once creates 8 million timeline writes. At 20 posts a day that is 160 million writes from one user, dwarfing everything else.',
          'Pure fan-out on read: a typical user follows about 150 accounts, so every feed load runs 150 queries and merges them. At 50,000 feed loads per second that is 7.5 million queries per second - also infeasible.',
          'Hybrid: accounts with fewer than 10,000 followers fan out on write. Above that, posts are pulled at read time.',
          'A feed read becomes: read my precomputed timeline (one lookup), then fetch recent posts from the celebrities I follow (usually fewer than 20 accounts, cached aggressively), then merge by timestamp.',
          'Celebrity posts are cached in memory, since millions of people read exactly the same few posts, so each pull is cheap.',
          'Deletion: for pushed posts, a background job removes them from timelines; for pulled posts, deletion is immediate since there is only one copy.',
          'New follow: a backfill job inserts the last 50 posts of the followed account into the timeline, unless that account is a celebrity, in which case nothing is needed.',
        ],
        result:
          'Neither pure strategy worked, because the follower distribution has a long tail. The threshold hybrid is the standard answer, and it exists entirely because of the extremes.',
      },
    ],
    jargon: [
      { term: 'Fan-out on write', plain: 'Pushing an item into every recipient view at creation time.' },
      { term: 'Fan-out on read', plain: 'Assembling a view on demand by querying sources.' },
      { term: 'Hybrid fan-out', plain: 'Push for ordinary accounts, pull for very large ones.' },
      { term: 'Backfill', plain: 'Populating a timeline retroactively, for example after a new follow.' },
      { term: 'Scatter-gather', plain: 'The request version of fan-out: parallel calls merged into one response.' },
      { term: 'Write amplification', plain: 'One logical action producing very many physical writes.' },
    ],
    remember: [
      'Fan-out on write buys fast reads and pays at write time, proportional to followers.',
      'Fan-out on read is cheap to write and expensive to read, proportional to what you follow.',
      'Extreme accounts break the pure strategies - hybrids exist because of the tail.',
      'Precomputing also makes deletion, editing and new follows into fan-out operations.',
      'For parallel request fan-out, use per-branch timeouts and return partial results.',
    ],
  },

  backpressure: {
    analogy: {
      title: 'A funnel that will not accept more than it can pour',
      body:
        'If you pour faster than the neck allows, the funnel overflows and you lose liquid on the floor. The disciplined approach is to pour at the rate the neck can take, and if the source cannot slow down, to catch the excess in a bucket of a known size - and to know what you will do when the bucket is full.',
    },
    deepDive: [
      {
        heading: 'Producers must learn the consumer rate',
        paragraphs: [
          'Backpressure is the signal that travels upstream to say "slow down". Without it, a fast producer and a slow consumer end one of three ways: an unbounded buffer that consumes all memory and crashes, dropped data, or a system that grinds to a halt with everything queued and nothing completing.',
          'The signal can be explicit or implicit. TCP does it with a receive window. A blocking queue does it by making the producer wait when it is full. HTTP does it with 429 and 503 responses. Reactive streams do it with an explicit request(n) protocol where the consumer states how much it can take.',
          'The key design decision is that buffers must be bounded. An unbounded queue looks like it is absorbing a spike and is actually deferring a crash - and when the crash comes, you lose everything in the buffer rather than the small amount you would have rejected early.',
        ],
        code: {
          caption: 'Four responses when the buffer is full',
          body: `BLOCK      producer waits            simplest; can deadlock if circular
DROP       discard new (or oldest)   fine for metrics, telemetry, video
REJECT     return 429 / error        fits request-response APIs
SPILL      write to disk             more capacity, higher latency, bounded eventually

choose per data type:
  metrics sample      -> drop, nobody notices
  user order          -> reject, tell them honestly
  log line            -> drop or spill
  video frame         -> drop the frame, keep the stream live`,
        },
      },
      {
        heading: 'Queues hide the problem until they do not',
        paragraphs: [
          'A queue is the standard way to absorb bursts, and it works beautifully for short spikes. What it cannot do is fix a sustained rate mismatch: if arrivals exceed processing capacity on average, the queue grows without bound and latency grows with it. The queue converted an error into a delay, and eventually the delay is worse than the error would have been.',
          'So monitor the right thing. Queue depth alone is ambiguous; age of the oldest message tells you the actual delay a user is experiencing. A queue holding 100,000 messages that drains in 20 seconds is healthy; one holding 500 that has not moved in ten minutes is an incident.',
          'And decide what happens at capacity, before it happens. Rejecting new work with a clear error, shedding low-priority work to protect high-priority work, or degrading to a simpler response are all better than silently accumulating a backlog that nobody notices until customers do.',
        ],
        bullets: [
          'Every queue and every buffer must have a maximum size.',
          'Alert on oldest-message age, not only on depth.',
          'A queue absorbs bursts; it cannot fix a sustained rate mismatch.',
          'Decide the full-buffer policy per data type: block, drop, reject or spill.',
        ],
      },
      {
        heading: 'Load shedding: choosing what to lose',
        paragraphs: [
          'When a system is beyond capacity, the honest choice is to serve some requests well rather than all of them badly. Load shedding drops work deliberately - and the important part is choosing which work. Health checks and paying customers should survive; bulk exports and analytics can be dropped first.',
          'Implement it as an admission decision at the edge: if the concurrency or the queue wait exceeds a threshold, return 503 immediately with Retry-After rather than accepting a request you cannot complete in time. Fast rejection preserves capacity; slow acceptance destroys it.',
          'Timeouts play the same role internally. A request that has already exceeded its deadline should be abandoned rather than completed, because nobody is waiting for the answer any more. Continuing to process work whose client has given up is a surprisingly common way for an overloaded system to stay overloaded.',
        ],
      },
    ],
    examples: [
      {
        title: 'The unbounded queue that turned a spike into an outage',
        setup:
          'An ingestion service accepts events and writes them to a database. It uses an in-memory queue with no size limit. Traffic spikes to 5 times normal for 10 minutes.',
        walkthrough: [
          'Arrivals: 50,000 events per second. Database capacity: 10,000 per second. The queue grows by 40,000 per second.',
          'After 10 minutes the queue holds 24 million events and the process has consumed 12 GB of memory.',
          'The process is killed by the out-of-memory killer. Every queued event is lost - 24 million of them, including the ones that would have been processed fine.',
          'On restart, the backlog of retries from clients arrives at once and the cycle repeats.',
          'Fix 1: bound the queue at 100,000 events. Beyond that, return 429 with Retry-After. Clients back off and retry; nothing is lost silently.',
          'Fix 2: alert on queue depth above 50 percent and on oldest-message age above 30 seconds, so the mismatch is visible before it matters.',
          'Fix 3: shed by priority - drop analytics events first and keep transactional ones, so the loss falls where it costs least.',
          'Fix 4: persist the queue instead of holding it in memory, so a restart does not lose what was accepted.',
        ],
        result:
          'The unbounded queue did not add capacity; it converted a manageable rejection into total loss plus an outage. Bounded buffers with an explicit full-buffer policy are what make overload survivable.',
      },
    ],
    jargon: [
      { term: 'Backpressure', plain: 'The signal upstream that says slow down.' },
      { term: 'Bounded buffer', plain: 'A queue with a maximum size. The alternative is a deferred crash.' },
      { term: 'Load shedding', plain: 'Deliberately dropping work to protect the rest.' },
      { term: 'Admission control', plain: 'Deciding at the edge whether to accept a request at all.' },
      { term: 'Oldest-message age', plain: 'How long the oldest queued item has waited. The honest backlog metric.' },
      { term: 'Deadline propagation', plain: 'Passing the remaining time budget down so expired work is abandoned.' },
    ],
    remember: [
      'Every buffer must be bounded - an unbounded queue is a deferred crash.',
      'A queue absorbs bursts but cannot fix a sustained rate mismatch.',
      'Choose the full-buffer policy per data type: block, drop, reject or spill.',
      'Reject fast rather than accepting work you cannot finish in time.',
      'Alert on oldest-message age; depth alone tells you very little.',
    ],
  },

  bulkhead: {
    analogy: {
      title: 'Watertight compartments in a ship',
      body:
        'A hull divided into sealed sections means a breach floods one compartment and the ship stays afloat. Without the dividers, a single hole sinks everything. The compartments cost space and make movement awkward - and that is exactly the trade you make when you partition resources by dependency.',
    },
    deepDive: [
      {
        heading: 'Partition the resource that everything competes for',
        paragraphs: [
          'The failure this prevents is resource monopolisation. One slow dependency causes requests to it to pile up, each holding a thread or a connection, until the shared pool is exhausted - and then every other feature fails too, including ones that never touch the slow dependency.',
          'The arithmetic is short. Threads in use = calls per second x seconds each call holds its thread. Recommendations at 100 calls a second and 50 ms each holds 5 threads. When it hangs for 30 seconds, the same traffic wants 3,000 threads, and a pool of 200 is gone in 2 seconds.',
          'A bulkhead caps how much of a shared resource any one dependency may consume. Twenty of two hundred threads for the recommendations service means recommendations can be completely dead and one hundred and eighty threads remain available for everything else. When its twenty are busy, further recommendation calls are rejected at once and the page is shown without them. The recommendations feature fails; the product does not.',
          'The resources worth partitioning are the ones that are finite and shared: worker threads, database connections, concurrent outbound requests, memory buffers. Whichever of them saturates first is the one that transmits a failure from one feature to all of them.',
        ],
        code: {
          caption: 'Same fleet, with and without compartments',
          body: `SHARED POOL (200 threads)
  recommendations hangs for 30 s, 100 calls/s
  -> within 2 s all 200 threads wait on it
  -> checkout, search and profile all fail
  a non-critical feature took down the product

BULKHEADS
  checkout          80 threads   unaffected
  search            60 threads   unaffected
  recommendations   20 threads   full, fails fast, fallback
  other             40 threads   unaffected
  the failure is contained to its compartment`,
        },
      },
      {
        heading: 'Levels of isolation, from cheap to expensive',
        paragraphs: [
          'The cheapest form is a semaphore or a concurrency limit per dependency inside one process: a few lines, no new infrastructure, and it prevents the most common cascade. The calling thread still makes the call itself, though, so it cannot walk away from a slow call - it waits until the client timeout. Separate thread pools go further: the call runs on a pool thread, so the caller can stop waiting and keep its own thread, at the cost of queueing, context switching and more tuning. Netflix measured that cost at a few milliseconds at the 99th percentile.',
          'Separate process pools are the next step: run the endpoints that use a risky dependency on their own instances, so even a memory leak or a crash is contained. Deployment-level isolation - separate services, separate clusters, separate cells per customer segment - is the strongest and the most expensive.',
          'Cell-based architecture is the extreme version, and it is what large platforms use: the system is divided into independent cells, each serving a subset of customers with its own full stack. A failure affects one cell rather than everyone, which turns a total outage into a partial one by construction.',
        ],
        bullets: [
          'Concurrency limit per dependency - cheapest, catches the common case.',
          'Separate thread pools - isolates blocking, needs tuning.',
          'Separate instances for risky endpoints - isolates crashes and memory.',
          'Cells per customer segment - isolates everything, at the highest cost.',
        ],
      },
      {
        heading: 'Sizing, and how it combines with the other patterns',
        paragraphs: [
          'Size each compartment by its normal concurrency plus headroom, not by an even split. The Hystrix guideline is peak calls per second when healthy x p99 latency in seconds, plus some breathing room: 50 calls a second at 200 ms is about 10 threads. If checkout normally has 40 concurrent requests and recommendations has 5, equal shares starve checkout and still let recommendations take more than it should. Measure first, then allocate.',
          'When a compartment is full, fail fast. Resilience4j defaults the wait for a bulkhead slot to zero: a caller that waits is itself holding a thread, so a long wait rebuilds the pile-up one layer up.',
          'Bulkheads pair naturally with timeouts and circuit breakers, and each does a different job. The timeout bounds how long one call may hold its slot. The bulkhead bounds how many slots that dependency may occupy. The circuit breaker stops calling it at all once it is clearly down. Together they turn a dependency failure into a fast, contained, non-propagating event.',
          'The cost is genuine: partitioned resources are less efficiently used, because one compartment can be idle while another queues. That inefficiency is the insurance premium, and it is almost always worth paying on a shared request path.',
        ],
      },
    ],
    examples: [
      {
        title: 'Isolating a report endpoint that kept taking down the API',
        setup:
          'One API process serves both fast lookups (20 ms) and report generation (3-8 seconds). Reports are 2 percent of traffic. Every peak causes total API failure.',
        walkthrough: [
          'With 200 workers and about 6 report requests per second at 5 seconds each, reports occupy roughly 30 workers permanently - and during a peak, far more.',
          'When reports slow to 20 seconds, they occupy 120 workers, and the fast lookups queue behind them despite needing 20 ms each.',
          'Fix 1 (cheapest): a semaphore limiting reports to 25 concurrent executions. Beyond that, return 429 with a retry hint. Fast traffic is protected immediately.',
          'Fix 2: route /reports to a separate instance group via the load balancer. Now even a crash or a memory spike in reporting cannot affect the main API.',
          'Fix 3 (structural): make report generation asynchronous - the request enqueues a job and returns a job id, and the user collects the result when it is ready.',
          'Fix 4: separate database connection pools, so reporting queries cannot exhaust the connections the fast path needs.',
        ],
        result:
          'A one-line concurrency limit removed the outages the same day; the async redesign removed the problem entirely. Bulkheads are the fastest mitigation available while the structural fix is built.',
      },
    ],
    jargon: [
      { term: 'Bulkhead', plain: 'A resource partition so one dependency cannot consume everything.' },
      { term: 'Semaphore / concurrency limit', plain: 'A cap on simultaneous calls to one dependency.' },
      { term: 'Resource monopolisation', plain: 'One slow dependency occupying the whole shared pool.' },
      { term: 'Cell-based architecture', plain: 'Independent full stacks each serving a subset of customers.' },
      { term: 'Blast radius', plain: 'How far one failure spreads. The thing bulkheads shrink.' },
      { term: 'Thread pool isolation', plain: 'Separate pools per dependency so blocking is contained.' },
    ],
    remember: [
      'One slow dependency exhausting a shared pool is how a small failure becomes total.',
      'Cap concurrency per dependency - it is a few lines and prevents the common cascade.',
      'Size compartments from measured concurrency, not by even splits.',
      'Combine with timeouts and circuit breakers; each does a different job.',
      'The wasted capacity is the premium you pay for containment.',
    ],
  },

  'saga-pattern': {
    analogy: {
      title: 'A booked trip you have to unbook step by step',
      body:
        'You book a flight, a hotel and a car. If the car is unavailable, there is no universal undo - you cancel the hotel and cancel the flight, each with its own procedure and possibly its own fee. A saga is exactly that: a sequence of committed steps, each with a defined way to be compensated when a later one fails.',
    },
    deepDive: [
      {
        heading: 'No rollback exists across services, so you write the undo',
        paragraphs: [
          'A local transaction can roll back because one database controls all the changes. Once a business operation spans several services with their own databases, each step commits independently - and once committed, it is visible to everyone. There is nothing to roll back to.',
          'A saga accepts that and adds compensating transactions: for each step, a defined action that semantically undoes it. Reserve stock is compensated by release stock. Charge card is compensated by refund. Note that compensation is not reversal - a refund does not erase the charge, it adds an opposing entry, and the customer saw both.',
          'That visibility is the real conceptual shift. Intermediate states are observable: an order can exist while its payment is still pending, and a customer may see a charge that is refunded ten seconds later. The product has to be designed for those states rather than pretending they do not exist.',
        ],
        code: {
          caption: 'Steps and their compensations, defined together',
          body: `step                    compensation
1 reserve stock         release stock
2 charge card           refund payment
3 create shipment       cancel shipment
4 send confirmation     send cancellation notice  (cannot unsend!)

failure at 3 -> compensate 2, then 1, in reverse order

rules
  every compensation must be idempotent (it will be retried)
  compensations can fail too -> retry, then alert a human
  put irreversible steps LAST, so there is less to undo`,
        },
      },
      {
        heading: 'Choreographed or orchestrated',
        paragraphs: [
          'A choreographed saga has each service react to events and emit the next one, with compensation triggered by failure events. It is loosely coupled and it has no central component - and the workflow exists nowhere, so understanding the process means reading every participant and inferring the order.',
          'An orchestrated saga has a coordinator that issues commands, tracks progress and drives compensation. The process is written in one place, testable, visible, and resumable after a crash if its state is persisted. The cost is a component that knows about every participant and must be highly available.',
          'Neither is free. Choreography suits short flows with few participants: there is nothing extra to run, and each service knows only the events it reacts to. As steps and compensations pile up, the orchestrator earns its cost - the sequence sits in one place and a stalled saga has an owner - and durable execution engines such as Temporal or AWS Step Functions exist to run exactly this kind of orchestrator.',
        ],
        bullets: [
          'Few services, a short chain, little to undo -> choreography keeps the moving parts down.',
          'Many ordered steps with compensations, or a lifecycle to inspect -> orchestration.',
          'Persist the saga state so a crash resumes rather than restarts.',
          'Every step and every compensation must be idempotent.',
        ],
      },
      {
        heading: 'The hard parts: irreversibility and partial failure',
        paragraphs: [
          'Some actions cannot be compensated. An email has been read, a physical parcel has left the warehouse, an external API has published something. The design rule is to order steps so irreversible ones come last, after everything that might fail has already succeeded - and where that is impossible, to convert the action into something reversible, such as scheduling an email with a delay.',
          'Compensations fail too. The refund call can time out, the release-stock service can be down. So compensation needs its own retry with backoff, its own idempotency, and eventually a human escalation path - a queue of sagas that could not be completed or compensated, which somebody actually monitors.',
          'And isolation is absent. Unlike a database transaction, a saga lets other operations see intermediate state, which can produce genuinely incorrect business outcomes - stock reserved by a saga that will later be compensated is invisible to other customers in the meantime. Semantic locks (marking a record as pending) are the usual mitigation, and they must be designed deliberately.',
        ],
      },
    ],
    examples: [
      {
        title: 'An order saga, including the step that went wrong',
        setup:
          'Placing an order spans five services: order, inventory, payment, shipping and notification, each with its own database. Payment succeeds; shipping rejects the address.',
        walkthrough: [
          'Step 1: the Order service saves order 1042 as PENDING - a local transaction, visible at once.',
          'Step 2: inventory reserves 2 units. Marked as reserved with the saga id, not simply decremented - that is the semantic lock.',
          'Step 3: payment charges 89 euro, recording the saga id as the idempotency key.',
          'Step 4: shipping rejects the address as undeliverable. The saga now begins compensating steps 3, 2 and 1, in reverse.',
          'Compensate step 3: refund 89 euro, using the same saga id so a retry cannot refund twice. The customer sees a charge and a refund on their statement - an intermediate state the product must explain.',
          'Compensate step 2: release the 2 reserved units back to available stock.',
          'Compensate step 1: order 1042 goes from PENDING to REJECTED with the reason, and the customer is shown an address error rather than a generic failure.',
          'Step 5 (notification) was deliberately placed last and never ran, so no confirmation email had to be retracted.',
          'Failure inside compensation: if the refund call times out, it is retried with backoff; after 3 attempts the saga is placed in a manual review queue with an alert, because money is involved.',
        ],
        result:
          'The saga left the system consistent without any distributed transaction - at the cost of a visible charge and refund, a semantic lock on stock, and a human escalation path. Those costs are the honest price of splitting a transaction across services.',
      },
    ],
    jargon: [
      { term: 'Saga', plain: 'A sequence of local transactions with defined compensating actions.' },
      { term: 'Compensating transaction', plain: 'An action that semantically undoes a committed step.' },
      { term: 'Semantic lock', plain: 'Marking a record as pending so others do not act on unfinished state.' },
      { term: 'Pivot step', plain: 'The point after which the saga can only go forward, not compensate.' },
      { term: 'Orchestrated / choreographed', plain: 'A coordinator drives the steps, or services react to each other events.' },
      { term: 'Dead saga queue', plain: 'Sagas that could neither complete nor compensate, needing a human.' },
    ],
    remember: [
      'There is no rollback across services - you write the compensation yourself.',
      'Compensation is semantic, not erasure; intermediate states are visible to users.',
      'Every step and compensation must be idempotent, because all of them get retried.',
      'Order irreversible steps last, and mark pending state with semantic locks.',
      'Compensations fail too - plan retries and a human escalation path.',
    ],
  },

  'outbox-pattern': {
    analogy: {
      title: 'The out-tray on your desk',
      body:
        'You do not walk each letter to the post box as you write it - you file the record and drop the letter in the out-tray in one motion, and the post room collects the tray later. Either both happened or neither did. It is the only way to be certain that a recorded decision and its announcement cannot disagree.',
    },
    deepDive: [
      {
        heading: 'The dual write problem',
        paragraphs: [
          'A service that must save state and publish an event has two systems to update, and no way to commit both atomically. If it writes the database and then crashes, the event is never published and every downstream consumer is unaware. If it publishes first and the database write fails, consumers act on something that did not happen.',
          'Both failure modes are silent and both produce inconsistency that is discovered much later, usually by a customer. And they are not rare: any crash, deploy, timeout or network blip between the two operations produces one of them, which at any real volume means several per week.',
          'Two-phase commit would solve it and is generally unavailable - most message brokers, Kafka among them, do not join a database transaction out of the box, and where distributed transactions exist they are slow, and participants block while a failed coordinator is down. The outbox pattern is the practical alternative.',
        ],
        code: {
          caption: 'One transaction, two effects',
          body: `BEGIN
  INSERT INTO orders (id, customer, total) VALUES (...)
  INSERT INTO outbox (id, aggregate, type, payload, created_at)
         VALUES (..., 'order', 'OrderPlaced', '{...}', now())
COMMIT            -- both or neither. This is the whole idea.

then, separately:
  relay reads unsent outbox rows in order
  publishes to the broker
  marks them sent

crash after publish, before marking -> published twice
=> consumers MUST be idempotent. That is the accepted trade.`,
        },
      },
      {
        heading: 'Polling relay or change data capture',
        paragraphs: [
          'The simplest relay polls the outbox table for unsent rows every second, publishes them, and marks them sent. It needs no extra infrastructure, and it costs a query per interval plus some latency. Use SELECT ... FOR UPDATE SKIP LOCKED so several relay instances can run without publishing the same row twice.',
          'Change data capture reads the database write-ahead log directly - Debezium is the common implementation - and publishes changes as they are committed. No polling, lower latency, no load on the database from queries, and considerably more infrastructure to run and understand. Because the insert is already in the log, the outbox row can be deleted soon after it is written.',
          'Both preserve order per aggregate if you are careful: process outbox rows in insertion order and partition the published messages by aggregate id, so all events for one order stay in sequence even when overall throughput is parallel. With several polling relay instances, rows of one aggregate can be claimed by two instances at once, so either route one aggregate to one instance or accept a single active relay.',
        ],
        bullets: [
          'Polling relay: simple, no new systems, about a second of latency.',
          'CDC: lower latency and no query load, more infrastructure.',
          'SKIP LOCKED lets several relay instances work safely.',
          'Partition published messages by aggregate id to preserve per-entity order.',
          'Prune sent rows, or the outbox table grows without bound.',
        ],
      },
      {
        heading: 'What it guarantees and what it does not',
        paragraphs: [
          'It guarantees that an event exists for every committed state change, and that no event exists for a change that was rolled back. That is exactly the property the dual write lacked, and it is worth the extra table.',
          'It does not guarantee exactly-once delivery. The relay can publish and then crash before marking the row, so the same event is published again. Consumers must be idempotent - which they had to be anyway, since brokers redeliver.',
          'There is also an inbox counterpart on the consuming side: record processed message ids in the same transaction as the effect, so a redelivery is recognised and skipped. Outbox plus inbox gives you effectively-once processing across a system that only offers at-least-once delivery.',
        ],
      },
    ],
    examples: [
      {
        title: 'The orders that existed and the events that did not',
        setup:
          'An order service saves the order and then publishes OrderPlaced. Roughly 30 orders a week never reach the fulfilment service, and nobody knows why until customers complain.',
        walkthrough: [
          'Cause: the publish happens after the commit. Any crash, deploy or broker timeout in between loses the event permanently, while the order exists in the database.',
          'The reverse was also happening occasionally: publish first, then a constraint violation on commit, producing events for orders that do not exist.',
          'Fix: write the order and an outbox row in the same transaction. Nothing is published from the request path at all.',
          'A relay polls the outbox every 500 ms with SKIP LOCKED, publishes to Kafka partitioned by order id, and marks rows sent.',
          'Consumers are made idempotent by (order_id, event_type), so a republished event after a relay crash changes nothing.',
          'Monitoring: alert on the age of the oldest unsent outbox row. A stalled relay is now visible in seconds rather than discovered by customers.',
          'Housekeeping: sent rows older than 7 days are deleted nightly, keeping the table small enough to stay fast.',
        ],
        result:
          'Lost events went to zero, and the cost was one table, one relay process and idempotent consumers. The pattern is small, and it eliminates an entire category of silent inconsistency.',
      },
    ],
    jargon: [
      { term: 'Dual write', plain: 'Updating two systems without atomicity. The problem being solved.' },
      { term: 'Outbox table', plain: 'Events written in the same transaction as the state change.' },
      { term: 'Relay / publisher', plain: 'The process that reads unsent rows and publishes them.' },
      { term: 'CDC', plain: 'Change data capture: reading the database log to publish changes.' },
      { term: 'SKIP LOCKED', plain: 'A query clause letting several workers claim different rows safely.' },
      { term: 'Inbox pattern', plain: 'Recording processed message ids transactionally so duplicates are skipped.' },
    ],
    remember: [
      'You cannot atomically write to a database and a broker - the outbox makes it one transaction.',
      'A separate relay publishes from the table; nothing is published in the request path.',
      'Delivery is still at-least-once, so consumers must be idempotent.',
      'Partition by aggregate id to preserve per-entity ordering.',
      'Alert on the oldest unsent row, and prune sent rows regularly.',
    ],
  },

  'leader-follower': {
    analogy: {
      title: 'One person signs the cheques',
      body:
        'Anyone can read the accounts, but exactly one person is authorised to sign. That removes all argument about the order of transactions and who decided what. When they are away, somebody else is formally given the authority - a handover that must be unambiguous, because two signatories would be worse than none.',
    },
    deepDive: [
      {
        heading: 'One writer removes an entire class of problems',
        paragraphs: [
          'When a single node accepts all writes, there is no write conflict to resolve, no ordering ambiguity and no need for consensus on every operation. The leader decides the order, followers replay it, and everyone converges by construction. That simplicity is why the pattern is everywhere: relational databases, Kafka partitions, Redis, etcd, MongoDB replica sets.',
          'Followers serve reads, which scales the read path, and they double as failover candidates because they are already streaming the changes. So one arrangement gives read capacity, durability and a recovery path at once.',
          'The limits follow immediately: write throughput is capped by one machine, writes have to travel to wherever the leader is, and there is a gap during failover when no leader exists. Those three are the price of not having to solve conflict resolution.',
        ],
        code: {
          caption: 'The shape, and where each limit bites',
          body: `        writes
          |
       [LEADER] ---- replicate ----> [follower] reads
          |     \\---- replicate ----> [follower] reads
          |
   write capacity = ONE machine       <- sharding is the only fix
   write latency  = distance to leader <- regional leaders or local quorum
   failover gap   = detect + elect     <- seconds of write unavailability
   follower reads = possibly stale     <- read-your-writes routing needed`,
        },
      },
      {
        heading: 'Single-leader, multi-leader, leaderless',
        paragraphs: [
          'Single-leader is the default and the simplest to reason about. Multi-leader allows writes in several places - useful for multi-region deployments or offline-capable clients - and it reintroduces exactly the conflicts single-leader avoided, so it requires a merge strategy and is only worth it when local writes are genuinely required.',
          'Leaderless systems, in the Dynamo tradition, let any replica accept a write and use quorums to keep things consistent: write to W replicas, read from R, and if R plus W exceeds N the sets overlap so a read sees the latest write. Cassandra works this way, and it trades the simplicity of one writer for availability and tunable consistency.',
          'The practical guidance is to use single-leader unless a specific requirement forces otherwise - write availability during a partition, multi-region low-latency writes, or write throughput beyond one machine. Each alternative buys one of those at the cost of conflict handling you will then own.',
        ],
        bullets: [
          'Single-leader: simplest, one writer, the default for good reason.',
          'Multi-leader: local writes in several regions, and conflicts to merge.',
          'Leaderless with quorums: high availability, tunable consistency, no single writer.',
          'Sharding composes with all three: one leader per shard multiplies write capacity.',
        ],
      },
      {
        heading: 'The operational realities',
        paragraphs: [
          'Follower reads are stale by the replication lag, so any read immediately after a write needs routing to the leader or another read-your-writes mechanism. This is the single most common bug introduced when follower reads are enabled.',
          'The failover gap is unavoidable: detection plus election plus client redirection means seconds without a writable leader. Applications should treat write failures during that window as retryable rather than fatal, and queue or buffer where the product allows.',
          'And split brain must be prevented structurally. Quorum-based election ensures only one leader can be chosen, and fencing tokens ensure a deposed leader cannot continue to write. Without both, a leader that was merely slow rather than dead will happily keep accepting writes that nobody else has.',
        ],
      },
    ],
    examples: [
      {
        title: 'Scaling writes when one leader is not enough',
        setup:
          'A single-leader Postgres handles 40,000 writes per second at peak and is saturated. Read replicas are already in place and do not help.',
        walkthrough: [
          'First check: are these writes necessary? About 30 percent are analytics events that do not belong in the transactional database at all. Moving them to a separate store removes a third of the load in a week.',
          'Second: batching. Many writes are single-row inserts that can be grouped, cutting round trips and write-ahead log volume substantially.',
          'Third: vertical scaling and storage tuning buy another 50 percent of headroom, cheaply.',
          'When the limit is genuinely reached, shard by tenant id. Each shard has its own leader and its own followers - the pattern is unchanged, it is simply replicated N times.',
          'Write capacity now scales with shard count, because each leader handles only its own slice.',
          'Cost: cross-shard transactions disappear, cross-tenant reporting moves to a separate analytics path, and there are N clusters to operate.',
          'Note the sequence: three cheaper measures preceded sharding, and together they delayed it by more than a year.',
        ],
        result:
          'The leader-follower pattern does not scale writes; sharding it does. Removing unnecessary writes and batching the rest are what buy the time to do sharding properly.',
      },
    ],
    jargon: [
      { term: 'Leader / follower', plain: 'The node accepting writes, and the replicas that follow it.' },
      { term: 'Replication lag', plain: 'How far behind a follower is. The staleness of follower reads.' },
      { term: 'Multi-leader', plain: 'Several nodes accepting writes, with conflicts to resolve.' },
      { term: 'Leaderless / quorum', plain: 'Any replica accepts writes; overlapping read and write quorums keep it consistent.' },
      { term: 'Failover gap', plain: 'The window with no leader: detect, elect, redirect.' },
      { term: 'Fencing', plain: 'Preventing a deposed leader from continuing to write.' },
    ],
    remember: [
      'One writer removes conflicts and ordering problems - that is the whole appeal.',
      'It scales reads and durability, never write throughput.',
      'Follower reads are stale; route reads to the leader right after a write.',
      'Failover always costs a short write outage; make writes retryable.',
      'Sharding is what scales writes - one leader per shard.',
    ],
  },

  'producer-consumer': {
    analogy: {
      title: 'The pass in a kitchen',
      body:
        'Chefs put finished dishes on the pass; waiters take them away. Neither waits for the other, and either side can be faster for a while because the pass holds the difference. It only works because the pass has a size - when it is full, the chefs must slow down, and that constraint is a feature.',
    },
    deepDive: [
      {
        heading: 'Decoupling two rates through a buffer',
        paragraphs: [
          'The pattern separates the thing that creates work from the thing that performs it, with a buffer between them. Each side can scale, fail and be deployed independently, and short-term rate mismatches are absorbed rather than propagated.',
          'The buffer size is the design decision. Too small and producers block constantly, losing the decoupling benefit. Too large and problems are hidden for a long time - the queue grows, latency grows with it, and by the time anyone notices, the backlog takes hours to drain. Unbounded is worst of all, because it turns a rate mismatch into a memory exhaustion crash.',
          'This shape appears at every level: threads with an in-memory queue, processes with a broker, services with Kafka, and hardware with DMA buffers. The concerns are identical at each scale - bounded capacity, what happens when full, and how many consumers can work in parallel.',
        ],
        code: {
          caption: 'Scaling the two sides independently',
          body: `producers (N)  ->  [ bounded queue ]  ->  consumers (M)

throughput = min(producer rate, consumer rate)
  producers faster -> queue grows -> add consumers
  consumers faster -> queue empty -> consumers idle, that is fine

with M consumers, message ORDER is not preserved
  need order? partition by key, one consumer per partition
  need parallelism AND order? more partitions, same key rule`,
        },
      },
      {
        heading: 'Ordering, parallelism and the choice between them',
        paragraphs: [
          'Multiple consumers pulling from one queue process messages concurrently, so completion order is unpredictable. For independent work - resizing images, sending unrelated emails - that is entirely fine and is the point.',
          'When order matters, partition. All messages for one entity go to one partition, and one consumer owns that partition, so events for order 42 are strictly sequential while different orders proceed in parallel. Parallelism is then bounded by partition count, which is why partition count is a capacity decision.',
          'The alternative is making handlers order-independent: if applying updates in any order produces the same result, ordering stops mattering. Designing operations to be commutative and idempotent removes a whole class of constraints, and it is worth doing wherever the domain allows.',
        ],
        bullets: [
          'Independent work -> many consumers, no ordering guarantee, maximum throughput.',
          'Per-entity ordering -> partition by entity id, one consumer per partition.',
          'Global ordering -> a single consumer, and accept the throughput ceiling.',
          'Best of all -> make handlers commutative so order does not matter.',
        ],
      },
      {
        heading: 'Consumer concerns: acknowledgement, poison messages and scaling',
        paragraphs: [
          'Acknowledge after the work is durably done, never on receipt. Acknowledging early means a crash loses the message; acknowledging late means a crash redelivers it, which is the safe direction provided handlers are idempotent.',
          'A message that always fails will be redelivered forever, consuming capacity and potentially blocking a partition. Bound the attempts and route failures to a dead letter queue with the error attached - and then actually monitor that queue, because a DLQ nobody watches is a slower way of losing data.',
          'Scale consumers on backlog rather than on CPU. Messages waiting divided by consumer count gives a direct measure of how far behind you are, and it is the metric that maps to user-visible delay. Remember that adding consumers beyond the partition count does nothing in a partitioned system.',
        ],
      },
    ],
    examples: [
      {
        title: 'Why adding consumers stopped helping',
        setup:
          'An order-processing pipeline lags by 40 minutes at peak. The team scales consumers from 4 to 16 and the lag does not improve at all.',
        walkthrough: [
          'The topic has 4 partitions. With 16 consumers in one group, 4 own a partition each and 12 sit completely idle.',
          'Partition count is the parallelism ceiling - a fact that is invisible until you hit it.',
          'Fix 1: increase partitions to 24. Note that this changes key-to-partition mapping, so ordering across the change needs care and it cannot easily be reversed.',
          'Fix 2: scale on backlog per consumer rather than CPU, since consumers were at 30 percent CPU while thoroughly behind - they were IO-bound on a downstream API.',
          'Fix 3: the downstream API was the real limit, at 500 requests per second. Consumers now batch 50 updates per call, cutting calls by 50 times.',
          'Fix 4: a slow message type was blocking its partition, so it was moved to a separate topic with its own consumers - a bulkhead applied to a pipeline.',
          'Result: lag falls from 40 minutes to under 30 seconds, mostly from batching rather than from the extra consumers.',
        ],
        result:
          'Parallelism was capped by partitions, and the actual bottleneck was downstream. Scale the side that is slow, and check the ceiling before adding workers to it.',
      },
    ],
    jargon: [
      { term: 'Producer / consumer', plain: 'The side creating work and the side performing it.' },
      { term: 'Bounded buffer', plain: 'The queue between them, with a maximum size.' },
      { term: 'Competing consumers', plain: 'Several consumers sharing one queue to divide the work.' },
      { term: 'Partition', plain: 'A slice of the stream that preserves order and caps parallelism.' },
      { term: 'Acknowledgement', plain: 'Telling the broker the message is done. After the work, not before.' },
      { term: 'Backlog per consumer', plain: 'The right metric for scaling - it maps to user-visible delay.' },
    ],
    remember: [
      'The buffer decouples two rates; its size decides how long problems stay hidden.',
      'Many consumers means no ordering - partition by key when order matters.',
      'Partition count is the hard ceiling on consumer parallelism.',
      'Acknowledge after the work completes, and make handlers idempotent.',
      'Scale on backlog, and check whether the real bottleneck is downstream.',
    ],
  },

  'request-response': {
    analogy: {
      title: 'Asking a question and waiting for the answer',
      body:
        'You ask, you wait, you get an answer - and the waiting is the whole point, because you cannot continue without it. It is the most natural interaction there is, and its weakness is exactly the same thing: if the other person is slow, you are stuck standing there, unable to do anything else.',
    },
    deepDive: [
      {
        heading: 'Why synchronous remains the default',
        paragraphs: [
          'Request-response is simple to write, simple to read and simple to debug. The result is available on the next line, errors arrive as exceptions or status codes, and a stack trace covers the whole operation. For anything where the caller genuinely needs the answer to proceed, it is the correct shape.',
          'It also gives immediate feedback about failure. An asynchronous handoff tells you the message was accepted, not that the work succeeded; a synchronous call tells you the outcome. For validation, authorisation and reads, that is exactly what you want.',
          'The cost is temporal coupling: both sides must be available at the same moment, and the caller latency includes the callee latency. Every synchronous dependency multiplies your availability downward and adds its tail to yours, which is the argument for not using it where the answer is not needed.',
        ],
        code: {
          caption: 'The costs of a chain, made explicit',
          body: `A -> B -> C -> D   each 99.9% available, each p99 = 50 ms

availability   0.999^4 = 99.6%      (A and its 3 dependencies must all be up)
p99 latency    up to 150 ms + A's own work (tails add along the chain)
failure        D down = A down, unless A degrades deliberately

fix: make hops parallel where possible, remove hops that are not
needed for the answer, and define a fallback for each one that stays.`,
        },
      },
      {
        heading: 'Timeouts, deadlines and cancellation',
        paragraphs: [
          'Every synchronous call needs a timeout shorter than the budget of the caller. Without one, a slow dependency holds a thread indefinitely and the caller runs out of capacity - the mechanism behind most cascading failures. There is always a default timeout somewhere, and it is usually far too generous.',
          'Deadline propagation is the mature version. The entry point sets a total budget, and each hop passes the remaining time down. A service that receives a request with 20 ms left can refuse immediately rather than starting work whose result will be discarded, which saves capacity exactly when the system is struggling.',
          'Cancellation completes the picture: when a client disconnects, the work should stop. Continuing to compute a response nobody will read is pure waste, and under load it is waste that prevents other requests from being served. Most frameworks expose a cancellation signal, and most applications ignore it.',
        ],
        bullets: [
          'Timeout on every call, shorter than your own request budget.',
          'Propagate deadlines so downstream services can refuse doomed work.',
          'Honour cancellation when the client goes away.',
          'Budget the whole chain: the sum of the hops must fit the user-facing target.',
        ],
      },
      {
        heading: 'When to break the synchrony',
        paragraphs: [
          'The question to ask of each call is whether the caller needs the result to answer the user. Sending an email, updating analytics, notifying another system, generating a report - none of these change what the user sees, and all of them belong behind a queue.',
          'For long operations there is a well-worn middle ground: accept the request, return 202 with a job id and a status URL, and let the client poll or subscribe. The interaction stays request-response from the client perspective, while the server is freed from holding a connection for two minutes.',
          'And synchronous calls that remain should be as few and as parallel as possible. Three sequential hops of 50 ms is 150 ms; the same three in parallel is 50 ms plus the tail. Removing a hop entirely is better still, and caching is usually how that is achieved.',
        ],
      },
    ],
    examples: [
      {
        title: 'Turning a 4-second checkout into about 1 second',
        setup:
          'POST /checkout makes six synchronous calls in sequence. At p95: validate cart 120 ms, check stock 180 ms, calculate tax 400 ms, charge card 900 ms, create shipment 1,000 ms, send confirmation 1,600 ms - 4.2 seconds in total.',
        walkthrough: [
          'Classify each call: which are required to tell the user their order was placed?',
          'Required: validate cart, check stock, charge card. Everything else is not - the user does not need tax calculation detail, a shipment record or an email before seeing a confirmation.',
          'Send confirmation (1,600 ms) moves to a queue. It is the clearest case: an email provider being slow should never delay a checkout.',
          'Create shipment (1,000 ms) moves to a queue, driven by the OrderPlaced event. The warehouse does not act within seconds anyway.',
          'Calculate tax (400 ms) must be included in the total, but the result is cacheable per region and product category - it becomes a 2 ms lookup for most requests.',
          'The remaining calls run in parallel where the dependencies allow: cart validation and stock check together (180 ms, the slower of the two), then the 2 ms tax lookup, then payment (900 ms).',
          'Result: p95 becomes about 180 + 2 + 900 = roughly 1.1 seconds, most of it the card charge that the user genuinely has to wait for. Availability improves too, because two of the six dependencies can now be entirely down without affecting checkout.',
        ],
        result:
          'Checkout went from 4.2 s to about 1.1 s, because half the calls did not need to be synchronous at all. Asking "does the user need this to get their answer?" per dependency is the highest-value latency exercise available, and it improves availability at the same time.',
      },
    ],
    jargon: [
      { term: 'Synchronous', plain: 'The caller waits for the result before continuing.' },
      { term: 'Temporal coupling', plain: 'Both sides must be available at the same moment.' },
      { term: 'Deadline propagation', plain: 'Passing the remaining time budget to each downstream hop.' },
      { term: 'Cancellation', plain: 'Stopping work when the client has gone away.' },
      { term: '202 Accepted', plain: 'Acknowledging a request whose work will complete later, with a status URL.' },
      { term: 'Latency budget', plain: 'How the user-facing target is divided among the hops.' },
    ],
    remember: [
      'Use it when the caller genuinely needs the answer to continue.',
      'Every synchronous dependency multiplies availability down and adds its tail to yours.',
      'Timeout everything, propagate deadlines, and honour cancellation.',
      'Move anything the user does not need to a queue.',
      'Parallelise the hops that remain; the chain latency is otherwise a sum.',
    ],
  },
};
