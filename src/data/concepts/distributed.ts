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
    keywords: ['lease', 'fencing token', 'redlock', 'zookeeper', 'mutual exclusion'],
    what: 'A distributed lock lets only one process in a cluster perform an action at a time, usually implemented as a key with a TTL in Redis, ZooKeeper or etcd.',
    why: 'Some operations must not run twice concurrently: charging a card, generating an invoice, compacting a file. Without coordination, two workers will eventually do it at the same time.',
    how: [
      'Acquire with an atomic set-if-not-exists plus an expiry (a lease).',
      'Hold the lock only for the critical section, and release it with a check that you still own it.',
      'Use a monotonically increasing fencing token and have the protected resource reject stale tokens.',
    ],
    diagram: `Worker 1 acquires lease (TTL 30s, token 41)
Worker 1 pauses (GC) for 40s -> lease expires
Worker 2 acquires lease (token 42) and writes
Worker 1 wakes and writes with token 41 -> storage rejects it (41 < 42)`,
    tradeoffs: [
      {
        approach: 'Lock-based mutual exclusion',
        gains: ['Simple mental model', 'Prevents duplicate work'],
        costs: ['A lock service outage blocks work', 'Clock skew and process pauses break naive locks', 'Adds latency to every protected operation'],
      },
      {
        approach: 'Idempotent operations instead of locks',
        gains: ['No coordination needed', 'Retries are harmless'],
        costs: ['Requires a natural idempotency key and deduplication storage'],
      },
    ],
    mistakes: [
      'Assuming a TTL-based lock guarantees exclusion - a paused process can wake up believing it still holds it.',
      'Using a lock for correctness where idempotency would be both simpler and safer.',
    ],
    related: ['idempotency', 'leader-election', 'consensus', 'redis'],
    quiz: [
      {
        id: 'dl-1',
        prompt: 'Why is a fencing token recommended with distributed locks?',
        options: [
          'It makes the lock faster',
          'It lets the protected resource reject writes from a holder whose lease already expired',
          'It encrypts the lock key',
          'It allows multiple holders',
        ],
        answer: 1,
        explanation:
          'A process can be paused past its lease. The increasing token lets storage reject the stale writer, which a TTL alone cannot do.',
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
