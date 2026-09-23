import type { Concept } from '@/types';

export const architectureConcepts: Concept[] = [
  {
    slug: 'monolith',
    title: 'Monolith',
    tagline: 'One deployable unit - and that is often exactly right.',
    category: 'architecture',
    difficulty: 'Beginner',
    lab: 'monolith-microservices',
    keywords: ['single deployment', 'simplicity', 'transactions', 'coupling'],
    what: 'A monolith packages all application functionality into a single deployable process, usually talking to a single database.',
    why: 'Everything is local: function calls instead of network calls, one transaction across all entities, one thing to deploy, one log to read. For a small team this is a large productivity advantage.',
    how: [
      'Modules communicate in-process; the compiler or interpreter checks the contracts.',
      'One database means real ACID transactions across features.',
      'Scale by running several identical copies behind a load balancer.',
    ],
    when: [
      'New products where the domain boundaries are not yet known.',
      'Small teams - fewer than roughly a dozen engineers.',
      'Anything where transactional consistency across features matters.',
    ],
    diagram: `            Application (one deployable)
              Users | Orders | Payments | Notifications
                              |
                              v
                          Database`,
    advantages: [
      'Simple local development and debugging.',
      'No network failures, serialization or distributed tracing inside the app.',
      'Refactoring across boundaries is a compiler-assisted rename.',
    ],
    tradeoffs: [
      {
        approach: 'Monolith',
        gains: ['Lowest operational overhead', 'Transactions across the whole domain', 'Fast iteration for small teams'],
        costs: [
          'One deployment pipeline for everyone - releases queue behind each other',
          'Scale the whole app even if one endpoint is hot',
          'A memory leak or crash affects all features',
          'Boundaries erode unless actively defended',
        ],
      },
    ],
    mistakes: ['Assuming a monolith cannot scale - most can, horizontally, for a very long time.'],
    related: ['modular-monolith', 'microservices', 'horizontal-scaling'],
  },
  {
    slug: 'modular-monolith',
    title: 'Modular Monolith',
    tagline: 'Service-like boundaries, without the network between them.',
    category: 'architecture',
    difficulty: 'Intermediate',
    lab: 'monolith-microservices',
    keywords: ['modules', 'boundaries', 'seams', 'extraction'],
    what: 'A modular monolith keeps one deployable unit but enforces strict internal module boundaries: explicit interfaces, no reaching into another module data.',
    why: 'It gives you most of the design benefit of services (clear ownership, replaceable parts) while keeping the operational simplicity of one deployment - and it makes later extraction cheap.',
    how: [
      'Define modules by business capability, each owning its tables.',
      'Cross-module access only through a published interface, never direct SQL into another module tables.',
      'Enforce with package structure, build rules or architecture tests.',
      'Extract a module into a service only when a real pressure (scaling, team autonomy) justifies it.',
    ],
    diagram: `+---------------------------------------------+
|  orders  |  payments  |  catalog  |  users   |
|   (own tables, public interfaces only)       |
+---------------------------------------------+
                one deployment
Extraction later = swap an in-process call for a network call.`,
    tradeoffs: [
      {
        approach: 'Modular monolith',
        gains: ['Clear boundaries with no network cost', 'Cheap path to services later', 'Still one deploy and one transaction scope'],
        costs: ['Boundaries need active enforcement', 'Teams still share a release train'],
      },
    ],
    mistakes: ['Calling it modular while modules query each other tables directly.'],
    related: ['monolith', 'microservices', 'service-oriented-architecture'],
  },
  {
    slug: 'microservices',
    title: 'Microservices',
    tagline: 'Independent deployability bought with distributed-systems problems.',
    category: 'architecture',
    difficulty: 'Advanced',
    lab: 'monolith-microservices',
    keywords: ['independent deployment', 'bounded context', 'team autonomy', 'saga', 'tracing'],
    what: 'Microservices split a system into independently deployable services, each owning its data and communicating over the network.',
    why: 'The real driver is organisational: many teams shipping without coordinating a single release. Independent scaling and fault isolation are secondary benefits.',
    how: [
      'Split by business capability (bounded context), not by technical layer.',
      'Each service owns its database - no shared tables, ever.',
      'Cross-service workflows use events or sagas instead of distributed transactions.',
      'Invest in the platform first: CI/CD, service discovery, tracing, centralised logging.',
    ],
    when: [
      'Many teams blocked by a shared release process.',
      'Genuinely different scaling or availability profiles per capability.',
      'Domain boundaries that have proven stable over time.',
    ],
    diagram: `                API Gateway
                     |
      +--------------+--------------+
      v              v              v
  Users Svc      Orders Svc     Payments Svc
      |              |              |
   Users DB      Orders DB     Payments DB

No shared database. Every cross-service call can fail.`,
    advantages: [
      'Teams deploy on their own schedule.',
      'Scale only the hot service.',
      'A crash is contained if callers degrade gracefully.',
      'Technology choices per service.',
    ],
    tradeoffs: [
      {
        approach: 'Microservices',
        gains: ['Independent deployment and scaling', 'Fault isolation', 'Team autonomy'],
        costs: [
          'Network calls fail, retry and time out - every call site must handle it',
          'No cross-service transactions: sagas and compensation instead',
          'Debugging needs distributed tracing and correlation ids',
          'Substantial platform and operational investment',
          'Latency adds up across hops',
        ],
      },
      {
        approach: 'Monolith',
        gains: ['Simplicity', 'Transactions', 'One place to look'],
        costs: ['Shared release train', 'Coarse scaling', 'Boundaries erode without discipline'],
      },
    ],
    mistakes: [
      'Splitting before the domain boundaries are understood, producing a distributed monolith that must be deployed together anyway.',
      'A shared database between services - it removes every benefit and keeps every cost.',
      'Chatty synchronous call chains: one page view triggering fifteen hops.',
      'Adopting microservices with three engineers.',
    ],
    realWorld: [
      'Amazon and Netflix moved to services under organisational pressure at a scale most products never reach.',
      'Several well-known companies have consolidated services back into monoliths after measuring the cost.',
    ],
    related: ['monolith', 'modular-monolith', 'api-gateway', 'saga-pattern', 'distributed-tracing'],
    quiz: [
      {
        id: 'ms-1',
        prompt: 'Which situation genuinely argues for microservices?',
        options: [
          'The team wants to try a new technology',
          'Eight teams are blocked behind a single shared release train and own clearly separate business capabilities',
          'The application feels slow',
          'The codebase has grown to 100k lines',
        ],
        answer: 1,
        explanation:
          'The primary benefit is independent deployability for independent teams. Performance and code size are usually better addressed other ways.',
      },
      {
        id: 'ms-2',
        prompt: 'Two microservices share one database. What is the consequence?',
        options: [
          'Better performance',
          'A distributed monolith: schema changes couple the services, so they must be deployed together',
          'Stronger fault isolation',
          'Simpler transactions with no downside',
        ],
        answer: 1,
        explanation:
          'A shared schema recreates the coupling that services were meant to remove, while keeping the network failures they introduce.',
      },
    ],
  },
  {
    slug: 'service-oriented-architecture',
    title: 'Service-Oriented Architecture',
    tagline: 'Coarse-grained shared services, often behind a central bus.',
    category: 'architecture',
    difficulty: 'Intermediate',
    keywords: ['soa', 'esb', 'contracts', 'reuse'],
    what: 'SOA organises a system into coarse-grained services that expose reusable business capabilities, historically connected by an enterprise service bus that handled routing and transformation.',
    why: 'It is the predecessor of microservices and explains many of their design rules - notably why putting logic in the bus turned out badly.',
    how: [
      'Services expose contract-first interfaces (WSDL/SOAP historically, REST/gRPC today).',
      'The bus handles routing, protocol translation and orchestration.',
      'Governance is centralised: shared schemas, shared registry.',
    ],
    diagram: `Client -> [ Enterprise Service Bus ] -> Billing Service
                     |                   -> CRM Service
              routing, transformation,
              orchestration, logging     <- becomes the bottleneck`,
    tradeoffs: [
      {
        approach: 'SOA with a central bus',
        gains: ['Reuse of shared capabilities', 'Central governance and monitoring'],
        costs: ['The bus becomes a bottleneck and a deployment coupling point', 'Coarse services still release together'],
      },
    ],
    mistakes: ['Putting business logic in the integration layer - the lesson microservices took as "smart endpoints, dumb pipes".'],
    related: ['microservices', 'event-driven-architecture', 'api-gateway'],
  },
  {
    slug: 'serverless',
    title: 'Serverless',
    tagline: 'Per-request compute with no capacity to manage - and different constraints.',
    category: 'architecture',
    difficulty: 'Intermediate',
    lab: 'serverless',
    keywords: ['functions', 'faas', 'lambda', 'cold start', 'scale to zero', 'vendor lock-in', 'concurrency', 'provisioned concurrency'],
    what: 'Serverless (functions as a service) runs your code in response to events on infrastructure you never provision. The platform starts an instance of the function per concurrent request, bills per request and per millisecond of run time, and scales to zero when nothing arrives.',
    why: 'It removes capacity planning and idle cost for spiky or low-volume workloads, and it makes small event-driven components extremely cheap to run.',
    how: [
      'An event arrives - an HTTP request, a queue message, a file upload, a schedule - and the platform hands it to an idle instance of the function.',
      'On AWS Lambda one instance serves one request at a time, so concurrency (requests in flight) is the scaling unit: 100 events per second x 0.5 s each = 50 instances.',
      'With no idle instance the platform starts a new one - a cold start: download the code, start the runtime, run the init code. It takes from under 100 ms to over 1 s.',
      'An idle instance is kept for a while and then reclaimed. With no traffic nothing runs and nothing is billed - scale to zero - and the next event pays a cold start.',
      'Functions are stateless; state lives in managed stores such as a database, a cache or object storage.',
      'A concurrency limit caps the instances and throttles above it. Each instance opens its own database connections, so the limit and a pooler protect the database.',
    ],
    when: [
      'Spiky or infrequent workloads with idle periods.',
      'Event processing and glue code: file uploads, queue messages, webhooks, schedules.',
      'Background work where nobody waits on a cold start.',
      'Teams without operational capacity for servers.',
    ],
    advantages: [
      'No servers to provision, patch or size.',
      'Idle costs nothing: the function scales to zero.',
      'Scales from zero to thousands of concurrent instances without a scaling policy.',
      'A small event handler needs no service, pipeline or fleet of its own.',
    ],
    diagram: `event -> function platform -> idle instance?
                                 yes: warm, runs now
                                 no : new instance = cold start
                                      (under 100 ms to over 1 s)

1,000 concurrent events = 1,000 instances = 1,000 DB connections
  <- cap concurrency and use a pooler, or the database falls over

no events for a while -> instances reclaimed -> scaled to zero, $0`,
    tradeoffs: [
      {
        approach: 'Serverless functions, on demand',
        gains: ['No capacity management', 'Scale to zero - idle is free', 'Pay per request and per millisecond of run time'],
        costs: [
          'Cold start latency whenever a new instance starts',
          'Execution time and memory limits (15 minutes and 10 GB on AWS Lambda)',
          'One set of connections per instance - traditional databases need a pooler',
          'Local testing and debugging are harder',
          'Triggers, permissions and surrounding services couple you to one provider',
          'At steady high load, a higher bill per request than always-on servers',
        ],
      },
      {
        approach: 'Functions with provisioned concurrency',
        gains: ['No cold start for the provisioned instances', 'Still scales on demand above them'],
        costs: ['A fixed bill for the warm instances, busy or idle', 'That part no longer scales to zero'],
      },
      {
        approach: 'Always-on containers or servers',
        gains: [
          'Predictable latency, no cold start',
          'Lower cost per request at steady high load',
          'Long-running work and persistent connections are fine',
          'Portable between providers',
        ],
        costs: ['You manage capacity and scaling', 'You pay for idle time'],
      },
    ],
    mistakes: [
      'Assuming serverless is always cheaper - at steady high load the bill per request is higher than on always-on servers.',
      'Leaving concurrency unlimited in front of a database that allows a few hundred connections.',
      'Putting a function with multi-second cold starts on a user-facing path without looking at p99.',
      'Keeping state in instance memory and expecting the next request to see it.',
      'Handlers that are not idempotent - event sources deliver some events more than once.',
    ],
    related: ['auto-scaling', 'connection-pooling', 'event-driven-architecture', 'idempotency'],
    quiz: [
      {
        id: 'serverless-q1',
        prompt:
          'A partner calls your webhook function about once every 30 minutes. The handler runs in 100 ms, yet almost every call takes about 1.5 s. What is happening?',
        options: [
          'The concurrency limit is too low, so each call waits for a free instance',
          'The idle instance is reclaimed between calls, so every call pays a cold start',
          'The platform bills per millisecond, so it slows functions down',
          'The database needs an index for the webhook query',
        ],
        answer: 1,
        explanation:
          'Idle instances are kept only for a while. With 30 minutes between calls the function has scaled to zero, so every call starts a new instance before its 100 ms of work - the Trickle shape in the Lab shows exactly this. The concurrency limit is not the cause: one call at a time never reaches any limit, and a throttled call is rejected, not slowed.',
      },
      {
        id: 'serverless-q2',
        prompt:
          'An API on AWS Lambda receives a steady 200 requests per second, and each request takes 250 ms. About how many function instances are running?',
        options: ['200 - one per request per second', '800', '50', '1 - one instance handles all requests with threads'],
        answer: 2,
        explanation:
          'Concurrency = requests per second x duration = 200 x 0.25 s = 50. Each Lambda instance serves one request at a time, so 50 requests in flight need 50 instances. 200 confuses requests per second with requests in flight; one threaded instance describes a server, not a Lambda function.',
      },
      {
        id: 'serverless-q3',
        prompt:
          'A bulk import drops 5,000 files into storage at once. Each file triggers a function that writes to a Postgres database with max_connections = 200, and the database starts refusing connections. What is the fix?',
        options: [
          'Cap the concurrency of the function and put a connection pooler or proxy in front of the database',
          'Give the function more memory so each write finishes faster',
          'Turn on provisioned concurrency for 5,000 instances',
          'Retry immediately whenever a connection is refused',
        ],
        answer: 0,
        explanation:
          'The platform scaled toward 5,000 instances, and each opened its own connection. A concurrency limit keeps the instance count below what the database can take (the rest wait in the event queue or are throttled), and a pooler multiplexes many instances onto a few connections - in the Lab, lowering the limit to the database maximum turns refused requests into throttled ones. Immediate retries add even more connection attempts to a database that is already full.',
      },
      {
        id: 'serverless-q4',
        prompt:
          'A service handles a steady 2,000 requests per second, 24 hours a day. It moved from servers to functions, and the bill went up. What explains it?',
        options: [
          'Functions are billed for idle time between requests',
          'Cold starts are billed at a premium rate',
          'Serverless always costs more than servers',
          'The servers were busy most of the time, so their fixed price spread over many requests; functions charge every busy millisecond at a higher unit price',
        ],
        answer: 3,
        explanation:
          'Pay per use wins when there is idle time to save. At steady high load there is almost none, and a busy function second costs several times a busy server second, so the cost per request ends up higher. It is not "always" - at low or spiky traffic functions are cheaper, as the Lab cost card shows. Idle time is not billed at all, and cold starts are rare at steady load.',
      },
      {
        id: 'serverless-q5',
        prompt:
          'Users upload 50,000 images a day in bursts during business hours and almost none at night. Each needs 2 s of resizing, and nobody waits for the result. Which design fits, and why?',
        options: [
          'Functions triggered by the upload: concurrency follows the bursts, idle hours cost nothing, and a cold start on a background job is noise',
          'Always-on servers sized for the peak, because cold starts would make the resizing too slow',
          'Functions, because serverless is always the cheapest option',
          'One server with one worker, since 50,000 a day is only about 0.6 per second',
        ],
        answer: 0,
        explanation:
          'Bursty, short, stateless, independent work with long idle periods - every property favours functions. Cold starts matter only when a user waits, and here nobody does. The average of 0.6 per second hides a peak of about 20 per second x 2 s = 40 in flight, which one worker cannot keep up with; and "always cheapest" is false at steady high load.',
      },
      {
        id: 'serverless-q6',
        prompt:
          'A checkout API runs as a Java function with 3 s cold starts. It always has about 20 requests in flight during the day, and p99 latency spikes every morning as traffic ramps up. What do you change?',
        options: [
          'Raise the concurrency limit',
          'Retry requests that take longer than 1 s',
          'Provision concurrency for the baseline of 20 (or cut the init work), and accept a fixed bill for those warm instances',
          'Ask the platform to reclaim idle instances sooner',
        ],
        answer: 2,
        explanation:
          'The spikes are cold starts on a user-facing path. Provisioned instances are started ahead of traffic, so the baseline never waits; a lighter init (or SnapStart on Java) shortens the start itself. Raising the limit does not help because nothing is throttled, a retry adds a second request that may also cold start, and you cannot tune the reclaim time - reclaiming sooner would cause more cold starts, not fewer.',
      },
      {
        id: 'serverless-q7',
        prompt:
          'In the Lab you set Steady traffic at 20 events per second (0.5 s each) and a concurrency limit of 4. What do you see?',
        options: [
          'About 10 instances, because the platform ignores the limit under load',
          'Four instances busy and most events throttled at the platform',
          'Four instances, each running several requests at once',
          'All events accepted, with a growing queue inside each instance',
        ],
        answer: 1,
        explanation:
          'The load needs 20 x 0.5 = 10 instances, but the limit allows 4, so only about 8 events per second are served and the rest are throttled - crosses at the platform. A synchronous caller gets HTTP 429; an asynchronous event source keeps the event and retries later. An instance serves one request at a time, so it neither runs several at once nor keeps a queue.',
      },
      {
        id: 'serverless-q8',
        prompt:
          'A function keeps a visitor counter in a global variable and returns it. The numbers jump around and sometimes restart from zero. Why?',
        options: [
          'The global variable is shared by all instances but updated without a lock',
          'The platform clears global variables after every request',
          'The function needs more memory to hold the counter',
          'Each instance has its own memory, and instances are started and reclaimed at any time',
        ],
        answer: 3,
        explanation:
          'Every instance is a separate process with its own copy of the variable, so concurrent requests see different counts, and a new instance starts from zero after a cold start. Globals are not shared between instances - and they are not cleared after each request either, which is why reusing a connection across warm requests works. State belongs in a database or cache.',
      },
      {
        id: 'serverless-q9',
        prompt:
          'A team sets provisioned concurrency of 50 on a function that only gets traffic two hours a day. Traffic is unchanged, but the bill goes up a lot. Why?',
        options: [
          'Provisioned concurrency doubles the price of each request',
          'Cold starts became longer',
          'Provisioned instances are billed for every second they are kept warm, busy or idle',
          'The function no longer scales above 50',
        ],
        answer: 2,
        explanation:
          'Provisioned concurrency buys warm instances by the second, so that part of the function stops scaling to zero and pays for 22 idle hours a day - in the Lab, raising Provisioned concurrency adds cost even when no events arrive. Scheduling it for the busy two hours keeps the benefit at a fraction of the cost. It does not cap scaling: above 50 the function still scales on demand.',
      },
      {
        id: 'serverless-q10',
        prompt: 'A nightly report job takes 40 minutes to run. The team wants to move it to AWS Lambda. What do you tell them?',
        options: [
          'Raise the function memory until it fits',
          'Split it into steps under the 15-minute limit (with a workflow tool), or run it in a container',
          'Use provisioned concurrency so it does not time out',
          'Raise the concurrency limit so the job gets more time',
        ],
        answer: 1,
        explanation:
          'A Lambda invocation can run for at most 15 minutes, so a 40-minute job must be split into shorter steps that pass state along, or run where long jobs are normal. More memory can make it faster but gives no guarantee of fitting, and neither provisioned concurrency nor the concurrency limit changes the timeout.',
      },
      {
        id: 'serverless-q11',
        prompt:
          'A function triggered by new files in storage sends a welcome email. A few users receive the same email twice. What is the cause and the fix?',
        options: [
          'The event source can deliver the same event more than once; make the handler idempotent, keyed by object id and version',
          'Two instances cold started at once; turn on provisioned concurrency',
          'The concurrency limit is too high; lower it to 1',
          'The email service is retrying; raise the function timeout',
        ],
        answer: 0,
        explanation:
          'Storage notifications and asynchronous invocations are at-least-once, so a handler will sometimes see the same event twice. Recording which object versions were already handled turns a duplicate into a no-op. Provisioned concurrency changes latency, not delivery, and a limit of 1 only slows everything down while duplicates still arrive.',
      },
      {
        id: 'serverless-q12',
        prompt:
          'In the Lab on Bursts, the instance count drops to zero between bursts and the first events of every burst are triangles. Which single change makes the first few events of each burst warm?',
        options: [
          'Raise the concurrency limit',
          'Lower the cold start to 0.1 s',
          'Switch the diagram to the always-on server',
          'Set provisioned concurrency to 4',
        ],
        answer: 3,
        explanation:
          'Provisioned instances are never reclaimed, so the first four concurrent events of each burst find a warm instance - and the cost card shows the fixed charge they add while idle. A faster cold start shortens the wait but it is still a cold start, a higher limit allows more instances without warming any, and the diagram switch only changes which option you look at.',
      },
      {
        id: 'serverless-q13',
        prompt:
          'A queue consumer function has 800 ms cold starts. Messages wait in the queue for up to a minute anyway, and nobody is waiting on the result. Someone proposes provisioned concurrency to remove the cold starts. Is it worth it?',
        options: [
          'Yes - every cold start loses the message',
          'Yes - cold starts are billed, so provisioned concurrency is always cheaper',
          'Usually not - an 800 ms delay on background work is noise, and provisioned concurrency adds a fixed bill for it',
          'No - provisioned concurrency does not work for queue triggers',
        ],
        answer: 2,
        explanation:
          'Cold starts matter where a person waits; for a queue consumer they add under a second to work that already waits in the queue. Paying for warm instances around the clock buys almost nothing here. A cold start delays a message, it does not lose it, and provisioned concurrency does work with queue triggers - the question is whether the latency is worth paying for.',
      },
    ],
  },
  {
    slug: 'cqrs',
    title: 'CQRS',
    tagline: 'Separate the write model from the read model.',
    category: 'architecture',
    difficulty: 'Advanced',
    lab: 'event-log',
    labFocus: 'cqrs',
    keywords: ['command', 'query', 'read model', 'projection', 'eventual consistency'],
    what: 'Command Query Responsibility Segregation uses different models - often different stores - for writing and for reading.',
    why: 'Write models are optimised for invariants and normalisation; read models are optimised for the exact shape a screen needs. Forcing one model to do both makes each worse.',
    how: [
      'Commands validate invariants and write to the authoritative store.',
      'Projections build read models (denormalised views, search indexes, caches) from those writes.',
      'Queries read from the read models; a screen that must show the user their own change at once reads the write side or uses the command result.',
      'With an asynchronous projection, accept a propagation delay between write and read side - usually milliseconds to seconds.',
    ],
    when: ['Very different read and write loads.', 'Complex domain rules on write with many query shapes on read.', 'Alongside event sourcing.'],
    diagram: `Command -> domain model -> write store -> events
                                            |
                               projections  v
                     read model (denormalised) <- Queries`,
    advantages: [
      'Each query gets data already in the shape it needs - no joins at read time.',
      'Reads and writes scale separately, which matters when reads outnumber writes by 1,000 to 1.',
      'New read models can be added, or rebuilt from the source of truth, without touching the write side.',
    ],
    tradeoffs: [
      {
        approach: 'CQRS with an asynchronous read model',
        gains: ['Each side scales and is modelled independently', 'Read models can be rebuilt or added freely'],
        costs: [
          'Eventual consistency between write and read - the UI must handle it',
          'More moving parts and projection code',
          'Rebuilding projections needs tooling',
        ],
      },
      {
        approach: 'One model for reads and writes (or separate code paths on one database)',
        gains: ['Every read sees the latest write', 'Less code and no projection to operate'],
        costs: [
          'Read queries fight the normalised write schema - joins and aggregations on every request',
          'Reads and writes scale together, even when their loads differ by orders of magnitude',
        ],
      },
    ],
    mistakes: [
      'Applying CQRS to simple CRUD, where it only adds latency and code.',
      'No answer for read-your-writes: the user saves and the page shows the old value.',
      'Letting another service write to the read model, so it can no longer be rebuilt from the source of truth.',
      'Adopting event sourcing at the same time only because the two are often mentioned together.',
    ],
    related: ['event-sourcing', 'event-driven-architecture', 'denormalization', 'eventual-consistency'],
    quiz: [
      {
        id: 'cqrs-1',
        prompt:
          'A user renames their project and the next page still shows the old name for about a second. The read model is updated asynchronously from events. What is going on, and what is a sound fix?',
        options: [
          'The write failed silently - retry the command',
          'The cache must be disabled everywhere',
          'Read lag between write and read model; show the new name from the command result, or read the write side for this one screen',
          'The read model is corrupt and must be rebuilt',
        ],
        answer: 2,
        explanation:
          'The write succeeded; the projection has simply not applied it yet. That is the eventual consistency an asynchronous read model costs. The fix is a read-your-writes answer for that screen. A rebuild would not help - nothing is wrong, only late. In the Lab, the Projection delay slider is this second.',
      },
      {
        id: 'cqrs-2',
        prompt:
          'An internal admin tool has 50 users, simple forms, and about as many reads as writes. A colleague proposes CQRS with a separate read database. What do you say?',
        options: [
          'Yes - CQRS always makes reads faster',
          'Keep one model; a separate asynchronous read store adds eventual consistency and moving parts with nothing to gain here',
          'Yes, but also add event sourcing so the read model can be rebuilt',
          'Use two write databases instead',
        ],
        answer: 1,
        explanation:
          'CQRS pays off when read and write shapes or loads differ a lot. For CRUD with a similar profile, it is ceremony: projections, lag and a rebuild path for no benefit. At most, separate the code paths on the same database, which costs no consistency.',
      },
      {
        id: 'cqrs-3',
        prompt:
          'A product listing joins 6 tables and takes 2.5 s. It is read 5,000 times a minute; products change a few times an hour. What is the CQRS move?',
        options: [
          'Build a denormalised listing table updated from product events, and query only that',
          'Add more indexes to all 6 tables and keep the join',
          'Cache the whole page for a day',
          'Move the products table to a faster disk',
        ],
        answer: 0,
        explanation:
          'With about 100,000 reads per write, doing the join once per change instead of once per read is the whole point of a read model: the query becomes a single-table lookup. Indexes help a little but keep the join on every read; a day-long cache would show stale prices for hours.',
      },
      {
        id: 'cqrs-4',
        prompt: 'Where must the rule "an account can never be overdrawn" be enforced?',
        options: [
          'In the read model, because it has the current balance ready',
          'In the UI, by hiding the withdraw button',
          'In the projector, which can drop events that overdraw',
          'In the write model, when it handles the command - before anything is recorded',
        ],
        answer: 3,
        explanation:
          'The read model may be behind, so a check against it can pass while the real balance is already too low. The write model is the authority: it accepts or refuses commands. A projector must never drop events - by then they already happened. In the Lab, the Accounts API refuses overdrafts before they reach the log.',
      },
      {
        id: 'cqrs-5',
        prompt:
          'A projector bug wrote wrong totals into the read model for a week. The code is now fixed. How do you repair the data?',
        options: [
          'Leave it - new events will slowly correct the old totals',
          'Throw the read model away and rebuild it from the source of truth with the fixed code',
          'Edit the wrong rows by hand in the read database',
          'Restore the read database from last week and lose the week',
        ],
        answer: 1,
        explanation:
          'A read model is derived, so repair is a rebuild: replay the events (or re-read the write store) with the fixed projection. Fixing the code only corrects new events - the old damage stays, as the Lab shows when you turn the bug off. Hand edits make the read model a second source of truth.',
      },
      {
        id: 'cqrs-6',
        prompt:
          'Writes arrive at 10 per second and the projector can apply 8 per second. What happens over the next hour?',
        options: [
          'Commands start failing because the read side is full',
          'The projector drops 2 events per second to keep up',
          'Commands are still accepted at once, but the read lag grows without limit, so queries see older and older data',
          'Nothing - the read model is only a cache',
        ],
        answer: 2,
        explanation:
          'The write side does not wait for the projection, so writes keep succeeding while the backlog grows by 2 events every second - 7,200 after an hour. Nothing is dropped; it is just later and later. In the Lab, set Projector speed under Write rate and watch Read lag climb.',
      },
      {
        id: 'cqrs-7',
        prompt:
          'Another team wants to write directly into your read model to add a field they need. What is the problem?',
        options: [
          'The read model stops being derived: the next rebuild erases their data, and there are now two sources of truth',
          'None - a read model is just a table',
          'Only performance: two writers slow it down',
          'Their writes would appear on the write side too',
        ],
        answer: 0,
        explanation:
          'Everything in a read model must be reproducible from the source of truth, or you can never rebuild it safely. Their field belongs in the write model or in events, and then in a projection - perhaps their own read model.',
      },
      {
        id: 'cqrs-8',
        prompt:
          'The write side is a relational database. The team wants a search read model in Elasticsearch, and someone says they must adopt event sourcing first. Are they right?',
        options: [
          'Yes - projections can only be built from an event store',
          'Yes - Elasticsearch needs events as input',
          'No - but then the read model cannot be rebuilt',
          'No - CQRS and event sourcing are independent; feed the read model from domain events or change data capture on the relational store',
        ],
        answer: 3,
        explanation:
          'CQRS only separates the read and write models. A projector can be fed by domain events published by the write side, or by change data capture, and it can still be rebuilt by re-reading the relational source. Adopting both patterns at once only because they appear together is a common way to over-build.',
      },
      {
        id: 'cqrs-9',
        prompt:
          'A new screen needs the same orders grouped by warehouse, a shape no existing read model has. What do you change?',
        options: [
          'Add a column to the write model and query it with a join',
          'Add a new projection that builds a read model for that screen from the same events, filled first by replaying history',
          'Change the existing read model and every screen that uses it',
          'Let the screen query the event log directly',
        ],
        answer: 1,
        explanation:
          'Read models are cheap to add because the write side does not change: a new projection subscribes to the same events and replays history to fill itself. Reshaping the write model for a screen is exactly the coupling CQRS removes.',
      },
      {
        id: 'cqrs-10',
        prompt:
          'The team likes separate command and query code, but one screen must never show a stale value - not even for 100 ms. Which setup fits?',
        options: [
          'Separate code paths on the same database, with any read table updated in the same transaction as the write',
          'An asynchronous projection with a lower delay',
          'A second read model in a faster database',
          'Polling the read model until the value changes',
        ],
        answer: 0,
        explanation:
          'Separate code paths, or a read table written in the same transaction, give CQRS structure with no consistency gap. Any asynchronous projection - however fast - has some lag, as the Lab shows even at a low Projection delay. Polling only hides the gap.',
      },
    ],
  },
  {
    slug: 'event-sourcing',
    title: 'Event Sourcing',
    tagline: 'Store the events, derive the state.',
    category: 'architecture',
    difficulty: 'Advanced',
    lab: 'event-log',
    labFocus: 'event-sourcing',
    keywords: ['event store', 'replay', 'audit', 'snapshot', 'projection'],
    what: 'Event sourcing persists every state change as an immutable event. Current state is derived by replaying those events, with snapshots as an optimisation.',
    why: 'You get a perfect audit log, the ability to answer questions nobody asked when the data was written, and the possibility of rebuilding any read model from history.',
    how: [
      'Append events to a per-entity stream; never update or delete them.',
      'Rebuild state by folding the stream; snapshot periodically to keep replay fast.',
      'Projections turn streams into query-friendly views.',
      'Version event schemas - old events must stay readable forever.',
      'Correct a mistake by appending a compensating event, never by editing history.',
    ],
    when: ['Finance, ordering, compliance - anywhere history is part of the product.'],
    diagram: `stream: account-42
  AccountOpened      {balance: 0}
  MoneyDeposited     {+100}
  MoneyWithdrawn     {-30}
  -> folded state: balance 70
  -> snapshot at event 1000 to avoid replaying everything`,
    advantages: [
      'A complete audit trail by construction - it is the data, not a side log that can drift.',
      'State at any past moment, by replaying up to that point.',
      'New questions about the past can be answered with a new projection over old events.',
      'Any read model can be rebuilt after a bug by replaying the stream with fixed code.',
    ],
    tradeoffs: [
      {
        approach: 'Event sourcing',
        gains: ['Complete audit trail', 'Temporal queries and replay', 'Natural fit with event-driven systems'],
        costs: [
          'Significant conceptual and operational complexity',
          'Schema evolution of historical events is permanent work',
          'Deleting personal data conflicts with an immutable log (GDPR needs crypto-shredding)',
          'Queries require projections',
        ],
      },
      {
        approach: 'Store current state (with an audit table if needed)',
        gains: ['Simple queries straight against the state', 'Familiar tools, migrations and deletes'],
        costs: [
          'History is lost on every update unless an audit table is kept - and that table can drift from the real data',
          'A question about the past that nobody planned for usually cannot be answered',
        ],
      },
    ],
    mistakes: [
      'Adopting it for an entire system when only one aggregate needs an audit trail.',
      'Keeping events in a store or topic with a retention limit, so the history needed to rebuild is deleted.',
      'Triggering side effects such as emails from the replay path, so a rebuild sends them again.',
      'Editing or deleting stored events to fix a mistake instead of appending a correction.',
    ],
    related: ['cqrs', 'event-driven-architecture', 'kafka', 'outbox-pattern'],
    quiz: [
      {
        id: 'es-1',
        prompt:
          'Stream account-42 holds: AccountOpened (0), MoneyDeposited +100, MoneyWithdrawn -30, MoneyDeposited +50. An auditor asks for the balance just before the last deposit. How do you answer?',
        options: [
          'Read the current balance, 120, and subtract nothing',
          'It cannot be known - only the current balance is stored',
          'Replay the first three events: 0 + 100 - 30 = 70',
          'Read the balance from the latest snapshot',
        ],
        answer: 2,
        explanation:
          'State at any past point is a fold over the events up to that point, so the answer is 70. The current balance is 120, which is the wrong moment. A snapshot is a shortcut to some state, not to the state the auditor asked about.',
      },
      {
        id: 'es-2',
        prompt:
          'A heavily edited order has 20,000 events, and loading it takes 300 ms of replay. What do you do?',
        options: [
          'Delete the oldest events once they are applied',
          'Take a snapshot every 1,000 events and load the latest snapshot plus only the events after it',
          'Switch the order to a normal table',
          'Replay in parallel on 20 threads',
        ],
        answer: 1,
        explanation:
          'A snapshot stores the folded state at an event number, so loading replays at most 1,000 events instead of 20,000. Deleting events destroys the history that is the point of event sourcing. In the Lab, turn Snapshots on and rebuild twice: the second rebuild replays only the events after the snapshot.',
      },
      {
        id: 'es-3',
        prompt: 'A customer invokes the GDPR right to erasure. Their personal data is inside immutable events. What works?',
        options: [
          'Crypto-shredding: personal data was stored encrypted with a per-customer key, and you delete that key',
          'Rewrite the affected events in place with the data removed',
          'Delete the whole stream and every projection built from it',
          'Nothing - event sourcing is exempt from erasure',
        ],
        answer: 0,
        explanation:
          'Encrypting personal fields with a per-subject key means deleting the key makes the data unreadable while the event sequence stays intact. It has to be designed in before the data is stored. Rewriting events breaks immutability and every consumer that already read them.',
      },
      {
        id: 'es-4',
        prompt:
          'MoneyDeposited gains a currency field. Five years of stored events do not have it. What do you do?',
        options: [
          'Run a migration that updates every old event',
          'Refuse to load old events from now on',
          'Delete the old events and start a new stream',
          'Version the event type and write an upcaster that gives old events a default currency when they are read',
        ],
        answer: 3,
        explanation:
          'Stored events are never changed, so old shapes must stay readable forever. An upcaster converts an old version into the current shape at read time. A migration that edits history gives up the audit trail that justified event sourcing.',
      },
      {
        id: 'es-5',
        prompt:
          'Orders are event-sourced. Finance asks how often customers added items after placing an order last year. How do you answer?',
        options: [
          'Write a new projection over the ItemAdded events and replay the whole history into it',
          'It cannot be answered - the question was not planned',
          'Query the current order rows',
          'Add logging and answer the question next year',
        ],
        answer: 0,
        explanation:
          'Because the raw facts were kept, a question nobody planned for can be answered for the past with a new projection. With only current order rows, an item added later looks the same as one ordered at the start.',
      },
      {
        id: 'es-6',
        prompt:
          'After event-sourcing the order lifecycle successfully, a team wants to event-source user preferences and the product catalogue too. What do you advise?',
        options: [
          'Yes - one pattern everywhere is simpler',
          'Keep them as ordinary tables; history there has no business value, and every query would need a projection',
          'Yes, but only with snapshots',
          'Event-source them and drop the order events instead',
        ],
        answer: 1,
        explanation:
          'Event sourcing is chosen per aggregate, where history is part of the product. For preferences and a catalogue it adds projections, versioning and rebuilds for very little value.',
      },
      {
        id: 'es-7',
        prompt:
          'A team uses a Kafka topic with the default 7-day retention as its event store. Months later they need to rebuild a read model. What happens?',
        options: [
          'The rebuild works - Kafka keeps event-store topics forever',
          'The rebuild is only slower',
          'Only events from the last 7 days are left, so the rebuilt state is wrong and cannot be fixed by replay',
          'Kafka refuses to start the rebuild',
        ],
        answer: 2,
        explanation:
          'Retention deleted the older events, and state folded from a partial history is wrong. An event store must keep every event - on Kafka that means turning time and size retention off for that topic. In the Lab, turn on Size retention and rebuild: replay can only start at the oldest record kept, and the balances come out wrong.',
      },
      {
        id: 'es-8',
        prompt:
          'During a rebuild of the read models, thousands of customers receive their welcome email again. Why?',
        options: [
          'The events were duplicated in the store',
          'The email code runs inside the projection, so replaying the events re-runs the side effect',
          'Snapshots were turned off',
          'The rebuild was too fast for the mail server',
        ],
        answer: 1,
        explanation:
          'Replaying must only rebuild state. Side effects such as emails belong to a separate consumer that does not replay, or that remembers what it already did (idempotency). Nothing is wrong with the events themselves.',
      },
      {
        id: 'es-9',
        prompt: 'A deposit of 100 was recorded twice by mistake. How do you correct it?',
        options: [
          'Delete the duplicate event',
          'Edit the second event to 0',
          'Change the balance in the read model by hand',
          'Append a compensating event, such as DepositReversed of 100, with the reason',
        ],
        answer: 3,
        explanation:
          'History is never edited: a correction is a new fact, like a reversing entry on a bank statement. The balance becomes right on the next fold, and the audit trail shows both the mistake and the fix. A hand edit in the read model is erased by the next rebuild.',
      },
      {
        id: 'es-10',
        prompt:
          'You fix a bug in a projection. The latest snapshot of that projection was taken while the bug was live. How do you rebuild?',
        options: [
          'Discard snapshots made by the old code and replay from the first event',
          'Start from the snapshot - it is faster',
          'Start from the snapshot and replay the last 100 events twice',
          'Keep the old read model - the fix only matters for new events',
        ],
        answer: 0,
        explanation:
          'A snapshot is the output of one version of the projection code, so it carries the bug. Replaying from the start with fixed code is the only way to a correct state. In the Lab, changing the Projector bug toggle discards the snapshot for exactly this reason.',
      },
    ],
  },
];
