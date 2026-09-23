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
    diagram: `BEFORE                     AFTER

  2 vCPU                     8 vCPU
  4 GB RAM                  32 GB RAM
  ~500 req/sec             ~2000 req/sec

  CPU  ##########  98%      CPU  ####      38%
  p95  820 ms               p95  95 ms
  errors 8%                 errors 0%`,
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
        gains: ['Near-linear headroom', 'Redundancy comes for free'],
        costs: ['Requires stateless app or shared state', 'Load balancing, health checks, deployments across N nodes'],
      },
    ],
    mistakes: [
      'Scaling up a machine when the real bottleneck is a single-threaded database query.',
      'Assuming 2x the CPU means 2x the throughput - locks and IO rarely scale linearly.',
      'Staying vertical so long that there is no redundancy when the machine fails.',
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
          'Vertical scaling addresses capacity, not redundancy. A single instance remains a single point of failure no matter how large it is.',
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

BEFORE                AFTER
1 server              3 servers
CPU 100%              CPU ~38% each
p95 800 ms            p95 120 ms
errors 8%             errors 0%`,
    advantages: [
      'Capacity grows roughly linearly with instance count.',
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
    ],
    mistakes: [
      'Adding app servers while the database is the actual bottleneck - you just push more load onto it.',
      'Keeping sessions in local memory, which makes every added server break some users.',
      'Forgetting connection pooling: 10 servers x 100 connections can exhaust a database.',
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
          'Idle app servers with slow responses means they are waiting on something shared. Scaling a tier only helps until the next constraint - usually the datastore - becomes the limit.',
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
          'About one request in three fails, and keeps failing until someone takes Server 2 out of the pool',
          'Every request fails, because the pool is broken',
          'All traffic moves to Server 2, because it answers fastest',
        ],
        answer: 1,
        explanation:
          'Round robin hands requests out in turn and knows nothing about health, so Server 2 keeps its third and every one of those requests fails. The tempting "it notices on its own" needs a health check - active probes, or passive checks such as the max_fails setting of NGINX - and this pool has none. Kill a server in the Lab with Health checks off to see the one-in-three failures that never stop.',
      },
      {
        id: 'lb-2',
        prompt: 'Most requests take 20 ms, but about 2 percent are 3-second report queries. With round robin, one server is stuck with several reports and its p95 climbs to 2 s while the others have room. What change on the balancer helps first, without new hardware?',
        options: [
          'Switch to Random, so the reports spread out by chance',
          'Give the stuck server a lower weight in Weighted Round Robin',
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
          'Round Robin gives each server 250 req/sec, but the slow Server 1 can absorb only 200, so it saturates while the others still have room',
          'Pool capacity is wrong: the Lab counts Server 1 twice',
          'Round Robin sends most of the traffic to Server 1 because it is listed first',
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
          'Least Connections retries each failed request three times',
          'The two live servers overload because they now carry all the traffic',
          'Killing a server disables the load balancer for a few seconds',
          'A dead server that refuses connections holds zero open connections, so Least Connections picks it for almost every request',
        ],
        answer: 3,
        explanation:
          'Least Connections chooses the server with the fewest in-flight requests. A crashed server refuses instantly, so it never holds a connection and always looks the least busy: it becomes a black hole. The live servers are not overloaded - the traffic simply never reaches them. Only a health check that ejects the dead server ends it.',
      },
      {
        id: 'lb-5',
        prompt: 'Your pool has one 16-core server and two 4-core servers behind round robin. The two small ones sit at 95 percent CPU and fail requests while the big one idles at 30 percent. What do you change?',
        options: [
          'Switch to Random',
          'Add health checks',
          'Use Weighted Round Robin with weights of about 4, 1 and 1, so each server receives a share that matches its size',
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
          'The whole service is down: the balancer was the single point of failure. Run it as a redundant pair or a managed multi-zone balancer',
          'Only one sixth of requests fail',
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
          'A layer 4 balancer, because it is faster',
          'Either one - every balancer can read the URL',
          'DNS round robin with two names',
          'A layer 7 balancer that terminates TLS, because only it decrypts the request and reads the HTTP path',
        ],
        answer: 3,
        explanation:
          'Routing by path needs the HTTP request, and with HTTPS the path is inside the encryption. A layer 7 balancer terminates TLS and reads method, path and headers. A layer 4 balancer sees only IP addresses and ports, so it is fast and cheap, but it cannot tell /api/reports from any other request.',
      },
      {
        id: 'lb-8',
        prompt: 'An app keeps login sessions in the memory of each server. Behind a round robin balancer, users get logged out at random. Why?',
        options: [
          'Sessions expire faster behind a balancer',
          'Round robin encrypts the session cookie',
          'The next request can land on a server that never saw the login, so the session is not there',
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
          'Changing N from 4 to 5 moved about 80 percent of keys to a different node, so they all missed. Consistent hashing moves only about one fifth',
          'The new node was slow to boot',
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
          'A faster health check interval',
          'Connection draining: stop sending new requests, let the in-flight ones finish, then stop the server',
          'More servers in the pool',
          'Switching from round robin to least connections',
        ],
        answer: 1,
        explanation:
          'The requests already on that server were cut off mid-flight. Draining (deregistration delay on AWS) keeps the server alive until its open requests complete, and only then shuts it down. A faster health check or another algorithm changes where new requests go, not what happens to the ones already running.',
      },
      {
        id: 'lb-11',
        prompt: 'A pool under heavy load uses Least Connections. You add a freshly started server with an empty cache, and it is swamped within a second and turns slow. Why?',
        options: [
          'New servers always get a double weight',
          'Least Connections ignores new servers for the first minute',
          'The health check sends it extra traffic',
          'It has zero open connections, so it wins almost every pick until it catches up - a slow start ramp avoids that',
        ],
        answer: 3,
        explanation:
          'Least Connections sends the next request to the server with the fewest connections, and an empty server has none, so a burst of requests lands on a cold machine. Balancers offer slow start (NGINX Plus, HAProxy), which ramps the weight of a new server up over some seconds.',
      },
      {
        id: 'lb-12',
        prompt: 'In the Lab, 3 servers each take 400 req/sec and traffic is 1,500 req/sec. Latency climbs and requests fail. What brings it back?',
        options: [
          'Switch from Round Robin to Least Connections',
          'Switch to Random',
          'Add a fourth server (or raise per-server capacity), so pool capacity passes 1,500 req/sec',
          'Turn off the health checks',
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
    ],
    when: [
      'Predictable daily peaks or unpredictable spikes.',
      'Batch and queue workers, where depth maps directly to needed capacity.',
    ],
    diagram: `10:42:03  CPU 78% > 70% threshold
10:42:05  Launching instance api-4
10:42:09  api-4 health check passed
10:42:09  api-4 added to load balancer pool
10:49:30  CPU 24% < 30% for 5 min -> terminating api-4`,
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
    ],
    mistakes: [
      'Ignoring instance warm-up time and concluding that scaling "does not work".',
      'Scaling on CPU for an IO-bound service that is slow while barely using the CPU.',
      'Autoscaling the app tier into a database that cannot take more connections.',
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
          'Auto scaling cannot beat physics. If capacity takes 90 seconds to arrive, you need spare headroom, buffering, or load shedding to cover the gap.',
      },
    ],
  },
];
