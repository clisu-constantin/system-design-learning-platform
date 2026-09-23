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
    lab: 'consensus',
    labFocus: 'leader-election',
    keywords: ['raft', 'lease', 'heartbeat', 'split brain', 'failover', 'term', 'split vote'],
    what: 'Leader election is the process by which a cluster agrees on a single node to coordinate work: accept writes, assign partitions, or run a scheduled job.',
    why: 'A single leader removes coordination from the common path - only the leader decides. The hard part is detecting leader failure without two nodes both believing they won.',
    how: [
      'Followers expect a heartbeat from the leader. One that hears nothing for its election timeout becomes a candidate.',
      'The candidate raises the term number, votes for itself and asks every other node for its vote.',
      'Each node grants one vote per term, and only to a candidate whose log is at least as up to date as its own.',
      'A majority of votes makes it leader, so two leaders can never win the same term. A leader that sees a higher term steps down.',
      'Election timeouts are randomised per node (150-300 ms in the Raft paper), so one candidate usually stands alone and wins in one round.',
      'Without writing a protocol: take a lease in etcd, ZooKeeper or a Kubernetes Lease. The holder renews it; when renewals stop, another node takes it after it expires.',
    ],
    when: [
      'One writer must order all changes: a database primary, a partition leader, a replicated log.',
      'Exactly one instance must run a job: a scheduler, a compaction, a Kubernetes controller.',
      'Work must be split without overlap: assigning partitions or shards to workers.',
    ],
    advantages: [
      'One node decides, so writes need no conflict resolution.',
      'A majority vote rules out two leaders in the same term, even during a partition.',
      'Failover is automatic: no human has to pick the new leader.',
    ],
    diagram: `5 nodes, majority = 3
term 7: Node A leads, heartbeat every 100 ms
Node A crashes -> heartbeats stop
Node B times out first (random 150-300 ms)
  -> term 8, votes for itself, asks A, C, D, E
C and D vote yes -> 3 of 5 -> B leads term 8
A restarts, sees term 8 and stays a follower`,
    tradeoffs: [
      {
        approach: 'Single leader',
        gains: ['Simple ordering of writes', 'No write conflicts'],
        costs: ['Leader is a throughput ceiling', 'Writes pause during detection plus election'],
      },
      {
        approach: 'Short election timeout',
        gains: ['A crashed leader is replaced quickly', 'Short write pause after a real failure'],
        costs: ['A GC pause or network hiccup triggers a needless election', 'Every needless election is a brief write outage'],
      },
      {
        approach: 'Long election timeout',
        gains: ['Stable leadership under load and pauses', 'Fewer elections to reason about'],
        costs: ['Longer write pause after a real crash', 'Slow to notice a leader that is gone'],
      },
      {
        approach: 'Lease from a coordination service (etcd, ZooKeeper, Kubernetes Lease)',
        gains: ['No election protocol to write or debug', 'Proven implementations'],
        costs: ['A dependency that must itself stay up', 'A paused holder can outlive its lease - the work needs a fencing token or must be idempotent'],
      },
    ],
    mistakes: [
      'Electing on a timeout without a majority, which produces two leaders during a partition.',
      'An election timeout below the worst GC pause, so a healthy leader keeps getting replaced.',
      'The same timeout on every node, which invites split votes.',
      'Assuming the old leader knows it was replaced - a paused or cut-off leader keeps acting until it sees a higher term.',
      'Writing your own election protocol instead of using etcd, ZooKeeper or the lease your platform provides.',
    ],
    realWorld: [
      'etcd and Consul run Raft; Kubernetes controllers pick one active instance through a Lease object.',
      'MongoDB replica sets elect their primary with a Raft-based protocol.',
      'Kafka has one leader replica per partition; since Kafka 4.0 its controllers agree on who leads with KRaft, a Raft variant.',
    ],
    related: ['consensus', 'partition-tolerance', 'failover', 'distributed-locks', 'leader-follower'],
    quiz: [
      {
        id: 'le-1',
        prompt:
          'A 5-node cluster loses its leader. Node B times out first and asks for votes. Nodes C and D vote for B; Node E has not answered yet. What happens?',
        options: [
          'B waits for E, because every live node must vote',
          'B becomes leader: its own vote plus C and D make 3 of 5, a majority',
          'B becomes leader only after the old leader confirms it is dead',
          'C and D must also stand as candidates to break the tie',
        ],
        answer: 1,
        explanation:
          'A majority is all it takes: 3 of 5, and the candidate counts its own vote. Waiting for every node is tempting but wrong - one crashed node would then block every election forever.',
      },
      {
        id: 'le-2',
        prompt:
          'A partition splits a 5-node cluster into {A, B} and {C, D, E}. A was the leader. In the Lab this is "Cut off the leader". What happens?',
        options: [
          'A keeps leading and the majority side waits for it',
          'Both sides elect a leader, accept writes and merge them after the partition heals',
          'C, D and E elect a new leader in a higher term; A still believes it leads, but can commit nothing',
          'The whole cluster stops until the partition heals',
        ],
        answer: 2,
        explanation:
          'The side with 3 of 5 can hold an election, so it does. A is not told it lost - it keeps acting as leader for its old term, but no entry of its reaches 3 copies. Two sides both accepting writes is exactly what the majority rule prevents.',
      },
      {
        id: 'le-3',
        prompt:
          'In the Lab you turn off "Randomised timeouts" and kill the leader. The Elections counter climbs and no leader appears for a long time. Why?',
        options: [
          'Every follower times out at almost the same moment, votes for itself, and nobody reaches a majority - a split vote, repeated',
          'The election timeout is too long for the cluster to recover',
          'The crashed leader still holds the votes of the others',
          'Five nodes cannot elect a new leader without the old one',
        ],
        answer: 0,
        explanation:
          'With equal timeouts the followers stand together, and each spends its one vote on itself. Randomised timeouts make one node usually stand alone and win before the others wake up. A longer timeout only delays the same tie.',
      },
      {
        id: 'le-4',
        prompt:
          'The leader freezes for 4 s in a garbage-collection pause; the election timeout is 1 s. The others elect a new leader for term 8. Then the old leader wakes up and sends heartbeats for term 7. What happens?',
        options: [
          'The followers accept them, and the cluster now has two working leaders',
          'The new leader steps down, because the old one was elected first',
          'The followers ignore it and it keeps sending heartbeats forever',
          'The followers reject them with term 8; the old leader sees the higher term and steps down',
        ],
        answer: 3,
        explanation:
          'The term number is a fence: any message from an older term is rejected, and the reply carries the newer term, which makes the old leader step down. Try "Pause the leader" in the Lab to watch it. Being first does not matter; the higher term wins.',
      },
      {
        id: 'le-5',
        prompt:
          'Your cluster re-elects its leader several times an hour, yet no node crashed. Logs show garbage-collection pauses of up to 800 ms, and the election timeout is 300 ms. What do you change?',
        options: [
          'Lower the timeout to 150 ms so failures are detected faster',
          'Add two more nodes to the cluster',
          'Raise the election timeout above the worst pause (and reduce the pauses), accepting a slower failover',
          'Turn heartbeats off during garbage collection',
        ],
        answer: 2,
        explanation:
          'A follower cannot tell a paused leader from a dead one, so a timeout shorter than your pauses replaces healthy leaders - each time a short write outage. A lower timeout makes it worse, and more nodes do not change the timing.',
      },
      {
        id: 'le-6',
        prompt: 'You run leader election on 4 nodes, and a partition splits them 2 and 2. What happens?',
        options: [
          'Neither side can collect 3 of 4 votes, so no leader is elected and writes stop',
          'Each side elects its own leader',
          'The side that holds the old leader keeps it and carries on',
          'The side with the lower node ids wins',
        ],
        answer: 0,
        explanation:
          'A majority of 4 is 3, and neither half has 3. That is why even sizes are avoided: 4 nodes tolerate one failure, like 3, and a clean 2-2 split leaves nobody in charge.',
      },
      {
        id: 'le-7',
        prompt:
          'Node C was slow and missed the last 20 committed log entries. The leader dies and C happens to time out first. Will C become leader?',
        options: [
          'Yes - the first node to time out always wins',
          'Yes, and it removes the 20 entries from every other node',
          'Only after it copies the missing entries from the dead leader',
          'No - voters with newer logs refuse it, so a node holding every committed entry wins instead',
        ],
        answer: 3,
        explanation:
          'Raft only grants a vote to a candidate whose log is at least as up to date as the voter log. Every committed entry sits on a majority, so C cannot collect a majority, and committed entries are never lost in a failover.',
      },
      {
        id: 'le-8',
        prompt:
          'Twelve replicas of a service each run an hourly report job, so the customer gets 12 reports. How do you make it run once, and keep running when a pod dies?',
        options: [
          'Run the job on replica 1 only',
          'Replicas compete for a Lease (etcd, ZooKeeper or Kubernetes); only the holder runs the job, and the report is keyed by hour so a rare overlap is harmless',
          'Let all 12 run and delete the duplicates by hand',
          'Add a random sleep before each run',
        ],
        answer: 1,
        explanation:
          'A fixed replica 1 is a single point of failure. The lease moves to another replica when the holder dies, and the unique key covers the moment when an old holder has not yet noticed it lost the lease.',
      },
      {
        id: 'le-9',
        prompt:
          'A worker holds a 15 s leader lease, pauses for 20 s, and wakes up still believing it leads - while another worker has taken the lease. What prevents damage?',
        options: [
          'Nothing is needed - a lease guarantees a single holder',
          'A longer lease',
          'A fencing token (such as the term or lease revision) that the storage checks, or writes that are idempotent',
          'Renewing the lease more often',
        ],
        answer: 2,
        explanation:
          'A lease only says who should lead; it cannot stop a paused process from acting on old beliefs. The storage rejecting a stale token is what makes the late write harmless. Longer or more frequent renewals shrink the window but never close it.',
      },
      {
        id: 'le-10',
        prompt:
          'Election timeouts are randomised between 1 and 2 s, and an election round takes about 50 ms. The leader crashes. Roughly how long can writes stall?',
        options: [
          'About 1 to 2 s: the time to notice (the timeout) plus the election',
          'About 50 ms: only the election itself',
          '0 ms: the followers take over at once',
          'Until an operator restarts the old leader',
        ],
        answer: 0,
        explanation:
          'Nobody can know the leader is gone until a timeout expires, so detection dominates the gap. The Lab shows it as "Time without a leader" after you kill the leader. The election itself is the short part.',
      },
      {
        id: 'le-11',
        prompt: 'A 3-node cluster loses 2 nodes. The survivor times out and stands for election. What happens?',
        options: [
          'It becomes leader with its own vote',
          'It becomes leader, but for reads only',
          'It waits one more timeout, then wins by default',
          'It never reaches 2 votes, so there is no leader and no writes until another node returns',
        ],
        answer: 3,
        explanation:
          'A majority of 3 is 2, whether or not the other nodes are dead: the survivor cannot tell a crash from a partition, and electing itself would risk two leaders. The cluster chooses to stop rather than split.',
      },
      {
        id: 'le-12',
        prompt:
          'During a partition a client keeps sending writes to the old leader on the minority side. What does the client see?',
        options: [
          'Success - the writes are merged when the partition heals',
          'Timeouts: the old leader appends the writes but never gets a majority to store them, so it never acknowledges them',
          'An instant error naming the new leader',
          'Success for small writes and errors for large ones',
        ],
        answer: 1,
        explanation:
          'The old leader does not know it was replaced, so it accepts the write - but commit needs a majority, which it cannot reach. In the Lab these entries stay dashed and "Writes timed out" climbs until the client finds the new leader.',
      },
    ],
  },
  {
    slug: 'consensus',
    title: 'Consensus',
    tagline: 'Getting a majority of nodes to agree on the same sequence of decisions.',
    category: 'distributed',
    difficulty: 'Advanced',
    lab: 'consensus',
    labFocus: 'consensus',
    keywords: ['raft', 'paxos', 'quorum', 'replicated log', 'etcd', 'majority', 'zab'],
    what: 'Consensus algorithms (Paxos, Raft, Zab) let a group of nodes agree on an ordered log of operations, even though some of them may crash or be unreachable.',
    why: 'It is the foundation under leader election, configuration stores, and strongly consistent databases. Agreement on order is what makes a replicated system behave like a single one.',
    how: [
      'Clients send writes to the leader, which appends each one to its log.',
      'The leader copies new entries to every follower; an entry commits once a majority stores it.',
      'A majority is floor(N/2) + 1 (2 of 3, 3 of 5), and any two majorities overlap, so a committed entry is never lost or contradicted.',
      'Every node applies committed entries in log order to its state machine, so all replicas end in the same state.',
      'If the leader fails, a new one is elected; the vote rule makes sure it already holds every committed entry.',
    ],
    when: [
      'Small, critical state that must never diverge: configuration, membership, locks, leader leases.',
      'The metadata core of a larger system: Kubernetes keeps its state in etcd, Kafka in its KRaft controllers.',
      'A strongly consistent database, where each shard or range runs its own consensus group.',
    ],
    advantages: [
      'Survives the loss of a minority of nodes without losing a committed write.',
      'No split brain: a minority can never commit anything.',
      'Every replica applies the same writes in the same order.',
    ],
    diagram: `5 nodes, majority = 3
leader appends entry 42 -> copies it to 4 followers
  2 followers store it -> 3 of 5 with the leader -> committed
partition {A,B,C} | {D,E}
  {A,B,C}: 3 of 5 -> keeps committing
  {D,E}:   2 of 5 -> cannot commit, so nothing diverges`,
    tradeoffs: [
      {
        approach: 'Consensus-backed state',
        gains: ['Committed writes survive minority failures', 'No split brain'],
        costs: ['Every write pays a majority round trip', 'Throughput bound by the leader', 'Operationally sensitive (odd node counts, disk latency)'],
      },
      {
        approach: '3 nodes',
        gains: ['Each write waits for only 1 follower', 'Fewest machines'],
        costs: ['Tolerates 1 failure - a node down for maintenance leaves no margin'],
      },
      {
        approach: '5 nodes',
        gains: ['Tolerates 2 failures, or 1 during maintenance'],
        costs: ['Each write waits for 2 followers', 'More machines and more messages'],
      },
      {
        approach: 'Quorum spread across regions',
        gains: ['Survives losing a whole region'],
        costs: ['Every write pays an inter-region round trip, tens to hundreds of ms', 'Election timeouts must grow with that latency'],
      },
      {
        approach: 'No consensus (asynchronous replication)',
        gains: ['Lowest write latency', 'Stays writable during a partition'],
        costs: ['Replicas can diverge and conflicts must be merged', 'An acknowledged write can be lost on failover'],
      },
    ],
    mistakes: [
      'Running consensus across regions and being surprised by write latency.',
      'Using an even number of nodes, which adds cost without improving fault tolerance.',
      'Storing bulk data (events, user content) in a consensus store built for small metadata.',
      'Reading a client timeout as "the write failed" - it may still commit, so retry with a request id.',
      'Expecting Raft or Paxos to survive nodes that lie: they tolerate crashes, not Byzantine faults.',
    ],
    realWorld: [
      'etcd (under Kubernetes) and Consul run Raft; ZooKeeper runs Zab.',
      'CockroachDB runs one Raft group per range; Google Spanner runs Paxos per split.',
      'Kafka 4.0 removed ZooKeeper: its metadata lives in KRaft, a Raft-based controller quorum.',
    ],
    related: ['leader-election', 'strong-consistency', 'partition-tolerance', 'cap-theorem', 'replication', 'idempotency'],
    quiz: [
      {
        id: 'cons-1',
        prompt:
          'In a 5-node cluster the leader appends an entry. Followers 1 and 2 store it; followers 3 and 4 are slow and have not answered. Is the entry committed?',
        options: [
          'Yes - the leader plus 2 followers is 3 of 5, a majority',
          'No - all 5 nodes must store it first',
          'No - 4 of 5 must store it, to tolerate one failure',
          'Only once the slow followers answer, even with a no',
        ],
        answer: 0,
        explanation:
          'Commit needs a majority, and the leader counts itself. Waiting for everyone is the tempting answer, but it would let one slow or dead node block every write - the point of a majority is not to wait for the stragglers.',
      },
      {
        id: 'cons-2',
        prompt: 'Your 3-node etcd cluster tolerates one failure. To be safer you add a fourth node. What did you gain?',
        options: [
          'Tolerance of two failures',
          'Faster writes, since there is one more node to answer',
          'No extra tolerance: a majority of 4 is 3, so it still survives only one failure - and each write now waits for one more node',
          'The ability to split 2 and 2 and keep both halves running',
        ],
        answer: 2,
        explanation:
          'Fault tolerance is N minus the majority: 3 - 2 = 1 and 4 - 3 = 1. Going to 5 nodes buys a second failure. A 2-2 split on four nodes leaves neither half with a majority, so nothing keeps running.',
      },
      {
        id: 'cons-3',
        prompt: 'A partition splits a 5-node cluster into {A, B, C} and {D, E}. Clients write on both sides. What happens?',
        options: [
          'Both sides commit, and the logs are merged when the partition heals',
          'The {A, B, C} side keeps committing; writes on the {D, E} side never commit, so the logs cannot diverge',
          'Both sides refuse writes until the partition heals',
          'The side with the most recent leader wins, whatever its size',
        ],
        answer: 1,
        explanation:
          'Only a group of 3 can commit, and there can be only one such group. The minority side may accept a write into a log, but it never commits - this is the CP choice from the CAP theorem, and the reason no merge is ever needed.',
      },
      {
        id: 'cons-4',
        prompt:
          'A team runs a 3-node etcd cluster with one node in Europe, one in the US and one in Asia. Kubernetes feels slow. What is the cause and the usual fix?',
        options: [
          'etcd is slow; replace it with a faster store',
          'Too few nodes; add two more in each region',
          'Heartbeats are too frequent; raise the heartbeat interval',
          'Every write waits for a cross-ocean round trip to a second node; put the three nodes in one region, in three availability zones',
        ],
        answer: 3,
        explanation:
          'Consensus makes every write pay the round trip to a majority. Across continents that is tens to hundreds of milliseconds per write. Three zones in one region keep round trips near 1 ms and still survive losing a zone; more distant nodes only add latency.',
      },
      {
        id: 'cons-5',
        prompt:
          'In the Lab (5 nodes) you kill three followers one after the other while writes flow. What do you see?',
        options: [
          'Writes keep committing, just more slowly',
          'The leader steps down after the first crash',
          'Writes commit while 2 are down; after the third crash new entries stay dashed and writes time out',
          'The cluster elects a second leader to share the load',
        ],
        answer: 2,
        explanation:
          'With 2 of 5 down, the leader and 2 followers still make 3. With 3 down only 2 are left, so no entry can reach a majority and the cluster refuses rather than risk diverging. It recovers as soon as one node restarts.',
      },
      {
        id: 'cons-6',
        prompt: 'A team wants to store 50,000 user click events per second in etcd, "because it never loses data". Good idea?',
        options: [
          'No - every write pays a majority round trip and lands on every node; consensus stores are built for small critical metadata, so use a log like Kafka or a database',
          'Yes - consensus makes it the safest place for any data',
          'Yes, if the cluster has 7 nodes',
          'Yes, if heartbeats are turned off for speed',
        ],
        answer: 0,
        explanation:
          'Consensus buys safety with latency and full copies on every node, which is worth it for configuration and leases, not for bulk events. More nodes make each write slower, not faster.',
      },
      {
        id: 'cons-7',
        prompt: 'To make writes faster, someone proposes committing an entry once any 2 of the 5 nodes store it. What breaks?',
        options: [
          'Nothing - 2 copies already survive one crash',
          'Two groups of 2 that share no node could each commit a different entry at the same index, so the replicas disagree',
          'Reads become slower',
          'Leader election stops working',
        ],
        answer: 1,
        explanation:
          'Safety comes from overlap: any two groups of 3 out of 5 share at least one node, which carries what was decided. Two groups of 2 can be disjoint - that is split brain. Surviving a crash is not the same as never contradicting yourself.',
      },
      {
        id: 'cons-8',
        prompt:
          'The leader stores a write on 3 of 5 nodes, commits it, and crashes before replying to the client. The client times out. What happened to the write?',
        options: [
          'It is lost, because the client got no answer',
          'It is rolled back by the next leader',
          'It is committed only if the old leader restarts',
          'It is committed and survives: the new leader must hold it - so the client should retry with a request id, to avoid applying it twice',
        ],
        answer: 3,
        explanation:
          'Committed means stored on a majority, and the vote rule means only a node with that entry can win. A timeout therefore does not mean failure; retrying blindly could apply it twice, which is why clients attach a unique request id.',
      },
      {
        id: 'cons-9',
        prompt:
          'In the Lab you choose "Cut off the leader". The old leader keeps appending the writes it receives, shown dashed. What happens to those entries when you heal the partition?',
        options: [
          'The new leader log overwrites them - they were never committed, and their clients already timed out',
          'They are merged into the new leader log',
          'They are committed, because the old leader accepted them first',
          'The new leader steps down and adopts them',
        ],
        answer: 0,
        explanation:
          'Entries that never reached a majority were never promised to anyone. When the old leader sees the higher term it steps down, and the Raft rule replaces the conflicting part of its log with the leader log. Only committed entries are permanent.',
      },
      {
        id: 'cons-10',
        prompt: 'A bug makes one node acknowledge entries it never stored. Does Raft protect the cluster?',
        options: [
          'Yes - the majority vote filters out any bad node',
          'Yes, as long as the cluster has 5 nodes',
          'No - Raft and Paxos assume nodes fail by stopping, not by lying; tolerating that needs a Byzantine fault tolerant protocol',
          'No, but adding an even number of nodes fixes it',
        ],
        answer: 2,
        explanation:
          'A false acknowledgement can complete a majority that does not really exist, so a committed entry could be lost. Crash-fault protocols trust every message. Byzantine fault tolerance needs 3f + 1 nodes and is used where participants do not trust each other.',
      },
      {
        id: 'cons-11',
        prompt:
          'A 5-node cluster: the leader round trip to its four followers is 1 ms, 1 ms, 2 ms and 40 ms (one follower is far away). About how long does a write take to commit, ignoring disk?',
        options: [
          'About 40 ms - the slowest follower',
          'About 1 ms - it needs the 2 fastest followers',
          'About 44 ms - the sum of all round trips',
          'About 0 ms - the leader commits alone',
        ],
        answer: 1,
        explanation:
          'The leader needs 2 followers besides itself, and the two 1 ms followers answer first. The distant node only matters if a nearby one fails - then writes jump to 2 ms, and with two nearby ones gone, to 40 ms.',
      },
      {
        id: 'cons-12',
        prompt:
          'After a partition heals, a healthy cluster briefly loses its leader, although the leader never failed. The two nodes that were cut off rejoin with a much higher term. Why, and what do real systems do?',
        options: [
          'The partition corrupted the leader log',
          'The leader crashed during the partition without anyone noticing',
          'Rejoining nodes always become the new leader',
          'While cut off, they kept timing out and raising their term; the higher term forces the leader to step down. Pre-vote (on by default in etcd since 3.5) makes a node check it could win before raising its term',
        ],
        answer: 3,
        explanation:
          'A node that cannot win still bumps its term on every timeout, and any higher term makes a leader step down. Pre-vote adds a round where the node first asks whether it could win, so an isolated node stops disrupting the cluster. The Lab has no pre-vote, so you can see this with "Cut off followers".',
      },
    ],
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
