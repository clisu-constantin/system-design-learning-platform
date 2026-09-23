import type { DepthMap } from './types';

export const scalingDepth: DepthMap = {
  'vertical-scaling': {
    analogy: {
      title: 'Hiring a faster chef',
      body:
        'Your one chef cannot keep up with orders. The simplest fix is to replace them with a faster, more experienced chef and give them a bigger stove. Nothing else in the restaurant changes - same kitchen, same process, same recipes. It works beautifully until you reach the fastest chef that exists, and it still means the restaurant closes the day that chef is ill.',
    },
    deepDive: [
      {
        heading: 'Why this is almost always the right first move',
        paragraphs: [
          'Engineers love distributed systems, so vertical scaling gets dismissed as unserious. It should not be. Changing an instance type takes minutes, costs a few hundred euro a month, and requires zero changes to your code, your data model or your deployment process. Building the horizontal path costs weeks of engineering time and permanently raises the complexity of everything you do afterwards.',
          'The arithmetic is usually decisive. A single modern server can have 128 cores and a terabyte of RAM. That machine will serve tens of thousands of simple requests per second and hold the entire working set of most companies in memory. If your estimate says you need 3,000 requests per second, you do not have a distributed systems problem yet, you have a shopping problem.',
          'The point is not that vertical scaling is better. It is that it buys time at a known, small price, and time is what lets you learn what your real access patterns are before you commit to a partitioning scheme you cannot easily change.',
        ],
        bullets: [
          'No code changes, no new failure modes, no consensus, no replication lag.',
          'One process means one log stream, one profiler, one debugger - incidents stay understandable.',
          'Reversible: if the bigger instance does not help, you learned the bottleneck is elsewhere for the price of one hour.',
        ],
      },
      {
        heading: 'Measure which resource saturates, because the bottleneck moves',
        paragraphs: [
          'Scaling up only works if you enlarge the resource that is actually exhausted. A machine at 98 percent CPU and a machine at 98 percent disk IO look identically unhealthy from the outside, and a bigger CPU fixes exactly one of them. Before resizing, check the four suspects: CPU, memory, disk IO and network.',
          'A frequent trap is a single-threaded bottleneck. If one Postgres query holds a lock, or your application has a global mutex, adding cores changes nothing at all - those extra cores sit idle while everything queues behind the one thread that matters. That is why measuring first is not bureaucracy; it is the difference between a fix and an expensive no-op.',
          'Expect the bottleneck to move rather than vanish. Relieve CPU and you often discover that disk IO was hiding right behind it. This is normal and it is informative: each round of resizing reveals the next constraint, and after two or three rounds you know exactly which part of the system needs architectural work.',
        ],
        code: {
          caption: 'Which number tells you what',
          body: `symptom                      likely bottleneck   bigger instance helps?
CPU pinned at 95-100%        compute              yes, if work is parallel
CPU low, latency high        IO wait or locks     usually no
memory full, heavy swapping  RAM                  yes
disk queue depth growing     disk IO              yes (faster/NVMe)
network at line rate         bandwidth            yes (bigger NIC tier)
one core busy, others idle   single-threaded      NO - fix the code/query`,
        },
      },
      {
        heading: 'The two ceilings: hardware and availability',
        paragraphs: [
          'The hardware ceiling is the obvious one. There is a largest instance type, and its price does not grow linearly - the top of the range typically costs far more per unit of capacity than the middle. Long before you reach the physical limit, you reach the point where one more step up is bad value.',
          'The availability ceiling is the one that hurts more, and it is invisible in performance graphs. One machine is one machine no matter how large. A kernel panic, a failed disk, a bad deploy or a routine reboot takes the whole service down. You cannot reach three nines of availability on a single instance, because a single unplanned restart plus the time to notice it already blows the budget.',
          'The practical policy most teams land on: scale up freely until you are comfortable, but put a second machine and a load balancer in place as soon as downtime starts costing real money - not because you need the capacity, but because you need the redundancy.',
        ],
      },
    ],
    examples: [
      {
        title: 'When doubling the CPU changes nothing',
        setup:
          'An API is at 98 percent CPU with p95 latency of 800 ms. The team upgrades from 4 vCPU to 16 vCPU and expects a 4x improvement.',
        walkthrough: [
          'After the upgrade, CPU shows 30 percent and p95 latency is 620 ms. Better, but nowhere near 4x.',
          'Profiling shows each request spends 550 ms waiting on one database query and 250 ms in application code.',
          'The 16 cores only ever helped the 250 ms of application code, which dropped to about 70 ms. The 550 ms of database wait is untouched because it is not CPU work on this machine.',
          'Amdahl in plain terms: you can only speed up the part you actually made faster. 550 ms of the 800 ms was outside that part.',
          'The real fix is an index on the query, which takes the 550 ms to 12 ms - a bigger win than any instance size, for the price of one migration.',
        ],
        result:
          'Total p95 after the index, on the original 4 vCPU machine: about 260 ms. The expensive machine was solving a problem the system did not have. Measure the bottleneck before you buy hardware.',
      },
    ],
    jargon: [
      { term: 'Scale up', plain: 'Another name for vertical scaling: same number of machines, bigger machines.' },
      { term: 'Instance type', plain: 'The cloud provider name for a machine size, e.g. 4 vCPU / 16 GB. Changing it is usually a reboot.' },
      { term: 'Single point of failure', plain: 'A component whose loss takes down the service. One big machine is the classic example.' },
      { term: 'IO wait', plain: 'Time the CPU spends doing nothing while it waits for disk or network. More cores does not help it.' },
      { term: 'Headroom', plain: 'Spare capacity above your normal load. Running at 90 percent leaves nothing for a traffic spike.' },
    ],
    remember: [
      'Scaling up is the cheapest, fastest first move - do not skip it out of pride.',
      'Enlarge the resource that is actually saturated, or you pay for nothing.',
      'The bottleneck usually moves rather than disappears; that is useful information.',
      'A bigger machine buys capacity, never availability. One machine is still one machine.',
      'Cost per unit of capacity gets worse at the top of the instance range.',
    ],
  },

  'horizontal-scaling': {
    analogy: {
      title: 'Opening more checkout lanes',
      body:
        'A supermarket with one till cannot serve a Saturday crowd, so it opens ten identical lanes. Any customer can use any lane, which is exactly what makes it work - if lane 4 needed to know what lane 2 did earlier, the whole trick collapses. If a till breaks, you lose a tenth of the throughput, not the shop. That interchangeability is the entire idea, and it is why statelessness comes first.',
    },
    deepDive: [
      {
        heading: 'Interchangeable instances are the precondition, not a detail',
        paragraphs: [
          'Horizontal scaling is trivially easy to describe and easy to get wrong, because the hard requirement is hidden: any instance must be able to serve any request. The moment one server knows something the others do not - a session in local memory, an uploaded file on local disk, an in-process counter, a scheduled job that must run once - you have built a cluster that works only until the load balancer sends a user somewhere new.',
          'The symptoms of getting this wrong are maddening precisely because they are intermittent. Users are logged out at random, an upload succeeds and then 404s, a cron job runs three times. Each of these is the same bug: state that lives on one node when it should live somewhere shared.',
          'So the checklist before adding servers is short and unforgiving: sessions in a shared store or a signed token, uploads in object storage, caches either shared or accepted as per-node, scheduled work coordinated by a lock or a single scheduler.',
        ],
        bullets: [
          'Session in local memory -> move to Redis or a signed cookie/JWT.',
          'Uploaded files on local disk -> move to S3-compatible object storage.',
          'In-memory rate limit counters -> move to a shared counter, or accept N times the limit.',
          'Cron inside the app process -> move to one scheduler, or guard with a distributed lock.',
          'WebSocket connections -> they are inherently sticky; use a pub/sub layer to reach a user on another node.',
        ],
      },
      {
        heading: 'Scaling is linear only until you hit the shared dependency',
        paragraphs: [
          'Adding app servers multiplies the capacity of the app tier and nothing else. Every one of those servers talks to the same database, the same cache, the same third-party API. Three servers send three times the queries to a database that has not changed size, so the usual outcome of scaling out is that the database becomes the bottleneck within a week.',
          'Connection pooling makes this concrete and painful. If each instance keeps a pool of 100 connections and you run 20 instances, you are asking the database for 2,000 connections. Postgres allocates real memory per connection and typically falls over well before that; the fix is a smaller pool per instance or a pooler like PgBouncer in front.',
          'The honest mental model is that horizontal scaling moves the bottleneck downstream. That is still progress - the app tier is the easy tier to scale - but plan the next step: read replicas, caching, or partitioning for the data tier.',
        ],
        code: {
          caption: 'What actually happens when you go from 1 to 10 app servers',
          body: `                 1 server      10 servers
app capacity     500 rps       ~5,000 rps     (near linear)
db connections   100           1,000          (linear - and a problem)
db queries/sec   500           5,000          (unchanged capacity!)
cache hit rate   good          worse per-node if caches are local
deploy time      1 unit        rolling, N units
failure impact   100%          10%`,
        },
      },
      {
        heading: 'What you gain besides capacity',
        paragraphs: [
          'Capacity is the reason people start, but redundancy is often the bigger prize. With five instances, losing one costs 20 percent of capacity instead of 100 percent of the service, and if you keep 25 percent headroom the user never notices at all.',
          'Rolling deploys become possible for the same reason: you can take instances out of the pool one at a time, update them and put them back, with the load balancer routing around the gap. That is how zero-downtime deployment works, and it is impossible with a single machine.',
          'The cost side is real: N machines to monitor, logs spread across N sources, configuration drift, and a load balancer that now needs its own health checks and its own redundancy. Distributed does not mean harder in theory; it means more things to operate in practice.',
        ],
      },
    ],
    examples: [
      {
        title: 'Three servers, one broken login',
        setup:
          'A team scales from one app server to three behind a round-robin load balancer. Immediately, users report being logged out roughly two times out of three.',
        walkthrough: [
          'Login request goes to server A, which creates a session in its local memory and returns a session id cookie.',
          'The next request is round-robined to server B. Server B looks up that session id in its own memory, finds nothing, and treats the user as logged out.',
          'One request in three lands back on server A and works, which is why the bug looks random rather than total.',
          'Fix option 1: move sessions to Redis. All three servers read the same store, any instance can serve any user, and the cluster stays truly stateless.',
          'Fix option 2: put the session data in a signed token (JWT) in the cookie. No shared store at all, but revoking a session before expiry becomes hard.',
          'Fix option 3 (the trap): enable sticky sessions on the load balancer. It makes the symptom go away, but now losing a server logs out its users and traffic can no longer be balanced evenly.',
        ],
        result:
          'The bug was never about the number of servers - it was local state. Horizontal scaling does not add capacity to a stateful app, it exposes the state.',
      },
    ],
    jargon: [
      { term: 'Scale out', plain: 'Another name for horizontal scaling: more machines of the same size.' },
      { term: 'Replica / instance', plain: 'One identical copy of the application. The unit you add or remove.' },
      { term: 'Sticky session', plain: 'The load balancer sends one user always to the same server. Hides statefulness, creates new problems.' },
      { term: 'Rolling deploy', plain: 'Replacing instances a few at a time so the service stays up throughout.' },
      { term: 'Connection pool', plain: 'A set of reusable database connections per instance. Multiply by instance count before you scale.' },
      { term: 'Shared-nothing', plain: 'An architecture where nodes hold no state the others need. The ideal for scaling out.' },
    ],
    remember: [
      'Interchangeable instances are the requirement; capacity is only the reward.',
      'Any state on local disk or in local memory breaks at N > 1.',
      'Scaling out moves the bottleneck to whatever is shared - usually the database.',
      'Connections multiply with instances; check the pool size before adding nodes.',
      'Redundancy and zero-downtime deploys often matter more than the extra throughput.',
    ],
  },

  'stateless-applications': {
    analogy: {
      title: 'A call centre with shared notes',
      body:
        'You call support, explain your problem, and get cut off. You call again and reach a different agent - who can see the whole history because every note lives in the shared CRM, not in the first agent memory. That is a stateless service: the agent holds nothing, the system holds everything, so any agent will do. If the notes lived in one agent head, you would have to reach that exact person again.',
    },
    deepDive: [
      {
        heading: 'Stateless does not mean there is no state',
        paragraphs: [
          'This is the most common misunderstanding. A stateless application absolutely has state - user accounts, sessions, shopping carts, uploaded images. What it does not have is state stored inside the process that serves the request. The state lives in a database, a cache or object storage, and the instance fetches it per request.',
          'Put precisely: the outcome of a request must depend only on the request itself plus shared storage, never on which instance handled it or what that instance handled previously. If restarting a server would lose something a user cares about, the service is stateful.',
          'The payoff is that instances become disposable. You can kill one at any moment, replace it during a deploy, scale from 3 to 30 in a minute, or let a spot instance disappear, and no user request is harmed. That disposability is the foundation under auto-scaling, rolling deploys and container orchestration.',
        ],
        code: {
          caption: 'The same endpoint, stateful and stateless',
          body: `STATEFUL (breaks at N > 1)
  sessions = {}                       # in process memory
  def login(): sessions[sid] = user   # only this instance knows
  def me():    return sessions[sid]   # 404 on any other instance

STATELESS
  def login(): redis.set(sid, user, ttl=3600)
  def me():    return redis.get(sid)  # any instance, same answer`,
        },
      },
      {
        heading: 'The four places local state hides',
        paragraphs: [
          'In-process memory is the obvious one: session dictionaries, caches, counters, feature-flag overrides, accumulated metrics. Local disk is the second: uploaded files, generated PDFs, temporary working directories that a later request expects to still exist.',
          'The third is background work - a scheduler running inside the app process. With one instance it fires once; with ten instances it fires ten times, which is how teams end up sending the same marketing email ten times. The fourth is long-lived connections: WebSockets and server-sent events pin a user to one node by nature, so reaching that user from another node requires a pub/sub layer.',
          'None of these are unsolvable, but each needs a deliberate decision. The useful habit is to ask of every piece of data: if this instance vanished right now, would anything be lost or duplicated? That question finds all four hiding places quickly.',
        ],
        bullets: [
          'In-memory caches are fine if they are a pure optimisation and each node may hold a different copy.',
          'Temp files are fine if they live and die inside one request.',
          'Anything a later request must see belongs in shared storage.',
          'Anything that must happen exactly once needs a lock, a queue or a single scheduler.',
        ],
      },
      {
        heading: 'Where to put the session: shared store or token',
        paragraphs: [
          'Option one is a shared session store, usually Redis. The cookie carries an opaque session id, the server looks it up on every request. Logout and revocation are instant because you delete one key, and the session can hold as much data as you like. The cost is a network hop on every request and a new dependency that must be available.',
          'Option two is a signed token, typically a JWT, holding the user id and claims in the cookie itself. No lookup, no shared store, which is genuinely attractive at scale. The cost is that you cannot revoke it before it expires, because nothing is stored to delete - the standard mitigation is short-lived tokens plus a refresh token, which quietly reintroduces a store.',
          'A practical middle ground that many teams use: short-lived JWTs for authentication, plus a small denylist in Redis for tokens that must be killed early. You get the fast path most of the time and keep the ability to log somebody out immediately.',
        ],
      },
    ],
    examples: [
      {
        title: 'Making a file upload stateless',
        setup:
          'An app lets users upload a profile picture. It works on one server: the file is written to /var/app/uploads and served back from there. Then a second server is added.',
        walkthrough: [
          'User uploads a photo. The request lands on server A, which writes /var/app/uploads/42.jpg and stores the path in the database.',
          'The user reloads. The request lands on server B, which looks for /var/app/uploads/42.jpg on its own disk and returns 404. The image is "randomly" broken.',
          'Wrong fix: a network file system mounted on both. It works, but it is now a shared point of failure with worse latency and locking problems.',
          'Right fix: upload to object storage (S3 or compatible). The database stores a key, not a local path, and every instance can produce a URL for it.',
          'Better still: have the browser upload directly to object storage with a pre-signed URL. The bytes never touch your app servers, so a 4 GB upload no longer occupies an app process for minutes.',
        ],
        result:
          'Same feature, but now any instance can serve any user and the app tier stays disposable. Note the extra win: moving bytes off the app tier also removed a memory and bandwidth bottleneck nobody had measured.',
      },
    ],
    jargon: [
      { term: 'Stateless', plain: 'The instance keeps nothing between requests that anyone else needs. State lives in shared storage.' },
      { term: 'Session store', plain: 'A shared place (usually Redis) where login sessions live so every instance sees them.' },
      { term: 'JWT', plain: 'A signed token carrying user data in a cookie or header, so no lookup is needed. Hard to revoke early.' },
      { term: 'Disposable instance', plain: 'A server you can kill at any moment without losing anything. The goal of statelessness.' },
      { term: 'Pre-signed URL', plain: 'A temporary URL that lets a browser upload or download straight from object storage.' },
      { term: 'Sticky session', plain: 'Routing a user to the same instance every time. A workaround for statefulness, not a cure.' },
    ],
    remember: [
      'Stateless means no state in the process, not no state anywhere.',
      'Test: if this instance died right now, would anything be lost or done twice?',
      'The four hiding places are memory, local disk, in-process schedulers and long-lived connections.',
      'Sticky sessions hide statefulness and cost you even load balancing.',
      'Disposable instances are what make auto-scaling and zero-downtime deploys possible.',
    ],
  },

  'stateful-applications': {
    analogy: {
      title: 'The archive room',
      body:
        'Cashiers are interchangeable, but the archive room is not - it holds the only copy of the records, it sits in one place, and you cannot duplicate it by wheeling in a second room. Moving it is a project, not a task. Databases, queues and caches are the archive rooms of your system: something has to hold the truth, and that something cannot be made disposable by wishing.',
    },
    deepDive: [
      {
        heading: 'Somebody has to be stateful - the goal is to concentrate it',
        paragraphs: [
          'Stateless application tiers are only possible because something behind them is stateful. The state did not disappear; it moved into systems specifically built to handle it - databases, message brokers, caches, object stores - which have spent decades solving replication, durability and failover.',
          'The design goal, then, is not to eliminate state but to push it into as few places as possible and let purpose-built software own it. A system with one stateful database and twenty stateless services is far easier to operate than one where every service keeps a little local state of its own.',
          'This is why "use the boring database" is good advice. Writing your own state management inside an application means writing your own replication, your own failover and your own backup story, which is a multi-year project that somebody else has already finished.',
        ],
      },
      {
        heading: 'Why stateful nodes are hard to scale and hard to replace',
        paragraphs: [
          'A stateless instance can be replaced in seconds because it holds nothing. A stateful node cannot: a new replica must first receive a copy of the data, which for a large database means minutes to hours of streaming. During that window the cluster has less redundancy, not more.',
          'Identity matters too. Stateless instances are anonymous, but stateful ones are not - node 2 holds shard 2, and if it dies, the replacement must take over that specific shard with that specific data. This is exactly why Kubernetes has StatefulSets with stable names and stable volumes, separate from ordinary Deployments.',
          'And scaling out is not symmetric. Adding a read replica is easy and helps reads. Adding write capacity means partitioning the data, which changes the access patterns of the application and is very hard to reverse. That asymmetry is the reason read replicas are common and sharding is a last resort.',
        ],
        code: {
          caption: 'Replacing a node: the two worlds',
          body: `STATELESS instance dies
  LB removes it from pool         ~5 s
  new instance boots, joins       ~30 s
  impact: a few in-flight requests

STATEFUL primary dies
  detect failure                  ~10-30 s
  promote replica                 ~10-60 s
  redirect clients                ~seconds
  rebuild lost replica            minutes to hours
  impact: writes rejected for the whole window`,
        },
      },
      {
        heading: 'Making stateful systems survivable',
        paragraphs: [
          'The first tool is replication: keep more than one copy, so losing a node loses no data. The second is failover: decide, automatically, which copy becomes the new primary. The third is backup, which is not the same thing - replication copies your mistakes instantly, so only a backup protects you from a bad migration or a deleted table.',
          'Test the failover, and test the restore. An untested failover usually contains one surprise - a hardcoded hostname, a missing permission, an application that caches the primary address forever - and the moment you find it should not be at 3am. The same goes for backups: a backup that has never been restored is a hypothesis, not a safety net.',
          'Finally, keep the stateful surface small. Every extra stateful component (a second database, a local queue, a bespoke cache with its own persistence) multiplies the failover drills, backup jobs and upgrade windows your team has to run forever.',
        ],
        bullets: [
          'Replication protects against node loss. Backups protect against human and application error.',
          'Failover must be automated if your availability target is above three nines.',
          'Connection strings should point at a name that follows the primary, never at a fixed node.',
          'Every stateful system needs an owner, a runbook and a rehearsed restore.',
        ],
      },
    ],
    examples: [
      {
        title: 'Why the shopping cart moved out of memory',
        setup:
          'An e-commerce app keeps carts in application memory for speed. It runs three instances with sticky sessions, and the team wants to deploy twice a day.',
        walkthrough: [
          'Deploy restarts instance A. Every cart held in that process is gone - roughly a third of active shoppers lose their basket.',
          'Sticky sessions mean those users were pinned to A, so the loss is total for them, not partial.',
          'Traffic cannot be rebalanced either: instance A may be at 90 percent CPU while C is at 30 percent, because stickiness overrides the load balancer.',
          'Move carts to Redis with a 7-day TTL. Now a deploy touches nothing a customer owns, stickiness can be turned off, and a returning user finds the cart on any instance.',
          'Redis itself is now stateful and critical, so it gets a replica, automatic failover and persistence enabled - one well-understood stateful system instead of three accidental ones.',
        ],
        result:
          'The state did not vanish, it was concentrated into a system designed to hold it. Deploys became boring, load balanced evenly, and cart abandonment caused by restarts dropped to zero.',
      },
    ],
    jargon: [
      { term: 'Stateful', plain: 'The node holds data that would be lost or that others need if it disappeared.' },
      { term: 'StatefulSet', plain: 'The Kubernetes object for pods with stable identity and their own persistent disk.' },
      { term: 'Primary / replica', plain: 'The node that accepts writes, and the copies that follow it.' },
      { term: 'Failover', plain: 'Promoting a replica to primary when the primary dies. Automate it or measure your downtime.' },
      { term: 'Persistent volume', plain: 'Storage that survives the container it was attached to.' },
      { term: 'Rehydration', plain: 'Streaming data to a new replica before it can serve traffic. Why replacing stateful nodes is slow.' },
    ],
    remember: [
      'You cannot delete state, only move it into systems built to hold it.',
      'Concentrate state in few places; every extra stateful component costs forever.',
      'Stateful nodes have identity and data, so replacement is slow and ordered.',
      'Replication is not backup - it copies your mistakes at full speed.',
      'An untested failover or restore is a guess, not a plan.',
    ],
  },

  'load-balancing': {
    analogy: {
      title: 'The host at the door of a busy restaurant',
      body:
        'You do not pick your own table. A host watches which waiters are free, seats you accordingly, and quietly stops seating anyone in a section where the waiter has gone home. Diners never learn the staff roster - they just talk to the host. A load balancer is that host: one address the world knows, a changing set of servers behind it, and a constant check of who is actually able to serve.',
    },
    deepDive: [
      {
        heading: 'Layer 4 versus layer 7, and why it matters',
        paragraphs: [
          'A layer 4 balancer works with TCP: it sees IP addresses and ports, picks a backend and forwards packets. It is extremely fast and cheap because it never looks inside the traffic - it does not know whether the request is a login or an image, and it cannot read the URL because with HTTPS it never decrypts anything.',
          'A layer 7 balancer terminates the connection, decrypts TLS and reads the HTTP request. That lets it route by path or header, retry a failed request on another backend, add compression, rewrite headers and apply per-route rate limits. The price is CPU for encryption and a little latency, plus the fact that TLS now terminates outside your application.',
          'Rule of thumb: use layer 7 for anything HTTP, because routing, retries and observability are worth far more than the microseconds. Use layer 4 for raw TCP protocols, for extreme throughput, or when end-to-end encryption must not be broken.',
        ],
        code: {
          caption: 'What each layer can see and do',
          body: `                     L4 (TCP)          L7 (HTTP)
sees                 ip, port          method, path, headers, cookies
TLS                  passes through    terminates (or re-encrypts)
route by URL         no                yes
retry a request      no                yes (idempotent ones)
sticky by cookie     by IP only        by cookie
cost                 very low          CPU for TLS, a little latency`,
        },
      },
      {
        heading: 'The algorithms, and when each is wrong',
        paragraphs: [
          'Round robin sends request 1 to server A, 2 to B, 3 to C. It is fair when every request costs the same, and it is badly wrong when they do not: one server can be stuck with three slow report queries while another handles thirty trivial lookups, and round robin keeps feeding both equally.',
          'Least connections sends the next request to the backend with the fewest open connections, which naturally compensates for uneven request cost. It is the sensible default for most web traffic. Least response time goes further by preferring the fastest backend, but it can herd traffic onto a node that only looks fast because it is returning errors quickly.',
          'Hashing (by client IP, by a header, by a key) always sends the same input to the same backend. That is how you get cache locality or session affinity without a shared store. The danger is that adding or removing a node reshuffles everything, which is why consistent hashing exists - it moves only 1/N of the keys instead of all of them.',
        ],
        bullets: [
          'Round robin: equal-cost requests, simplest to reason about.',
          'Least connections: the safe default when request cost varies.',
          'Weighted: mixed instance sizes - give the bigger machine a bigger share.',
          'Hash / consistent hash: cache locality, sharded backends, sticky routing.',
          'Random with two choices: surprisingly close to optimal and trivially cheap at scale.',
        ],
      },
      {
        heading: 'Health checks are the feature, load distribution is the side effect',
        paragraphs: [
          'The distribution algorithm gets all the attention, but the health check is what actually keeps you online. Without it, a crashed backend keeps receiving a third of your traffic and a third of your users see errors. With it, that backend is removed within seconds and the failure becomes invisible.',
          'Shallow checks (a TCP connect, or a 200 from /ping) prove the process is alive but not that it can work. Deep checks that verify the database connection catch more real failures - and can also take your entire fleet out at once when the database has a brief hiccup, because every instance fails the check simultaneously. The usual compromise is a shallow liveness check for the balancer and a deeper readiness check used only at startup and for alerting.',
          'Two settings matter as much as the check itself. Tune the threshold so a single slow response does not eject a healthy node, and make sure the balancer drains connections before removing a node during a deploy - that is the difference between a rolling deploy and a rolling error spike.',
        ],
      },
    ],
    examples: [
      {
        title: 'Why round robin let one server melt',
        setup:
          'Three identical servers behind round robin. Most requests are 20 ms lookups, but roughly 2 percent are 3-second report generations. Users start reporting random slowness.',
        walkthrough: [
          'At 300 requests per second each server receives 100 per second, including about 2 report requests per second.',
          'A report occupies a worker for 3 seconds. Two arriving per second means roughly 6 workers permanently tied up on that server.',
          'Round robin does not know or care. It keeps sending 100 requests per second to a server whose worker pool is now mostly blocked, so fast requests queue behind slow ones.',
          'Switching to least connections helps immediately: a server holding 6 long-running connections receives proportionally fewer new requests, and the fast traffic flows to the freer nodes.',
          'The structural fix is better still: route /reports to a separate pool via layer 7 path routing, or push report generation onto a queue and return a job id.',
        ],
        result:
          'Least connections turned p95 from 2.1 s back to 180 ms without adding hardware. Separating the slow path into its own pool made the two workloads stop competing at all - a bulkhead, arrived at from a load balancing problem.',
      },
    ],
    jargon: [
      { term: 'Backend / upstream', plain: 'One of the servers the balancer forwards to. Same thing, different vendor vocabulary.' },
      { term: 'L4 / L7', plain: 'Balancing on TCP (fast, blind) versus on HTTP (smart, can route and retry).' },
      { term: 'Health check', plain: 'A periodic probe that decides whether a backend still receives traffic.' },
      { term: 'Connection draining', plain: 'Letting in-flight requests finish before removing a node. Prevents deploy-time errors.' },
      { term: 'TLS termination', plain: 'Decrypting HTTPS at the balancer so it can read and route the request.' },
      { term: 'Consistent hashing', plain: 'A hash scheme where adding a node moves only a small share of keys instead of all of them.' },
    ],
    remember: [
      'The load balancer is one address hiding a changing set of servers.',
      'Least connections beats round robin whenever request cost varies.',
      'Health checks, not the algorithm, are what keep failures invisible.',
      'L7 buys routing, retries and visibility; L4 buys raw speed and untouched encryption.',
      'The balancer itself must be redundant, or you just moved the single point of failure.',
    ],
  },

  'auto-scaling': {
    analogy: {
      title: 'Calling in extra staff when the queue grows',
      body:
        'A manager watches the queue at the tills. Past a certain length they call in staff from the back room; when it is quiet they send people home. Two things decide whether this works: how long it takes someone to arrive, and how twitchy the manager is. If staff take fifteen minutes to walk in, watching the queue is already too late - and a manager who calls and dismisses people every two minutes exhausts everybody.',
    },
    deepDive: [
      {
        heading: 'The rule is easy; the delay is the problem',
        paragraphs: [
          'The policy itself is a couple of lines: if average CPU is above 70 percent for 3 minutes, add two instances; if below 30 percent for 10 minutes, remove one. What makes auto-scaling hard is that none of it is instant. The metric is averaged over a window, the alarm needs consecutive breaches, the instance must boot, the application must warm up, and the health check must pass before traffic arrives.',
          'Add those together and you typically have three to eight minutes between "we are overloaded" and "extra capacity is serving". A traffic spike that arrives in sixty seconds will be served entirely by the instances you already had. This is the single most important thing to internalise: auto-scaling handles trends, not spikes.',
          'Two mitigations follow directly. Keep headroom - target 60-70 percent utilisation rather than 90 - so existing instances absorb the first minutes. And shorten the warm-up path: bake dependencies into the image, avoid long migrations at boot, and pre-warm caches or connection pools where you can.',
        ],
        code: {
          caption: 'Where the minutes go',
          body: `t+0:00  traffic doubles
t+1:00  metric window closes, CPU shows 85%
t+3:00  alarm needs 3 consecutive periods -> fires
t+3:10  scaling action starts, instance requested
t+4:30  VM booted
t+5:30  app started, dependencies connected
t+6:00  health check passes, LB sends traffic
        ---- 6 minutes served by the old capacity ----`,
        },
      },
      {
        heading: 'Which metric to scale on',
        paragraphs: [
          'CPU is the default because it is always available, and it is a reasonable proxy for compute-bound services. It is a poor proxy for anything that spends its time waiting: an IO-bound service can be at 20 percent CPU while every worker is blocked and users are queuing.',
          'Request concurrency or queue depth is usually the better signal, because it measures the thing users actually feel. For a worker pool consuming a queue, the queue length per worker is the natural metric - it directly expresses "how far behind are we". For a web tier, requests in flight per instance or p95 latency maps closely to user experience.',
          'Scheduled scaling deserves more respect than it gets. If you know traffic triples every weekday at 09:00, scale at 08:45 by the clock. Reactive scaling will always be late for a predictable event, and predicting the predictable is free.',
        ],
        bullets: [
          'CPU-bound service -> CPU utilisation.',
          'IO-bound web service -> in-flight requests per instance, or p95 latency.',
          'Queue workers -> messages in queue divided by worker count (backlog per worker).',
          'Known daily or weekly pattern -> scheduled scaling, with reactive rules as the safety net.',
        ],
      },
      {
        heading: 'Flapping, scale-in safety and the cost of getting it wrong',
        paragraphs: [
          'Flapping is when the system adds instances, the metric drops because capacity increased, so it removes them, so the metric rises again. The cures are asymmetric thresholds (scale out at 70 percent, in at 30), a cooldown after each action, and scaling in more slowly than you scale out. Being over-provisioned for ten minutes is cheap; being under-provisioned for ten minutes is an incident.',
          'Scale-in must also be graceful. Removing an instance means draining its connections, finishing in-flight requests, and for a queue worker, finishing or returning the message it is currently processing. A naive terminate turns every scale-in event into a small burst of user-visible errors.',
          'Finally, set a maximum, and know what happens at it. Auto-scaling without a ceiling turns a traffic bug or a retry storm into a five-figure bill overnight. Auto-scaling without a floor leaves you with zero warm instances when the first user arrives. Both bounds are part of the design.',
        ],
      },
    ],
    examples: [
      {
        title: 'Tuning a policy that kept being late',
        setup:
          'A service scales on average CPU over a 5-minute window, threshold 80 percent, adding one instance per action, with a 5-minute cooldown. Every morning rush produces ten minutes of errors.',
        walkthrough: [
          'The 5-minute averaging window alone delays the signal by up to 5 minutes - at 08:00 the average still contains four quiet minutes.',
          'Threshold 80 percent means the fleet is nearly saturated before anything happens, so latency has already risen when the alarm fires.',
          'Adding one instance at a time, with a 5-minute cooldown, means going from 4 to 8 instances takes 20 minutes. The rush is over before the fleet is right.',
          'Fix 1: shorten the metric window to 1 minute and lower the threshold to 60 percent, so action starts while there is still headroom.',
          'Fix 2: scale by percentage, not by one - add 50 percent of current capacity per action, so 4 becomes 6 becomes 9 in two steps.',
          'Fix 3: schedule a scale-out to 8 instances at 07:45, since the rush happens every weekday. Reactive rules then only handle the unusual days.',
        ],
        result:
          'Morning errors went to zero, and the monthly bill rose by about 4 percent because the extra capacity is only held for two hours a day. Scheduled scaling did most of the work - the predictable part of the load never needed a reaction at all.',
      },
    ],
    jargon: [
      { term: 'Scaling policy', plain: 'The rule that decides when to add or remove instances, and how many.' },
      { term: 'Cooldown', plain: 'A pause after a scaling action so the effect can be measured before acting again.' },
      { term: 'Flapping', plain: 'Adding and removing capacity repeatedly because the metric reacts to your own actions.' },
      { term: 'Warm-up time', plain: 'How long from launch to serving traffic. Everything you can shorten here you feel in an incident.' },
      { term: 'Headroom', plain: 'Deliberate spare capacity that absorbs a spike while new instances boot.' },
      { term: 'Target tracking', plain: 'A policy where you name the desired metric value and the platform works out the instance count.' },
    ],
    remember: [
      'Auto-scaling reacts in minutes, so it handles trends, not sudden spikes.',
      'Headroom is what actually covers the first minutes of a surge.',
      'Scale out fast and in slowly, with different thresholds, or you will flap.',
      'Pick a metric users feel - concurrency, latency, backlog - not just CPU.',
      'Always set a maximum: a retry storm plus unlimited scaling is a billing incident.',
    ],
  },
};
