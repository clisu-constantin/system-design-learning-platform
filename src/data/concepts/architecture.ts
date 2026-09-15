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
    keywords: ['functions', 'cold start', 'scale to zero', 'vendor lock-in', 'concurrency'],
    what: 'Serverless runs code in response to events on infrastructure you never provision, billed per invocation and duration, scaling to zero when idle.',
    why: 'It removes capacity planning and idle cost for spiky or low-volume workloads, and it makes small event-driven components extremely cheap to run.',
    how: [
      'A function is instantiated per concurrent request; concurrency is the scaling unit.',
      'Cold starts add latency when a new instance must be created.',
      'Functions are stateless; state lives in managed stores.',
      'Downstream limits (database connections) must be protected, because scaling is aggressive.',
    ],
    when: ['Spiky or infrequent workloads.', 'Event processing and glue code.', 'Teams without operational capacity for servers.'],
    diagram: `event -> function instance (new = cold start ~100ms-2s)
      -> 1000 concurrent events = 1000 instances
      -> 1000 database connections  <- use a pooler or you take the DB down`,
    tradeoffs: [
      {
        approach: 'Serverless functions',
        gains: ['No capacity management', 'Scale to zero', 'Pay per use'],
        costs: [
          'Cold start latency',
          'Execution time and memory limits',
          'Connection management against traditional databases',
          'Local testing and debugging are harder',
          'Strong coupling to one provider',
        ],
      },
      {
        approach: 'Containers on a scheduler',
        gains: ['Predictable latency', 'Portable', 'Long-running work is fine'],
        costs: ['You manage capacity and scaling', 'Pay for idle'],
      },
    ],
    mistakes: ['Assuming serverless is always cheaper - at steady high volume it usually is not.'],
    related: ['auto-scaling', 'connection-pooling', 'event-driven-architecture'],
  },
  {
    slug: 'cqrs',
    title: 'CQRS',
    tagline: 'Separate the write model from the read model.',
    category: 'architecture',
    difficulty: 'Advanced',
    keywords: ['command', 'query', 'read model', 'projection', 'eventual consistency'],
    what: 'Command Query Responsibility Segregation uses different models - often different stores - for writing and for reading.',
    why: 'Write models are optimised for invariants and normalisation; read models are optimised for the exact shape a screen needs. Forcing one model to do both makes each worse.',
    how: [
      'Commands validate invariants and write to the authoritative store.',
      'Projections build read models (denormalised views, search indexes, caches) from those writes.',
      'Queries read only from the read models, never from the write model.',
      'Accept a propagation delay between write and read side.',
    ],
    when: ['Very different read and write loads.', 'Complex domain rules on write with many query shapes on read.', 'Alongside event sourcing.'],
    diagram: `Command -> domain model -> write store -> events
                                            |
                               projections  v
                     read model (denormalised) <- Queries`,
    tradeoffs: [
      {
        approach: 'CQRS',
        gains: ['Each side scales and is modelled independently', 'Read models can be rebuilt or added freely'],
        costs: [
          'Eventual consistency between write and read - the UI must handle it',
          'More moving parts and projection code',
          'Rebuilding projections needs tooling',
        ],
      },
    ],
    mistakes: ['Applying CQRS to simple CRUD, where it only adds latency and code.'],
    related: ['event-sourcing', 'event-driven-architecture', 'denormalization', 'eventual-consistency'],
  },
  {
    slug: 'event-sourcing',
    title: 'Event Sourcing',
    tagline: 'Store the events, derive the state.',
    category: 'architecture',
    difficulty: 'Advanced',
    keywords: ['event store', 'replay', 'audit', 'snapshot', 'projection'],
    what: 'Event sourcing persists every state change as an immutable event. Current state is derived by replaying those events, with snapshots as an optimisation.',
    why: 'You get a perfect audit log, the ability to answer questions nobody asked when the data was written, and the possibility of rebuilding any read model from history.',
    how: [
      'Append events to a per-entity stream; never update or delete them.',
      'Rebuild state by folding the stream; snapshot periodically to keep replay fast.',
      'Projections turn streams into query-friendly views.',
      'Version event schemas - old events must stay readable forever.',
    ],
    when: ['Finance, ordering, compliance - anywhere history is part of the product.'],
    diagram: `stream: account-42
  AccountOpened      {balance: 0}
  MoneyDeposited     {+100}
  MoneyWithdrawn     {-30}
  -> folded state: balance 70
  -> snapshot at event 1000 to avoid replaying everything`,
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
    ],
    mistakes: ['Adopting it for an entire system when only one aggregate needs an audit trail.'],
    related: ['cqrs', 'event-driven-architecture', 'kafka', 'outbox-pattern'],
  },
  {
    slug: 'event-driven-architecture-arch',
    title: 'Event-Driven Architecture (Architecture view)',
    tagline: 'Choreography versus orchestration, and where the workflow actually lives.',
    category: 'architecture',
    difficulty: 'Advanced',
    keywords: ['choreography', 'orchestration', 'workflow', 'coupling'],
    what: 'At the architecture level, event-driven design is a choice about where a multi-step business process is described: distributed across reacting services (choreography), or in one coordinator (orchestration).',
    why: 'Both use events. They differ in who knows the workflow - and therefore in how hard it is to change, debug and recover.',
    how: [
      'Choreography: each service reacts to events and emits its own. No central controller.',
      'Orchestration: a workflow service issues commands and tracks progress explicitly.',
      'Long-running workflows need compensation (sagas) and idempotent steps either way.',
    ],
    diagram: `CHOREOGRAPHY                  ORCHESTRATION
OrderPlaced                   Workflow service:
 -> Payment reacts              1. reserve stock
 -> Inventory reacts            2. charge card
 -> Shipping reacts             3. schedule shipment
workflow exists nowhere        workflow is explicit and testable`,
    tradeoffs: [
      {
        approach: 'Choreography',
        gains: ['Loosest coupling', 'Easy to add participants'],
        costs: ['No single view of the process', 'Hard to debug and to reason about failure'],
      },
      {
        approach: 'Orchestration',
        gains: ['Explicit, testable, observable workflow', 'Clear compensation logic'],
        costs: ['Coordinator is a coupling point and must be highly available'],
      },
    ],
    related: ['event-driven-architecture', 'saga-pattern', 'microservices'],
  },
];
