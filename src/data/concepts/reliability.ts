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
          'About 90% each - still serving, but with little headroom left',
          'They stay at 60% - the load balancer drops the share of the dead server',
          'Outage: with one server gone the whole tier cannot serve at all',
          'They go to 120% each - each survivor picks up the full 60% the dead one carried',
        ],
        answer: 0,
        explanation:
          'The dead server carried a third of the load (60% of one box), which is now split over two: 180% of one server over two servers is 90% each. The load does not vanish - the users of the dead server still send requests - so 60% is wrong. 120% would be the case with two survivors carrying four servers worth of work.',
      },
      {
        id: 'red-2',
        prompt: 'The same three app servers run at 90% CPU each at peak, and one dies. What is the most likely outcome?',
        options: [
          'The two survivors run pinned at 100% CPU and cope, just with higher latency for a while',
          'They need 135% each, fail health checks one by one, and the whole tier goes down',
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
        options: ['98.01%', '99%', '99.5%', '99.99%'],
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
          'It depends on the replication mode: synchronous keeps one copy safe',
        ],
        answer: 2,
        explanation:
          'Redundancy only protects against failures the copies do not share. A shared rack, switch, power feed or zone is one failure domain, so both copies fail at once and the squared failure chance does not apply. Replication mode decides how much data is lost, not whether the copies are independent.',
      },
      {
        id: 'red-5',
        prompt: 'A service runs 9 instances across three zones. A config change with a typo is deployed to all 9 at once and they all fail health checks. What would have limited the damage?',
        options: [
          'More instances per zone, so one bad instance is a smaller share of the fleet',
          'A rolling deploy one zone at a time, with automatic rollback',
          'A fourth zone, so a zone-wide failure takes out only a quarter of capacity',
          'Switching from active-active to active-passive, so a standby stays untouched',
        ],
        answer: 1,
        explanation:
          'The failure was correlated by the deploy, not by hardware, so more copies or more zones fail the same way - the tempting answer adds copies that all receive the same bad config. Rolling out per zone keeps six instances on the old version while the bad one is caught and rolled back.',
      },
      {
        id: 'red-6',
        prompt: 'Someone runs DROP TABLE orders on the primary database, which has two synchronous replicas. What do the replicas do for you?',
        options: [
          'They keep a copy of the table, so you promote one and repoint the app at it',
          'Synchronous replicas reject a statement that would destroy committed rows',
          'They delay the drop until an operator confirms it on the primary',
          'Nothing - they apply the drop too, so restore from a backup',
        ],
        answer: 3,
        explanation:
          'Replication copies every change, including mistakes, so the replicas lose the table too. Redundancy protects against a part dying, not against a bad write. That is why backups (and deliberately delayed replicas) exist next to replicas rather than instead of them.',
      },
      {
        id: 'red-7',
        prompt: 'Your database has had a passive standby for two years. Nobody has ever failed over to it. What is the realistic risk?',
        options: [
          'The failover itself is untested and may break on first use - rehearse it',
          'None - replication has been green the whole time, so the standby is proven current',
          'The standby wears out from idling',
          'Only that the standby costs money for a copy that serves no traffic',
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
          'The other single parts stay in series, each adding its own downtime',
          'Two app servers split the load, but each now runs hotter and fails more often',
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
          'The web tier, because more instances means more health checks and more to keep in sync',
          'Both are equally easy behind a load balancer',
          'Neither - active-active only works across regions',
          'The database: two writable copies must agree on every write',
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
          'Only the reviews section is slow; the rest of the page renders on time',
          'All 200 threads are stuck within two seconds, and the whole page fails',
          'The product service queues requests and serves them 30 s late',
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
          'Double the worker threads to 400 so there is room for the slow calls',
          'Retry the reviews call three times so a slow attempt gets a second chance',
          'A 300 ms timeout, rendering the page without reviews when it fires',
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
          'Fail open - a brief auth outage should not lock every user out',
          'Fail open for reads and closed for writes, since reads change nothing',
          'Retry until it answers, however long the user has to wait',
          'Fail closed - unchecked requests are a security hole',
        ],
        answer: 3,
        explanation:
          'Fail open or closed is decided per dependency by what a wrong answer costs. An authorisation check that fails open lets anyone read anything. Refusing requests hurts availability, but for this dependency that is the cheaper failure. Retrying forever is an unbounded wait, which spreads the outage.',
      },
      {
        id: 'ft-4',
        prompt: 'The personalised recommendations service is down. What is the fault-tolerant behaviour for the home page?',
        options: [
          'Show cached popular items and render the rest of the page',
          'Show an error page until recommendations is back, so no user sees a half-built page',
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
          'Nothing at all - the load balancer retries each failed request on App 1 or App 3',
          'Requests to App 2 fail until it is ejected, then two servers carry 150 req/s',
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
          'It serves everything, just more slowly, as the extra requests wait in its queue',
          'About a third of requests are rejected - it can serve only 100 of the 150',
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
          'A failure, because a disk broke and the mirror is now degraded',
          'An error the user saw',
          'Nothing happened, so there is nothing to fix until the second disk shows errors',
          'A fault that did not become a failure - still replace the disk',
        ],
        answer: 3,
        explanation:
          'A fault is the defect; a failure is when the user sees it. Fault tolerance stopped this fault at the mirror. It still matters: until the disk is replaced the pair is running without a spare, and the next fault would reach the user.',
      },
      {
        id: 'ft-8',
        prompt: 'Dependency A returns an error in 5 ms when it is broken. Dependency B hangs for 30 seconds when it is broken. Which is more dangerous to your service?',
        options: [
          'B - a hang holds threads until your service runs out',
          'A - it fails every call at once, so the error rate jumps straight to 100%',
          'They are equally dangerous, since neither returns a useful answer',
          'Neither, as long as you retry each failed call a few times',
        ],
        answer: 0,
        explanation:
          'A fast error lets you fall back immediately and keeps your capacity free. A hang consumes a thread for 30 s per call, which is how one broken dependency cascades into a total outage. Retrying a hanging call makes it worse, not better.',
      },
      {
        id: 'ft-9',
        prompt: 'Your service gives at most 20 of its 200 threads to the reviews client. Reviews becomes very slow. What does that limit guarantee?',
        options: [
          'Reviews recovers sooner, because it now gets at most 20 calls at a time',
          'Reviews calls never fail, since they wait for a free thread instead',
          '180 threads stay free, so only the reviews feature suffers',
          'The whole service slows down evenly as the 200 threads share the wait',
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
          'Wait for the next incident and watch the fallback metrics closely',
          'Inject the faults on purpose - kill instances, add latency - and watch',
          'Read the code carefully and trace each fallback branch by hand',
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
          'Yes - two failures a year is rare enough for a 99.99% target',
          'Yes, as long as the standby sits in another zone',
          'Only if the database is replaced with a bigger machine',
          'Not realistically - two manual failovers use about 50 of the 52.6 minutes',
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
          'A - it fails twelve times as often, so it is down twelve times as much',
          'They are about the same',
          'You cannot tell without knowing the MTBF of each system first',
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
          'A second region to fail over to when a service breaks',
          'Alerting on a user-facing symptom, such as checkout errors',
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
          'The Lab needs a third config copy, because two copies cannot form a majority',
          'Manual database failover and one shared zone each still cost hours a year',
          'Config copies do not count toward availability, since config is read at boot',
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
          'Zone B keeps serving, because its API servers are still healthy and in rotation',
          'Zone B serves reads only',
          'The load balancer moves the database to zone B',
          'Full outage: zone B servers cannot answer without the database',
        ],
        answer: 3,
        explanation:
          'High availability has to reach every part on the request path. Spreading the API tier does nothing when every request still needs one database in one zone. The fix is a standby in zone B with automatic promotion. Load balancers route traffic; they do not move databases.',
      },
      {
        id: 'ha-6',
        prompt: 'Six API servers across two zones sit behind one load balancer running on a single virtual machine. Is the design highly available?',
        options: [
          'No - the one load balancer is a single point of failure',
          'Yes - six API servers across two zones is plenty of redundancy',
          'Yes, because a load balancer holds no state and restarts in seconds',
          'Only if the API servers are stateless and can move between zones',
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
          'A third availability zone, so a bad deploy reaches fewer servers',
          'Deploying less often, so there are fewer chances for a bad deploy',
          'Automated canary releases that roll back on a rising error rate',
        ],
        answer: 3,
        explanation:
          'Attack the largest cause. Deploys cause most incidents here, and an automatic rollback turns a 90-minute incident into a 3-minute one. Hardware and zones protect against causes that barely appear in this list. Deploying less often makes each deploy bigger and riskier without shortening recovery.',
      },
      {
        id: 'ha-8',
        prompt: 'The architecture diagram shows two zones and automatic failover, but nobody has ever triggered a failover. What should you do before claiming high availability?',
        options: [
          'Nothing - a diagram with a standby for every part already proves it',
          'Run a game day: fail over on purpose and measure recovery',
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
          'Neither - 99.9% is loose enough to need no recovery plan at all',
          'The documented 4-hour recovery - it fits the 8.8-hour budget',
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
          'Zone B absorbs the traffic at 70%, since the load balancer spreads it evenly',
          'Zone B servers need about 140% each and overload',
          'The load balancer throttles users evenly with no errors',
          'Nothing, because traffic drops during outages as users give up',
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
          'The config service: it has no spare and every request needs it',
          'The Lab ran out of spare capacity after four kills in a row',
          'The database failover broke, and DB 2 never took over',
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
          'No - a certificate is a file, not a server, so it cannot fail',
          'No - one year is plenty of time to notice and renew it',
          'Only if the engineer leaves the company and nobody else knows the steps',
          'Yes - a missed renewal breaks the site for every user',
        ],
        answer: 3,
        explanation:
          'A single point of failure is anything with no alternative whose loss stops the service - it does not have to be a box. An expired certificate breaks every connection at once. Holidays and sick days are enough to miss a manual renewal; the engineer leaving is only one way it goes wrong.',
      },
      {
        id: 'spof-5',
        prompt: 'Only one engineer knows how to run the database failover and holds the production credentials. She is on a flight when the primary dies. What was the single point of failure?',
        options: [
          'The database primary, because its death is what started the outage',
          'The engineer - recovery depended on one person',
          'The flight',
          'There was none, since a standby existed and was up to date',
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
          'Yes - every single point must be removed, however cheap its recovery',
          'Yes - caches must always run as clusters of at least three nodes',
          'Not necessarily - recovery is fast and the fallback is tested',
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
          'The second DNS provider - cheap, and DNS failure takes down everything',
          'The second cloud provider - it removes more risk, since the cloud hosts everything',
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
          'Everything dies - the zone was the single point all copies shared',
        ],
        answer: 3,
        explanation:
          'Copies protect only against failures they do not share. With one zone, every copy sits in zone A, so a zone outage is one failure that removes all of them. Switch to Two zones and the copies alternate A and B, so the same kill leaves a working copy of each tier.',
      },
      {
        id: 'spof-9',
        prompt: 'During an outage you find the fix, but the CI system that is the only way to deploy is down too. What kind of single point is this?',
        options: [
          'Not a single point, because CI is not on the request path and serves no users',
          'A control-plane single point: recovery tooling must survive outages too',
          'A data single point',
          'A single point only for developers, not for users, who never touch CI',
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
          'Only the service that owns Redis is affected, as the others just see a cache miss',
          'Nothing, because Redis is in memory and restarts fast',
          'Every service at once: logouts plus no rate limits',
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
          'Nothing was lost - the standby replays the missing second from its replication log',
          'About 20 acknowledged writes are gone - they never reached the standby',
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
          'Split brain; prevent it with fencing and a quorum for promotion',
          'Replication lag; prevent it with sync replication so both nodes hold the same writes',
          'Failback; prevent it with a shorter DNS TTL so clients move over faster',
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
          'The standby was slow to warm up, serving every query from a cold cache for minutes',
          'The failover log was wrong',
          'Clients kept pooled connections and cached DNS for the dead primary',
          'The load balancer was overloaded by every client reconnecting at once',
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
          'Detect, agree by quorum, fence the old primary, promote, repoint',
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
          'Rebuild it as a replica of the new primary',
          'It resumes as primary automatically, since it was the original and holds extra writes',
          'Delete it - once replaced, a node can never be reused',
          'Both nodes stay primary and share the write load between them',
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
          'Detection - make health checks every 100 ms so a failure is seen at once',
          'Promotion - use a bigger standby',
          'Redirection - the 300 s TTL; use a proxy or virtual IP instead',
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
          'No writes are lost at the switch, but every write waits one extra round trip',
          'Failover becomes instant, since the standby is already fully in sync',
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
          'Yes - 20 minutes is fast for a human woken up by a page at night',
          'Yes, if the engineer has a good runbook and practises it every quarter',
          'Only for planned maintenance',
          'No - three 20-minute failovers spend the whole 52.6-minute budget',
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
          'Always promote - availability always wins over a few lost writes',
          'Lose about 40 s of writes or stay down longer - decide in advance',
          'Never promote a lagging replica',
          'Promote it - the replica catches up on the 40 seconds after promotion',
        ],
        answer: 1,
        explanation:
          'Promoting a lagging standby trades lost data for availability; refusing trades availability for data. Neither is always right, which is why you set the maximum acceptable lag before the incident and alert when a replica passes it. A promoted replica cannot catch up on writes that only existed on the dead primary.',
      },
      {
        id: 'fo-10',
        prompt: 'To fail over faster, a team sets detection to one failed health check at a 1-second interval. What goes wrong?',
        options: [
          'A GC pause or network blip triggers failovers that were not needed',
          'Nothing - faster detection is always better, since it shortens every outage',
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
          'Closes and sends all traffic to the service again, since the cooldown is over',
          'Stays open until an operator resets it by hand',
          'Moves to HALF-OPEN and lets a few trial calls through',
          'Sends all traffic again but with a longer timeout to absorb slow replies',
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
          'Threads pile up on the 30 s waits until checkout itself goes down',
          'Nothing much - each request simply fails after 30 seconds and the user retries',
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
          'No - a frozen B cannot run its own breaker; it belongs in A',
          'Yes, as long as B also has a health check that reports the freeze',
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
          'Stop retrying and use the fallback',
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
          'The breaker opens for every user, although inventory is healthy',
          'Nothing - the breaker ignores 400s by design',
          'The breaker slows the buggy clients and lets the rest through',
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
          'Nothing - two failed calls are too few for the breaker to notice',
          'It opens on noise; require a minimum number of calls first',
          'It opens, which is correct - 50% of calls failed',
          'It slows down the next calls until the blip passes, then recovers',
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
          'Only recommendations are skipped; the other calls keep working',
          'Nothing changes, because the breaker only counts recommendations',
          'Email is skipped but payments keep working, since payments have priority',
          'Payments and email are blocked too',
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
          'Tell the user payment is unavailable and keep the order unpaid',
          'Show "Order confirmed" and charge the card when the provider returns',
          'Return the last cached payment response, as the Lab fallback does',
          'Retry in a loop until the breaker closes and the charge goes through',
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
          'All 40 probe together - 120 trial calls at once can knock it over',
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
          'Calls keep going to the Fallback until the cooldown ends',
          'Calls go to the Payment Service and fail while it is still warming up',
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
          'Nothing - no call ever finishes, so it never counts a failure',
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
          'Yes, always - a timeout means the payment did not happen, so nothing was charged',
          'Only with an idempotency key, or a retry may charge the card twice',
          'No, never retry a POST',
          'Yes, but only after waiting a full minute for the server to settle',
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
          'A new 201 Created with a second order id for the retry',
          '409 Conflict, because an order with that key already exists',
          '500, because the key was already used by an earlier request',
          'The stored first response - the same 201 and order id',
        ],
        answer: 3,
        explanation:
          'The point of the key is that the client cannot tell a repeat from a first try, so the server replays the stored original response, status code included. A second order is the duplicate the key exists to prevent. 409 is tempting, but it turns a successful order into an error the client has to untangle.',
      },
      {
        id: 'retry-4',
        prompt:
          'The mobile app, the API gateway and the database client of a service each make up to 3 attempts per request. The database starts failing every call. How many database calls can one tap in the app cause?',
        options: ['3', '9', '27', '81'],
        answer: 2,
        explanation:
          'Retries at nested layers multiply: 3 x 3 x 3 = 27 database calls for one tap, all arriving while the database is failing. Adding them up (3 + 3 + 3 = 9) is the tempting mistake. The Google SRE book makes the same point with 4 attempts at each of 3 layers: 64. Retry at one layer only.',
      },
      {
        id: 'retry-5',
        prompt:
          'In the Lab on the Retry focus (Immediate retry, 2,000 clients), the Dependency turns Overloaded right after the outage, with the load far above its capacity. The number of users did not change. Where does the extra load come from?',
        options: [
          'From the retries - every failed client retries at the same instant',
          'From new users arriving during the outage',
          'From the API Service retrying each failed call on its own behalf',
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
          'Idempotency - without retries, writes get duplicated',
          'Monitoring - failed calls are no longer logged',
          'Recovery from blips: a brief 503 now reaches the user',
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
          'Each failed call is still retried 3 times, as the attempt cap allows',
          'Most failures are not retried, so load stays near normal',
          'The client stops sending any requests until failures drop below 10%',
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
          'Nothing - the waits are exponential, which is what backoff should look like',
          'The waits are too short for a slow dependency to recover',
          'The 7 s of waits outlive the 2 s deadline of the caller',
          'It should retry 10 times instead, to ride out the slow call',
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
          'Wait the 30 s it asked for',
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
          'Put a circuit breaker in front',
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
          'Yes - applying the same PUT twice leaves the same state',
          'Only if the first attempt returned an error',
          'No - PUT is not idempotent, so a repeat can create a second user',
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
          'A smooth, low stream of reconnects, since each client waits longer each time',
          'Nothing for a minute, then everything at once',
          'One reconnect per client, evenly spread over 10 seconds',
          'Synchronised waves: everyone at about 1 s, then 3 s, then 7 s',
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
          'Both send the same load, since every client retries until the dependency is back',
          'Fixed delay sends fewer requests because it never grows',
          'Fixed delay holds about 1,000 req/s all minute; backoff decays',
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
          'Nothing - jitter only shifts single requests by a few milliseconds',
          'The same retries now arrive in tall synchronised spikes',
          'The total number of retries doubles, since no client is spread out',
          'The load drops, because every client now waits the full delay',
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
          'The Lab is broken at small delays, where timer resolution rounds the waits',
          'Jitter only works with fixed delays, not exponential ones',
          'With 100 ms, the clients succeed before they ever need to retry',
          'The waits are too short to spread the retries out',
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
          'About 6 seconds (12 x 500 ms)',
          'About 8.5 minutes',
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
          'Your own backoff settings - they apply to every client that calls you',
          'Jitter on the server',
          'Server-side rate limiting, answering 429 with Retry-After',
          'A longer cap on the backoff, so their retries spread out further',
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
          'Add a random 0 to 60 minute delay to each check',
          'Buy a server 60 times bigger',
          'Move the check to minute 30, away from the other hourly jobs',
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
          'Nothing - the 30 s cap already keeps the load low and spread out',
          'Clients keep retrying forever; add a total deadline',
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
          'Server 2 leaves the pool at once, as soon as its TCP connections drop',
          'About one request in three fails for up to 6 s, until Server 2 is ejected',
          'Every request fails until you restart Server 2',
          'Server 2 keeps receiving a third of the traffic for good, since Round Robin never skips',
        ],
        answer: 1,
        explanation:
          'The balancer learns about the crash only through its probes, and it waits for 3 consecutive failures, 2 s apart. Until then Server 2 stays in the pool and its third of the requests fail - the event log shows how many. "Leaves at once" is tempting, but no balancer can know without probing; "for good" is what happens with health checks off.',
      },
      {
        id: 'hc-2',
        prompt: 'To detect crashes faster you set the probe interval to 1 s and eject after a single failure. What new problem are you most likely to see?',
        options: [
          'Nothing new - crashed servers are simply detected in 1 s instead of 6 s',
          'Probes use all the bandwidth of the pool at one probe per second',
          'Healthy servers flap in and out on one slow reply or lost probe',
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
          'The probe interval is too long for the balancer to have noticed yet',
          'The server needs a liveness probe that restarts it on database errors',
          'The check is shallow; readiness should test its database connection',
        ],
        answer: 3,
        explanation:
          'A shallow check proves the process answers, not that it can do its job. A readiness check that uses the connection pool of the instance catches this broken server - and since only this one instance is affected, it does not risk the whole fleet. A restart (liveness) does not fix a wrong credential; it just adds restarts.',
      },
      {
        id: 'hc-4',
        prompt: 'Every instance runs a readiness check that queries the shared database. The database takes 10 s to fail over, every instance fails the check at once, and the balancer empties the pool: a total outage. What prevents it?',
        options: [
          'Fail open when every instance fails the check at once',
          'Probe the database more often so the pool refills sooner',
          'Lower the failure threshold to 1 so instances return to the pool faster',
          'Add more instances with the same check, so some survive the blip',
        ],
        answer: 0,
        explanation:
          'A check that fails on every instance at the same time says nothing about any one instance - it only takes the fleet out. Failing open keeps serving whatever can be served, and the database problem is handled by timeouts and degradation instead. More instances with the same check fail the same way, and a lower threshold makes it happen sooner.',
      },
      {
        id: 'hc-5',
        prompt: 'A Kubernetes liveness probe checks that Redis is reachable. Redis fails over for 15 s. What happens to the pods?',
        options: [
          'Nothing - liveness only removes a pod from Service endpoints',
          'The kubelet restarts every pod, and the outage outlasts the blip',
          'Only one pod restarts, the first to notice Redis is gone',
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
          'Remove the liveness probe and let readiness alone guard the pod',
          'Set the liveness threshold to 100, so the probe allows 1,000 s to boot',
          'Add a startup probe that holds liveness off until boot ends',
          'Increase the readiness timeout to 90 s to cover the cache loading',
        ],
        answer: 2,
        explanation:
          'A startup probe holds off the other probes until the app has booted, so the strict liveness probe can keep catching real hangs later. Removing liveness or raising its threshold to 100 would also stop the loop, but then a wedged process runs unnoticed for many minutes.',
      },
      {
        id: 'hc-7',
        prompt: 'During a deploy, each pod exits the instant it receives SIGTERM, and every deploy shows a burst of connection errors. What is the right shutdown order?',
        options: [
          'Exit immediately, but deploy at night when fewer requests are in flight',
          'Restart the load balancer after each pod so it forgets the old one',
          'Make the liveness probe fail first so the balancer notices the pod is going',
          'Fail readiness, finish in-flight requests, then exit',
        ],
        answer: 3,
        explanation:
          'The balancer only stops routing to a pod once it notices, so a pod that exits at once drops the requests it holds and those still on the way. Draining reverses the order: leave the pool, finish the work, then stop. Failing liveness would make things worse - it asks for a restart, not a quiet exit.',
      },
      {
        id: 'hc-8',
        prompt: 'The health endpoint runs a full database query. At peak it takes over 2 s, past the probe timeout, so busy instances start failing their checks and get ejected - and the rest fail next. What is happening?',
        options: [
          'A cascade: each ejection overloads the rest; make the check cheap',
          'The database is down, and the 2 s queries are its connection timeouts',
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
          'Server 2 leaves the pool after 6 s, as its connections fail',
          'The load balancer restarts Server 2 automatically',
          'Server 2 stays in and a third of requests fail; checks on eject it',
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
          'So an instance that fails on and off cannot flap in and out',
          'The first probe after boot is always ignored',
          'Two passes are needed so the cache of the server warms before real traffic',
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
          'None - the backups are safe in region B and can be restored in full',
          'About 15 hours of writes - everything since the 02:00 backup',
          'A full 24 hours - RPO always equals the backup interval',
          'Only the requests in flight at 17:00, when the region went down',
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
          'The same deleted rows - replication copied the delete',
          'A clean copy - fail over to it and nothing is lost, since it lags behind',
          'A copy one backup interval old, from the last snapshot it took',
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
          'Everything up to the last hourly backup, since backups are separate files',
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
          'A warm standby of app servers in region B - costs servers',
          'Synchronous replication - each write waits a cross-region trip',
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
          'Keep a small app fleet running in region B - costs it all the time',
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
          'At least 7 hours - the measured restore, until they make it faster',
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
          'None - the strictest setup everywhere is the safe choice, whatever it costs',
          'Hot standby cannot protect a warehouse',
          'Targets belong per system; the warehouse can use backup and restore',
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
          'Any backup - a backup is a point-in-time snapshot, so it is always clean',
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
          'Fails over and users get correct prices from region B',
          'Nothing useful - checks stay green and region B has the same prices',
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
          'Deploy tooling - CI, images and secrets - must survive the region loss',
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
          'About 1 second - the normal lag the replica runs at',
          'Nothing - async replication catches up after the failure',
          'Up to about 90 seconds of writes - the lag at the failure',
          'Everything since the last backup, since the replica is not a backup',
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
          'The loss of one availability zone with the primary in it',
          'A crashed database server that needs a full rebuild',
          'A failed disk on the primary during a busy write peak',
          'The loss of the whole region, or a DROP TABLE',
        ],
        answer: 3,
        explanation:
          'A multi-AZ standby is high availability: it handles a failed server, disk or zone. It sits in the same region, so a region loss takes both, and it replicates a DROP TABLE instantly. The tempting answers are all component failures, which is exactly what this setup is built for; disaster recovery adds copies outside the region and backups that can be restored to an earlier point.',
      },
    ],
  },
];
