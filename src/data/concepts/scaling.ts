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
          'Nothing - the load balancer syncs memory between servers',
          'Users are logged out intermittently when their request lands on a different server',
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
          'They are logged out and must log in again on another server',
          'Their requests wait in the load balancer until Server 2 restarts',
          'Nothing they notice: the next request goes to Server 1 or 3, which loads the same session from Redis',
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
          'Every request fails, because every server needs Redis to find the session - so the store needs its own replicas and failover',
          'Only a third of requests fail, the ones whose session was on the dead Redis node',
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
          'The change applies everywhere on the next request, because sessions are in Redis',
          'The user is logged out on every server',
          'The permission disappears after the Redis TTL expires',
          'Servers that loaded the old map keep granting the permission until they restart, so the answer depends on which server the request lands on',
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
          'Every photo uploaded before the deploy is gone, because it lived on disks that were thrown away',
          'Photos load slowly for a while as the new instances copy them',
          'Nothing - a rolling deploy keeps the old disks',
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
          'Nothing - sticky sessions make the service stateless',
          'Every request now pays a network hop to find its session',
          'Users are pinned to whichever server they first reached, so the lab shows 33% success',
          'A crash or deploy of one server logs out every user pinned to it, and load stays uneven because users cannot be moved',
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
          'Yes, as long as the cache is a pure optimisation: losing it only costs a rebuild, and 60 seconds of possible staleness is acceptable',
          'No - any data in process memory makes a service stateful',
          'Only if every instance holds the same copy',
          'Only if the cache is written to local disk as well',
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
          'Signed JWTs with a 24-hour lifetime',
          'Sticky sessions on the load balancer',
          'A shared session store: delete one key and every server rejects the session on the next request',
          'Sessions in each server memory, cleared by a broadcast',
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
          'Nothing - instance 2 can push down any open WebSocket',
          'A pub/sub channel (for example Redis pub/sub) so instance 2 can hand the message to the instance holding the connection of X',
          'Sticky sessions, so every sender lands on instance 1',
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
          'A temp file created and deleted inside one request',
          'Config read from environment variables at start-up',
          'An in-memory LRU cache of database rows, refilled on a miss',
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
          'Every user is logged out, because the load balancer resets all sticky routes',
          'A and D are re-pinned to another server, find no session there and must log in again; the other users notice nothing',
          'Nothing - the load balancer moves A and D sessions to Server 2',
          'A and D requests fail until Server 1 restarts',
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
          'Carts are saved to disk automatically before each restart',
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
          'The load balancer needs a restart to see the new server',
          'The new server must first copy the sessions of the hot one',
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
          'Nothing - the replica takes over with zero impact',
          'All data since the last nightly backup is lost',
          'Reads fail but writes continue',
          'Writes are rejected for the failover window - detect, promote, redirect, often tens of seconds - then resume on the new primary',
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
          'Yes - promote a replica, it still has the column',
          'No - replication copied the drop to both replicas within seconds; you need a backup or point-in-time recovery',
          'Yes, if you stop replication within an hour',
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
          'The app keeps sending writes to the old, dead primary until it is restarted or reconfigured',
          'The app finds the new primary automatically',
          'The replica takes over the old IP address in every case',
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
          'It roughly quadruples',
          'It grows by the capacity of one replica',
          'It does not grow: every write still goes to the one primary, and the replicas must apply every write too',
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
          'Nothing - Kubernetes keeps pod data across restarts',
          'The pod comes back with the same name and the same data',
          'The data moves to another pod',
          'The new pod gets a new name and an empty disk, so that node has lost its data and identity',
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
          'The replica, because databases get priority',
          'The app instance in about half a minute; the replica needs about 3 hours to copy 2 TB before it can serve, and the cluster has less redundancy all that time',
          'Both in about 30 seconds',
          'Neither comes back without a manual rebuild',
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
          'SQLite is too slow for production',
          'Nothing - small state is harmless',
          'Twelve places to back up, replicate and fail over, and data that vanishes when an instance disk is replaced',
          'The services can no longer be deployed',
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
          'Nothing - WebSockets survive a server restart',
          'All 50,000 clients disconnect, so drain the node gradually and have clients reconnect with jittered backoff to other nodes',
          'The load balancer moves the open connections to another node',
          'Only idle connections are lost',
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
