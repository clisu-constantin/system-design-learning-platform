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
    what: 'A circuit breaker sits in the caller and watches its calls to one dependency. When failures cross a threshold it opens and rejects calls immediately for a cooldown period, then lets a few trial calls through to test recovery. The same three-state machine can wrap any operation that fails repeatedly - an HTTP call, a database connection, a queue publish or a third-party SDK.',
    why: 'Calling a dead service wastes threads, connections and time, and the extra calls keep it dead. Failing fast protects the caller and gives the callee room to recover. Treated as one reusable pattern, it is configured per dependency instead of written again inside every client.',
    how: [
      'CLOSED: calls pass through while failures are counted over a rolling window, not since the process started.',
      'Trip on a failure ratio with a minimum call volume, so three unlucky calls cannot open the circuit.',
      'Count timeouts, connection errors and 5xx as failures - never 4xx, which mean the request was wrong.',
      'OPEN: calls fail immediately with a fallback, no network call made.',
      'HALF-OPEN: after the cooldown, a limited number of trial calls are allowed.',
      'Enough trial successes close the circuit; a failed trial opens it again and restarts the cooldown.',
      'Configure one policy per dependency, next to a timeout, a bounded retry and a bulkhead.',
    ],
    when: [
      'Any synchronous call to a remote dependency, especially third-party APIs.',
      'Database, cache and queue clients that hang while the other side is down.',
      'Wherever a slow or dead dependency could tie up the threads or connections of the caller.',
    ],
    diagram: `        failures >= threshold
CLOSED ----------------------> OPEN
   ^                             |
   | trials succeed              | cooldown elapses
   |                             v
   +---------- HALF-OPEN <-------+
                   |
        trial fails -> back to OPEN`,
    advantages: [
      'Bounded latency during an outage: fail in a millisecond or two instead of waiting for a timeout.',
      'Prevents cascading failure across services.',
      'Gives the struggling dependency breathing room.',
      'An open breaker is a precise signal of which dependency is unhealthy.',
    ],
    tradeoffs: [
      {
        approach: 'Wrap a dependency in a circuit breaker',
        gains: [
          'Fail fast: a dead dependency is skipped instead of tying up threads on timeouts',
          'Protects both caller and callee - no pile of doomed calls while it recovers',
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
      {
        approach: 'Only a timeout, no breaker',
        gains: ['Nothing to tune except one number', 'Every call gets a fresh chance, so recovery is seen at once'],
        costs: ['Every call during an outage still waits the full timeout', 'Threads and connections pile up in the caller, which can take it down too'],
      },
    ],
    mistakes: [
      'One shared breaker for several dependencies, so one failure blocks unrelated calls.',
      'Thresholds so high the breaker never trips, or so low it trips on normal noise.',
      'Counting 4xx responses as failures, so a buggy client trips the breaker for everybody.',
      'No timeout on the call, so a hanging dependency never produces a failure for the breaker to count.',
      'Retrying when the breaker answers "circuit open" - the retry should stop there, not wait out its backoff against a circuit that fails instantly.',
      'Opening the circuit with no fallback and calling it resilience.',
    ],
    realWorld: [
      'Hystrix popularised the pattern; Resilience4j, Polly and service meshes such as Istio implement it today.',
      'Resilience4j wraps Retry around CircuitBreaker by default, so every attempt is counted by the breaker.',
    ],
    related: ['retry', 'exponential-backoff', 'bulkhead', 'fault-tolerance', 'health-checks'],
    quiz: [
      {
        id: 'cb-1',
        prompt:
          'The breaker in front of the Payment Service has been OPEN for its full cooldown. The service was restarted a moment ago and may or may not be healthy. What does the breaker do next?',
        options: [
          'Closes and sends all traffic to the service again',
          'Stays open until an operator resets it by hand',
          'Moves to HALF-OPEN and lets a few trial calls through, then decides from their results',
          'Sends all traffic again but with a longer timeout',
        ],
        answer: 2,
        explanation:
          'HALF-OPEN tests recovery with a small number of calls: enough successes close the circuit, a failure opens it again. In the Lab you see 3 trial calls travel to the Payment Service before the state changes. Closing straight away is tempting, but it hits a service that may still be fragile with full traffic; a manual reset is exactly what the half-open state makes unnecessary.',
      },
      {
        id: 'cb-2',
        prompt:
          'A payment API starts timing out after 30 seconds on every call. The checkout service calls it with no circuit breaker. What happens to checkout?',
        options: [
          'Threads and connections pile up waiting on timeouts until checkout itself becomes unavailable',
          'Nothing much - each request simply fails after 30 seconds',
          'The payment API recovers faster because calls are slow',
          'Requests are queued and retried automatically',
        ],
        answer: 0,
        explanation:
          'This is cascading failure: every call holds a thread or connection for 30 seconds, new requests keep arriving, and checkout runs out of both. In the Lab, turn the breaker off and press Break the dependency - Avg latency climbs to the call timeout. "Each request simply fails" is the tempting answer, but it ignores what each failure costs the caller while it waits.',
      },
      {
        id: 'cb-3',
        prompt:
          'Service A calls Service B. B sometimes freezes completely in a long garbage-collection pause and answers nothing. The B team offers to add a circuit breaker inside B, in front of its own handlers. Does that protect A?',
        options: [
          'Yes - a breaker anywhere on the path protects both sides',
          'No - a frozen B cannot run its own breaker, and the threads of A are already stuck waiting; the breaker belongs in A, the caller',
          'Yes, as long as B also has a health check',
          'Only if the breaker is shared between A and B through Redis',
        ],
        answer: 1,
        explanation:
          'The breaker exists to protect the resources of the caller, so it has to live in the caller: A counts its own timeouts and stops calling. A breaker inside a frozen B never runs. The tempting "anywhere on the path" misses that the thing being protected is the thread in A that is waiting.',
      },
      {
        id: 'cb-4',
        prompt:
          'Checkout wraps each payment call in a retry (up to 3 attempts with backoff), and every attempt goes through the circuit breaker. The breaker opens and an attempt comes back with "circuit open". What should the retry do?',
        options: [
          'Retry with backoff as usual - the next attempt may succeed',
          'Retry immediately, since the failure was instant',
          'Turn the breaker off so the retries can reach the service',
          'Stop retrying and use the fallback - "circuit open" is not a transient error',
        ],
        answer: 3,
        explanation:
          'With the retry outside the breaker (the default order in Resilience4j), every attempt is counted toward tripping, and once the circuit is open the retry must treat that error as final. Retrying with backoff looks safe, but it only waits out delays against a circuit that will fail instantly until its cooldown ends.',
      },
      {
        id: 'cb-5',
        prompt:
          'A buggy mobile release sends malformed requests, and the inventory service answers 400 Bad Request to 70% of calls. The breaker in the order service counts every non-2xx response as a failure. What happens?',
        options: [
          'The breaker opens and cuts off inventory for every user, although the service is healthy',
          'Nothing - the breaker ignores 400s by design',
          'The breaker slows the buggy clients down and lets the rest through',
          'Inventory crashes under the load of bad requests',
        ],
        answer: 0,
        explanation:
          'A 400 says the request was wrong, not that the service is sick, but this breaker counts it anyway, crosses its threshold and opens for everyone. Count timeouts, connection errors and 5xx only. "It ignores 400s" is how a well-configured breaker behaves - this one was configured to count them.',
      },
      {
        id: 'cb-6',
        prompt:
          'At 3 a.m. a service makes about 4 calls a minute to a tax service. Two of them time out during a brief network blip. The breaker trips at 50% failures with no minimum number of calls. What happens, and what is the fix?',
        options: [
          'Nothing - two failures are too few to matter',
          'It opens on noise and blocks a healthy service; require a minimum number of calls in the window before judging',
          'It opens, which is correct - 50% of calls failed',
          'It slows down the next calls until the blip passes',
        ],
        answer: 1,
        explanation:
          '2 of 4 is 50%, so the breaker trips although the tax service is fine. A minimum call volume stops a quiet minute from deciding anything; in the Lab the breaker waits for 10 calls in its window before it judges. "Correct, 50% failed" is tempting, but a ratio over four calls is noise, not evidence.',
      },
      {
        id: 'cb-7',
        prompt:
          'To keep things simple, one circuit breaker wraps every outbound call of a service: payments, recommendations and email. The recommendations service goes down. What does the learner of this setup discover?',
        options: [
          'Only recommendations are skipped',
          'Nothing changes, because the breaker only counts recommendations',
          'Email is skipped but payments keep working',
          'Payments and email are blocked too - one sick dependency opened the breaker for all of them',
        ],
        answer: 3,
        explanation:
          'A breaker judges everything it wraps as one thing. Recommendation failures push the shared ratio over the threshold and the open circuit rejects healthy payment and email calls too. One breaker per dependency (often per endpoint) is the fix; "only recommendations are skipped" is what separate breakers would give.',
      },
      {
        id: 'cb-8',
        prompt:
          'The breaker in front of the payment provider opens during checkout. What is a sensible fallback?',
        options: [
          'Fail closed: tell the user payment is unavailable right now, keep the order unpaid, and let them try again shortly',
          'Show "Order confirmed" and charge the card when the provider returns',
          'Return the last cached payment response',
          'Retry in a loop until the breaker closes',
        ],
        answer: 0,
        explanation:
          'Payments are critical: a fake success or a stale cached answer ships goods that may never be paid for. Critical calls fail closed with a clear error; optional ones such as recommendations fail open with an empty or cached result. The cached answer is tempting because it is the fallback in the Lab, but a cached "paid" belongs to a different order.',
      },
      {
        id: 'cb-9',
        prompt:
          'A fragile service is recovering. 40 instances of its caller each run their own breaker, with the same 20-second cooldown and 3 trial calls, and they all opened within the same second. What can go wrong?',
        options: [
          'Nothing - 3 trial calls per instance is tiny',
          'The instances disagree about the state, so some calls get lost',
          'All 40 go half-open together and send about 120 trial calls in one burst, which can knock the service down again',
          'The breakers never leave OPEN, because they share a timer',
        ],
        answer: 2,
        explanation:
          '40 x 3 = 120 probes land at the same instant on a service that is barely standing. Cap the probes across the fleet (a shared limit) or add jitter to the cooldown so the instances spread out. "3 is tiny" is true per instance - the problem is the product across the fleet.',
      },
      {
        id: 'cb-10',
        prompt:
          'In the Lab, you set the Cooldown to 30 s, press Break the dependency until the breaker opens, then press Recover it straight away. What do you see for the next half minute?',
        options: [
          'The breaker closes at once because the dependency recovered',
          'Calls keep going to the Fallback although the Payment Service is healthy, until the cooldown ends and the trials pass',
          'Calls go to the Payment Service and fail',
          'The breaker switches between OPEN and CLOSED on every call',
        ],
        answer: 1,
        explanation:
          'An open breaker does not look at the dependency until its cooldown is over, so every call is short-circuited to the Fallback for up to 30 seconds. That is the cost of a long cooldown: requests fail while open even if the dependency recovered early. A short cooldown has the opposite cost - it probes a still-broken service more often.',
      },
      {
        id: 'cb-11',
        prompt:
          'A service calls a vendor API through a breaker that trips at 50% failures, but the HTTP client has no timeout. The vendor starts accepting connections and never answering. What does the breaker do?',
        options: [
          'Trips within seconds, because every call is failing',
          'Nothing useful - the calls never finish, so no failure is ever counted and the breaker stays CLOSED while threads pile up',
          'Opens, then half-opens every few seconds',
          'Returns the fallback for calls that take longer than one second',
        ],
        answer: 1,
        explanation:
          'A breaker counts outcomes, and a call that hangs forever has no outcome. The timeout is what turns a hang into a failure the breaker can count; in the Lab every failure costs exactly the Call timeout for that reason. "Trips within seconds" assumes the calls fail - here they just wait.',
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
    keywords: ['transient', 'idempotent', 'idempotency key', 'retry storm', 'retry budget', 'Retry-After', 'amplification'],
    what: 'Retrying re-sends a request that failed, on the bet that the failure was transient - a dropped connection, a brief restart, a momentary overload - and that a second attempt will succeed.',
    why: 'Many failures in a distributed system are transient, so one retry turns many user-visible errors into invisible ones. But every retry is extra load, and it arrives exactly when the dependency is weakest - so retries need rules.',
    how: [
      'Retry only retryable errors: timeouts, connection failures, 502/503/504 and 429. Never a 400, 401, 403, 404 or 422.',
      'Retry only idempotent operations, or send an idempotency key so the server can recognise a repeat.',
      'Always cap attempts - 3 in total is a common limit - and add backoff and jitter between them.',
      'Retry at one layer only; nested retries multiply.',
      'Give the whole operation a deadline so retries cannot outlive the user request, and honour Retry-After.',
    ],
    when: [
      'Calls that fail now and then for reasons that pass on their own: network resets, deploys, brief overload.',
      'Idempotent reads and writes (GET, PUT, DELETE), or POSTs that carry an idempotency key.',
      'Not for permanent errors, and not when the dependency has been down for minutes - that is the job of a circuit breaker.',
    ],
    diagram: `attempt 1 -> 503            retryable, back off
attempt 2 -> timeout        did it happen? unknown
attempt 3 -> 201 Created    same idempotency key: no duplicate

Retry storm: 10,000 clients each retrying 3 times against an
overloaded service send up to 40,000 requests instead of 10,000.
Retrying made the outage worse.`,
    advantages: [
      'Hides transient failures from users at almost no cost.',
      'Simple to add in one place - a client library or the gateway.',
      'Combined with idempotency keys, makes an ambiguous timeout safe to resolve.',
    ],
    tradeoffs: [
      {
        approach: 'Aggressive retries (many attempts, no delay)',
        gains: ['Hides transient failures well', 'The fastest recovery for a single request when the blip is short'],
        costs: ['Multiplies load exactly when the system is struggling', 'Duplicate side effects without idempotency'],
      },
      {
        approach: 'Few retries + backoff + retry budget',
        gains: ['Recovers from blips without amplifying overload', 'Retries switch themselves off when failures are widespread'],
        costs: ['Some requests still surface an error to the user', 'Each retried request takes longer'],
      },
      {
        approach: 'No retries at all',
        gains: ['No extra load and no duplicate risk', 'Errors surface at once, so callers decide'],
        costs: ['Every transient blip becomes a user-visible error', 'Pushes the retry decision to callers, who may do it worse'],
      },
    ],
    mistakes: [
      'Retrying at every layer: client, gateway, service and SDK each make 3 attempts, so one request becomes 3 x 3 x 3 x 3 = 81 calls at the bottom.',
      'Retrying non-idempotent writes without an idempotency key and creating duplicates.',
      'Retrying permanent errors such as 400 or 404, which fail identically every time.',
      'Retrying with no delay, so every client that failed together retries together.',
      'Ignoring Retry-After and the deadline of the caller.',
    ],
    realWorld: [
      'The Google SRE book shows 3 retries at each of 3 layers turning one user action into 64 database attempts.',
      'AWS SDKs retry throttling and 5xx errors with capped exponential backoff and jitter by default.',
      'Stripe accepts an Idempotency-Key header so a retried POST returns the result of the first one.',
    ],
    related: ['exponential-backoff', 'circuit-breaker', 'idempotency', 'backpressure'],
    quiz: [
      {
        id: 'retry-1',
        prompt: 'A client gets these four responses from four different calls. Which one is worth retrying?',
        options: [
          '400 Bad Request - the JSON body is missing a field',
          '404 Not Found - the order id does not exist',
          '503 Service Unavailable with Retry-After: 2',
          '401 Unauthorized - the token is invalid',
        ],
        answer: 2,
        explanation:
          'A 503 with Retry-After is the server saying "not now, try in 2 seconds" - a transient condition. The other three are permanent: the same request will fail the same way every time, so retrying only adds load and delays the real error. 401 is tempting because a token can be refreshed, but that is a new request, not a retry of the same one.',
      },
      {
        id: 'retry-2',
        prompt:
          'A client sends POST /payments to charge a card. After 5 seconds it times out with no response. Should it retry?',
        options: [
          'Yes, always - a timeout means the payment did not happen',
          'Only if the request carries an idempotency key - otherwise the server may have charged the card already, and a retry charges it twice',
          'No, never retry a POST',
          'Yes, but only after waiting a full minute',
        ],
        answer: 1,
        explanation:
          'A timeout is ambiguous: the server may have finished the work and lost only the response. With an idempotency key the server recognises the repeat and returns the first result instead of charging again. "A timeout means it did not happen" is the tempting and expensive assumption; "never retry a POST" throws away safe retries that a key makes possible.',
      },
      {
        id: 'retry-3',
        prompt:
          'As in the Diagram: attempt 2 of POST /orders timed out, but the Order Service had already saved the order. Attempt 3 arrives with the same idempotency key. What should the service return?',
        options: [
          'A new 201 Created with a second order id',
          '409 Conflict, because the order already exists',
          '500, because the key was used before',
          'The stored response of the first success - the same 201 with the same order id - without creating another order',
        ],
        answer: 3,
        explanation:
          'The point of the key is that the client cannot tell a repeat from a first try, so the server replays the stored original response, status code included. A second order is the duplicate the key exists to prevent. 409 is tempting, but it turns a successful order into an error the client has to untangle.',
      },
      {
        id: 'retry-4',
        prompt:
          'The mobile app, the API gateway and the database client of a service each make up to 3 attempts per request. The database starts failing every call. How many database calls can one tap in the app cause?',
        options: ['3', '9', '27', '7'],
        answer: 2,
        explanation:
          'Retries at nested layers multiply: 3 x 3 x 3 = 27 database calls for one tap, all arriving while the database is failing. Adding them up (3 + 3 + 3 = 9) is the tempting mistake. The Google SRE book makes the same point with 4 attempts at each of 3 layers: 64. Retry at one layer only.',
      },
      {
        id: 'retry-5',
        prompt:
          'In the Lab on the Retry focus (Immediate retry, 2,000 clients), the Dependency turns Overloaded right after the outage, with the load far above its capacity. The number of users did not change. Where does the extra load come from?',
        options: [
          'From the retries - every client that failed fires its next attempts back to back, in the same instant as everyone else',
          'From new users arriving during the outage',
          'From the API Service retrying on its own',
          'From the dependency restarting',
        ],
        answer: 0,
        explanation:
          'Every triangle on the diagram is a retry. With no delay, the retries of 2,000 clients land within a few hundred milliseconds, which the chart shows as a spike far above the capacity line - the retry storm. The API Service is tempting, but in the Lab it passes calls on and does not retry; the clients are the only layer that retries.',
      },
      {
        id: 'retry-6',
        prompt:
          'After a retry storm, a team sets retries to zero everywhere. What do they give up?',
        options: [
          'Nothing - retries only ever make things worse',
          'Idempotency - without retries, writes can be duplicated',
          'Monitoring - failed calls are no longer logged',
          'Recovery from blips: a reset connection or a 503 during a deploy now reaches the user as an error',
        ],
        answer: 3,
        explanation:
          'In the Lab, Max attempts 1 removes all retry load - and every client that hit the failure simply sees it. That is the cost of no retries. The balanced setup is a few attempts at one layer, with backoff, jitter and a retry budget. "Retries only make things worse" ignores the many transient errors they quietly fix.',
      },
      {
        id: 'retry-7',
        prompt:
          'A client allows retries only while they stay under 10% of its requests (a retry budget). The dependency starts failing 60% of calls. What happens to the retries?',
        options: [
          'Each failed call is still retried 3 times',
          'The budget runs out, so most failures are not retried and the load on the dependency stays close to normal',
          'The client stops sending any requests at all',
          'The budget grows to cover the failures',
        ],
        answer: 1,
        explanation:
          'At 60% failures, retrying each failure would add 60% more traffic; the budget caps the extra at 10%, so retries switch themselves off exactly when failures are widespread - which is when they help least. Stopping all requests is what a circuit breaker does, not a retry budget.',
      },
      {
        id: 'retry-8',
        prompt:
          'A user request has a 2-second deadline. The client retries a slow call up to 3 times, waiting 1 s, 2 s and 4 s between attempts. What is wrong?',
        options: [
          'Nothing - the waits are exponential',
          'The waits are too short',
          'The retries outlive the deadline: after the first wait the user has almost given up, and later attempts are work nobody will read',
          'It should retry 10 times instead',
        ],
        answer: 2,
        explanation:
          'Waits of 1 + 2 + 4 = 7 seconds on top of the attempts blow a 2-second deadline, so the dependency does work for a caller who is gone. Cap total time, not just attempts, and pass the deadline down. Exponential waits are fine on their own - the tempting answer misses that the budget is set by the caller.',
      },
      {
        id: 'retry-9',
        prompt:
          'A server answers 429 Too Many Requests with Retry-After: 30. The backoff of the client says to wait 200 ms. What should the client do?',
        options: [
          'Wait 30 seconds, as the server asked',
          'Wait 200 ms - the client policy wins',
          'Retry at once, since 429 is transient',
          'Give up and never call that server again',
        ],
        answer: 0,
        explanation:
          'Retry-After is the dependency telling you exactly when it can take you back. Retrying after 200 ms is rude and useless - it will get another 429 and burn part of the rate limit. Giving up forever is the opposite error: 429 is temporary by definition.',
      },
      {
        id: 'retry-10',
        prompt:
          'A dependency has returned 503 to every call for the last 10 minutes. Your client keeps retrying each call 3 times with backoff. What should change?',
        options: [
          'Raise the attempts to 10 so more calls get through',
          'Nothing - backoff already protects the dependency',
          'Remove the backoff so calls fail faster',
          'Stop calling it with a circuit breaker - this is no longer a transient failure, and every retry is doomed',
        ],
        answer: 3,
        explanation:
          'Retries are a bet that the failure is brief. After 10 minutes of 503s that bet is lost, and each call still costs up to 3 attempts. A circuit breaker notices the pattern and fails fast until the dependency recovers. Backoff only spreads the doomed calls out; it does not remove them.',
      },
      {
        id: 'retry-11',
        prompt:
          'PUT /users/42 with the body {"name": "Ana"} times out. Is it safe to retry without an idempotency key?',
        options: [
          'No - every write needs an idempotency key',
          'Yes - PUT replaces the resource with the same body, so applying it twice leaves the same state',
          'Only if the first attempt returned an error',
          'No - PUT is not idempotent',
        ],
        answer: 1,
        explanation:
          'HTTP defines PUT, DELETE and GET as idempotent: sending the same request twice has the same effect as once. POST is not, which is why POST needs a key. "Every write needs a key" is tempting but too strict - a PUT that sets a value is already safe to repeat.',
      },
    ],
  },
  {
    slug: 'exponential-backoff',
    title: 'Exponential Backoff',
    tagline: 'Wait longer after each failure - and add jitter so clients do not sync up.',
    category: 'reliability',
    difficulty: 'Intermediate',
    lab: 'retry-backoff',
    labFocus: 'backoff-jitter',
    keywords: ['jitter', 'full jitter', 'retry storm', 'thundering herd', 'delay', 'cap'],
    what: 'Exponential backoff doubles the wait before each retry (1s, 2s, 4s, 8s, up to a cap), and jitter randomises each wait so retries from many clients spread out instead of arriving together.',
    why: 'Immediate retries from thousands of clients hit a recovering service with a synchronised wall of traffic and knock it down again. Backoff gives it time; jitter removes the synchronisation.',
    how: [
      'delay = base * 2^attempt, capped at a maximum (30 or 60 seconds is typical).',
      'Apply full jitter: sleep a random value between 0 and that delay.',
      'Respect Retry-After when the server sends it.',
      'Cap the total time as well, so retries end before the deadline of the caller.',
      'Combine with a circuit breaker so repeated failure stops the calls entirely.',
    ],
    when: [
      'Every retry loop, reconnect loop or poll that runs in many clients at once.',
      'Clients of a shared dependency that can fail for all of them at the same moment.',
      'Anything on a shared clock - cron jobs, cache expiry, polling - benefits from the jitter half.',
    ],
    diagram: `IMMEDIATE RETRY              EXPONENTIAL BACKOFF + JITTER
attempt 1 -> fail            attempt 1 -> fail
attempt 2 -> fail (0 ms)     wait rand(0, 1 s)
attempt 3 -> fail (0 ms)     attempt 2 -> fail
...service never recovers    wait rand(0, 2 s)
                             attempt 3 -> fail
                             wait rand(0, 4 s)
                             attempt 4 -> success`,
    advantages: [
      'Pressure on a failing dependency decays automatically the longer it is down.',
      'Jitter turns synchronised retry waves into a smooth trickle.',
      'A few lines of code in the client, no infrastructure.',
    ],
    tradeoffs: [
      {
        approach: 'Exponential backoff with full jitter',
        gains: ['Recovering services are not re-flooded', 'Spreads the same retries over time, lowering the peak'],
        costs: ['Slower recovery for the individual request', 'Needs a cap and an overall deadline'],
      },
      {
        approach: 'Fixed delay between retries',
        gains: ['Predictable timing, easy to reason about', 'The individual request recovers sooner'],
        costs: ['Constant pressure on the dependency for as long as it is down', 'Clients that failed together still retry together'],
      },
      {
        approach: 'Exponential backoff without jitter',
        gains: ['Total pressure decays like full backoff', 'Deterministic delays are easy to test'],
        costs: ['Every client computes the same schedule, so retries still arrive in synchronised waves'],
      },
    ],
    mistakes: [
      'Backoff without jitter - clients that failed together still retry together.',
      'No cap on the delay, so the tenth retry waits for minutes.',
      'No cap on total time, so retries outlive the caller.',
      'Assuming backoff protects the server from clients that ignore it - that needs rate limiting.',
    ],
    realWorld: [
      'AWS recommends capped exponential backoff with full jitter, and its SDKs use it by default.',
      'TCP doubles its retransmission timeout after each timeout (RFC 6298); classic Ethernet used randomised binary exponential backoff after collisions.',
    ],
    related: ['retry', 'circuit-breaker', 'backpressure', 'rate-limiting'],
    quiz: [
      {
        id: 'eb-1',
        prompt:
          'A server restarts and 10,000 clients lose their connection at the same instant. They reconnect with exponential backoff, base 1 s, and no jitter. What does the server see?',
        options: [
          'A smooth, low stream of reconnects',
          'Nothing for a minute, then everything at once',
          'One reconnect per client, evenly spread over 10 seconds',
          'Synchronised waves: everyone at about 1 s, again at about 3 s, again at about 7 s',
        ],
        answer: 3,
        explanation:
          'Every client computes the same schedule from the same starting moment, so they retry together - the waves shrink as clients succeed, but each is still a spike. In the Lab, Exponential backoff with No jitter shows these spikes on the chart and bursts of triangles on the diagram. The smooth stream is what full jitter gives.',
      },
      {
        id: 'eb-2',
        prompt:
          'A client uses base 100 ms, doubling on every retry, with a cap of 1 s. What are the waits before retries 1 to 6 (before jitter)?',
        options: [
          '100, 200, 300, 400, 500, 600 ms',
          '100, 200, 400, 800, 1000, 1000 ms',
          '100, 200, 400, 800, 1600, 3200 ms',
          '100 ms every time',
        ],
        answer: 1,
        explanation:
          'The wait doubles until it reaches the cap, then stays there: 100, 200, 400, 800, then 1600 and 3200 are both clipped to 1000. The uncapped series is the tempting one; the cap is what keeps later waits sane. Adding 100 each time is linear backoff, which decays too slowly.',
      },
      {
        id: 'eb-3',
        prompt:
          'With full jitter, base 1 s, the computed backoff before a retry is 4 s. How long does the client actually sleep?',
        options: [
          'A random time between 0 and 4 s',
          'Exactly 4 s',
          'A random time between 4 and 8 s',
          '4 s plus or minus 10%',
        ],
        answer: 0,
        explanation:
          'Full jitter draws the whole wait at random from 0 to the computed backoff. That spreads clients the widest, which is why the AWS analysis found it cut the total work far below un-jittered backoff. "Plus or minus 10%" is a small jitter - it blurs the wave but keeps most of it.',
      },
      {
        id: 'eb-4',
        prompt:
          'A dependency is down for 60 seconds. 1,000 clients retry every failed call. Compare a fixed 1-second delay with exponential backoff (base 1 s, cap 30 s). What happens to the load?',
        options: [
          'Both send the same load for the whole minute',
          'Fixed delay sends fewer requests because it never grows',
          'Fixed delay keeps about 1,000 requests a second on the dependency all minute; exponential backoff decays to a handful of retries per client',
          'Exponential backoff sends more, because it keeps retrying for longer',
        ],
        answer: 2,
        explanation:
          'With a fixed delay each client tries about 60 times, so the dependency gets about 1,000 req/s for the whole outage. With doubling waits (1, 2, 4, 8, 16, 30 s) each client makes only about 6 tries in the same minute. That decay is what gives a service room to come back.',
      },
      {
        id: 'eb-5',
        prompt:
          'In the Lab on the Exponential backoff focus (base 1000 ms, jitter on), you switch to No jitter. What changes on the chart and the diagram?',
        options: [
          'Nothing - jitter only changes single requests',
          'The same retries now arrive in tall synchronised spikes, and the triangles on the diagram come in bursts',
          'The total number of retries doubles',
          'The load drops, because clients wait the full delay',
        ],
        answer: 1,
        explanation:
          'Without jitter every client waits the same 1 s, 2 s, 4 s and retries together, so the retries pile into a few buckets and the peak rises. The total number of retries hardly changes - jitter moves them in time, it does not remove them. The Insight quotes both peaks so you can compare.',
      },
      {
        id: 'eb-6',
        prompt:
          'In the Lab you set the base delay to 100 ms. Turning jitter on barely lowers the peak, and can even raise it. Why?',
        options: [
          'The Lab is broken at small delays',
          'Jitter only works with fixed delays',
          'With 100 ms, the clients never retry',
          'The waits are about as short as the 100 ms window the clients failed in, so there is little room to spread them - and full jitter halves the average wait, so retries come sooner',
        ],
        answer: 3,
        explanation:
          'Jitter spreads retries over the width of the wait. When the wait is as short as the moment everyone failed in, there is nowhere to spread them, and the shorter average wait pulls retries earlier. Raise the base delay and the spreading shows. It is a real limit of jitter, not a bug.',
      },
      {
        id: 'eb-7',
        prompt:
          'A job queue retries failed jobs with base 500 ms, doubling, and no cap, for up to 12 attempts. How long does the job wait before its 12th attempt?',
        options: [
          'About 6 seconds',
          'About 8.5 minutes (500 ms x 2^10)',
          'About 1 minute',
          'About 1 hour',
        ],
        answer: 1,
        explanation:
          'The first retry waits 500 ms and each one after doubles, so the wait before attempt 12 is 500 ms x 2^10 = 512 s, about 8.5 minutes - and the whole series adds up to about 17 minutes. That is why backoff needs a cap. 6 seconds is the tempting linear guess (12 x 500 ms).',
      },
      {
        id: 'eb-8',
        prompt:
          'A partner integration ignores your backoff advice and sends 5,000 requests a second straight after every error. What protects your service?',
        options: [
          'Your own backoff settings - they apply to every client',
          'Jitter on the server',
          'Server-side rate limiting and load shedding, answering 429 with Retry-After',
          'A longer cap on the backoff',
        ],
        answer: 2,
        explanation:
          'Backoff is cooperative: it lives in the client and only works for clients that run it. A server has to enforce limits itself, with rate limiting and load shedding. The first option is the tempting mistake - nothing on your side makes their client wait.',
      },
      {
        id: 'eb-9',
        prompt:
          'One million devices check for updates every hour by cron, at exactly minute 00. The update server falls over at the top of every hour. What is the smallest fix?',
        options: [
          'Add a random delay of 0 to 60 minutes to each check, so the checks spread across the hour',
          'Buy a server 60 times bigger',
          'Move the check to minute 30',
          'Make every device retry faster when it fails',
        ],
        answer: 0,
        explanation:
          'It is the same problem jitter solves for retries: many clients on a shared clock. Spreading the start time turns one spike into an even stream. Moving to minute 30 just moves the spike, and a bigger server pays for a peak that jitter removes for free.',
      },
      {
        id: 'eb-10',
        prompt:
          'A reconnect loop uses exponential backoff with full jitter and a 30-second cap, but no limit on total time. The backend has been gone for an hour. What is still wrong?',
        options: [
          'Nothing - the cap keeps the load low',
          'Every client still tries a few times a minute forever, and users keep waiting on a spinner; add a total deadline or a circuit breaker and tell the user',
          'The jitter should be removed after the cap is reached',
          'The cap should be 1 second so clients notice recovery sooner',
        ],
        answer: 1,
        explanation:
          'Capped backoff bounds each wait, not the whole effort: a million clients still send a steady trickle of doomed calls, and a user never gets an answer. A total deadline (or a breaker) ends the attempt and lets the app say so. A 1-second cap is tempting for faster recovery, but it multiplies the load 30 times.',
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
