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
          'Build the eight services now, because splitting a monolith later is impossible',
          'Build the eight services but let them share one database to keep it simple',
          'Start with one monolith with clear internal modules, and extract a service only when a specific pressure appears',
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
          'Every feature runs in the same process, so a crash in the payments code takes down the process that serves every feature',
          'The load balancer stops routing traffic as soon as one feature fails',
          'The database locks every table when payments fails',
          'Users calls Payments on every request',
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
          'Scale only the Orders code inside the running process',
          'Buy a bigger database server',
          'Split Orders into a microservice - it is the only way a monolith can scale',
          'Run more copies of the whole application behind the load balancer; every feature is copied along with Orders, which costs memory but works',
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
          'A saga with a compensating action for every step',
          'One database transaction: begin, three writes, commit - if any write fails, all three roll back',
          'Two-phase commit between three services',
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
          'The monolith is too slow',
          'The database is too small',
          'Deployment coupling: everyone ships on one release train, so each deploy waits for and risks everyone else',
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
          'The tangled calls become network calls - a distributed big ball of mud. Clean up the boundaries inside the monolith first',
          'Microservices untangle the dependencies automatically',
          'It proves monoliths stop working past a certain size',
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
          'Move every feature into its own microservice',
          'Extract only PDF generation into a separate worker, because it has a genuinely different resource profile, and keep the rest in the monolith',
          'Give every instance 64 GB of memory',
          'Ignore it, because restarts are automatic',
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
          'Microservices are written in slower languages',
          'The monolith caches every response',
          'Microservices have no database',
          'Inside a monolith, features call each other in-process; with microservices each call is a network hop with serialization and its own queueing',
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
          'Only Notifications slows down',
          'The load balancer isolates the leak on one instance',
          'Every instance runs the same code, so every instance leaks and restarts in turn - all features are affected, not just Notifications',
          'Nothing - the instances are stateless',
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
          'Nothing - both need the same tooling',
          'One stack trace and one log stream cover the whole request, so a profiler shows where the time went without distributed tracing',
          'Monoliths retry slow requests automatically',
          'Monoliths always use a faster database',
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
          'None - it is one process, so any code may read any table',
          'Billing can no longer change its tables, or be extracted, without breaking orders - the data boundary is gone',
          'Orders becomes faster and safer',
          'The database refuses the query',
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
          'Extraction needs more instances first',
          'Payments receives too much traffic to run alone',
          'The load balancer cannot route to a second service',
          'Orders now reads the payments tables directly, so moving those tables to another database would break Orders - each such query must go through the Payments interface first',
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
          'The Lab: modules are a code boundary, not a process boundary. All modules share one process, so a crash takes them all down',
          'The teammate: modules isolate faults the way services do',
          'Neither: only Notifications and Users fail',
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
          'Asking reviewers to look out for it',
          'A check that fails the build - a lint rule or module visibility that rejects imports of internals - plus a test on which tables each module touches',
          'Splitting into microservices so imports become impossible',
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
          'A saga, because the modules are separate',
          'One database transaction: the calls are in-process and the database is shared, and each module still writes only its own tables',
          'Two-phase commit between the modules',
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
          'Rewriting the whole system',
          'Months of untangling joins with other modules',
          'Splitting every module into a service at the same time',
          'Putting the existing interface behind a network call, moving its tables, deploying it separately - and adding timeouts, retries and a fallback, because the call can now fail',
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
          'The Orders to Payments call is now a network hop that can be slow or fail; before, it was an in-process function call',
          'The database became slower',
          'The monolith lost instances',
          'Payments receives more traffic than before',
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
          'One microservice per business area, each with its own pipeline',
          'Accept the conflicts - they come with any monolith',
          'A modular monolith: one module per business area with enforced boundaries and its own tables, still one deploy',
          'SOA with an enterprise service bus between the areas',
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
          'Cycles only make the build slower',
          'With a cycle, neither module can change or be extracted without the other - dependencies should point one way',
          'Cycles are required for modules to talk',
          'Cycles only matter in microservices',
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
          'Only Users requests fail',
          'Every request fails, including Payments',
          'Nothing fails',
          'The monolith process crashes, so Users, Orders and Notifications fail; the extracted Payments service keeps serving its own requests',
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
          'The team wants to try a new technology',
          'Eight teams are blocked behind a single shared release train and own clearly separate business capabilities',
          'The application feels slow',
          'The codebase has grown to 100k lines',
        ],
        answer: 1,
        explanation:
          'The primary benefit is independent deployability for independent teams. A slow application gets slower with network hops, and a large codebase is a case for module boundaries, not for a network between them.',
      },
      {
        id: 'ms-2',
        prompt: 'Two microservices share one database. What is the consequence?',
        options: [
          'Better performance, because there is one fewer database',
          'Stronger fault isolation',
          'A distributed monolith: schema changes couple the services, so they must be deployed together',
          'Simpler transactions with no downside',
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
          'Orders calls Payments synchronously, so every Orders request that needs Payments fails with it - the caller is only as available as the callee',
          'The API Gateway went down',
          'Orders shares the Payments database',
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
          'A database rollback across all three services',
          'Two-phase commit, the standard for microservices',
          'Nothing - the stock simply stays reserved',
          'A saga: each step has a compensating action - release the stock, cancel the order - which you write yourself and make idempotent',
        ],
        answer: 3,
        explanation:
          'There is no transaction across separate databases, so there is no rollback. Two-phase commit across services is rarely used because it blocks on the slowest participant and couples their availability. Compensation is code you own, and it can fail and be retried, so it must be idempotent.',
      },
      {
        id: 'ms-5',
        prompt:
          'One page view calls six services in sequence, and each is available 99.9% of the time, independently. Roughly how available is the page?',
        options: ['99.9%', '99.99%', 'About 99.4%, because the chain works only when all six do: 0.999 to the power of 6', 'About 94%'],
        answer: 2,
        explanation:
          'Availability of a serial chain multiplies: 0.999^6 is about 0.994, six times the downtime of any single service. 99.9% would hold only with one service; 94% would be the result with six services at 99% each.',
      },
      {
        id: 'ms-6',
        prompt:
          'Adding one field to the checkout flow routinely means changing four services and deploying them in a fixed order. What is the diagnosis?',
        options: [
          'There are too few services',
          'The boundaries are wrong - a distributed monolith. Merge the services that always change together, or redraw them by business capability',
          'The team needs a service mesh',
          'The team needs more engineers',
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
          'Only the Orders service - Users, Payments and Notifications keep their size',
          'Every service, equally',
          'The API Gateway',
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
          'Go ahead - scaling early saves a rewrite',
          'Go ahead, as long as they use Kubernetes',
          'One service per engineer, so nobody waits for anyone',
          'Start with a monolith: three people would own several services each plus the platform, and the benefit - independent teams - does not exist yet',
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
          'A bigger log file',
          'A profiler on one host',
          'Distributed tracing, with a correlation id passed along on every call so the spans of one request can be joined',
          'Nothing more',
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
          'Clean separation of concerns with no downside',
          'Every request crosses every layer over the network, and every feature change touches several services - split by business capability instead',
          'The system gets faster, because each layer scales alone',
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
          'New instances take minutes to start',
          'The database is saturated',
          'The bus is the bottleneck: every message passes through it, and Instances scales only the services behind it',
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
          'Move transformation and orchestration out of the bus (Routing), so each message costs the bus less work',
          'Break Orders to shed load',
          'Lower Instances to reduce contention',
          'Put more logic in the bus so it does fewer round trips',
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
          'The services were misconfigured',
          'Every request depends on the one shared bus, so a bad change there is a single point of failure for the whole system',
          'The database failed',
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
          'Notifications calls Users on every request',
          'The bus has a bug',
          'The shared database locked up',
          'Users and Notifications are packed into one coarse Customer Service, so they run in one process and fail together',
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
          'The pricing team deploys the change on its own',
          'No deploy is needed, because it is only configuration',
          'The change waits for the team that owns the shared bus, and a bus deploy puts every integration at risk',
          'Only the clients need to change',
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
          'An ESB by another name: business logic in a shared layer, with the same bottleneck and deployment coupling',
          'A healthy microservices platform',
          'A service mesh',
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
          'Business validation and orchestration, because all traffic passes through it',
          'Transport concerns: routing, authentication, retries, rate limiting and observability - business decisions stay in the services',
          'Nothing at all',
          'Write to the databases of the services directly',
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
          'Put the customer logic in the bus so every department can reach it',
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
          'Orchestration, because it centralises the workflow',
          'Bus routing, because it hides the endpoints',
          'Contract-first: the interface is a deliberate design reviewed by its callers, not whatever the code happened to expose',
          'Central governance, because every deploy needs approval',
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
          'Every other service that reads that table can break, so the change needs coordination across teams - sharing as much as possible couples releases',
          'None - the bus translates the old name',
          'Only a small performance cost',
          'The bus rejects the change',
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
