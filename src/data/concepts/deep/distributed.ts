import type { DepthMap } from './types';

export const distributedDepth: DepthMap = {
  'cap-theorem': {
    analogy: {
      title: 'Two shops, one phone line, and it just went dead',
      body:
        'Two branches share a stock list by phone. The line goes down. Each branch must now choose: keep selling and risk selling the same last item twice (available, possibly wrong), or refuse to sell until the line is back (consistent, but closed). Nobody gets to choose "the line never goes down" - that is the part CAP says is not on the menu.',
    },
    deepDive: [
      {
        heading: 'The theorem states less than people think',
        paragraphs: [
          'CAP says: when a network partition occurs, a distributed system must choose between consistency (every read sees the latest write) and availability (every request gets a non-error response). That is the whole claim. It is a statement about behaviour during a partition, not a general ranking of systems.',
          'The famous "pick two of three" phrasing is misleading, because partition tolerance is not optional. Networks fail, cables are cut, switches reboot, and a partition will happen. A system that is not partition tolerant simply breaks when one occurs, so in practice you are choosing between CP and AP - between refusing service and serving possibly stale data.',
          'The other thing CAP does not say: it says nothing about normal operation. When the network is healthy, a well-built system can be both consistent and available. Almost the entire life of a system is spent in that state, which is why CAP is a design-time question about the failure mode, not a daily constraint.',
        ],
        code: {
          caption: 'The only real choice, drawn',
          body: `network is healthy      -> you can have C and A. CAP says nothing.

PARTITION: node A and node B cannot talk

  CP  both refuse writes they cannot confirm
      -> no wrong answers, some requests fail
      -> banking, inventory, unique constraints

  AP  both keep accepting writes locally
      -> always answers, answers may conflict and need merging
      -> feeds, carts, likes, presence, DNS`,
        },
      },
      {
        heading: 'PACELC: the half of the story CAP leaves out',
        paragraphs: [
          'CAP only describes partitions, but the interesting trade-off happens the rest of the time too. PACELC extends it: if there is a Partition, choose Availability or Consistency; Else, choose Latency or Consistency. That second clause is the one you feel every day.',
          'Keeping replicas strongly consistent requires coordination on every write - a quorum round trip, at minimum. Within one datacenter that is a millisecond; across continents it is 150. So even with a perfectly healthy network, strong consistency has a latency price, and choosing weaker consistency is usually a choice about speed, not about failure.',
          'This reframes many design discussions. "Should the cart be eventually consistent?" is rarely about surviving a partition - it is about whether adding an item should wait for three regions to agree. Stated that way, the answer is usually obvious.',
        ],
      },
      {
        heading: 'Choose per operation, not per system',
        paragraphs: [
          'The most useful practical move is to stop labelling the whole system. A single product almost always contains both kinds of operation: a like count that may be seconds stale with no harm, and a payment that may never double-charge. Applying one global setting to both means either paying unnecessary latency or accepting unacceptable errors.',
          'Many modern databases make this explicit with per-query consistency levels: Cassandra lets you read and write at ONE, QUORUM or ALL; DynamoDB offers eventually consistent or strongly consistent reads at different prices. That knob is where CAP becomes a line of code rather than a philosophy.',
          'And when you choose availability, decide what happens to the conflicts you are inviting. Last-write-wins silently discards data. Version vectors detect conflicts so the application can merge. CRDTs merge automatically for specific data shapes. Choosing AP without choosing a conflict policy means the policy is "whatever the database happens to do".',
        ],
        bullets: [
          'Payments, inventory decrements, unique usernames - CP. Refusing is better than being wrong.',
          'Feeds, view counts, presence, recommendations - AP. Stale is better than blank.',
          'Shopping carts - AP with merge, because losing a cart costs a sale.',
          'If you choose AP, name the conflict resolution: last-write-wins, vector clocks, or a CRDT.',
        ],
      },
    ],
    examples: [
      {
        title: 'One partition, two correct behaviours',
        setup:
          'A retailer runs in two regions. The link between them fails for four minutes. Two features behave differently, on purpose.',
        walkthrough: [
          'Product reviews (AP): each region keeps accepting and showing reviews written locally. Readers in EU do not see the new US reviews for four minutes. Nobody is harmed; when the link returns, both sets merge because reviews are append-only.',
          'Inventory for the last item (CP): the stock counter requires a quorum. During the partition, the minority region cannot reach a quorum and refuses to confirm the sale, returning "try again" instead.',
          'Cost of the CP choice: some customers in the minority region could not buy for four minutes. Cost of the AP alternative: two customers buy the same physical item, and somebody has to apologise and refund.',
          'The cart (AP with merge): both regions accept cart changes. On healing, carts are merged by union - an item added in either region is present. Losing a cart item would cost more than showing an extra one.',
          'None of this needed a company-wide answer to "are we CP or AP". It needed three separate decisions with three different costs.',
        ],
        result:
          'The same partition produced a refused sale, a merged cart and a delayed review - all correct. Consistency is a per-operation product decision, and CAP is the framework for asking the question, not the answer to it.',
      },
    ],
    jargon: [
      { term: 'Partition', plain: 'Nodes that are all alive but cannot reach each other over the network.' },
      { term: 'CP / AP', plain: 'During a partition: refuse rather than be wrong, or answer rather than refuse.' },
      { term: 'PACELC', plain: 'CAP plus the everyday trade-off: without a partition, you still choose latency or consistency.' },
      { term: 'Quorum', plain: 'A majority of replicas. Requiring one is how a system stays consistent during failures.' },
      { term: 'Split brain', plain: 'Both sides of a partition acting as the authority, producing divergent data.' },
      { term: 'Conflict resolution', plain: 'How divergent writes are reconciled once the partition heals.' },
    ],
    remember: [
      'CAP describes behaviour during a partition, nothing else.',
      'Partition tolerance is not optional, so the real choice is CP or AP.',
      'PACELC adds the everyday trade: consistency costs latency even when the network is fine.',
      'Decide per operation - one system normally contains both kinds.',
      'Choosing AP means choosing a conflict resolution strategy, explicitly.',
    ],
  },

  consistency: {
    analogy: {
      title: 'Whether everyone in the building sees the same noticeboard',
      body:
        'You pin a notice in reception. Does someone on the fourth floor see it immediately, a minute later, or possibly never in the order it was posted? Consistency is the set of promises about what readers see after a write. Strong means everyone sees it at once; weaker models trade that certainty for speed and for the ability to keep working when floors are cut off.',
    },
    deepDive: [
      {
        heading: 'Consistency is a spectrum of promises, not a switch',
        paragraphs: [
          'The word is used loosely, so pin it down: a consistency model is a contract about which values a read may return given the writes that happened. Strong (linearizable) says a read always returns the most recent completed write, as if there were one copy. Eventual says replicas converge given enough quiet time, and until then a read may return an older value.',
          'Between those sit the models that actually solve most product problems. Read-your-writes: you always see your own changes. Monotonic reads: you never see time go backwards. Causal: if A caused B, nobody sees B without A. These are cheap compared to linearizability and they eliminate the confusing behaviours users notice.',
          'Note that the C in ACID is a different word. ACID consistency means the database never violates its constraints. Distributed consistency means replicas agree. They share a name and nothing else, which is a genuine source of confusion when reading documentation.',
        ],
        code: {
          caption: 'The models, strongest to weakest',
          body: `linearizable     one copy illusion; read sees the latest write
sequential       everyone sees the same order, maybe not the latest
causal           cause is always seen before effect
read-your-writes you see your own writes; others may lag
monotonic reads  you never see an older value than you already saw
eventual         replicas converge... at some point

cost drops as you go down; user confusion rises if you skip
the middle three.`,
        },
      },
      {
        heading: 'The anomalies users actually report',
        paragraphs: [
          'Nobody files a bug saying "this is not linearizable". They say "I saved it and it did not save" - that is a missing read-your-writes guarantee, caused by reading from a lagging replica right after a write. Or "my comment disappeared and came back" - non-monotonic reads, caused by two requests hitting replicas with different lag.',
          'Or "the reply appears before the message it answers" - a causality violation, which happens when two related writes go to different partitions and are replicated independently. Each of these has a specific technical cause and a specific cheap fix, which is why naming the model matters.',
          'The fixes: pin a session to the primary for a few seconds after a write, or return the written object so no re-read is needed; keep a session on one replica for monotonic reads; carry a logical timestamp so a read waits for the replica to catch up to what the client has already seen.',
        ],
        bullets: [
          '"It did not save" -> read-your-writes. Pin to primary after a write.',
          '"It flickered back to the old value" -> monotonic reads. Keep the session on one replica.',
          '"Reply before the message" -> causal consistency. Keep related data in one partition or carry versions.',
          '"Two people got the last item" -> you needed linearizability for that one operation.',
        ],
      },
      {
        heading: 'What strong consistency costs',
        paragraphs: [
          'Linearizability requires coordination: a write must be acknowledged by a quorum before it is visible, and a read must confirm it is not seeing a stale value. Inside one datacenter that is roughly a millisecond. Across regions it is the round trip - 60 to 150 ms added to every operation, on the happy path, forever.',
          'It also costs availability during a partition, by definition: a node that cannot reach a quorum cannot serve a linearizable read or write, so it must return an error. That is not a flaw in the implementation, it is the guarantee working as specified.',
          'Which is why the useful skill is knowing which operations genuinely need it. Usually it is a small set: allocating a unique identifier, decrementing the last unit of stock, moving money, acquiring a lock. Everything else in a typical product runs happily on causal or read-your-writes, at a fraction of the cost.',
        ],
      },
    ],
    examples: [
      {
        title: 'Diagnosing three consistency bugs from user reports',
        setup:
          'Support forwards three complaints from one week. Each is a different consistency model missing.',
        walkthrough: [
          'Report 1: "I changed my avatar, the page still shows the old one, but it is correct after a refresh." Cause: the read after the write went to a replica lagging 700 ms. Fix: route reads to the primary for 5 seconds after that user writes.',
          'Report 2: "The unread badge said 3, then 5, then 3 again." Cause: consecutive requests hit two replicas with different lag. Fix: sticky routing per session so a user always reads from the same replica.',
          'Report 3: "I deleted a photo and it vanished, but its comment notification arrived afterwards." Cause: photo and notification live in different partitions replicated independently, so effect arrived without its cause. Fix: derive the notification from the same write path, or include a causal version the consumer waits for.',
          'Note that none of the three required linearizability. All were solved by picking a middle model and routing accordingly.',
          'The fourth report, "two people redeemed the same one-time code", is the one that genuinely needed a linearizable compare-and-set, and got it: a conditional update on a version column.',
        ],
        result:
          'Three cheap routing fixes and one genuine coordination point. Identifying which model was violated turned vague "sync bugs" into four specific, small changes.',
      },
    ],
    jargon: [
      { term: 'Linearizable', plain: 'Behaves as if there were a single copy; a read always sees the latest completed write.' },
      { term: 'Read-your-writes', plain: 'You always see your own changes, even if others lag.' },
      { term: 'Monotonic reads', plain: 'You never see an older value than one you already saw.' },
      { term: 'Causal consistency', plain: 'Anything that caused something else is seen first, everywhere.' },
      { term: 'Stale read', plain: 'A read that returns a value older than the latest write.' },
      { term: 'Quorum', plain: 'Requiring a majority of replicas to answer, so reads and writes must overlap.' },
    ],
    remember: [
      'Consistency is a contract about what a read may return, not a quality setting.',
      'ACID consistency and replica consistency are different things with the same name.',
      'Most user-visible "sync bugs" are missing read-your-writes or monotonic reads.',
      'Linearizability costs a quorum round trip on every operation - reserve it for the few that need it.',
      'Name the model you want; then the routing fix is usually small.',
    ],
  },

  availability: {
    analogy: {
      title: 'A shop that is open when you arrive',
      body:
        'Availability is not about being fast or being right - it is about the door being open and someone answering. A shop that answers every customer with wrong prices is available. A shop that closes whenever its stock system is uncertain is unavailable but never wrong. Most real design arguments are about which of those two failures is cheaper for a given product.',
    },
    deepDive: [
      {
        heading: 'Measuring it: nines, error budgets and what counts as down',
        paragraphs: [
          'Availability is the fraction of requests (or of time) where the system responds successfully. Expressed as nines: 99.9 percent allows about 8.8 hours of downtime per year, 99.99 percent allows 52 minutes, 99.999 percent allows five minutes - less than one human reaction.',
          'Request-based measurement is usually more honest than time-based. A system that returns errors for 5 percent of requests all day is not down by a time-based measure, but users experience it as broken. Counting good requests over total requests captures partial failures, which are far more common than total ones.',
          'The error budget flips the number into something a team can use. If the target is 99.9 percent, you may fail 0.1 percent of requests this quarter. Spend it on deploys and experiments while it lasts; when it is exhausted, stop shipping risky changes and fix reliability. That converts availability from an aspiration into a decision rule.',
        ],
        code: {
          caption: 'Series and parallel: the arithmetic that decides architecture',
          body: `IN SERIES (a request needs all of them)
  0.99 x 0.99 x 0.99 = 0.970   three 99% deps -> 97%
  every dependency you add multiplies your availability DOWN

IN PARALLEL (redundant copies, any one suffices)
  1 - (0.01)^2 = 0.9999        two 99% nodes -> 99.99%
  1 - (0.01)^3 = 0.999999      three -> six nines

This is why: fewer hard dependencies, more redundant copies.`,
        },
      },
      {
        heading: 'Hard dependencies are where availability goes to die',
        paragraphs: [
          'Every synchronous call your request path makes multiplies your availability by that dependency availability. Ten services at 99.9 percent each, all required, gives 99 percent - roughly three and a half days of downtime a year, built entirely out of reliable parts.',
          'So the highest-leverage availability work is usually not adding redundancy, it is removing dependencies from the critical path. Can the recommendation service failing just hide that section? Can the email be queued instead of sent inline? Can the profile render with a cached avatar? Each conversion from hard dependency to soft one removes a multiplication.',
          'The mechanisms are familiar: timeouts so a slow dependency cannot hold your threads, circuit breakers so a failing one is skipped quickly, fallbacks and cached defaults, and asynchronous handoff for anything not needed to answer the user. Graceful degradation is availability engineering, more than replication is.',
        ],
        bullets: [
          'Every synchronous dependency multiplies your availability downward.',
          'Ask of each: can the response still be useful without it? If yes, make it soft.',
          'Timeout everything. An unbounded call is an unbounded outage.',
          'Redundant copies multiply availability upward - but only if failover is automatic.',
        ],
      },
      {
        heading: 'Redundancy only counts if failover works',
        paragraphs: [
          'Two instances are not twice as available if switching between them requires a human at 3am. The measured availability of a redundant pair is dominated by detection and switching time, which is why health checks, automated promotion and DNS or load balancer updates matter more than the spare capacity itself.',
          'Watch for shared fate: two instances in the same rack, same zone, same deploy, or depending on the same configuration service are not independent. Correlated failure is what turns a calculated six nines into a real two. The 0.01 squared arithmetic above assumes independence, and independence is the thing you must actually engineer.',
          'And rehearse. A failover path that has never been exercised has roughly a coin-flip chance of working, because it accumulates untested assumptions: stale credentials, a hardcoded hostname, a replica too far behind to promote. Game days and deliberate failovers in business hours are how that probability becomes high.',
        ],
      },
    ],
    examples: [
      {
        title: 'Getting from 99.2 to 99.95 without adding a single server',
        setup:
          'A checkout page calls six services synchronously: catalogue, pricing, inventory, recommendations, loyalty points and fraud scoring. Measured availability is 99.2 percent.',
        walkthrough: [
          'Arithmetic first: six dependencies averaging 99.87 percent each, all required, gives about 99.2 percent. The numbers match, so the model is right.',
          'Recommendations: not required to check out. Wrap in a 100 ms timeout with an empty fallback. One multiplication removed.',
          'Loyalty points: not required either - points can be awarded asynchronously after the order is placed. Moved to a queue.',
          'Fraud scoring: required, but it can fail open for orders under 50 euro with a flag for later review. A business decision that converts a hard dependency into a soft one for most traffic.',
          'Catalogue: the data changes rarely, so cache it at the edge and in-process with a 60-second TTL. A catalogue outage now affects only uncached items.',
          'Remaining hard dependencies: pricing and inventory. Both get retries with backoff and a circuit breaker so a slow instance is bypassed rather than waited on.',
        ],
        result:
          'Measured availability moved to 99.95 percent with no new hardware. Four of six dependencies were made optional, cached or asynchronous - which is almost always cheaper than making them all more reliable.',
      },
    ],
    jargon: [
      { term: 'Nines', plain: 'Availability written as 99.9, 99.99, and so on. Each nine is ten times less downtime.' },
      { term: 'Error budget', plain: 'The failures your target permits. Spend it on change, then stop and fix.' },
      { term: 'Hard vs soft dependency', plain: 'One whose failure fails the request, versus one you can degrade around.' },
      { term: 'Graceful degradation', plain: 'Serving a reduced but useful response when a part is unavailable.' },
      { term: 'Correlated failure', plain: 'Redundant components failing together because they share a rack, zone or config.' },
      { term: 'MTTR', plain: 'Mean time to recovery. For availability, reducing it usually beats reducing failure frequency.' },
    ],
    remember: [
      'Serial dependencies multiply availability down; redundant copies multiply it up.',
      'Measure by successful requests, not by whether the process was running.',
      'Removing a dependency from the critical path is usually cheaper than making it reliable.',
      'Redundancy without automated, rehearsed failover buys very little.',
      'An error budget turns a target into a rule about when to stop shipping.',
    ],
  },

  'partition-tolerance': {
    analogy: {
      title: 'The office where the phone line is cut',
      body:
        'Both floors are fully staffed and working - they simply cannot talk to each other. Nobody is ill, nothing crashed, and from each floor the other appears to have vanished. That ambiguity is the heart of it: a partition is indistinguishable from the other side being dead, and every distributed system must decide what to do without knowing which it is.',
    },
    deepDive: [
      {
        heading: 'Partitions are not rare, and they are not always a cut cable',
        paragraphs: [
          'Engineers picture a severed fibre, which makes partitions feel exotic. In practice they are usually softer: a misapplied firewall rule, a saturated link dropping most packets, a switch failing one way, a garbage collection pause that makes a node unresponsive for eight seconds, or a routing change that blackholes traffic between two subnets.',
          'From the outside, all of these look the same: some nodes cannot reach some others, for a while. The classic asymmetric case is the nastiest - A can reach B but B cannot reach A - because naive health checks disagree about who is alive.',
          'Since you cannot prevent them, partition tolerance means the system continues to operate in some defined way while one is happening. Choosing not to be partition tolerant is not an option in a multi-node system; it just means the behaviour during a partition is undefined, which usually means data corruption.',
        ],
      },
      {
        heading: 'The impossible question: dead or unreachable?',
        paragraphs: [
          'When node A stops hearing from node B, exactly two explanations exist and no amount of cleverness distinguishes them: B crashed, or the network between them broke. This is the fundamental limitation, and every design decision in this area follows from it.',
          'If A assumes B is dead and takes over its work, but B is actually alive and doing the same work on the other side, you get split brain: two primaries accepting writes, two schedulers running the same job, two owners of the same lock. The damage is silent and discovered later, during reconciliation.',
          'The standard defence is quorum. Require a majority to act: with five nodes split three and two, only the group of three can proceed, and the minority stops accepting writes. A majority is unique by definition, so two groups can never both act. This is why clusters are sized with an odd number of nodes and why a two-node cluster cannot be made safe.',
        ],
        code: {
          caption: 'Why quorum works, and why two nodes cannot',
          body: `5 nodes, partition 3 | 2
  majority = 3   -> only the left side proceeds. Safe.

4 nodes, partition 2 | 2
  majority = 3   -> neither side proceeds. Safe but unavailable.
  (this is why even numbers add no safety, only cost)

2 nodes, partition 1 | 1
  majority = 2   -> neither proceeds, or you allow 1 and get split brain.
  A two-node cluster is either unavailable or unsafe. Add a witness.`,
        },
      },
      {
        heading: 'Fencing: stopping the old owner from acting',
        paragraphs: [
          'Quorum decides who should act, but the deposed node may not know it was deposed. A primary that was paused by a long GC wakes up believing it is still primary and writes to shared storage. Quorum alone does not stop that write.',
          'Fencing tokens solve it: every time leadership changes, a monotonically increasing number is issued, and the shared resource rejects any operation carrying an older token. The stale primary write arrives with token 7, the storage has seen token 8, and it is refused. This is the mechanism that makes distributed locks safe, and its absence is why naive Redis locks can corrupt data.',
          'The blunter form is STONITH - power off or network-isolate the old node before promoting a new one. It is common in database clusters precisely because it removes the ambiguity: a node that is definitely off cannot definitely write.',
        ],
        bullets: [
          'Odd node counts: 3 or 5. Even numbers cost more and tolerate the same number of failures.',
          'A witness or arbiter node breaks ties for two-datacenter deployments.',
          'Fencing tokens make "I was primary a moment ago" harmless.',
          'Set timeouts longer than your worst GC pause, or you will partition yourself.',
        ],
      },
    ],
    examples: [
      {
        title: 'A GC pause that promoted two primaries',
        setup:
          'A three-node database cluster with a 5-second failure detection timeout. The primary runs a full garbage collection that pauses it for 9 seconds.',
        walkthrough: [
          'At t+5 s the two followers stop hearing heartbeats and conclude the primary is dead. They form a majority (2 of 3) and elect a new primary.',
          'At t+9 s the original primary resumes. Nothing in its own view suggests anything happened - no error, no crash - so it believes it is still primary.',
          'For a few seconds, two nodes accept writes. Clients connected to the old one write data that the new primary knows nothing about.',
          'With fencing: the old primary attempts a write with epoch 4, shared storage has already accepted epoch 5, and the write is rejected. The node discovers it was deposed and steps down cleanly.',
          'Without fencing: both write, and after the cluster reconverges the divergent writes must be reconciled by hand - usually discovered days later as missing records.',
          'Follow-up tuning: the detection timeout is raised above the worst observed GC pause, and heap settings are changed so pauses stay under a second.',
        ],
        result:
          'The network was never partitioned - a pause produced exactly the same ambiguity. Any node that stops responding is indistinguishable from an unreachable one, which is why fencing matters more than perfect detection.',
      },
    ],
    jargon: [
      { term: 'Network partition', plain: 'Nodes alive but unable to reach each other.' },
      { term: 'Split brain', plain: 'Two sides both acting as the authority. The failure mode partitions cause.' },
      { term: 'Quorum', plain: 'A majority. Only one majority can exist, so only one side can act.' },
      { term: 'Fencing token', plain: 'An increasing number proving who is current; older ones are rejected by the resource.' },
      { term: 'Witness / arbiter', plain: 'A lightweight third voter that breaks ties without holding data.' },
      { term: 'STONITH', plain: 'Forcibly powering off the old node before promoting a new one.' },
    ],
    remember: [
      'You cannot avoid partitions; you can only define what happens during one.',
      'Crashed and unreachable are indistinguishable - every design follows from that.',
      'Quorum guarantees only one side can act, because only one majority exists.',
      'Use odd cluster sizes; two nodes cannot be both safe and available.',
      'Fencing tokens protect against the node that does not know it was replaced.',
    ],
  },

  'strong-consistency': {
    analogy: {
      title: 'One shared bank counter',
      body:
        'However many windows the bank has, there is one ledger and one queue for it. Your deposit is visible to every teller the instant it completes, and nobody can withdraw money you already spent. The price is the queue: everyone waits their turn at the one ledger, and if the ledger room is unreachable, the bank cannot serve you at all.',
    },
    deepDive: [
      {
        heading: 'What the guarantee actually promises',
        paragraphs: [
          'Linearizability - the usual meaning of strong consistency - says the system behaves as if every operation happened instantaneously at a single point between its start and its end, on a single copy of the data. Once a write completes, every subsequent read anywhere returns that value or a newer one.',
          'That is what makes compare-and-set meaningful. "Set the value to 5 only if it is currently 4" is only safe if no other copy can be at a different value; with weaker models, two nodes can both believe the precondition held. Every unique constraint, every "last item in stock", every lock acquisition rests on this property.',
          'Serializability is a related but different promise, about transactions rather than single operations: the result is equivalent to running the transactions one after another in some order. Strict serializability is both - transactions, in real-time order. Databases advertise these terms precisely, and the differences matter when you are relying on them.',
        ],
        code: {
          caption: 'The operation that needs it',
          body: `Two users redeem the same one-time voucher.

WEAK: both read status=unused, both write status=used
      -> voucher used twice, no error anywhere

STRONG (compare-and-set):
      UPDATE vouchers SET status='used', version=2
      WHERE id=9 AND version=1
      -> exactly one updates 1 row; the other updates 0 rows and is told no

The guarantee you need is not "fast" or "correct data".
It is that two operations cannot both see the same pre-state.`,
        },
      },
      {
        heading: 'How it is achieved, and therefore what it costs',
        paragraphs: [
          'Single-node databases get it almost for free: one copy, internal locks, done. The cost appears when the data is replicated. Then every write must be agreed by a quorum before it can be acknowledged, using a consensus protocol like Raft, and reads must either go through the leader or confirm with a quorum that they are not stale.',
          'That means at least one round trip to a majority for every operation. Inside a datacenter, 1-2 ms. Across regions, the round trip to the replica that completes the majority - 60 to 150 ms - on every write, forever, even when nothing is wrong. Google Spanner pays it too, and uses GPS and atomic clocks (TrueTime) so that read-only transactions can avoid it; most systems simply keep the quorum regional.',
          'And during a partition, a node that cannot reach a quorum must refuse rather than answer. That is the CP choice, and it is not a bug: refusing is the only way to keep the promise.',
        ],
        bullets: [
          'Write path: propose to leader, replicate to majority, then acknowledge.',
          'Read path: from the leader, or a quorum read, or a lease that proves leadership.',
          'Latency floor: one round trip to the slowest member of the quorum.',
          'Availability: no quorum, no service. By design.',
        ],
      },
      {
        heading: 'Use it narrowly and it is affordable',
        paragraphs: [
          'The expensive mistake is applying strong consistency to everything. A product does not need a global linearizable read to show a profile picture; it needs one to allocate a username. Identify the few operations where two observers disagreeing causes real damage, and give those the coordination.',
          'In practice this often means: a relational database with transactions for the core entities, and eventually consistent stores, caches and search indexes for everything derived from them. The strong core stays small enough to fit on one primary or one regional cluster, and the rest scales freely.',
          'A useful test question for any operation: if two users did this at exactly the same moment on different continents, and both succeeded, would anything be wrong? If nothing is wrong, you do not need strong consistency there - and most operations pass that test.',
        ],
      },
    ],
    examples: [
      {
        title: 'Booking the last seat, three ways',
        setup:
          'One seat left on a flight, and two customers click Book at the same instant from two regions.',
        walkthrough: [
          'Eventually consistent counter: both regions read 1 seat, both decrement, both succeed. Two bookings, one seat. The error is discovered at the gate.',
          'Strong consistency via conditional update: UPDATE seats SET remaining = remaining - 1 WHERE flight = 9 AND remaining > 0. Exactly one affects a row; the other gets zero rows and shows "sold out". Cost: both requests coordinate through one leader, adding the cross-region round trip to whichever customer is far away.',
          'Reserve-then-confirm: the strong operation is narrowed to a 10-minute seat reservation, and the slower payment step happens afterwards against the reservation. Coordination is paid once, briefly, and the rest of checkout stays fast and local.',
          'Note what stayed weak in all three: seat maps, price displays and search results can all be seconds stale with no harm, and they are the vast majority of the traffic.',
          'Overbooking as a business choice: airlines deliberately choose the AP behaviour and compensate passengers, because the cost of refusing bookings exceeds the cost of occasional compensation. That is a valid answer too - as long as it is chosen.',
        ],
        result:
          'One operation needed linearizability; everything around it did not. Narrowing the strongly consistent surface to the moment of allocation is how systems stay both correct and fast.',
      },
    ],
    jargon: [
      { term: 'Linearizable', plain: 'Every operation appears to happen at one instant on one copy of the data.' },
      { term: 'Serializable', plain: 'Transactions behave as if run one at a time, in some order.' },
      { term: 'Compare-and-set', plain: 'Write only if the current value matches what you read. The core safe primitive.' },
      { term: 'Quorum write', plain: 'A write acknowledged only after a majority of replicas store it.' },
      { term: 'Leader lease', plain: 'A time-bounded right to serve reads locally without asking a quorum each time.' },
      { term: 'Consensus', plain: 'The protocol (Raft, Paxos) that makes a group agree on an order of operations.' },
    ],
    remember: [
      'Strong consistency means no two observers can see different values - that is what makes compare-and-set safe.',
      'It costs a quorum round trip per operation, forever, not just during failures.',
      'During a partition it must refuse service; that is the guarantee working.',
      'Apply it to the few operations where disagreement causes damage, not to the whole system.',
      'Test: if two users did this simultaneously and both succeeded, would anything be wrong?',
    ],
  },

  'eventual-consistency': {
    analogy: {
      title: 'Gossip through an office',
      body:
        'Someone tells two colleagues, who tell two more. Within a minute everyone knows, but during that minute different people have different information, and two pieces of news can arrive in different orders on different floors. Given a quiet minute, everyone converges on the same story. That is eventual consistency: fast, resilient, and temporarily disagreeing.',
    },
    deepDive: [
      {
        heading: 'Eventual means converging, not "wrong for a while"',
        paragraphs: [
          'The formal promise is modest: if writes stop, all replicas eventually reach the same value. It says nothing about how long that takes or what you see in the meantime - which is why serious systems strengthen it with additional guarantees such as read-your-writes or causal consistency.',
          'In practice the window is small. Within a region, replicas converge in milliseconds; across continents, in tens to hundreds of milliseconds. The failure cases are the interesting ones: during a partition, convergence waits for the partition to heal, which is exactly the availability you traded for.',
          'What you buy is significant: writes complete locally without waiting for anybody, every replica can serve reads, and the system keeps working when parts of it cannot talk to each other. For the large majority of data in a typical product, that is a very good deal.',
        ],
      },
      {
        heading: 'Conflicts are the real design work',
        paragraphs: [
          'If two replicas accept writes to the same item during a partition, there are two versions and something must decide. Last-write-wins is simplest and silently discards data - and "last" depends on clocks that disagree, so it can discard the newer write. It is acceptable only when losing one of two concurrent updates genuinely does not matter.',
          'Version vectors detect that two writes were concurrent rather than ordered, and hand both to the application to merge. That is more work but it is honest: the system tells you there was a conflict instead of quietly picking.',
          'CRDTs (conflict-free replicated data types) are structures designed so that merging is automatic and order-independent: grow-only counters, add-wins sets, sequence types used by collaborative editors. When your data fits one of these shapes, you get convergence with no conflict logic at all, which is why they underpin most real-time collaboration products.',
        ],
        code: {
          caption: 'Choosing a merge rule by data shape',
          body: `counter (likes, views)     -> sum per replica, CRDT counter. Never lose a count.
set (cart items, tags)     -> union; deletes need tombstones (add-wins/remove-wins)
single field (display name)-> last-write-wins is usually fine
document (collaborative)   -> CRDT sequence or OT
money / stock              -> not eventual. Use a strong operation.`,
        },
      },
      {
        heading: 'Designing a product on top of it',
        paragraphs: [
          'The user interface carries much of the burden, and doing it well makes eventual consistency invisible. Optimistic UI shows the change immediately from local state, so the user never waits for convergence to see their own action. Pair it with read-your-writes routing on the server and the most common complaint disappears.',
          'Be explicit where staleness is visible. "Updated 30 seconds ago" on a dashboard sets expectations; a silently stale number invites a bug report. Where an operation must be exact, make it exact at the decision point rather than in the display - show an approximate stock level, but check atomically at checkout.',
          'Finally, make operations idempotent and commutative wherever you can. If applying the same update twice is harmless and order does not matter, then retries, duplicate deliveries and out-of-order replication all stop being correctness problems. That property is worth designing for deliberately; it removes most of the sharp edges.',
        ],
        bullets: [
          'Optimistic UI plus read-your-writes removes most user-visible staleness.',
          'Show staleness where it exists rather than hiding it.',
          'Be exact at the decision point, approximate in the display.',
          'Design operations to be idempotent and order-independent.',
        ],
      },
    ],
    examples: [
      {
        title: 'A shopping cart that survives a partition',
        setup:
          'Carts replicate across two regions. During a 3-minute partition, a customer adds a hat on their phone (EU region) and removes a scarf on their laptop (US region).',
        walkthrough: [
          'Last-write-wins: whichever cart write has the later timestamp replaces the other entirely. The customer loses either the hat or the removal - and if the clocks are skewed, possibly the newer change.',
          'Version vectors: on healing, the system detects two concurrent versions and asks the application to merge, which needs explicit code but never silently discards.',
          'CRDT approach: model the cart as an add-wins set with tombstones for removals. The hat addition and the scarf removal are independent operations that both survive - union of adds, minus recorded removals.',
          'Result after healing: cart contains the hat and not the scarf, which is exactly what the customer intended, with no conflict prompt.',
          'Amazon famously chose add-wins for carts: the worst outcome is a re-added item the customer removes again, which costs far less than a lost item that costs a sale.',
        ],
        result:
          'The merge rule, not the replication, decided whether the feature worked. Picking the data shape - a set with tombstones instead of a whole-document overwrite - turned a conflict problem into arithmetic.',
      },
    ],
    jargon: [
      { term: 'Convergence', plain: 'All replicas reaching the same value once writes stop.' },
      { term: 'Last-write-wins', plain: 'Keep the version with the newest timestamp, discard the other. Simple and lossy.' },
      { term: 'Version vector', plain: 'Metadata that reveals whether two writes were concurrent or ordered.' },
      { term: 'CRDT', plain: 'A data type whose merge is automatic and order-independent.' },
      { term: 'Tombstone', plain: 'A marker recording a delete, so the delete is not lost when replicas merge.' },
      { term: 'Anti-entropy', plain: 'Background repair that compares replicas and fixes differences.' },
    ],
    remember: [
      'Eventual means replicas converge when writes stop - nothing about the meantime.',
      'The design work is the merge rule, not the replication.',
      'Last-write-wins silently loses data and depends on clocks you cannot trust.',
      'Pick a data shape that merges: counters, sets with tombstones, CRDTs.',
      'Optimistic UI plus read-your-writes hides almost all user-visible staleness.',
    ],
  },

  'distributed-locks': {
    analogy: {
      title: 'One key for the meeting room',
      body:
        'Only the person holding the key may use the room. If someone leaves with it, the room is blocked forever, so the key expires after an hour. But then a meeting that overruns leaves two people convinced they hold the room - which is why the door also checks a number stamped on the key and refuses anything older than the one it last saw.',
    },
    deepDive: [
      {
        heading: 'What a lock is for, and the first thing to ask',
        paragraphs: [
          'A distributed lock lets many processes agree that only one of them does something at a time: run a scheduled job once, process one order, mutate one shared resource. It is the distributed version of a mutex, and it is much harder, because the participants can crash, pause, or lose the network at any moment.',
          'So the first question is always whether you can avoid it. A unique constraint in the database, an atomic conditional update, a single-consumer queue partition, or an idempotent operation each remove the need for a lock entirely - and none of them can leak, expire or split brain. Locks are the answer when the resource being protected is outside your database and cannot enforce its own uniqueness.',
          'The second question is what a failure costs. Locks come in two flavours: efficiency locks, where a double execution merely wastes work, and correctness locks, where a double execution corrupts data. A simple Redis lock is fine for the first and inadequate for the second, and conflating them is the classic mistake.',
        ],
        code: {
          caption: 'The minimum viable lock, and why each part is there',
          body: `SET lock:job42 <random-token> NX PX 30000
  NX     only if absent         -> mutual exclusion
  PX     expire after 30 s      -> a crashed holder cannot block forever
  token  unique per acquisition -> release only your own lock

release (must be atomic, hence Lua):
  if redis.call('get', KEYS[1]) == ARGV[1]
     then redis.call('del', KEYS[1]) end

Deleting without checking the token is the bug:
you can delete a lock somebody else acquired after yours expired.`,
        },
      },
      {
        heading: 'Why TTLs are both mandatory and dangerous',
        paragraphs: [
          'Without an expiry, a process that crashes while holding the lock blocks the resource forever, and recovery requires a human. So every distributed lock has a TTL. But a TTL is an assumption that the work finishes within it, and that assumption fails exactly when things are slow - a GC pause, a network stall, an overloaded disk.',
          'When the TTL expires mid-work, a second process acquires the lock and starts. Now two processes run concurrently, each believing it holds exclusivity. No amount of careful lock code prevents this, because the first process has no way to know its lease lapsed until it tries to do something.',
          'Two mitigations. Heartbeat extension: a background thread renews the lease while work continues, shrinking but not closing the window. Fencing tokens: the lock hands out an increasing number, and the protected resource rejects operations with a stale token - which closes the window properly, at the cost of the resource having to participate.',
        ],
        bullets: [
          'Always set a TTL, or one crash blocks the resource permanently.',
          'Always release with a token check; otherwise you can release a lock that somebody else acquired.',
          'Renew the lease for long work, and make the work resumable rather than long.',
          'For correctness-critical resources, use fencing tokens - the resource must check them.',
        ],
      },
      {
        heading: 'Where to put the lock, and Redlock',
        paragraphs: [
          'A single Redis instance gives a fast, simple lock with one flaw: if it fails over to a replica that had not yet received the lock key, two holders are possible. Redlock attempts to fix that by acquiring on a majority of independent Redis nodes. For efficiency locks it adds cost without much benefit, since a single instance is already enough there; for correctness locks it has been criticised at length (Martin Kleppmann, 2016), because it still relies on time bounds that a pause can violate and it hands out no increasing number to fence with.',
          'Systems built on consensus - etcd, ZooKeeper, Consul - keep the lock on a replicated quorum, tie it to a lease or session, and give you a number that grows with every change: the revision in etcd, the zxid or znode version in ZooKeeper. That number is your fencing token, as long as the protected resource checks it. They are slower (a quorum round trip per operation), and they are the tool to reach for when a double execution would corrupt data. If your cluster already runs one, use it rather than inventing a lock.',
          'And frequently the best lock is the database you already have. SELECT ... FOR UPDATE on a row, a Postgres advisory lock, or a unique key on a job id gives you mutual exclusion with real transactional semantics and no extra infrastructure. It does not scale to enormous rates, but most locking needs are nowhere near that.',
        ],
      },
    ],
    examples: [
      {
        title: 'Making a nightly job run exactly once',
        setup:
          'A billing job must run once per night. It runs inside the application, which has 12 instances, so at 02:00 twelve processes wake up and try to run it.',
        walkthrough: [
          'Naive: each instance checks "did anyone run it?" in the database, and 12 concurrent checks all read false. Twelve billing runs, twelve sets of invoices.',
          'Lock attempt 1: SET lock:billing:2026-09-18 token NX PX 600000. One instance wins, eleven exit. Better - but the job sometimes takes 14 minutes, so the 10-minute lease expires and a second instance starts.',
          'Fix 1: renew the lease every 30 seconds while the job runs, so the TTL only matters if the process actually dies.',
          'Fix 2 (the one that really solves it): make the job idempotent. Invoices are keyed by (customer_id, period) with a unique constraint, so a second run inserts nothing and the duplicate becomes harmless.',
          'Fix 3 (structural): move the schedule out of the application. One scheduler, or a queue message published once, with the workers competing to consume it - the queue provides the exclusivity.',
          'Result: the lock is now an efficiency optimisation preventing wasted work, not the thing standing between you and duplicate invoices.',
        ],
        result:
          'The durable fix was idempotency plus a unique constraint; the lock became a performance nicety. Whenever a lock is the only thing preventing corruption, look for a uniqueness constraint that makes the second execution a no-op.',
      },
    ],
    jargon: [
      { term: 'Mutual exclusion', plain: 'Only one process may act at a time. The purpose of a lock.' },
      { term: 'Lease / TTL', plain: 'A time-bounded lock so a crashed holder does not block forever.' },
      { term: 'Fencing token', plain: 'An increasing number the resource checks, so a stale holder is refused.' },
      { term: 'Redlock', plain: 'A multi-node Redis locking algorithm. Fine for efficiency, debated for correctness.' },
      { term: 'Advisory lock', plain: 'A named lock provided by the database, with no table attached.' },
      { term: 'Idempotency', plain: 'Making the second execution harmless, which removes the need for perfect locking.' },
    ],
    remember: [
      'First try to remove the need: unique constraints, atomic updates, queues, idempotency.',
      'Every lock needs a TTL, and every TTL can expire mid-work.',
      'Release only your own lock, checked atomically by token.',
      'When a lock guards correctness, the resource must check a fencing token - a TTL alone cannot protect it.',
      'A lock that prevents waste is a different thing from a lock that prevents corruption.',
    ],
  },

  'leader-election': {
    analogy: {
      title: 'Choosing who chairs the meeting',
      body:
        'Someone has to chair, and everyone must agree on who it is - if two people chair, the meeting splits. So the group votes, a majority decides, and the chair keeps signalling that they are still present. If they go quiet for long enough, the group votes again. The rule that keeps it safe: a majority is required, so there can never be two chairs at once.',
    },
    deepDive: [
      {
        heading: 'Why a leader at all',
        paragraphs: [
          'Coordination is enormously simpler with a single decision maker. One node orders the writes, so there is no conflict resolution. One node runs the scheduled job, so it runs once. One node assigns partitions, so assignments do not overlap. The leader turns a distributed agreement problem into a local one.',
          'The cost is that the leader is a bottleneck for whatever it serialises, and its failure requires a detection-and-election pause during which that work stops. The whole design effort goes into making that pause short and making sure no second leader appears during it.',
          'Note the pattern: leader-based systems are common precisely because leaderless coordination is so much harder. Raft, Kafka partitions, Postgres primaries, Kubernetes controllers - all pick one and accept a failover gap.',
        ],
      },
      {
        heading: 'How election works, in the Raft shape',
        paragraphs: [
          'Every node is a follower and expects heartbeats from the leader. If none arrive within an election timeout, a follower increments the term number, becomes a candidate and asks the others for votes. Each node votes once per term, and a candidate that receives a majority becomes leader and starts heartbeating.',
          'Two details do the heavy lifting. Randomised election timeouts - typically 150 to 300 ms, different per node - make simultaneous candidacies unlikely, so elections usually complete in one round instead of repeatedly splitting the vote. And the term number is monotonically increasing, so any message from an older term is rejected outright; that is fencing, built into the protocol.',
          'Raft also requires that a candidate log be at least as up to date as the voter log before a vote is granted. That guarantees the new leader already holds every committed entry, which is what makes failover safe rather than lossy.',
        ],
        code: {
          caption: 'The state machine, minus the details',
          body: `FOLLOWER  --no heartbeat for T--> CANDIDATE
CANDIDATE --majority of votes-->  LEADER
CANDIDATE --sees higher term-->   FOLLOWER
LEADER    --sees higher term-->   FOLLOWER   (steps down immediately)

invariants
  one vote per node per term
  majority required             -> at most one leader per term
  term increases monotonically  -> stale leaders are ignored
  candidate log must be current -> no committed entry is lost`,
        },
      },
      {
        heading: 'The practical concerns',
        paragraphs: [
          'Timeout tuning is a direct trade-off. Short timeouts detect failure quickly and cause spurious elections under load or GC pauses - and every spurious election is a brief write outage. Long timeouts are stable but extend the gap after a real failure. Base the value on your observed worst-case pause, not on the best case.',
          'Split votes and flapping are the failure modes to watch. Randomised timeouts mostly prevent the first; the second usually means the timeout is shorter than your real latency variance. A cluster re-electing several times an hour is telling you something about its network or its garbage collector.',
          'And unless you are writing a database, do not implement this yourself. Use etcd, ZooKeeper, Consul, or the leader-election primitive your platform provides - Kubernetes offers one built on a lease object. Consensus implementations are small to describe and notoriously subtle to get right.',
        ],
        bullets: [
          'Election timeout > worst-case GC pause and network hiccup, or you self-inflict outages.',
          'Randomise timeouts per node to avoid split votes.',
          'Expect a write pause for the duration of detection plus election.',
          'Use an existing implementation; consensus is where subtle bugs live.',
        ],
      },
    ],
    examples: [
      {
        title: 'One cron job, twelve instances, no duplicates',
        setup:
          'A report must be generated once every hour. The service runs 12 replicas in Kubernetes and each one has a scheduler.',
        walkthrough: [
          'Without coordination: 12 reports per hour, 12 emails to the customer, and a support conversation.',
          'Option 1 - leader election via a Kubernetes Lease: each replica tries to acquire the lease and renews it every few seconds. Only the holder runs the schedule; the rest stand by.',
          'Failover: if the leader pod dies, its lease is not renewed and another replica acquires it within the lease duration (say 15 seconds). At most one hourly run is delayed, never duplicated.',
          'Edge case: the leader is paused, its lease expires, a new leader starts the report, then the old one resumes and starts too. Both write the same report.',
          'Guard: the report is written with a unique key (report_id = hour), so the second write conflicts and is discarded. Election handles the common case, idempotency handles the ambiguous one.',
          'Alternative without election: publish a message to a queue from a single scheduler (CronJob) and let any worker consume it. The queue provides exclusivity and no leader is needed at all.',
        ],
        result:
          'Leader election made the common case clean and a uniqueness constraint made the rare overlap harmless. The combination is the standard production answer - election alone is never quite enough.',
      },
    ],
    jargon: [
      { term: 'Term / epoch', plain: 'An increasing number identifying a leadership period. Older terms are ignored.' },
      { term: 'Heartbeat', plain: 'The periodic message proving the leader is alive.' },
      { term: 'Election timeout', plain: 'How long a follower waits without a heartbeat before standing for election.' },
      { term: 'Split vote', plain: 'Several candidates each failing to reach a majority, forcing another round.' },
      { term: 'Lease', plain: 'A time-bounded claim to leadership that must be renewed.' },
      { term: 'Step down', plain: 'A leader relinquishing its role when it sees a higher term.' },
    ],
    remember: [
      'A leader turns distributed agreement into a single local decision.',
      'A majority vote plus an increasing term guarantees at most one leader at a time.',
      'Randomised timeouts prevent split votes; timeouts shorter than your pauses cause outages.',
      'Failover always costs a pause - detection plus election.',
      'Combine election with idempotency; the overlap window never fully closes.',
    ],
  },

  consensus: {
    analogy: {
      title: 'A committee that must agree on the minutes',
      body:
        'Several people must end up with an identical, ordered record of decisions, even though some are absent, some messages are lost, and some arrive out of order. The trick that makes it work is majority rule plus writing everything down in order: any two majorities share at least one member, so no two contradictory decisions can both be approved.',
    },
    deepDive: [
      {
        heading: 'The problem: agreeing on an order, not just a value',
        paragraphs: [
          'Consensus is getting a group of nodes to agree on a sequence of values - typically the order of operations in a replicated log - such that every correct node ends up with the same sequence, even if some nodes fail and messages are delayed or dropped.',
          'Ordering is the point. If every replica applies the same operations in the same order to the same starting state, they all end up in the same state. That is the replicated state machine model, and it is how consensus turns into a working database, a lock service or a configuration store.',
          'The FLP result proves that no deterministic protocol can guarantee consensus in an asynchronous network where even one node may fail. Real systems live with that by being safe always and live almost always: they never produce a wrong answer, and with randomised timeouts they make progress in practice.',
        ],
      },
      {
        heading: 'Why majorities make it safe',
        paragraphs: [
          'The key property is quorum intersection: any two majorities of the same set share at least one member. If a value was committed by majority A, and a later decision consults majority B, some node in B saw the commit and can report it. No decision can be made that contradicts a committed one.',
          'That is also why cluster sizes are odd. Three nodes tolerate one failure, five tolerate two. Four nodes also tolerate only one - the majority is three either way - so the extra node adds cost, more messages, and no extra fault tolerance.',
          'Raft layers a leader on top to make it understandable: the leader receives the client request, appends it to its log, replicates to followers, and commits once a majority acknowledges. The log is then applied in order by every node. Paxos solves the same problem with a different structure; Raft is the one most people can read and implement.',
        ],
        code: {
          caption: 'Fault tolerance by cluster size',
          body: `nodes  majority  tolerated failures
  1        1          0      not fault tolerant
  3        2          1      the common default
  4        3          1      more cost, no more tolerance
  5        3          2      when one failure is not enough
  7        4          3      rarely worth the write latency

every write costs a round trip to the slowest member of the majority`,
        },
      },
      {
        heading: 'Where you meet it, and when to use it directly',
        paragraphs: [
          'You use consensus every day without implementing it: etcd holds Kubernetes state, ZooKeeper coordinates Kafka and HBase, Postgres with synchronous replication and a quorum-based failover manager, CockroachDB and Spanner use Raft-like protocols per range, and every managed database with automatic failover has something similar inside.',
          'Use it directly for small, critical, low-volume state: cluster membership, configuration, leader leases, feature flags that must be globally consistent. These systems are designed for a modest write rate and total reliability, not for throughput.',
          'Do not use it for bulk data. Every write pays a quorum round trip and is stored on every node, so a consensus store is the wrong home for user content, events or anything high volume. The standard architecture is a small consensus core managing metadata, with the bulk data in systems that reference it.',
        ],
        bullets: [
          'Good: configuration, membership, locks, leader leases, small critical metadata.',
          'Bad: user data, logs, events, anything with high write volume.',
          'Odd node counts only; five is the usual maximum before latency hurts.',
          'Keep all members close to each other; cross-region quorums pay the round trip on every write.',
        ],
      },
    ],
    examples: [
      {
        title: 'Why a 3-node cluster across three continents was a mistake',
        setup:
          'A team deploys a 3-node etcd cluster with one node in Europe, one in the US and one in Asia, expecting maximum resilience.',
        walkthrough: [
          'Every write must be acknowledged by 2 of 3 nodes. From the European leader, the nearest other node is the US at about 90 ms round trip.',
          'So every single write costs at least 90 ms, before any disk work. Kubernetes operations that do dozens of writes become visibly slow.',
          'Worse, leadership can move. If the Asian node becomes leader, its nearest quorum partner is Europe at about 160 ms, and the cluster gets slower for no visible reason.',
          'Election timeouts also have to be raised well above the cross-region variance, so a real failure now takes several seconds to detect.',
          'Better design: all three nodes in one region, spread across three availability zones. Round trips are about 1 ms, the cluster survives losing a zone, and writes are fast.',
          'For cross-region survival, run a separate cluster per region and replicate at the application level, accepting eventual consistency between regions - rather than paying consensus latency on every write.',
        ],
        result:
          'Consensus makes you pay the distance between quorum members on every write. Keeping a quorum close and handling cross-region resilience at a different layer is the standard answer.',
      },
    ],
    jargon: [
      { term: 'Replicated log', plain: 'The ordered list of operations every node agrees on and applies.' },
      { term: 'Quorum intersection', plain: 'Any two majorities share a member, which is why no two contradictory decisions can commit.' },
      { term: 'Raft / Paxos', plain: 'The two well-known consensus protocols. Raft is the readable one.' },
      { term: 'Commit index', plain: 'How far into the log a majority has stored, and therefore what is safe to apply.' },
      { term: 'FLP impossibility', plain: 'The proof that consensus cannot be guaranteed in a fully asynchronous network with one failure.' },
      { term: 'Byzantine fault', plain: 'A node that lies rather than merely fails. Ordinary consensus does not defend against it.' },
    ],
    remember: [
      'Consensus agrees on an order, so replicas applying it end in the same state.',
      'Majorities overlap, which is why a committed decision can never be contradicted.',
      'Odd sizes only - four nodes tolerate the same failures as three.',
      'Every write costs a round trip to the slowest quorum member; keep them close.',
      'Use it for small critical metadata, never for bulk data.',
    ],
  },

  idempotency: {
    analogy: {
      title: 'A lift button',
      body:
        'Pressing it once calls the lift. Pressing it nine more times calls the same lift - the state is "called", and repeating the action does not stack up nine journeys. Contrast that with a vending machine coin slot, where every insert charges you again. In a network where messages get retried, you want your operations to behave like the button.',
    },
    deepDive: [
      {
        heading: 'Retries are inevitable, so design for duplicates',
        paragraphs: [
          'Any network call can time out after the server has already done the work. The client cannot tell the difference between "the request never arrived" and "the response was lost on the way back", so it retries - and now the operation may run twice. Load balancers retry, clients retry, message brokers redeliver, and users press the button again. Refusing to retry is no cure: it swaps the double charge for an error shown on a payment that did go through.',
          'That is why exactly-once delivery does not exist. What exists is at-least-once delivery plus idempotent processing, which together produce exactly-once effect. This is the single most useful sentence in distributed systems engineering, and it shifts the work from the transport to your handler.',
          'Some operations are naturally idempotent: setting a value, deleting by id, adding to a set. Others are not: incrementing a counter, appending to a list, charging a card, sending an email. For the second group you must add something that makes the repeat recognisable. HTTP itself defines GET, PUT and DELETE as idempotent (RFC 9110), which is why clients and proxies retry them on their own - so a PUT handler that appends to a list breaks a promise the whole web relies on.',
        ],
        code: {
          caption: 'The standard idempotency key flow',
          body: `client sends:  POST /payments   Idempotency-Key: 8f3c-...
                (the SAME key on every retry of that user action)

server:
  INSERT INTO idem_keys(key, status) VALUES (?, 'in_progress')
    -- unique constraint. If it fails, this is a duplicate.

  duplicate + in_progress  -> 409, tell the client to retry shortly
  duplicate + completed    -> return the STORED response, do nothing
  new                      -> do the work, store the response, mark done

Key must be generated by the client per intent, not per attempt.`,
        },
      },
      {
        heading: 'Three ways to make an operation idempotent',
        paragraphs: [
          'A natural key with a unique constraint is the cleanest: invoices keyed by (customer, period), messages keyed by a client-generated message id. The second insert simply fails on the constraint and the handler treats that failure as success. The database enforces it for every writer, including retries you did not anticipate.',
          'An idempotency key with stored responses is the general solution used by payment APIs. The client sends a key it generated for that intent; the server records it, performs the work once, and replays the stored response for any repeat. Crucially the stored response is returned, not a new computation, so the client sees an identical answer.',
          'A state check makes some operations naturally safe: "set status to shipped" is idempotent where "advance to the next status" is not. Expressing operations as target states rather than transitions removes whole classes of duplicate-processing bugs, and it is worth doing when you get to choose the API shape.',
        ],
        bullets: [
          'Natural unique key - best when the data already has one.',
          'Idempotency key plus stored response - the general-purpose answer for APIs.',
          'Absolute state ("set to X") rather than relative ("increment") wherever possible.',
          'Store the key in the same transaction as the effect, or the two can disagree.',
        ],
      },
      {
        heading: 'The details that decide whether it actually works',
        paragraphs: [
          'The key must identify the intent, not the attempt. If a client generates a fresh key on each retry, every retry is a new operation and you have achieved nothing. Generate it when the user clicks, keep it across retries, and change it only for a genuinely new action.',
          'The key record and the effect must commit together. If you charge the card and then crash before recording the key, the retry charges again. Inside one database, use one transaction. Across services, write the key and an outbox row transactionally and let the external call be driven from the outbox - the external call itself carries the key so the provider deduplicates.',
          'Finally, decide retention and concurrency. Keys are usually kept 24 hours to a few days - long enough to cover client retries, short enough to bound storage. And two simultaneous requests with the same key must not both execute: the unique insert is what serialises them, which is why the insert comes first and the work second. Last, check that a repeat carries the same request as the original: a key reused with a different body is a client bug, and the server should reject it (the IETF Idempotency-Key draft uses 422) rather than replay the result of a different payment.',
        ],
      },
    ],
    examples: [
      {
        title: 'The double charge, traced and fixed',
        setup:
          'A customer is charged twice for one order. Logs show two identical POST /payments requests 31 seconds apart from the same session.',
        walkthrough: [
          'The first request reached the payment provider and succeeded, but the provider response took 32 seconds and the client timeout was 30 seconds.',
          'The mobile app treated the timeout as a failure and retried automatically. The second request created a second charge because nothing tied the two together.',
          'Fix 1: the app generates an idempotency key when the user taps Pay, and reuses it for every retry of that tap.',
          'Fix 2: the server inserts the key with a unique constraint before calling the provider. The retry hits the constraint, sees status in_progress, and returns 409 so the client waits and polls instead of charging again.',
          'Fix 3: the same key is forwarded to the payment provider, which also deduplicates - so even a retry that somehow bypasses your check cannot double charge.',
          'Fix 4: the key row and the payment record are written in one transaction, so a crash between them is impossible.',
          'Result: a retry now returns the original payment result, identical to the first response, and the customer is charged once.',
        ],
        result:
          'Nothing was wrong with the network, the client or the provider individually - the operation simply was not idempotent. For any operation that spends money, sends a message or creates a record, idempotency is a requirement, not a refinement.',
      },
    ],
    jargon: [
      { term: 'Idempotent', plain: 'Doing it again has the same effect as doing it once.' },
      { term: 'At-least-once', plain: 'The delivery guarantee you actually get. Duplicates are possible.' },
      { term: 'Exactly-once effect', plain: 'At-least-once delivery plus idempotent processing. The achievable version.' },
      { term: 'Idempotency key', plain: 'A client-generated id identifying one intent, reused across retries.' },
      { term: 'Deduplication window', plain: 'How long keys are remembered. Beyond it, a retry becomes a new operation.' },
      { term: 'Natural key', plain: 'A uniqueness rule already present in the data, e.g. one invoice per customer per month.' },
    ],
    remember: [
      'Exactly-once delivery does not exist; at-least-once plus idempotency does.',
      'The key identifies the intent, not the attempt - generate it once, reuse on retries.',
      'Record the key and the effect in one transaction, or they will disagree.',
      'Prefer absolute state changes over increments where the API shape is yours to choose.',
      'Anything that moves money, sends a message or creates a record needs this.',
    ],
  },
};
