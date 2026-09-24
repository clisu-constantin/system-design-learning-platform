import type { Concept } from '@/types';

export const scalingConcepts: Concept[] = [
  {
    slug: 'vertical-scaling',
    title: 'Vertical Scaling',
    tagline: 'Make one machine more powerful.',
    category: 'scaling',
    difficulty: 'Beginner',
    lab: 'vertical-scaling',
    keywords: ['scale up', 'instance size', 'cpu', 'ram'],
    what: 'Vertical scaling ("scaling up") means moving your workload to a machine with more CPU, more memory or faster storage, while keeping exactly one machine.',
    why: 'It is the cheapest way to buy time. No distributed state, no load balancer, no new failure modes - you change an instance type and the same code handles more traffic.',
    how: [
      'Measure which resource saturates first: CPU, memory, disk IO or network.',
      'Move to a larger instance type that relieves that specific resource.',
      'Restart the process - which means downtime unless you have a standby.',
      'Re-measure: the bottleneck often moves somewhere else rather than disappearing.',
    ],
    when: [
      'Early-stage systems where engineering time is more expensive than hardware.',
      'Stateful components that are genuinely hard to distribute (a primary SQL database).',
      'As a stopgap while you build the horizontal path.',
    ],
    diagram: `Same traffic: 550 req/sec   (simplified model, as in the Lab)

BEFORE: Small               AFTER: Large
  2 vCPU,  4 GB RAM           8 vCPU, 32 GB RAM
  capacity ~500 req/sec       capacity ~2,000 req/sec

  CPU  ##########  100%       CPU  ###        26%
  latency  ~1 s               latency  ~33 ms
  errors   ~9%                errors   0%

Still one machine: resizing it is a restart, and losing it is an outage.`,
    advantages: [
      'No change to application code or data model.',
      'No distributed-systems complexity: no consensus, no replication lag, no split brain.',
      'Debugging stays simple - one process, one log stream.',
    ],
    tradeoffs: [
      {
        approach: 'Vertical scaling',
        gains: ['Simple', 'Fast to apply', 'Keeps strong local consistency'],
        costs: [
          'Hard hardware ceiling',
          'Still a single point of failure',
          'Cost grows faster than capacity at the top end',
          'Resizing usually means a restart',
        ],
      },
      {
        approach: 'Horizontal scaling',
        gains: ['Near-linear headroom until a shared dependency saturates', 'Redundancy as a side effect'],
        costs: ['Requires stateless app or shared state', 'Load balancing, health checks, deployments across N nodes'],
      },
    ],
    mistakes: [
      'Scaling up a machine when the real bottleneck is a single-threaded database query.',
      'Assuming 2x the CPU means 2x the throughput - locks and IO rarely scale linearly.',
      'Staying vertical so long that there is no redundancy when the machine fails.',
      'Resizing the only server at peak time - the resize is a restart, and the restart is an outage.',
    ],
    realWorld: [
      'Most databases are scaled vertically first - it is far simpler than sharding.',
      'Stack Overflow famously served enormous traffic from a small number of very large servers.',
    ],
    related: ['horizontal-scaling', 'load-balancing', 'single-point-of-failure'],
    quiz: [
      {
        id: 'vs-1',
        prompt: 'Your single server runs at 95% CPU and you upgrade from 4 to 16 cores. Latency improves but availability does not. Why?',
        options: [
          'Larger machines fail more often, because 16 cores run hotter than 4',
          'It is still one machine - if it dies, the service is down',
          'CPU has no effect on availability',
          'The load balancer in front was removed during the upgrade',
        ],
        answer: 1,
        explanation:
          'Vertical scaling addresses capacity, not redundancy. A single instance remains a single point of failure no matter how large it is. Larger machines do not fail more often - the problem is that nothing takes over when this one does.',
      },
      {
        id: 'vs-2',
        prompt:
          'In the Lab, 550 req/sec hits the Small tier (capacity about 500): about 9% of requests fail and latency is about 1 s. You jump to Medium (about 1,000 req/sec). What happens to latency?',
        options: [
          'It halves to about 500 ms, because capacity doubled and each request gets twice the CPU',
          'It stays near 1 s - only the error rate changes, since each request does the same work',
          'It falls to tens of ms: utilization drops from over 100% to about 55%, so the queue empties',
          'It rises for good, because a bigger machine has more cores to coordinate on every request',
        ],
        answer: 2,
        explanation:
          'Latency is not proportional to capacity. Over 100% utilization almost all of the 1 s is time spent waiting in a queue; at 55% the queue is gone and a request takes little more than its own work. "Halves" is the tempting linear guess, but the queue does not shrink linearly - it disappears.',
      },
      {
        id: 'vs-3',
        prompt:
          'An API sits at 25% CPU, yet p95 latency is 900 ms. Profiling shows each request waits 800 ms on a lock in the database. The team proposes moving the API from 8 to 32 vCPU. What do you expect?',
        options: [
          'Almost no change - the request is waiting on the database, not computing here',
          'Latency drops to about 225 ms, because 4 times the cores do the same work 4 times faster',
          'Latency drops a little and the CPU rises to 100%',
          'The lock disappears, because 32 cores can hold more locks at the same time',
        ],
        answer: 0,
        explanation:
          'Low CPU with high latency means the machine is waiting, not working. More cores only speed up the compute part, which here is about 100 ms of the 900. The 4x guess assumes the whole request is CPU work on this machine, and it is not - measure which resource saturates before buying hardware.',
      },
      {
        id: 'vs-4',
        prompt:
          'A server with 16 cores shows one core pinned at 100% and the other 15 almost idle. Throughput has stopped growing. What is the right move?',
        options: [
          'Move to a 64-core machine, so there are 4 times the cores for the traffic to grow into',
          'Move to a machine with more RAM, since the busy core may be waiting on memory',
          'Add a second identical server with the same code',
          'Find and fix the single-threaded path, such as a global lock or one busy event loop',
        ],
        answer: 3,
        explanation:
          'One busy core with idle neighbours is a single-threaded bottleneck: the work cannot use the cores it already has, so 48 more would also sit idle. Fix the code or split the work first. A bigger machine is the tempting answer and the most expensive no-op.',
      },
      {
        id: 'vs-5',
        prompt:
          'A reporting server is at 40% CPU, its memory is full and it is swapping heavily; queries that used to take 2 s now take 30 s. Which resize is most likely to help?',
        options: [
          'A compute-optimised instance with twice the cores and the same RAM',
          'A memory-optimised instance with more RAM and the same cores',
          'A faster network card',
          'No resize - add a second CPU socket',
        ],
        answer: 1,
        explanation:
          'Heavy swapping means the working set does not fit in memory, so the machine reads from disk what it should keep in RAM. Enlarge the resource that is saturated: memory. Twice the cores looks like "a bigger machine" but leaves the real bottleneck exactly where it was.',
      },
      {
        id: 'vs-6',
        prompt:
          'In the Lab you press Upgrade server while traffic is flowing, and for a few seconds every request fails. What is the Lab showing, and how do teams avoid it in production?',
        options: [
          'A bug in the new machine type - teams test the instance type in staging before using it',
          'The new machine is warming its cache - teams pre-load the cache before sending traffic',
          'The resize restarts the only server - teams resize a standby and fail over to it',
          'The load balancer is reconfiguring - teams add a second load balancer',
        ],
        answer: 2,
        explanation:
          'Changing the instance type of a running server means stopping and starting it, and with one server that is an outage (shortened to 3 s in the Lab, minutes in a real cloud). There is no load balancer in front of a single server, so that option cannot be the cause - the fix is having a second machine to serve while the first one is resized.',
      },
      {
        id: 'vs-7',
        prompt:
          'The Lab tier ladder goes from Small to Bare metal: about 16x the capacity for about 65x the cost. You serve 4,000 req/sec today and traffic grows 50% a year. What should the ladder tell you?',
        options: [
          'Stay vertical for good - Bare metal serves 8,000 req/sec, twice the traffic of today',
          'Scale out today, because vertical scaling is always the wrong choice past 1,000 req/sec',
          'Pick Bare metal now so you never need to resize again, and the restart happens only once',
          'Each rung costs more per request and the ladder ends - scale up for time, but plan to scale out',
        ],
        answer: 3,
        explanation:
          'At 50% a year, 4,000 req/sec reaches 8,000 in under two years, which is the top of this ladder. Cost per unit of capacity also grows toward the top (DDIA makes the same point). Vertical scaling is not wrong - it is cheap time - but it has a ceiling you can see coming. Buying the biggest machine now pays top-rung prices for capacity you do not use yet.',
      },
      {
        id: 'vs-8',
        prompt:
          'A young product peaks at 300 req/sec. Its one Postgres database runs at 70% CPU on 4 vCPU. The team starts designing a sharding scheme. What is the trade-off-aware first move?',
        options: [
          'Scale the database up to 8 or 16 vCPU and measure again before designing shards',
          'Shard now, because the database will be the bottleneck sooner or later and resharding later is harder',
          'Move to a NoSQL database that shards automatically, so no partition key design is needed',
          'Add a second app server in front of the database',
        ],
        answer: 0,
        explanation:
          'Scaling up buys time at a small, known price and is reversible; that time is what teaches you your real access patterns before you pick a partition key you cannot easily change. Sharding is not wrong, but at 300 req/sec it pays a permanent complexity cost for capacity one bigger machine provides. A second app server does nothing for a database at 70% CPU.',
      },
      {
        id: 'vs-9',
        prompt:
          'Product asks for 99.95% availability. The service runs on one very large VM, and the cloud provider promises 99.5% for a single instance (the AWS EC2 instance-level SLA). What do you tell them?',
        options: [
          'Move to an even larger VM - bigger instance types come with a better SLA from the provider',
          'No single VM can promise that; run two or more instances in two zones behind a balancer',
          'Add more RAM, since most VM crashes come from memory pressure, so fewer crashes means higher uptime',
          'Turn on automatic restarts, so a crash lasts only seconds and does not count as downtime at all',
        ],
        answer: 1,
        explanation:
          '99.5% allows about 3.6 hours of downtime a month; 99.95% allows about 22 minutes. The provider only promises a higher number (99.99% on EC2) for instances spread over two or more zones. Size buys capacity, never availability, and an automatic restart still counts as downtime.',
      },
      {
        id: 'vs-10',
        prompt:
          'Your server runs at 85% CPU and latency is already three times its idle value. A colleague says: "We still have 15% left, no need to scale yet." What is wrong with that?',
        options: [
          'Nothing - CPU below 100% means spare capacity, so scale only when it hits 100%',
          'CPU above 80% wears out the hardware and shortens its life, so it is time to scale for that reason',
          'Past about 60-70% requests queue and latency climbs steeply - 15% is not real headroom',
          'The monitoring must be wrong, since latency cannot rise before CPU reaches 100%',
        ],
        answer: 2,
        explanation:
          'Queueing makes latency grow slowly and then sharply as utilisation nears 100% - in the Lab it bends upward after about 60%. That is why capacity plans target 60-70%, not 95%. The spare 15% is where latency is already rising, and a spike pushes the machine straight into errors.',
      },
      {
        id: 'vs-11',
        prompt:
          'After moving an API from 4 to 16 vCPU, CPU falls from 98% to 30%, but p95 latency only goes from 800 ms to 620 ms. Profiling shows 550 ms of every request is one database query. What is the best next step?',
        options: [
          'Move to 64 vCPU - CPU fell with every step, so latency should keep falling with it',
          'Add a second API server, so each server handles half the requests and half the queries',
          'Move to a faster disk on the API server to cut the time spent waiting on IO per request',
          'Fix the query, for example with an index - no API size can shrink database time',
        ],
        answer: 3,
        explanation:
          'You can only speed up the part you actually made faster. The bigger machine shrank the 250 ms of app code to about 70 ms; the 550 ms query was untouched because it is not work on this machine. An index that takes it to 12 ms beats any instance size. The bottleneck moved - follow it.',
      },
    ],
  },
  {
    slug: 'horizontal-scaling',
    title: 'Horizontal Scaling',
    tagline: 'Add more machines and spread the work across them.',
    category: 'scaling',
    difficulty: 'Beginner',
    lab: 'horizontal-scaling',
    keywords: ['scale out', 'cluster', 'replicas', 'instances'],
    what: 'Horizontal scaling ("scaling out") means running many copies of your application and distributing requests across them.',
    why: 'It removes the hardware ceiling and, as a side effect, gives you redundancy: losing one of five servers costs you 20% of capacity instead of 100% of the service.',
    how: [
      'Make the application stateless so any instance can serve any request.',
      'Put a load balancer in front and register every instance with it.',
      'Move session state to a shared store (or carry it in a signed token).',
      'Add health checks so failed instances are removed from the pool automatically.',
    ],
    when: [
      'Traffic exceeds what one reasonable machine can serve.',
      'You need to survive the loss of a single machine.',
      'Load is spiky and you want to add and remove capacity on demand.',
    ],
    diagram: `           Load Balancer
          /      |      \\
         v       v       v
      API 1    API 2    API 3
          \\      |      /
           v     v     v
         Shared database

Same traffic: 900 req/sec, ~500 req/sec per server
(simplified model, as in the Lab)

BEFORE: 1 server        AFTER: 3 servers
CPU 100%                CPU ~56% each
errors ~44%             errors 0%
lose it: 100% down      lose one: 1/3 of capacity`,
    advantages: [
      'Capacity grows roughly linearly with instance count - until a shared dependency such as the database saturates.',
      'Rolling deploys become possible: replace instances one at a time.',
      'Failure of one node degrades capacity instead of causing an outage.',
    ],
    tradeoffs: [
      {
        approach: 'Horizontal scaling',
        gains: ['No hardware ceiling', 'Built-in redundancy', 'Elastic cost'],
        costs: [
          'Application must be stateless or share state',
          'More components to operate and monitor',
          'Shared dependencies (the database) become the next bottleneck',
        ],
      },
      {
        approach: 'Vertical scaling instead',
        gains: ['No code or state changes', 'One machine to operate and debug'],
        costs: ['Hardware ceiling', 'Still a single point of failure', 'Resizing is a restart'],
      },
    ],
    mistakes: [
      'Adding app servers while the database is the actual bottleneck - you just push more load onto it.',
      'Keeping sessions in local memory, which makes every added server break some users.',
      'Forgetting connection pooling: 10 servers x 100 connections can exhaust a database.',
      'Running at 90% on every server at peak, so losing one pushes the rest over capacity.',
    ],
    realWorld: [
      'Stateless web tiers behind a load balancer are the default shape of almost every web system.',
      'Kubernetes deployments are a direct expression of this idea: N identical replicas plus a service in front.',
    ],
    related: ['load-balancing', 'stateless-applications', 'auto-scaling', 'connection-pooling'],
    quiz: [
      {
        id: 'hs-1',
        prompt: 'You scale from 1 to 6 API servers and latency barely improves. All six report 25% CPU. What is the most likely cause?',
        options: [
          'The load balancer algorithm is wrong and sends most requests to one server',
          'The bottleneck moved to a shared dependency such as the database',
          'Six servers is too many, so they spend their time coordinating with each other',
          'Health checks are failing',
        ],
        answer: 1,
        explanation:
          'Idle app servers with slow responses means they are waiting on something shared. Scaling a tier only helps until the next constraint - usually the datastore - becomes the limit. A bad balancing algorithm would show uneven CPU, not six servers all at 25%.',
      },
      {
        id: 'hs-2',
        prompt:
          'In the Lab, 900 req/sec hits one server that can serve about 500: CPU is 100% and about 44% of requests fail. You add a second server. What do you expect?',
        options: [
          'Errors and latency both return to normal, because 1,000 req/sec of capacity now covers 900',
          'Nothing changes until the load balancer is restarted to pick up the new server',
          'Errors stop, but each server takes 450 req/sec at about 85% CPU, so latency stays high',
          'Errors halve to about 22%, because each server now takes half of the overload',
        ],
        answer: 2,
        explanation:
          'Two servers give 1,000 req/sec of capacity for 900 of traffic, so nothing is rejected - but 90% utilisation is deep in the queueing zone. "Back to normal" is the tempting answer; being under capacity is not the same as having headroom. Errors do not halve either: once capacity exceeds traffic, they stop.',
      },
      {
        id: 'hs-3',
        prompt:
          'A team goes from 1 to 3 app servers behind a round-robin load balancer. Right away, users are logged out on about two requests out of three. What is the cause and the lasting fix?',
        options: [
          'Sessions live in the memory of one server; move them to a shared store or a signed token',
          'Round robin is broken and skips servers; switch to least connections to even it out',
          'Turn on sticky sessions so each user always goes back to the server that holds their session',
          'The servers have different clocks, so tokens look expired; sync them with NTP',
        ],
        answer: 0,
        explanation:
          'Each server only knows the sessions it created, so a request that lands on another server looks logged out - one time in three it lands back home and works. Sticky sessions is the tempting quick fix: it hides the symptom, but a failed server still logs out its users and load can no longer be spread evenly.',
      },
      {
        id: 'hs-4',
        prompt:
          'In the Lab, 4 servers share 1,200 req/sec (300 each, about 56% CPU). You turn on Fail Server 1. What happens?',
        options: [
          'Every request fails until Server 1 is back, since the pool is now incomplete',
          'A quarter of all requests fail - the ones round robin still sends to Server 1',
          'Nothing at all - the load balancer launches a replacement server within seconds and shifts the load',
          'Server 1 leaves the pool; the other 3 take 400 each, about 75% CPU - no errors, higher latency',
        ],
        answer: 3,
        explanation:
          'With interchangeable servers, losing one costs 1/N of capacity, not the service. The load balancer sends nothing to a server that fails its health check, so the requests go to the other three instead of failing. A load balancer does not create servers - that is auto scaling, and it takes minutes.',
      },
      {
        id: 'hs-5',
        prompt:
          'You run 4 app servers, each at 90% of capacity at peak. One of them crashes at peak time. What happens?',
        options: [
          'The other 3 each need 120% of capacity, so queues fill and requests fail',
          'The other 3 go to about 100% and everything keeps working, just more slowly',
          'The load balancer rejects exactly one quarter of the traffic and the rest is fine',
          'Nothing, because the crashed server was redundant',
        ],
        answer: 0,
        explanation:
          '4 x 90% is 3.6 servers worth of work; 3 servers cannot hold it, so each is at 120% and about one request in six fails. Redundancy only works if peak load fits in N-1 servers - here that means running at 75% or less. Servers are only redundant if the survivors have the headroom to cover the loss.',
      },
      {
        id: 'hs-6',
        prompt:
          'You scale from 4 to 20 app instances, each with a connection pool of 50. The Postgres database starts refusing new connections. Why, and what fixes it?',
        options: [
          'The database ran out of disk from the extra write load of 20 instances; add storage',
          'Pools multiply: 20 x 50 is 1,000, far above a max_connections of 100; shrink pools or add PgBouncer',
          'Too many instances overload the load balancer; add a second load balancer',
          'Postgres cannot talk to more than 4 clients; switch to MySQL',
        ],
        answer: 1,
        explanation:
          'Each instance opens its own pool, so the total grows with every instance you add. Postgres runs one process per connection and ships with max_connections at typically 100. Raising the limit to 1,000 is the tempting fix, but each connection costs memory on the database - a pooler lets 1,000 client connections share a few dozen real ones.',
      },
      {
        id: 'hs-7',
        prompt:
          'After scaling to 3 instances, the nightly invoice email goes out three times to every customer. What happened?',
        options: [
          'The email provider retried the send three times after a slow response timed out',
          'The load balancer duplicated the request to every backend in the pool, once each',
          'The job runs in every app instance; use one scheduler or a distributed lock',
          'Three servers make the clock run three times as fast, so the job fires three times',
        ],
        answer: 2,
        explanation:
          'A cron job inside the app process runs once per process - one instance meant once, three means three. It is the same bug as local sessions: something that must happen once lives on every node. The load balancer only routes incoming requests; it did not create the job runs.',
      },
      {
        id: 'hs-8',
        prompt:
          'After scaling to 2 servers, users upload a profile photo, see "saved", and then the photo shows as broken about half the time. What is the fix?',
        options: [
          'Turn on sticky sessions, so each user keeps hitting the server that has their photo',
          'Increase the upload size limit, since large photos are cut off halfway through the upload',
          'Add a CDN in front of the servers so the photo is cached after the first successful load',
          'Store uploads in shared object storage instead of on the local disk of one server',
        ],
        answer: 3,
        explanation:
          'The file was written to the local disk of one server; when the other server serves the page, the file is not there. Object storage makes every server see the same files. A CDN only caches what an origin can serve, so it would cache the broken half too; sticky sessions hide the bug until that server is replaced.',
      },
      {
        id: 'hs-9',
        prompt:
          'You must ship a new version during the day with zero downtime. What does running 4 servers behind a load balancer allow that 1 server does not?',
        options: [
          'A rolling deploy: take one server out, update it, put it back, while the other 3 serve',
          'Deploying to all 4 at the same instant, so users never see two versions side by side',
          'Skipping the restart, because the load balancer hot-swaps the new code into each server',
          'Nothing - every deploy needs downtime, whatever the number of servers',
        ],
        answer: 0,
        explanation:
          'Interchangeable servers let you replace them one at a time while the load balancer routes around the gap. Updating all 4 at once is the same outage as one server. The catch is capacity: during the deploy 3 servers carry all the traffic, so they need the same N-1 headroom as for a failure.',
      },
      {
        id: 'hs-10',
        prompt:
          'In the Lab you push traffic to 3,500 req/sec with all 8 servers: app CPU is about 82%, the shared database is at 100% and about 14% of requests fail. What is the next step?',
        options: [
          'Add more app servers - app CPU at 82% is above the 60-70% target for headroom',
          'Take load off the database: cache hot reads, add read replicas, or shard',
          'Switch the load balancer to least connections so the slow requests spread out',
          'Lower the traffic slider in production',
        ],
        answer: 1,
        explanation:
          'Every app server sends its queries to the same database, so more app servers only send it more work - the bottleneck has moved downstream. The data tier needs its own scaling: caching, read replicas for reads, and sharding for writes. A different balancing algorithm spreads load across app servers that are not the problem.',
      },
      {
        id: 'hs-11',
        prompt:
          'Each instance enforces a limit of 100 requests a minute per user with an in-memory counter. After scaling to 5 instances, one user makes about 500 requests a minute without being blocked. Why?',
        options: [
          'Rate limits only work on a single server, so scaling out to 5 instances always disables them',
          'The load balancer adds its own allowance on top, 100 more for each instance behind it',
          'Each instance counts only its own requests, so the limit became 5 x 100; share the counter',
          'The user found a bug in the limiter that resets the counter every few seconds',
        ],
        answer: 2,
        explanation:
          'Round robin spreads the user over 5 counters that never talk to each other. A shared counter restores one limit for the whole fleet. Rate limits do work across many servers - they just need their state in one place, like sessions and uploads.',
      },
    ],
  },
  {
    slug: 'stateless-applications',
    title: 'Stateless Applications',
    tagline: 'Any server can serve any request, because none of them remember you.',
    category: 'scaling',
    difficulty: 'Beginner',
    lab: 'stateless',
    labFocus: 'stateless-applications',
    keywords: ['session', 'jwt', 'sticky sessions', 'shared state'],
    what: 'A stateless service keeps no per-user data in its own memory between requests. Everything needed to handle a request either arrives with it or is fetched from shared storage.',
    why: 'Statelessness is the precondition for horizontal scaling. If server 2 cannot serve a user that server 1 was talking to, adding servers creates bugs instead of capacity.',
    how: [
      'Move session data into a shared store such as Redis, keyed by session id.',
      'Or make the client carry signed state (a JWT) that any server can verify.',
      'Keep caches local only if they are pure optimisations that can be rebuilt at any time.',
      'Never write user files to local disk - use object storage.',
    ],
    when: ['Any service that runs behind a load balancer.', 'Anything you want to autoscale or deploy with rolling restarts.'],
    advantages: [
      'Instances become disposable: kill one, replace it in a deploy or scale in, and no user is logged out.',
      'The load balancer can send any request anywhere, so load spreads evenly and new instances help at once.',
    ],
    diagram: `LOCAL SESSIONS (breaks)       SHARED SESSIONS (scales)

 Server 1  [USER A]              Server 1     Server 2
 Server 2  [   -  ]                  \\          /
 next request -> Server 2              \\      /
 SESSION NOT FOUND                      Redis
                                   shared session store`,
    tradeoffs: [
      {
        approach: 'Sticky sessions',
        gains: ['Works without changing the application', 'Keeps local in-memory caches warm'],
        costs: ['Uneven load', 'Losing a server logs out its users', 'Autoscaling and rolling deploys become disruptive'],
      },
      {
        approach: 'Shared session store (Redis)',
        gains: ['Any server serves any user', 'Sessions survive instance restarts', 'Server-side revocation is easy'],
        costs: ['Extra network hop per request', 'Redis becomes critical infrastructure and needs its own HA'],
      },
      {
        approach: 'Stateless tokens (JWT)',
        gains: ['No session lookup at all', 'Scales trivially across services and regions'],
        costs: ['Revocation is hard before expiry', 'Token size travels on every request', 'Key rotation must be planned'],
      },
    ],
    mistakes: [
      'Calling a service stateless while it caches user permissions in a module-level variable.',
      'Using JWTs with long expiry and no revocation path, then needing to ban a user immediately.',
      'Storing uploads on the instance filesystem and wondering why they disappear after a deploy.',
    ],
    related: ['stateful-applications', 'load-balancing', 'jwt', 'redis'],
    quiz: [
      {
        id: 'sl-1',
        prompt: 'Three API servers sit behind a round-robin load balancer and store sessions in local memory. What happens?',
        options: [
          'Nothing - the load balancer copies each new session to the other two servers',
          'Users get logged out whenever a request lands on another server',
          'The database becomes the bottleneck',
          'DNS resolution fails',
        ],
        answer: 1,
        explanation:
          'Round robin sends consecutive requests to different servers. Only the server that created the session knows about it, so roughly two out of three requests find no session - the Local sessions mode of the Lab shows about 33% success. A load balancer forwards requests; it never copies server memory.',
      },
      {
        id: 'sl-2',
        prompt:
          'In the Lab on Shared store, you kill Server 2 while traffic runs. What happens to the users whose last request Server 2 served?',
        options: [
          'They are logged out, because their session was last written by Server 2',
          'Their requests wait in the load balancer until Server 2 restarts',
          'Nothing they notice: Server 1 or 3 loads the same session from Redis',
          'The load balancer copies their sessions from Server 2 to the surviving servers',
        ],
        answer: 2,
        explanation:
          'Server 2 held nothing, so losing it loses nothing but the requests it was working on at that instant. Being logged out is what happens in the Local and Sticky modes, where the session lived inside the dead process - that is the whole difference.',
      },
      {
        id: 'sl-3',
        prompt:
          'Still on Shared store, you click Kill Redis. What does the Lab show, and what does it teach?',
        options: [
          'Every request fails, since all servers need Redis - so Redis needs replicas and failover',
          'Only about a third of requests fail - the ones whose session was stored on the dead Redis node',
          'The servers fall back to their local memory and keep working',
          'Nothing changes, because the sessions are also in the cookie',
        ],
        answer: 0,
        explanation:
          'Making the app tier stateless moved the state into Redis, it did not remove it. All three servers depend on that one store, so it is now critical infrastructure. The servers have no local copy to fall back to - that was the point of taking the sessions out.',
      },
      {
        id: 'sl-4',
        prompt:
          'An API keeps sessions in Redis but loads each user permissions into a module-level map at login and never refreshes it. An admin removes a permission from a user. What happens?',
        options: [
          'The change applies everywhere on the next request, because sessions are in Redis and every server reads them',
          'The user is logged out on every server',
          'The permission disappears after the Redis TTL expires',
          'Servers holding the old map keep granting it until they restart, so it depends on routing',
        ],
        answer: 3,
        explanation:
          'The session being shared does not make the service stateless: the permission map is state inside the process. Each instance holds its own stale copy, so the result depends on routing. Either read permissions from shared storage per request, or cache them with a short TTL you can accept.',
      },
      {
        id: 'sl-5',
        prompt:
          'Profile photos are written to /var/app/uploads on the instance that received the upload. After a rolling deploy replaces all 4 instances, what do users see?',
        options: [
          'Every photo uploaded before the deploy is gone with the old disks',
          'Photos load slowly for a while as the new instances copy them from the old ones',
          'Nothing - a rolling deploy keeps the old disks and mounts them on the new instances',
          'Only one photo in four is missing',
        ],
        answer: 0,
        explanation:
          'Local disk is one of the four places state hides. Even before the deploy, a photo was missing whenever the request landed on a different instance. Store the file in object storage and keep only its key in the database, so any instance can serve it and none can lose it.',
      },
      {
        id: 'sl-6',
        prompt:
          'A scheduler inside the app process sends a daily digest email at 08:00. The service is scaled from 1 to 4 instances. What happens the next morning?',
        options: [
          'The load balancer picks one instance to send it',
          'Every user gets the digest 4 times, once per instance',
          'The digest is split so each instance emails a quarter of the users',
          'Nobody gets it, because the instances cancel each other out',
        ],
        answer: 1,
        explanation:
          'A load balancer only routes incoming requests - it knows nothing about work an instance starts by itself. Anything that must happen exactly once needs a single scheduler, a queue or a lock outside the app instances.',
      },
      {
        id: 'sl-7',
        prompt:
          'Sessions are in memory and the release is today, so the team turns on sticky sessions instead of moving sessions to Redis. What still goes wrong?',
        options: [
          'Nothing - sticky sessions make the service stateless, since each user sees one server',
          'Every request now pays a network hop to look up its session',
          'Users are pinned to whichever server they first reached, so the lab shows 33% success',
          'A crash or deploy logs out everyone pinned to that server, and load stays uneven',
        ],
        answer: 3,
        explanation:
          'Sticky sessions hide the state, they do not remove it. In the Sticky sessions mode of the Lab, killing one server sends its users to another server that has never seen them. The network hop is the cost of a shared store, not of stickiness.',
      },
      {
        id: 'sl-8',
        prompt:
          'Each instance keeps an in-memory cache of rendered product pages for 60 seconds, and different instances may hold different copies. Is the service still stateless?',
        options: [
          'Yes, if losing the cache only costs a rebuild and 60 s of staleness is acceptable',
          'No - any data in process memory makes a service stateful, cache or not',
          'Only if every instance holds the same copy, so two users never see two different pages',
          'Only if the cache is also written to local disk, so it survives a restart',
        ],
        answer: 0,
        explanation:
          'The test is whether anything is lost or done twice when the instance vanishes. A cache that can be rebuilt from the database passes. The tempting "any memory is state" answer would forbid every local cache, and that is not what stateless means.',
      },
      {
        id: 'sl-9',
        prompt:
          'After a fraud alert, a bank must log a user out on all 20 servers within seconds. Which place for the session does this with the least extra machinery?',
        options: [
          'Signed JWTs with a 24-hour lifetime, since no server has to be contacted',
          'Sticky sessions on the load balancer, so only one server holds each session',
          'A shared session store: delete one key and every server rejects it',
          'Sessions in each server memory, cleared by a broadcast message to all 20 servers',
        ],
        answer: 2,
        explanation:
          'Server-side revocation is where a shared store shines - the Lab shows Revoke user A rejected at once in Shared store mode. A JWT stays valid until it expires unless you add a denylist, which is a shared store again.',
      },
      {
        id: 'sl-10',
        prompt:
          'A chat app runs 3 instances. User X holds a WebSocket on instance 1, and a message for X arrives on instance 2. What must the design include?',
        options: [
          'Nothing - instance 2 can push down any open WebSocket in the cluster',
          'A pub/sub channel so instance 2 can hand the message to the instance holding X',
          'Sticky sessions, so every sender lands on instance 1 where X is connected',
          'A shared session store, which also shares the sockets',
        ],
        answer: 1,
        explanation:
          'A long-lived connection is state pinned to one process, the fourth hiding place. A session store shares data, not sockets, and stickiness cannot put two different users on the same instance. The instances need a pub/sub layer to reach the connections held by other instances.',
      },
      {
        id: 'sl-11',
        prompt:
          'You review a service with one question: if this instance died right now, would anything be lost or done twice? Which item fails that test?',
        options: [
          'A temp file created and deleted inside one request, on the local disk of the instance',
          'Config read from environment variables at start-up and kept in memory for the whole run',
          'An in-memory LRU cache of database rows, refilled from the database on a miss',
          'An in-memory counter of how many free exports each user has used this month',
        ],
        answer: 3,
        explanation:
          'The counter is data a later request depends on: kill the instance and every user gets their free exports back, and each instance counts separately anyway. The other three are rebuilt or re-read with nothing lost, so they are fine inside a stateless service.',
      },
    ],
  },
  {
    slug: 'stateful-applications',
    title: 'Stateful Applications',
    tagline: 'When a component must remember - and what that costs to scale.',
    category: 'scaling',
    difficulty: 'Intermediate',
    lab: 'stateless',
    labFocus: 'stateful-applications',
    keywords: ['state', 'sticky', 'websocket', 'database', 'statefulset', 'failover'],
    what: 'A stateful component keeps data that must survive between requests and cannot simply be recreated: databases, caches, message brokers, and services holding long-lived connections. An app server that keeps login sessions in its own memory is stateful too - usually by accident.',
    why: 'Every system has state somewhere. The design question is not "how do I avoid state?" but "where do I concentrate it, and how do I make that part reliable?".',
    how: [
      'Push state down into a small number of purpose-built stateful systems.',
      'Give those systems replication, backups and a tested failover procedure.',
      'For connection-oriented services (WebSockets), route by connection and plan for reconnects.',
      'Use consistent hashing or partitioning when one stateful node is not enough.',
    ],
    when: [
      'Databases, caches, brokers, real-time gateways, stream processors.',
      'Wherever the data must outlive the process that wrote it.',
    ],
    advantages: [
      'Purpose-built stateful systems bring replication, backups and failover you do not have to write.',
      'Concentrating state keeps every other tier disposable and easy to scale.',
      'Local state is fast: data already in memory or on local disk needs no network hop.',
    ],
    diagram: `Stateless tier    ->    scale by adding copies
Stateful tier     ->    scale by partitioning + replication

  API, workers            Postgres, Redis, Kafka
  (easy)                  (careful: data must move)`,
    tradeoffs: [
      {
        approach: 'Concentrate state in a managed datastore',
        gains: ['App tier stays trivially scalable', 'Backups and failover handled in one place'],
        costs: ['That store becomes the critical dependency', 'Its limits become your limits'],
      },
      {
        approach: 'State inside app instances (sticky sessions)',
        gains: ['No extra system to run', 'No network hop to read the state'],
        costs: [
          'A crash or deploy of one instance loses the state of every user pinned to it',
          'Load cannot be rebalanced while users stay pinned',
          'Autoscaling in removes data along with the instance',
        ],
      },
      {
        approach: 'Partition a stateful store (sharding)',
        gains: ['Write capacity grows with the number of shards', 'Each node holds a smaller data set'],
        costs: [
          'Moving data between nodes is slow and must be planned',
          'Queries across shards get harder',
          'Very hard to reverse once the application depends on it',
        ],
      },
    ],
    mistakes: [
      'Spreading small pieces of state across every service, so there is no single place to back up.',
      'Treating a stateful component like a stateless one during deploys and losing data.',
      'Keeping login sessions or carts in app memory, so every restart logs users out.',
      'Counting replication as a backup - a bad delete is copied to every replica within seconds.',
      'Pointing clients at a fixed database address that stops being the primary after a failover.',
    ],
    related: ['stateless-applications', 'replication', 'sharding', 'websockets'],
    quiz: [
      {
        id: 'sf-1',
        prompt:
          'In the Lab on Sticky sessions, Server 1 holds the sessions of users A and D. You kill Server 1. What happens?',
        options: [
          'Every user is logged out, because the load balancer resets all sticky routes when a server dies',
          'A and D land on another server with no session and must log in; others notice nothing',
          'Nothing - the load balancer moves the sessions of A and D to Server 2',
          'Requests from A and D fail until Server 1 restarts, since they stay pinned to it',
        ],
        answer: 1,
        explanation:
          'The sessions lived in the memory of Server 1, so they died with it. Stickiness only affects routing: the other users stay pinned to healthy servers and keep their sessions, and A and D are routed on, not held back. No load balancer copies application memory.',
      },
      {
        id: 'sf-2',
        prompt:
          'Shopping carts live in app memory on 3 instances with sticky sessions. A rolling deploy restarts the instances one at a time. What do shoppers see?',
        options: [
          'Nothing - a rolling deploy keeps capacity up, so no one is affected',
          'Only the shoppers on the last instance lose their cart',
          'Every active shopper loses their cart once during the deploy, a third at each restart',
          'Carts are saved to disk automatically before each restart and reloaded after',
        ],
        answer: 2,
        explanation:
          'A rolling deploy protects capacity, not in-memory state. Each restart wipes the carts of the users pinned to that instance, and by the end every instance has restarted. Moving carts to Redis with a TTL makes the deploy touch nothing a customer owns.',
      },
      {
        id: 'sf-3',
        prompt:
          'With sticky sessions, one server runs at 90% CPU while two others sit at 30%. You add a fourth server. Why does the hot server stay hot?',
        options: [
          'The users already pinned to it stay pinned; only new sessions reach the new server',
          'The load balancer needs a restart before it sends traffic to the new server',
          'The new server must first copy the sessions of the hot one before it can take users',
          'CPU does not depend on the number of users',
        ],
        answer: 0,
        explanation:
          'Stickiness overrides the balancing decision for every existing user. The new server helps only as new sessions arrive. Moving those users would log them out, because their state is in the hot server memory.',
      },
      {
        id: 'sf-4',
        prompt:
          'A PostgreSQL primary dies. A replica exists and failover is automated. What do writing clients see?',
        options: [
          'Nothing - the replica takes over with zero impact, since failover is automated',
          'All data written since the last nightly backup is lost with the old primary',
          'Reads fail but writes continue, because the replica only served reads',
          'Writes fail for tens of seconds during promotion, then resume',
        ],
        answer: 3,
        explanation:
          'Failover takes time: the failure must be detected, a replica promoted and clients redirected. Automation shrinks that window, it does not make it zero. With asynchronous replication a few of the last writes can also be lost, but not everything since a backup.',
      },
      {
        id: 'sf-5',
        prompt:
          'A migration drops the wrong column on a primary with 2 streaming replicas. Can the replicas restore the data?',
        options: [
          'Yes - promote a replica; a replica exists precisely to hold a second copy of the data',
          'No - the drop replicated within seconds; you need a backup or point-in-time recovery',
          'Yes, if you stop replication within an hour, before the replicas apply the change',
          'Only the second replica, because it lags',
        ],
        answer: 1,
        explanation:
          'Replication protects against losing a node, not against a bad command - it faithfully copies the mistake. Only a backup, ideally with point-in-time recovery, can bring back data from before the drop.',
      },
      {
        id: 'sf-6',
        prompt:
          'The app reads the database primary IP address once at start-up. A failover promotes a replica on a different IP. What happens?',
        options: [
          'Writes keep going to the old, dead primary until the app is restarted',
          'The app finds the new primary automatically, since failover updates every client',
          'The replica takes over the old IP address in every case, so nothing breaks',
          'Only reads fail',
        ],
        answer: 0,
        explanation:
          'An address cached forever is the classic surprise in an untested failover. Point clients at a name that follows the primary (a DNS name, a proxy, or a driver that discovers the primary), and test the failover before you need it.',
      },
      {
        id: 'sf-7',
        prompt:
          'A single PostgreSQL primary is at 90% of its write capacity. A teammate proposes adding three read replicas. What happens to write capacity?',
        options: [
          'It roughly quadruples, since four nodes can now accept writes',
          'It grows by the capacity of one replica, as writes spill over to it',
          'It does not grow: every write still goes to the one primary',
          'It drops to zero during replica creation',
        ],
        answer: 2,
        explanation:
          'Replicas scale reads. Write capacity needs a larger primary or partitioning (sharding), which changes how the application reaches its data and is hard to reverse - the asymmetry that makes sharding a last resort.',
      },
      {
        id: 'sf-8',
        prompt:
          'A 3-node database cluster runs on Kubernetes as a plain Deployment with the data on the pod filesystem. One pod restarts. What happens?',
        options: [
          'Nothing - Kubernetes keeps pod data across restarts on the node',
          'The pod comes back with the same name and the same data, as a Deployment keeps both',
          'The data moves to another pod in the Deployment',
          'The pod comes back with a new name and an empty disk - data and identity lost',
        ],
        answer: 3,
        explanation:
          'Stateful nodes need stable identity and storage that outlives the pod. That is what a StatefulSet with persistent volumes gives: the same name, the same volume, on every restart. A Deployment treats pods as interchangeable, which is right only for stateless ones.',
      },
      {
        id: 'sf-9',
        prompt:
          'A 2 TB database replica dies. A new replica copies data at about 200 MB/s. A stateless app instance also dies. Which comes back first, and why?',
        options: [
          'The replica, because the scheduler restores databases before stateless services',
          'The app, in about 30 s; the replica needs 3 hours to copy 2 TB',
          'Both in about 30 seconds, since both are just new machines to boot',
          'Neither comes back without a manual rebuild by an operator on call',
        ],
        answer: 1,
        explanation:
          '2,000,000 MB at 200 MB/s is 10,000 seconds, close to 3 hours. The stateless instance holds nothing, so it just boots and joins. That gap is why stateful nodes are replaced slowly and with care.',
      },
      {
        id: 'sf-10',
        prompt:
          'Each of 12 microservices keeps a little SQLite file on its local disk. What is the main cost?',
        options: [
          'SQLite is too slow for production traffic and locks the whole file on writes',
          'Nothing - small state is harmless',
          'Twelve places to back up and fail over, and data lost when a disk is replaced',
          'The services can no longer be deployed with rolling restarts',
        ],
        answer: 2,
        explanation:
          'Every stateful component multiplies backup jobs, failover drills and upgrade windows forever. Concentrating the state in one well-run store keeps the services disposable. Speed is not the problem here - ownership is.',
      },
      {
        id: 'sf-11',
        prompt:
          'A WebSocket gateway node holds 50,000 open connections. You deploy a new version to it. What should the design plan for?',
        options: [
          'Nothing - WebSockets reconnect inside the protocol, so a restart is invisible',
          'All 50,000 clients drop, so drain the node and have them reconnect with jittered backoff',
          'The load balancer hands the open connections over to another healthy node during the deploy',
          'Only idle connections are lost; active ones finish on the old process first',
        ],
        answer: 1,
        explanation:
          'An open connection is state inside one process. Restarting the process closes it, and 50,000 clients reconnecting at the same instant can knock over the rest of the fleet. A load balancer cannot move a live TCP connection between servers.',
      },
    ],
  },
  {
    slug: 'load-balancing',
    title: 'Load Balancing',
    tagline: 'One address in front, many healthy servers behind.',
    category: 'scaling',
    difficulty: 'Beginner',
    lab: 'load-balancer',
    labFocus: 'load-balancing',
    keywords: ['round robin', 'least connections', 'health check', 'reverse proxy', 'failover'],
    what: 'A load balancer accepts incoming requests and forwards each one to one of several backend servers, keeping track of which backends are healthy.',
    why: 'It is what turns a set of servers into a service. It spreads load, removes failed instances from rotation, and lets you add or replace servers without clients noticing.',
    how: [
      'Clients resolve one name/IP - the load balancer - instead of individual servers.',
      'For each request the balancer picks a backend using an algorithm (round robin, least connections, weighted, hash).',
      'A health check runs continuously against every backend; failures remove it from the pool.',
      'When the backend recovers and passes checks again, it is added back.',
    ],
    when: [
      'Any time more than one instance serves the same role.',
      'When you need zero-downtime deploys or automatic removal of failed nodes.',
    ],
    diagram: `                    Request traffic
                       |  |  |
                       v  v  v
                      USERS
                        |
                        v
                +---------------+
                | Load Balancer |
                +---------------+
                  /     |     \\
                 v      v      v
            Server 1 Server 2 Server 3
            CPU 35%  CPU 51%  CPU 28%`,
    advantages: [
      'Removes single points of failure in the application tier.',
      'Enables rolling deployments and canary releases.',
      'Can terminate TLS, apply rate limits and add observability in one place.',
    ],
    tradeoffs: [
      {
        approach: 'Round robin',
        gains: ['Trivially simple', 'Even distribution when requests are uniform'],
        costs: ['Ignores how busy a server actually is', 'A slow server keeps receiving its share'],
      },
      {
        approach: 'Least connections',
        gains: ['Adapts to uneven request cost', 'Protects struggling servers'],
        costs: ['Requires connection tracking', 'Can herd traffic onto a freshly started (empty) server'],
      },
      {
        approach: 'Weighted round robin',
        gains: ['Handles heterogeneous hardware', 'Useful for gradual rollouts'],
        costs: ['Weights are manual and go stale'],
      },
      {
        approach: 'IP / consistent hash',
        gains: ['Same client reaches the same server - keeps local caches warm'],
        costs: ['Uneven load', 'Rebalancing on membership change', 'Reintroduces stickiness problems'],
      },
    ],
    mistakes: [
      'Health checks that only test that the port is open, so a server with a broken database stays in the pool.',
      'Running a single load balancer instance - moving the single point of failure rather than removing it.',
      'Timeouts longer than the client timeout, so the balancer holds connections nobody is waiting for.',
      'Least connections with no health check: a crashed server that refuses instantly holds zero connections and receives almost every request.',
    ],
    realWorld: [
      'Layer 4 balancers (AWS NLB, IPVS) forward TCP; layer 7 balancers (NGINX, HAProxy, ALB) understand HTTP and can route by path or header.',
      'DNS load balancing spreads traffic between regions, but caches make it slow to react to failure.',
    ],
    related: ['horizontal-scaling', 'health-checks', 'reverse-proxy', 'auto-scaling'],
    quiz: [
      {
        id: 'lb-1',
        prompt: 'Three servers sit behind a round robin balancer with no health checks of any kind, active or passive. Server 2 crashes and refuses every connection. What do users see?',
        options: [
          'Nothing - the balancer notices the refused connections and stops using Server 2 on its own',
          'About one request in three fails, until someone removes Server 2 by hand',
          'Every request fails, because one dead member marks the whole pool as broken',
          'All traffic moves to Server 2, because refused connections make it answer fastest',
        ],
        answer: 1,
        explanation:
          'Round robin hands requests out in turn and knows nothing about health, so Server 2 keeps its third and every one of those requests fails. The tempting "it notices on its own" needs a health check - active probes, or passive checks such as the max_fails setting of NGINX - and this pool has none. Kill a server in the Lab with Health checks off to see the one-in-three failures that never stop.',
      },
      {
        id: 'lb-2',
        prompt: 'Most requests take 20 ms, but about 2 percent are 3-second report queries. With round robin, one server is stuck with several reports and its p95 climbs to 2 s while the others have room. What change on the balancer helps first, without new hardware?',
        options: [
          'Switch to Random, so the reports spread out by chance instead of in a fixed rotation',
          'Give the stuck server a lower weight in Weighted Round Robin so it receives fewer requests',
          'Switch to Least Connections, so a server busy with long requests receives fewer new ones',
          'Switch to IP hash, so each user always reaches the same server',
        ],
        answer: 2,
        explanation:
          'Least Connections looks at in-flight work: a server holding several 3-second reports has more open connections, so new requests go elsewhere. Random and round robin both ignore how busy a server is, and a fixed weight is wrong the moment the reports land on a different server. IP hash only makes the placement sticky.',
      },
      {
        id: 'lb-3',
        prompt: 'In the Lab, Server 1 is slow (2x per request), traffic is 750 req/sec and pool capacity reads 1,000 req/sec. With Round Robin, Server 1 fails requests although the pool is at 75 percent. Why?',
        options: [
          'Each server gets 250 req/sec, but slow Server 1 can take only 200, so it saturates alone',
          'Pool capacity is wrong: the Lab counts Server 1 twice, so the real pool is smaller',
          'Round Robin sends most of the traffic to Server 1, because it is listed first in the pool',
          'Any pool above 70 percent drops requests, whatever the algorithm',
        ],
        answer: 0,
        explanation:
          'Pool capacity is the sum over all servers, but each server only has its own capacity. Round Robin splits 750 evenly into 250 each, and 250 is more than the 200 req/sec the slow server can take. Switch to Least Connections in the Lab and Server 1 receives fewer requests because its connections stay open longer - the failures stop with no new hardware.',
      },
      {
        id: 'lb-4',
        prompt: 'In the Lab you pick Least Connections, turn Health checks off and kill Server 2. Failed requests jump far above one in three. What is going on?',
        options: [
          'Least Connections retries every failed request three times, which triples the failure count',
          'The two live servers overload because they now carry all of the traffic between the two of them',
          'Killing a server disables the load balancer for a few seconds while it rebuilds the pool',
          'The dead server holds zero connections, so Least Connections picks it almost every time',
        ],
        answer: 3,
        explanation:
          'Least Connections chooses the server with the fewest in-flight requests. A crashed server refuses instantly, so it never holds a connection and always looks the least busy: it becomes a black hole. The live servers are not overloaded - the traffic simply never reaches them. Only a health check that ejects the dead server ends it.',
      },
      {
        id: 'lb-5',
        prompt: 'Your pool has one 16-core server and two 4-core servers behind round robin. The two small ones sit at 95 percent CPU and fail requests while the big one idles at 30 percent. What do you change?',
        options: [
          'Switch to Random, so the requests spread across the servers by chance',
          'Add health checks, so the overloaded small servers are taken out',
          'Use Weighted Round Robin with weights of about 4, 1 and 1',
          'Turn on sticky sessions',
        ],
        answer: 2,
        explanation:
          'Round robin gives every server the same share, so the small machines run out first. Weights make the share proportional to the size of the machine. The cost is that weights are set by hand and go stale when the hardware changes. Random gives the same equal split on average, and health checks only remove dead servers.',
      },
      {
        id: 'lb-6',
        prompt: 'You run six application servers behind a single load balancer VM. The host under that VM fails. What happens?',
        options: [
          'Clients connect to the application servers directly until the balancer is back',
          'The whole service is down - the balancer was the single point of failure',
          'Only one sixth of requests fail, since the servers themselves are healthy',
          'DNS moves traffic to another balancer automatically',
        ],
        answer: 1,
        explanation:
          'Clients only know the address of the balancer, so when it dies nothing reaches the six healthy servers behind it. Putting one balancer in front moved the single point of failure instead of removing it. Nothing moves traffic automatically unless you built a second balancer and a failover path for it.',
      },
      {
        id: 'lb-7',
        prompt: 'You must send /api/reports to a separate pool of servers and everything else to the main pool, and the traffic is HTTPS. Which balancer can do this?',
        options: [
          'A layer 4 balancer, because it is faster and forwards each connection by port',
          'Either one - every balancer can read the URL',
          'DNS round robin with two names, one for reports and one for the rest',
          'A layer 7 balancer that terminates TLS and reads the HTTP path',
        ],
        answer: 3,
        explanation:
          'Routing by path needs the HTTP request, and with HTTPS the path is inside the encryption. A layer 7 balancer terminates TLS and reads method, path and headers. A layer 4 balancer sees only IP addresses and ports, so it is fast and cheap, but it cannot tell /api/reports from any other request.',
      },
      {
        id: 'lb-8',
        prompt: 'An app keeps login sessions in the memory of each server. Behind a round robin balancer, users get logged out at random. Why?',
        options: [
          'Sessions expire faster behind a balancer, which shortens every cookie',
          'Round robin encrypts the session cookie, so other servers cannot read it',
          'The next request may land on a server that never saw the login',
          'The balancer deletes cookies',
        ],
        answer: 2,
        explanation:
          'Round robin moves each request to the next server, and only the server that handled the login has the session in memory. Move sessions to a shared store (Redis, a database) or into a signed token so any server can serve any request. Sticky sessions also hide the problem, but they cost even spread and lose the sessions when that server dies.',
      },
      {
        id: 'lb-9',
        prompt: 'A cache tier is balanced by hash(key) mod N across 4 nodes. You add a fifth node and the cache hit rate collapses for an hour. What happened, and what avoids it next time?',
        options: [
          'Going from mod 4 to mod 5 moved about 80 percent of keys; consistent hashing moves 1/5',
          'The new node was slow to boot, so its share of keys missed',
          'Hashing always gives a low hit rate',
          'The balancer flushed every cache when the pool changed',
        ],
        answer: 0,
        explanation:
          'With mod N a key keeps its node only when key mod 4 equals key mod 5, which is about 1 key in 5, so about 80 percent of keys land on a node that does not have them. Consistent hashing places nodes on a ring, so adding the fifth takes over only about 1/5 of the keys. Nothing was flushed - the keys were simply looked up in the wrong place.',
      },
      {
        id: 'lb-10',
        prompt: 'During a rolling deploy, each server is stopped the moment it is taken out of the balancer. Every step shows a burst of 502 errors. What is missing?',
        options: [
          'A faster health check interval, so the balancer notices the stopped server sooner',
          'Connection draining: let in-flight requests finish before stopping the server',
          'More servers in the pool, so each stopped server has fewer requests to cut off',
          'Switching from round robin to least connections, so busy servers get fewer requests',
        ],
        answer: 1,
        explanation:
          'The requests already on that server were cut off mid-flight. Draining (deregistration delay on AWS) keeps the server alive until its open requests complete, and only then shuts it down. A faster health check or another algorithm changes where new requests go, not what happens to the ones already running.',
      },
      {
        id: 'lb-11',
        prompt: 'A pool under heavy load uses Least Connections. You add a freshly started server with an empty cache, and it is swamped within a second and turns slow. Why?',
        options: [
          'New servers always get a double weight so they fill up quickly and warm their cache',
          'Least Connections ignores new servers for the first minute, then floods them at once',
          'The health check sends it a burst of extra traffic to test it under load before it joins',
          'It has zero open connections, so it wins almost every pick until it catches up',
        ],
        answer: 3,
        explanation:
          'Least Connections sends the next request to the server with the fewest connections, and an empty server has none, so a burst of requests lands on a cold machine. Balancers offer slow start (NGINX Plus, HAProxy), which ramps the weight of a new server up over some seconds.',
      },
      {
        id: 'lb-12',
        prompt: 'In the Lab, 3 servers each take 400 req/sec and traffic is 1,500 req/sec. Latency climbs and requests fail. What brings it back?',
        options: [
          'Switch from Round Robin to Least Connections, so the busiest server gets fewer requests',
          'Switch to Random, which avoids the lockstep of a fixed rotation',
          'Add a fourth server (or raise per-server capacity) so pool capacity passes 1,500 req/sec',
          'Turn off the health checks, which add load to every server',
        ],
        answer: 2,
        explanation:
          'Pool capacity is 3 x 400 = 1,200 req/sec, below the 1,500 arriving. An algorithm only decides who gets each request; it cannot create capacity, so every algorithm still overloads. A fourth server brings the pool to 1,600 and the failures stop.',
      },
    ],
  },
  {
    slug: 'auto-scaling',
    title: 'Auto Scaling',
    tagline: 'Add instances when a metric crosses a threshold, remove them when it drops.',
    category: 'scaling',
    difficulty: 'Intermediate',
    lab: 'auto-scaling',
    keywords: ['elasticity', 'scale out', 'cooldown', 'threshold', 'warm up'],
    what: 'Auto scaling watches a signal (CPU, request rate, queue depth) and changes the number of instances automatically according to rules you define.',
    why: 'Traffic is not flat. Provisioning for peak wastes money for 20 hours a day; provisioning for average fails at peak. Auto scaling follows the curve.',
    how: [
      'Pick a scaling signal that correlates with user-visible pain - queue depth or request rate is often better than CPU.',
      'Define a scale-out threshold, a scale-in threshold and a cooldown between actions.',
      'Account for warm-up: a new instance needs time to boot, pass health checks and join the pool.',
      'Set minimum and maximum instance counts so a bug cannot scale you to bankruptcy.',
      'Scale in slowly and gracefully: drain connections and finish in-flight work before terminating.',
    ],
    when: [
      'Predictable daily peaks or unpredictable spikes.',
      'Batch and queue workers, where depth maps directly to needed capacity.',
    ],
    diagram: `10:42  fleet CPU 78% > 70% threshold (1-minute average)
10:45  3 breaching minutes in a row -> scale out
10:45  launching instance api-4
10:47  api-4 booted, app starting, pool warming
10:48  api-4 health check passed -> joins load balancer pool
       ---- 6 minutes served by api-1..3 alone ----
11:30  CPU 24% < 30% for 15 min -> drain api-4, then terminate`,
    tradeoffs: [
      {
        approach: 'Aggressive thresholds',
        gains: ['Responds quickly to spikes', 'Lower latency during ramp-up'],
        costs: ['Flapping: instances added and removed repeatedly', 'Higher cost from churn'],
      },
      {
        approach: 'Conservative thresholds + long cooldown',
        gains: ['Stable fleet size', 'Predictable cost'],
        costs: ['Slow to react - users feel the spike before capacity arrives'],
      },
      {
        approach: 'Scheduled scaling',
        gains: ['Capacity is warm before a known peak', 'No warm-up gap for predictable load'],
        costs: ['Only as good as the forecast', 'Pays for capacity when the peak does not come'],
      },
      {
        approach: 'Fixed fleet sized for peak',
        gains: ['No warm-up gap at all', 'Nothing to tune'],
        costs: ['Pays for peak capacity around the clock', 'Still fails when traffic exceeds the old peak'],
      },
    ],
    mistakes: [
      'Ignoring instance warm-up time and concluding that scaling "does not work".',
      'Scaling on CPU for an IO-bound service that is slow while barely using the CPU.',
      'Autoscaling the app tier into a database that cannot take more connections.',
      'Setting scale-out and scale-in thresholds close together, so every action undoes the last one (flapping).',
      'Terminating instances without draining them, so every scale-in is a burst of errors.',
    ],
    realWorld: [
      'Queue-depth scaling is the standard pattern for worker pools.',
      'Scheduled scaling handles known events (a sale, a match kickoff) better than reactive rules.',
    ],
    related: ['horizontal-scaling', 'load-balancing', 'health-checks', 'message-queues'],
    quiz: [
      {
        id: 'as-1',
        prompt: 'Instances take 90 seconds to become healthy, and traffic triples in 30 seconds. What actually protects users?',
        options: [
          'A lower scale-out threshold alone, so the launch starts before traffic peaks',
          'Headroom plus a queue or graceful degradation while new capacity warms up',
          'Scaling in faster between surges',
          'A bigger cooldown window, so the scaler does not overreact to the spike',
        ],
        answer: 1,
        explanation:
          'Auto scaling cannot beat physics. If capacity takes 90 seconds to arrive, you need spare headroom, buffering, or load shedding to cover the gap. A lower threshold starts the launch a little earlier, but the instance still needs its 90 seconds.',
      },
      {
        id: 'as-2',
        prompt:
          'In the Lab you set Scale out above 70%, Scale in below 60% and Cooldown 2 s. The fleet keeps adding and removing an instance every few seconds. Why, and what fixes it?',
        options: [
          'The traffic curve is random, so no policy can keep up; nothing can be done',
          'Max instances is too low, so the scaler keeps hitting the cap; raise it',
          'Warm-up is too short, so new instances join the pool before they are ready; make them boot more slowly',
          'Adding one drops CPU under 60%, which removes it again - widen the gap and lengthen the cooldown',
        ],
        answer: 3,
        explanation:
          'Going from 2 to 3 instances at 72% CPU leaves about 48% - below the scale-in line, so the policy undoes its own action. That is flapping: the metric reacts to your scaling. Asymmetric thresholds (out at 70, in at 30) and a cooldown long enough to see the effect stop it. Max instances only caps the fleet; it does not stop the loop.',
      },
      {
        id: 'as-3',
        prompt:
          'Each instance serves at most 200 requests at once from a fixed worker pool. During a slowdown of a downstream API, every worker is busy, requests queue, and CPU sits at 25%. The CPU-based policy never fires. What should the policy watch instead?',
        options: [
          'In-flight requests per instance (or p95 latency) - the thing users feel',
          'Memory usage, since every queued request holds its buffers in memory while it waits',
          'CPU, but with the threshold lowered to 20% so it fires sooner',
          'The number of instances',
        ],
        answer: 0,
        explanation:
          'A service that waits is busy without using the CPU, so CPU is a poor signal for it. Requests in flight per instance measures exactly the saturation that makes users wait. Lowering the CPU threshold to 20% is tempting but makes the fleet scale on noise when traffic is normal.',
      },
      {
        id: 'as-4',
        prompt:
          'Every weekday at 09:00 traffic triples in ten minutes, and every morning the reactive policy produces a few minutes of errors. What is the lowest-risk change?',
        options: [
          'Lower the scale-out threshold to 30% so the policy fires as soon as traffic starts rising',
          'Remove the cooldown so the policy can add instances back to back',
          'Schedule a scale-out at 08:45 and keep the reactive rules as a safety net',
          'Raise the maximum instance count',
        ],
        answer: 2,
        explanation:
          'A reactive policy is always late for a predictable event: it waits for the metric, then for warm-up. Scheduling capacity before a known peak removes the gap entirely. A 30% threshold fires all day long, and a higher maximum does not help an instance that is still booting.',
      },
      {
        id: 'as-5',
        prompt:
          'A pool of workers consumes a message queue. Which signal lets the auto scaler add the right number of workers?',
        options: [
          'Average CPU of the workers, since busy workers mean the queue is growing faster than they clear it',
          'Total number of messages in the queue, since that is exactly the work still waiting to be done',
          'Number of messages published per minute, which shows the demand before it piles up in the queue',
          'Backlog per worker: queued messages divided by workers, against a target per worker',
        ],
        answer: 3,
        explanation:
          'Backlog per worker says directly how far behind each worker is, and it goes down in proportion as workers are added - which is what a target-tracking policy needs. The raw queue length is the tempting choice, but it does not change in proportion to the fleet size, so the policy cannot work out how many workers to add (AWS documents the same point for SQS).',
      },
      {
        id: 'as-6',
        prompt:
          'A client bug retries every failed request 10 times with no backoff. The service scales out on request rate and has no maximum instance count. What happens overnight?',
        options: [
          'The fleet scales out to serve the retries and the bill grows - cap it, and fix client backoff',
          'Nothing - auto scaling ignores retries',
          'The fleet scales in, because each failed request finishes faster and uses less CPU',
          'The load balancer blocks the client automatically once it spots the repeated requests',
        ],
        answer: 0,
        explanation:
          'To an auto scaler a retry storm looks like real demand, so without a ceiling it buys capacity for a bug. The maximum is part of the design: it turns a runaway bill into a bounded one. The app tier also is not the only thing the retries hit - the database behind it does not scale with the fleet.',
      },
      {
        id: 'as-7',
        prompt:
          'Every scale-in event causes a short burst of 502 errors. Traffic is low at the time. What is the likely cause?',
        options: [
          'Scale-in thresholds are too high, so too many instances are removed at once',
          'Instances are terminated mid-request; drain them before terminating',
          'The remaining instances cannot handle the load',
          'The health check interval is too long to notice the removed instance',
        ],
        answer: 1,
        explanation:
          'Traffic is low, so the survivors have plenty of capacity - the errors come from the instance being removed. Taking it out of the load balancer first and waiting for its in-flight requests to finish (connection draining, a deregistration delay) makes scale-in invisible to users.',
      },
      {
        id: 'as-8',
        prompt:
          'In the Lab, traffic ramps up over about 12 seconds and each new instance needs 4 seconds to warm up. You set Cooldown to 30 s. What do you see during the plateau?',
        options: [
          'The fleet grows smoothly and keeps up, since 4 s of warm-up is short',
          'The fleet scales out several times during the ramp, then flaps on the plateau as the cooldown resets',
          'One instance is added, then the 30 s cooldown blocks the rest, so requests fail through the plateau',
          'No instances are ever added',
        ],
        answer: 2,
        explanation:
          'A cooldown is a minimum gap between scaling actions. When it is longer than the whole ramp, the policy gets one action per surge, and the Traffic vs capacity chart shows the gap as errors. A long cooldown stops flapping but slows the reaction - the trade-off between the two threshold styles in the Trade-offs tab.',
      },
      {
        id: 'as-9',
        prompt:
          'A service needs to go from 4 to 8 instances every morning. The policy adds 1 instance per action with a 5-minute cooldown, so reaching 8 takes about 20 minutes and the rush is over by then. Which change removes the most lag?',
        options: [
          'Raise the threshold from 80% to 90%, so each action waits for real demand',
          'Lengthen the cooldown to 10 minutes',
          'Scale on memory instead of CPU, which rises earlier in the morning',
          'Add capacity in larger steps, such as 50% of the fleet per action',
        ],
        answer: 3,
        explanation:
          'With one instance per action, the cooldown multiplies: four actions x 5 minutes. Adding a percentage of the fleet reaches the target in two actions. A higher threshold and a longer cooldown both make the policy later still; memory does not track this load at all.',
      },
      {
        id: 'as-10',
        prompt:
          'To save money, a team sets its target-tracking policy to keep average CPU at 90% instead of 60%. Why do traffic spikes now hurt users?',
        options: [
          'At 90% there is no headroom to absorb a surge while new instances take minutes to boot',
          'The cloud provider throttles instances that stay above 80% CPU for long periods',
          'Target tracking does not work above 70%, so the policy stops adding instances',
          'A higher target makes each new instance boot more slowly, as it starts under heavier load',
        ],
        answer: 0,
        explanation:
          'Headroom is what covers the minutes between a spike and new capacity. At 60% the existing fleet can take about 1.6x the load before it saturates, while instances boot; at 90% it can take almost nothing. AWS describes the target the same way: as high as possible with a buffer for unexpected increases. Boot time does not depend on the target.',
      },
      {
        id: 'as-11',
        prompt:
          'Nights have almost no traffic, so the minimum instance count is set to 0. The first user each morning waits about 3 minutes, and some requests time out. What is the fix?',
        options: [
          'Lower the scale-out threshold so the first request triggers a launch sooner',
          'Keep a minimum of warm instances, such as 2 in two zones',
          'Shorten the health check interval so new instances join the pool faster',
          'Raise the maximum instance count',
        ],
        answer: 1,
        explanation:
          'With zero instances every request must wait for a full boot and warm-up. The minimum is part of the design like the maximum: 2 instances in 2 zones also means one zone failure does not leave the service at zero. A lower threshold cannot help when there is nothing running to measure.',
      },
    ],
  },
];
