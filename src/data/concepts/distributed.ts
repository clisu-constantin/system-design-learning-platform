import type { Concept } from '@/types';

export const distributedConcepts: Concept[] = [
  {
    slug: 'cap-theorem',
    title: 'CAP Theorem',
    tagline: 'During a network partition you choose: refuse the request, or answer with possibly stale data.',
    category: 'distributed',
    difficulty: 'Intermediate',
    lab: 'cap-theorem',
    keywords: ['consistency', 'availability', 'partition', 'cp', 'ap', 'pacelc'],
    what: 'CAP states that a distributed data store cannot simultaneously guarantee consistency, availability and partition tolerance. Since networks do partition, the real choice is between consistency (CP) and availability (AP) while a partition lasts.',
    why: 'It names the decision every replicated system must make in advance: when two nodes cannot talk to each other, does a write succeed and risk divergence, or fail and preserve a single truth?',
    how: [
      'Consistency here means linearizability: every read sees the latest acknowledged write.',
      'Availability means every non-failing node answers every request.',
      'Partition tolerance means the system keeps working when messages between nodes are lost.',
      'Partitions are not optional, so systems land on CP or AP - and the choice can differ per operation.',
    ],
    when: [
      'CP for money, inventory, unique constraints - a wrong answer is worse than no answer.',
      'AP for feeds, likes, presence, analytics - being unavailable is worse than being slightly stale.',
    ],
    diagram: `             Consistency
                  /\\
                 /  \\
            CP  /    \\  CA (only without partitions:
               /      \\      a single node, not a
              /________\\     distributed system)
   Availability   AP   Partition tolerance

Node A  X  NETWORK PARTITION  X  Node B
write arrives at A:
  CP -> reject (or block) until the partition heals
  AP -> accept, diverge, reconcile later`,
    tradeoffs: [
      {
        approach: 'CP (consistency first)',
        gains: ['One truth at all times', 'No conflict resolution to write', 'Safe for financial invariants'],
        costs: ['Minority side returns errors during a partition', 'Higher write latency (quorum round trips)'],
      },
      {
        approach: 'AP (availability first)',
        gains: ['Every replica keeps serving', 'Low latency, works offline-ish'],
        costs: ['Stale reads', 'Conflicting writes must be merged (last-write-wins, CRDTs, or application logic)'],
      },
    ],
    mistakes: [
      'Treating CAP as a permanent system label rather than a behaviour during partitions.',
      'Forgetting PACELC: even without a partition you still trade latency against consistency.',
      'Choosing AP and never writing the conflict-resolution logic that AP requires.',
    ],
    realWorld: [
      'ZooKeeper, etcd and Spanner behave as CP - they refuse rather than diverge.',
      'Cassandra and DynamoDB are tunable: per-query quorum settings move you along the spectrum.',
    ],
    related: ['strong-consistency', 'eventual-consistency', 'consensus', 'replication'],
    quiz: [
      {
        id: 'cap-1',
        prompt: 'A payment system is partitioned in two. Which behaviour is appropriate?',
        options: [
          'Accept payments on both sides and merge later',
          'Refuse writes on the minority side to avoid double-spending',
          'Shut down the whole system',
          'Switch to eventual consistency temporarily',
        ],
        answer: 1,
        explanation:
          'Money requires a single truth. A CP system rejects writes it cannot make safely rather than accepting conflicting ones.',
      },
      {
        id: 'cap-2',
        prompt: 'What does the "A" in CAP actually promise?',
        options: [
          'The system is up 99.99% of the time',
          'Every request to a non-failing node receives a non-error response, even during a partition',
          'There is no downtime during deploys',
          'Reads are always fast',
        ],
        answer: 1,
        explanation:
          'CAP availability is a formal property about answering during partitions - it is not the same as an uptime SLA.',
      },
    ],
  },
  {
    slug: 'consistency',
    title: 'Consistency',
    tagline: 'What a reader is promised about what a writer did.',
    category: 'distributed',
    difficulty: 'Intermediate',
    keywords: ['linearizability', 'monotonic reads', 'read your writes', 'models'],
    what: 'A consistency model is the contract between the store and its clients about which values a read may return given the writes that happened before it.',
    why: 'Most real bugs in distributed systems are a mismatch between the model people assume and the one the system provides.',
    how: [
      'Linearizable: reads always see the latest committed write. Strongest and most expensive.',
      'Read-your-writes: a client sees its own writes, but not necessarily others.',
      'Monotonic reads: a client never sees time go backwards.',
      'Eventual: replicas converge if writes stop - with no bound on when.',
    ],
    diagram: `write(x=2) ack
   |
   +-- linearizable:      every reader sees 2 immediately
   +-- read-your-writes:  the writer sees 2; others may see 1
   +-- eventual:          everyone sees 2 ... eventually`,
    tradeoffs: [
      {
        approach: 'Stronger model',
        gains: ['Simple application code', 'No surprising stale data'],
        costs: ['Coordination on every operation', 'Latency and reduced availability'],
      },
    ],
    mistakes: ['Specifying consistency once for the whole system instead of per operation.'],
    related: ['strong-consistency', 'eventual-consistency', 'cap-theorem'],
  },
  {
    slug: 'availability',
    title: 'Availability',
    tagline: 'The share of time the system answers correctly - and what it takes to raise it.',
    category: 'distributed',
    difficulty: 'Beginner',
    keywords: ['uptime', 'nines', 'redundancy', 'mtbf', 'mttr'],
    what: 'Availability is the proportion of time a system is able to serve requests, usually expressed in nines (99.9%, 99.99%).',
    why: 'Each extra nine multiplies architectural effort. Naming a target decides whether you need redundancy, multi-zone deployment and automated failover.',
    how: [
      'Availability of components in series multiplies: two 99.9% dependencies give about 99.8%.',
      'Redundancy converts multiplication into a much smaller failure probability.',
      'Availability improves by reducing MTTR (recover fast) as much as by raising MTBF (fail less).',
    ],
    diagram: `Series:   LB(99.99) x API(99.9) x DB(99.9)  ~= 99.79%  -> ~18 h/year
Redundant DB (two independent 99.9 nodes with failover) -> ~99.9999% for that tier`,
    tradeoffs: [
      {
        approach: 'Chasing more nines',
        gains: ['Less user-visible downtime', 'Survives larger failures'],
        costs: ['Cost grows roughly exponentially', 'More automation to test and maintain', 'Often requires weaker consistency'],
      },
    ],
    mistakes: ['Counting only the application and ignoring dependencies, DNS and deploy-related downtime.'],
    related: ['high-availability', 'redundancy', 'failover', 'slo'],
  },
  {
    slug: 'partition-tolerance',
    title: 'Partition Tolerance',
    tagline: 'The network will split. Your system still has to do something sensible.',
    category: 'distributed',
    difficulty: 'Intermediate',
    keywords: ['network partition', 'split brain', 'quorum', 'fencing'],
    what: 'Partition tolerance is the ability to keep operating when messages between nodes are delayed or lost, splitting the cluster into groups that cannot talk to each other.',
    why: 'Partitions are a fact of networks - a switch fails, a cable is cut, a security group changes. A design that ignores them fails in the worst possible way: two halves both believing they are in charge.',
    how: [
      'Use quorums: only a majority group may accept writes, so two halves cannot both proceed.',
      'Fence the old leader (revoke its access or lease) before promoting a new one.',
      'Decide explicitly what the minority side does: read-only, queue locally, or return errors.',
    ],
    diagram: `Node A | Node B   <- partition
5 nodes: {A,B,C} majority -> accepts writes
         {D,E}   minority -> read-only / errors
Without quorum: both sides accept writes -> split brain -> divergent data`,
    tradeoffs: [
      {
        approach: 'Choose consistency during a partition (CP)',
        gains: ['Clients never read or write conflicting data', 'Simpler reasoning for money, inventory and locks'],
        costs: ['The minority side refuses requests until the partition heals', 'Latency rises while nodes wait for a quorum'],
      },
      {
        approach: 'Choose availability during a partition (AP)',
        gains: ['Every reachable node keeps serving reads and writes', 'Users on both sides of the split keep working'],
        costs: ['Divergent writes must be reconciled after the partition heals', 'Clients can read stale or conflicting values'],
      },
    ],
    mistakes: [
      'Two-node clusters, where a partition gives neither side a majority (or both sides one).',
      'Promoting a new primary without fencing the old one.',
    ],
    related: ['cap-theorem', 'consensus', 'leader-election', 'failover'],
  },
  {
    slug: 'strong-consistency',
    title: 'Strong Consistency',
    tagline: 'Every read returns the latest committed write, always.',
    category: 'distributed',
    difficulty: 'Intermediate',
    keywords: ['linearizable', 'quorum', 'serializable', 'coordination'],
    what: 'Under strong consistency the system behaves as if there were a single copy of the data and operations happened one at a time in a global order.',
    why: 'It removes an entire class of bugs. Invariants like "the balance never goes negative" or "this username is unique" can only be enforced with a single agreed-upon truth.',
    how: [
      'Route all writes through a leader, or require a quorum of replicas to acknowledge.',
      'Reads must also be coordinated (leader reads, quorum reads, or leases).',
      'The cost is one or more network round trips per operation.',
    ],
    when: ['Payments, inventory, bookings, unique identifiers, permissions.'],
    diagram: `write -> leader -> replicate to quorum -> ack
read  -> leader (or quorum) -> guaranteed latest value
cost: 1+ extra round trips, unavailable to the minority during a partition`,
    tradeoffs: [
      {
        approach: 'Strong consistency',
        gains: ['Invariants hold', 'Application logic stays simple'],
        costs: ['Higher latency, especially across regions', 'Availability drops during partitions', 'Throughput limited by coordination'],
      },
    ],
    related: ['eventual-consistency', 'consensus', 'cap-theorem', 'distributed-locks'],
  },
  {
    slug: 'eventual-consistency',
    title: 'Eventual Consistency',
    tagline: 'Replicas converge - if you stop writing long enough.',
    category: 'distributed',
    difficulty: 'Intermediate',
    keywords: ['convergence', 'conflict resolution', 'crdt', 'last write wins', 'lag'],
    what: 'Eventual consistency guarantees only that, absent new writes, all replicas eventually hold the same value. It says nothing about when, or what a reader sees in the meantime.',
    why: 'It buys availability and low latency: a replica can answer immediately without asking anyone else. For likes, view counts, feeds and presence, that is the right trade.',
    how: [
      'Writes are accepted locally and propagated asynchronously.',
      'Conflicts are resolved by a rule: last-write-wins with timestamps, version vectors, or a CRDT that merges deterministically.',
      'Client-side session guarantees (read-your-writes, monotonic reads) can hide most of the weirdness.',
    ],
    when: ['Counters, feeds, caches, cross-region reads, offline-capable clients.'],
    diagram: `write to replica A -> ack immediately
           A ---> B (200 ms later)
           A ---> C (2 s later, retried)

reader on C during that window sees the old value.
Conflict: A=x@t2, B=y@t1 -> LWW keeps x (and silently drops y)`,
    tradeoffs: [
      {
        approach: 'Eventual consistency',
        gains: ['Always writable', 'Low latency', 'Survives partitions'],
        costs: ['Stale reads', 'Lost updates under last-write-wins', 'Application must tolerate or merge conflicts'],
      },
    ],
    mistakes: [
      'Using last-write-wins for data where a lost update is unacceptable.',
      'Clock skew making "last" meaningless - use logical clocks or version vectors.',
    ],
    related: ['strong-consistency', 'cap-theorem', 'replication', 'idempotency'],
  },
  {
    slug: 'distributed-locks',
    title: 'Distributed Locks',
    tagline: 'Mutual exclusion across machines - harder than it looks.',
    category: 'distributed',
    difficulty: 'Advanced',
    lab: 'distributed-lock',
    keywords: ['lease', 'fencing token', 'redlock', 'zookeeper', 'etcd', 'mutual exclusion'],
    what: 'A distributed lock lets only one process in a cluster perform an action at a time. It is almost always a lease - a lock that expires after a TTL unless renewed - held in Redis, etcd or ZooKeeper.',
    why: 'Some operations must not run twice concurrently: charging a card, generating an invoice, compacting a file. Without coordination, two workers will eventually do it at the same time.',
    how: [
      'Acquire with an atomic set-if-not-exists plus an expiry (a lease), so a crashed holder cannot block the lock forever.',
      'Hold the lock only for the critical section, and release it with an atomic check that you still own it.',
      'A holder can be paused past its lease, so for correctness the lock hands out an increasing fencing token and the protected resource rejects any token older than one it has already seen.',
    ],
    when: [
      'Efficiency locks: stop several instances doing the same work twice (one cron run, one cache rebuild). A single Redis lock is enough - a rare double run only wastes work.',
      'Correctness locks: a double run corrupts data. Use a consensus-based lock (etcd, ZooKeeper) and fencing tokens the resource checks - or remove the need with a unique constraint or idempotency.',
    ],
    advantages: [
      'Turns a race between machines into a queue of one: the second worker waits or skips.',
      'Protects resources that cannot enforce uniqueness themselves, such as a file or an external job.',
      'With fencing tokens, even a holder whose lease expired cannot overwrite newer data.',
    ],
    diagram: `Worker 1 acquires lease (TTL 30s, token 41)
Worker 1 pauses (GC) for 40s -> lease expires
Worker 2 acquires lease (token 42) and writes
Worker 1 wakes and writes with token 41 -> storage rejects it (41 < 42)`,
    tradeoffs: [
      {
        approach: 'Single Redis lock (SET NX PX)',
        gains: ['Fast: one round trip to acquire', 'Simple, and most teams already run Redis', 'The TTL frees the lock after a crash'],
        costs: [
          'A pause or slow work past the TTL gives two owners at once',
          'A failover to a replica that missed the key gives two owners',
          'No increasing number to use as a fencing token',
        ],
      },
      {
        approach: 'Consensus lock (etcd, ZooKeeper) with fencing tokens',
        gains: ['Survives the failure of a minority of lock nodes', 'Hands out an increasing number (etcd revision, ZooKeeper zxid) to fence with'],
        costs: [
          'A quorum round trip on every acquire',
          'Another cluster to run, unless you already have one',
          'The protected resource must check the token - many external APIs cannot',
        ],
      },
      {
        approach: 'No lock: unique constraint or idempotent operation',
        gains: ['Nothing to expire, leak or fail over', 'Retries and double runs become harmless'],
        costs: ['Needs a natural key and somewhere to enforce it', 'The duplicate work still runs - only its effect is discarded'],
      },
    ],
    mistakes: [
      'Assuming a TTL-based lock guarantees exclusion - a paused process can wake up believing it still holds it.',
      'Releasing with a plain DEL instead of a compare-and-delete on your own value - it can delete the lock somebody else acquired after yours expired.',
      'Setting no TTL "to be safe" - one crashed holder then blocks the resource until a human deletes the key.',
      'Using a lock for correctness where a unique constraint or idempotency would be both simpler and safer.',
      'Adding fencing tokens to a resource that never checks them - the token only helps where it is compared.',
    ],
    related: ['idempotency', 'leader-election', 'consensus', 'redis'],
    quiz: [
      {
        id: 'dl-1',
        prompt:
          'In the Lab, fencing is off. Worker 1 gets token 41 and freezes for 15 s; the TTL is 8 s. Worker 2 gets token 42 and writes. Worker 1 wakes and writes with token 41. What happens?',
        options: [
          'The lock service blocks the write of Worker 1, because its lease has expired',
          'Worker 1 notices its lease expired when it wakes and skips the write',
          'Storage accepts the write with token 41 on top of the data from token 42 - a lost update',
          'Storage rejects it, because every write is compared with the lock service',
        ],
        answer: 2,
        explanation:
          'The lock service is not on the write path - Worker 1 talks to storage directly, and a paused process has no way to notice time passed. With fencing off, storage accepts any write, so the older token lands on newer data (the Lost updates counter). Expecting the lock service to step in is the tempting wrong answer: it only knows who asked for the key, not who writes.',
      },
      {
        id: 'dl-2',
        prompt:
          'You turn fencing tokens on in the Lab and pause Worker 1 past its TTL again. What changes in the metrics?',
        options: [
          'Two-owner moments still goes up, but the stale write is refused instead of accepted',
          'Two-owner moments stays at 0, because fencing stops two workers holding the lock',
          'Nothing changes, because the TTL is still shorter than the pause',
          'Worker 2 is refused, because Worker 1 held the lock first',
        ],
        answer: 0,
        explanation:
          'Fencing does not prevent two workers believing they hold the lock - the pause still outlives the lease. It makes the stale one harmless: storage has seen 42, so 41 is refused. Thinking fencing prevents the overlap is the tempting mistake; it limits the damage, it does not stop the cause.',
      },
      {
        id: 'dl-3',
        prompt:
          'Worker A holds a Redis lock with a 30 s TTL, but its job takes 45 s. At 30 s the key expires and Worker B takes the lock. At 45 s Worker A finishes and runs DEL lock:job in a finally block. What happens?',
        options: [
          'Nothing - DEL only removes a key the caller created',
          'A deletes the lock of B, so a third worker can take it while B is still working',
          'Redis rejects the DEL because the TTL was reset by B',
          'A waits until B releases the lock, then deletes it',
        ],
        answer: 1,
        explanation:
          'DEL removes the key whoever set it. The fix is to store a unique random value when acquiring and release with a compare-and-delete (the Lua script, or DELEX on Redis 8.4+) that deletes only if the value is still yours. Believing Redis tracks who created a key is the tempting error - a plain key has no owner.',
      },
      {
        id: 'dl-4',
        prompt:
          'To avoid leases expiring under slow work, a team acquires its Redis lock with SET NX and no expiry. A worker holding the lock is killed by the out-of-memory killer. What happens next?',
        options: [
          'Redis sees the connection close and deletes the key',
          'The next worker takes the lock after the default 30 s TTL',
          'The key stays forever: every worker is refused until someone deletes it by hand',
          'The lock is safe, because nobody else can ever hold it twice',
        ],
        answer: 2,
        explanation:
          'A plain Redis key has no link to the client that set it and no default TTL, so it outlives the dead process. That is why every lease needs an expiry (crash one in the Lab with the TTL off and see the stuck lock). A ZooKeeper ephemeral node is deleted when its session ends, which is why the first option sounds plausible - but that is not how a Redis key behaves.',
      },
      {
        id: 'dl-5',
        prompt:
          'After a double run, a team raises the lock TTL from 30 s to 10 minutes "so it can never expire mid-job". What have they actually bought?',
        options: [
          'Complete safety: no pause lasts 10 minutes',
          'Nothing - the TTL has no effect on how long a crashed holder blocks the lock',
          'Fewer expiries mid-job, but a crashed holder now blocks the job for up to 10 minutes, and a longer pause still gives two owners',
          'Faster acquisition, because the key is written less often',
        ],
        answer: 2,
        explanation:
          'The TTL trades safety against liveness: a longer lease expires under slow work less often, but a dead holder blocks everyone for longer. It never closes the gap, because pauses (GC, VM stalls, swapping) have no upper bound - stop-the-world GC pauses of minutes have been seen. Only fencing or idempotency closes it.',
      },
      {
        id: 'dl-6',
        prompt:
          'A nightly billing job runs in 12 instances, and a Redis lock is the only thing stopping 12 sets of invoices. Duplicate invoices would be a serious incident. What is the most durable fix?',
        options: [
          'Switch to Redlock across 5 Redis nodes',
          'Raise the TTL to 24 hours',
          'Run the job on only one of the 12 instances, chosen by hostname',
          'Key invoices by (customer_id, period) with a unique constraint, so a second run inserts nothing',
        ],
        answer: 3,
        explanation:
          'With the unique constraint, a double run becomes harmless and the lock is only an efficiency measure. Redlock is tempting but still relies on timing and hands out no fencing token, so a pause can still produce two owners. A 24-hour TTL blocks billing for a day after a crash, and one hardcoded host is a single point of failure.',
      },
      {
        id: 'dl-7',
        prompt:
          'Several API instances rebuild the same expensive cached report when it expires. If two rebuild it at once, the only cost is some wasted CPU. Which lock fits?',
        options: [
          'A single Redis SET NX PX lock - a rare double rebuild only wastes work',
          'A ZooKeeper lock with fencing tokens checked by the cache',
          'A lock with no TTL, so the rebuild is never duplicated',
          'No lock and no coordination - duplicate rebuilds cannot happen',
        ],
        answer: 0,
        explanation:
          'This is an efficiency lock: a rare overlap costs CPU, not correctness, so the simplest fast lock is right. A consensus lock with fencing is the tool for correctness locks, and here it only adds latency and another cluster. A lock with no TTL turns one crash into a report that never rebuilds.',
      },
      {
        id: 'dl-8',
        prompt:
          'Worker A takes a lock on a Redis primary. The primary crashes before the key reaches its replica (replication is asynchronous), and the replica is promoted. Worker B asks for the same lock. What happens?',
        options: [
          'B is refused, because the replica has a copy of every key',
          'B is refused until the old primary comes back',
          'B gets the lock too, so two workers hold it at once',
          'Both locks are merged when the old primary rejoins',
        ],
        answer: 2,
        explanation:
          'The key never reached the replica, so the new primary sees no lock and grants it. This failure mode is documented by Redis itself, and it is why a replicated Redis lock is still an efficiency lock. Assuming the replica has every key is the tempting mistake - asynchronous replication means it can be behind.',
      },
      {
        id: 'dl-9',
        prompt:
          'A lock protects calls to a third-party email API that has no idea what a token is. A teammate proposes adding fencing tokens to the lock. What does that achieve?',
        options: [
          'It stops duplicate emails, because the token travels with every call',
          'Nothing on its own: fencing only works where the resource compares tokens, so use an idempotency key the API honours, or accept a rare duplicate',
          'It makes the lock survive a Redis failover',
          'It lets the API process two holders in parallel safely',
        ],
        answer: 1,
        explanation:
          'A fencing token is enforced by the resource, not by the lock. An API that ignores it lets the stale holder through exactly as before. Where the resource cannot check tokens, the options are an idempotency key it does honour, or treating the lock as best effort.',
      },
      {
        id: 'dl-10',
        prompt:
          'A worker renews its 30 s lease every 10 s from a background heartbeat thread. The whole process then hits a 45 s stop-the-world GC pause. What happens?',
        options: [
          'The heartbeat keeps the lease alive, because it runs on its own thread',
          'The lease expires during the pause and another worker can take it; the woken worker still believes it holds the lock',
          'The lock service extends the lease while the process is paused',
          'The worker loses the lock only if it crashes',
        ],
        answer: 1,
        explanation:
          'A stop-the-world pause freezes every thread, heartbeat included, so no renewal is sent and the lease runs out. Renewal shrinks the window for work that is slow but running; it cannot help a process that is not running. That is the case fencing tokens exist for.',
      },
      {
        id: 'dl-11',
        prompt:
          'Storage enforces fencing and has seen token 42. Three delayed writes then arrive in this order: token 43, token 41, token 42. Which are accepted?',
        options: [
          'All three, since each came from a worker that held the lock at some point',
          'Only 43; then 41 and 42 are both refused, because 43 is now the highest seen',
          '43 and 42; only 41 is refused',
          'Only 41, because it held the lock first',
        ],
        answer: 1,
        explanation:
          'The rule is to refuse any token older than the highest already seen. After 43 lands, the highest is 43, so both 41 and 42 are older. Picking "43 and 42" is tempting because 42 was valid before - but 43 proves a newer lease exists, so the holder of 42 is stale too.',
      },
      {
        id: 'dl-12',
        prompt:
          'A correctness-critical job must not double-apply, and the team already runs etcd for Kubernetes. Redis would be faster. What is the sound choice?',
        options: [
          'Redis SET NX, using the random value as the fencing token',
          'Redlock across 3 Redis nodes, which removes the need for fencing',
          'A lock with no TTL in etcd, so it never expires',
          'An etcd lease-based lock, passing its revision number as the fencing token that storage checks',
        ],
        answer: 3,
        explanation:
          'etcd documents its revision as a fencing token, and it grows with every write, so storage can compare. The random value in a Redis lock only proves ownership at release; it does not increase, so storage cannot tell older from newer. The cost of etcd is a quorum round trip per acquire.',
      },
    ],
  },
  {
    slug: 'leader-election',
    title: 'Leader Election',
    tagline: 'Agreeing on exactly one coordinator, and noticing when it dies.',
    category: 'distributed',
    difficulty: 'Advanced',
    keywords: ['raft', 'lease', 'heartbeat', 'split brain', 'failover'],
    what: 'Leader election is the process by which a cluster agrees on a single node to coordinate work: accept writes, assign partitions, or run a scheduled job.',
    why: 'A single leader removes coordination from the common path - only the leader decides. The hard part is detecting leader failure without two nodes both believing they won.',
    how: [
      'Nodes compete for a lease in a consensus store (etcd, ZooKeeper) or run a protocol like Raft.',
      'The leader renews its lease with heartbeats; missed heartbeats trigger a new election.',
      'A majority quorum is required to elect, which prevents two leaders during a partition.',
    ],
    diagram: `term 7: node B is leader, heartbeats every 150 ms
heartbeat missed for 500 ms -> candidates start term 8
node C gets votes from a majority -> leader for term 8
node B (if alive) sees a higher term and steps down`,
    tradeoffs: [
      {
        approach: 'Single leader',
        gains: ['Simple ordering of writes', 'No write conflicts'],
        costs: ['Leader is a throughput ceiling', 'Unavailable during election windows'],
      },
    ],
    mistakes: ['Electing on a timeout without quorum, which produces two leaders during a partition.'],
    related: ['consensus', 'partition-tolerance', 'failover', 'distributed-locks'],
  },
  {
    slug: 'consensus',
    title: 'Consensus',
    tagline: 'Getting a majority of nodes to agree on the same sequence of decisions.',
    category: 'distributed',
    difficulty: 'Advanced',
    keywords: ['raft', 'paxos', 'quorum', 'replicated log', 'etcd'],
    what: 'Consensus algorithms (Paxos, Raft, Zab) let a group of nodes agree on an ordered log of operations, even though some of them may crash or be unreachable.',
    why: 'It is the foundation under leader election, configuration stores, and strongly consistent databases. Agreement on order is what makes a replicated system behave like a single one.',
    how: [
      'A leader proposes entries; followers acknowledge; an entry commits once a majority stores it.',
      'A quorum of N/2+1 guarantees any two quorums overlap, so committed entries are never lost.',
      'Committed entries are applied to a state machine in the same order on every node.',
    ],
    diagram: `5 nodes, quorum = 3
proposal -> A,B,C acknowledge -> committed
partition {A,B,C} | {D,E}
  majority side keeps committing; minority cannot -> no divergence`,
    tradeoffs: [
      {
        approach: 'Consensus-backed state',
        gains: ['Linearizable, survives minority failures', 'No split brain'],
        costs: ['Every write pays a majority round trip', 'Throughput bound by the leader', 'Operationally sensitive (odd node counts, disk latency)'],
      },
    ],
    mistakes: [
      'Running consensus across regions and being surprised by write latency.',
      'Using an even number of nodes, which adds cost without improving fault tolerance.',
    ],
    related: ['leader-election', 'strong-consistency', 'partition-tolerance', 'cap-theorem'],
  },
  {
    slug: 'idempotency',
    title: 'Idempotency',
    tagline: 'Doing it twice must be the same as doing it once.',
    category: 'distributed',
    difficulty: 'Intermediate',
    keywords: ['retry', 'deduplication', 'exactly once', 'idempotency key', 'at least once'],
    what: 'An operation is idempotent if applying it multiple times has the same effect as applying it once.',
    why: 'Networks make duplicates unavoidable. A timeout does not tell you whether the request succeeded, so clients retry - and every retry risks a second charge, a second email, a second order.',
    how: [
      'Client generates a unique idempotency key per logical operation and sends it with every retry.',
      'The server stores the key with the result; a repeat key returns the stored result instead of re-executing.',
      'Prefer naturally idempotent designs: set a state ("status = paid") rather than apply a delta ("balance -= 10").',
      'Keys need a retention window long enough to cover realistic retry behaviour.',
    ],
    when: ['Payments, order creation, message consumers, webhooks - anything retried automatically.'],
    diagram: `POST /payments  Idempotency-Key: 8f2c-...
  -> 201 Created  charge_id=ch_77   (key stored with the result)
timeout, client retries the same key
  -> 200 OK       charge_id=ch_77   (no second charge)

"exactly once delivery" does not exist.
at-least-once delivery + idempotent processing = exactly-once effect`,
    tradeoffs: [
      {
        approach: 'Idempotency keys',
        gains: ['Safe retries', 'No distributed locks needed', 'Simple client contract'],
        costs: ['Storage for keys and results', 'Careful handling of concurrent duplicates', 'Key lifetime must be chosen'],
      },
    ],
    mistakes: [
      'Believing a queue gives exactly-once delivery and skipping deduplication.',
      'Making the key depend on a timestamp, so retries generate a new key.',
      'Treating PUT as idempotent while its handler appends to a list.',
    ],
    realWorld: ['Stripe, PayPal and most payment APIs require an idempotency key on create operations.'],
    related: ['retry', 'message-queues', 'exponential-backoff', 'outbox-pattern'],
    quiz: [
      {
        id: 'idem-1',
        prompt: 'A client times out after POST /orders and retries. Two orders are created. What is the fix?',
        options: [
          'Increase the client timeout',
          'Accept an idempotency key and return the original result for repeats',
          'Use a distributed lock around order creation',
          'Switch to GET requests',
        ],
        answer: 1,
        explanation:
          'The server cannot distinguish a retry from a new order without a key supplied by the client. Longer timeouts only shrink the window.',
      },
    ],
  },
];
