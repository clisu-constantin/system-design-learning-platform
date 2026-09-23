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
    labFocus: 'health-checks',
    keywords: ['liveness', 'readiness', 'probe', 'deep check', 'flapping', 'fail open', 'draining'],
    what: 'A health check is a periodic probe that determines whether an instance should receive traffic (readiness) or be restarted (liveness).',
    why: 'Automatic removal of broken instances is what makes redundancy useful. A wrong health check either keeps broken servers in the pool or removes healthy ones.',
    how: [
      'Readiness: can this instance serve right now? Check what it needs locally (its own database connection pool, startup finished) - not every shared dependency.',
      'Liveness: is the process wedged and in need of a restart? Keep it shallow, with no dependency checks.',
      'Require several consecutive failures before ejection (HAProxy: 3 probes, 2 s apart), and a few consecutive passes before re-admission (HAProxy: 2).',
      'Detection takes time: until the threshold is reached, a dead instance still receives requests - up to about interval x threshold.',
      'Return quickly - a health endpoint that times out is itself an outage.',
    ],
    when: [
      'Any pool of instances behind a load balancer or service discovery.',
      'Any orchestrator that restarts processes (Kubernetes liveness, a systemd watchdog).',
      'Deploys and scale-in: fail readiness first, so the instance drains before it stops.',
    ],
    advantages: [
      'A crashed instance leaves the pool in seconds, without a human.',
      'Recovered and new instances join the pool only once they can serve.',
      'Deploys drain cleanly instead of cutting requests off mid-flight.',
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
      {
        approach: 'Short interval, low failure threshold',
        gains: ['A dead instance leaves the pool within seconds, so fewer requests fail'],
        costs: ['One slow reply or lost probe ejects a healthy instance (flapping)', 'More probe traffic on every instance'],
      },
      {
        approach: 'Long interval, high failure threshold',
        gains: ['Stable pool: brief hiccups do not eject anyone', 'Little probe traffic'],
        costs: ['A dead instance keeps receiving requests for up to interval x threshold (30 s x 5 = 150 s)'],
      },
    ],
    mistakes: [
      'Health check thresholds of one, causing flapping on a single slow response.',
      'Liveness probes that check dependencies, restarting healthy pods during a database incident.',
      'A check that only proves the port is open, so a server whose database connection is broken stays in the pool.',
      'An expensive check (a full query) that times out under load and ejects busy but working instances, pushing their load onto the rest.',
    ],
    realWorld: [
      'Kubernetes probes default to every 10 s, a 1 s timeout, 3 failures and 1 success; a failing readiness probe removes the pod from Service endpoints, a failing liveness probe restarts the container.',
      'An AWS Application Load Balancer defaults to a probe every 30 s, 2 failures to mark a target unhealthy and 5 passes to bring it back, and fails open when every target is unhealthy.',
      'HAProxy defaults to a probe every 2 s, 3 failures (fall) and 2 passes (rise).',
    ],
    related: ['load-balancing', 'failover', 'auto-scaling', 'monitoring'],
    quiz: [
      {
        id: 'hc-1',
        prompt: 'In the Lab, health checks probe every 2 s and eject after 3 failures. At 500 req/sec with Round Robin you kill Server 2. What do you see?',
        options: [
          'Server 2 leaves the pool at once and no request fails',
          'For up to about 6 s roughly one request in three fails, then 3 probes in a row fail, Server 2 is ejected and the failures stop',
          'Every request fails until you restart Server 2',
          'Server 2 keeps receiving a third of the traffic for good',
        ],
        answer: 1,
        explanation:
          'The balancer learns about the crash only through its probes, and it waits for 3 consecutive failures, 2 s apart. Until then Server 2 stays in the pool and its third of the requests fail - the event log shows how many. "Leaves at once" is tempting, but no balancer can know without probing; "for good" is what happens with health checks off.',
      },
      {
        id: 'hc-2',
        prompt: 'To detect crashes faster you set the probe interval to 1 s and eject after a single failure. What new problem are you most likely to see?',
        options: [
          'Crashed servers are never detected',
          'Probes use all the bandwidth of the pool',
          'Healthy servers are ejected on one slow reply or one lost probe, and bounce in and out of the pool (flapping)',
          'New servers can no longer join the pool',
        ],
        answer: 2,
        explanation:
          'One failure is enough evidence only if probes never fail by accident. A garbage collection pause or a dropped packet ejects a working server, the others take its load, and the pool shrinks for no reason. Several consecutive failures trade a few seconds of detection for that stability.',
      },
      {
        id: 'hc-3',
        prompt: 'Your /health endpoint returns 200 whenever the process is running. After a credentials change, one of three servers can no longer reach the database and returns 500 on every request - yet it stays in the pool. Why, and what fixes it?',
        options: [
          'The balancer ignores 500 responses by design; nothing can fix it',
          'The probe interval is too long',
          'The server needs a liveness probe that restarts it on database errors',
          'The check is shallow: the process is alive, so it passes. A readiness check that tests the local database connection of that server would fail and eject it',
        ],
        answer: 3,
        explanation:
          'A shallow check proves the process answers, not that it can do its job. A readiness check that uses the connection pool of the instance catches this broken server - and since only this one instance is affected, it does not risk the whole fleet. A restart (liveness) does not fix a wrong credential; it just adds restarts.',
      },
      {
        id: 'hc-4',
        prompt: 'Every instance runs a readiness check that queries the shared database. The database takes 10 s to fail over, every instance fails the check at once, and the balancer empties the pool: a total outage. What prevents it?',
        options: [
          'Fail open: when every instance fails, keep sending traffic to all of them (as an AWS ALB does), and do not gate traffic on a shared dependency',
          'Probe the database more often',
          'Lower the failure threshold to 1',
          'Add more instances with the same check',
        ],
        answer: 0,
        explanation:
          'A check that fails on every instance at the same time says nothing about any one instance - it only takes the fleet out. Failing open keeps serving whatever can be served, and the database problem is handled by timeouts and degradation instead. More instances with the same check fail the same way, and a lower threshold makes it happen sooner.',
      },
      {
        id: 'hc-5',
        prompt: 'A Kubernetes liveness probe checks that Redis is reachable. Redis fails over for 15 s. What happens to the pods?',
        options: [
          'Nothing, liveness probes never affect running pods',
          'The kubelet restarts every pod, so they all lose warm caches and connection pools and come back slowly - the outage outlasts the Redis blip',
          'Only one pod restarts',
          'The pods move to another node',
        ],
        answer: 1,
        explanation:
          'A failing liveness probe restarts the container. Because every pod checks the same Redis, every pod is restarted at once, and a restart cannot fix Redis anyway. Liveness should check only the process itself; a dependency outage belongs in readiness or degradation, never in the restart decision.',
      },
      {
        id: 'hc-6',
        prompt: 'An application needs about 90 s to load its caches at boot. Its liveness probe runs every 10 s with a threshold of 3, and the pod is restarted every 30 s forever. What fixes it without weakening liveness?',
        options: [
          'Remove the liveness probe',
          'Set the liveness threshold to 100',
          'Add a startup probe with a generous budget; liveness and readiness start only after it passes',
          'Increase the readiness timeout',
        ],
        answer: 2,
        explanation:
          'A startup probe holds off the other probes until the app has booted, so the strict liveness probe can keep catching real hangs later. Removing liveness or raising its threshold to 100 would also stop the loop, but then a wedged process runs unnoticed for many minutes.',
      },
      {
        id: 'hc-7',
        prompt: 'During a deploy, each pod exits the instant it receives SIGTERM, and every deploy shows a burst of connection errors. What is the right shutdown order?',
        options: [
          'Exit immediately, but deploy at night',
          'Restart the load balancer after each pod',
          'Make the liveness probe fail first',
          'Fail readiness first, keep serving in-flight requests until the balancer stops sending new ones, then exit (draining)',
        ],
        answer: 3,
        explanation:
          'The balancer only stops routing to a pod once it notices, so a pod that exits at once drops the requests it holds and those still on the way. Draining reverses the order: leave the pool, finish the work, then stop. Failing liveness would make things worse - it asks for a restart, not a quiet exit.',
      },
      {
        id: 'hc-8',
        prompt: 'The health endpoint runs a full database query. At peak it takes over 2 s, past the probe timeout, so busy instances start failing their checks and get ejected - and the rest fail next. What is happening?',
        options: [
          'A cascade: each ejection pushes more load onto the remaining instances, which then time out too. Make the check cheap and cache its result for a few seconds',
          'The database is down',
          'The probe interval is too long',
          'Too many instances are running',
        ],
        answer: 0,
        explanation:
          'The instances were slow, not broken, but the check treated slow as dead. Every ejection raises the load on the survivors, so the check itself turns overload into an outage. A cheap check with a cached result keeps the signal about the instance, not about a peak-hour query.',
      },
      {
        id: 'hc-9',
        prompt: 'In the Lab you turn Health checks off and kill Server 2. What happens over the next minute - and what changes when you turn them back on?',
        options: [
          'Server 2 leaves the pool after 6 s, the same as with checks on',
          'The load balancer restarts Server 2 automatically',
          'Server 2 stays in the pool the whole minute and about one request in three keeps failing; with checks on it is ejected after 3 failed probes',
          'Traffic stops entirely until you restart Server 2',
        ],
        answer: 2,
        explanation:
          'Without probes the balancer has no way to tell a dead server from a live one, so the red wire stays and the failures never stop. A load balancer never restarts a server - that is the job of an orchestrator using a liveness probe. Turn checks on and the ringed probe dots fail three times before the wire goes dashed.',
      },
      {
        id: 'hc-10',
        prompt: 'In the Lab you restart a server. It boots in 2 s, passes one probe, and still does not get traffic until the next probe passes as well. Why does the balancer wait for two passes?',
        options: [
          'The balancer is slow to update its routing table',
          'Requiring consecutive passes keeps an instance that fails on and off from bouncing in and out of the pool (flapping)',
          'The first probe after boot is always ignored',
          'Two passes are needed to warm the cache of the server',
        ],
        answer: 1,
        explanation:
          'A rise threshold (HAProxy defaults to 2) asks for evidence that the recovery is stable before sending real traffic. It does not warm anything - it only waits. The fall threshold does the same on the way out, so one lucky or unlucky probe decides nothing.',
      },
      {
        id: 'hc-11',
        prompt: 'A target group probes every 30 s and marks a target unhealthy after 2 failures, the AWS ALB defaults. An instance crashes right after passing a probe. Roughly how long can it keep receiving requests?',
        options: ['About 1 s', 'About 5 s', 'About 30 s', 'About 60 s'],
        answer: 3,
        explanation:
          'Two failures 30 s apart means up to about 60 s between the crash and the ejection. Worst-case detection is roughly interval x failure threshold; 30 s would be one failed probe, and the threshold asks for two. Shorter intervals find it sooner but send more probes, and passive checks on real traffic can react faster.',
      },
    ],
  },
  {
    slug: 'disaster-recovery',
    title: 'Disaster Recovery',
    tagline: 'RPO and RTO: how much data you can lose, and how long you can be down.',
    category: 'reliability',
    difficulty: 'Advanced',
    lab: 'disaster-recovery',
    keywords: ['rpo', 'rto', 'backup', 'restore', 'region failure', 'runbook', 'pilot light', 'warm standby', 'hot standby', '3-2-1'],
    what: 'Disaster recovery is the plan and capability to restore service after a large failure: a corrupted dataset, a deleted resource, or the loss of a whole region.',
    why: 'High availability handles component failure. It does not help when a migration deletes a table or an entire region becomes unreachable - replication copies the bad write faithfully, and the standby in the next zone sits in the same region.',
    how: [
      'Set RPO (how much data you may lose) and RTO (how long you may be down) per system.',
      'Take backups, store them in a separate account and region, and keep them longer than it takes to notice corruption.',
      'Replicate to a second region when hours of restore are too slow: pilot light, warm standby or hot standby, by how much already runs there.',
      'Write and rehearse the runbook - the time a real restore drill took is your RTO.',
    ],
    when: [
      'Every system that stores data someone would miss: at least backups in another account and region.',
      'A second region (pilot light or warmer) when the business cannot wait hours for a restore.',
      'Synchronous cross-region replication only where losing seconds of writes is not acceptable, such as a payments ledger.',
    ],
    advantages: [
      'Survives what high availability cannot: a lost region, a deleted table, ransomware.',
      'Turns data loss and downtime into two numbers the business chose, RPO and RTO.',
    ],
    diagram: `strategy          RTO           RPO (region lost)
backup/restore    hours         the backup interval
pilot light       10s of min    seconds (async replica)
warm standby      minutes       seconds (async replica)
hot standby       minutes       seconds, or 0 with sync

Bad write or DROP TABLE: every strategy restores
from a backup. Replication copied the damage.`,
    tradeoffs: [
      {
        approach: 'Backup and restore only',
        gains: ['Lowest cost: storage for the copies, nothing running in region B', 'Also undoes a bad write, which replication would have copied'],
        costs: ['RTO in hours: restoring a large database is slow', 'RPO up to the full backup interval', 'The restore path rots unless it is drilled'],
      },
      {
        approach: 'Pilot light (replicated database, app servers off)',
        gains: ['RPO of seconds after a region loss', 'Low running cost: only the database runs in region B'],
        costs: ['RTO in tens of minutes: app servers are deployed at failover', 'Replication copies corruption, so backups are still needed'],
      },
      {
        approach: 'Warm standby (scaled-down copy running)',
        gains: ['RTO in minutes: a small fleet already serves', 'Can be tested continuously, because it is running'],
        costs: ['Paying for a running copy all the time', 'Must scale up at failover, which needs capacity in region B'],
      },
      {
        approach: 'Hot standby or active-active (full size in region B)',
        gains: ['Shortest RTO, often with automated failover', 'No scale-up at the worst moment'],
        costs: ['Roughly double the infrastructure cost', 'An automated failover on a false alarm costs data and availability', 'Still needs backups for corruption'],
      },
      {
        approach: 'Synchronous cross-region replication',
        gains: ['RPO zero for a region loss: no acknowledged write is lost'],
        costs: ['Every write waits a cross-region round trip, tens of milliseconds', 'If region B is unreachable, writes stall until it falls back to async'],
      },
    ],
    mistakes: [
      'Backups in the same account and region as the primary, lost in the same event.',
      'Treating a replica as a backup: it copies a bad migration within seconds.',
      'Retention shorter than the time it takes to notice corruption, so every copy holds it.',
      'An RTO on paper that no restore drill has ever measured.',
      'Restoring the data but not the ability to deploy: CI, registry, secrets and DNS lived in the lost region.',
    ],
    related: ['high-availability', 'replication', 'failover', 'redundancy'],
    quiz: [
      {
        id: 'dr-1',
        prompt:
          'Backups run nightly at 02:00 and are copied to region B. There is no database replica. Region A is lost at 17:00. How much data is gone?',
        options: [
          'None - the backups are safe in region B',
          'About 15 hours of writes - everything since the 02:00 backup',
          'A full 24 hours - RPO always equals the backup interval',
          'Only the requests in flight at 17:00',
        ],
        answer: 1,
        explanation:
          'Region B holds the data as it was at 02:00, so every write from 02:00 to 17:00 is gone - 15 hours. In the Lab, Data at risk climbs between backups and drops at each one. The tempting 24 hours is the worst case, when the region dies just before the next backup; the loss is the time since the last surviving copy.',
      },
      {
        id: 'dr-2',
        prompt:
          'The database replicates asynchronously to region B. An engineer runs a migration that deletes half the orders table by mistake. What does the replica hold a minute later?',
        options: [
          'The same deleted rows - replication copied the delete within seconds',
          'A clean copy - fail over to it and nothing is lost',
          'A copy one backup interval old',
          'Nothing - replication stops when it sees an error',
        ],
        answer: 0,
        explanation:
          'Replication copies every committed write, including a wrong one, so the replica is as broken as the primary. In the Lab, Ship a bad migration marks the standby Corrupted and recovery needs the restore. Failing over to the replica looks like the quick fix, but it only moves the damage to another region; only a backup from before the migration is clean.',
      },
      {
        id: 'dr-3',
        prompt:
          'A team keeps hourly backups in the same cloud account and region as the database, with no replica. The region goes down for good. What can they restore?',
        options: [
          'Everything up to the last hourly backup',
          'Everything, because backups are always replicated by the provider',
          'Nothing - the backups were lost with the region they protected',
          'Only the schema, not the data',
        ],
        answer: 2,
        explanation:
          'A copy in the same failure domain dies in the same event. In the Lab, backups in Region A plus Lose region A ends in "nothing to restore from". The tempting answer assumes the hourly backup survived; it would have, only if it lived in another region and ideally another account.',
      },
      {
        id: 'dr-4',
        prompt:
          'A payments ledger must lose no acknowledged write even if a whole region is lost. Which setup gives that, and what does it cost?',
        options: [
          'Backups every 5 minutes to region B - costs a little storage',
          'Async replication to region B - costs nothing extra per write',
          'A warm standby of app servers in region B - costs running servers',
          'Synchronous replication to region B - every write waits a cross-region round trip',
        ],
        answer: 3,
        explanation:
          'With synchronous replication a write is acknowledged only after region B has it, so a region loss loses no acknowledged write - the Lab shows Data at risk 0 and write latency up by about 70 ms. Async is the tempting answer because it is fast, but it trails by seconds and those seconds are lost. Frequent backups still lose up to 5 minutes, and app servers hold no data.',
      },
      {
        id: 'dr-5',
        prompt:
          'In the Lab, pilot light (async replica, app servers off) recovers from a region loss in about 50 minutes. Which one change cuts the most time, and what does it cost?',
        options: [
          'Back up every 5 minutes instead of every hour - costs more storage',
          'Keep a small fleet of app servers running in region B - costs paying for it all the time',
          'Switch to synchronous replication - costs write latency',
          'Move the backups to region A - costs nothing',
        ],
        answer: 1,
        explanation:
          'The slowest step of pilot light is deploying app servers (30 of the 50 minutes); a warm fleet only has to scale up, which brings RTO to about 25 minutes. Backup frequency and synchronous replication are tempting because they sound like recovery settings, but they change how much data you lose (RPO), not how long you are down (RTO).',
      },
      {
        id: 'dr-6',
        prompt:
          'The runbook says RTO 1 hour. The first restore drill ever run took 7 hours for the 2 TB database, and the key was in a vault only one person could open. What RTO should the team plan with?',
        options: [
          'At least 7 hours, plus the time to find the key and repoint clients - until they make it faster',
          '1 hour - the target is what they agreed with the business',
          'Unknown - one drill is not enough data',
          'About 1 hour, because a real incident gets everyone working faster',
        ],
        answer: 0,
        explanation:
          'The measured end-to-end restore is the honest RTO; the 1 hour target is a wish until a drill meets it. Toggle Runbook rehearsed off in the Lab and every recovery grows by the surprises nobody found. The tempting "keep the target" answer is how teams discover the real number during a real disaster.',
      },
      {
        id: 'dr-7',
        prompt:
          'A company wants hot standby in a second region for every system, including an internal analytics warehouse that is rebuilt from source data each night. What is the problem?',
        options: [
          'None - the strictest setup everywhere is the safe choice',
          'Hot standby cannot protect a warehouse',
          'RPO and RTO should be set per system: the warehouse can accept backup and restore, and paying for a second full copy of it buys nothing the business needs',
          'Analytics data does not need backups at all',
        ],
        answer: 2,
        explanation:
          'RPO and RTO are business decisions with a price, set per system. A warehouse that can be rebuilt overnight tolerates hours of RTO, so backup and restore fits; the Lab shows hot standby near 200 against 105 on the cost scale. Applying the strictest setup everywhere is the tempting safe answer, and it is how disaster recovery budgets get wasted.',
      },
      {
        id: 'dr-8',
        prompt:
          'A bug has been silently corrupting customer records. It is noticed after 10 days. Backups are daily and kept for 7 days. What can the team restore?',
        options: [
          'The backup from 8 days ago, which is clean',
          'Yesterday, then fix the few bad rows by hand',
          'Any backup - a backup is a snapshot, so it is always clean',
          'No clean copy - every backup they still have holds the corruption',
        ],
        answer: 3,
        explanation:
          'The corruption started 10 days ago and the oldest backup is 7 days old, so every copy they have already contains it. Retention must be longer than the realistic time to notice a problem. The tempting 8-day-old backup is exactly the one the 7-day retention deleted.',
      },
      {
        id: 'dr-9',
        prompt:
          'A system runs hot standby with automated failover driven by health checks. A bad deploy starts writing wrong prices. What does the automated failover do?',
        options: [
          'Fails over within minutes and users get correct prices from region B',
          'Nothing useful - health checks stay green, and region B has the same wrong prices anyway',
          'Rolls back the deploy',
          'Restores the last backup automatically',
        ],
        answer: 1,
        explanation:
          'Health checks test whether the service answers, not whether the data is right, so nothing trips; and the replica already holds the wrong prices. In the Lab, Ship a bad migration with Hot still waits for someone to notice and then for the full restore. Expecting failover to fix it is the tempting mistake: it protects against losing a region, not against bad data.',
      },
      {
        id: 'dr-10',
        prompt:
          'After a region loss the database is promoted in region B in 5 minutes, but the app cannot be deployed for hours: CI, the container registry and the secrets manager were all in region A. What did the plan miss?',
        options: [
          'Recovery covers the whole ability to operate - pipelines, images, secrets and DNS must be reachable outside the failed region',
          'The database should have been restored from backup instead of promoted',
          'The replica should have been synchronous',
          'Nothing - app deployment is not part of disaster recovery',
        ],
        answer: 0,
        explanation:
          'Data is only half of recovery; the RTO clock runs until users are served, which needs the tools to deploy and configure the app. Synchronous replication is the tempting fix, but it changes data loss, not the ability to deploy. Infrastructure as code, a registry and secrets copied to region B turn this into a pipeline run.',
      },
      {
        id: 'dr-11',
        prompt:
          'An async replica normally trails the primary by about 1 second. During a traffic peak the lag grows to 90 seconds, and then region A is lost. How much data is gone?',
        options: [
          'About 1 second - the normal lag',
          'Nothing - async replication catches up after the failure',
          'Up to about 90 seconds of acknowledged writes - the lag at the moment of failure',
          'Everything since the last backup',
        ],
        answer: 2,
        explanation:
          'Writes the replica had not received when region A died are gone, so the RPO is the lag at that moment, not the usual lag. That is why teams alert on replication lag against their RPO. The replica cannot catch up from a region that no longer exists. Everything older than the lag did reach region B, so the loss is far smaller than going back to the last backup.',
      },
      {
        id: 'dr-12',
        prompt:
          'A team runs its database with a synchronous standby in a second availability zone of the same region, and says they have disaster recovery. Which event does that setup not cover?',
        options: [
          'The loss of one availability zone',
          'A crashed database server',
          'A failed disk on the primary',
          'The loss of the whole region, or a DROP TABLE that the standby copies at once',
        ],
        answer: 3,
        explanation:
          'A multi-AZ standby is high availability: it handles a failed server, disk or zone. It sits in the same region, so a region loss takes both, and it replicates a DROP TABLE instantly. The tempting answers are all component failures, which is exactly what this setup is built for; disaster recovery adds copies outside the region and backups that can be restored to an earlier point.',
      },
    ],
  },
];
