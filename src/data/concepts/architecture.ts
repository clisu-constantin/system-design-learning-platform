import type { Concept } from '@/types';

export const architectureConcepts: Concept[] = [
  {
    slug: 'monolith',
    title: 'Monolith',
    tagline: 'One deployable unit - and that is often exactly right.',
    category: 'architecture',
    difficulty: 'Beginner',
    lab: 'monolith-microservices',
    labFocus: 'monolith',
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
      'Small teams - up to roughly ten engineers, before a shared release train starts to hurt.',
      'Anything where transactional consistency across features matters.',
    ],
    diagram: `            Application (one deployable)
              Users | Orders | Payments | Notifications
                              |
                              v
                          Database`,
    advantages: [
      'Simple local development and debugging: one stack trace, one log stream.',
      'No network failures, serialization or distributed tracing inside the app.',
      'Real transactions across the whole domain.',
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
      {
        approach: 'Modular monolith',
        gains: ['Same single deploy and transactions', 'Enforced module boundaries keep later extraction cheap'],
        costs: ['Boundary rules and build checks to maintain', 'Still one process: no fault isolation, one release train'],
      },
    ],
    mistakes: [
      'Assuming a monolith cannot scale - most can, horizontally, for a very long time.',
      'Blaming the deployment shape for a tangled codebase - a big ball of mud is a design failure that splitting into services makes permanent.',
      'Splitting into services to fix performance - in-process calls are faster than network calls.',
    ],
    related: ['modular-monolith', 'microservices', 'horizontal-scaling'],
    quiz: [
      {
        id: 'mono-1',
        prompt:
          'A six-person startup has a three-month-old product whose domain changes every week. The CTO proposes eight microservices "to be ready for scale". What do you recommend?',
        options: [
          'Build the eight services now, because extracting services from a live monolith later means months of rewriting',
          'Build the eight services on one shared database, so joins and transactions keep working while the domain settles',
          'One monolith with clear internal modules; extract a service only when a specific pressure appears',
          'Build one service per engineer so that nobody ever blocks anybody',
        ],
        answer: 2,
        explanation:
          'With boundaries still moving every week, service boundaries drawn now will be wrong, and wrong boundaries across a network are expensive to move. A monolith keeps them cheap to change. Eight services sharing a database is the tempting shortcut, but it is a distributed monolith: every network cost and none of the independence.',
      },
      {
        id: 'mono-2',
        prompt:
          'In the Lab, in Monolith mode, you press Break Payments. The error rate jumps to 100% - even Users requests fail. Why?',
        options: [
          'All features share one process, so a crash in the payments code takes down Users too',
          'The load balancer stops sending any traffic to the app as soon as one feature returns errors',
          'The database locks every table when the payments transaction fails, so Users queries block too',
          'Users calls Payments on every request, so the payments failure cascades into every Users call',
        ],
        answer: 0,
        explanation:
          'One deployable unit means one process: a crash there is a crash for every feature, which is why the Blast radius reads All features. Nothing in the Lab makes Users call Payments - the failure spreads through the shared process, not through a dependency.',
      },
      {
        id: 'mono-3',
        prompt:
          'The Orders endpoint takes half the traffic and the monolith runs at 85% CPU on two instances. How do you add capacity without changing the architecture?',
        options: [
          'Scale only the Orders code by giving its module more threads inside the running process',
          'Buy a bigger database server, since the Orders queries are what keeps the CPU at 85%',
          'Split Orders into a microservice - a monolith can only scale by growing one machine, so extraction is required',
          'Run more copies of the whole application behind the load balancer, accepting that every feature is copied too',
        ],
        answer: 3,
        explanation:
          'A monolith scales horizontally by running identical copies - raise Instances in the Lab and CPU falls. The cost is coarse scaling: Users and Notifications are copied too. Believing a monolith cannot scale at all is the classic mistake; extraction is for when that coarse scaling becomes the real problem.',
      },
      {
        id: 'mono-4',
        prompt:
          'Checkout must create an order, decrement stock and record the payment - all three or none. The app is a monolith with one database. How do you do it?',
        options: [
          'A saga with a compensating action for every step, so a failed payment undoes the stock and the order',
          'One database transaction: begin, three writes, commit - any failure rolls back all three',
          'Two-phase commit between three services, so each write is prepared before any of them commits',
          'Write each table separately and run a nightly repair job',
        ],
        answer: 1,
        explanation:
          'One database gives real ACID transactions across the whole domain, one of the biggest advantages of a monolith. Sagas and compensation are what you are forced into once the data lives in separate services - using them inside one database adds complexity for nothing.',
      },
      {
        id: 'mono-5',
        prompt:
          'The team has grown to 40 engineers. Deploys queue for a day and one risky feature regularly blocks an urgent fix. Latency and CPU look fine. What is the real problem?',
        options: [
          'The monolith is too slow: a larger codebase means longer builds, which is what queues the deploys',
          'The database is too small, so schema migrations lock tables and hold up every deploy',
          'Deployment coupling: one release train, so every deploy waits for and risks everyone else',
          'The load balancer cannot handle the traffic',
        ],
        answer: 2,
        explanation:
          'The pain that forces most splits is about people and deployment, not performance - the metrics are fine. Module boundaries, a merge queue, and eventually extracting the parts that need their own release cadence address it. Buying hardware does not touch the release train.',
      },
      {
        id: 'mono-6',
        prompt:
          'Every module in a large codebase imports every other one and queries any table it likes. The lead says: "The monolith failed - let us move to microservices." What is the likely result?',
        options: [
          'The tangled calls become network calls - a distributed ball of mud; untangle the monolith first',
          'Microservices untangle the dependencies, because each service can only reach the others through its API',
          'It proves monoliths stop working past a certain size, so splitting is the only remaining option',
          'Moving to a bigger server fixes the coupling',
        ],
        answer: 0,
        explanation:
          'Tangled code is a design failure, not a property of the deployment shape. Splitting it keeps every dependency and adds a network to each one. The sequence that works is monolith, then modular monolith with enforced boundaries, then extraction of the modules that have a reason to leave.',
      },
      {
        id: 'mono-7',
        prompt:
          'PDF generation needs 6 GB of memory and sometimes gets the whole app killed for running out of memory. Everything else needs 2 GB. What is a reasonable response?',
        options: [
          'Move every feature into its own microservice, so each gets exactly the memory it needs',
          'Extract only PDF generation into a separate worker, and keep the rest in the monolith',
          'Give every instance 64 GB of memory so PDF jobs always have headroom',
          'Ignore it, because the orchestrator restarts a killed instance within seconds',
        ],
        answer: 1,
        explanation:
          'Extract a service for a specific, measurable reason - here the resource profile. Sizing every instance for the hungriest feature pays for 6 GB everywhere and still lets one PDF job take every feature down with it. Splitting everything solves a problem the other features do not have.',
      },
      {
        id: 'mono-8',
        prompt:
          'In the Lab, switch from Monolith to Microservices at the same traffic. Average latency goes up. Why?',
        options: [
          'Microservices are written in slower languages, so each request spends longer on CPU',
          'The monolith caches every response in memory, and the services start with cold caches',
          'Each microservice opens a new database connection per request, so reads queue up',
          'Each call between features is now a network hop with serialization, not an in-process call',
        ],
        answer: 3,
        explanation:
          'A function call inside one process takes no network round trip and cannot time out. Every service boundary adds a hop - the Lab adds one per call, and the Orders to Payments call adds a second. Services buy independence, not speed.',
      },
      {
        id: 'mono-9',
        prompt:
          'The Notifications code has a memory leak. The monolith runs four instances behind a load balancer. What happens over the next few hours?',
        options: [
          'Only Notifications slows down, because the leak is confined to the Notifications module',
          'The load balancer health checks eject the leaking instance, so the other three keep serving',
          'Every instance runs the same code, so every instance leaks and restarts in turn - all features suffer',
          'Nothing visible - the instances are stateless, so each restart clears the leak and no request is affected',
        ],
        answer: 2,
        explanation:
          'Instances of a monolith are identical copies, so a leak in one feature is a leak in all of them. Stateless means any copy can serve any request; it does not mean a bad feature is contained. That missing fault isolation is one of the listed costs of a monolith.',
      },
      {
        id: 'mono-10',
        prompt:
          'A checkout request is slow. In a monolith, what makes finding the cause easier than in a system of six services?',
        options: [
          'Nothing - both need the same tooling, since a slow request looks the same in any architecture',
          'One stack trace and one log stream cover the whole request, so a profiler finds the slow part',
          'Monoliths retry slow requests automatically',
          'Monoliths always use one faster database, so slow queries are the only thing to look at',
        ],
        answer: 1,
        explanation:
          'The whole request runs in one process, so ordinary tools see all of it. Across services there is no single stack trace: you need correlation ids and distributed tracing just to learn which hop was slow. That is part of the operational cost services add.',
      },
    ],
  },
  {
    slug: 'modular-monolith',
    title: 'Modular Monolith',
    tagline: 'Service-like boundaries, without the network between them.',
    category: 'architecture',
    difficulty: 'Intermediate',
    lab: 'monolith-microservices',
    labFocus: 'modular-monolith',
    keywords: ['modules', 'boundaries', 'seams', 'extraction'],
    what: 'A modular monolith keeps one deployable unit but enforces strict internal module boundaries: explicit interfaces, no reaching into the data of another module.',
    why: 'It gives you most of the design benefit of services (clear ownership, replaceable parts) while keeping the operational simplicity of one deployment - and it makes later extraction cheap.',
    how: [
      'Define modules by business capability, each owning its tables.',
      'Cross-module access only through a published interface, never direct SQL into the tables of another module.',
      'Enforce with package structure, build rules or architecture tests, so a violation fails the build.',
      'Extract a module into a service only when a real pressure (scaling, team autonomy) justifies it.',
    ],
    when: [
      'A monolith whose team has grown enough that people step on each other in shared code.',
      'A domain that is understood well enough to draw module boundaries, but no pressure yet to split the deployment.',
      'Before any extraction into services - it is the step that makes extraction cheap.',
    ],
    diagram: `+---------------------------------------------+
|  orders  |  payments  |  catalog  |  users   |
|   (own tables, public interfaces only)       |
+---------------------------------------------+
                one deployment
Extraction later = swap an in-process call for a network call.`,
    advantages: [
      'Clear ownership per module, with calls that stay in-process.',
      'Transactions across modules still work, because there is one database.',
      'One deploy, one process to operate.',
      'A module with its own tables and interface can be extracted in days, not months.',
    ],
    tradeoffs: [
      {
        approach: 'Modular monolith',
        gains: ['Clear boundaries with no network cost', 'Cheap path to services later', 'Still one deploy and one transaction scope'],
        costs: [
          'Boundaries need mechanical enforcement, or they erode',
          'Teams still share a release train',
          'No fault isolation - a crash in any module takes the process down',
        ],
      },
      {
        approach: 'Plain monolith',
        gains: ['Nothing to enforce', 'Fastest start'],
        costs: ['Shortcuts between modules pile up', 'Extraction later means untangling shared tables first'],
      },
    ],
    mistakes: [
      'Calling it modular while modules query the tables of other modules directly.',
      'Relying on documentation or code review instead of a check that fails the build.',
      'Expecting fault isolation from modules - they share one process.',
    ],
    related: ['monolith', 'microservices', 'service-oriented-architecture'],
    quiz: [
      {
        id: 'mm-1',
        prompt:
          'The code has a billing folder and an orders folder, but to save time the orders code runs SQL straight against the invoices table that billing owns. What is the consequence?',
        options: [
          'None - it is one process, so any code may read any table, and a direct query saves a network call',
          'Billing can no longer change its tables, or be extracted, without breaking orders',
          'Orders becomes faster and safer, because it skips the billing interface and its validation',
          'The database refuses the query, because orders has no grant on the invoices table',
        ],
        answer: 1,
        explanation:
          'Data ownership is the boundary that matters most. Once another module depends on your table layout, every schema change and every extraction has to find and rewrite those queries first. Being in one process makes the shortcut possible, not harmless.',
      },
      {
        id: 'mm-2',
        prompt:
          'In the Lab (Modular), you turn off Enforce module boundaries. The Extract Payments switch becomes blocked. Why does the Lab block it?',
        options: [
          'Extraction needs more instances first, so the monolith keeps running while the new service starts',
          'Payments receives too much traffic to run alone, so the Lab keeps it inside the shared process where it can borrow capacity',
          'The load balancer cannot route to a second service until the boundaries are enforced again',
          'Orders now reads the payments tables directly, so moving them to another database would break Orders',
        ],
        answer: 3,
        explanation:
          'The red wire from the Orders module to the Payments tables is exactly what an extraction cannot survive. Traffic and instances play no part: the blocker is a query that assumes the tables sit in the same database.',
      },
      {
        id: 'mm-3',
        prompt:
          'In the Lab (Modular), you press Break Notifications and every module goes down. A teammate expected only Notifications to fail. Who is right?',
        options: [
          'The Lab: modules are a code boundary, not a process boundary, so one crash takes them all down',
          'The teammate: each module has its own tables and interface, so a crash stays inside Notifications',
          'Neither: only Notifications and Users fail, because Users is the only module that calls it',
          'Neither: only the database fails',
        ],
        answer: 0,
        explanation:
          'A modular monolith gives design isolation, not runtime isolation. Fault isolation needs separate processes - which is what extracting a module into a service buys, together with a network call that can fail.',
      },
      {
        id: 'mm-4',
        prompt:
          'Thirty engineers under deadline pressure keep importing the internals of other modules. What keeps the boundaries in place?',
        options: [
          'A wiki page that describes the module rules',
          'Asking every reviewer to reject any pull request that imports the internals of another module',
          'A check that fails the build: a lint rule or module visibility that rejects imports of internals',
          'Splitting into microservices, so imports of internals become impossible by construction',
        ],
        answer: 2,
        explanation:
          'Documented boundaries erode within weeks, because the shortest path to a deadline is a direct import, and reviewers miss some. Mechanical enforcement makes the violation fail before merge. Splitting into services also blocks imports, but it adds a network and a platform to fix a problem a lint rule solves.',
      },
      {
        id: 'mm-5',
        prompt:
          'Placing an order must create the order (orders module) and reserve stock (inventory module), both or neither. It is a modular monolith with one database. What do you use?',
        options: [
          'A saga, because the modules are separate and each owns its own tables',
          'One database transaction, with each module still writing only its own tables',
          'Two-phase commit between the modules, so each module votes before the shared commit',
          'Nothing - atomicity across modules is impossible',
        ],
        answer: 1,
        explanation:
          'Keeping real transactions across modules is a genuine advantage of the modular monolith. Each module writes its own tables through its own code, inside one transaction. Sagas become necessary only once the modules no longer share a database.',
      },
      {
        id: 'mm-6',
        prompt:
          'The search module needs a different language and far more memory. It already owns its tables and is called only through its interface. What does extracting it involve?',
        options: [
          'Rewriting the whole system, because every caller of search has to change to a remote API',
          'Months of untangling joins with other modules before its tables can move to a new database',
          'Splitting every module into a service at the same time, so pipelines and tracing are built once for all of them',
          'Its interface goes behind a network call, its tables move and it deploys alone - plus timeouts and retries',
        ],
        answer: 3,
        explanation:
          'The interface and the data separation already exist, so there is one place to change and no shared tables to untangle - the work takes days. What remains are the new costs of any network call, which appear the moment the call leaves the process.',
      },
      {
        id: 'mm-7',
        prompt:
          'In the Lab (Modular), you switch on Extract Payments. Average latency rises and Payments can now fail on its own. Why?',
        options: [
          'The Orders to Payments call is now a network hop that can be slow or fail',
          'The database became slower, because Payments now opens its own connections to it',
          'The monolith lost instances when Payments was moved out into its own process',
          'Payments receives more traffic than before, because retries from Orders double its load',
        ],
        answer: 0,
        explanation:
          'Extraction swaps an in-process call for a network call - the dashed wire. That hop adds latency and a new way to fail. Traffic is unchanged; what changed is the path each Orders request takes.',
      },
      {
        id: 'mm-8',
        prompt:
          'Twelve engineers work on one product across three business areas. Merge conflicts are constant, but deploys and performance are fine. What fits?',
        options: [
          'One microservice per business area, each with its own repository, pipeline and database',
          'Accept the conflicts - they come with any monolith, and a merge queue keeps them manageable',
          'A modular monolith: one module per business area, enforced boundaries, own tables, one deploy',
          'SOA with an enterprise service bus between the areas, so each team only integrates through the bus',
        ],
        answer: 2,
        explanation:
          'The pain is in the code, not in deployment or scaling, so the fix belongs in the code: modules give teams separate places to work. Microservices would also separate the code, but they add a network, sagas and a platform to a team that has no deployment problem.',
      },
      {
        id: 'mm-9',
        prompt:
          'An architecture test reports a cycle: orders depends on billing, and billing depends on orders. Why fix it?',
        options: [
          'Cycles only make the build slower, because the compiler must process both modules together',
          'Neither module can change or be extracted without the other - dependencies should point one way',
          'Cycles are required for modules to talk to each other in both directions',
          'Cycles only matter in microservices, where they create call loops across the network',
        ],
        answer: 1,
        explanation:
          'A cycle makes two modules one unit in disguise: a change to either can break the other, and neither can leave alone. Keeping dependencies one-directional, checked in CI, is part of what keeps extraction cheap.',
      },
      {
        id: 'mm-10',
        prompt:
          'In the Lab (Modular), Payments is extracted. Now you press Break Users. What happens?',
        options: [
          'Only Users requests fail, because each module has its own tables and interface',
          'Every request fails, including Payments, because Payments still calls the monolith for users',
          'Nothing fails, because the extraction moved the shared process into separate containers',
          'Users, Orders and Notifications fail with the monolith process; Payments keeps serving',
        ],
        answer: 3,
        explanation:
          'Users still lives in the monolith process, so it takes Orders and Notifications down with it - the Blast radius reads All but Payments. Payments runs in its own process now, which is the fault isolation the extraction bought.',
      },
    ],
  },
  {
    slug: 'microservices',
    title: 'Microservices',
    tagline: 'Independent deployability bought with distributed-systems problems.',
    category: 'architecture',
    difficulty: 'Advanced',
    lab: 'monolith-microservices',
    labFocus: 'microservices',
    keywords: ['independent deployment', 'bounded context', 'team autonomy', 'saga', 'tracing'],
    what: 'Microservices split a system into independently deployable services, each owning its data and communicating over the network.',
    why: 'The real driver is organisational: many teams shipping without coordinating a single release. Independent scaling and fault isolation are secondary benefits.',
    how: [
      'Split by business capability (bounded context), not by technical layer.',
      'Each service owns its database - no shared tables, ever.',
      'Cross-service workflows use events or sagas instead of distributed transactions.',
      'Keep the pipes dumb: plain HTTP or a message broker for transport, business logic in the services.',
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
      'Segment merged more than a hundred per-destination services back into one service in 2018, after the operational cost outgrew the benefit.',
      'Amazon Prime Video moved one monitoring pipeline from distributed components into a single process in 2023 and reported cutting its infrastructure cost by 90%.',
    ],
    related: ['monolith', 'modular-monolith', 'api-gateway', 'saga-pattern', 'distributed-tracing'],
    quiz: [
      {
        id: 'ms-1',
        prompt: 'Which situation genuinely argues for microservices?',
        options: [
          'The team wants to try a new language for one feature, and a separate service lets it pick its own stack',
          'Eight teams with separate business capabilities are blocked behind one shared release train',
          'The application feels slow, and splitting it lets each part run on its own machine',
          'The codebase has grown to 100k lines and takes a long time to compile',
        ],
        answer: 1,
        explanation:
          'The primary benefit is independent deployability for independent teams. A slow application gets slower with network hops, and a large codebase is a case for module boundaries, not for a network between them.',
      },
      {
        id: 'ms-2',
        prompt: 'Two microservices share one database. What is the consequence?',
        options: [
          'Better performance, because a join across both services needs no network call',
          'Stronger fault isolation, since one database is easier to keep available than two',
          'A distributed monolith: schema changes couple the services, so they deploy together',
          'Simpler transactions with no downside, because both services commit in one database',
        ],
        answer: 2,
        explanation:
          'A shared schema recreates the coupling that services were meant to remove, while keeping the network failures they introduce. The shared database is also a shared failure point, so isolation gets weaker, not stronger.',
      },
      {
        id: 'ms-3',
        prompt:
          'In the Lab (Microservices), you press Break Payments. Users and Notifications keep working, but some Orders requests fail too. Why?',
        options: [
          'Orders calls Payments synchronously, so Orders requests that need Payments fail with it',
          'The API Gateway marks the whole checkout route unhealthy once Payments errors pass a threshold',
          'Orders shares the Payments database, and the crash left locks on the tables it uses',
          'Random load failures unrelated to Payments',
        ],
        answer: 0,
        explanation:
          'Each service owns its own database in the Lab, so no data is shared - the failure travels along the dashed synchronous call. Fault isolation holds only where there is no synchronous dependency, or where the caller degrades gracefully instead of failing.',
      },
      {
        id: 'ms-4',
        prompt:
          'Checkout spans the Orders, Inventory and Payments services, each with its own database. Stock is reserved, then the card is declined. What undoes the reservation?',
        options: [
          'A database rollback across all three services, since each database supports transactions',
          'Two-phase commit, which prepares all three databases before the card is charged',
          'Nothing - the stock simply stays reserved',
          'A saga: each step has a compensating action - release the stock, cancel the order',
        ],
        answer: 3,
        explanation:
          'There is no transaction across separate databases, so there is no rollback. Two-phase commit across services is rarely used because it blocks on the slowest participant and couples their availability. Compensation is code you own, and it can fail and be retried, so it must be idempotent.',
      },
      {
        id: 'ms-5',
        prompt:
          'One page view calls six services in sequence, and each is available 99.9% of the time, independently. Roughly how available is the page?',
        options: [
          '99.9%, the same as each service',
          '99.99%, because six services back each other up',
          'About 99.4% (0.999 to the power of 6)',
          'About 94%, losing 1% per service',
        ],
        answer: 2,
        explanation:
          'Availability of a serial chain multiplies: 0.999^6 is about 0.994, six times the downtime of any single service. 99.9% would hold only with one service; 94% would be the result with six services at 99% each.',
      },
      {
        id: 'ms-6',
        prompt:
          'Adding one field to the checkout flow routinely means changing four services and deploying them in a fixed order. What is the diagnosis?',
        options: [
          'There are too few services, so each one carries too many responsibilities',
          'Wrong boundaries - a distributed monolith; merge the services that always change together',
          'The team needs a service mesh to manage the deploy order and roll all four back together',
          'The team needs more engineers so each of the four services has an owner ready to deploy',
        ],
        answer: 1,
        explanation:
          'The test of a good boundary is that most changes touch one service. Deploys in a fixed order mean independent deployment does not exist. A mesh handles retries and mTLS; it does not remove coupling between contracts.',
      },
      {
        id: 'ms-7',
        prompt:
          'In the Lab (Microservices), Orders is the hot path. You raise Instances. What gets more capacity?',
        options: [
          'Only the Orders service - the others keep their size',
          'Every service equally, since the slider copies the whole deployment',
          'The API Gateway, which spreads the extra load across the services',
          'The databases',
        ],
        answer: 0,
        explanation:
          'Scaling only the hot service is one of the benefits of the split: the Orders meter drops while the others stay put. In Monolith mode the same slider copies the whole application, every feature included.',
      },
      {
        id: 'ms-8',
        prompt: 'A team of three engineers wants microservices for its first product. What do you advise?',
        options: [
          'Go ahead - splitting early saves a painful rewrite once the product grows',
          'Go ahead, as long as they run it on Kubernetes, which automates deploys, discovery and restarts',
          'One service per engineer, so nobody waits for anyone and each person deploys alone',
          'Start with a monolith: the benefit, independent teams, does not exist yet with three people',
        ],
        answer: 3,
        explanation:
          'The benefit of microservices is organisational: many teams shipping without a shared release. Three engineers are one team. They would pay the full premium - pipelines, tracing, discovery, sagas - for none of the autonomy. A container platform does not change that arithmetic.',
      },
      {
        id: 'ms-9',
        prompt:
          'A request that crosses five services is slow. What do you need to find the slow hop, that a monolith did not need?',
        options: [
          'Longer log retention, so the slow request is still there when you look',
          'A profiler on one host, attached to the service that receives the request',
          'Distributed tracing, with a correlation id passed along on every call',
          'Nothing more - the slowest service always shows the highest CPU on its dashboard',
        ],
        answer: 2,
        explanation:
          'There is no single stack trace across processes. A profiler on one host sees only that host. Tracing joins the spans of one request across services so you can see which hop took the time.',
      },
      {
        id: 'ms-10',
        prompt:
          'A proposal splits the system by technical layer: a validation service, a database service and a UI service. What happens?',
        options: [
          'Clean separation of concerns, since each team becomes expert in one technical layer',
          'Every request crosses every layer over the network, and every feature change touches several services',
          'The system gets faster, because each layer scales alone and the database service can be tuned by specialists',
          'Only the database benefits',
        ],
        answer: 1,
        explanation:
          'Layer services create a chatty dependency in every request path and put every feature across several teams. A service that owns one business capability end to end keeps most changes inside one service.',
      },
    ],
  },
  {
    slug: 'service-oriented-architecture',
    title: 'Service-Oriented Architecture',
    tagline: 'Coarse-grained shared services, often behind a central bus.',
    category: 'architecture',
    difficulty: 'Intermediate',
    lab: 'monolith-microservices',
    labFocus: 'service-oriented-architecture',
    keywords: ['soa', 'esb', 'contracts', 'reuse'],
    what: 'SOA organises a system into coarse-grained services that expose reusable business capabilities, historically connected by an enterprise service bus that handled routing and transformation.',
    why: 'It is the predecessor of microservices and explains many of their design rules - notably why putting logic in the bus turned out badly.',
    how: [
      'Services expose contract-first interfaces (WSDL/SOAP historically, REST/gRPC today).',
      'Services are coarse-grained and share as much as possible, often including one enterprise database.',
      'The bus handles routing, protocol translation and orchestration.',
      'Governance is centralised: shared schemas, shared registry.',
    ],
    when: [
      'An enterprise integrating many existing applications that speak different protocols.',
      'Reusing one authoritative capability, such as customer data, across many departments.',
      'Organisations that want central governance of contracts - as long as the shared layer stays transport-only.',
    ],
    diagram: `Client -> [ Enterprise Service Bus ] -> Billing Service
                     |                   -> CRM Service
              routing, transformation,
              orchestration, logging     <- becomes the bottleneck`,
    advantages: [
      'One reusable service per business capability instead of several partial copies.',
      'Contract-first interfaces that are designed and reviewed before code.',
      'Central visibility and governance of every integration.',
    ],
    tradeoffs: [
      {
        approach: 'SOA with a central bus',
        gains: ['Reuse of shared capabilities', 'Central governance and monitoring', 'Protocol translation between old and new systems'],
        costs: [
          'The bus becomes a bottleneck and a deployment coupling point',
          'Logic in the bus makes it a single point of failure for every capability',
          'Coarse services and shared schemas still release together',
        ],
      },
      {
        approach: 'Microservices with dumb pipes',
        gains: ['Logic stays in the services', 'Each service deploys and scales alone'],
        costs: ['Decentralised governance means less central visibility', 'Each service owns its data, so reuse needs APIs or events'],
      },
    ],
    mistakes: [
      'Putting business logic in the integration layer - the lesson microservices took as "smart endpoints, dumb pipes".',
      'Letting an API gateway grow transformation and orchestration until it becomes an ESB by another name.',
    ],
    related: ['microservices', 'event-driven-architecture', 'api-gateway'],
    quiz: [
      {
        id: 'soa-1',
        prompt:
          'In the Lab (SOA), the bus runs + Orchestrate. You raise Traffic to 1,200 req/s and errors appear. You raise Instances to 8 and the errors stay. Why?',
        options: [
          'New instances take minutes to start, so the errors are the requests that arrive while they boot',
          'The database is saturated, because eight instances open eight times as many connections',
          'The bus is the bottleneck: every message crosses it, and Instances scales only the services',
          'The clients are sending bad requests',
        ],
        answer: 2,
        explanation:
          'Look at the meters: Bus CPU is pinned while both services have room. Adding copies of the services does nothing for the one layer every request crosses. The shared database in the Lab is not modelled as a bottleneck here.',
      },
      {
        id: 'soa-2',
        prompt: 'Same situation: the bus is saturated at 1,200 req/s. Which change in the Lab fixes it?',
        options: [
          'Move transformation and orchestration out of the bus (Routing), so each message costs it less',
          'Break Orders to shed load, so the bus only carries the remaining Customer traffic',
          'Lower Instances to reduce contention, so fewer services compete for the bus',
          'Put more logic in the bus so it makes fewer round trips to the services per message',
        ],
        answer: 0,
        explanation:
          'Each message costs the bus x2.2 at + Orchestrate and x1 at Routing, so the same traffic needs less than half the bus capacity. That is smart endpoints, dumb pipes: the logic moves to the services, which can scale. Breaking a service drops requests instead of serving them.',
      },
      {
        id: 'soa-3',
        prompt:
          'In the Lab (SOA), you press Bad bus deploy. Every capability fails, although both services are healthy. What does that show?',
        options: [
          'The services were misconfigured by the same release, so they reject everything the bus forwards',
          'Every request depends on the one shared bus, so a bad change there breaks everything',
          'The shared database failed, since the bus deploy ran a schema change on it',
          'Only Orders is affected',
        ],
        answer: 1,
        explanation:
          'The services never see the traffic - it dies in the bus. Clustering the bus protects against a crashed machine, not against a bad rule deployed to all of it, which is why logic in a shared layer is so risky.',
      },
      {
        id: 'soa-4',
        prompt: 'In the Lab (SOA), you press Break Users, and Notifications goes down too. Why?',
        options: [
          'Notifications calls Users synchronously on every request to look up the address it sends to',
          'The bus has a bug that drops every message addressed to the Customer side',
          'The shared database locked up when Users crashed in the middle of a write',
          'Users and Notifications share one coarse Customer Service process, so they fail together',
        ],
        answer: 3,
        explanation:
          'SOA services are coarse-grained: several capabilities per service. The blast radius of a crash is the whole service - compare Microservices mode, where breaking Users leaves Notifications running.',
      },
      {
        id: 'soa-5',
        prompt:
          'The rule "prefer the partner price" lives in the orchestration config of the bus, and the pricing team must change it. What typically happens?',
        options: [
          'The pricing team deploys the change on its own, since pricing owns the rule',
          'No deploy is needed, because it is only configuration, and the bus reloads its config at runtime',
          'It waits for the team that owns the bus, and the bus deploy puts every integration at risk',
          'Only the clients need to change, since they choose which price to request',
        ],
        answer: 2,
        explanation:
          'Business logic in shared infrastructure turns the bus team into a bottleneck for every other team, and every bus release is a risk for everyone. Configuration is still a change to a system everything depends on.',
      },
      {
        id: 'soa-6',
        prompt:
          'Over two years, an API gateway has gained request transformation, business validation and an aggregation route with pricing rules. What is forming?',
        options: [
          'An ESB by another name: business logic in a shared layer, with the same bottleneck',
          'A healthy microservices platform, where the gateway handles cross-cutting concerns',
          'A service mesh that has moved from the sidecars into the gateway',
          'A modular monolith',
        ],
        answer: 0,
        explanation:
          'The pattern returns whenever a shared layer accepts logic, one reasonable change at a time. The fix is to move validation back into the owning service, move aggregation into a small backend owned by the client team, and write down what the gateway may do.',
      },
      {
        id: 'soa-7',
        prompt: 'What should a shared infrastructure layer - a gateway, a mesh or a bus - be allowed to do?',
        options: [
          'Business validation and orchestration, because all traffic already passes through it anyway',
          'Transport concerns: routing, authentication, retries, rate limiting and observability',
          'Nothing at all',
          'Write to the databases of the services directly, to save a hop on hot paths',
        ],
        answer: 1,
        explanation:
          'Transport concerns are the same for every service, so a shared layer is the right place for them. A business rule belongs to one service and its team - if changing it means changing the gateway, the boundary has been crossed.',
      },
      {
        id: 'soa-8',
        prompt:
          'Five departments each keep their own partial customer records. Which SOA idea addresses this, and still holds today?',
        options: [
          'Put the customer logic in the bus, so every department reaches it through one shared route',
          'Let every department read the other customer tables directly',
          'Delete four of the systems without a replacement',
          'One reusable customer service with a contract-first interface that every department calls',
        ],
        answer: 3,
        explanation:
          'One authoritative service per business capability is the reuse SOA aimed for, and microservices keep it as data ownership. Putting the logic in the bus is the part of SOA that failed; direct table reads couple every department to one schema.',
      },
      {
        id: 'soa-9',
        prompt:
          'A team writes and reviews an OpenAPI spec with its consumers before writing any code. Which SOA practice is this, and why keep it?',
        options: [
          'Orchestration, because it centralises the workflow in one reviewed spec',
          'Bus routing, because consumers depend on the spec instead of the endpoints',
          'Contract-first: the interface is a deliberate design reviewed by its callers',
          'Central governance, because every deploy needs approval from the consumers first',
        ],
        answer: 2,
        explanation:
          'Contract-first - WSDL then, OpenAPI or protobuf now - is the part of SOA worth keeping. It is not orchestration or routing; and it needs no central approval of every deploy, which is the governance that slowed SOA down.',
      },
      {
        id: 'soa-10',
        prompt:
          'In the Lab (SOA), both services use one Enterprise DB with a shared schema. The Order Service team wants to rename a column in a shared table. What is the risk?',
        options: [
          'Every service that reads that table can break, so the rename needs coordination across teams',
          'None - the bus translates the old column name for every service that still uses it',
          'Only a small performance cost while the database rewrites the table',
          'The bus rejects the change until every consumer has signed off on the new schema',
        ],
        answer: 0,
        explanation:
          'Sharing data is what gives SOA its reuse, and it is also what couples teams: one schema change is a problem for everyone. Microservices answer with one database per service, at the cost of joins and transactions across services.',
      },
    ],
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
          'The database needs an index for the webhook query, which scans the whole table on each call',
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
          'Cap the concurrency of the function and put a connection pooler in front of the database',
          'Give the function more memory so each write finishes faster and holds its connection for less time',
          'Turn on provisioned concurrency for 5,000 instances, so none of them pays a cold start while connecting',
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
          'Functions are billed for the idle time between requests too, so 24 hours of traffic means 24 hours of billing',
          'Cold starts are billed at a premium rate, and every one of the 2,000 requests per second pays one',
          'Serverless always costs more than servers, because the provider adds its margin to every request',
          'The servers were rarely idle, and a busy function second costs more than a busy server second',
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
          'Upload-triggered functions: they follow the bursts, idle nights are free, and nobody waits on a cold start',
          'Always-on servers sized for the peak, because a cold start on every burst would make the resizing too slow',
          'Functions, because serverless is always the cheapest option whatever the traffic looks like',
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
          'Raise the concurrency limit so more instances can start in parallel during the ramp',
          'Retry requests that take longer than 1 s, so a slow cold start is replaced by a warm instance',
          'Provision concurrency for the baseline of 20 (or cut the init work), paying for warm instances',
          'Ask the platform to reclaim idle instances sooner, so fresh instances are ready for the morning',
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
          'Four instances, each running several requests at once to absorb the load',
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
          'The platform clears global variables after every request, so each request starts again from zero',
          'The function needs more memory, so the platform stops evicting the counter from RAM',
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
          'The function no longer scales above 50, so extra requests queue and run longer',
        ],
        answer: 2,
        explanation:
          'Provisioned concurrency buys warm instances by the second, so that part of the function stops scaling to zero and pays for 22 idle hours a day - in the Lab, raising Provisioned concurrency adds cost even when no events arrive. Scheduling it for the busy two hours keeps the benefit at a fraction of the cost. It does not cap scaling: above 50 the function still scales on demand.',
      },
      {
        id: 'serverless-q10',
        prompt: 'A nightly report job takes 40 minutes to run. The team wants to move it to AWS Lambda. What do you tell them?',
        options: [
          'Raise the function memory until it fits, since more memory also gives the function more CPU',
          'Split it into steps under the 15-minute limit, or run it in a container',
          'Use provisioned concurrency so the instance stays warm and the job does not hit the timeout',
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
          'The event source delivers some events more than once; make the handler idempotent by object id and version',
          'Two instances cold started for the same file at once; turn on provisioned concurrency so one warm instance takes it',
          'The concurrency limit is too high; lower it to 1',
          'The email service is retrying after the function times out; raise the function timeout',
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
          'Yes - the message is dropped when no warm instance is ready to take it',
          'Yes - cold starts are billed, so provisioned concurrency is always cheaper',
          'Usually not - 800 ms on background work is noise, and it adds a fixed bill',
          'No - provisioned concurrency does not work for queue triggers, only for HTTP',
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
          'The write failed silently and the old row is still in place - retry the command',
          'A cache in front of the read model is serving the old page, so caching must be disabled everywhere',
          'Read lag; show the new name from the command result, or read the write side for this screen',
          'The read model is corrupt and must be rebuilt from the events before the name shows up',
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
          'Yes - CQRS always makes reads faster, even when reads and writes are balanced',
          'Keep one model; an asynchronous read store adds lag and moving parts for no gain here',
          'Yes, but also add event sourcing so the read model can be rebuilt after any bug',
          'Use two write databases instead, so each form gets its own store',
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
          'Add more indexes to all 6 tables and keep the join, so the database does the work it is built for',
          'Cache the whole page for a day, since products change only a few times an hour',
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
          'In the read model, because it has the current balance ready without replaying anything',
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
          'Leave it - new events will slowly correct the old totals as the projector applies them',
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
          'Commands start failing because the read side is full and pushes back on the write side',
          'The projector drops 2 events per second to keep up, so the read model loses data',
          'Commands still succeed, but read lag grows without limit and queries see older data',
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
          'The read model stops being derived: the next rebuild erases their data',
          'None - a read model is just a table, and any team can add a column to it',
          'Only performance: two writers contend for locks on the same rows of the table',
          'Their writes would be copied back to the write side and overwrite real data',
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
          'Yes - projections can only be built from an event store, which a relational database is not',
          'Yes - Elasticsearch ingests events and cannot index rows read from a database',
          'No - but without event sourcing the read model can never be rebuilt',
          'No - the two are independent; feed it from domain events or change data capture',
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
          'Add a column to the write model and query it with a join, since the data is already there',
          'A new projection over the same events, filled first by replaying history',
          'Change the existing read model and every screen that uses it to the new grouping',
          'Let the screen query the event log directly and group the orders in memory',
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
          'Separate code paths on one database, updating any read table in the same transaction',
          'An asynchronous projection with the delay lowered to a few milliseconds',
          'A second read model in a faster in-memory database, updated from the events within a millisecond',
          'Polling the read model after each write until the new value appears there',
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
          'Read the balance from the latest snapshot of the stream',
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
          'Delete the oldest events once they are applied to the current state',
          'Snapshot every 1,000 events and load the latest snapshot plus the events after it',
          'Switch the order to a normal table and keep the events only as an audit log',
          'Replay in parallel on 20 threads, each folding 1,000 events, and merge the results',
        ],
        answer: 1,
        explanation:
          'A snapshot stores the folded state at an event number, so loading replays at most 1,000 events instead of 20,000. Deleting events destroys the history that is the point of event sourcing. In the Lab, turn Snapshots on and rebuild twice: the second rebuild replays only the events after the snapshot.',
      },
      {
        id: 'es-3',
        prompt: 'A customer invokes the GDPR right to erasure. Their personal data is inside immutable events. What works?',
        options: [
          'Crypto-shredding: the data was encrypted with a per-customer key, and you delete the key',
          'Rewrite the affected events in place with the personal fields removed and the rest kept',
          'Delete the whole stream and every projection built from it',
          'Nothing - event sourcing is exempt, because the log is a legal record',
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
          'Run a migration that adds a default currency to every old event in the store',
          'Refuse to load old events from now on, so every account starts again on the new shape',
          'Delete the old events and start a new stream from the current balances',
          'Version the event and add an upcaster that fills in a default currency on read',
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
          'Write a new projection over the ItemAdded events and replay all history into it',
          'It cannot be answered - nobody planned the question, so no report table ever recorded it',
          'Query the current order rows and count the items on each order',
          'Add logging for added items now and answer the question next year',
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
          'Yes - one pattern everywhere is simpler for the team to learn and operate',
          'Keep them as ordinary tables; their history has no business value',
          'Yes, but only with snapshots, so loading a product or a preference stays fast',
          'Event-source them and drop the order events instead, since orders are done',
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
          'The rebuild works - Kafka keeps every topic forever unless someone deletes it',
          'The rebuild is only slower, because Kafka fetches the older events from cold storage',
          'Only the last 7 days of events are left, so the rebuilt state is wrong',
          'Kafka refuses to start the rebuild until retention is raised on the topic',
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
          'The events were duplicated in the store when the rebuild re-read them',
          'The email code runs in the projection, so replay sends the emails again',
          'Snapshots were turned off, so the replay started from the first event',
          'The rebuild was too fast for the mail server, which retried every send',
        ],
        answer: 1,
        explanation:
          'Replaying must only rebuild state. Side effects such as emails belong to a separate consumer that does not replay, or that remembers what it already did (idempotency). Nothing is wrong with the events themselves.',
      },
      {
        id: 'es-9',
        prompt: 'A deposit of 100 was recorded twice by mistake. How do you correct it?',
        options: [
          'Delete the duplicate event, since it should never have been recorded',
          'Edit the second event to an amount of 0, so the history keeps its shape',
          'Change the balance in the read model by hand and note it in a ticket',
          'Append a compensating event, such as DepositReversed of 100',
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
          'Start from the snapshot - it is faster, and the fix applies to the events after it',
          'Start from the snapshot and replay the last 100 events twice to wash out the bug',
          'Keep the old read model - the fix only matters for events that arrive from now on',
        ],
        answer: 0,
        explanation:
          'A snapshot is the output of one version of the projection code, so it carries the bug. Replaying from the start with fixed code is the only way to a correct state. In the Lab, changing the Projector bug toggle discards the snapshot for exactly this reason.',
      },
    ],
  },
];
