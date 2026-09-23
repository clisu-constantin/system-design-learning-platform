import type { Concept } from '@/types';

export const reliabilityConcepts: Concept[] = [
  {
    slug: 'redundancy',
    title: 'Redundancy',
    tagline: 'More than one of everything that matters.',
    category: 'reliability',
    difficulty: 'Beginner',
    keywords: ['n+1', 'spare capacity', 'zones', 'active-active'],
    what: 'Redundancy means running spare instances of a component so that losing one does not remove the capability.',
    why: 'Components fail: disks, processes, machines, racks, zones. Redundancy converts a failure from an outage into a capacity event.',
    how: [
      'N+1: enough capacity that losing one instance still serves peak load.',
      'Spread replicas across failure domains - different hosts, racks, availability zones.',
      'Active-active shares load across all copies; active-passive keeps a standby ready.',
      'Redundancy only works if failover is automatic and regularly tested.',
    ],
    diagram: `3 servers at 60% CPU each.
Lose one -> remaining two go to 90%. Survivable.

3 servers at 90% CPU each.
Lose one -> remaining two need 135%. Cascading failure.`,
    tradeoffs: [
      {
        approach: 'N+1 redundancy',
        gains: ['Survives single-instance failure', 'Enables rolling deploys'],
        costs: ['Idle capacity you pay for', 'More instances to patch and monitor'],
      },
      {
        approach: 'Active-passive',
        gains: ['Cheaper than active-active', 'Simple consistency story'],
        costs: ['Standby path is rarely exercised and often broken when needed'],
      },
    ],
    mistakes: ['Redundant instances that share a single dependency - one database, one NAT gateway, one config service.'],
    related: ['high-availability', 'failover', 'single-point-of-failure', 'fault-tolerance'],
  },
  {
    slug: 'fault-tolerance',
    title: 'Fault Tolerance',
    tagline: 'Degrade in pieces instead of failing all at once.',
    category: 'reliability',
    difficulty: 'Intermediate',
    keywords: ['graceful degradation', 'bulkhead', 'timeout', 'fallback'],
    what: 'Fault tolerance is the ability to keep providing useful service while some components are failing.',
    why: 'Perfect availability is impossible; partial availability is achievable. A feed that loads without personalised recommendations is far better than an error page.',
    how: [
      'Set timeouts on every remote call - an unbounded wait is how one failure spreads.',
      'Provide fallbacks: cached data, defaults, or a reduced feature.',
      'Isolate resources per dependency (bulkheads) so one slow call cannot consume every thread.',
      'Shed load deliberately when overloaded rather than collapsing.',
    ],
    diagram: `Recommendation service down:
  fail-fast after 200 ms -> show popular items instead
  page renders, user continues, error budget spent slowly

No timeout:
  request threads pile up -> API exhausted -> whole site down`,
    tradeoffs: [
      {
        approach: 'Graceful degradation',
        gains: ['Core flows survive dependency failures', 'Failures stay local'],
        costs: ['Fallback paths must be built and tested', 'Behaviour differs during incidents, which can confuse users and support'],
      },
    ],
    mistakes: ['Retrying without a circuit breaker, which turns a slow dependency into a self-inflicted denial of service.'],
    related: ['circuit-breaker', 'bulkhead', 'retry', 'backpressure'],
  },
  {
    slug: 'high-availability',
    title: 'High Availability',
    tagline: 'Designing so that no single failure is visible to users.',
    category: 'reliability',
    difficulty: 'Intermediate',
    keywords: ['multi-az', 'failover', 'nines', 'health checks'],
    what: 'A high-availability design keeps the service running through the failure of any single component, usually through redundancy plus automatic failover.',
    why: 'Availability targets above about 99.9% cannot be met by manual recovery - a human paging cycle alone consumes the entire budget.',
    how: [
      'Eliminate single points of failure on the request path, including the load balancer and DNS.',
      'Deploy across at least two availability zones.',
      'Automate detection (health checks) and recovery (failover, restart, replacement).',
      'Practise: run game days and fail over on purpose.',
    ],
    diagram: `Zone A                 Zone B
LB  (anycast/NLB shared across zones)
API x3                 API x3
DB primary  --sync-->  DB standby
                 automatic promotion on failure`,
    tradeoffs: [
      {
        approach: 'Multi-AZ active-active',
        gains: ['Survives a zone outage', 'No idle standby'],
        costs: ['Cross-zone traffic costs', 'Data layer must handle concurrent access'],
      },
    ],
    mistakes: ['Claiming HA while the failover path has never been executed.'],
    related: ['availability', 'redundancy', 'failover', 'health-checks', 'disaster-recovery'],
  },
  {
    slug: 'single-point-of-failure',
    title: 'Single Point of Failure',
    tagline: 'The one box whose loss takes everything with it.',
    category: 'reliability',
    difficulty: 'Beginner',
    keywords: ['spof', 'redundancy', 'dependency', 'blast radius'],
    what: 'A single point of failure (SPOF) is any component with no redundant alternative on the critical path.',
    why: 'Availability is limited by the least redundant component. A perfectly redundant app tier in front of one database has the availability of that database.',
    how: [
      'Walk the request path and ask of each component: what happens if this disappears right now?',
      'Include the unglamorous ones: DNS, the load balancer, the config service, the certificate, the deploy pipeline.',
      'Either add redundancy, or accept and document the risk with a recovery plan.',
    ],
    diagram: `Client -> LB -> API x5 -> [ single Postgres ] -> SPOF
Redundant app tier does not help: the database defines the availability.`,
    tradeoffs: [
      {
        approach: 'Remove the SPOF with redundancy',
        gains: ['One component failing no longer takes the system down', 'Allows maintenance and deploys without downtime'],
        costs: ['At least double the instances to pay for and operate', 'Adds failover logic that must be tested or it will not work when needed'],
      },
      {
        approach: 'Accept the SPOF and plan fast recovery',
        gains: ['Cheaper and simpler while scale and stakes are low', 'One copy of state, so no replication lag or split brain'],
        costs: ['Every failure of that component is a full outage', 'Recovery time depends on backups and on someone being awake'],
      },
    ],
    mistakes: [
      'Redundant compute sharing one stateful dependency.',
      'A "highly available" cluster that depends on one leader-election service in one zone.',
    ],
    related: ['redundancy', 'high-availability', 'failover', 'replication'],
    quiz: [
      {
        id: 'spof-1',
        prompt: 'Five API servers behind two load balancers all talk to one database instance. Where is the SPOF?',
        options: ['The load balancers', 'The API tier', 'The database', 'There is none'],
        answer: 2,
        explanation:
          'The compute tiers are redundant; the single database is not. Its failure is a full outage regardless of how many API servers exist.',
      },
    ],
  },
  {
    slug: 'failover',
    title: 'Failover',
    tagline: 'Detect, promote, repoint - and hope the old primary stays down.',
    category: 'reliability',
    difficulty: 'Intermediate',
    keywords: ['promotion', 'split brain', 'fencing', 'rto', 'rpo'],
    what: 'Failover is the process of switching traffic from a failed component to a healthy replacement, automatically or manually.',
    why: 'Redundancy without failover is just extra cost. The failover procedure - and its duration - is what your availability number actually depends on.',
    how: [
      'Detect failure through health checks, with thresholds that avoid flapping on a single blip.',
      'Promote a standby, using quorum to avoid two primaries.',
      'Fence the old primary so it cannot accept writes if it comes back.',
      'Repoint clients: connection strings, service discovery, or DNS with a short TTL.',
    ],
    diagram: `t+0s   primary stops responding
t+10s  health checks fail threshold
t+12s  replica promoted (most up-to-date, quorum agrees)
t+15s  old primary fenced
t+20s  clients reconnect to the new primary
RTO ~20 s, RPO = whatever async replication had not shipped`,
    tradeoffs: [
      {
        approach: 'Automatic failover',
        gains: ['Recovery in seconds', 'No human in the loop at 3am'],
        costs: ['False positives cause unnecessary failovers', 'Split-brain risk if fencing is wrong'],
      },
      {
        approach: 'Manual failover',
        gains: ['Human judgement prevents unnecessary switches'],
        costs: ['Minutes to hours of downtime', 'Relies on a rehearsed runbook'],
      },
    ],
    mistakes: ['Not measuring RPO - asynchronous replication means failover can silently lose recent writes.'],
    related: ['replication', 'health-checks', 'high-availability', 'leader-election'],
  },
  {
    slug: 'circuit-breaker',
    title: 'Circuit Breaker',
    tagline: 'Stop calling a failing dependency until it has a chance to recover.',
    category: 'reliability',
    difficulty: 'Intermediate',
    lab: 'circuit-breaker',
    keywords: ['closed', 'open', 'half-open', 'fail fast', 'cascading failure', 'state machine', 'threshold', 'cooldown', 'fallback'],
    what: 'A circuit breaker monitors calls to a dependency. After enough failures it opens and rejects calls immediately for a cooldown period, then lets a trial request through to test recovery. The same three-state machine can wrap any operation that fails repeatedly - an HTTP call, a database connection, a queue publish or a third-party SDK.',
    why: 'Calling a dead service wastes threads, connections and time, and the retries keep it dead. Failing fast protects the caller and gives the callee room to recover. Treated as one reusable pattern, it is configured per dependency instead of written again inside every client.',
    how: [
      'CLOSED: calls pass through while failures are counted over a rolling window, not since the process started.',
      'Trip on a failure ratio with a minimum call volume, so three unlucky calls cannot open the circuit.',
      'OPEN: the threshold was crossed - calls fail immediately with a fallback, no network call made.',
      'HALF-OPEN: after the cooldown, a limited number of trial calls are allowed.',
      'Success closes the circuit; failure opens it again and restarts the cooldown.',
      'Configure one policy per dependency, next to a timeout, a bounded retry and a bulkhead.',
    ],
    when: [
      'Any synchronous call to a remote dependency, especially third-party APIs.',
      'Database, cache and queue clients that hang while the other side is down.',
    ],
    diagram: `        failures >= threshold
CLOSED ----------------------> OPEN
   ^                             |
   | trial succeeds              | cooldown elapses
   |                             v
   +---------- HALF-OPEN <-------+
                   |
        trial fails -> back to OPEN`,
    advantages: [
      'Bounded latency during an outage: fail in microseconds instead of waiting for a timeout.',
      'Prevents cascading failure across services.',
      'Gives the struggling dependency breathing room.',
    ],
    tradeoffs: [
      {
        approach: 'Wrap a dependency in a circuit breaker',
        gains: [
          'Fail fast: a dead dependency is skipped instead of tying up threads on timeouts',
          'Protects both caller and callee - no retry storm while it recovers',
          'Automatic recovery probing',
        ],
        costs: [
          'Requests fail while open even if the dependency recovered early',
          'Thresholds and cooldowns need tuning per dependency, or it trips too early or too late',
          'Needs a meaningful fallback, or you have only moved the error',
        ],
      },
      {
        approach: 'Separate breakers per endpoint or host instead of one per dependency',
        gains: ['One bad route or host is cut off while healthy ones keep serving', 'Fallbacks can be tailored to what each endpoint returns'],
        costs: ['More state, thresholds and dashboards to maintain', 'Each breaker sees less traffic, so it needs longer to gather enough calls to trip reliably'],
      },
    ],
    mistakes: [
      'One shared breaker for several dependencies, so one failure blocks unrelated calls.',
      'Thresholds so high the breaker never trips, or so low it trips on normal noise.',
      'Wrapping the retry loop around the breaker, so retries hammer a circuit that fails instantly instead of counting toward the trip.',
      'Opening the circuit with no fallback and calling it resilience.',
    ],
    realWorld: ['Hystrix popularised the pattern; Resilience4j, Polly and service meshes implement it today.'],
    related: ['retry', 'exponential-backoff', 'bulkhead', 'fault-tolerance', 'health-checks'],
    quiz: [
      {
        id: 'cb-1',
        prompt: 'What is the purpose of the HALF-OPEN state?',
        options: [
          'To slow down all requests',
          'To send a limited number of trial requests to check whether the dependency recovered',
          'To buffer requests until the service returns',
          'To log failures',
        ],
        answer: 1,
        explanation:
          'Going straight from OPEN to CLOSED would hit a possibly still-broken service with full traffic. HALF-OPEN tests with a few requests first.',
      },
      {
        id: 'cb-2',
        prompt: 'A payment API is timing out after 30 seconds. Without a circuit breaker, what happens to the calling service?',
        options: [
          'Nothing, requests simply fail',
          'Threads and connections pile up waiting on timeouts until the caller itself becomes unavailable',
          'The payment API recovers faster',
          'Requests are queued and retried automatically',
        ],
        answer: 1,
        explanation:
          'This is cascading failure: the caller exhausts its own resources waiting for a dependency that is not coming back.',
      },
    ],
  },
  {
    slug: 'retry',
    title: 'Retry',
    tagline: 'Try again - but only for the right errors, and not too eagerly.',
    category: 'reliability',
    difficulty: 'Beginner',
    lab: 'retry-backoff',
    labFocus: 'no-backoff',
    keywords: ['transient', 'idempotent', 'retry storm', 'budget'],
    what: 'Retrying re-issues a request that failed, on the assumption that the failure was transient.',
    why: 'Most distributed failures are transient - a dropped packet, a brief restart, a momentary overload. A single retry converts many user-visible errors into invisible ones.',
    how: [
      'Retry only retryable errors: timeouts, connection failures, 429, 503. Never a 400 or 422.',
      'Only retry idempotent operations, or use an idempotency key.',
      'Always cap attempts, and add backoff and jitter between them.',
      'Give the whole operation a deadline so retries cannot outlive the user request.',
    ],
    diagram: `attempt 1 -> timeout
attempt 2 -> 503
attempt 3 -> 200 OK

Retry storms: 10,000 clients each retrying 3x against an overloaded
service means 30,000 requests. Retrying made the outage worse.`,
    tradeoffs: [
      {
        approach: 'Aggressive retries',
        gains: ['Hides transient failures well'],
        costs: ['Multiplies load exactly when the system is struggling', 'Duplicate side effects without idempotency'],
      },
      {
        approach: 'Few retries + backoff + budget',
        gains: ['Recovers from blips without amplifying overload'],
        costs: ['Some requests still surface an error to the user'],
      },
    ],
    mistakes: [
      'Retrying at every layer: client, gateway, service and SDK each retry 3x, giving 81 requests.',
      'Retrying non-idempotent writes and creating duplicates.',
    ],
    related: ['exponential-backoff', 'circuit-breaker', 'idempotency', 'backpressure'],
  },
  {
    slug: 'exponential-backoff',
    title: 'Exponential Backoff',
    tagline: 'Wait longer after each failure - and add jitter so clients do not sync up.',
    category: 'reliability',
    difficulty: 'Intermediate',
    lab: 'retry-backoff',
    labFocus: 'backoff-jitter',
    keywords: ['jitter', 'retry storm', 'thundering herd', 'delay'],
    what: 'Exponential backoff multiplies the delay between retries (1s, 2s, 4s, 8s), and jitter randomises it so retries from many clients spread out.',
    why: 'Immediate retries from thousands of clients hit a recovering service with a synchronised wall of traffic and knock it down again. Backoff gives it time; jitter removes the synchronisation.',
    how: [
      'delay = base * 2^attempt, capped at a maximum.',
      'Apply full jitter: sleep a random value between 0 and that delay.',
      'Respect Retry-After when the server sends it.',
      'Combine with a circuit breaker so repeated failure stops the calls entirely.',
    ],
    diagram: `IMMEDIATE RETRY              EXPONENTIAL BACKOFF + JITTER
attempt 1 -> fail            attempt 1 -> fail
attempt 2 -> fail (0 ms)     wait ~1 s
attempt 3 -> fail (0 ms)     attempt 2 -> fail
...service never recovers    wait ~2 s
                             attempt 3 -> fail
                             wait ~4 s
                             attempt 4 -> success`,
    tradeoffs: [
      {
        approach: 'Backoff with jitter',
        gains: ['Recovering services are not re-flooded', 'Spreads load over time'],
        costs: ['Slower recovery for the individual request', 'Needs an overall deadline'],
      },
    ],
    mistakes: ['Backoff without jitter - clients that failed together still retry together.'],
    related: ['retry', 'circuit-breaker', 'backpressure', 'rate-limiting'],
    quiz: [
      {
        id: 'eb-1',
        prompt: 'Why add jitter to exponential backoff?',
        options: [
          'It makes retries faster',
          'It desynchronises clients that failed at the same moment, avoiding a synchronised retry spike',
          'It guarantees delivery',
          'It reduces the number of attempts',
        ],
        answer: 1,
        explanation:
          'Without jitter, every client waits the same 1s, 2s, 4s and retries in lockstep - the thundering herd that keeps the service down.',
      },
    ],
  },
  {
    slug: 'health-checks',
    title: 'Health Checks',
    tagline: 'The signal that decides whether traffic reaches an instance.',
    category: 'reliability',
    difficulty: 'Beginner',
    lab: 'load-balancer',
    keywords: ['liveness', 'readiness', 'probe', 'deep check', 'flapping'],
    what: 'A health check is a periodic probe that determines whether an instance should receive traffic (readiness) or be restarted (liveness).',
    why: 'Automatic removal of broken instances is what makes redundancy useful. A wrong health check either keeps broken servers in the pool or removes healthy ones.',
    how: [
      'Readiness: can this instance serve right now? Include critical dependencies.',
      'Liveness: is the process wedged and in need of a restart? Keep it shallow.',
      'Require several consecutive failures before ejection, and several successes before re-admission.',
      'Return quickly - a health endpoint that times out is itself an outage.',
    ],
    diagram: `Shallow check:  GET /health -> 200 "ok"
  process alive but database unreachable -> still receives traffic -> every request 500

Deep check:     GET /ready -> checks DB connection
  risk: database blip ejects ALL instances at once -> total outage
Balance: check dependencies, but fail open when every instance would fail.`,
    tradeoffs: [
      {
        approach: 'Deep dependency checks',
        gains: ['Broken instances leave the pool automatically'],
        costs: ['A shared dependency failure can eject the entire fleet', 'More load on dependencies from probes'],
      },
      {
        approach: 'Shallow checks',
        gains: ['Stable, cheap, no correlated ejection'],
        costs: ['Instances that cannot actually serve stay in rotation'],
      },
    ],
    mistakes: [
      'Health check thresholds of one, causing flapping on a single slow response.',
      'Liveness probes that check dependencies, restarting healthy pods during a database incident.',
    ],
    related: ['load-balancing', 'failover', 'auto-scaling', 'monitoring'],
  },
  {
    slug: 'disaster-recovery',
    title: 'Disaster Recovery',
    tagline: 'RPO and RTO: how much data you can lose, and how long you can be down.',
    category: 'reliability',
    difficulty: 'Advanced',
    keywords: ['rpo', 'rto', 'backup', 'restore', 'region failure', 'runbook'],
    what: 'Disaster recovery is the plan and capability to restore service after a large failure: a corrupted dataset, a deleted resource, or the loss of a whole region.',
    why: 'High availability handles component failure. It does not help when a migration deletes a table or an entire region becomes unreachable - replication copies that faithfully.',
    how: [
      'Define RPO (acceptable data loss) and RTO (acceptable downtime) per system.',
      'Take backups, store them in a separate account/region, and test restores on a schedule.',
      'Keep point-in-time recovery for logical errors, not just snapshots.',
      'Write and rehearse the runbook - an untested plan is a hypothesis.',
    ],
    diagram: `RPO 5 min  -> continuous backup / log shipping
RTO 1 hour -> pre-provisioned standby, automated restore

Backup that has never been restored = unverified hope.`,
    tradeoffs: [
      {
        approach: 'Warm standby in a second region',
        gains: ['RTO in minutes', 'Region failure survivable'],
        costs: ['Roughly double infrastructure cost', 'Data replication complexity and lag'],
      },
      {
        approach: 'Backup and restore only',
        gains: ['Cheap', 'Simple to reason about'],
        costs: ['RTO measured in hours', 'Restore path rarely exercised'],
      },
    ],
    mistakes: ['Backups in the same account and region as the primary, lost in the same event.'],
    related: ['high-availability', 'replication', 'failover'],
  },
];
