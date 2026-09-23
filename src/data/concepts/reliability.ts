import type { Concept } from '@/types';

export const reliabilityConcepts: Concept[] = [
  {
    slug: 'redundancy',
    title: 'Redundancy',
    tagline: 'More than one of everything that matters.',
    category: 'reliability',
    difficulty: 'Beginner',
    lab: 'redundancy',
    labFocus: 'redundancy',
    keywords: ['n+1', 'spare capacity', 'zones', 'active-active'],
    what: 'Redundancy means running spare instances of a component so that losing one does not remove the capability.',
    why: 'Components fail: disks, processes, machines, racks, zones. Redundancy converts a failure from an outage into a capacity event.',
    how: [
      'N+1: enough capacity that losing one instance still serves peak load.',
      'Spread replicas across failure domains - different hosts, racks, availability zones.',
      'Active-active shares load across all copies; active-passive keeps a standby ready.',
      'Redundancy only works if failover is automatic and regularly tested.',
    ],
    diagram: `3 servers at 40% CPU each.
Lose one -> remaining two go to 60%. Comfortable.

3 servers at 60% CPU each.
Lose one -> remaining two go to 90%. Survivable, no headroom.

3 servers at 90% CPU each.
Lose one -> remaining two need 135%. Cascading failure.`,
    tradeoffs: [
      {
        approach: 'N+1 redundancy',
        gains: ['Survives single-instance failure', 'Enables rolling deploys'],
        costs: ['Idle capacity you pay for', 'More instances to patch and monitor'],
      },
      {
        approach: 'Active-active',
        gains: ['No idle copy: every copy serves traffic', 'Every copy is proven working all the time', 'Failover is only a health check ejecting the dead copy'],
        costs: ['Stateful parts must handle concurrent writers - replication or partitioning', 'Survivors must have the headroom to absorb the lost share'],
      },
      {
        approach: 'Active-passive',
        gains: ['Simple consistency story: one writer, no conflicts', 'The standard shape for databases'],
        costs: ['Pays for a copy that does no work', 'Standby path is rarely exercised and often broken when needed', 'A failover gap while the standby is promoted'],
      },
    ],
    mistakes: [
      'Redundant instances that share a single dependency - one database, one NAT gateway, one config service.',
      'Copies in one rack or one zone: they fail together, so the arithmetic that squares the failure chance does not apply.',
      'Running every copy so hot that the survivors cannot carry the load when one dies.',
    ],
    related: ['high-availability', 'failover', 'single-point-of-failure', 'fault-tolerance', 'availability'],
    quiz: [
      {
        id: 'red-1',
        prompt: 'Three app servers each run at 60% CPU at peak. One of them dies. What happens to the other two?',
        options: [
          'They go to about 90% each - still serving, with almost no headroom for another failure',
          'They stay at 60% - the load balancer drops the share of the dead server',
          'Outage: with one server gone the tier cannot serve at all',
          'They go to 120% each and start rejecting requests',
        ],
        answer: 0,
        explanation:
          'The dead server carried a third of the load (60% of one box), which is now split over two: 180% of one server over two servers is 90% each. The load does not vanish - the users of the dead server still send requests - so 60% is wrong. 120% would be the case with two survivors carrying four servers worth of work.',
      },
      {
        id: 'red-2',
        prompt: 'The same three app servers run at 90% CPU each at peak, and one dies. What is the most likely outcome?',
        options: [
          'The two survivors run at 100% and cope',
          'The survivors need 135% each, overload, start failing health checks, and the outage spreads to the whole tier',
          'Only the users of the dead server see errors',
          'The load balancer queues the extra requests until a new server boots, with no errors',
        ],
        answer: 1,
        explanation:
          'Three servers at 90% carry 270% of one box; two survivors would need 135% each. They slow down, fail health checks, get ejected, and the last one takes everything - a cascading failure. That is why N+1 means the survivors can carry the peak, not that there is one more box. Load balancers do not buffer an overload for minutes; requests time out.',
      },
      {
        id: 'red-3',
        prompt: 'A tier has two copies, each up 99% of the time, failing independently, and either copy can serve every request. What availability can the tier reach?',
        options: ['98.01%', '99%', '99.5%', 'About 99.99%'],
        answer: 3,
        explanation:
          'The tier is down only when both copies are down at once: 1% x 1% = 0.01%, so it is up about 99.99%. 98.01% is the tempting mistake - that is 99% x 99%, the formula for two parts in series where a request needs both. Redundant copies multiply the failure chances, not the availabilities.',
      },
      {
        id: 'red-4',
        prompt: 'Two database replicas sit in the same rack, behind the same top-of-rack switch. The switch fails. What do the two copies buy you against this failure?',
        options: [
          'Full protection - one replica survives because copies are independent',
          'Half the protection - the replica closest to the switch survives',
          'Nothing - both copies share that switch, so they fail together',
          'It depends on the replication mode',
        ],
        answer: 2,
        explanation:
          'Redundancy only protects against failures the copies do not share. A shared rack, switch, power feed or zone is one failure domain, so both copies fail at once and the squared failure chance does not apply. Replication mode decides how much data is lost, not whether the copies are independent.',
      },
      {
        id: 'red-5',
        prompt: 'A service runs 9 instances across three zones. A config change with a typo is deployed to all 9 at once and they all fail health checks. What would have limited the damage?',
        options: [
          'More instances per zone',
          'A rolling deploy one zone at a time, with health verification and automatic rollback between zones',
          'A fourth zone',
          'Switching from active-active to active-passive',
        ],
        answer: 1,
        explanation:
          'The failure was correlated by the deploy, not by hardware, so more copies or more zones fail the same way - the tempting answer adds copies that all receive the same bad config. Rolling out per zone keeps six instances on the old version while the bad one is caught and rolled back.',
      },
      {
        id: 'red-6',
        prompt: 'Someone runs DROP TABLE orders on the primary database, which has two synchronous replicas. What do the replicas do for you?',
        options: [
          'They keep a copy of the table, so you promote one',
          'Synchronous replicas refuse destructive statements',
          'They delay the drop until an operator confirms',
          'Nothing - the drop is replicated to them within milliseconds; only a backup or a delayed replica gets the table back',
        ],
        answer: 3,
        explanation:
          'Replication copies every change, including mistakes, so the replicas lose the table too. Redundancy protects against a part dying, not against a bad write. That is why backups (and deliberately delayed replicas) exist next to replicas rather than instead of them.',
      },
      {
        id: 'red-7',
        prompt: 'Your database has had a passive standby for two years. Nobody has ever failed over to it. What is the realistic risk?',
        options: [
          'The standby path is untested: stale credentials, a hostname nobody updated or a lagging replica may break it on first use - rehearse the failover on a schedule',
          'None - replication has been green the whole time',
          'The standby wears out from idling',
          'Only that the standby costs money',
        ],
        answer: 0,
        explanation:
          'Green replication proves the data is flowing, not that the switch works. The failover itself - promotion, repointing clients, permissions on the new primary - only runs during incidents, so it collects broken assumptions. Cost is real, but the bigger risk is paying for a spare that does not take over.',
      },
      {
        id: 'red-8',
        prompt:
          'In the Lab (Redundancy focus) everything starts with one copy. You add a second app server but keep one load balancer, one config service and one database. The design availability barely moves. Why?',
        options: [
          'App servers never fail in the model',
          'The other single parts are still in series with it: each keeps its own 0.1% of downtime, and the design is the product of all of them',
          'Two app servers split the load, so each fails more often',
          'The Lab needs three app servers before the number changes',
        ],
        answer: 1,
        explanation:
          'A request needs every tier, so the design multiplies all the tier availabilities. Doubling one tier removes only that tier from the list of single points; the load balancer, config service, database and zone still add their downtime. Redundancy has to reach every tier on the request path before the nines climb.',
      },
      {
        id: 'red-9',
        prompt:
          'You patch servers one at a time, taking each out of service for an hour, and you must still survive one unexpected failure during patching. How many spares beyond peak need do you need?',
        options: ['None (N)', 'One (N+1)', 'Two (N+2)', 'Double everything (2N)'],
        answer: 2,
        explanation:
          'Patching already uses one spare, so a surprise failure during that hour needs a second: N+2. N+1 is the tempting answer and it is enough only when nothing is out for maintenance. 2N also works, but it buys far more idle capacity than the requirement asks for.',
      },
      {
        id: 'red-10',
        prompt: 'You want active-active redundancy for a stateless web tier and for the database. Which is the harder one, and why?',
        options: [
          'The web tier, because it has more instances',
          'Both are equally easy behind a load balancer',
          'Neither - active-active only works across regions',
          'The database, because two copies accepting writes at once must replicate or partition them without conflicts',
        ],
        answer: 3,
        explanation:
          'Stateless copies are interchangeable: any one can serve any request, so active-active is just a load balancer and health checks. Copies that hold state must agree on every write, which is why most databases run active-passive - one writer and a standby - and accept a failover gap instead.',
      },
    ],
  },
  {
    slug: 'fault-tolerance',
    title: 'Fault Tolerance',
    tagline: 'Degrade in pieces instead of failing all at once.',
    category: 'reliability',
    difficulty: 'Intermediate',
    lab: 'redundancy',
    labFocus: 'fault-tolerance',
    keywords: ['graceful degradation', 'bulkhead', 'timeout', 'fallback'],
    what: 'Fault tolerance is the ability to keep providing useful service while some components are failing.',
    why: 'Perfect availability is impossible; partial availability is achievable. A feed that loads without personalised recommendations is far better than an error page.',
    how: [
      'Keep spare copies with the headroom to absorb a loss (N+1), so a dead part is a capacity event, not an outage.',
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
    mistakes: [
      'Retrying without a circuit breaker, which turns a slow dependency into a self-inflicted denial of service.',
      'Calling a dependency with no timeout, so one slow service holds every thread.',
      'Fallback paths that only run during incidents and were never tested.',
    ],
    related: ['circuit-breaker', 'bulkhead', 'retry', 'backpressure', 'redundancy'],
    quiz: [
      {
        id: 'ft-1',
        prompt:
          'The product page calls a reviews service with no timeout. Reviews starts taking 30 seconds per call. The product service has 200 worker threads and gets 100 requests per second. What happens?',
        options: [
          'Only the reviews section is slow; the rest of the page is fine',
          'Within about two seconds every thread is waiting on reviews, and the whole product page fails - including requests that never needed reviews',
          'The product service queues requests and serves them all 30 seconds late',
          'Reviews recovers faster because it gets fewer calls',
        ],
        answer: 1,
        explanation:
          'Each request holds a thread for 30 s, so 100 requests a second use all 200 threads in two seconds. A non-critical feature has taken down the core page. The tempting answer - only the section is slow - is what a timeout and a fallback would give you, not what an unbounded wait gives you.',
      },
      {
        id: 'ft-2',
        prompt: 'In the same incident, which single change stops reviews from taking down the product page?',
        options: [
          'Double the worker threads to 400',
          'Retry the reviews call three times',
          'A 300 ms timeout on the reviews call, with the page rendering without reviews when it fires',
          'Move reviews to a bigger machine',
        ],
        answer: 2,
        explanation:
          'Bounding the wait bounds the damage: worst case the page costs 300 ms and renders without reviews. More threads only delays the pile-up by two more seconds, and retries multiply the calls to a service that is already struggling.',
      },
      {
        id: 'ft-3',
        prompt: 'The authorisation service cannot be reached. Should the API fail open (allow the request) or fail closed (refuse it)?',
        options: [
          'Fail open - availability always comes first',
          'Fail open for reads, closed for writes',
          'Retry until it answers, however long that takes',
          'Fail closed - letting unchecked requests through is a security hole, even though it means refusing users',
        ],
        answer: 3,
        explanation:
          'Fail open or closed is decided per dependency by what a wrong answer costs. An authorisation check that fails open lets anyone read anything. Refusing requests hurts availability, but for this dependency that is the cheaper failure. Retrying forever is an unbounded wait, which spreads the outage.',
      },
      {
        id: 'ft-4',
        prompt: 'The personalised recommendations service is down. What is the fault-tolerant behaviour for the home page?',
        options: [
          'Show a cached list of popular items and render the rest of the page normally',
          'Show an error page until recommendations is back',
          'Keep the request open until recommendations answers',
          'Redirect the user to the search page',
        ],
        answer: 0,
        explanation:
          'Recommendations is a soft dependency: the page is still useful without personalisation, so it degrades to a fallback instead of failing. The fault happened; the user never experienced a failure. Waiting or erroring turns a non-critical fault into a user-visible failure.',
      },
      {
        id: 'ft-5',
        prompt:
          'In the Lab (Fault tolerance focus), three app servers carry 150 req/s. You click App 2 to kill it. What do you see?',
        options: [
          'Every request fails until you repair App 2',
          'Nothing at all - not a single request fails',
          'The requests sent to App 2 fail until health checks eject it, then App 1 and App 3 carry all 150 req/s at 75% load',
          'The load balancer fails too, because it lost a target',
        ],
        answer: 2,
        explanation:
          'A dead copy keeps receiving its third of the traffic until the health check notices (10 s in the Lab), so a short dip appears on the chart. After the ejection the two survivors each carry 75 req/s of their 100 req/s capacity. Fault tolerance hides the failure after a detection gap; it does not make the gap zero.',
      },
      {
        id: 'ft-6',
        prompt: 'Still in the Lab at 150 req/s, you kill a second app server. Only one is left. What happens?',
        options: [
          'It serves everything, just more slowly',
          'It can serve 100 of the 150 req/s, so about a third of requests are rejected - the spares covered one failure, not two',
          'All requests fail, because the tier is below its minimum size',
          'The load balancer starts a new app server automatically',
        ],
        answer: 1,
        explanation:
          'Fault tolerance has limits you choose in advance. Three servers at 150 req/s is N+1: one can die. With two gone the last one is at 150% of its capacity and sheds the excess. The tempting answer, just slower, ignores that a saturated server rejects or times out requests rather than queueing forever.',
      },
      {
        id: 'ft-7',
        prompt:
          'One disk in a mirrored pair develops a bad sector. The read is served from the other disk and the user gets the right page. How do you describe this?',
        options: [
          'A failure, because a disk broke',
          'An error the user saw',
          'Nothing happened, so there is nothing to fix',
          'A fault that did not become a failure - but replace the disk, because the pair now has no spare',
        ],
        answer: 3,
        explanation:
          'A fault is the defect; a failure is when the user sees it. Fault tolerance stopped this fault at the mirror. It still matters: until the disk is replaced the pair is running without a spare, and the next fault would reach the user.',
      },
      {
        id: 'ft-8',
        prompt: 'Dependency A returns an error in 5 ms when it is broken. Dependency B hangs for 30 seconds when it is broken. Which is more dangerous to your service?',
        options: [
          'B - a slow failure holds threads and connections until your service runs out of them',
          'A - errors are worse than slow answers',
          'They are equally dangerous',
          'Neither, as long as you retry',
        ],
        answer: 0,
        explanation:
          'A fast error lets you fall back immediately and keeps your capacity free. A hang consumes a thread for 30 s per call, which is how one broken dependency cascades into a total outage. Retrying a hanging call makes it worse, not better.',
      },
      {
        id: 'ft-9',
        prompt: 'Your service gives at most 20 of its 200 threads to the reviews client. Reviews becomes very slow. What does that limit guarantee?',
        options: [
          'Reviews becomes fast again',
          'Reviews calls never fail',
          '180 threads stay free for everything else, so only the reviews feature suffers',
          'The whole service slows down evenly',
        ],
        answer: 2,
        explanation:
          'That limit is a bulkhead: it caps how much of your capacity one dependency can take. It does not fix reviews - calls beyond the 20 threads fail fast - but it keeps the failure local instead of letting it consume every thread.',
      },
      {
        id: 'ft-10',
        prompt:
          'Your fallbacks only run during incidents and were last exercised a year ago. How do you find out whether they still work?',
        options: [
          'Wait for the next incident and watch closely',
          'Inject the faults on purpose in business hours - kill instances, add latency, return errors from dependencies - and check the degraded behaviour',
          'Read the code carefully',
          'Add more logging to the fallback paths',
        ],
        answer: 1,
        explanation:
          'Code that only runs during incidents is untested code, and it rots silently. Fault injection runs it deliberately, on a Tuesday afternoon, with people watching. Waiting for a real incident finds the same bug at the worst possible time, and reading code misses stale config and credentials.',
      },
    ],
  },
  {
    slug: 'high-availability',
    title: 'High Availability',
    tagline: 'Designing so that no single failure is visible to users.',
    category: 'reliability',
    difficulty: 'Intermediate',
    lab: 'redundancy',
    labFocus: 'high-availability',
    keywords: ['multi-az', 'failover', 'nines', 'health checks'],
    what: 'A high-availability design keeps the service running through the failure of any single component, usually through redundancy plus automatic failover.',
    why: 'Availability targets above about 99.9% cannot be met by manual recovery. 99.99% allows 52.6 minutes of downtime a year, and one human recovery - paged, awake, logged in, diagnosed, fixed - takes tens of minutes, so two incidents spend the whole budget.',
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
    mistakes: [
      'Claiming HA while the failover path has never been executed.',
      'Two of everything in one zone, so one zone outage still takes all of it.',
      'Sizing each zone for half the traffic, so the surviving zone overloads when the other is lost.',
    ],
    related: ['availability', 'redundancy', 'failover', 'health-checks', 'disaster-recovery', 'single-point-of-failure'],
    quiz: [
      {
        id: 'ha-1',
        prompt:
          'The target is 99.99% (about 52.6 minutes of downtime a year). The database primary fails about twice a year and failover is manual, taking about 25 minutes each time. Can the design meet the target?',
        options: [
          'Yes - two failures a year is rare',
          'Yes, as long as the standby is in another zone',
          'Only if the database is replaced with a bigger machine',
          'Not realistically - the two manual failovers alone use about 50 of the 52.6 minutes; failover must be automatic',
        ],
        answer: 3,
        explanation:
          'Downtime is failures times recovery time: 2 x 25 minutes is 50 minutes, nearly the whole yearly budget, before any other incident. A second zone protects against a zone outage but does not shorten a manual switch, and a bigger machine does not fail less often in any way you can count on.',
      },
      {
        id: 'ha-2',
        prompt: 'System A fails once a month and recovers in 30 seconds. System B fails once a year and takes 8 hours to recover. Which has more downtime a year?',
        options: [
          'B - about 8 hours a year against about 6 minutes for A',
          'A - it fails twelve times as often',
          'They are about the same',
          'You cannot tell without knowing the MTBF',
        ],
        answer: 0,
        explanation:
          'Downtime is failure count times recovery time: A is 12 x 30 s = 6 minutes (about 99.999%), B is 1 x 8 h = 8 hours (about 99.9%). Failing less often feels safer, but recovering fast is the term you control more cheaply, and here it is worth about eighty times less downtime. MTBF is exactly what the question gives.',
      },
      {
        id: 'ha-3',
        prompt:
          'A 20-minute outage breaks down as: 8 minutes before anyone noticed, 7 minutes to find which service, 2 minutes deciding who may roll back, 3 minutes of manual steps. Which change cuts the most time?',
        options: [
          'Faster servers',
          'A second region',
          'Alerting on a user-facing symptom such as the checkout error rate, instead of on CPU',
          'More detailed logs',
        ],
        answer: 2,
        explanation:
          'Detection is the largest slice, and a symptom alert fires within a minute of users seeing errors. Faster servers and a second region do not help you notice. Logs help with the 7-minute diagnosis, but only after someone knows to look.',
      },
      {
        id: 'ha-4',
        prompt:
          'In the Lab (High availability focus) the design is at 99.80% against a 99.99% target. You add a second config service copy and it rises to about 99.90%. Why is it still short?',
        options: [
          'The Lab needs a third config copy',
          'Two terms of about 4.4 hours a year are left: the manual database failover and everything sharing one zone - it takes automatic failover and a second zone as well',
          'Config copies do not count toward availability',
          'The target cannot be reached in the Lab',
        ],
        answer: 1,
        explanation:
          'The design is a product, so every large term has to go. The tier-by-tier list shows the database at 99.95% (manual failover charged at 30 minutes a failure) and the zone at 99.95%. Switch to automatic failover and two zones and the design passes 99.99%; no single change gets there alone.',
      },
      {
        id: 'ha-5',
        prompt:
          'API servers run in two zones behind a multi-zone load balancer, but the only database - no standby - runs in zone A. Zone A has an outage. What happens?',
        options: [
          'Zone B keeps serving, because half the API servers are fine',
          'Zone B serves reads only',
          'The load balancer moves the database to zone B',
          'Full outage: the zone B servers cannot answer without the database, which went down with zone A',
        ],
        answer: 3,
        explanation:
          'High availability has to reach every part on the request path. Spreading the API tier does nothing when every request still needs one database in one zone. The fix is a standby in zone B with automatic promotion. Load balancers route traffic; they do not move databases.',
      },
      {
        id: 'ha-6',
        prompt: 'Six API servers across two zones sit behind one load balancer running on a single virtual machine. Is the design highly available?',
        options: [
          'No - the load balancer is a single point of failure in front of everything; use a redundant pair or a managed multi-zone load balancer',
          'Yes - six API servers is plenty of redundancy',
          'Yes, because load balancers do not fail',
          'Only if the API servers are stateless',
        ],
        answer: 0,
        explanation:
          'Anything that fronts the whole system must itself be redundant, or it decides the availability of everything behind it. The six servers are irrelevant when the one box in front of them dies. Statelessness matters for the API tier, not for the load balancer being a single machine.',
      },
      {
        id: 'ha-7',
        prompt: 'An incident review finds 18 of the 26 incidents last year were caused by deploys. What gives the biggest availability gain?',
        options: [
          'More reliable hardware',
          'A third availability zone',
          'Deploying less often',
          'Automated canary releases that roll back on a rising error rate, so a bad deploy reverts in minutes',
        ],
        answer: 3,
        explanation:
          'Attack the largest cause. Deploys cause most incidents here, and an automatic rollback turns a 90-minute incident into a 3-minute one. Hardware and zones protect against causes that barely appear in this list. Deploying less often makes each deploy bigger and riskier without shortening recovery.',
      },
      {
        id: 'ha-8',
        prompt: 'The architecture diagram shows two zones and automatic failover, but nobody has ever triggered a failover. What should you do before claiming high availability?',
        options: [
          'Nothing - the diagram proves it',
          'Run a game day: fail over on purpose, in business hours, and measure recovery at the client',
          'Buy a support contract from the cloud provider',
          'Add a third zone',
        ],
        answer: 1,
        explanation:
          'A failover path that has never run is a hypothesis. Game days find the expired credential, the hardcoded hostname or the client that caches the old address while people are awake and watching. More zones or contracts add to a design that is still unproven.',
      },
      {
        id: 'ha-9',
        prompt:
          'An internal tool has a 99.9% target (about 8.8 hours of downtime a year). You can build multi-region active-active, or a documented recovery into a second region that takes about 4 hours. Which fits?',
        options: [
          'Multi-region active-active - higher availability is always the goal',
          'Neither - 99.9% needs no plan at all',
          'The documented 4-hour recovery: it fits the budget at a fraction of the cost and complexity',
          'Active-active in one region only',
        ],
        answer: 2,
        explanation:
          'High availability is a deliberate decision, not maximum redundancy. A region loss is rare, and one 4-hour recovery fits inside 8.8 hours. Active-active across regions roughly doubles cost and adds data-layer complexity the target does not need. No plan at all leaves the recovery time unknown.',
      },
      {
        id: 'ha-10',
        prompt: 'Three API servers per zone, two zones, each server at 70% CPU at peak. Zone A is lost. What happens?',
        options: [
          'Zone B absorbs the traffic at 70%',
          'Zone B servers would need about 140% each, so they overload - each zone must be able to carry the whole peak alone',
          'The load balancer throttles users evenly with no errors',
          'Nothing, because traffic drops during outages',
        ],
        answer: 1,
        explanation:
          'Losing a zone moves all of its traffic onto the other zone, doubling the load there: 2 x 70% is 140%. Surviving a zone outage means each zone runs at 50% or less at peak, or the design scales out fast enough. Redundancy without the headroom to absorb the loss is not high availability.',
      },
    ],
  },
  {
    slug: 'single-point-of-failure',
    title: 'Single Point of Failure',
    tagline: 'The one box whose loss takes everything with it.',
    category: 'reliability',
    difficulty: 'Beginner',
    lab: 'redundancy',
    labFocus: 'single-point-of-failure',
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
          'The compute tiers are redundant; the single database is not. Its failure is a full outage regardless of how many API servers exist. The load balancers are the tempting answer because they front everything, but there are two of them.',
      },
      {
        id: 'spof-2',
        prompt:
          'Three app instances run in three zones. Each reads feature flags from one config service and, by design, refuses to serve without fresh config. The config service starts returning 500s. What happens?',
        options: [
          'The instance closest to the config service fails; the other two keep serving',
          'Nothing, because the app tier runs in three zones',
          'All three instances fail together - they share one unreplicated dependency',
          'Requests slow down but succeed',
        ],
        answer: 2,
        explanation:
          'Redundancy above a single point inherits the availability of that point. All three instances depend on the same config service, so its failure is correlated across every zone. Keeping the last known good config and replicating the config service both remove the single point.',
      },
      {
        id: 'spof-3',
        prompt:
          'In the Lab (Single point of failure focus) you kill LB 1, then App 2, then DB 1, repairing each before the next - traffic keeps flowing every time. Then you kill Config 1 and every request fails. What did you find?',
        options: [
          'The config service has no spare, and every request needs it: it is the single point of failure',
          'The Lab ran out of capacity after four kills',
          'The database failover broke',
          'The load balancer is the single point of failure',
        ],
        answer: 0,
        explanation:
          'Every other tier has a spare, so killing one copy only costs a short detection gap. The config service has one copy, and with it gone no request can be answered. That is the definition in action: one part, no alternative, on the path of every request. Add a second config copy and the same kill no longer stops traffic.',
      },
      {
        id: 'spof-4',
        prompt: 'The TLS certificate for your main domain is renewed by hand, once a year, by one engineer. Is that a single point of failure?',
        options: [
          'No - certificates are not servers',
          'No - one year is plenty of time',
          'Only if the engineer leaves the company',
          'Yes - if the renewal is missed the site fails for every user; automate the renewal and alert 30 days ahead',
        ],
        answer: 3,
        explanation:
          'A single point of failure is anything with no alternative whose loss stops the service - it does not have to be a box. An expired certificate breaks every connection at once. Holidays and sick days are enough to miss a manual renewal; the engineer leaving is only one way it goes wrong.',
      },
      {
        id: 'spof-5',
        prompt: 'Only one engineer knows how to run the database failover and holds the production credentials. She is on a flight when the primary dies. What was the single point of failure?',
        options: [
          'The database primary',
          'The engineer: a bus factor of one - share access, write the runbook, and rotate who runs failovers',
          'The flight',
          'There was none, the standby existed',
        ],
        answer: 1,
        explanation:
          'The standby existed, but nobody available could use it, so recovery depended on one person. People are part of the operational path. The primary dying is the fault; the missing alternative that turned it into an outage is the single engineer.',
      },
      {
        id: 'spof-6',
        prompt:
          'A single cache node can be replaced in two minutes, and while it is gone the app reads from the database - a fallback that is tested every month. Must you remove this single point?',
        options: [
          'Yes - every single point must be removed',
          'Yes - caches must always run as clusters',
          'Not necessarily - it is known, recovery is fast and the degraded mode works; accept it and document it',
          'No - caches cannot fail',
        ],
        answer: 2,
        explanation:
          'Removing a single point costs money and complexity, so the decision is economic. A known single point with a fast, tested recovery can be the right call. The only unacceptable single point is the one nobody knows about. Caches certainly fail, which is exactly why the fallback matters.',
      },
      {
        id: 'spof-7',
        prompt: 'You can remove one of two single points this quarter: your one DNS provider, or your one cloud provider. Which is usually the better spend?',
        options: [
          'The second DNS provider - cheap, and it removes a failure that takes down everything',
          'The second cloud provider - it removes more risk',
          'Neither - providers never fail',
          'Both at once, or neither is worth it',
        ],
        answer: 0,
        explanation:
          'Compare the cost of the mitigation with the chance of failure times the cost of the outage. A second DNS provider is cheap and DNS provider outages have taken down large parts of the web. A second cloud provider is enormously expensive to build and run, and rarely justified. More risk removed is not the only factor.',
      },
      {
        id: 'spof-8',
        prompt:
          'In the Lab you run two of every part, but with One zone selected. You press Kill zone A. What happens, and what was the single point of failure?',
        options: [
          'Half the parts die and the other half serve',
          'The standby database takes over',
          'Nothing, because every part has a spare',
          'Everything dies at once - the zone itself was the single point, because every copy shared it',
        ],
        answer: 3,
        explanation:
          'Copies protect only against failures they do not share. With one zone, every copy sits in zone A, so a zone outage is one failure that removes all of them. Switch to Two zones and the copies alternate A and B, so the same kill leaves a working copy of each tier.',
      },
      {
        id: 'spof-9',
        prompt: 'During an outage you find the fix, but the CI system that is the only way to deploy is down too. What kind of single point is this?',
        options: [
          'Not a single point, because CI is not on the request path',
          'A control-plane single point: the systems you need to recover - deploy, monitoring, access - must survive the outage too',
          'A data single point',
          'A single point only for developers, not for users',
        ],
        answer: 1,
        explanation:
          'Walk the operational path as well as the request path. A service is not recoverable if the only way to ship the fix is broken. It does not serve requests, which is why it is easy to miss - but users wait for the fix all the same.',
      },
      {
        id: 'spof-10',
        prompt: 'One Redis instance holds the login sessions and the rate-limit counters for every service. It crashes. What is the blast radius?',
        options: [
          'Only rate limiting stops working',
          'Only the service that owns Redis is affected',
          'Nothing, because Redis is in memory and restarts fast',
          'Every service at once: users are logged out and rate limits stop working - one shared box coupled them all',
        ],
        answer: 3,
        explanation:
          'Shared infrastructure couples everything that depends on it, so its blast radius is all of those dependents. Replicate it, or split sessions and rate limits so one failure does not take both. A fast restart shortens the outage but does not bring back sessions held only in memory.',
      },
    ],
  },
  {
    slug: 'failover',
    title: 'Failover',
    tagline: 'Detect, fence, promote, repoint - and measure it at the client.',
    category: 'reliability',
    difficulty: 'Intermediate',
    lab: 'redundancy',
    labFocus: 'failover',
    keywords: ['promotion', 'split brain', 'fencing', 'rto', 'rpo'],
    what: 'Failover is the process of switching traffic from a failed component to a healthy replacement, automatically or manually.',
    why: 'Redundancy without failover is just extra cost. The failover procedure - and its duration - is what your availability number actually depends on.',
    how: [
      'Detect failure through health checks, with thresholds that avoid flapping on a single blip.',
      'Decide by quorum, so one observer with a bad network link cannot start a failover alone.',
      'Fence the old primary so it cannot accept writes if it comes back, then promote the most up-to-date standby.',
      'Repoint clients: connection strings, service discovery, a proxy, or DNS with a short TTL.',
    ],
    diagram: `t+0s   primary stops responding
t+10s  health checks fail threshold
t+11s  quorum agrees; old primary fenced
t+15s  replica promoted (the most up-to-date one)
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
    mistakes: [
      'Not measuring RPO - asynchronous replication means failover can silently lose recent writes.',
      'Measuring failover at the database instead of at the client, where pooled connections and cached DNS add minutes.',
      'Letting a recovered old primary rejoin as primary automatically.',
    ],
    related: ['replication', 'health-checks', 'high-availability', 'leader-election', 'redundancy'],
    quiz: [
      {
        id: 'fo-1',
        prompt:
          'The primary replicates asynchronously and the standby is about 1 second behind. The system takes 20 writes per second. The primary dies and the standby is promoted. What happened to the data?',
        options: [
          'Nothing was lost - the standby is a full copy',
          'About 20 acknowledged writes are gone: they were on the primary but not yet shipped',
          'All writes since the last backup are gone',
          'The standby refuses promotion until it has every write',
        ],
        answer: 1,
        explanation:
          'With async replication the primary acknowledges a write before the standby has it, so the lag is a window of writes that exist only on the primary: 20 writes/s x 1 s. The Lab shows this number as Writes lost at switch. The standby is a copy of everything except that window, and nothing makes it wait unless you configure it to.',
      },
      {
        id: 'fo-2',
        prompt:
          'The old primary was not dead - a network partition cut it off. The standby was promoted. The partition heals and the old primary, still believing it is primary, accepts writes. What is this, and what prevents it?',
        options: [
          'Split brain; prevent it with fencing (the old primary is cut off from storage or powered off) and a quorum for the promotion decision',
          'Replication lag; prevent it with sync replication',
          'Failback; prevent it with a shorter DNS TTL',
          'A normal failover; nothing needs preventing',
        ],
        answer: 0,
        explanation:
          'Two nodes both acting as primary diverge, and reconciling them afterwards is manual and lossy. Quorum stops one isolated observer from promoting, and fencing makes sure the deposed primary cannot write even if it wakes up. Sync replication does not help: the problem is two writers, not a slow copy.',
      },
      {
        id: 'fo-3',
        prompt:
          'A managed database fails over in 25 seconds, but the application stays broken for 9 minutes. The database worked as designed. Where did the minutes go?',
        options: [
          'The standby was slow to warm up',
          'The failover log was wrong',
          'Clients held pooled connections to the dead primary and cached its old DNS answer, so they kept talking to it until timeouts expired',
          'The load balancer was overloaded',
        ],
        answer: 2,
        explanation:
          'Failover is only done when clients reach the new primary. Dead pooled connections hang until the socket timeout, and a runtime that caches DNS forever keeps resolving the old address. Measure recovery at the client, and set connection validation, short socket timeouts and a sane DNS cache TTL.',
      },
      {
        id: 'fo-4',
        prompt: 'Which order is right for an automatic database failover?',
        options: [
          'Promote the standby, repoint clients, then check the old primary is really dead',
          'Repoint clients, promote, detect',
          'Fence the old primary, detect, promote, repoint',
          'Detect the failure, agree by quorum, fence the old primary, promote the standby, repoint clients',
        ],
        answer: 3,
        explanation:
          'You cannot act before you detect, and you must fence before a second primary exists, or a primary that was only unreachable keeps taking writes next to the new one. Promoting first and checking later is exactly how split brain happens.',
      },
      {
        id: 'fo-5',
        prompt:
          'After a failover the old primary is repaired and comes back. It is behind, and may hold a few writes the new primary never saw. What should happen to it?',
        options: [
          'Rebuild it as a replica of the new primary, and switch back only later, deliberately, in a planned window',
          'It resumes as primary automatically, since it was the original',
          'Delete it - once replaced, a node can never be reused',
          'Both nodes stay primary and share the load',
        ],
        answer: 0,
        explanation:
          'Automatic failback would make a flapping node flip the primary role back and forth, each flip an outage and a data risk. In the Lab, repairing DB 1 after a failover brings it back as the standby of DB 2 for this reason. Two primaries at once is split brain, not load sharing.',
      },
      {
        id: 'fo-6',
        prompt:
          'Detection takes 6 s, promotion 5 s, and clients find the new primary through a DNS name with a 300 s TTL. Which step dominates the outage, and what shortens it?',
        options: [
          'Detection - make health checks every 100 ms',
          'Promotion - use a bigger standby',
          'Redirection - clients keep the cached answer for up to 300 s; use a proxy or virtual IP they already point at, or a short TTL',
          'None - the outage is 11 s',
        ],
        answer: 2,
        explanation:
          'Failover time is detect + decide + promote + redirect, and redirect is often the worst. A 300 s TTL lets clients keep the old address for five minutes, far longer than the 11 s of the other steps. Checking every 100 ms mostly buys false failovers on network blips.',
      },
      {
        id: 'fo-7',
        prompt: 'In the Lab (Failover focus) you switch to Sync replication and kill DB 1. What changes, and what does it cost?',
        options: [
          'Nothing changes - replication mode only affects reads',
          'Writes lost at the switch drop to zero, because every acknowledged write is already on the standby; the cost is that each write waits one extra round trip',
          'Failover becomes instant',
          'The standby can no longer be promoted',
        ],
        answer: 1,
        explanation:
          'Synchronous replication acknowledges a write only once the standby has it, so there is no window of unshipped writes to lose. The failover gap on the chart stays the same - detection and promotion still take their seconds. Paying a round trip on every write is the price, which is why many systems accept a small lag instead.',
      },
      {
        id: 'fo-8',
        prompt: 'The service targets 99.99%. The on-call engineer can promote the standby by hand in about 20 minutes. Is manual failover enough?',
        options: [
          'Yes - 20 minutes is fast for a human',
          'Yes, if the engineer has a good runbook',
          'Only for planned maintenance',
          'No - 99.99% allows 52.6 minutes a year, so three failures would spend the whole budget; failover must be automatic',
        ],
        answer: 3,
        explanation:
          'Manual failover is measured in tens of minutes, and each failure spends that from a yearly budget of 52.6 minutes. A runbook makes the human faster and safer, but not seconds-fast. Try Manual in the Lab: nothing happens until you press Promote standby, and every second you take is downtime.',
      },
      {
        id: 'fo-9',
        prompt:
          'The primary dies. The only standby is 40 seconds behind because of the load spike that caused the failure. What is the honest description of the choice?',
        options: [
          'Always promote - availability always wins',
          'Promote and lose about 40 seconds of writes, or wait for the old primary and stay down longer - a choice you should make in advance with a maximum-lag rule',
          'Never promote a lagging replica',
          'Promote it - replicas catch up after promotion',
        ],
        answer: 1,
        explanation:
          'Promoting a lagging standby trades lost data for availability; refusing trades availability for data. Neither is always right, which is why you set the maximum acceptable lag before the incident and alert when a replica passes it. A promoted replica cannot catch up on writes that only existed on the dead primary.',
      },
      {
        id: 'fo-10',
        prompt: 'To fail over faster, a team sets detection to one failed health check at a 1-second interval. What goes wrong?',
        options: [
          'A garbage collection pause or a network blip triggers a failover that was not needed - each one a small outage, with a split brain risk',
          'Nothing - faster detection is always better',
          'The health checks overload the database',
          'The standby stops replicating',
        ],
        answer: 0,
        explanation:
          'Aggressive detection trades faster recovery for false positives, and an unnecessary failover is itself an outage plus a chance of two primaries. Keep the detection window longer than your worst pause and blip, and make promotion and redirection fast instead. The Health-check detection slider in the Lab shows the other side: a longer window is a longer gap.',
      },
    ],
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
