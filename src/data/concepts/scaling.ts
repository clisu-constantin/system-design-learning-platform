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
