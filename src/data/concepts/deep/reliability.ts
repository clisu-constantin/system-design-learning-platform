import type { DepthMap } from './types';

export const reliabilityDepth: DepthMap = {
  redundancy: {
    analogy: {
      title: 'A spare tyre you have actually tested',
      body:
        'Carrying a spare only helps if it is inflated, if you have the tools, and if you know how to change a wheel in the rain. Plenty of cars carry a spare that has never been checked. Redundancy in systems has exactly the same property: the copy is not the point, the rehearsed switch to it is.',
    },
    deepDive: [
      {
        heading: 'The arithmetic that makes redundancy worth paying for',
        paragraphs: [
          'If one component is available 99 percent of the time, two independent copies where either suffices give 1 minus 0.01 squared, which is 99.99 percent. Three give six nines. Each redundant copy squares the failure probability, which is why redundancy is the most powerful lever in reliability engineering.',
          'The word carrying all the weight is independent. Two instances in the same rack share a power supply and a top-of-rack switch. Two instances from the same deploy share the same bug. Two replicas behind the same misconfigured security group fail together. Correlated failures do not multiply, they coincide, and the calculated six nines becomes a real two.',
          'So the engineering work is spreading failure domains: different racks, different availability zones, sometimes different regions or providers. Each step costs money and latency, and each step removes a class of shared fate. Decide which classes you are buying protection against rather than adding copies for their own sake.',
        ],
        code: {
          caption: 'Independence is the entire assumption',
          body: `2 copies, truly independent, each 99%   -> 99.99%
2 copies, same rack (rack fails 0.5%)  -> ~99.5%  (rack dominates)
2 copies, same bad deploy              -> 99%     (no benefit at all)

failure domains, cheapest to most expensive:
  process -> machine -> rack -> zone -> region -> provider
you are buying protection against ONE level at a time.`,
        },
      },
      {
        heading: 'Active-active versus active-passive',
        paragraphs: [
          'Active-active runs all copies serving traffic. Capacity is used rather than idle, failover is instant because the survivors are already working, and - crucially - every copy is continuously proven to work. The cost is that all copies must handle concurrent traffic correctly, which for stateful systems means solving replication or partitioning.',
          'Active-passive keeps a standby that does no work until needed. It is much simpler for stateful systems - one writer, no conflicts - and it is what most database setups use. The costs are paying for idle capacity and, far more importantly, that the standby path is exercised only during incidents.',
          'That last point is the practical heart of the matter. An untested standby has a genuinely poor chance of working when first used: stale credentials, a hostname nobody updated, a replica too far behind, a firewall rule added since. Either exercise the failover on a schedule, or accept that your redundancy is a hypothesis.',
        ],
        bullets: [
          'Active-active: no idle cost, instant failover, continuously proven - harder for stateful systems.',
          'Active-passive: simpler and standard for databases - the untested path is the risk.',
          'N+1 means one spare beyond peak need; N+2 survives a failure during maintenance.',
          'Rehearse failover in business hours, deliberately, on a schedule.',
        ],
      },
      {
        heading: 'Redundancy is not backup, and copies are not diversity',
        paragraphs: [
          'Replication copies everything instantly, including your mistakes. A DROP TABLE, a bad migration or an application bug that corrupts rows is faithfully reproduced on every replica within milliseconds. Only a backup with a time gap - or a delayed replica - protects against that, which is why both exist and neither substitutes for the other.',
          'Similarly, identical copies share identical bugs. Running the same version of the same software on ten machines protects against hardware failure and nothing else. This is the argument for staged rollouts: deploying to one zone at a time restores a form of diversity during the risky window.',
          'The honest summary: redundancy protects against independent component failure. It does not protect against software defects, human error, configuration mistakes or correlated infrastructure failure - and those cause the majority of real outages.',
        ],
      },
    ],
    examples: [
      {
        title: 'Three availability zones, one config, one outage',
        setup:
          'A service runs 9 instances spread evenly across three availability zones, with a multi-zone load balancer and a replicated database. The team considers it highly redundant.',
        walkthrough: [
          'A config change is deployed to all 9 instances simultaneously. It contains a typo in a downstream hostname.',
          'All 9 instances fail health checks within 30 seconds. Zone redundancy is irrelevant - the failure was correlated by the deploy, not by infrastructure.',
          'Fix 1: rolling deploy, one zone at a time, with a pause and health verification between zones. The bad config would have taken out 3 instances while 6 kept serving.',
          'Fix 2: automated rollback on error rate. The bad zone is reverted before the second zone is touched.',
          'Fix 3: configuration validated at build time against a schema, so an unknown hostname fails CI rather than production.',
          'Separately, a genuine zone outage a month later removed 3 instances. The other 6 absorbed the traffic with no user impact, because the fleet was sized N+1 per zone.',
        ],
        result:
          'Redundancy worked perfectly against the failure it was designed for and not at all against the deploy. Most outages are correlated, so the deployment strategy is as much a redundancy control as the instance count.',
      },
    ],
    jargon: [
      { term: 'Failure domain', plain: 'A boundary within which one failure takes everything down: process, rack, zone, region.' },
      { term: 'Active-active / active-passive', plain: 'All copies serving, versus a standby that waits.' },
      { term: 'N+1 / N+2', plain: 'One or two spare units beyond what peak load requires.' },
      { term: 'Correlated failure', plain: 'Copies failing together because they share something. It removes the benefit entirely.' },
      { term: 'Shared fate', plain: 'The hidden dependency that makes two "independent" copies not independent.' },
      { term: 'Delayed replica', plain: 'A replica kept deliberately behind, so a destructive mistake can be caught before it applies.' },
    ],
    remember: [
      'Each independent copy squares the failure probability - independence is the whole assumption.',
      'Spread across failure domains; copies in one rack buy very little.',
      'Active-passive is simpler and its risk is that the path is never exercised.',
      'Replication copies your mistakes instantly - it is not a backup.',
      'Deploys are a correlated failure mode; roll out per zone to restore diversity.',
    ],
  },

  'fault-tolerance': {
    analogy: {
      title: 'A plane that keeps flying on one engine',
      body:
        'Engines fail. The design assumption is not that they will not, but that the aircraft continues to fly when one does - with reduced performance, an alert in the cockpit and a clear procedure. Fault tolerance is that mindset applied to software: failure is a normal input, not an exception.',
    },
    deepDive: [
      {
        heading: 'Fault, error, failure - and why the distinction is useful',
        paragraphs: [
          'A fault is a defect: a disk with a bad sector, a service that is down, a bug in a code path. An error is the incorrect state a fault produces. A failure is when that reaches the user. Fault tolerance is the work of stopping faults from becoming failures.',
          'That framing is practical because it tells you where to intervene. You cannot prevent a third-party API from being down, but you can stop that fault becoming a failure with a timeout, a cached fallback and a degraded response. The fault still occurred; the user never experienced a failure.',
          'It also reframes what "reliable" means. A reliable system is not one where nothing goes wrong - at any real scale something is always wrong - it is one where the things going wrong do not reach the people using it.',
        ],
      },
      {
        heading: 'The core techniques, and what each one is for',
        paragraphs: [
          'Timeouts are the foundation, and the most commonly missing one. An unbounded call is an unbounded outage: threads accumulate waiting on a dead dependency until the whole service is out of capacity. Every network call needs a timeout shorter than your own request budget - and there is always a default timeout somewhere that is 30 seconds or infinite.',
          'Retries handle transient faults, and must be bounded, backed off and jittered or they amplify the problem. Circuit breakers stop retrying something that is clearly down, converting a slow failure into a fast one. Bulkheads limit how much of your capacity one dependency can consume, so a slow service cannot starve everything else.',
          'Fallbacks and graceful degradation are what turn all of that into a user-visible benefit: a cached value, a default, an empty section with a note. The clearest sign of a fault-tolerant design is that you can name, for each dependency, exactly what the product does when it is unavailable.',
        ],
        code: {
          caption: 'The layers, in the order they apply',
          body: `request
  |
  timeout            bound the wait                (always)
  retry + backoff    survive transient faults      (idempotent only)
  circuit breaker    stop hammering a dead service (fast failure)
  bulkhead           cap resources per dependency  (isolation)
  fallback           cached/default/partial answer (user still served)
  |
graceful degradation: the feature is reduced, the page still works`,
        },
      },
      {
        heading: 'Fail fast, fail safe, and testing the failure paths',
        paragraphs: [
          'Slow failures are worse than fast ones. A dependency that returns an error in 5 ms lets you fall back and answer the user; the same dependency hanging for 30 seconds holds a thread, fills the queue behind it and turns one broken feature into a total outage. Most cascading failures are built from slow calls, not from errors.',
          'Then decide, per dependency, whether to fail open or closed. A recommendation service failing open (show nothing) is right. An authorisation service failing open is a security hole, so it must fail closed even though that means refusing requests. Writing that decision down per dependency is a short, high-value exercise.',
          'Finally, the failure paths must be exercised. Code that only runs during incidents is code that has never been tested, and fallbacks rot silently. Fault injection - killing instances, adding latency, returning errors from a dependency on purpose - is how you find out whether your tolerance is real, and it is far better to find out on a Tuesday afternoon.',
        ],
      },
    ],
    examples: [
      {
        title: 'A cascade caused by one missing timeout',
        setup:
          'The product page calls a reviews service. Reviews depends on a database that becomes very slow, taking 30 seconds per query instead of 10 ms. The product service has no timeout on that call.',
        walkthrough: [
          'Each product page request now occupies a worker thread for 30 seconds waiting on reviews.',
          'With 200 worker threads and 100 requests per second arriving, all threads are consumed within two seconds.',
          'The product service now fails every request, including those that do not need reviews at all. A non-critical feature has taken down the core page.',
          'Upstream, the API gateway sees product requests timing out and its own workers fill. The cascade widens.',
          'Fix 1: a 300 ms timeout on the reviews call. Worst case the page costs 300 ms extra and renders without reviews.',
          'Fix 2: a circuit breaker - after 20 consecutive failures, skip the call entirely for 30 seconds and go straight to the fallback. Latency returns to normal.',
          'Fix 3: a bulkhead - at most 20 of the 200 threads may be used for reviews, so even without the breaker, 180 threads stay available for everything else.',
          'Fix 4: fallback to the last cached reviews, so the degraded page still shows something useful.',
        ],
        result:
          'Three lines of configuration would have turned a total outage into a product page missing its reviews section. The timeout is the one that matters most - everything else builds on bounding the wait.',
      },
    ],
    jargon: [
      { term: 'Fault / error / failure', plain: 'The defect, the bad state it causes, and the user seeing it.' },
      { term: 'Graceful degradation', plain: 'Reducing functionality instead of failing entirely.' },
      { term: 'Fail open / fail closed', plain: 'Allowing or refusing when a check cannot be performed. Decide per dependency.' },
      { term: 'Bulkhead', plain: 'A resource limit per dependency so one cannot consume everything.' },
      { term: 'Cascading failure', plain: 'One slow component consuming resources upstream until everything fails.' },
      { term: 'Fault injection', plain: 'Deliberately causing failures to verify the tolerance actually works.' },
    ],
    remember: [
      'Faults are inevitable; the job is stopping them from becoming user-visible failures.',
      'Every network call needs a timeout - unbounded waits cause cascades.',
      'Slow failures are more dangerous than fast ones.',
      'Decide fail-open or fail-closed per dependency, and write it down.',
      'Untested failure paths do not work; inject faults deliberately.',
    ],
  },

  'high-availability': {
    analogy: {
      title: 'A hospital that never closes',
      body:
        'Staff shifts overlap so there is never a gap, equipment has backups, and there is a written procedure for a power cut that people have practised. None of it depends on any individual being present. Availability is not heroism - it is the removal of every single point that a heroic response would be needed for.',
    },
    deepDive: [
      {
        heading: 'Availability is dominated by how fast you recover',
        paragraphs: [
          'Availability is often expressed as MTBF divided by MTBF plus MTTR - time between failures over that plus time to recover. In practice you have far more control over the second term. Making failures rarer is slow, expensive work; making recovery faster is usually a matter of automation and preparation.',
          'A system that fails once a month but recovers in 30 seconds is at about 99.999 percent. A system that fails once a year but takes eight hours to recover is at about 99.9 percent. The second sounds more reliable and is two orders of magnitude worse.',
          'So the highest-leverage availability work is nearly always: detect faster, fail over automatically, and make rollback trivial. Those three reduce MTTR directly, and none of them require the underlying components to become more reliable.',
        ],
        code: {
          caption: 'Where a 20-minute outage actually goes',
          body: `detect        8 min   (alert fired on symptom, not cause)
diagnose      7 min   (which of 12 services? no trace)
decide        2 min   (who is allowed to roll back?)
act           3 min   (manual steps from a wiki page)
              ------
              20 min

improvements that pay
  alert on user-facing symptom        -> detect in 1 min
  distributed tracing                 -> diagnose in 2 min
  pre-authorised rollback runbook     -> decide in 0 min
  one-command rollback / auto-failover-> act in 1 min
  = 4 minutes, from the same failure`,
        },
      },
      {
        heading: 'Removing single points of failure, layer by layer',
        paragraphs: [
          'The exercise is mechanical and worth doing on paper: draw every component, and for each one ask what happens when it disappears. The load balancer, the database primary, the cache, the DNS provider, the CI system that is the only way to deploy, the one engineer who knows the failover procedure - all of them count.',
          'Then handle each in order of impact. App servers behind a balancer with health checks. Database with a replica and automated promotion. Cache with a fallback to the source of truth. Load balancer with a redundant pair or a managed multi-zone service. Region failure with either a warm standby or an accepted, documented recovery time.',
          'Stop at the point where the remaining risk costs less than the next mitigation. Multi-region active-active roughly doubles cost and substantially increases complexity; for many businesses a documented four-hour recovery in a second region is the correct, cheaper answer. The goal is a deliberate decision, not maximum redundancy.',
        ],
        bullets: [
          'Two of everything on the request path, across zones.',
          'Automated failover with health checks - manual failover is measured in tens of minutes.',
          'Every dependency classified as hard or soft, with a defined degraded behaviour.',
          'Deploys must be reversible in one step, because deploys cause most incidents.',
        ],
      },
      {
        heading: 'The human half: on-call, runbooks and practice',
        paragraphs: [
          'Most of the delay in a real incident is not technical. It is finding out something is wrong, working out which component, and knowing who may authorise a fix. Alerting on user-facing symptoms rather than on internal causes is the single most effective change most teams can make - one alert that says "checkout error rate above 2 percent" beats forty alerts about CPU.',
          'Runbooks matter for the same reason. A written procedure with the exact commands turns a 3am judgement call into a repeatable action, and it is the difference between an on-call engineer who was not there when the system was designed succeeding or escalating.',
          'And practise. Game days, deliberate failovers and chaos experiments in business hours are how you discover that the runbook references a deleted script, or that the standby database lacks a permission. Availability targets that have never been tested are aspirations.',
        ],
      },
    ],
    examples: [
      {
        title: 'Reaching 99.95 percent by fixing recovery, not components',
        setup:
          'A service at 99.5 percent (about 44 hours of downtime a year) wants 99.95 percent (about 4.4 hours). The team assumes it needs more reliable infrastructure.',
        walkthrough: [
          'Incident review of the last year: 26 incidents, average 100 minutes. Only 4 were hardware or provider issues; 18 were bad deploys and 4 were dependency failures.',
          'Deploy-related work first: automated canary with error-rate rollback. Bad deploys now self-revert in about 3 minutes instead of being noticed and fixed in 90.',
          'Dependency failures: timeouts and circuit breakers added, so a failing dependency degrades one feature instead of the service.',
          'Detection: alerting moved from CPU and memory to user-facing error rate and latency. Mean detection time fell from 12 minutes to 90 seconds.',
          'Database failover was manual and took 25 minutes. Automated promotion brought it to under a minute.',
          'New total: 24 incidents with an average of 6 minutes, roughly 2.4 hours per year - comfortably inside the target, with no change in the failure rate.',
        ],
        result:
          'The number of failures barely moved; the time each one lasted fell by a factor of sixteen. When an availability target is missed, look at MTTR first - it is almost always the cheaper term to improve.',
      },
    ],
    jargon: [
      { term: 'MTBF / MTTR', plain: 'Mean time between failures, and mean time to recover. You control the second more easily.' },
      { term: 'SPOF', plain: 'Single point of failure: a component whose loss takes the service down.' },
      { term: 'Failover', plain: 'Switching to a standby automatically when the primary fails.' },
      { term: 'Runbook', plain: 'A written procedure with exact commands for a known failure.' },
      { term: 'Game day', plain: 'A rehearsed failure exercise run deliberately, in working hours.' },
      { term: 'Blast radius', plain: 'How much of the system one failure or one change can affect.' },
    ],
    remember: [
      'Recovering faster usually beats failing less often, and is far cheaper.',
      'Draw the diagram and ask of every box: what happens when this disappears?',
      'Alert on user-facing symptoms, not on internal causes.',
      'Most incidents come from deploys - make rollback a single, automatic step.',
      'An untested failover is a guess; rehearse it on a schedule.',
    ],
  },

  'single-point-of-failure': {
    analogy: {
      title: 'The one key to the building',
      body:
        'Everything else can be duplicated, but if there is exactly one key and it is lost, nobody gets in. Single points of failure are rarely dramatic - they are usually the boring thing nobody listed: one key, one certificate, one person who knows the password, one DNS provider.',
    },
    deepDive: [
      {
        heading: 'Finding them: the questions that surface the hidden ones',
        paragraphs: [
          'The obvious single points are on the architecture diagram: one load balancer, one database primary, one cache. The dangerous ones are not on any diagram. The CI system that is the only way to deploy. The TLS certificate with one renewal process. The DNS registrar account tied to one person email. The shared secret nobody can rotate without downtime.',
          'The productive exercise is to walk the request path and the operational path separately. For the request path: what does a user request touch, and what happens if each piece disappears? For the operational path: what do we need in order to fix things - deploy pipeline, monitoring, access to the console, the runbook, the people?',
          'Then check for hidden coupling. Three app instances that all read configuration from one service, all authenticate against one identity provider, all resolve names through one DNS zone. Redundancy at one layer with a single point underneath it gives you the availability of the single point.',
        ],
        code: {
          caption: 'A checklist that finds the unlisted ones',
          body: `REQUEST PATH        DNS -> LB -> app -> cache -> DB -> third party
  each box: 2+ instances? across zones? automatic failover?

CONTROL PLANE       can we deploy, roll back and observe during an outage?
  CI, registry, config service, secrets store, monitoring, paging

DATA                is there exactly one copy of anything?
  one primary with async replicas, one backup location, one region

HUMAN               one person with the knowledge, the access, the account
  bus factor of 1 is a SPOF with a pulse`,
        },
      },
      {
        heading: 'Not every single point must be removed',
        paragraphs: [
          'Eliminating a single point costs money and complexity, so the decision should be economic. Compare the cost of the mitigation against the probability of failure multiplied by the cost of the outage. A second DNS provider is cheap and worth it; a second cloud provider is enormously expensive and rarely justified.',
          'Some single points are also acceptable because recovery is fast. A single cache node that can be replaced in two minutes, with the application degrading to database reads in the meantime, may be a perfectly reasonable risk. A single database primary with automated failover in 30 seconds is the standard design for most companies.',
          'What is not acceptable is an unexamined single point. The failure mode to avoid is discovering during an incident that something you assumed was redundant never was - which is why the inventory exercise matters more than the mitigations.',
        ],
        bullets: [
          'Cheap to remove, high impact: do it (second DNS provider, second AZ, backup admin account).',
          'Expensive, low probability: document the risk and the recovery plan instead.',
          'Fast to recover: often fine, if the degraded mode is defined and tested.',
          'Unknown: the only genuinely unacceptable category.',
        ],
      },
      {
        heading: 'The ones teams find the hard way',
        paragraphs: [
          'TLS certificates expire, and a manual renewal process is a scheduled outage waiting for someone to be on holiday. Automate renewal and alert 30 days ahead, not on the day. The same applies to domain registrations, API credentials and signing keys.',
          'Shared infrastructure creates surprising coupling: a single NAT gateway all outbound traffic flows through, one Redis instance holding both sessions and rate limits, one Kafka cluster for every team. Each is fine until it is not, and its blast radius is everything that depends on it.',
          'And the human single point is real. If one person is the only one who can perform a failover, has the production credentials, or understands the deployment, the system inherits the availability of that person. Documentation, shared access and rotating the on-call role are availability controls as much as any replica is.',
        ],
      },
    ],
    examples: [
      {
        title: 'The redundant system with one hidden dependency',
        setup:
          'A team runs 3 app instances across 3 zones, a database with automatic failover, and a multi-zone load balancer. An outage takes everything down for 22 minutes.',
        walkthrough: [
          'Root cause: a configuration service returning 500s. All three app instances fetch feature flags and pricing rules from it at startup and every 30 seconds.',
          'When it failed, instances could not refresh config and, by design, refused to serve rather than use stale values - so all three failed identically.',
          'Redundancy at the app layer was irrelevant: every replica depended on one unreplicated service, and the failure was correlated by that dependency.',
          'Fix 1: keep the last known good configuration in memory and on local disk, and serve with it when the config service is unreachable. Stale config beats no service.',
          'Fix 2: run the config service with three replicas behind a balancer, since it is now understood to be on the critical path.',
          'Fix 3: bake a default configuration into the deployment artefact, so an instance can start even with the config service completely down.',
          'Fix 4: add it to the architecture diagram, where it had never appeared because "it is just configuration".',
        ],
        result:
          'Three zones of redundancy were undone by one unlisted dependency. The most valuable outcome was the inventory habit: every shared service on the request path now gets the same "what if this disappears" treatment.',
      },
    ],
    jargon: [
      { term: 'SPOF', plain: 'Any component whose failure alone takes down the service.' },
      { term: 'Blast radius', plain: 'What else fails when this one thing fails.' },
      { term: 'Control plane', plain: 'The systems you need in order to operate: deploy, observe, page, access.' },
      { term: 'Bus factor', plain: 'How many people must be unavailable before the team cannot operate the system.' },
      { term: 'Hidden coupling', plain: 'Redundant components that all depend on the same underlying thing.' },
      { term: 'Degraded mode', plain: 'A defined reduced behaviour when a dependency is missing. The alternative to failing.' },
    ],
    remember: [
      'The dangerous single points are the ones not on the diagram.',
      'Check the control plane too - deploys, monitoring and access must survive the outage.',
      'Redundancy above a single point inherits the availability of that point.',
      'Not every single point must be removed; every one must be known and decided.',
      'Certificates, DNS accounts and one knowledgeable person are the classics.',
    ],
  },

  failover: {
    analogy: {
      title: 'The co-pilot taking the controls',
      body:
        'The handover works because three things were arranged in advance: the co-pilot has been following the whole flight, there is an unambiguous signal for who is flying, and both have practised the transfer. Remove any one and you get either a delay or two people pulling in different directions.',
    },
    deepDive: [
      {
        heading: 'Detect, decide, promote, redirect',
        paragraphs: [
          'Every failover is these four steps, and the total downtime is their sum. Detection: health checks notice the primary is not responding, which takes a few seconds of consecutive failures. Decision: something must conclude that the primary really is dead, ideally by quorum rather than by one observer.',
          'Promotion: a replica becomes the new primary, which requires it to be sufficiently caught up. Redirection: clients must start talking to the new primary, via DNS, a virtual IP, a proxy or a service discovery update - and this step is often the slowest, because of cached DNS answers and pooled connections that clients hold open.',
          'Tuning each step trades speed against false positives. Aggressive detection means faster recovery and occasional unnecessary failovers, which are themselves small outages. The usual balance is a detection window comfortably longer than your worst garbage collection pause and network blip, with fast promotion and redirection once the decision is made.',
        ],
        code: {
          caption: 'Where the seconds go, and what to tune',
          body: `detect      3 x 2 s failed health checks        6 s
decide      quorum agreement                    1 s
promote     replica catch-up + role change      5-30 s
redirect    DNS TTL / proxy update / pool reset  5-300 s   <- usually the worst
                                                 -----
                                                 17 s to 5 min

fastest redirect: a proxy or virtual IP clients already point at
slowest: DNS with a long TTL plus client libraries caching resolution`,
        },
      },
      {
        heading: 'The failure modes: split brain and lost writes',
        paragraphs: [
          'Split brain is two nodes both believing they are primary, which happens when the old primary is unreachable rather than dead. Both accept writes, the data diverges, and reconciliation afterwards is manual and lossy. The defences are quorum (only a majority may promote), fencing tokens (the storage rejects the old primary writes), and STONITH (forcibly power off the old node before promoting).',
          'Lost writes come from asynchronous replication. Whatever the primary had acknowledged but not yet shipped is gone when a replica is promoted. The size of that window is your replication lag at the moment of failure - which, unhelpfully, is usually larger than normal during the overload that caused the failure.',
          'You choose between those risks explicitly. Requiring the most up-to-date replica and refusing to promote a lagging one protects data at the cost of availability. Promoting whatever is available protects availability at the cost of data. Semi-synchronous replication to a local replica removes most of the dilemma for the common single-machine failure.',
        ],
        bullets: [
          'Quorum for the promotion decision - never let one observer promote.',
          'Fencing so the old primary cannot write after being replaced.',
          'Set a maximum acceptable lag for promotion, and alert when a replica exceeds it.',
          'Clients must reconnect and re-resolve; pooled connections to a dead primary are a common hang.',
        ],
      },
      {
        heading: 'Failback, and the part everyone forgets',
        paragraphs: [
          'After the original node recovers, it must not simply resume as primary - it is now behind and may hold writes the new primary never saw. The safe procedure is to rebuild it as a replica of the current primary, verify it is caught up, and only then consider switching back during a planned window.',
          'Automatic failback is generally a bad idea. A flapping node would then flip the primary role repeatedly, and each flip is an outage plus a data risk. Make failover automatic and failback deliberate.',
          'And test the whole thing. A failover procedure that has never been executed contains, on average, at least one broken assumption: an expired credential, a hostname in a config file, a permission the replica lacks, a client library that caches the primary address forever. Scheduled failover drills in business hours are the only way to find these cheaply.',
        ],
      },
    ],
    examples: [
      {
        title: 'The failover that worked and the clients that did not notice',
        setup:
          'A managed database fails over in 25 seconds. The application stays broken for 9 minutes afterwards.',
        walkthrough: [
          'The database promoted a replica and updated the DNS name to point at it - the database side worked exactly as designed.',
          'Application instances held open connection pools to the old primary IP. Those connections were not closed, just dead, so requests hung until the socket timeout of 300 seconds.',
          'The JVM-based service had also cached the DNS resolution indefinitely, so even new connections went to the old address.',
          'Fix 1: set the DNS cache TTL in the runtime to 30 seconds instead of forever.',
          'Fix 2: enable connection validation on borrow, so a dead pooled connection is detected and discarded immediately rather than used.',
          'Fix 3: set a socket timeout of 5 seconds and a shorter connection max lifetime, so stale connections recycle quickly.',
          'Fix 4: added a failover drill to the quarterly schedule, and measured client recovery time as the actual metric rather than database promotion time.',
        ],
        result:
          'The database recovered in 25 seconds; the system recovered in 9 minutes. Failover time is measured at the client, and connection pools plus DNS caching are where the remaining minutes hide.',
      },
    ],
    jargon: [
      { term: 'Promotion', plain: 'Making a replica the new primary.' },
      { term: 'Split brain', plain: 'Two nodes both acting as primary, diverging data.' },
      { term: 'Fencing', plain: 'Ensuring the deposed primary can no longer write.' },
      { term: 'Failback', plain: 'Returning to the original node. Should be deliberate, never automatic.' },
      { term: 'Virtual IP / proxy', plain: 'A stable address clients use, redirected during failover - faster than DNS.' },
      { term: 'Lag threshold', plain: 'The maximum staleness you will accept in a replica before promoting it.' },
    ],
    remember: [
      'Failover time is detect + decide + promote + redirect, and redirect is usually the worst.',
      'Quorum and fencing are what prevent split brain.',
      'Async replication means promotion can lose the most recent writes.',
      'Measure recovery at the client - pools and DNS caches hide minutes.',
      'Automate failover, keep failback manual, and rehearse both.',
    ],
  },

  'circuit-breaker': {
    analogy: {
      title: 'The trip switch in a fuse box',
      body:
        'When a circuit is faulty, the breaker trips and stays open. It does not keep reconnecting into a short - that would burn the house down. After a while somebody flips it back to test: if the fault is gone, power returns; if not, it trips again immediately. Three states, and the middle one is the clever part. And the same standard switch protects the kitchen, the workshop and the garage - you fit the part and set its rating per room.',
    },
    deepDive: [
      {
        heading: 'Three states, and why the half-open one matters',
        paragraphs: [
          'Closed is normal: calls pass through and failures are counted over a rolling window of recent calls. When the failure rate crosses a threshold within that window, the breaker opens. Open means calls fail immediately without being attempted - no waiting, no threads consumed, an instant fallback for the caller.',
          'After a cooldown the breaker moves to half-open and allows a small number of trial calls. If they succeed, it closes and normal service resumes. If any fails, it opens again for another cooldown - that is the classic rule, and the one the Lab uses; Resilience4j instead compares the failure rate of the trial calls with the threshold. Without that middle state you either hammer a recovering service the moment the timer expires, or you need a human to reset it.',
          'The key insight is what the breaker converts: a slow failure into a fast one. A dependency that times out after 10 seconds consumes a thread for 10 seconds on every request; an open breaker consumes nothing and answers in a millisecond or two. That difference is what stops a cascade.',
          'Stripped of context, this is a reusable structure: a wrapper, a window, a threshold, a cooldown and a probe. So you do not write it into each client - you wrap every dependency in the same machine and give each one its own policy. The numbers become configuration, visible in one place and comparable across the system.',
        ],
        code: {
          caption: 'One state machine, one policy per dependency',
          body: `CLOSED    --failure rate > 50% over 20 calls-->  OPEN
OPEN      --after 30 s cooldown--------------->  HALF-OPEN
HALF-OPEN --3 trial calls succeed------------->  CLOSED
HALF-OPEN --any trial call fails-------------->  OPEN (cooldown again)

                  min calls  trip at  cooldown  trials  fallback
payments                 50      60%      60 s       5  reject
recommendations          20      40%      15 s       3  empty list
search                   30      50%      30 s       3  cached results

count timeouts as failures - they are the expensive case`,
        },
      },
      {
        heading: 'What to wrap, and what to trip on',
        paragraphs: [
          'Nothing about the pattern is specific to HTTP. A database that refuses connections during a failover eats pool slots and threads for nothing; an open breaker fails those requests at once so the application can serve from cache. A queue publish to an unreachable broker blocks; a breaker turns the hang into a decision - buffer, drop or reject. And a third-party SDK often hides its own retry loops and generous timeouts, so wrapping it is frequently the only way to bound a vendor outage.',
          'Count timeouts, connection errors and 5xx responses as failures. Do not count 4xx: a 404 or a 400 means your request was wrong, not that the service is unhealthy, and tripping the breaker on client errors takes down a perfectly working dependency for everybody.',
          'Scope the breaker per dependency, and often per endpoint. One breaker for an entire service means a slow reporting endpoint trips the breaker for the fast lookup endpoint that was fine. And put it on the client side, in the caller: the point is to protect the caller resources, and a breaker inside the failing service cannot help a caller whose threads are already blocked waiting on it.',
        ],
        bullets: [
          'Wrap HTTP calls, database and cache clients, queue publishes and third-party SDKs.',
          'Trip on timeouts, connection failures and 5xx. Never on 4xx.',
          'One breaker per dependency per operation, on the caller side.',
          'Require a minimum call count, so a quiet minute cannot trip it on noise.',
        ],
      },
      {
        heading: 'Composing it, and making the open state useful',
        paragraphs: [
          'The full protective stack around one dependency is: a timeout bounding each attempt, a bounded retry with backoff for transient failures, the circuit breaker to stop calling something that is clearly down, a bulkhead limiting how much capacity this dependency may occupy, and a fallback. Order matters. The retry goes around the breaker, so every attempt passes through it and counts toward tripping - the default order in Resilience4j, and the one the Azure guidance describes. The retry must then treat "circuit open" as final: retrying it only waits out backoff delays against a circuit that fails instantly.',
          'An open breaker that returns an error answers in a millisecond or two instead of hanging for 30 seconds, but an error is still what the user sees. The value comes from what you do instead: serve a cached value, return a sensible default, omit the section, or queue the work for later. Critical dependencies such as payments usually fail closed with a clear error; optional ones such as recommendations fail open with an empty or cached result.',
          'Breaker state changes should be logged and emitted as metrics, because an open breaker is a precise statement that a specific dependency is unhealthy - often a better alert than the monitoring of that dependency. And watch the distributed effect: fifty instances each sending three trial calls per cooldown may be enough to keep a fragile service down, so cap the probes with a low concurrency limit or a shared rate limit.',
        ],
      },
    ],
    examples: [
      {
        title: 'Tuning a breaker that was too eager and then too slow',
        setup:
          'A checkout service calls a tax service. A breaker is added with: trip after 3 failures, cooldown 60 seconds, no minimum call count.',
        walkthrough: [
          'Problem 1: during a quiet period, 3 of the only 5 calls in a minute time out due to an unrelated network blip. The breaker opens and checkout loses tax calculation for 60 seconds despite the service being healthy.',
          'Fix: require a minimum of 20 calls in the window before evaluating, and trip on a 50 percent failure rate rather than an absolute count.',
          'Problem 2: during a real outage the 60-second cooldown means users see degraded behaviour for a full minute after the service recovers.',
          'Fix: cooldown to 20 seconds with 3 half-open trial calls, so recovery is detected quickly without flooding.',
          'Problem 3: 40 instances each send 3 trial calls, so the recovering service gets 120 requests in one burst and falls over again.',
          'Fix: a concurrency limit of 5 on the half-open probes across the fleet, implemented with a shared token in Redis.',
          'Final behaviour: a real outage is detected in seconds, checkout falls back to a cached tax table, and recovery is verified gently.',
        ],
        result:
          'Both failure modes were configuration, not concept. A breaker with no minimum call count trips on noise; one with a long cooldown and fleet-wide probes turns recovery into a second outage.',
      },
      {
        title: 'One policy definition, twelve dependencies',
        setup:
          'A service calls 12 downstream systems. Each client has its own hand-written error handling, accumulated over three years. Behaviour during outages is inconsistent and unpredictable.',
        walkthrough: [
          'Audit: 4 clients retry infinitely, 3 have no timeout at all, 2 have a breaker with different thresholds, and 3 have no protection.',
          'Introduce 1 resilience library and 1 configuration file with 12 named policies, one per dependency.',
          'Classify each dependency: 2 critical (payments, inventory) versus 10 optional (recommendations, reviews, analytics and the rest).',
          'Critical policies: 60-second cooldown, 60 percent threshold, fail closed with a clear user-facing error.',
          'Optional policies: trip at 40 percent, 15-second cooldown, fail open with an empty or cached result.',
          'The library emits the same 3 metrics for all 12: state changes, trip counts and fallback usage - a dashboard that did not previously exist.',
          'During the next vendor outage the breaker opened in 8 seconds, the fallback served cached data, and the metric named the dependency at once instead of requiring an investigation.',
        ],
        result:
          'Twelve bespoke implementations became one policy file. Treating resilience as a configured pattern rather than per-client code is what makes behaviour predictable during an incident.',
      },
    ],
    jargon: [
      { term: 'Closed / open / half-open', plain: 'Calls pass, calls fail instantly, and a few trial calls test recovery.' },
      { term: 'Trip', plain: 'The transition to open when the failure threshold is crossed.' },
      { term: 'Rolling window', plain: 'Counting outcomes over recent calls or seconds, not since the process started.' },
      { term: 'Cooldown', plain: 'How long the breaker stays open before testing again.' },
      { term: 'Fallback', plain: 'What you return while the breaker is open. Without one, the breaker only fails faster.' },
      { term: 'Fail open / fail closed', plain: 'Serving a degraded result, versus refusing, when the breaker is open.' },
    ],
    remember: [
      'A breaker converts a slow failure into a fast one - that is what stops cascades.',
      'Half-open is what lets recovery be automatic and gentle.',
      'Trip on timeouts and 5xx over a rolling window with a minimum call count, never on 4xx.',
      'Wrap any fallible call with one policy per dependency, and stop retrying when the breaker says the circuit is open.',
      'Pair it with a timeout and a real fallback - critical calls fail closed, optional ones fail open.',
    ],
  },

  retry: {
    analogy: {
      title: 'Knocking again when nobody answers',
      body:
        'If nobody comes to the door, knocking once more is sensible - they may have been in the other room. Knocking forty times in ten seconds is not, and if everyone in the street does it simultaneously the door will never be answered. And if the house is empty, knocking will never work no matter how often you try.',
    },
    deepDive: [
      {
        heading: 'Retry only what can succeed on a second attempt',
        paragraphs: [
          'Transient failures are worth retrying: connection resets, timeouts, 503s, a rate limit, a leader election in progress. Permanent failures are not: a validation error, a 404, a 401, a malformed request. Retrying a permanent failure wastes capacity, delays the real error, and at scale generates significant load for zero possibility of success.',
          'The harder question is the ambiguous one: a timeout. You do not know whether the server completed the work. Retrying may duplicate the operation, which is why retries and idempotency are inseparable - a retry policy on a non-idempotent operation is a bug generator.',
          'So the rule is: retry idempotent operations freely, and retry non-idempotent ones only with an idempotency key that lets the server recognise the repeat. GET, PUT and DELETE are naturally safe; POST needs the key.',
        ],
        code: {
          caption: 'A retry policy worth copying',
          body: `retry on     timeout, connection error, 502/503/504, 429 (honour Retry-After)
never on     400, 401, 403, 404, 422 - these will fail identically
ambiguous    timeout on a POST -> retry ONLY with an idempotency key

attempts     3 in total (1 original + 2 retries), not 10
delay        base 100 ms, exponential, full jitter
budget       total time across attempts < the caller deadline
per-call     each attempt still gets its own timeout`,
        },
      },
      {
        heading: 'Retry amplification: how retries cause the outage',
        paragraphs: [
          'Retries multiply load exactly when a system is least able to take it. If a service is struggling and every client retries three times, it receives four times the traffic - and each retry occupies a connection and a thread on the recovering service. Many outages are extended, not caused, by retry storms.',
          'It gets worse in layered architectures. If the gateway makes 3 attempts, the service it calls makes 3, and its database client makes 3, one user request can become 3 x 3 x 3 = 27 database calls. With 3 retries (4 attempts) at each of the three layers it is 4 x 4 x 4 = 64 - the example in the Google SRE book. Each layer looks reasonable in isolation; the product is catastrophic.',
          'The fix is to retry at one layer - normally the outermost one that can make a meaningful decision - and to use a retry budget: allow retries only while they are a small percentage of total requests (say 10 percent). When the failure rate is high, the budget is exhausted and retries stop automatically, which is exactly the behaviour you want during an outage.',
        ],
        bullets: [
          'Retry at one layer only; disable retries in inner clients if the outer one retries.',
          'Use a retry budget - stop retrying when failures are widespread.',
          'Combine with a circuit breaker so a dead dependency is skipped, not retried.',
          'Cap total time, not just attempt count - three retries with backoff can exceed the patience of a user.',
        ],
      },
      {
        heading: 'Getting the timing right',
        paragraphs: [
          'Immediate retry is occasionally right for a single fast attempt - a connection reset on a pooled connection often succeeds instantly with a new one. Beyond that, exponential backoff is required so that each subsequent attempt gives the dependency more room to recover.',
          'Jitter is not optional. Without it, all clients that failed at the same moment retry at the same moment, producing synchronised waves that keep the service down. Full jitter - a random delay between zero and the computed backoff - spreads them out and is the version recommended by most cloud providers.',
          'Honour the signals the server gives you. A 429 or 503 with a Retry-After header is the dependency telling you exactly when to come back; ignoring it and using your own backoff is both ruder and less effective. Respecting it is usually one line of code.',
        ],
      },
    ],
    examples: [
      {
        title: 'One user request, twenty-seven database calls',
        setup:
          'A database has a brief 10-second hiccup. The dashboard, normally at 500 requests per second, generates enough load that the database stays down for 6 minutes.',
        walkthrough: [
          'Layer 1: the mobile client makes up to 3 attempts per request, 1 second apart.',
          'Layer 2: the API gateway makes up to 3 attempts on a 5xx from the service.',
          'Layer 3: the database client of the service makes up to 3 attempts on a connection failure.',
          'Multiplication: one user tap becomes 3 x 3 x 3 = 27 database attempts, all within a few seconds.',
          'Effective load during the incident: 500 requests per second becomes roughly 13,500 attempts per second at the database, which cannot recover under that pressure.',
          'Fix 1: retries only at the gateway. The database client and the mobile client stop retrying entirely.',
          'Fix 2: exponential backoff with full jitter, so the retry load spreads over tens of seconds rather than arriving at once.',
          'Fix 3: a retry budget of 10 percent - once more than a tenth of requests are failing, retries are suppressed entirely.',
          'Fix 4: a circuit breaker so that once the database is clearly down, requests fail fast and no retries are attempted at all.',
        ],
        result:
          'The next comparable hiccup lasted 10 seconds and the service recovered with it. Retries at multiple layers multiply, and the multiplication arrives precisely when the system has the least capacity to absorb it.',
      },
    ],
    jargon: [
      { term: 'Transient failure', plain: 'One that may succeed on a later attempt. The only kind worth retrying.' },
      { term: 'Retry storm / amplification', plain: 'Retries multiplying load on an already failing system.' },
      { term: 'Retry budget', plain: 'A cap on retries as a share of traffic, so they stop during widespread failure.' },
      { term: 'Full jitter', plain: 'A random delay between 0 and the backoff value. Spreads retries apart.' },
      { term: 'Retry-After', plain: 'A header telling you exactly when to try again. Honour it.' },
      { term: 'Idempotency key', plain: 'What makes retrying a write safe.' },
    ],
    remember: [
      'Retry transient failures only; permanent ones fail identically forever.',
      'A retry on a non-idempotent write needs an idempotency key.',
      'Retry at one layer - nested retries multiply.',
      'Exponential backoff with jitter, plus a retry budget that stops during outages.',
      'Honour Retry-After when the server sends it.',
    ],
  },

  'exponential-backoff': {
    analogy: {
      title: 'Backing off when the line is busy',
      body:
        'Redialling instantly every second when a line is engaged just keeps the line engaged. Waiting one second, then two, then four, then eight gives the other side room to free up - and if everyone waits a randomly different amount, the calls spread out instead of arriving together. Both halves are required: the growth and the randomness.',
    },
    deepDive: [
      {
        heading: 'Why the delay must grow',
        paragraphs: [
          'A fixed retry delay produces constant pressure on a failing dependency: a hundred clients retrying every second is a hundred requests per second, indefinitely, regardless of whether the service is recovering. Exponential growth means the pressure decays automatically, so the longer a service is down the less load it receives.',
          'The standard form is delay = base x 2^attempt, capped at a maximum. With base 100 ms: 100, 200, 400, 800, 1600 ms. The cap matters because unbounded growth eventually produces absurd delays - a cap of 30 or 60 seconds is typical.',
          'The decay is exactly what a recovering service needs. Restarting under sustained full load usually fails: caches are cold, connection pools are empty, JIT compilation has not warmed. Backoff gives it a window of reduced traffic in which to become healthy, which is often the difference between recovering and flapping.',
        ],
        code: {
          caption: 'Four strategies, and the one to use',
          body: `attempt      1     2     3     4     5
fixed       1.0s  1.0s  1.0s  1.0s  1.0s   constant pressure
linear      1.0s  2.0s  3.0s  4.0s  5.0s   decays too slowly
exponential 0.1s  0.2s  0.4s  0.8s  1.6s   good decay, SYNCHRONISED
full jitter rand(0,0.1) rand(0,0.2) ...    good decay, spread out

full jitter:  sleep = random_between(0, min(cap, base * 2**attempt))
This is the AWS-recommended default. Use it unless you have a reason not to.`,
        },
      },
      {
        heading: 'Jitter is the half people leave out',
        paragraphs: [
          'Pure exponential backoff still synchronises. All clients that failed at the same instant compute the same delays and retry at the same instants, producing waves at 100 ms, 200 ms, 400 ms. The waves are smaller each time but they are still spikes, and a fragile service is knocked down by each one.',
          'Full jitter - sleeping a random duration between zero and the computed backoff - spreads clients into a smooth distribution. Simulations and production experience both show it converges faster than no jitter and faster than partial variants, because it eliminates the waves entirely rather than blurring them.',
          'The same principle applies far beyond retries. Cache TTLs, polling intervals, cron schedules, health check timings and reconnection delays all benefit from jitter for the same reason: any time many clients share a clock, deliberately desynchronise them.',
        ],
        bullets: [
          'Cap the maximum delay, or later attempts become absurd.',
          'Cap the total elapsed time as well - the caller has a deadline.',
          'Use full jitter unless you have measured a reason for something else.',
          'Apply jitter to TTLs, polls and cron jobs too, not just retries.',
        ],
      },
      {
        heading: 'Where backoff appears besides retries',
        paragraphs: [
          'TCP uses exponential backoff at the transport layer: each time a retransmission times out, the sender doubles its retransmission timeout (RFC 6298). Classic Ethernet used randomised binary exponential backoff for collision recovery decades ago - backoff and jitter in one rule. The pattern is old because the problem is fundamental: contention for a shared resource is best resolved by backing off with randomness.',
          'In application code you will meet it in reconnection loops for WebSockets and message brokers, in poller intervals that slow down when nothing changes, in rate limiter clients honouring 429s, and in job queue retry policies. It is the same formula each time.',
          'One caveat worth stating: backoff is for the client. It does not protect the server from clients that ignore it, which is why servers still need rate limiting and load shedding. Backoff is cooperative; rate limiting is enforcement, and a production system needs both.',
        ],
      },
    ],
    examples: [
      {
        title: 'Ten thousand clients reconnecting at once',
        setup:
          'A WebSocket server restarts, dropping 10,000 connections. The client reconnects after a fixed 1-second delay.',
        walkthrough: [
          'One second after the drop, all 10,000 clients attempt to reconnect simultaneously. The server, still warming up, cannot accept them and rejects most.',
          'Those clients retry one second later - together again. The synchronised wave repeats indefinitely and the server never gets a quiet moment to become healthy.',
          'Fix 1: exponential backoff with base 1 second and cap 30 seconds. The waves spread out over time - but they are still waves, because every client computes the same schedule.',
          'Fix 2: full jitter. Each client sleeps a random duration between 0 and its computed backoff, so the first wave spreads across a second, the next across two, and so on.',
          'Effect: instead of 10,000 attempts in the same instant, the 10,000 first retries spread evenly over the first second - about 1,000 per 100 ms - and the ones that fail spread over the next 2 seconds, then 4. The server accepts connections steadily and is fully recovered in about 20 seconds.',
          'Fix 3: the server also sends a Retry-After hint during shutdown, so clients know to wait rather than guess.',
        ],
        result:
          'The same 10,000 clients recovered in 20 seconds instead of never. Exponential growth reduced the total pressure and jitter removed the spikes - and only both together produced a smooth recovery.',
      },
    ],
    jargon: [
      { term: 'Base delay', plain: 'The starting wait, typically 50-200 ms.' },
      { term: 'Cap / ceiling', plain: 'The maximum delay, so exponential growth does not run away.' },
      { term: 'Full jitter', plain: 'Sleeping a random time between 0 and the computed backoff.' },
      { term: 'Decorrelated jitter', plain: 'A variant that bases each delay on the previous random one. Also fine.' },
      { term: 'Retry budget', plain: 'A limit on retries as a fraction of traffic, complementing backoff.' },
      { term: 'Thundering herd', plain: 'The synchronised wave that jitter exists to prevent.' },
    ],
    remember: [
      'Growth reduces pressure on a recovering service; jitter removes the waves.',
      'Full jitter: random between 0 and base x 2^attempt, capped.',
      'Cap both the individual delay and the total elapsed time.',
      'Jitter belongs on TTLs, polls and cron jobs too.',
      'Backoff is cooperative - servers still need rate limiting for clients that ignore it.',
    ],
  },

  'health-checks': {
    analogy: {
      title: 'Asking "are you fit for duty?" not "are you breathing?"',
      body:
        'A guard who is technically conscious but cannot see the door is not fit for duty. A useful check asks whether the person can actually do the job right now. Ask too little and you route work to someone who cannot do it; ask too much and you send everyone home the moment the coffee machine breaks.',
    },
    deepDive: [
      {
        heading: 'Liveness and readiness are different questions',
        paragraphs: [
          'Liveness asks: is this process broken beyond recovery and in need of a restart? It should be cheap and almost always true - deadlocks and unrecoverable states only. A liveness check that fails because a dependency is down causes restart loops that make everything worse.',
          'Readiness asks: should this instance receive traffic right now? It may legitimately fail temporarily - during startup, while warming a cache, when a required dependency is unavailable, or when the instance is overloaded. Failing readiness removes it from the load balancer without killing it, so it can recover and return.',
          'Startup checks are the third kind, and they solve a specific problem: a slow-starting application that would fail a liveness probe during its normal boot. A separate startup probe with a generous budget lets the strict liveness probe begin only once the application has started.',
        ],
        code: {
          caption: 'What each endpoint should actually do',
          body: `GET /healthz   (liveness)
  return 200 if the process is functioning
  do NOT check the database, the cache or any dependency
  failing this = restart me

GET /readyz    (readiness)
  check: can I serve? DB pool has a connection, cache reachable,
         startup complete, not shedding load
  failing this = stop sending me traffic, but let me live

GET /startupz  (startup)
  migrations done, caches warm, config loaded
  generous timeout; liveness only starts after this passes`,
        },
      },
      {
        heading: 'Shallow versus deep, and the correlated-failure trap',
        paragraphs: [
          'A shallow check (the process answers) is cheap and catches crashes and hangs, but it will happily report healthy while every request fails because the database is unreachable. A deep check verifies dependencies and catches that - at a price that is easy to underestimate.',
          'The price is correlation. If every instance checks the database and the database has a two-second hiccup, every instance fails readiness simultaneously and the load balancer removes the entire fleet. A brief database problem becomes a total outage caused by your health check.',
          'The usual compromise: readiness checks verify only what this instance needs to serve and can recover from locally - its own connection pool, its own startup state - and treat shared dependency failures as something to degrade around rather than to report as unreadiness. If every instance would fail a check simultaneously, that check probably should not gate traffic.',
        ],
        bullets: [
          'Liveness: no dependency checks, ever.',
          'Readiness: local capability, with caching so the check itself is cheap.',
          'Never let a shared dependency failure remove 100 percent of the fleet.',
          'Cache dependency check results for a few seconds - probes run often.',
          'Return a body with detail for humans, and use the status code for machines.',
        ],
      },
      {
        heading: 'Tuning, draining and the settings that cause incidents',
        paragraphs: [
          'Three numbers matter: interval, timeout and threshold. Too aggressive (every second, one failure removes the instance) and normal latency variance ejects healthy nodes, reducing capacity and increasing load on the rest - a feedback loop. Too lax (every 30 seconds, five failures) and a dead instance keeps receiving traffic for over two minutes.',
          'A reasonable default is a 5-second interval, a 2-second timeout, and 2-3 consecutive failures to remove but only 1-2 successes to restore. Restoring faster than removing is deliberate: you want to be quick to use a recovered instance and slow to condemn a healthy one.',
          'Draining is the other half. During a deploy or a scale-in, the instance should start failing readiness while continuing to serve in-flight requests, wait for the load balancer to notice, and only then shut down. Without that sequence, every deploy produces a burst of connection errors - which is the most common self-inflicted error spike in production.',
        ],
      },
    ],
    examples: [
      {
        title: 'The health check that caused the outage',
        setup:
          'A service has one /health endpoint used for both liveness and readiness. It checks the process, the database and Redis. Kubernetes restarts on liveness failure.',
        walkthrough: [
          'Redis has a 15-second failover. Every instance health check fails, because they all check Redis.',
          'Readiness failing removes every pod from the service - 100 percent of traffic now fails, although the application could have served most requests without Redis.',
          'Liveness failing also triggers restarts. All pods restart simultaneously, losing their warm caches and their connection pools.',
          'Redis recovers after 15 seconds, but the fleet now needs 90 seconds to restart and warm up, and the cold cache means the database is overwhelmed by the miss traffic.',
          'Total outage: about 4 minutes from a 15-second dependency blip.',
          'Fix 1: split the endpoints. /healthz checks the process only; a Redis outage can never trigger a restart again.',
          'Fix 2: /readyz checks only the local database pool. Redis becomes a soft dependency the application degrades around.',
          'Fix 3: the application falls back to the database when Redis is unavailable, so the degraded mode is real rather than theoretical.',
        ],
        result:
          'The same Redis failover now causes a brief latency increase and no errors. Health checks are control inputs to your infrastructure - a badly scoped one lets any dependency take down your entire fleet.',
      },
    ],
    jargon: [
      { term: 'Liveness', plain: 'Should this process be restarted? Keep it dependency-free.' },
      { term: 'Readiness', plain: 'Should this instance receive traffic right now? May fail temporarily.' },
      { term: 'Startup probe', plain: 'A generous check for slow boots, so liveness does not kill a starting app.' },
      { term: 'Shallow / deep check', plain: 'Testing the process only, versus testing dependencies too.' },
      { term: 'Draining', plain: 'Failing readiness first and finishing in-flight requests before shutdown.' },
      { term: 'Flapping', plain: 'An instance repeatedly removed and restored because thresholds are too tight.' },
    ],
    remember: [
      'Liveness means restart me; readiness means stop sending me traffic. Never share one endpoint.',
      'Liveness must not check dependencies, or an outage becomes a restart loop.',
      'If a check could fail on every instance at once, it should not gate traffic.',
      'Remove slowly, restore quickly, and cache the check result.',
      'Drain by failing readiness before shutdown, or every deploy spikes errors.',
    ],
  },

  'disaster-recovery': {
    analogy: {
      title: 'Fire drills and the offsite safe',
      body:
        'Everyone knows the building might burn. So documents are copied to a safe elsewhere, the staff have practised the evacuation, and someone knows how long it takes to reopen in another office. The copies matter, but the two numbers that actually govern the plan are: how much can we afford to lose, and how fast must we be back?',
    },
    deepDive: [
      {
        heading: 'RPO and RTO: the two numbers everything else follows from',
        paragraphs: [
          'RPO (recovery point objective) is how much data you may lose, expressed as time: an RPO of 15 minutes means losing at most the last 15 minutes of writes. It is determined by how often you take backups or how far your replication lags.',
          'RTO (recovery time objective) is how long recovery may take. An RTO of 4 hours means the business accepts being down for up to four hours. It is determined by how much is prepared in advance - a warm standby is minutes, restoring from cold backups is hours.',
          'These are business decisions with engineering price tags, and they should be set per system. A payments ledger might be RPO near zero and RTO minutes; an internal analytics warehouse might be RPO 24 hours and RTO a week. Applying the strictest requirement uniformly is how disaster recovery budgets get wasted.',
        ],
        code: {
          caption: 'Strategies, and what they cost',
          body: `strategy         RTO          RPO (region lost)  relative cost
backup/restore   hours        backup interval    lowest (copies only)
pilot light      10s of min   seconds            low (data replicated, apps off)
warm standby     minutes      seconds            medium (small copy running)
hot standby /    minutes      seconds, or 0      highest (full second region)
active-active    or less      with sync

a bad write or DROP TABLE: every strategy restores from backup.
pick per system, not per company.`,
        },
      },
      {
        heading: 'Backups: the 3-2-1 rule and the only test that counts',
        paragraphs: [
          'The 3-2-1 rule: three copies of the data, on two different media or systems, with one offsite - and ideally one offline or immutable. The offline copy is what protects you from ransomware and from a compromised account deleting your backups - an increasingly common failure that replication and even versioned storage do not cover.',
          'A backup that has never been restored is not a backup, it is a file. Restores fail for mundane reasons: a missing encryption key, an incompatible version, a corrupted archive, a dependency the restore script assumes. Schedule restore tests, measure how long they take, and use that measured number as your real RTO rather than an optimistic estimate.',
          'Also check the retention window against the detection window. If a corruption is noticed after 10 days and you keep 7 days of backups, every copy contains the corruption. For destructive-error protection specifically, a delayed replica - one deliberately kept hours behind - is a cheap and very effective complement.',
        ],
        bullets: [
          '3 copies, 2 media, 1 offsite - and one offline or immutable if you can.',
          'Test restores on a schedule; the measured time is your RTO.',
          'Retention must exceed your realistic detection time.',
          'Back up the configuration, secrets and infrastructure definitions too, not just the data.',
          'A delayed replica protects against the mistakes replication copies instantly.',
        ],
      },
      {
        heading: 'Recovery is more than data',
        paragraphs: [
          'Teams practise restoring a database and discover, during a real event, that they cannot deploy the application because the CI system was in the failed region, the container registry is unreachable, the secrets manager is down, or DNS is managed by an account nobody can access. Disaster recovery covers the whole ability to operate, not the data alone.',
          'Infrastructure as code is what makes this tractable: if the environment can be recreated from a repository, recovery is a pipeline run rather than an archaeology project. The repository itself, the secrets, and the DNS control must all be reachable from outside the failed region.',
          'Finally, write the plan down and make it executable by someone who did not design the system. Include the decision criteria for declaring a disaster, who is authorised to do so, the order of restoration for dependent services, and how to verify the system is actually correct afterwards. Then run a game day against it, because a plan that has never been executed almost always contains wrong assumptions.',
        ],
      },
    ],
    examples: [
      {
        title: 'The restore that took 14 hours against a 4-hour RTO',
        setup:
          'A team has nightly backups to object storage and an RTO of 4 hours. A bad migration corrupts the primary database at 09:00.',
        walkthrough: [
          'RPO reality check: the last backup was at 02:00, so seven hours of orders are at risk. The stated RPO of 24 hours was never questioned by the business, who assumed it meant something else entirely.',
          'Hour 1: locating the backup and the encryption key. The key was in a password manager entry nobody outside the original team could access.',
          'Hours 2-9: the restore itself. A 2 TB database restored from compressed archives over the network took seven hours - nobody had ever measured it.',
          'Hours 9-12: the restored database is on a new host, so connection strings, security groups and the read replica all need recreating by hand from memory.',
          'Hours 12-14: verifying correctness and replaying what could be recovered from application logs and the payment provider.',
          'Fixes afterwards: continuous archiving with point-in-time recovery (RPO down to about 5 minutes), a warm standby with automated promotion (RTO under 15 minutes), a quarterly restore drill with measured timings, and keys stored where the on-call rota can reach them.',
        ],
        result:
          'The backups were fine; everything around them was not. RPO and RTO are measured end to end - including finding the key, provisioning hosts and reconnecting clients - which is why only a rehearsed restore produces an honest number.',
      },
    ],
    jargon: [
      { term: 'RPO', plain: 'How much data you may lose, in time. Set by backup frequency or replication lag.' },
      { term: 'RTO', plain: 'How long recovery may take. Set by how much is prepared in advance.' },
      { term: 'Pilot light', plain: 'Data replicated to a second region with compute switched off until needed.' },
      { term: 'Warm standby', plain: 'A scaled-down but running copy, ready to take traffic quickly.' },
      { term: 'Point-in-time recovery', plain: 'Restoring to any moment, using a base backup plus the write-ahead log.' },
      { term: 'Immutable backup', plain: 'A copy that cannot be deleted or altered for a retention period. Ransomware protection.' },
    ],
    remember: [
      'RPO is how much you may lose; RTO is how long you may be down. Set both per system.',
      'A backup that has never been restored is a file, not a backup.',
      'Your real RTO is the time a rehearsed restore actually took.',
      'Retention must outlive your detection time, or every copy holds the corruption.',
      'Recovery includes deploy pipelines, secrets and DNS - not just the data.',
    ],
  },
};
