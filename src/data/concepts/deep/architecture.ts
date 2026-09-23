import type { DepthMap } from './types';

export const architectureDepth: DepthMap = {
  monolith: {
    analogy: {
      title: 'One big kitchen',
      body:
        'Everything is cooked in one room: the chefs shout across it, ingredients are shared from one fridge, and a dish moves from prep to plate without leaving the building. That is fast and simple, and it works until there are forty chefs in the room bumping into each other and one burnt pan fills the whole kitchen with smoke.',
    },
    deepDive: [
      {
        heading: 'What a monolith actually gives you',
        paragraphs: [
          'A single deployable unit means a function call instead of a network call: no serialisation, no timeouts, no partial failure, microseconds instead of milliseconds. It means one database and therefore real transactions across your whole domain. It means a stack trace that covers the entire request, and one place to look when something is wrong.',
          'It also means one thing to deploy, one set of credentials, one CI pipeline, one runbook. For a small team, the operational savings alone are larger than most of the theoretical benefits of splitting - you can build features instead of building infrastructure to connect services.',
          'This is why "start with a monolith" is not conservatism, it is arithmetic. A team of five that splits into eight services has each engineer maintaining more than one service, and the coordination cost of a change that spans three of them exceeds anything the split bought.',
        ],
        bullets: [
          'In-process calls: no network, no retries, no partial failure.',
          'One database: real ACID transactions across the whole domain.',
          'One deploy, one log stream, one profiler, one stack trace.',
          'Refactoring across boundaries is a rename, not a migration and a contract negotiation.',
        ],
      },
      {
        heading: 'Where it genuinely hurts',
        paragraphs: [
          'The first real pain is deployment coupling. Every change, however small, redeploys everything, so one risky feature can block an urgent fix and a bad deploy affects all functionality. As the team grows, the queue for deploys and the blast radius of each one both grow with it.',
          'The second is scaling granularity. If image processing needs 32 GB of memory and the rest of the application needs 2 GB, you scale the whole thing to 32 GB per instance. You cannot give the hot path more capacity without paying for everything attached to it.',
          'The third is the one that actually forces most splits: technology and team coupling. Everybody works in the same codebase, in the same language, with the same framework version and the same upgrade schedule. At a certain team size the merge conflicts, the coordination and the shared release train cost more than distributed systems do.',
        ],
        code: {
          caption: 'The costs you feel, in order of appearance',
          body: `team size   what hurts first
  1-10      nothing; a monolith is clearly right
 10-30      deploy queue, test suite duration, merge conflicts
 30-80      blast radius of each deploy, scaling one hot component
  80+       coordination across teams in one release train

notice: none of these are about performance.
They are about people and deployment, which is why the fix
is module boundaries first, separate processes second.`,
        },
      },
      {
        heading: 'The big ball of mud is not the same thing',
        paragraphs: [
          'A monolith is a deployment shape. A tangled codebase where every module imports every other is a design failure, and it can happen at any architecture - a set of microservices that all share a database and call each other synchronously is a distributed big ball of mud, which is strictly worse.',
          'So the productive work is to keep clear internal boundaries regardless: separate modules with explicit interfaces, no reaching into another module tables, dependencies pointing one way. That discipline costs little inside one process and is what makes a future split feasible.',
          'The practical sequence most successful systems follow: monolith, then modular monolith with enforced boundaries, then extract the specific modules that have a clear reason to be separate. Splitting a tangled monolith directly into services converts internal mess into network calls and makes it permanent.',
        ],
      },
    ],
    examples: [
      {
        title: 'When the monolith was the right answer for four years',
        setup:
          'A startup builds a B2B product. Two engineers, then six, then fifteen. They stay on one Rails monolith and one Postgres database until year four.',
        walkthrough: [
          'Years 1-2: every feature is a controller, a model and a migration. Deploys take four minutes, a bug is one stack trace, and the team ships weekly. Microservices would have consumed most of their engineering time on plumbing.',
          'Year 3: the test suite reaches 25 minutes and deploys queue up. Fixed with parallel test execution and a merge queue - not with an architecture change.',
          'Year 3, second issue: PDF generation uses 6 GB of memory and occasionally triggers out-of-memory kills for everything. This is extracted into a separate worker service, because it has a genuinely different resource profile.',
          'Year 4: the team is 15 people across three product areas, and merge conflicts in shared files are constant. The response is module boundaries with enforced dependencies, not a split.',
          'Year 4, later: the public API for partners is extracted, because it has different availability requirements and a different release cadence than the internal product.',
          'Everything else remains in the monolith, and the team considers that a success rather than technical debt.',
        ],
        result:
          'Two services were extracted in four years, each for a specific, measurable reason - memory profile and release cadence. The default stayed monolithic, which is why a small team could ship product instead of infrastructure.',
      },
    ],
    jargon: [
      { term: 'Monolith', plain: 'One deployable unit containing the whole application.' },
      { term: 'Deployment coupling', plain: 'Every change requires redeploying everything.' },
      { term: 'Big ball of mud', plain: 'A codebase with no boundaries. A design failure, independent of deployment shape.' },
      { term: 'Blast radius', plain: 'How much a single bad deploy can affect.' },
      { term: 'Release train', plain: 'Everyone shipping together on a shared schedule.' },
      { term: 'Vertical slice', plain: 'A feature implemented end to end within one module.' },
    ],
    remember: [
      'A monolith gives you transactions, stack traces and one deploy - real advantages, not just simplicity.',
      'The pain is deployment coupling and team coordination, rarely performance.',
      'Tangled code is a different problem from monolithic deployment; fix boundaries first.',
      'Extract a service when it has a specific reason: resource profile, release cadence, team ownership.',
      'Splitting a mess into services makes the mess permanent and adds a network.',
    ],
  },

  'modular-monolith': {
    analogy: {
      title: 'One building, clearly separated departments',
      body:
        'Everyone works in the same building, so a conversation is a short walk. But each department has its own room, its own filing cabinet, and a rule that you request things at the counter rather than rummaging in someone else drawers. You get the speed of proximity and the clarity of boundaries - and if a department ever needs its own building, it can move without unpicking everything.',
    },
    deepDive: [
      {
        heading: 'Boundaries without the network',
        paragraphs: [
          'A modular monolith is one deployable unit with enforced internal boundaries: modules own their data, expose explicit interfaces, and may not reach into each other internals. You get most of the design benefits attributed to microservices - clear ownership, independent reasoning, replaceable components - without distributed transactions, network failures or service discovery.',
          'The critical rule is data ownership. Each module owns its tables, and no other module queries them directly; access goes through the module public interface. This is the boundary that actually matters, because shared tables are what make services impossible to separate later - and shared tables inside a monolith are just as corrosive.',
          'Calls between modules remain in-process function calls, so they cost microseconds and cannot fail halfway. You keep real transactions across modules where you need them, which is a genuine advantage that a service split gives away permanently.',
        ],
        code: {
          caption: 'What the boundary looks like in practice',
          body: `src/
  billing/
    api.ts        <- the ONLY file other modules may import
    internal/     <- enforced private: handlers, repos, entities
    tables: invoices, payments   (owned; nobody else queries them)
  orders/
    api.ts
    internal/
    tables: orders, order_items

orders imports billing/api       -> allowed
orders imports billing/internal  -> build fails (lint rule / module system)
orders queries invoices table    -> review rejects; there is a test for it`,
        },
      },
      {
        heading: 'Enforcement is the whole game',
        paragraphs: [
          'Boundaries that exist only in documentation erode in weeks, because the shortest path to a deadline is always a direct import. What makes a modular monolith work is mechanical enforcement: a linter rule, a module system, a dependency check in CI, or language-level visibility - whichever your stack supports.',
          'Java and C# have package and assembly visibility; TypeScript projects use ESLint boundary rules or project references; Python uses import linters. The tool matters less than the fact that a violation fails the build rather than depending on a reviewer noticing.',
          'Add a check for the database too. A test that asserts each module only touches its own tables catches the most damaging violation, and it is usually simple to write by inspecting queries in a test run or by granting each module its own database schema with permissions.',
        ],
        bullets: [
          'One public entry point per module; everything else private and enforced.',
          'Each module owns its tables. No cross-module queries, ever.',
          'Dependencies point one way - detect cycles in CI.',
          'Cross-module communication through interfaces, or in-process events for decoupling.',
          'A violation must fail the build, not a code review.',
        ],
      },
      {
        heading: 'The sensible path to services, if you ever need them',
        paragraphs: [
          'A well-modularised monolith is the best possible starting point for extraction. The interface already exists, the data is already separated, and the dependencies are already known. Extracting a module becomes: put the interface behind HTTP or a queue, move its tables, deploy separately - a week of work rather than a year.',
          'It also lets you extract selectively and for real reasons, which is the mature version of the microservices decision. One module needs different scaling, another needs a different language, a third is owned by a separate team - extract those three and leave the other twelve where they are.',
          'And there is a real possibility you never extract anything. Plenty of successful large products run as modular monoliths deliberately, because the deployment simplicity is worth more than independent deploys. The architecture keeps that option open in both directions, which is exactly what you want when you cannot predict the future.',
        ],
      },
    ],
    examples: [
      {
        title: 'Extracting a module in a week instead of a quarter',
        setup:
          'A modular monolith has 12 modules with enforced boundaries. The search module needs a different language and much more memory, so it is extracted.',
        walkthrough: [
          'The interface already exists: other modules call search.query(...) and nothing else. There is exactly one place to change.',
          'Data: search owns its own tables and indexes already, so there are no cross-module joins to untangle - the hardest part of most extractions is already done.',
          'Step 1: implement the same interface as an HTTP client, behind a feature flag, so traffic can be switched gradually.',
          'Step 2: deploy the new service, replicate the data, and run both paths in parallel comparing results.',
          'Step 3: switch the flag, monitor, and remove the in-process implementation.',
          'New costs that appear immediately and permanently: the call can now time out, so it needs a timeout, a retry policy and a fallback; results may be briefly stale; and there is a second deployment pipeline and dashboard to maintain.',
          'Contrast: a module with cross-module joins and shared tables would have needed months of data untangling before any of this could start.',
        ],
        result:
          'The extraction took a week because the boundary work had already been done. That is the real argument for modular monoliths: the design work that makes services possible is worth doing even if you never build them.',
      },
    ],
    jargon: [
      { term: 'Module', plain: 'A bounded unit of code with its own data and a single public interface.' },
      { term: 'Bounded context', plain: 'The domain-driven design term for a boundary within which a model is consistent.' },
      { term: 'Dependency rule', plain: 'Which modules may import which. Enforced by tooling, not by convention.' },
      { term: 'In-process events', plain: 'Publishing events inside one process so modules decouple without a network.' },
      { term: 'Data ownership', plain: 'One module writes and reads a table; others go through its interface.' },
      { term: 'Strangler fig', plain: 'Gradually routing traffic from the old implementation to the new one.' },
    ],
    remember: [
      'Modules with enforced boundaries give you design clarity without network calls.',
      'Data ownership is the boundary that matters most - shared tables ruin everything else.',
      'Enforce with tooling; documented boundaries erode within weeks.',
      'Keep dependencies one-directional and check for cycles in CI.',
      'This is the cheapest way to keep the option of services open - and to discover you may not need them.',
    ],
  },

  microservices: {
    analogy: {
      title: 'Separate specialist shops on one street',
      body:
        'The baker, the butcher and the florist each own their premises, their stock and their opening hours. Each can rebuild their shop without closing the street. But a customer who wants a hamper now has to visit three shops, and if the butcher is closed the hamper is incomplete - so somebody has to decide what a partial hamper looks like.',
    },
    deepDive: [
      {
        heading: 'The benefit is organisational before it is technical',
        paragraphs: [
          'The genuine, durable benefit of microservices is independent deployment by independent teams. A team can ship without coordinating with five others, choose its own stack, and scale its own component. At a certain organisation size, that autonomy is worth a great deal.',
          'Notice that the benefit is about people. Microservices do not make a system faster - in-process calls are always faster than network calls. They do not make it more reliable by default - more moving parts and more network hops usually make it less so until you invest in resilience. They make a large organisation able to move in parallel.',
          'This is why Conway law is the most useful lens: your architecture will mirror your communication structure. Services that map to team boundaries work; services that require three teams to coordinate on every change have all the costs and none of the autonomy.',
        ],
        bullets: [
          'Independent deploy, independent scaling, independent technology choice.',
          'Fault isolation - if it is designed for, which is extra work.',
          'Clear ownership: one team, one service, one pager.',
          'None of this helps a team of eight, which is the most common misapplication.',
        ],
      },
      {
        heading: 'The costs, stated in full',
        paragraphs: [
          'Every in-process call becomes a network call that can be slow, fail, or succeed without you knowing. Every cross-service operation loses transactions and needs sagas with compensation. Every request needs distributed tracing to be debuggable, because there is no single stack trace any more.',
          'Data becomes the hardest part. Each service owning its data is the whole point, but it means joins across services do not exist, reports need a separate aggregation path, and the same entity is represented differently in several places. Teams that skip this and share one database have built a distributed monolith: all the network costs, none of the independence.',
          'And operations multiply: N deployment pipelines, N sets of dashboards and alerts, service discovery, contract versioning, a local development story that lets one engineer run enough of the system to work. This is why microservices need platform investment before they pay off, and why they hurt so much without it.',
        ],
        code: {
          caption: 'The same operation, both ways',
          body: `MONOLITH
  BEGIN
    orders.insert(...)
    inventory.decrement(...)
    payments.charge(...)
  COMMIT                       one transaction, all or nothing

MICROSERVICES
  order-service   creates order (pending)
    -> event OrderPlaced
  inventory-svc   reserves stock -> StockReserved  (or StockUnavailable)
  payment-svc     charges card   -> PaymentTaken   (or PaymentFailed)
  order-service   marks confirmed, OR compensates:
                  release stock, refund, cancel order

no rollback exists. You write the compensation yourself, and it
must be idempotent, and it can fail too.`,
        },
      },
      {
        heading: 'Getting the boundaries right',
        paragraphs: [
          'Split by business capability, not by technical layer. An "orders" service that owns everything about orders is coherent; a "database service" or a "validation service" creates a chatty dependency in every request path and is a classic early mistake.',
          'The test of a good boundary is that most changes touch one service. If adding a field routinely requires modifying four services and coordinating their deploys, the boundary is wrong - you have distributed a single module and kept all its coupling.',
          'Size is a distraction. "Micro" is not a line count; a service should be as large as one team can own and as small as one coherent capability. Two-pizza teams owning several services each is common and fine, and a service with 50,000 lines that one team owns is not a failure.',
        ],
      },
    ],
    examples: [
      {
        title: 'The distributed monolith, and how to recognise it',
        setup:
          'A team splits into 8 services. Six months later, deploys are slower than before the split and incidents have doubled.',
        walkthrough: [
          'Symptom 1: all 8 services read and write the same database. A schema change requires coordinating 8 deploys - worse than the monolith, which needed one.',
          'Symptom 2: a single user request traverses 6 services synchronously. Availability is now the product of six numbers, and p99 latency is the sum of six tails.',
          'Symptom 3: services must be deployed in a specific order because of shared contracts, so "independent deployment" does not exist.',
          'Symptom 4: nobody can run the system locally, so development requires a shared staging environment and a queue to use it.',
          'Diagnosis: they distributed the code without distributing the data or the coupling - the definition of a distributed monolith.',
          'Fix 1: give each service its own database, even if that means duplicating some data and replacing joins with API calls or events.',
          'Fix 2: make cross-service calls asynchronous where the user does not need the result immediately, breaking the availability multiplication.',
          'Fix 3: merge the services that always change together. Three of the eight become one, which is a success, not a retreat.',
        ],
        result:
          'The number of services fell from 8 to 5 and reliability improved. Independent data and independent deploys are the point; without them, services are network calls added to a monolith.',
      },
    ],
    jargon: [
      { term: 'Distributed monolith', plain: 'Services that must deploy together or share a database. Worst of both worlds.' },
      { term: 'Bounded context', plain: 'A business capability boundary that a service should align to.' },
      { term: 'Saga', plain: 'A multi-step transaction across services with compensating actions instead of rollback.' },
      { term: 'Service mesh', plain: 'Sidecars providing mTLS, retries, timeouts and tracing between services.' },
      { term: 'Conway law', plain: 'Systems mirror the communication structure of the organisation that builds them.' },
      { term: 'Chatty interface', plain: 'A boundary that requires many calls per operation. Usually a wrong boundary.' },
    ],
    remember: [
      'The real benefit is independent deployment by independent teams - an organisational one.',
      'Each service must own its data, or you have built a distributed monolith.',
      'Transactions are replaced by sagas and compensation that you write and maintain.',
      'Split by business capability; if one change touches four services, the boundary is wrong.',
      'Budget for platform work - tracing, pipelines, discovery - before the split, not after.',
    ],
  },

  'service-oriented-architecture': {
    analogy: {
      title: 'A company where everything goes through the post room',
      body:
        'Departments never speak directly - every message goes to a central post room that translates formats, decides who should receive it and keeps a copy. It works, and it gives management complete visibility. It also means the post room knows everybody business, and when it is busy, the entire company slows down.',
    },
    deepDive: [
      {
        heading: 'What SOA got right',
        paragraphs: [
          'SOA introduced ideas that are now taken for granted: services as reusable business capabilities rather than technical layers, contract-first interfaces defined before implementation, a registry so services can be discovered, and central governance of schemas and policies.',
          'Contract-first in particular is a discipline worth keeping. Defining the interface before writing the implementation - WSDL then, OpenAPI or protobuf now - forces the boundary to be a deliberate design artefact rather than whatever the code happened to expose.',
          'The reuse ambition was also reasonable. Having one authoritative customer service rather than five partial implementations is a genuine goal, and it is the same goal microservices pursue under the label of bounded contexts and data ownership.',
        ],
      },
      {
        heading: 'What went wrong: the smart pipe',
        paragraphs: [
          'The enterprise service bus started as routing and protocol translation and accumulated business logic: orchestration of multi-step processes, data transformation rules, validation, enrichment. Over time, a significant part of the business logic lived in the integration layer rather than in any service.',
          'That produced three failures at once. The bus became a performance bottleneck, because every message passed through it. It became a deployment bottleneck, because changing a rule meant changing shared infrastructure that everyone depended on. And it became an availability bottleneck, since its failure took everything down.',
          'It also created the vendor problem: the bus was usually a large commercial product with its own tooling and specialists, so the integration layer became the least changeable part of the system - the opposite of the flexibility SOA promised.',
        ],
        code: {
          caption: 'Smart pipe versus smart endpoints',
          body: `SOA WITH ESB
  service A -> [ ESB: route, transform, orchestrate, validate ] -> service B
                      ^ business logic lives here
                      ^ everyone deploys around it
                      ^ single point of failure and contention

MICROSERVICES
  service A -> (dumb transport: HTTP or a broker) -> service B
                      ^ logic lives in the services
                      ^ transport does routing and delivery only

"smart endpoints and dumb pipes" is a direct reaction to this history.`,
        },
      },
      {
        heading: 'Why the lesson still matters',
        paragraphs: [
          'The pattern recurs whenever a shared layer starts accepting logic. An API gateway that grows request transformation, business validation and orchestration is an ESB by another name, with the same bottleneck and the same deployment coupling. A service mesh configured with routing rules that encode business decisions is heading the same way.',
          'The rule that keeps it healthy: infrastructure layers may do transport concerns - routing, authentication, retries, observability, rate limiting - and must not do business decisions. If a change to a business rule requires a change to a gateway configuration, the boundary has been crossed.',
          'SOA and microservices are not opposites, either. SOA was about reusable enterprise services with central governance; microservices are about independently deployable services with decentralised governance. The distinction is mostly about where control sits, and both are reasonable in different organisations.',
        ],
        bullets: [
          'Gateways and meshes: routing, auth, retries, observability - yes.',
          'Gateways and meshes: business validation, orchestration, data transformation - no.',
          'Contract-first interfaces: worth keeping from SOA.',
          'Central registries and shared schemas: useful, as long as they do not gate every deploy.',
        ],
      },
    ],
    examples: [
      {
        title: 'When a gateway quietly became an ESB',
        setup:
          'A team uses an API gateway for authentication and routing. Over two years, features are added to it because it is "the one place all traffic passes".',
        walkthrough: [
          'Year 1: the gateway validates tokens and routes by path. Entirely appropriate.',
          'Month 14: a request transformation is added because a mobile client needs a different field name. Small, reasonable, and the first crack.',
          'Month 18: an aggregation route fans out to three services and merges responses, including a business rule about which price to prefer.',
          'Month 22: validation rules for order payloads move into the gateway so all clients get consistent errors. Business logic now lives in infrastructure.',
          'Consequences: gateway deploys are now risky and frequent; the team that owns it is a bottleneck for every other team; and testing a business rule requires running the gateway.',
          'Recovery: move validation back into the order service, replace the aggregation route with a small BFF service owned by the mobile team, and restrict the gateway to auth, routing, rate limiting and logging - with a written rule about what may live there.',
        ],
        result:
          'The same failure as the ESB, twenty years later, arrived one reasonable change at a time. Writing down what the shared layer is allowed to do is what prevents it.',
      },
    ],
    jargon: [
      { term: 'ESB', plain: 'Enterprise service bus: a central layer routing and transforming messages between services.' },
      { term: 'Contract-first', plain: 'Defining the interface before the implementation.' },
      { term: 'Smart endpoints, dumb pipes', plain: 'Logic in the services, transport only in the middle.' },
      { term: 'Service registry', plain: 'A directory of available services and their endpoints.' },
      { term: 'Orchestration', plain: 'A central component driving a multi-step process.' },
      { term: 'Governance', plain: 'Central rules about contracts, schemas and policies. Useful until it gates every deploy.' },
    ],
    remember: [
      'SOA gave us contract-first services and registries - both still good ideas.',
      'The ESB failed because business logic migrated into shared infrastructure.',
      'Smart endpoints, dumb pipes is the lesson microservices took from it.',
      'An API gateway accumulating business rules is an ESB forming again.',
      'Write down what the shared layer may and may not do, before it drifts.',
    ],
  },

  serverless: {
    analogy: {
      title: 'Taxis instead of a company car',
      body:
        'You pay per journey, never for parking, and there are always more taxis available at rush hour. If you travel twice a week that is far cheaper than owning. If you are on the road eight hours a day, the meter becomes very expensive - and you still have to wait at the kerb for one to arrive.',
    },
    deepDive: [
      {
        heading: 'What you actually give up and gain',
        paragraphs: [
          'Serverless means you deploy a function and the platform handles provisioning, scaling and patching. There are still servers; you simply have no say in them. You pay per invocation and per millisecond of execution, so idle costs nothing - which is transformative for spiky, low-volume or event-driven workloads.',
          'Scaling is automatic and fast: from zero to thousands of concurrent executions without a scaling policy, a warm pool or a capacity plan. For a workload that is idle most of the day and then processes ten thousand files, this is a genuinely better model than keeping instances running.',
          'What you give up is control and predictability. Execution time limits, memory limits, no persistent local state, no long-lived connections, and a runtime you cannot tune. Plus vendor coupling: the function itself may be portable, but the triggers, permissions and surrounding services rarely are.',
        ],
        code: {
          caption: 'Where the cost lines cross',
          body: `1M requests/month, 200 ms each, 512 MB
  serverless    ~ $5-10
  small always-on instance ~ $15-25   -> serverless wins

100M requests/month, 200 ms each
  serverless    ~ $400-800
  a few instances + LB ~ $150-300     -> containers win

steady high load favours always-on;
spiky, low or unpredictable load favours serverless.`,
        },
      },
      {
        heading: 'Cold starts, and how much they actually matter',
        paragraphs: [
          'When no warm instance exists, the platform must provision one: download the code, start the runtime, initialise the application. That is tens of milliseconds for a small Go or Rust function, a few hundred for Node or Python, and potentially seconds for a large JVM or .NET application with heavy initialisation.',
          'It matters for user-facing latency and does not matter for asynchronous processing. A queue consumer that starts 800 ms late is irrelevant; an API endpoint where 5 percent of requests take an extra second is a visible product problem.',
          'Mitigations exist and have costs: provisioned concurrency keeps instances warm and reintroduces a fixed bill, smaller deployment packages and lazy initialisation reduce startup work, and choosing a lighter runtime helps most of all. Putting a function inside a VPC used to add seconds and is now much improved - but checking the current behaviour of your platform is worth it.',
        ],
        bullets: [
          'Cold starts: fine for async work, risky for user-facing p99.',
          'No local state: everything goes to a database, cache or object storage.',
          'Connection limits: many concurrent functions can exhaust a database - use a proxy or pooler.',
          'Execution limits: long jobs must be split or moved to a container.',
        ],
      },
      {
        heading: 'Where it fits best',
        paragraphs: [
          'Event processing is the natural fit: a file lands in storage and triggers a resize, a message arrives on a queue, a scheduled job runs nightly, a webhook needs receiving. These are spiky, short, stateless and independent - exactly the shape the model was built for.',
          'Glue code between managed services is the second: a small function that reacts to an event, transforms something and writes it elsewhere. Writing that as a full service with a deployment pipeline is disproportionate work.',
          'Poor fits are steady high-throughput APIs (where always-on is cheaper and faster), long-running jobs that exceed execution limits, anything needing persistent connections such as WebSockets, and workloads with strict, consistent latency requirements. A common mature pattern is a container-based core with serverless functions around the edges for events and integrations.',
        ],
      },
    ],
    examples: [
      {
        title: 'Image processing: the case where it is obviously right',
        setup:
          'Users upload images that need three resized versions. Volume is 50,000 per day, arriving in bursts during business hours with near-zero traffic overnight.',
        walkthrough: [
          'Always-on design: you must size for peak. Peak is roughly 20 images per second; processing takes 2 seconds each, so about 40 concurrent workers - and they idle overnight and most of the afternoon.',
          'Serverless design: upload to object storage triggers a function per image. Concurrency scales from 0 to 40 and back with no policy, no scaling lag and no idle cost.',
          'Cost: 50,000 invocations a day at 2 seconds and 1 GB is roughly 3M GB-seconds a month, about $50 - against several always-on instances sized for peak.',
          'Cold starts are irrelevant: nobody is waiting synchronously, and a 500 ms start on a 2-second job is noise.',
          'Guardrails: a concurrency limit so a bulk import cannot spawn 5,000 functions and exhaust downstream capacity, and a dead letter queue for images that fail repeatedly.',
          'Idempotency: the function is keyed by object id and version, because storage events can be delivered more than once.',
        ],
        result:
          'Bursty, stateless, short, independent work with idle periods - every property favours the model. The same team runs their main API on containers, because it has none of those properties.',
      },
    ],
    jargon: [
      { term: 'FaaS', plain: 'Functions as a service: deploy a function, the platform runs it on demand.' },
      { term: 'Cold start', plain: 'The delay when a new execution environment must be created.' },
      { term: 'Provisioned concurrency', plain: 'Paying to keep instances warm, trading the cost benefit for predictable latency.' },
      { term: 'Concurrency limit', plain: 'A cap on simultaneous executions. Protects downstream systems and your bill.' },
      { term: 'Vendor lock-in', plain: 'Coupling to a provider event sources, permissions and services.' },
      { term: 'Event source', plain: 'What triggers the function: a queue, storage, a schedule, an HTTP request.' },
    ],
    remember: [
      'You pay per invocation, so idle is free and steady high load is expensive.',
      'Cold starts are noise for async work and a real problem for user-facing p99.',
      'No local state and no persistent connections - design around both.',
      'Many concurrent functions can exhaust database connections; use a pooler and a concurrency cap.',
      'Best as event processing and glue around a container-based core.',
    ],
  },

  cqrs: {
    analogy: {
      title: 'Separate tills and stock room',
      body:
        'Customers pay at tills designed for speed; stock is received at a loading bay designed for careful checking. Same shop, same goods, two completely different workflows because the two activities have nothing in common except the inventory. CQRS is that: the path that changes data and the path that reads it stop sharing a design.',
    },
    deepDive: [
      {
        heading: 'Two models because reads and writes want different things',
        paragraphs: [
          'Writes want normalised data, invariants, validation and transactions - a model organised around correctness. Reads want denormalised, pre-joined, query-shaped data organised around what a screen displays. In one model these pull against each other, and most systems compromise both.',
          'CQRS separates them: commands go through the write model, queries read from one or more read models built for specific queries. The read side can be a different schema, a different database, or several - a search index, a cache, a reporting store - each optimised for the questions it answers.',
          'The lightest version needs no extra infrastructure: the same database, with the write path going through domain objects and the read path using plain optimised SQL against views. That alone removes a great deal of friction, and it is where most teams should stop.',
        ],
        code: {
          caption: 'Where the separation can sit',
          body: `LEVEL 1  same DB, separate code paths
  commands -> domain model -> normalised tables
  queries  -> plain SQL / views -> DTOs        (no sync problem at all)

LEVEL 2  same DB, materialised read tables
  writes also update a denormalised table, in the same transaction

LEVEL 3  separate read store, updated asynchronously
  write DB -> events/CDC -> read store (Elasticsearch, Redis, another DB)
  now reads are eventually consistent - this is where the cost begins`,
        },
      },
      {
        heading: 'The cost is eventual consistency, and it lands on the UI',
        paragraphs: [
          'Once the read model is updated asynchronously, a user can perform an action and not see it reflected - the classic "I saved it and it is not there" report. The lag is usually milliseconds to seconds, and users notice it immediately because they are looking at exactly the thing they just changed.',
          'The fixes are product decisions as much as technical ones. Optimistic UI updates the screen from the command result so the user sees their own change instantly. Returning the created entity from the command avoids a re-read. Or the client can poll or subscribe until the read model catches up, showing a brief "processing" state.',
          'Which means the decision to go asynchronous should be made per feature. An admin report can be five seconds stale with no consequence; the screen a user lands on after saving cannot. Many systems use a synchronous read model for the second case and an asynchronous one for the first.',
        ],
        bullets: [
          'Level 1 (separate code paths) has no consistency cost - do this freely.',
          'Asynchronous read models need an explicit answer for read-your-writes.',
          'The read model should be rebuildable from the source of truth, always.',
          'Version the read model so it can be rebuilt alongside the old one and switched.',
        ],
      },
      {
        heading: 'When it is worth it, and when it is ceremony',
        paragraphs: [
          'It earns its place when read and write loads are very different - a system with 1,000 reads per write, where scaling them together is wasteful. When the queries are genuinely hard against a normalised model, such as search, aggregations or complex filtered lists. Or when different consumers need very different shapes of the same data.',
          'It is ceremony when the application is CRUD with a similar read and write profile. Adding commands, handlers, projections and an eventual consistency story to a form-based admin tool is a large increase in moving parts for no benefit - and it is the most common way CQRS gets a bad reputation.',
          'CQRS and event sourcing are also frequently conflated. They compose well but are independent: you can have CQRS with a normal relational write model, and event sourcing with a single read path. Adopting both at once because they are mentioned together is a reliable way to make a project much harder than it needed to be.',
        ],
      },
    ],
    examples: [
      {
        title: 'Adding a read model for a product listing',
        setup:
          'A product listing with filters takes 2.5 seconds because it joins 6 tables and aggregates reviews and stock. It is read 5,000 times per minute; products change a few times per hour.',
        walkthrough: [
          'Read/write ratio is roughly 100,000:1 - the strongest possible argument for a read model.',
          'Build a denormalised product_listing table containing everything the listing shows: name, price, category, average rating, review count, stock status, image URL.',
          'Update it from domain events - ProductUpdated, ReviewAdded, StockChanged - via a consumer. Lag is under a second.',
          'The listing query becomes a single-table scan with an index on the filter columns: about 15 ms, a 160x improvement.',
          'Consistency: a product edited in the admin panel takes up to a second to appear updated in the listing. Acceptable, and the admin edit screen reads from the write model so the editor always sees their own change.',
          'Rebuild path: a script can regenerate the whole table from the source tables, which is run after any change to the projection logic and tested regularly.',
          'Later, a second read model is added for search in Elasticsearch, fed by the same events. No change to the write side.',
        ],
        result:
          '2.5 seconds became 15 ms, and a second read model was added later for free. The essential discipline was making the read model derived and rebuildable, so it is never a second source of truth.',
      },
    ],
    jargon: [
      { term: 'Command', plain: 'A request to change state. Validated, may be rejected.' },
      { term: 'Query', plain: 'A request to read state. No side effects.' },
      { term: 'Read model / projection', plain: 'A shape of the data built for a specific query, derived from the source of truth.' },
      { term: 'Write model', plain: 'The model that enforces invariants and accepts changes.' },
      { term: 'Eventual consistency', plain: 'The read model catching up after the write. The main cost of async projections.' },
      { term: 'Rebuild', plain: 'Regenerating a read model from scratch. Must always be possible.' },
    ],
    remember: [
      'Reads and writes want different data shapes - CQRS stops them compromising each other.',
      'Separate code paths cost nothing; separate stores cost eventual consistency.',
      'The read model must be derived and rebuildable, never a second source of truth.',
      'Answer read-your-writes explicitly, per feature, before going asynchronous.',
      'CQRS and event sourcing are independent; adopting both at once is usually a mistake.',
    ],
  },

  'event-sourcing': {
    analogy: {
      title: 'A bank statement, not a balance',
      body:
        'Your balance is not stored as a number that gets overwritten - it is the sum of every transaction ever recorded. That is why you can see how you got here, why an error can be corrected with a compensating entry rather than a silent edit, and why the bank can answer what your balance was on any past date.',
    },
    deepDive: [
      {
        heading: 'Store the events, derive the state',
        paragraphs: [
          'In a conventional design you store current state and overwrite it: an UPDATE replaces the old row and the previous value is gone. In event sourcing you store the sequence of things that happened - OrderPlaced, ItemAdded, OrderShipped - and current state is computed by replaying them.',
          'The immediate consequences are striking. You have a complete audit trail by construction, not as a separate logging concern. You can reconstruct the state at any past moment. You can answer questions nobody thought to ask when the data was written, because the raw facts were kept rather than a summary.',
          'You also get a natural integration point: those same events can drive read models, notifications, analytics and other services. Event sourcing and CQRS pair well for exactly this reason - the event stream is the write model and projections are the read models.',
        ],
        code: {
          caption: 'State as a fold over events',
          body: `events for order 42
  OrderPlaced   {items:[A,B], total: 90}
  ItemAdded     {item: C, price: 20}
  DiscountApplied {amount: 10}
  OrderShipped  {carrier: "DHL"}

current state = replay all four
  -> items [A,B,C], total 100, status shipped

snapshot at event 3 lets you skip replay for long streams.
"What did this order look like before shipping?" -> replay the first three.`,
        },
      },
      {
        heading: 'The hard parts nobody mentions at the start',
        paragraphs: [
          'Events are immutable and permanent, so schema evolution is a genuine discipline: a five-year-old event must still be readable by todays code. You version event types and write upcasters that transform old shapes into new ones, and you never change the meaning of an existing field.',
          'Querying is awkward by nature. "Find all orders over 100 euro" cannot be answered from an event log without replaying everything, so you must build and maintain projections for every query - which means every new question is a new projection plus a rebuild.',
          'Deleting data collides with immutability, and GDPR makes this concrete: an append-only log conflicts with the right to erasure. The usual answer is crypto-shredding - store personal data encrypted with a per-subject key and delete the key - which must be designed in from the start, not retrofitted.',
        ],
        bullets: [
          'Version every event type and write upcasters; old events live forever.',
          'Snapshots for long streams, or replay time grows without bound.',
          'Every query needs a projection, and every projection needs a rebuild path.',
          'Plan for erasure with crypto-shredding before you store personal data.',
          'Events describe what happened, never what should happen next.',
        ],
      },
      {
        heading: 'Use it where the log is the product',
        paragraphs: [
          'The best candidates are domains where history is intrinsically valuable: financial ledgers, inventory movements, insurance claims, order lifecycles, anything audited or regulated. In these, you were going to build an audit trail anyway, and event sourcing gives one that cannot drift from reality because it is the reality.',
          'It is a poor fit for CRUD domains where history has no business meaning. A user profile, a settings page or a content management system gains a large amount of machinery and very little value - and every future query becomes a projection.',
          'The strong recommendation is to apply it per aggregate, not per system. Event-source the order lifecycle and the ledger; keep the product catalogue and user preferences as ordinary tables. Systems that event-source everything are the ones that end up with a team maintaining infrastructure instead of features.',
        ],
      },
    ],
    examples: [
      {
        title: 'The question you could only answer because you kept the events',
        setup:
          'A retailer event-sources orders. Six months in, finance asks: how often do customers add items after placing an order, and does it correlate with discounts?',
        walkthrough: [
          'With conventional storage: the current order row shows the final items. Whether an item was added later was never recorded, so the question cannot be answered for past data at all.',
          'With event sourcing: ItemAdded events with timestamps already exist. A new projection answers the question over all historical data in an afternoon.',
          'A second question follows: how many orders were cancelled within 5 minutes of a discount being applied? Also answerable, because the sequence and the timing of every change were kept.',
          'The cost that made this possible was paid earlier: every query needs a projection, so the team maintains 11 of them and each schema change requires a rebuild.',
          'Rebuilds are routine: a new projection replays 40 million events in about 20 minutes, which is only acceptable because it was designed to be parallel and idempotent.',
          'Snapshotting was added at 1,000 events per stream, because loading a heavily edited order was taking 300 ms of replay.',
        ],
        result:
          'The value was retroactive analysis nobody could have planned for - which is exactly the benefit event sourcing offers and the reason it fits audited, history-rich domains and almost nothing else.',
      },
    ],
    jargon: [
      { term: 'Event store', plain: 'The append-only log of domain events. The source of truth.' },
      { term: 'Aggregate', plain: 'The consistency boundary whose events form one stream.' },
      { term: 'Projection', plain: 'A read model built by replaying events.' },
      { term: 'Snapshot', plain: 'A stored state at a point in the stream, so replay can start there.' },
      { term: 'Upcaster', plain: 'Code that converts an old event version into the current shape.' },
      { term: 'Crypto-shredding', plain: 'Encrypting personal data per subject and deleting the key to achieve erasure.' },
    ],
    remember: [
      'Store what happened; derive current state by replaying.',
      'You get a perfect audit trail and the ability to answer future questions about the past.',
      'Every query needs a projection, and every projection needs a rebuild path.',
      'Events are immutable and forever - version them and write upcasters.',
      'Apply it per aggregate where history is valuable, never to a whole system by default.',
    ],
  },
};
