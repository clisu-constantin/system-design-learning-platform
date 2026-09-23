import type { Concept } from '@/types';

export const distributedConcepts: Concept[] = [
  {
    slug: 'cap-theorem',
    title: 'CAP Theorem',
    tagline: 'During a network partition you choose: refuse the request, or answer with possibly stale data.',
    category: 'distributed',
    difficulty: 'Intermediate',
    lab: 'cap-theorem',
    labFocus: 'cap-theorem',
    keywords: ['consistency', 'availability', 'partition', 'cp', 'ap', 'pacelc'],
    what: 'CAP states that a distributed data store cannot simultaneously guarantee consistency, availability and partition tolerance. Since networks do partition, the real choice is between consistency (CP) and availability (AP) while a partition lasts.',
    why: 'It names the decision every replicated system must make in advance: when two nodes cannot talk to each other, does a write succeed and risk divergence, or fail and preserve a single truth?',
    how: [
      'Consistency here means linearizability: every read sees the latest acknowledged write.',
      'Availability means every request that reaches a non-failing node gets a non-error response.',
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
      'Cassandra is tunable per query (ONE, QUORUM, ALL); DynamoDB lets each read choose eventually or strongly consistent.',
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
          'Money needs a single truth, so a CP system refuses the writes it cannot make safely. Accepting on both sides and merging later is the tempting answer, but by then the same balance may have been spent twice. Shutting down everything is not needed: the majority side can keep serving.',
      },
      {
        id: 'cap-2',
        prompt:
          'Your store has a 99.99% uptime SLA, so the team calls it "AP". During a partition, one live replica answers writes it cannot replicate with a 503. In CAP terms, what is that 503?',
        options: [
          'Still CAP-available, because the SLA allows a few errors',
          'A loss of partition tolerance',
          'A loss of CAP availability: a non-failing node answered with an error',
          'Proof that the replica crashed',
        ],
        answer: 2,
        explanation:
          'CAP availability means every request to a non-failing node gets a non-error response. A live replica returning 503 is exactly the CP choice. An uptime SLA is a different, statistical promise - meeting it does not make a system AP.',
      },
      {
        id: 'cap-3',
        prompt:
          'In the Lab, 3 replicas are split 2 | 1 and the store is in CP mode. Client B keeps sending reads and writes to side B. What does client B get?',
        options: [
          'A 503 for every request, while side A keeps serving',
          'Its writes are queued and applied on side B at once',
          'Stale reads, but its writes succeed',
          'The same answers as client A, only slower',
        ],
        answer: 0,
        explanation:
          'Side B holds 1 of 3 replicas and cannot reach a majority, so in CP mode it refuses reads and writes alike. "Stale reads but writes succeed" describes neither mode: AP would accept both, CP refuses both.',
      },
      {
        id: 'cap-4',
        prompt:
          'In the Lab you switch to AP mid-partition, both clients write several times, then you heal the partition. What happens to the writes?',
        options: [
          'Both sides keep their own value until an operator decides',
          'The heal fails until the conflict is resolved by hand',
          'All writes from both sides are merged into one value',
          'Last-write-wins keeps the newest version and silently drops the writes the other side acknowledged',
        ],
        answer: 3,
        explanation:
          'A single value cannot hold both histories, so last-write-wins keeps the newest one and discards the rest - the Lab counts them under "Writes lost at heal". A merge of both sides only happens if you choose a data type that can merge, such as a CRDT or a set union for a cart.',
      },
      {
        id: 'cap-5',
        prompt:
          'A colleague says: "We run in one cloud region, so partitions cannot happen - our database is CA." What do you answer?',
        options: [
          'Agreed - CA is the right label inside one region',
          'Partitions happen inside a region too (a switch, a firewall rule, a long pause), so a multi-node store still chooses CP or AP',
          'CA is fine as long as backups are taken every hour',
          'Partition tolerance only matters for multi-cloud setups',
        ],
        answer: 1,
        explanation:
          'Any two machines talking over a network can be cut off from each other, in one region or not. A multi-node system cannot opt out of partitions; only its behaviour during one is a choice. CA only describes a single node, which is not a distributed system.',
      },
      {
        id: 'cap-6',
        prompt:
          'The network is healthy, yet each write to your 3-region store takes 120 ms more than a single-region write, because it waits for a quorum across regions. Which framing explains this?',
        options: [
          'CAP: the store is behaving as AP',
          'A partition that nobody has noticed',
          'PACELC: without a partition you still trade latency for consistency',
          'The network is misconfigured; consistent writes are free when it is healthy',
        ],
        answer: 2,
        explanation:
          'CAP says nothing about the healthy network. PACELC adds the everyday half: Else, choose Latency or Consistency. The 120 ms is the price of the quorum round trip, not a fault to fix.',
      },
      {
        id: 'cap-7',
        prompt: 'A shop has a like counter, a shopping cart and the stock count for the last unit of an item. Which assignment fits?',
        options: [
          'All three CP, to be safe',
          'All three AP, to stay fast',
          'Likes CP, cart CP, stock AP',
          'Likes AP, cart AP with a merge, last-unit stock CP',
        ],
        answer: 3,
        explanation:
          'CAP is decided per operation. A stale like count harms nobody and a lost cart item costs a sale, so both stay available; selling the last unit twice needs one truth. Making everything CP pays latency and errors where nothing is at risk.',
      },
      {
        id: 'cap-8',
        prompt: 'Your team chooses AP for the shopping cart. What else must be decided before shipping?',
        options: [
          'Nothing - AP stores resolve conflicts correctly by themselves',
          'How conflicting cart changes from both sides are merged when the partition heals',
          'Which side of a partition should return errors',
          'How to make every read linearizable',
        ],
        answer: 1,
        explanation:
          'Choosing AP invites conflicting writes, so it also means choosing how they are reconciled - for a cart, usually the union of items. Leaving it to the store default often means last-write-wins, which silently drops an item. Returning errors is the CP choice, not part of AP.',
      },
      {
        id: 'cap-9',
        prompt:
          'In CP mode, the minority side of a partition refuses reads as well as writes. A developer asks why it does not at least serve reads from its own copy. What do you answer?',
        options: [
          'It cannot know whether the majority side accepted newer writes, so its copy may be stale',
          'Reading would corrupt its data',
          'Reads need a leader, and the leader is always on the majority side',
          'It could - refusing reads is just a performance optimisation',
        ],
        answer: 0,
        explanation:
          'A linearizable read must return the latest acknowledged write. Cut off from the majority, the minority side cannot tell whether it has it, so it refuses. A system may choose to serve such reads, but then they are no longer consistent in the CAP sense.',
      },
      {
        id: 'cap-10',
        prompt:
          'In the Lab, CP mode, partitioned: side A shows v7 and side B shows v4, yet the "Consistent" metric says Yes. How can that be?',
        options: [
          'The metric is only updated after the partition heals',
          'v4 and v7 hold the same data',
          'Side B refuses every request, so no client can read v4',
          'Side B forwards its reads to side A across the partition',
        ],
        answer: 2,
        explanation:
          'Consistency is about what clients can observe. Side B still stores the old v4, but in CP mode it answers every request with a 503, so the stale copy is never served. Forwarding across the partition is impossible - that is what a partition means.',
      },
      {
        id: 'cap-11',
        prompt:
          'A Cassandra table has 3 replicas and uses QUORUM for reads and writes. One replica is cut off from the other two, and a client reaches only that replica. What happens?',
        options: [
          'The request succeeds with the local value',
          'The request fails: 2 of 3 replicas cannot be reached; at consistency level ONE it would succeed, possibly stale',
          'Cassandra waits until the partition heals, however long it takes',
          'Cassandra promotes that replica to leader',
        ],
        answer: 1,
        explanation:
          'QUORUM needs 2 of 3 replicas to answer, and only 1 is reachable, so the request fails - CP behaviour for that query. At ONE the same request succeeds from one replica and may be stale - AP behaviour. Cassandra has no leader to promote; the consistency level is chosen per query.',
      },
    ],
  },
  {
    slug: 'consistency',
    title: 'Consistency',
    tagline: 'What a reader is promised about what a writer did.',
    category: 'distributed',
    difficulty: 'Intermediate',
    lab: 'cap-theorem',
    labFocus: 'consistency',
    keywords: ['linearizability', 'monotonic reads', 'read your writes', 'causal', 'models'],
    what: 'A consistency model is the contract between the store and its clients about which values a read may return given the writes that happened before it.',
    why: 'Most real bugs in distributed systems are a mismatch between the model people assume and the one the system provides.',
    how: [
      'Linearizable: reads always see the latest committed write. Strongest and most expensive.',
      'Causal: if one write caused another, nobody sees the effect without the cause.',
      'Read-your-writes: a client sees its own writes, but not necessarily others.',
      'Monotonic reads: a client never sees time go backwards.',
      'Eventual: replicas converge if writes stop - with no bound on when.',
    ],
    when: [
      'Linearizable for the few operations that must never be wrong: moving money, the last unit of stock, a unique username, a lock.',
      'Read-your-writes, monotonic reads or causal for most user-facing data - they remove the bugs users notice at a fraction of the cost.',
      'Eventual for counters, feeds and analytics, where a value a few seconds old harms nobody.',
    ],
    diagram: `write(x=2) ack
   |
   +-- linearizable:      every reader sees 2 immediately
   +-- read-your-writes:  the writer sees 2; others may see 1
   +-- eventual:          everyone sees 2 ... eventually`,
    tradeoffs: [
      {
        approach: 'Stronger model (linearizable)',
        gains: ['Simple application code', 'No surprising stale data', 'Invariants like "never oversell" can be enforced'],
        costs: ['Coordination on every operation (a quorum round trip)', 'Errors on the minority side during a partition'],
      },
      {
        approach: 'Middle models (causal, read-your-writes, monotonic reads)',
        gains: ['Remove the anomalies users notice', 'Little coordination - often just routing a session'],
        costs: ['Other users may still see older data', 'Cannot enforce a global invariant such as a unique username'],
      },
      {
        approach: 'Weaker model (eventual)',
        gains: ['Lowest latency', 'Every replica keeps answering during a partition'],
        costs: ['Stale reads with no time bound', 'Conflicting writes must be reconciled'],
      },
    ],
    mistakes: [
      'Specifying consistency once for the whole system instead of per operation.',
      'Reading from a lagging replica right after a write, so users think their change did not save.',
      'Confusing ACID consistency (constraints hold) with replica consistency (copies agree).',
    ],
    related: ['strong-consistency', 'eventual-consistency', 'cap-theorem'],
    quiz: [
      {
        id: 'consistency-1',
        prompt:
          'A user changes their avatar. The page reloads and still shows the old one; after another refresh it is correct. What is missing, and what is the cheap fix?',
        options: [
          'Linearizability - make every read in the product go through a quorum',
          'Read-your-writes - route reads of that user to the primary for a few seconds after a write',
          'Causal consistency - put avatars and posts in one partition',
          'Nothing - this is correct eventual behaviour and cannot be improved',
        ],
        answer: 1,
        explanation:
          'The read after the write hit a replica that had not caught up yet. Read-your-writes only needs the writer to see its own change, so pinning that user to the primary briefly is enough. Making every read linearizable fixes it too, but pays a quorum round trip on every read in the product.',
      },
      {
        id: 'consistency-2',
        prompt: 'An unread badge shows 3, then 5, then 3 again on consecutive page loads. Which guarantee is being violated?',
        options: [
          'Read-your-writes',
          'Linearizability of writes',
          'Monotonic reads - consecutive requests hit replicas with different lag',
          'ACID consistency',
        ],
        answer: 2,
        explanation:
          'Time went backwards for one reader: two requests landed on replicas lagging by different amounts. Keeping the session on one replica fixes it. Read-your-writes is about seeing your own writes; here the user wrote nothing.',
      },
      {
        id: 'consistency-3',
        prompt:
          'In a chat app, a reply sometimes appears before the message it answers. The two messages live in different partitions. Which model would prevent this?',
        options: [
          'Causal consistency - the effect is never shown without its cause',
          'Monotonic reads',
          'Eventual consistency with a shorter replication delay',
          'A bigger cache in front of the database',
        ],
        answer: 0,
        explanation:
          'The reply was caused by the message, and causal consistency guarantees nobody sees the effect first. A shorter delay only makes the bug rarer - eventual consistency still allows any order while replicas catch up.',
      },
      {
        id: 'consistency-4',
        prompt:
          'Two customers in different regions both buy the last concert ticket, and both get a confirmation. Which fix matches the problem?',
        options: [
          'Monotonic reads for the ticket page',
          'Read-your-writes for each customer',
          'A longer cache TTL on the stock count',
          'A linearizable operation for the stock decrement, such as a compare-and-set',
        ],
        answer: 3,
        explanation:
          'Both buyers read "1 left" and both decremented. Preventing it needs one agreed order of the two operations - linearizability - for this operation only. Session guarantees like read-your-writes only protect one user from themselves; they say nothing about two users racing.',
      },
      {
        id: 'consistency-5',
        prompt:
          'In the Lab (AP, partitioned, client A writes and client B reads), client B reads v1 although side A has already acknowledged v3. Which model is the store giving client B?',
        options: [
          'Linearizable - the read happened before the write',
          'Eventual - the sides converge only once the partition heals',
          'Read-your-writes',
          'Causal',
        ],
        answer: 1,
        explanation:
          'The write was acknowledged before the read, so a linearizable store would have to return v3. Side B answers from its own copy and catches up only after the heal - that is eventual consistency. Read-your-writes does not apply: client B never wrote anything.',
      },
      {
        id: 'consistency-6',
        prompt: 'Now you switch the same Lab to CP. What does client B get instead of the stale v1?',
        options: [
          'v3, fetched across the partition',
          'v1, marked as stale',
          'A 503: side B cannot reach a majority, so it refuses rather than return a value that may be old',
          'A random value from either side',
        ],
        answer: 2,
        explanation:
          'Linearizable reads cost availability on the minority side: side B cannot confirm it has the latest value, so it refuses. It cannot fetch v3 because the partition is exactly what stops it talking to side A.',
      },
      {
        id: 'consistency-7',
        prompt:
          'Your database rejects an insert because it would break a foreign key. A colleague says: "That is the consistency CAP is about." Is it?',
        options: [
          'No - that is the C of ACID (constraints hold); CAP consistency is about replicas agreeing on the latest value',
          'Yes - both mean the data is correct',
          'Yes - foreign keys are how replicas stay in sync',
          'No - CAP consistency is about transactions being isolated',
        ],
        answer: 0,
        explanation:
          'The two words share a name and nothing else. ACID consistency means the database never breaks its own rules; distributed consistency is a promise about which value a read returns. Isolation is the I of ACID, a third idea again.',
      },
      {
        id: 'consistency-8',
        prompt:
          'Your store is linearizable across 3 regions and every write pays about 150 ms for the cross-region quorum. Product wants likes to feel instant. What do you propose?',
        options: [
          'Keep likes linearizable and buy faster servers',
          'Make the whole store eventually consistent',
          'Remove one region so the quorum is smaller',
          'Use a weaker model for likes and keep linearizable writes for the few operations that need them',
        ],
        answer: 3,
        explanation:
          'Consistency is chosen per operation. A like count a second old harms nobody, so it can skip the quorum; payments and stock keep it. Faster servers do not shorten the speed of light between regions, and weakening the whole store gives up the guarantees that money needs.',
      },
      {
        id: 'consistency-9',
        prompt:
          'A store promises "eventual consistency" and writes arrive non-stop, many per second. What does the promise tell you about when a reader will see a given write?',
        options: [
          'Within one second',
          'Nothing bounded - it only promises replicas converge once writes stop',
          'After the next write',
          'Immediately, on the replica that took the write, and never on the others',
        ],
        answer: 1,
        explanation:
          'Eventual consistency has no time bound. In practice lag is usually small, but "usually small" is a measurement, not a guarantee. If you need a bound, measure replication lag and alert on it, or ask for a stronger model.',
      },
      {
        id: 'consistency-10',
        prompt:
          'A user edits a document on a laptop, then opens it on a phone a second later and sees the old version. The phone reads from a replica. What fixes it without making every read linearizable?',
        options: [
          'Ask the user to wait before switching devices',
          'Sticky routing of the phone to one replica',
          'Carry the version of the last write in the user session, and let the replica wait until it has at least that version',
          'Disable caching on the phone',
        ],
        answer: 2,
        explanation:
          'Read-your-writes across devices needs the read to know what the user already wrote. A version (logical timestamp) carried with the session lets the replica wait until it has caught up. Sticky routing only gives monotonic reads for one device - the phone was never on the replica the laptop wrote to.',
      },
      {
        id: 'consistency-11',
        prompt:
          'To be safe, a team configures strong consistency as one global setting for the whole product. What does that cost?',
        options: [
          'Nothing - stronger is always safe',
          'Only disk space',
          'It weakens durability of writes',
          'Every operation pays coordination latency and becomes unavailable on the minority side of a partition, even where stale data is harmless',
        ],
        answer: 3,
        explanation:
          'Linearizability is paid on every operation: a quorum round trip, and errors when a quorum cannot be reached. That is worth it for money and stock, and pure cost for a view counter. Durability is a separate property and is not weakened.',
      },
    ],
  },
  {
    slug: 'availability',
    title: 'Availability',
    tagline: 'The share of time the system answers successfully - and what it takes to raise it.',
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
    lab: 'cap-theorem',
    labFocus: 'partition-tolerance',
    keywords: ['network partition', 'split brain', 'quorum', 'fencing', 'witness'],
    what: 'Partition tolerance is the ability to keep operating when messages between nodes are delayed or lost, splitting the cluster into groups that cannot talk to each other.',
    why: 'Partitions are a fact of networks - a switch fails, a cable is cut, a firewall rule changes, a node pauses. A design that ignores them fails in the worst possible way: two halves both believing they are in charge.',
    how: [
      'Use quorums: only a majority group may accept writes, so two halves cannot both proceed.',
      'Fence the old leader (revoke its access or lease) before promoting a new one.',
      'Decide explicitly what the minority side does: read-only, queue locally, or return errors.',
      'Size clusters with an odd number of nodes (3 or 5), so a split usually leaves one side with a majority.',
    ],
    when: [
      'Always, in any system with more than one node: the only choice is what happens during a partition, not whether one happens.',
      'Add a witness (a voter that holds no data) when a deployment spans exactly two data centres.',
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
      'Two-node clusters: a partition leaves neither side a majority, so the cluster either stops or risks split brain.',
      'Adding a fourth node for safety: a majority of 4 is 3, so it tolerates the same single failure as 3 nodes.',
      'Promoting a new primary without fencing the old one.',
      'Failure-detection timeouts shorter than the worst GC pause, so a paused node is declared dead.',
    ],
    related: ['cap-theorem', 'consensus', 'leader-election', 'failover'],
    quiz: [
      {
        id: 'partition-1',
        prompt: 'A 5-node cluster splits into a group of 3 and a group of 2. Clients are connected to both groups. Which group may accept writes?',
        options: [
          'Both, and they reconcile after the partition heals',
          'Only the group of 3, because it holds a majority',
          'Only the group of 2, because it has less load',
          'Neither, until an operator decides',
        ],
        answer: 1,
        explanation:
          'Only one majority can exist, so letting only the group of 3 write guarantees that two sides never both act. Letting both write is the AP choice - it keeps everyone working but invites split brain and conflicts to reconcile.',
      },
      {
        id: 'partition-2',
        prompt:
          'You run a database as a 2-node cluster with automatic failover. The link between the two nodes fails. What are your options?',
        options: [
          'Both nodes keep writing safely, because each holds a full copy',
          'Each node checks whether the other is alive, and safely takes over if it is not',
          'Either both stop accepting writes, or one or both proceed and risk split brain - a third voter (a witness) removes the dilemma',
          'Nothing happens, because 2 nodes is a majority',
        ],
        answer: 2,
        explanation:
          'A majority of 2 is 2, so a 1 | 1 split gives neither side a majority. Stopping is safe but unavailable; proceeding risks two primaries. "Take over if the other looks dead" is exactly how both become primary, since each sees the other as dead. A witness is the cheap third vote.',
      },
      {
        id: 'partition-3',
        prompt:
          'To be safer, the team grows a 3-node cluster to 4. In the Lab, you set 4 replicas and partition the network. What do you see, and what does it teach?',
        options: [
          'A 2 | 2 split with no majority anywhere: in CP mode both sides refuse. A 4th node adds cost, not failure tolerance',
          'Side A keeps serving, because 4 nodes always leave a majority',
          'Both sides keep serving, because 4 nodes tolerate 2 failures',
          'The Lab adds a leader to break the tie',
        ],
        answer: 0,
        explanation:
          'A majority of 4 is 3, so 4 nodes tolerate one failure - the same as 3 - and an even split leaves no side able to act. That is why clusters use 3 or 5 nodes. Tolerating 2 failures needs 5.',
      },
      {
        id: 'partition-4',
        prompt:
          'A primary pauses for 9 seconds in garbage collection. After 5 seconds the other nodes elect a new primary. The old one wakes up and tries to write to shared storage. What prevents corrupted data?',
        options: [
          'A longer heartbeat interval',
          'The old primary notices the pause and stops itself',
          'Quorum alone - the old primary is outvoted',
          'A fencing token: the storage has seen a newer epoch and rejects the write carrying the old one',
        ],
        answer: 3,
        explanation:
          'Quorum decided the new leader, but the old one does not know it was deposed - from its own view nothing happened. The resource itself must refuse stale leaders, and a monotonically increasing fencing token lets it do that.',
      },
      {
        id: 'partition-5',
        prompt: 'Node A stops receiving heartbeats from node B. What can node A know for certain?',
        options: [
          'Node B has crashed',
          'Nothing certain: node B may have crashed, paused, or be alive behind a broken network',
          'The network is broken, because nodes rarely crash',
          'Node B will be back within the timeout',
        ],
        answer: 1,
        explanation:
          'A crashed node and an unreachable one look exactly the same from outside. That is why safe designs decide with a majority vote and fencing, not by guessing which one happened.',
      },
      {
        id: 'partition-6',
        prompt:
          'The failure-detection timeout is 2 seconds, and the database regularly has 6-second garbage collection pauses. What will you see?',
        options: [
          'Nothing - GC pauses are not partitions',
          'Faster recovery from real crashes, with no downside',
          'False failovers: paused nodes are declared dead and replaced while still alive',
          'The pauses shrink to fit the timeout',
        ],
        answer: 2,
        explanation:
          'To the rest of the cluster a paused node is indistinguishable from a partitioned one. With a timeout below the worst pause, healthy nodes are voted out and leadership flaps. Raise the timeout above the worst pause, or cut the pauses.',
      },
      {
        id: 'partition-7',
        prompt:
          'In a 3 | 2 split, product wants the 2-node minority side to keep showing product pages. Which minority behaviour allows that while keeping writes safe?',
        options: [
          'Read-only: serve reads from the local copy (possibly stale) and refuse writes',
          'Accept writes locally and replay them later',
          'Return an error for every request',
          'Promote one of the two to leader',
        ],
        answer: 0,
        explanation:
          'Serving possibly stale reads keeps pages up, and refusing writes keeps the majority as the only side that changes data. Accepting writes on the minority is the AP choice and brings conflicts; promoting a leader there creates two leaders.',
      },
      {
        id: 'partition-8',
        prompt:
          'In the Lab, with the partition in place, you switch from CP to AP and both clients keep writing. Which real failure does this reproduce if a cluster has no quorum rule?',
        options: [
          'A cache stampede',
          'A slow disk',
          'A retry storm',
          'Split brain: both sides accept writes, the copies diverge, and the heal has to discard or merge writes',
        ],
        answer: 3,
        explanation:
          'Two sides acting as the authority is split brain. The Lab shows the bill at heal time: last-write-wins silently drops the writes one side acknowledged, counted under "Writes lost at heal".',
      },
      {
        id: 'partition-9',
        prompt:
          'A misapplied firewall rule blocks traffic between two subnets of your cluster for 3 minutes. Every process stays up and healthy. Is this a partition?',
        options: [
          'No - a partition needs a cut cable',
          'No - it is a crash, because nodes stopped answering',
          'Yes - live nodes that cannot reach each other is exactly a partition',
          'Only if it lasts longer than 5 minutes',
        ],
        answer: 2,
        explanation:
          'Most partitions are soft: a firewall rule, a saturated link, a routing change. What makes it a partition is live nodes that cannot talk, not the cause. Nothing crashed here.',
      },
      {
        id: 'partition-10',
        prompt:
          'A company runs 2 nodes in data centre X and 2 in data centre Y. The link between X and Y fails. The cluster uses majority quorum. What happens, and what is the usual fix?',
        options: [
          'X keeps working because it was first',
          'Neither side has 3 of 4 votes, so writes stop; a witness in a third location gives one side the majority',
          'Both sides keep working because each has 2 nodes',
          'The cluster automatically removes one node from each side',
        ],
        answer: 1,
        explanation:
          'With 4 voters a majority is 3, and a 2 | 2 split leaves both sides at 2. A light witness in a third site breaks the tie: whichever side still reaches it has 3 of 5 votes. Letting both sides continue would be split brain.',
      },
    ],
  },
  {
    slug: 'strong-consistency',
    title: 'Strong Consistency',
    tagline: 'Every read returns the latest committed write, always.',
    category: 'distributed',
    difficulty: 'Intermediate',
    lab: 'replication',
    labFocus: 'strong-consistency',
    keywords: ['linearizable', 'quorum', 'serializable', 'coordination', 'synchronous replication', 'compare-and-set'],
    what: 'Under strong consistency (linearizability) the system behaves as if there were a single copy of the data and operations happened one at a time in a global order. Once a write is acknowledged, every later read returns it or something newer.',
    why: 'It removes an entire class of bugs. Invariants like "the balance never goes negative" or "this username is unique" can only be enforced with a single agreed-upon truth.',
    how: [
      'Route all writes through a leader, and require a quorum of replicas to store each write before it is acknowledged.',
      'Coordinate reads too: read from the leader (with a lease or a quorum check), or read from a quorum.',
      'Or replicate synchronously to every replica before acknowledging, so any replica can serve a current read - at the price that one unreachable replica blocks writes.',
      'The cost is one or more network round trips per operation, and refusing service when no quorum can be reached.',
    ],
    when: ['Payments, inventory, bookings, unique identifiers, permissions, locks.'],
    advantages: [
      'Compare-and-set, uniqueness and locks work as written.',
      'No user ever sees a value go backwards or miss their own write.',
      'Application code does not need conflict or staleness handling for this data.',
    ],
    diagram: `write -> leader -> replicate to quorum -> ack
read  -> leader (or quorum) -> guaranteed latest value
cost: 1+ extra round trips, unavailable to the minority during a partition`,
    tradeoffs: [
      {
        approach: 'Quorum writes with leader or quorum reads (consensus)',
        gains: ['Invariants hold', 'Survives the loss of a minority of replicas'],
        costs: ['A round trip to a majority on every write, especially slow across regions', 'The minority side of a partition must refuse service'],
      },
      {
        approach: 'Synchronous replication to every replica',
        gains: ['Any replica can serve a current read', 'No acknowledged write is lost on failover'],
        costs: ['Every write waits for the slowest replica', 'One unreachable replica stops all writes'],
      },
      {
        approach: 'Strong only for the few operations that need it',
        gains: ['Coordination is paid only where disagreement causes damage', 'Everything else stays fast and available'],
        costs: ['Two consistency models to reason about', 'Someone must decide, per operation, which one applies'],
      },
    ],
    mistakes: [
      'Making everything strongly consistent, and paying cross-region latency to show a profile picture.',
      'Waiting for replicas on writes but reading from any replica with no check, and calling it strong.',
      'Treating serializable and linearizable as the same promise.',
      'Treating the errors on the minority side of a partition as a bug instead of the guarantee working.',
    ],
    related: ['eventual-consistency', 'consistency', 'replication', 'consensus', 'cap-theorem', 'distributed-locks'],
    quiz: [
      {
        id: 'sc-1',
        prompt:
          'Two users redeem the same one-time voucher at the same instant. Each request reads status = unused from a different replica of an eventually consistent store, then writes status = used. What happens, and what prevents it?',
        options: [
          'The second write fails automatically',
          'Both succeed and the voucher is used twice - use a compare-and-set against one strongly consistent copy, so only one update matches',
          'Only the faster region succeeds, because it wrote first',
          'The store merges the two writes into one',
        ],
        answer: 1,
        explanation:
          'Both saw the same pre-state, so both passed the check. A conditional update such as UPDATE ... WHERE id = 9 AND status = unused on a strongly consistent store lets exactly one request change the row; the other changes zero rows and is refused. "Wrote first" means nothing when the copies disagree.',
      },
      {
        id: 'sc-2',
        prompt:
          'The Lab opens on Sync with reads on the replicas, and "Reads behind" shows 0%. Why can a read from a replica never be behind here?',
        options: [
          'Replicas are faster than the primary',
          'The read rate is low',
          'Reads secretly go to the primary',
          'A write is acknowledged only after every replica has applied it, so no replica can miss an acknowledged write',
        ],
        answer: 3,
        explanation:
          'Strong consistency is about acknowledged writes: once a client is told "saved", every later read must see it. Waiting for every replica before the acknowledgement makes that true on every copy. The price is visible in Write latency, which waits for the slowest replica.',
      },
      {
        id: 'sc-3',
        prompt:
          'Still in the Lab on Sync, you kill Replica 2. Writes are refused until you recover it. Is that a flaw of strong consistency?',
        options: [
          'Yes - a correct system would keep accepting writes',
          'No - it is the guarantee working: without every copy, the system refuses rather than let copies disagree',
          'Yes - the primary should have been promoted',
          'No - the refused writes will be applied later automatically',
        ],
        answer: 1,
        explanation:
          'Accepting the write would leave Replica 2 without it, and a later read there would be stale. Refusing keeps the promise. Quorum systems soften this by waiting for a majority instead of every replica, so they tolerate a minority failing - but they refuse too once no majority is reachable.',
      },
      {
        id: 'sc-4',
        prompt:
          'In the Lab you switch from Sync to Semi-sync. "Lost writes" stays 0 after you kill the primary, but "Reads behind" climbs above 0%. What does that show?',
        options: [
          'Semi-sync is broken',
          'Semi-sync is strongly consistent',
          'Durability and consistent reads are different promises: the write is safe on two machines, but the other replicas are still behind',
          'Stale reads only happen after a failover',
        ],
        answer: 2,
        explanation:
          'Waiting for one replica makes acknowledged writes survive a single failure, so nothing is lost. Reads from the replicas that were not awaited can still miss the newest write. Strong consistency needs the read side coordinated too - read from the leader or a quorum, or wait for every replica.',
      },
      {
        id: 'sc-5',
        prompt:
          'A five-node consensus cluster is split by a partition into a group of 3 and a group of 2. A client can only reach the group of 2. What should it get?',
        options: [
          'An error or a timeout - the group of 2 has no majority, so it cannot accept writes or promise a current read',
          'The latest data, served by the group of 2',
          'A successful write that is merged later',
          'A new leader elected by the group of 2',
        ],
        answer: 0,
        explanation:
          'A majority of 5 is 3. The group of 3 can keep working; the group of 2 cannot know what the majority has committed since the split, so it must refuse. Electing a leader on both sides would create two histories, exactly what the majority rule prevents.',
      },
      {
        id: 'sc-6',
        prompt:
          'A strongly consistent database has its quorum spread over Virginia, Frankfurt and Singapore. Users complain every save takes about 150 ms, even when nothing is failing. What is happening?',
        options: [
          'A bug - latency should only rise during failures',
          'The disks are slow',
          'The cache is cold',
          'Every write waits for a round trip to a majority, and the majority spans continents - the cost is paid on every write, forever',
        ],
        answer: 3,
        explanation:
          'Coordination is not a failure-time cost. A write is acknowledged only after a majority has stored it, so the latency floor is the round trip to the slowest member of that majority. Keeping the quorum inside one region, and making only the operations that need it strong, brings it back to a few milliseconds.',
      },
      {
        id: 'sc-7',
        prompt:
          'Which of these operations most needs strong consistency?',
        options: [
          'Showing the number of likes on a post',
          'Allocating a unique username at sign-up',
          'Displaying a profile picture',
          'Listing search results',
        ],
        answer: 1,
        explanation:
          'If two people claim the same username at the same instant on different continents and both succeed, the system is wrong - that is the test. A like count or a profile picture being a second old harms nobody, so paying coordination there buys nothing.',
      },
      {
        id: 'sc-8',
        prompt:
          'One seat is left. Two customers click Book at the same instant, and both requests run UPDATE seats SET remaining = remaining - 1 WHERE flight = 9 AND remaining > 0 on the same strongly consistent database. What happens?',
        options: [
          'Both succeed and remaining becomes -1',
          'Both fail with a deadlock',
          'Exactly one updates a row; the other updates zero rows and is told the seat is sold out',
          'The database asks the customers to retry together',
        ],
        answer: 2,
        explanation:
          'The condition and the decrement happen as one operation on one agreed copy, so only one request can see remaining = 1. The other sees 0 and changes nothing. On an eventually consistent counter both could read 1 in different places and both succeed.',
      },
      {
        id: 'sc-9',
        prompt:
          'In the Lab on Sync, you drag Network delay to replicas from 100 ms to 1000 ms. What happens to Write latency and Reads behind?',
        options: [
          'Write latency rises to over 1 s; Reads behind stays at 0%',
          'Write latency stays at 8 ms; Reads behind rises',
          'Both stay the same',
          'Both rise',
        ],
        answer: 0,
        explanation:
          'Synchronous replication turns network delay into write latency: the write waits for the slowest replica, so it now takes over a second. Consistency is untouched - reads are still never behind. Async would show the opposite: fast writes, rising Reads behind.',
      },
      {
        id: 'sc-10',
        prompt:
          'A database advertises serializable transactions. A client commits a transfer, then a second client immediately reads the balance on another connection. Does serializability alone promise the second client sees the transfer?',
        options: [
          'Yes - serializable means every read sees the latest commit',
          'No - serializable only means transactions behave as if run one at a time in some order; seeing the latest commit in real time is linearizability, and both together is strict serializability',
          'Yes, but only on the primary',
          'No - serializable transactions are never visible to other clients',
        ],
        answer: 1,
        explanation:
          'Serializability allows an order in which the read comes before the transfer, even if it happened later in real time. Linearizability is the real-time promise about single operations. Many databases give both (strict serializability), but the words are not interchangeable, and relying on the wrong one causes subtle bugs.',
      },
    ],
  },
  {
    slug: 'eventual-consistency',
    title: 'Eventual Consistency',
    tagline: 'Replicas converge - if you stop writing long enough.',
    category: 'distributed',
    difficulty: 'Intermediate',
    lab: 'replication',
    labFocus: 'eventual-consistency',
    keywords: ['convergence', 'conflict resolution', 'crdt', 'last write wins', 'lag', 'read-your-writes', 'monotonic reads'],
    what: 'Eventual consistency guarantees only that, absent new writes, all replicas eventually hold the same value. It says nothing about when, or what a reader sees in the meantime.',
    why: 'It buys availability and low latency: a replica can answer immediately without asking anyone else. For likes, view counts, feeds and presence, that is the right trade.',
    how: [
      'Writes are accepted locally and propagated asynchronously.',
      'Conflicts are resolved by a rule: last-write-wins with timestamps, version vectors, or a CRDT that merges deterministically.',
      'Client-side session guarantees (read-your-writes, monotonic reads) can hide most of the weirdness.',
    ],
    when: ['Counters, feeds, caches, cross-region reads, offline-capable clients.'],
    advantages: [
      'Writes and reads complete locally, without waiting for other replicas.',
      'Every replica keeps serving during a partition.',
      'Read capacity scales with the number of replicas.',
    ],
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
      {
        approach: 'Eventual consistency plus session guarantees',
        gains: ['Users see their own writes and never see values go backwards', 'Keeps most of the local speed'],
        costs: ['Routing or sticky sessions to maintain', 'Other users can still see old values'],
      },
    ],
    mistakes: [
      'Using last-write-wins for data where a lost update is unacceptable.',
      'Clock skew making "last" meaningless - use logical clocks or version vectors.',
      'Sending each read to a random replica, so a user sees a value and then an older one.',
      'Using eventual consistency for money or stock, where two replicas can both approve the last unit.',
    ],
    related: ['strong-consistency', 'consistency', 'cap-theorem', 'replication', 'read-replicas', 'idempotency'],
    quiz: [
      {
        id: 'ec-1',
        prompt:
          'The Lab opens with async replication and 1500 ms of network delay, and a large share of reads are behind. You drag Write rate to 0. What happens over the next two seconds?',
        options: [
          'Nothing - stale replicas stay stale until restarted',
          'Every replica applies the writes still in flight and they all reach the same version: the copies converge',
          'The primary rolls back to match the replicas',
          'Reads are refused until the replicas catch up',
        ],
        answer: 1,
        explanation:
          'That is exactly the promise: if writes stop, all replicas eventually hold the same value. Behind drops to 0 on every node. Nothing is refused and nothing rolls back - the replicas simply finish applying what the primary already sent.',
      },
      {
        id: 'ec-2',
        prompt:
          'A like counter is stored as a single number on three replicas with last-write-wins. Two replicas each accept a like at the same moment, both writing 101 over 100. After they sync, what is the count?',
        options: [
          '102 - both likes are kept',
          '100 - both likes are dropped',
          '101 - one like is silently lost; a CRDT counter that keeps a count per replica and sums them would keep both',
          'The store reports a conflict to the user',
        ],
        answer: 2,
        explanation:
          'Last-write-wins keeps one whole value, so one of the two increments disappears without any error. A counter CRDT stores one count per replica and adds them, so concurrent increments merge instead of overwriting. The data shape decides the merge.',
      },
      {
        id: 'ec-3',
        prompt:
          'During a 3-minute partition, a customer adds a hat to their cart in Europe and removes a scarf in the US. The cart is stored as one document with last-write-wins. What happens when the partition heals?',
        options: [
          'Both changes survive automatically',
          'The cart is emptied',
          'The user is asked to choose',
          'One whole document replaces the other, so either the hat or the scarf removal is lost',
        ],
        answer: 3,
        explanation:
          'Last-write-wins on a whole document throws away the concurrent change in the other copy. Modelling the cart as a set that keeps adds and recorded removals (tombstones) lets both changes merge: the hat is in, the scarf is out.',
      },
      {
        id: 'ec-4',
        prompt:
          'Two replicas use last-write-wins by wall-clock timestamp. The clock of Replica B runs 3 seconds behind. A user changes a setting on A, then 1 second later changes it again on B. Which value wins?',
        options: [
          'The first change, on A - its timestamp looks 2 seconds newer, so the real latest change is discarded',
          'The second change, on B - it happened later',
          'Both are kept',
          'Neither - the replicas refuse the write',
        ],
        answer: 0,
        explanation:
          'Last-write-wins trusts timestamps, and the skewed clock makes the later change look older. That is why "last" is unreliable across machines, and why logical clocks or version vectors are used to detect what really happened concurrently.',
      },
      {
        id: 'ec-5',
        prompt:
          'An online shop keeps stock counts in an eventually consistent store replicated across two regions. One unit is left and two customers in different regions buy it at the same moment. What should the design do?',
        options: [
          'Nothing - the replicas will converge',
          'Show approximate stock from the fast store, but make the purchase itself a strongly consistent reservation',
          'Use last-write-wins on the stock count',
          'Add a third region',
        ],
        answer: 1,
        explanation:
          'Both regions can see 1 and both can sell it; converging later just discovers the oversell. Be approximate in the display and exact at the decision point: one strongly consistent check at checkout, with everything else staying eventual.',
      },
      {
        id: 'ec-6',
        prompt:
          'In the Lab, "Own save not seen" is high: users reload right after saving and get the old value. Which change fixes that for them without making the whole system strongly consistent?',
        options: [
          'Switch to synchronous replication',
          'Turn off the replicas',
          'Turn on read-your-writes routing, so a user who just saved reads from the primary',
          'Lower the read rate',
        ],
        answer: 2,
        explanation:
          'Read-your-writes is a session guarantee: it covers the one user who wrote, which is who notices. Everyone else still reads replicas and still sees slightly old data, which they cannot tell. Synchronous replication also fixes it, but makes every write wait for every replica.',
      },
      {
        id: 'ec-7',
        prompt:
          'A dashboard reads from replicas. An engineer sees a count of 540, refreshes, and sees 512, then 560. Nothing was deleted. What guarantee is missing?',
        options: [
          'Monotonic reads - each refresh hit a different replica with a different lag; keeping the user on one replica stops values going backwards',
          'Durability - the database lost 28 events',
          'Strong consistency for all writes',
          'Nothing - that is a bug in the dashboard',
        ],
        answer: 0,
        explanation:
          'Each replica is internally fine but at a different point in the stream. Pinning a session to one replica means it may lag, but it never jumps back. Nothing was lost: all replicas will reach 560 and beyond.',
      },
      {
        id: 'ec-8',
        prompt:
          'In the Lab, async mode with a long delay, you kill the primary and "Lost writes" rises. A colleague says: "That is impossible, the system is eventually consistent." Who is right?',
        options: [
          'The colleague - eventual consistency means no write is ever lost',
          'Neither - the Lab counts reads, not writes',
          'The colleague - the writes will appear after the lag',
          'The Lab - eventual consistency promises the copies converge, not that every acknowledged write survives; they converge on the promoted replica, which never had those writes',
        ],
        answer: 3,
        explanation:
          'Convergence is about the copies agreeing, not about which history they agree on. With async single-leader replication, writes that had not left the dead primary are gone, and every replica converges on a history without them. Waiting for the lag does not help - the source is dead.',
      },
      {
        id: 'ec-9',
        prompt:
          'Two regions are cut off from each other for 10 minutes. An eventually consistent store keeps serving in both. What happens during and after the partition?',
        options: [
          'Both regions refuse writes until the link is back',
          'Only the larger region accepts writes',
          'Both regions keep accepting reads and writes; when the link returns they exchange changes and resolve any conflicting writes with their merge rule',
          'The regions become two separate databases forever',
        ],
        answer: 2,
        explanation:
          'Staying available on both sides is exactly what eventual consistency buys. The bill arrives afterwards: writes to the same item on both sides are conflicts, and the merge rule - last-write-wins, version vectors or a CRDT - decides what survives. Refusing writes would be the strongly consistent choice.',
      },
      {
        id: 'ec-10',
        prompt:
          'A shipping service receives status updates through an eventually consistent pipeline that may deliver them twice or out of order. Which update format keeps every replica correct?',
        options: [
          '"Add 1 to the delivered count" - simple and small',
          '"Set status to shipped, version 7" - applied only if newer than the stored version, so duplicates and old updates are ignored',
          '"Toggle the delivered flag"',
          '"Set status to the next step"',
        ],
        answer: 1,
        explanation:
          'An idempotent, versioned update gives the same result however often and in whatever order it arrives. "Add 1" doubles on a duplicate, "toggle" flips back on a duplicate, and "next step" depends on order. Designing operations like this removes most of the sharp edges of eventual consistency.',
      },
    ],
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
    lab: 'idempotency',
    keywords: ['retry', 'deduplication', 'exactly once', 'idempotency key', 'at least once'],
    what: 'An operation is idempotent if applying it multiple times has the same effect as applying it once.',
    why: 'Networks make duplicates unavoidable. A timeout does not tell you whether the request succeeded, so clients retry - and every retry risks a second charge, a second email, a second order.',
    how: [
      'Client generates a unique idempotency key per logical operation (the intent, not the attempt) and sends it with every retry.',
      'The server inserts the key as in progress, does the work, and stores the result with the key - the key row and the effect commit in one transaction.',
      'A repeat that finds a completed key gets the stored result instead of a second execution; one that finds the key still in progress gets 409 and retries shortly.',
      'Prefer naturally idempotent designs: set a state ("status = paid") rather than apply a delta ("balance -= 10").',
      'Keys need a retention window long enough to cover realistic retry behaviour - 24 hours to a few days is common.',
    ],
    when: [
      'Payments, order creation, message consumers, webhooks - anything that is retried automatically and has a side effect.',
      'Any POST or PATCH that a client, proxy or queue may repeat after a timeout.',
    ],
    advantages: [
      'Retries become safe, so clients, proxies and queues can retry freely.',
      'At-least-once delivery plus idempotent processing gives an exactly-once effect.',
      'A repeat gets the same answer as the first attempt, so the client sees one consistent result.',
    ],
    diagram: `POST /payments  Idempotency-Key: 8f2c-...
  -> 201 Created  charge_id=ch_77   (key stored with the result)
response lost, client times out, retries the same key
  -> 201 Created  charge_id=ch_77   (stored response replayed)
                                     (no second charge)

"exactly once delivery" does not exist.
at-least-once delivery + idempotent processing = exactly-once effect`,
    tradeoffs: [
      {
        approach: 'Idempotency key with stored response',
        gains: [
          'Safe retries for any operation, including charging a card',
          'A repeat gets the identical stored answer',
          'Simple client contract: one key per intent',
        ],
        costs: [
          'A keys table to store and prune',
          'Key and effect must commit in one transaction',
          'Concurrent repeats need an in-progress state (409)',
          'A retry after the retention window is a new operation',
        ],
      },
      {
        approach: 'Natural unique key (unique constraint)',
        gains: ['The database enforces it for every writer, including retries nobody planned for', 'No extra table or client contract'],
        costs: [
          'Only works where the data already has a uniqueness rule',
          'The repeat gets a constraint error to turn into success, not the original response',
        ],
      },
      {
        approach: 'Absolute state instead of deltas',
        gains: ['Repeats are harmless by construction', 'Nothing to store'],
        costs: ['Some effects cannot be a target state (charge a card, send an email)', 'Needs control of the API shape'],
      },
      {
        approach: 'No retries (at most once)',
        gains: ['Never a duplicate', 'Nothing to store'],
        costs: ['A lost response turns a success into an error the user sees', 'A lost request is simply lost'],
      },
    ],
    mistakes: [
      'Believing a queue gives exactly-once delivery and skipping deduplication.',
      'Generating a new key for every attempt (or deriving it from a timestamp), so each retry is a new operation.',
      'Recording the key and the effect in separate transactions, so a crash between them leaves them disagreeing.',
      'Replaying a stored result for a request whose body differs from the original, instead of rejecting it.',
      'Treating PUT as idempotent while its handler appends to a list.',
    ],
    realWorld: [
      'Stripe accepts an Idempotency-Key header on every POST, saves the status code and body of the first request, and may prune keys once they are at least 24 hours old.',
      'The IETF Idempotency-Key header draft answers 409 for a repeat that arrives while the first request is still running, and 422 for a key reused with a different body.',
      'Webhook and queue consumers dedupe by event or message id, because delivery is at-least-once.',
    ],
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
          'The server cannot tell a retry from a new order unless the client sends a key that names the order. A longer timeout only shrinks the window - a slow enough response still times out. A lock does not help either: the two requests run one after the other, so each takes the lock in turn and each creates an order.',
      },
      {
        id: 'idem-2',
        prompt:
          'In the Idempotency Lab with No key, a response is lost on the network wire and the client retries. What had the server already done for the first attempt?',
        options: [
          'Written the charge - only the answer was lost',
          'Nothing - a lost response means the request failed',
          'Rolled the charge back when the response was lost',
          'Marked the payment so the retry is skipped',
        ],
        answer: 0,
        explanation:
          'The response is lost after the work is done: the charge row is already in the charges table. That is exactly why the retry charges again. Nothing rolls back - the server does not know the answer never arrived, and with no key it has nothing to recognise the retry by.',
      },
      {
        id: 'idem-3',
        prompt:
          'Your mobile app puts a fresh UUID in the Idempotency-Key header right before every HTTP call, retries included. Customers are still charged twice now and then. Why?',
        options: [
          'UUIDs collide too often for payments',
          'The keys table is too slow to answer in time',
          'Each retry carries a key the server has never seen, so it is a new payment',
          'The server must also compare the amount',
        ],
        answer: 2,
        explanation:
          'The key must name the intent (one tap of Pay), not the attempt. A new key per attempt is the same as no key: in the Lab, New per try inserts a new key row and charges again on every retry. Random UUIDs practically never collide, so collisions are not the cause.',
      },
      {
        id: 'idem-4',
        prompt:
          'A user double-taps Pay. Both requests carry the same key and arrive 100 ms apart, while the first is still charging the card. What should the second request get?',
        options: [
          'A second charge, because the first has not finished',
          'The stored result of the first request',
          'Nothing at all - the server drops it silently',
          '409 Conflict - the key is in progress, retry shortly',
        ],
        answer: 3,
        explanation:
          'There is no stored result yet, so there is nothing to replay. The key row says in progress, and the IETF Idempotency-Key draft answers that case with 409; the client retries a moment later and gets the stored result. Charging again is the bug the key exists to prevent, and a silent drop leaves the client waiting for a timeout. This is what Double-tap Pay shows in the Lab.',
      },
      {
        id: 'idem-5',
        prompt:
          'A handler inserts the key as in progress, writes the charge row and commits, then marks the key completed in a second transaction. The process crashes between the two commits. What happens when the client retries?',
        options: [
          'The key is found completed and the stored result is replayed',
          'The key is stuck in progress with no stored result, so the retry can never be answered from it',
          'The database rolls back the charge',
          'Nothing, because the client already has the response',
        ],
        answer: 1,
        explanation:
          'The charge committed but the key never reached completed, so the two disagree: every retry finds in progress and nothing to replay, and clearing the key by hand would charge again. The charge already committed, so nothing rolls it back, and the client never got a response - that is why it retries. Commit the charge and the completed key in one transaction.',
      },
      {
        id: 'idem-6',
        prompt:
          'PUT /carts/42/items appends the item in the body to the cart. A proxy retries the PUT after a timeout. What happens?',
        options: [
          'The item is added once, because HTTP makes PUT idempotent',
          'The proxy never retries a PUT',
          'The item is added twice: the handler breaks the idempotent meaning of PUT that the proxy relied on',
          'The server returns 409',
        ],
        answer: 2,
        explanation:
          'RFC 9110 defines PUT as idempotent, which is exactly why clients and proxies feel free to retry it. But the method name promises nothing about your code: a handler that appends runs twice and adds the item twice. Make the handler replace the stored state, as PUT intends.',
      },
      {
        id: 'idem-7',
        prompt: 'You design the endpoint that marks an order as shipped. Which shape stays correct if the call is repeated?',
        options: [
          'PATCH /orders/9 with { status: "shipped" }',
          'POST /orders/9/advance-status',
          'POST /orders/9/status-steps with { add: 1 }',
          'Any of them, if the client never retries',
        ],
        answer: 0,
        explanation:
          'Setting a target state is idempotent: shipped twice is still shipped. Advancing or adding a step is a delta - run twice it skips to the next status. Relying on no retries does not hold: timeouts, proxies and queues repeat calls anyway.',
      },
      {
        id: 'idem-8',
        prompt:
          'A consumer reads "add 10 loyalty points" messages from a queue with at-least-once delivery. After a crash and redelivery, some customers got 20 points. What fixes it?',
        options: [
          'Acknowledge each message before processing it',
          'Store each message id in a processed table in the same transaction as the points, and skip ids already seen',
          'Add more consumers so crashes matter less',
          'Retry the points update until it succeeds',
        ],
        answer: 1,
        explanation:
          'At-least-once delivery means duplicates will arrive; idempotent processing turns them into an exactly-once effect. Acknowledging first swaps duplicates for lost messages (at most once): a crash after the ack loses the points. More consumers or more retries only make redelivery more likely.',
      },
      {
        id: 'idem-9',
        prompt:
          'Your server keeps idempotency keys for 24 hours. A phone that was offline for 3 days comes back and retries a payment with its original key. What happens?',
        options: [
          'The stored result is replayed, since keys identify the intent',
          'The request is rejected with 409',
          'The phone generates a new key automatically',
          'The key has been pruned, so the server treats it as a new payment and may charge again',
        ],
        answer: 3,
        explanation:
          'A key only protects retries inside its retention window. Stripe documents the same: a key reused after it was pruned starts a new request. Either keep keys longer than realistic retries, or make the client stop retrying past the window and check the payment status instead.',
      },
      {
        id: 'idem-10',
        prompt:
          'A client bug reuses the key of a 20 dollar payment from yesterday for a new 50 dollar payment today, inside the retention window. What should the server do?',
        options: [
          'Replay the stored 20 dollar result',
          'Charge 50 dollars under the same key',
          'Reject the request, because its body differs from the original request for that key',
          'Delete the old key and start again',
        ],
        answer: 2,
        explanation:
          'A key names one intent, so a different body under the same key is a client bug. Replaying the 20 dollar result is the tempting wrong answer: the client would believe the 50 dollar payment succeeded. Stripe compares the parameters and returns an error; the IETF draft uses 422.',
      },
      {
        id: 'idem-11',
        prompt:
          'To stop double charges, a teammate proposes never retrying payments: one attempt only (Max attempts 1 in the Lab). What does that cost?',
        options: [
          'Nothing - one attempt means one charge, and a lost response just means the payment failed',
          'When a response is lost, the user sees an error for a payment that went through',
          'Payments become slower',
          'The keys table fills up faster',
        ],
        answer: 1,
        explanation:
          'At most once swaps duplicates for uncertainty: the charge happened, only the answer was lost, so the user sees an error and may pay again by hand. A lost response does not mean a failed payment - that confusion is the whole problem. Keys let you keep retries and still charge once.',
      },
      {
        id: 'idem-12',
        prompt:
          'After a failover, the monthly invoice job sometimes runs twice for the same month. What is the simplest guard that stays correct?',
        options: [
          'A distributed lock around the job',
          'A cron schedule that never overlaps',
          'A unique constraint on (customer_id, month), treating the duplicate insert as already done',
          'Logging a warning when the job runs twice',
        ],
        answer: 2,
        explanation:
          'A natural unique key lets the database reject the second invoice for every writer, even one nobody planned for. A lock with a lease can expire while the first run is still going, so two runners can overlap; a schedule cannot stop a failover from starting a second run.',
      },
    ],
  },
];
