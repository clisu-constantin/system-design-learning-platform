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
    lab: 'redundancy',
    labFocus: 'availability',
    keywords: ['uptime', 'nines', 'redundancy', 'mtbf', 'mttr'],
    what: 'Availability is the share of time - or of requests - in which a system serves successfully, usually written in nines (99.9%, 99.99%).',
    why: 'Each extra nine allows ten times less downtime: 99.9% is about 8.8 hours a year, 99.99% about 52.6 minutes, 99.999% about 5 minutes. Naming a target decides whether you need redundancy, multi-zone deployment and automated failover.',
    how: [
      'Availability of components in series multiplies: two 99.9% dependencies give about 99.8%.',
      'Redundant copies multiply failure chances instead: two independent 99.9% copies are down together only 0.1% x 0.1% of the time.',
      'Availability is MTBF / (MTBF + MTTR), so recovering fast (MTTR) counts as much as failing less often (MTBF).',
      'Measure it as good requests over total requests, so partial failures count too.',
    ],
    diagram: `Series:   LB(99.99) x API(99.9) x DB(99.9)  ~= 99.79%  -> ~18 h/year
Redundant DB (two independent 99.9 nodes)   -> ~99.9999% for that tier,
                                               plus the failover time`,
    tradeoffs: [
      {
        approach: 'Chasing more nines',
        gains: ['Less user-visible downtime', 'Survives larger failures'],
        costs: ['Cost climbs steeply with each nine', 'More automation to test and maintain', 'Slower, more careful change, because deploys spend the budget', 'Often requires weaker consistency'],
      },
      {
        approach: 'Accepting fewer nines',
        gains: ['Cheaper and simpler: fewer copies, manual recovery can be enough', 'Faster change, with a larger error budget to spend'],
        costs: ['Hours of downtime a year that users will notice', 'Every incident is a full outage while a human recovers'],
      },
    ],
    mistakes: [
      'Counting only the application and ignoring dependencies, DNS and deploy-related downtime.',
      'Assuming two copies are independent when they share a rack, a zone or a deploy.',
      'Measuring whether the process was running instead of whether requests succeeded.',
    ],
    related: ['high-availability', 'redundancy', 'failover', 'slo'],
    quiz: [
      {
        id: 'avail-1',
        prompt:
          'A checkout request needs the load balancer (99.99%), the API (99.9%) and the database (99.9%) - all three, every time. Roughly what availability can checkout reach?',
        options: [
          '99.9% - the weakest part sets it',
          '99.99% - the best part sets it',
          'About 99.79% - the three availabilities multiply',
          'About 99.93% - the average of the three',
        ],
        answer: 2,
        explanation:
          'In series every part must work, so the chances multiply: 0.9999 x 0.999 x 0.999 is about 0.9979, roughly 18 hours of downtime a year. The weakest part is the tempting answer, but it is only an upper bound - each extra dependency adds its own downtime on top.',
      },
      {
        id: 'avail-2',
        prompt: 'The team promises 99.99% availability over a year. How much downtime does that allow?',
        options: ['About 8.8 hours', 'About 4.4 hours', 'About 5 minutes', 'About 52.6 minutes'],
        answer: 3,
        explanation:
          '0.01% of a year (525,960 minutes) is about 52.6 minutes. 8.8 hours is the budget of 99.9% and 4.4 hours of 99.95% - one nine less is ten times more downtime. 5 minutes is five nines.',
      },
      {
        id: 'avail-3',
        prompt:
          'For a whole day the service returns errors for 5% of requests, but the process never stops, so the uptime dashboard shows 100%. How should availability be measured?',
        options: [
          'As good requests over total requests - about 95% today',
          'Trust the uptime - the process was running',
          'By CPU usage',
          'Count only full outages longer than five minutes',
        ],
        answer: 0,
        explanation:
          'Users experienced one failure in twenty, whatever the process state. Counting successful requests over valid requests captures partial failures, which are far more common than total ones. Uptime of the process is the tempting number because it is easy to collect, but it hides exactly this.',
      },
      {
        id: 'avail-4',
        prompt:
          'In the Lab (Availability focus) every part is up 99%, and the design allows about 14.6 days of downtime a year. You switch Each part is up to 99.9%. What happens?',
        options: [
          'The downtime halves',
          'The downtime falls roughly tenfold, to under two days',
          'Nothing, because the design did not change',
          'The downtime falls to zero',
        ],
        answer: 1,
        explanation:
          'Each part is now down 0.1% instead of 1%, ten times less, so the product of the four parts loses about ten times less time. It is not exactly tenfold because the zone term does not change. That is the meaning of one more nine: ten times less downtime, not half.',
      },
      {
        id: 'avail-5',
        prompt:
          'The database tier gets a second node. Each node is up 99.9%, they fail independently, and failover is instant. What availability can the tier reach?',
        options: ['99.8%', '99.9%', 'About 99.9999%', '99.99%'],
        answer: 2,
        explanation:
          'The tier is down only when both nodes are down: 0.1% x 0.1% = 0.0001%, so about six nines. 99.8% is the series formula - it would apply if every request needed both nodes. Real failover is not instant, and each switch adds its own downtime on top of this number.',
      },
      {
        id: 'avail-6',
        prompt:
          'The same pair of database nodes fails over by hand: someone is paged and promotes the standby in about 30 minutes. The primary fails about 9 times a year. What dominates the downtime of the tier?',
        options: [
          'The 30-minute manual switch on every failure - about 4.5 hours a year',
          'The chance that both nodes are down at once',
          'Nothing - two nodes make it six nines',
          'The replication lag',
        ],
        answer: 0,
        explanation:
          'Both nodes down together happens about 0.0001% of the time - roughly 30 seconds a year. Nine manual failovers of 30 minutes each are about 4.5 hours. Redundancy only counts if failover is fast, which is why the Lab charges every failure its failover time.',
      },
      {
        id: 'avail-7',
        prompt:
          'A checkout page calls six services synchronously and measures 99.2%. Recommendations and loyalty points are not needed to place the order. What is usually the cheapest way to raise availability?',
        options: [
          'Make all six services more reliable',
          'Add retries with no limit to every call',
          'Add a seventh service that monitors the six',
          'Make recommendations and loyalty points soft: a timeout with a fallback, or send the work to a queue',
        ],
        answer: 3,
        explanation:
          'Every hard dependency multiplies availability down; removing it from the critical path removes a factor from the product. Making all six more reliable is slow and costly. Unlimited retries amplify load on a struggling service, and another service on the path is another factor, not a fix.',
      },
      {
        id: 'avail-8',
        prompt:
          'Two app servers, each 99.9%, sit in the same rack and receive every deploy at the same moment. The spreadsheet says the pair reaches 99.9999%. What is wrong?',
        options: [
          'Nothing - 0.1% squared is 0.0001%',
          'Six nines needs three copies',
          'The copies share a rack and a deploy, so they fail together and the squaring does not apply',
          'Racks are more reliable than servers, so it is even better',
        ],
        answer: 2,
        explanation:
          'The squared failure chance assumes the copies fail independently. A shared rack, zone or deploy is one failure that takes both at once, so the real number is closer to the availability of the rack or of the deploy process. Independence has to be engineered, for example with separate zones and rolling deploys.',
      },
      {
        id: 'avail-9',
        prompt:
          'The target is 99.9% of requests this quarter. Three weeks in, a bad deploy and a dependency outage have used 90% of the error budget. What does the error budget tell the team to do?',
        options: [
          'Ship faster to make up for lost time',
          'Slow down risky releases and spend the time on reliability until the budget recovers',
          'Lower the target to 99%',
          'Nothing - the budget resets next quarter',
        ],
        answer: 1,
        explanation:
          'An error budget turns a target into a rule: spend it on change while it lasts, then stop taking risk and fix reliability. Shipping faster spends a budget that is almost gone, and moving the target after missing it makes the number meaningless.',
      },
      {
        id: 'avail-10',
        prompt: 'An API runs at 99.95% today. The product manager asks for 99.999%. What is the honest first answer?',
        options: [
          'Add a second server and it is done',
          'Yes, with better monitoring',
          'It is impossible for any system',
          'That allows about 5 minutes of downtime a year, so no human step can be on any recovery path - it needs redundancy and automatic failover everywhere; does the business need that?',
        ],
        answer: 3,
        explanation:
          'Each nine allows ten times less downtime, and 5 minutes a year is shorter than a person needs to open a laptop. It is achievable for some systems, at a cost that grows with each nine, so the right first step is to price it against what the business actually needs. One more server or more monitoring does not change the recovery time.',
      },
    ],
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
