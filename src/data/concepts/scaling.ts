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
          'Larger machines fail more often',
          'There is still exactly one machine - if it dies, the service is down',
          'CPU has no effect on availability',
          'The load balancer was removed',
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
          'It halves to about 500 ms, because capacity doubled',
          'It stays near 1 s - only the error rate changes',
          'It falls to tens of milliseconds, because utilization drops from over 100% to about 55%, below the point where requests queue',
          'It rises for good, because a bigger machine has more cores to coordinate',
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
          'Almost no change - the time is spent waiting on the database, not computing on this machine',
          'Latency drops to about 225 ms, because there are 4 times the cores',
          'Latency drops a little and the CPU rises to 100%',
          'The lock disappears, because more cores can hold more locks',
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
          'Move to a 64-core machine',
          'Move to a machine with more RAM',
          'Add a second identical server with the same code',
          'Find and fix the single-threaded path - a global lock, one busy event loop, or one serial query',
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
          'A bug in the new machine - teams test the instance type before using it',
          'The new machine is warming its cache - teams pre-load the cache',
          'The resize restarts the only server - teams resize a standby first and fail over to it, or resize in a maintenance window',
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
          'Stay vertical forever - Bare metal serves 8,000 req/sec',
          'Scale out today, because vertical scaling is always the wrong choice',
          'Pick Bare metal now so you never need to resize again',
          'Each step up costs more per request served and there is a top rung - scale up now if it buys time, but plan the horizontal path',
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
          'Scale the database up to 8 or 16 vCPU and measure again - it costs little and changes no code, while sharding adds complexity you keep forever',
          'Shard now, because the database will be the bottleneck sooner or later',
          'Move to a NoSQL database that shards automatically',
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
          'Move to an even larger VM with a better SLA',
          'A single machine of any size cannot promise that; run at least two instances, for example in two zones, behind a load balancer',
          'Add more RAM so the VM crashes less often',
          'Turn on automatic restarts so downtime does not count',
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
          'Nothing - scale only at 100%',
          'CPU above 80% damages the hardware',
          'Past about 60-70% utilisation requests start to queue and latency climbs steeply, so the last 15% is not usable headroom for a spike',
          'The monitoring must be wrong, since latency cannot rise before 100%',
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
          'Move to 64 vCPU',
          'Add a second API server',
          'Move to a faster disk on the API server',
          'Fix the query, for example with an index - the 550 ms is database time no API server size can shrink',
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
          'The load balancer algorithm is wrong',
          'The bottleneck moved to a shared dependency such as the database',
          'Six servers is too many',
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
          'Errors and latency both return to normal',
          'Nothing changes until the load balancer is restarted',
          'Errors drop to zero, but each server takes 450 req/sec at about 85% CPU, past the knee, so latency stays high - a third server brings it to about 56%',
          'Errors halve to about 22%',
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
          'Sessions live in the memory of the server that created them; move them to a shared store such as Redis, or into a signed token',
          'Round robin is broken; switch to least connections',
          'Turn on sticky sessions so each user always reaches the same server',
          'The servers have different clocks; sync them with NTP',
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
          'Every request fails until Server 1 is back',
          'A quarter of all requests fail, the ones that were meant for Server 1',
          'Nothing at all - the load balancer creates a replacement at once',
          'The health check takes Server 1 out of the pool; the other 3 take 400 each at about 75% CPU, so no errors, but latency rises',
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
          'The other 3 must carry 120% of their capacity: queues fill and requests fail until capacity returns',
          'The other 3 go to about 100% and everything keeps working',
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
          'The database is out of disk; add storage',
          'Connections multiply with instances - 20 x 50 is 1,000, far above the default max_connections of 100; shrink each pool or put a pooler such as PgBouncer in front',
          'Too many instances make the load balancer drop connections; add a second load balancer',
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
          'The email provider retried the send',
          'The load balancer duplicated the request',
          'The scheduled job runs inside every app instance; move it to one scheduler or guard it with a distributed lock',
          'Three servers make the clock run three times as fast',
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
          'Turn on sticky sessions',
          'Increase the upload size limit',
          'Add a CDN in front of the servers',
          'Store uploads in shared object storage (S3-compatible) instead of the local disk of the server that received them',
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
          'A rolling deploy: take one server out of the pool, update it, put it back, repeat - the other 3 serve traffic meanwhile, if they have the headroom',
          'Deploying to all 4 at the same moment so they switch in sync',
          'Skipping the restart, because the load balancer hot-swaps the code',
          'Nothing - every deploy needs downtime',
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
          'Add more app servers',
          'Take load off the database: cache hot reads, add read replicas, or shard',
          'Switch the load balancer to least connections',
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
          'Rate limits only work with one server',
          'The load balancer adds its own allowance',
          'Each instance only counts the requests it sees, so the real limit became 5 x 100; use a shared counter (for example in Redis)',
          'The user found a bug in the limiter',
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
          'Nothing - the load balancer syncs memory between servers',
          'Users are logged out intermittently when their request lands on a different server',
          'The database becomes the bottleneck',
          'DNS resolution fails',
        ],
        answer: 1,
        explanation:
          'Round robin sends consecutive requests to different servers. Only the server that created the session knows about it, so roughly two out of three requests find no session.',
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
    keywords: ['state', 'sticky', 'websocket', 'database'],
    what: 'A stateful component keeps data that must survive between requests and cannot simply be recreated: databases, caches, message brokers, and services holding long-lived connections.',
    why: 'Every system has state somewhere. The design question is not "how do I avoid state?" but "where do I concentrate it, and how do I make that part reliable?".',
    how: [
      'Push state down into a small number of purpose-built stateful systems.',
      'Give those systems replication, backups and a tested failover procedure.',
      'For connection-oriented services (WebSockets), route by connection and plan for reconnects.',
      'Use consistent hashing or partitioning when one stateful node is not enough.',
    ],
    when: ['Databases, caches, brokers, real-time gateways, stream processors.'],
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
    ],
    mistakes: [
      'Spreading small pieces of state across every service, so there is no single place to back up.',
      'Treating a stateful component like a stateless one during deploys and losing data.',
    ],
    related: ['stateless-applications', 'replication', 'sharding', 'websockets'],
  },
  {
    slug: 'load-balancing',
    title: 'Load Balancing',
    tagline: 'One address in front, many healthy servers behind.',
    category: 'scaling',
    difficulty: 'Beginner',
    lab: 'load-balancer',
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
    ],
    realWorld: [
      'Layer 4 balancers (AWS NLB, IPVS) forward TCP; layer 7 balancers (NGINX, HAProxy, ALB) understand HTTP and can route by path or header.',
      'DNS load balancing spreads traffic between regions, but caches make it slow to react to failure.',
    ],
    related: ['horizontal-scaling', 'health-checks', 'reverse-proxy', 'auto-scaling'],
    quiz: [
      {
        id: 'lb-1',
        prompt: 'Server 2 starts returning errors instantly while the other two are healthy. With round robin and no health checks, what does the user see?',
        options: [
          'Nothing - the balancer detects errors automatically',
          'About one third of requests fail, and the failing server gets more traffic per second because it responds fastest',
          'All traffic moves to server 2',
          'The load balancer restarts server 2',
        ],
        answer: 1,
        explanation:
          'Without health checks a broken backend stays in rotation. Failing fast makes it look "available", which is why error-rate-aware checks matter.',
      },
      {
        id: 'lb-2',
        prompt: 'Which algorithm best handles backends whose request durations vary a lot?',
        options: ['Round robin', 'Random', 'Least connections', 'IP hash'],
        answer: 2,
        explanation:
          'Least connections tracks in-flight work, so a server stuck on slow requests stops receiving new ones.',
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
          'A lower scale-out threshold alone',
          'Headroom plus a queue or graceful degradation while new capacity warms up',
          'Scaling in faster',
          'A bigger cooldown window',
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
          'The traffic curve is random; nothing can be done',
          'Max instances is too low; raise it',
          'Warm-up is too short; make instances boot more slowly',
          'Adding one instance drops CPU under 60%, which removes it, which pushes CPU over 70% again - widen the gap between the thresholds and lengthen the cooldown',
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
          'Memory usage',
          'CPU, but with the threshold lowered to 20%',
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
          'Lower the scale-out threshold to 30%',
          'Remove the cooldown',
          'Schedule a scale-out at 08:45 by the clock and keep the reactive rules as the safety net',
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
          'Average CPU of the workers',
          'Total number of messages in the queue',
          'Number of messages published per minute',
          'Backlog per worker: messages in the queue divided by the number of workers, compared with what one worker can clear in your target time',
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
          'The fleet scales out to serve the retries, the bill grows with it, and the shared database may still fall over - a maximum caps the damage, and backoff on the client is the real fix',
          'Nothing - auto scaling ignores retries',
          'The fleet scales in, because each request fails faster',
          'The load balancer blocks the client automatically',
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
          'Scale-in thresholds are too high',
          'Instances are terminated with requests still in flight; deregister them and drain connections before terminating',
          'The remaining instances cannot handle the load',
          'The health check interval is too long',
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
          'The fleet grows smoothly and keeps up with traffic',
          'The fleet scales out several times during the ramp, then flaps',
          'One instance is added, then the cooldown blocks the next one for 30 s, so capacity lags far behind traffic and requests fail through the plateau',
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
          'Raise the threshold from 80% to 90%',
          'Lengthen the cooldown to 10 minutes',
          'Scale on memory instead of CPU',
          'Add capacity in larger steps, for example 50% of the fleet per action, so 4 becomes 6 becomes 9',
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
          'At 90% there is no headroom: latency is already past the queueing knee and new instances take minutes to arrive, so nothing absorbs the first minutes of a surge',
          'The cloud provider throttles instances above 80%',
          'Target tracking does not work above 70%',
          'A higher target makes instances boot more slowly',
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
          'Lower the scale-out threshold',
          'Keep a minimum of warm instances - for example 2, in two zones - so the first requests always find capacity',
          'Shorten the health check interval',
          'Raise the maximum instance count',
        ],
        answer: 1,
        explanation:
          'With zero instances every request must wait for a full boot and warm-up. The minimum is part of the design like the maximum: 2 instances in 2 zones also means one zone failure does not leave the service at zero. A lower threshold cannot help when there is nothing running to measure.',
      },
    ],
  },
];
