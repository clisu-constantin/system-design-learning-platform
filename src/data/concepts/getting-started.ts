import type { Concept } from '@/types';

export const gettingStartedConcepts: Concept[] = [
  {
    slug: 'what-is-system-design',
    title: 'What is System Design?',
    tagline: 'Choosing a structure that satisfies requirements you can actually name.',
    category: 'getting-started',
    difficulty: 'Beginner',
    keywords: ['introduction', 'architecture', 'trade-offs'],
    what: 'System design is the activity of deciding which components a system is made of, how they communicate, and where state lives - so that the result meets its functional and non-functional requirements at an acceptable cost.',
    why: 'Code tells you what a single process does. Design tells you what happens when a million users arrive at once, when a disk fails, or when two services disagree about the truth. Those questions cannot be answered by reading a function body.',
    how: [
      'Clarify the requirements: what the system must do, and how well it must do it.',
      'Estimate scale: users, requests per second, data volume, read/write ratio.',
      'Sketch the smallest architecture that could work.',
      'Find the bottleneck - there is always exactly one that matters first.',
      'Introduce a component that removes it, and name the new problem it creates.',
      'Repeat until the remaining problems are acceptable.',
    ],
    when: [
      'Before building anything whose failure would be expensive.',
      'When an existing system stops meeting its latency or availability targets.',
      'In interviews, where the process matters more than the final diagram.',
    ],
    diagram: `Requirements  ->  Estimate  ->  Simple design
                                  |
                            find bottleneck
                                  |
                           add one component
                                  |
                            name the new cost
                                  |
                               repeat`,
    mistakes: [
      'Starting from a list of technologies instead of a list of requirements.',
      'Drawing the final Netflix-scale architecture for a product with 200 users.',
      'Treating a diagram as finished before anyone has asked "what happens when this box dies?".',
    ],
    tradeoffs: [
      {
        approach: 'Design up front',
        gains: ['Fewer expensive rewrites', 'Shared mental model across the team'],
        costs: ['Slower start', 'Decisions made with the least information you will ever have'],
      },
      {
        approach: 'Evolve the design',
        gains: ['Decisions made when you know more', 'Ships sooner'],
        costs: ['Migrations under load are painful', 'Some choices are hard to reverse (data model, partitioning)'],
      },
    ],
    related: ['functional-requirements', 'non-functional-requirements', 'capacity-estimation'],
    quiz: [
      {
        id: 'wsd-1',
        prompt: 'A team proposes microservices, Kafka and a global multi-region database for an internal tool with 300 daily users. What is the most useful first question?',
        options: [
          'Which cloud provider will be cheapest?',
          'What requirement makes this complexity necessary?',
          'How many Kafka partitions should we use?',
          'Should we use gRPC or REST between services?',
        ],
        answer: 1,
        explanation:
          'Architecture is justified by requirements. With 300 users, none of that machinery is paid for by a real constraint, and every piece of it adds operational cost.',
      },
    ],
  },
  {
    slug: 'functional-requirements',
    title: 'Functional Requirements',
    tagline: 'What the system must do, stated as behaviour a user can observe.',
    category: 'getting-started',
    difficulty: 'Beginner',
    lab: 'requirements',
    keywords: ['requirements', 'scope', 'features'],
    what: 'Functional requirements describe the features and behaviours of a system: what a user can do, and what the system produces in response.',
    why: 'They define scope. Without an explicit list, every design discussion silently assumes a different product, and the architecture ends up sized for features nobody agreed to build.',
    how: [
      'Write each requirement as an action: "a user can send a message to a group".',
      'Separate the core flows from the nice-to-haves - the core flows drive the architecture.',
      'For each requirement, ask which data it reads and which data it writes.',
      'Only then decide which components you need.',
    ],
    when: [
      'At the start of every design, including interviews - always scope before designing.',
      'When a feature request arrives, to check whether the current architecture supports it.',
    ],
    diagram: `Design WhatsApp

  [x] Send a 1:1 message        -> needs durable message store
  [x] Receive messages live     -> needs push transport (WebSocket)
  [x] Group conversations       -> needs fan-out on write or read
  [ ] Video calls               -> needs media servers: different system
  [ ] Stories                   -> needs object storage + CDN`,
    tradeoffs: [
      {
        approach: 'Pin down a short feature list before designing',
        gains: ['The design is sized for features that exist, not imagined ones', 'Scope creep is visible because every addition is a written change'],
        costs: ['Some real needs surface late and force rework', 'Time spent in the interview or planning before any architecture appears'],
      },
      {
        approach: 'Design for a broad feature set up front',
        gains: ['Fewer surprises when later features arrive', 'Data model can anticipate future queries'],
        costs: ['More components to build, run and explain', 'Complexity is paid for features that may never ship'],
      },
    ],
    mistakes: [
      'Mixing in quality attributes: "must be fast" is non-functional, not functional.',
      'Accepting an unbounded feature list and then designing for all of it at once.',
      'Forgetting the unglamorous flows (search, delete, export) that shape the data model.',
    ],
    related: ['non-functional-requirements', 'capacity-estimation', 'what-is-system-design'],
    quiz: [
      {
        id: 'fr-1',
        prompt: 'Which of these is a functional requirement?',
        options: [
          'The feed loads in under 200 ms at p95',
          'A user can follow another user',
          'The service is available 99.99% of the time',
          'Data is replicated to three availability zones',
        ],
        answer: 1,
        explanation:
          'Following a user is observable behaviour. Latency, availability and replication describe how well the system behaves, not what it does.',
      },
    ],
  },
  {
    slug: 'non-functional-requirements',
    title: 'Non-Functional Requirements',
    tagline: 'How well the system must behave - and what that costs you.',
    category: 'getting-started',
    difficulty: 'Beginner',
    lab: 'requirements',
    keywords: ['availability', 'latency', 'consistency', 'durability', 'slo'],
    what: 'Non-functional requirements (NFRs) are the quality attributes of a system: availability, latency, throughput, consistency, durability, cost, security and operability.',
    why: 'NFRs, not features, are what force architecture. Two products with identical feature lists but different availability targets end up with completely different infrastructure.',
    how: [
      'Put a number on every attribute: "99.9%", "p95 < 200 ms", "no data loss on a single node failure".',
      'Translate each number into structure: 99.99% means redundancy plus automated failover.',
      'Check which attributes conflict - strong consistency and low latency across regions pull in opposite directions.',
      'Decide explicitly which one loses when they conflict.',
    ],
    when: [
      'Before choosing a database, a replication mode or a deployment topology.',
      'When defining SLOs with the people who will be paged.',
    ],
    diagram: `Availability target    Downtime per year
99%                    ~3.65 days
99.9%                  ~8.8 hours
99.99%                 ~52 minutes
99.999%                ~5.3 minutes`,
    advantages: [
      'Makes implicit expectations arguable instead of assumed.',
      'Gives you a stopping rule: you are done when the numbers are met.',
    ],
    tradeoffs: [
      {
        approach: 'Very high availability (99.99%+)',
        gains: ['Survives zone loss', 'Failover without human involvement'],
        costs: ['Multi-zone redundancy costs 2-3x', 'More moving parts to operate', 'Usually forces weaker consistency'],
      },
      {
        approach: 'Strong consistency everywhere',
        gains: ['Simple mental model', 'No stale reads to explain to users'],
        costs: ['Cross-region writes pay a round trip', 'Reduced availability during partitions (see CAP)'],
      },
    ],
    mistakes: [
      'Asking for "five nines" without pricing it.',
      'Averaging latency instead of looking at p95/p99, where real users live.',
      'Specifying consistency as a slogan rather than per operation - a "like" and a payment need different guarantees.',
    ],
    related: ['functional-requirements', 'cap-theorem', 'high-availability', 'slo'],
    quiz: [
      {
        id: 'nfr-1',
        prompt: 'A product owner asks for 99.999% availability on a service that runs as a single instance with a single database. What is the honest response?',
        options: [
          'Add more CPU to the instance',
          'That target implies redundancy, automated failover and multi-zone deployment - it changes the architecture and the budget',
          'Set a monitoring alert so we know when it is down',
          'Enable database backups',
        ],
        answer: 1,
        explanation:
          '99.999% allows about five minutes of downtime per year - less than a single manual restart. The number is an architecture decision, not a configuration flag.',
      },
    ],
  },
  {
    slug: 'capacity-estimation',
    title: 'Capacity Estimation',
    tagline: 'Turning user counts into requests per second, gigabytes and bandwidth.',
    category: 'getting-started',
    difficulty: 'Beginner',
    lab: 'capacity',
    labFocus: 'capacity-estimation',
    keywords: ['estimation', 'qps', 'storage', 'bandwidth', 'back of the envelope'],
    what: 'Capacity estimation converts product numbers (users, actions per user) into infrastructure numbers (requests per second, servers, storage per year, bandwidth).',
    why: 'It tells you whether you are designing for 50 requests per second or 50,000 - and those are different systems. It also catches impossible requirements early.',
    how: [
      'Start from daily active users and actions per user per day.',
      'Divide by 86,400 to get the average rate per second.',
      'Multiply by a peak factor (2-10x) - traffic is never flat.',
      'Divide the peak by what one server handles (about 1,000 req/sec when each request does real work) and add headroom.',
      'Multiply object size by writes per day for storage growth; then by 365, the retention period and the replication factor.',
      'Compute bandwidth as request rate times payload size, and check it against a single machine.',
    ],
    when: ['Early in any design discussion.', 'Before picking a storage engine or a sharding strategy.'],
    diagram: `10,000,000 DAU x 20 requests/day = 200,000,000 requests/day

200,000,000 / 86,400  ~=  2,315 req/sec  (average)
2,315 x 5 peak factor ~= 11,575 req/sec  (peak)
11,575 / 1,000 per server = 12, x 1.5 headroom = 18 servers

Writes 10% -> ~230 writes/sec average, ~1,160 at peak
2 KB per write -> ~40 GB/day -> ~15 TB/year (x 3 copies = 44 TB)`,
    tradeoffs: [
      {
        approach: 'Size from explicit estimates (DAU x requests x peak factor)',
        gains: ['Numbers justify choices such as sharding, caching or a single database', 'Order-of-magnitude mistakes are caught before they are built'],
        costs: ['Inputs are guesses, so the output is only as good as its assumptions', 'Needs revisiting as real traffic data arrives'],
      },
      {
        approach: 'Provision generous headroom above the estimate',
        gains: ['Absorbs spikes and estimation error without an outage', 'Buys time before the next scaling step'],
        costs: ['Idle capacity is paid for every month', 'Can hide an inefficient design until the bill arrives'],
      },
    ],
    mistakes: [
      'Designing for the average and being paged during the peak.',
      'Forgetting that reads and writes have wildly different costs.',
      'Forgetting the replication factor and the retention period in the storage estimate.',
      'Precision theatre: 11,575 and "about 10k" lead to the same decisions.',
    ],
    related: ['back-of-the-envelope', 'non-functional-requirements', 'sharding', 'horizontal-scaling'],
    quiz: [
      {
        id: 'cap-est-1',
        prompt: 'A system has 86.4 million requests per day with a 4x peak factor. Roughly what peak QPS should you design for?',
        options: ['1,000', '4,000', '10,000', '40,000'],
        answer: 1,
        explanation:
          '86.4M / 86,400 = 1,000 requests/sec average. With a 4x peak factor you size for about 4,000 requests/sec. 1,000 is the tempting answer, but it is the average second, and the average second never happens.',
      },
      {
        id: 'cap-est-2',
        prompt:
          'A photo app expects 1 million uploads a day at 2 MB each, keeps every photo forever and stores 3 copies. How much new storage does one year need?',
        options: ['About 2.2 PB', 'About 730 TB', 'About 2 TB', 'About 730 GB'],
        answer: 0,
        explanation:
          '1M x 2 MB = 2 TB a day; x 365 = 730 TB a year; x 3 copies = about 2.2 PB. 730 TB is the tempting answer: it is right for one copy, but every replica is billed storage. 2 TB is one day, not a year.',
      },
      {
        id: 'cap-est-3',
        prompt:
          'A team sized its fleet for the average of 2,000 req/sec, with no headroom. Most traffic arrives in the evening and the peak factor is 5x. What happens every evening?',
        options: [
          'Nothing - capacity plans are always based on the average',
          'Only the database slows down; app servers are fine',
          'The fleet sees about 10,000 req/sec, five times what it was sized for, so queues build and latency and errors climb',
          'Traffic is spread over the day automatically, so the peak never reaches the servers',
        ],
        answer: 2,
        explanation:
          'The peak is average x peak factor: 2,000 x 5 = 10,000 req/sec against capacity for 2,000. Traffic is not spread out for you - users arrive when they want. That is why the Lab sizes the App tier from the peak, not the average.',
      },
      {
        id: 'cap-est-4',
        prompt:
          'In the Lab you double Daily active users from 10M to 20M and change nothing else. What happens to the estimates?',
        options: [
          'Requests per second, storage growth and bandwidth all double; the read:write ratio stays the same',
          'Only requests per second doubles; storage depends on the object size, not on users',
          'Everything quadruples, because users and requests both grow',
          'Only the App tier grows; the database and object storage are sized separately',
        ],
        answer: 0,
        explanation:
          'Every estimate is DAU multiplied by something, so each one doubles: requests, writes, storage and bandwidth. The read:write ratio depends only on the write share, so it stays put. Storage does depend on users - more users make more writes, and every write adds an object.',
      },
      {
        id: 'cap-est-5',
        prompt:
          'The estimate says 10,400 peak reads/sec and 1,160 peak writes/sec. The database primary is struggling, and a teammate adds three read replicas. What does that change?',
        options: [
          'Writes spread across all four machines, so the primary does a quarter of the work',
          'Reads can move to the replicas; the primary still takes every one of the 1,160 writes',
          'Nothing - replicas exist only for durability, never for load',
          'Both reads and writes halve',
        ],
        answer: 1,
        explanation:
          'Replicas copy the data of the primary and can answer reads, which is most of this load (about 9:1). Every write still goes to the one primary, then gets copied to each replica. Replicas relieve reads; only partitioning spreads writes.',
      },
      {
        id: 'cap-est-6',
        prompt:
          'In the Lab you raise the write share and the Database card turns to "Partition the writes": peak writes are 40,000/sec against a planning limit of about 10,000 for one primary. What does the estimate tell you to plan?',
        options: [
          'More app servers, since they send the writes',
          'More read replicas',
          'A higher peak factor, to be safe',
          'Partitioning (sharding) the data, so the writes spread across several primaries',
        ],
        answer: 3,
        explanation:
          'Writes are the hard constraint because they all land on the primary. App servers and read replicas do not add write capacity. 10,000 writes/sec is a simplified planning number, not a measured limit - but 4x over it is a clear signal that one primary will not do.',
      },
      {
        id: 'cap-est-7',
        prompt:
          'Peak is 5,000 req/sec and every response is a 1 MB image. Can one server with a 1 Gbit/sec network card serve it?',
        options: [
          'Yes - 1 Gbit/sec is 1,000 MB/sec, so 5,000 MB/sec needs five such servers at most',
          'Yes, if the images are compressed',
          'No - 5,000 x 1 MB is 5 GB/sec, about 40 Gbit/sec, 40 times one link; serve the images from object storage through a CDN',
          'Only at average load, not at peak',
        ],
        answer: 2,
        explanation:
          '5,000 x 1 MB = 5,000 MB/sec = 40,000 Mbit/sec. A 1 Gbit/sec link moves about 125 MB/sec, not 1,000 - the tempting answer confuses bits with bytes. Bandwidth is an estimate of its own, and here it decides the design.',
      },
      {
        id: 'cap-est-8',
        prompt:
          'A logging service writes 500 GB a day, keeps logs for 30 days and stores 3 copies. How much storage does it need?',
        options: ['About 15 TB', 'About 45 TB', 'About 550 TB', 'About 1.5 TB'],
        answer: 1,
        explanation:
          '500 GB x 30 days x 3 copies = 45 TB, and it stays there because old logs are deleted as new ones arrive. 550 TB (500 GB x 365 x 3) is what you get if you forget the retention period; 15 TB forgets the copies.',
      },
      {
        id: 'cap-est-9',
        prompt:
          'An internal tool has 2,000 users making 50 requests a day each. The team plans a message queue, a sharded database and twelve microservices. What does the estimate say?',
        options: [
          'Build it all - the traffic will grow into it',
          'Shard now, because migrating later is expensive',
          'Put the API behind a CDN first',
          'About 100,000 requests a day is around 1 req/sec on average and maybe 10 at peak - one machine and a spare handle it; spend the complexity elsewhere',
        ],
        answer: 3,
        explanation:
          '2,000 x 50 = 100,000 requests a day / 86,400 = about 1.2 req/sec. Even at 10x peak that is far under one server. An estimate also stops over-engineering: the Lab shows "One machine and a spare" for loads under about 1,000 req/sec.',
      },
      {
        id: 'cap-est-10',
        prompt:
          'The peak is 7,200 req/sec and one app server handles about 1,000. The Lab shows 8 servers needed at peak and 12 with headroom. Why provision 12 rather than 8?',
        options: [
          'Eight covers the peak with no margin; headroom absorbs a spike above the estimate or a lost server, and keeps servers out of the utilisation where latency climbs',
          'Twelve is a safety habit with no real reason - eight is enough',
          'Because each server can only use half of its CPU',
          'Because read replicas need their own app servers',
        ],
        answer: 0,
        explanation:
          '7,200 / 1,000 rounds up to 8 servers running at 90% at the peak. One server failing, or a peak 20% above the estimate, would overload the rest. 50% headroom is a rule of thumb, and the 1,000 req/sec per server is a planning number, not a measurement.',
      },
      {
        id: 'cap-est-11',
        prompt:
          'A product owner says the app will have "somewhere between 1 million and 5 million" daily active users. What should you do with the estimate?',
        options: [
          'Wait until the exact number is known',
          'Average them to 3 million and use only that',
          'Run the estimate at both ends: if both land in the same category the design does not depend on the exact number; if not, that uncertainty is what to resolve',
          'Multiply 5 million by 10 to be safe',
        ],
        answer: 2,
        explanation:
          'Estimates pick a category, so an input range is fine: compute both ends. A single averaged number hides whether the range crosses a boundary (one machine, a fleet, a partitioned fleet). An arbitrary 10x on top only pays for idle capacity.',
      },
      {
        id: 'cap-est-12',
        prompt:
          'Tickets for a concert go on sale at 10:00 sharp. Which peak factor fits the estimate?',
        options: [
          '1x - the average is what matters',
          '2x, like a global service spread across time zones',
          '3x, like a normal evening peak',
          '10x or more - a scheduled event squeezes the traffic of hours into minutes',
        ],
        answer: 3,
        explanation:
          'A scheduled event concentrates demand: everyone arrives at 10:00. 2x fits traffic spread across time zones, and 3-5x a normal single-region evening; anything with a start time needs 10x or more, and often a queue in front.',
      },
    ],
  },
  {
    slug: 'back-of-the-envelope',
    title: 'Back-of-the-envelope Calculations',
    tagline: 'Round numbers, powers of ten and a handful of latencies you know by heart.',
    category: 'getting-started',
    difficulty: 'Beginner',
    lab: 'capacity',
    labFocus: 'back-of-the-envelope',
    keywords: ['latency numbers', 'estimation', 'napkin math', 'powers of ten', 'orders of magnitude'],
    what: 'Deliberately rough arithmetic - numbers rounded to powers of ten, plus a small set of memorised latency and size constants - that lets you sanity-check a design in seconds, without benchmarks.',
    why: 'If you know a disk seek (~10 ms) is roughly 100,000x slower than a memory reference (~100 ns), you can reject a design in your head instead of discovering the problem in production. Rounding makes the arithmetic fast enough to do in a meeting.',
    how: [
      'Round big numbers to powers of ten and multiply by adding exponents: 10^7 users x 10 requests = 10^8 a day.',
      'Round aggressively: 86,400 seconds per day is "about 10^5", so 10^8 a day is about 10^3 per second.',
      'Memorise orders of magnitude, not exact values: memory ~100 ns, SSD ~100 us, datacenter round trip ~0.5 ms, across an ocean ~150 ms.',
      'Always compare the result to one machine: can a single server do this?',
      'If the answer lands near a category boundary, stop rounding and do the exact sum.',
    ],
    diagram: `Approximate latencies (order of magnitude)

L1 cache reference                     ~1 ns
Main memory reference                ~100 ns
SSD random read                      ~100 us
Round trip within a datacenter       ~500 us
Disk seek (spinning)                  ~10 ms
Round trip California -> Netherlands ~150 ms

1 day ~= 86,400 s ~= 10^5 s
10^8 requests/day / 10^5 s = 10^3 req/sec`,
    when: ['During design reviews.', 'Whenever someone says "that should be fast enough".', 'Before a detailed capacity estimate, to know which order of magnitude you are in.'],
    tradeoffs: [
      {
        approach: 'Round, order-of-magnitude arithmetic',
        gains: ['Fast enough to do in an interview or a design review', 'Quickly rules out designs that cannot work, such as one disk for 1 PB'],
        costs: ['Misses constant factors that can matter near a limit', 'Easy to trust a rounded number more than it deserves'],
      },
      {
        approach: 'Exact arithmetic on the same inputs',
        gains: ['Removes rounding error, which matters when the answer sits near a boundary', 'Numbers can go straight into a budget or a purchase order'],
        costs: ['Slower, and needs a calculator in the meeting', 'Precision the inputs do not have - a DAU guess is rarely right to two figures'],
      },
      {
        approach: 'Benchmark or load test instead of estimating',
        gains: ['Real numbers for your hardware, data and code paths', 'Exposes bottlenecks no latency table predicts'],
        costs: ['Takes days of setup rather than minutes', 'Needs a working system, so it cannot guide the first design'],
      },
    ],
    mistakes: [
      'Treating these as benchmarks - they are ratios, and they shift with hardware.',
      'Ignoring the network round trip, usually the dominant term in a distributed call.',
      'Rounding every input the same way, so the errors add up instead of cancelling.',
      'Trusting a rough answer that lands right on a category boundary.',
      'Mixing bits and bytes: 1 Gbit/sec is about 125 MB/sec, not 1,000.',
    ],
    related: ['capacity-estimation', 'caching', 'cdn'],
    quiz: [
      {
        id: 'botec-1',
        prompt:
          'A request makes 50 random reads, one after another, and must answer within 100 ms. The data sits on SSDs. Does the design fit, and would it fit on spinning disks?',
        options: [
          'It fits on neither: 50 reads of any storage take seconds',
          'SSD: about 5 ms, fits. Spinning disk: 50 seeks of ~10 ms is about 500 ms, five times over budget',
          'It fits on both, since both take microseconds',
          'SSD: about 500 ms, too slow; spinning disk is fine because reads are sequential',
        ],
        answer: 1,
        explanation:
          'An SSD random read is about 100 us, so 50 x 100 us = 5 ms. A spinning-disk seek is about 10 ms, so 50 x 10 ms = 500 ms. Knowing the two orders of magnitude settles it in seconds - the reads here are random, so the sequential-read argument does not apply.',
      },
      {
        id: 'botec-2',
        prompt:
          'A checkout page in Europe calls a pricing service in the US once per cart item, one call after another. Carts hold 30 items and the page budget is 500 ms. What do you tell the team?',
        options: [
          'Fine - network calls take microseconds',
          'Make the pricing service code faster',
          'About 30 x 150 ms = 4.5 s, nine times over budget: batch the 30 items into one call, or cache prices near the page',
          'Add more pricing servers so each call is shorter',
        ],
        answer: 2,
        explanation:
          'A transatlantic round trip is about 150 ms, set by distance, not by server speed. Faster code or more servers do not shorten the trip. Removing round trips (one batched call) or shortening the distance (a local cache) is the only fix.',
      },
      {
        id: 'botec-3',
        prompt:
          'In the Lab with rounding on, 12M users x 8 requests becomes 10^7 x 10. The rough peak is 5,000 req/sec and the exact one is 5,556. What does the "1.1x" in the Rough against exact table mean for the design?',
        options: [
          'The rough answer is wrong and must be thrown away',
          'Both land in the same category, a fleet behind a load balancer, so the rough answer leads to the same design',
          'The rough answer always underestimates, so add 10% to everything',
          'The design needs 10% more categories',
        ],
        answer: 1,
        explanation:
          'Rounding only has to get the category right, and a 1.1x gap is far inside one order of magnitude. Rough answers are not always low - 12M rounded down while 8 rounded up, and those errors partly cancelled.',
      },
      {
        id: 'botec-4',
        prompt:
          'A teammate objects that dividing by 10^5 seconds instead of 86,400 is "wrong". How big is that error, and does it matter?',
        options: [
          'About 14% low on the rate - far smaller than the uncertainty in a DAU guess, so it changes no decision',
          'About 10x - it must never be done',
          'No error at all, the two are equal',
          'About 50% - acceptable only in interviews',
        ],
        answer: 0,
        explanation:
          '86,400 / 100,000 = 0.86, so the rate comes out about 14% low. User counts are often guesses that are off by 2x or more, so 14% never moves an estimate into a different category. It is a real error, just an unimportant one.',
      },
      {
        id: 'botec-5',
        prompt:
          'In the Lab on the default setup with rounding on, 20 requests per user rounds to 10 and 2 KB rounds to 1 KB. Rough storage comes out about 4x below exact. Why?',
        options: [
          'Rounding to powers of ten is always 4x off',
          'The replication factor is ignored in rough mode',
          'Rough mode uses 1,024 bytes per KB',
          'Both inputs rounded down, so their errors multiplied (2x times 2x) instead of cancelling',
        ],
        answer: 3,
        explanation:
          'Each power-of-ten rounding can be off by up to about 3x. When one input rounds up and another down, errors cancel; when both go the same way they compound. The fix is to notice it - round one of them the other way, or check the exact sum.',
      },
      {
        id: 'botec-6',
        prompt:
          'The rough estimate says 800 peak req/sec, which would mean one machine and a spare. The exact sum says 1,300, which means a fleet. What should you do?',
        options: [
          'Trust the rough number - that is the point of rounding',
          'Trust whichever number is cheaper',
          'Treat it as a boundary case: do the exact arithmetic and firm up the inputs, since the decision depends on them',
          'Average them to 1,050 and pick the fleet',
        ],
        answer: 2,
        explanation:
          'Rounding is safe when the answer is far from a boundary; here the rough and exact answers land in different categories, so precision now matters. The Lab flags this case in its insight. Picking the cheaper number ignores the evidence.',
      },
      {
        id: 'botec-7',
        prompt: 'A backup job must copy 500 MB every second over 1 Gbit/sec links. How many links does it need, at minimum?',
        options: ['One - 1 Gbit/sec is 1,000 MB/sec', 'About four - each link moves about 125 MB/sec', 'Forty', 'Half a link'],
        answer: 1,
        explanation:
          'Divide bits by 8: 1 Gbit/sec is about 125 MB/sec, so 500 MB/sec needs about four links, more with protocol overhead. Reading Gbit as GB is the classic 8x mistake.',
      },
      {
        id: 'botec-8',
        prompt:
          'A write must be stored in Europe and in the US before the user sees "saved". The servers are fast and idle. Roughly what is the lowest possible time for that write?',
        options: [
          'About 1 ms - fast servers make it local',
          'About 10 ms, the cost of a disk seek',
          'About 1 second',
          'At least one transatlantic round trip, roughly 70-150 ms - distance sets the floor, not the servers',
        ],
        answer: 3,
        explanation:
          'Light in fibre covers roughly 200 km per millisecond, and the path is never straight, so a round trip between Europe and the US costs tens to a hundred-plus milliseconds. No hardware upgrade removes it; only avoiding the synchronous cross-region wait does.',
      },
      {
        id: 'botec-9',
        prompt:
          'A page loads a list of 200 items, then runs one database query per item. The database is in the same datacenter. What does the arithmetic say?',
        options: [
          'About 200 x 0.5 ms = 100 ms spent just on round trips; one batched query makes it one round trip',
          'Nothing to worry about - in the same datacenter round trips are free',
          'About 200 ns, since memory is involved',
          'About 30 seconds',
        ],
        answer: 0,
        explanation:
          'A round trip within a datacenter is about 0.5 ms, so 200 of them are about 100 ms before the database does any work. That is the N+1 query problem: the cost is the number of trips, which is why batching beats faster code.',
      },
      {
        id: 'botec-10',
        prompt:
          'A cache answers 90% of reads from memory (~100 ns) and the rest go to SSD (~100 us). Which part dominates the average read time?',
        options: [
          'The hits, because there are nine times more of them',
          'Both contribute equally',
          'The misses: 10% x 100 us = 10 us, against about 0.09 us for all the hits together',
          'Neither - the average is simply 100 ns',
        ],
        answer: 2,
        explanation:
          'SSD is about 1,000x slower than memory, so the 10% of misses cost far more than the 90% of hits: 10 us against 0.09 us. Raising the hit rate from 90% to 99% cuts the average almost tenfold.',
      },
      {
        id: 'botec-11',
        prompt:
          'A manager says: "We will get a million requests a day - surely we need a cluster?" What does a ten-second estimate say?',
        options: [
          'Yes - a million is a lot for one server',
          'About 10 req/sec on average (10^6 / 10^5), maybe 100 at peak - one machine handles it, with a spare for failures',
          'About 1 million req/sec, so a large cluster',
          'It cannot be known without a load test',
        ],
        answer: 1,
        explanation:
          '10^6 requests / 10^5 seconds = 10 req/sec; even a 10x peak is 100 req/sec, far below what one server does. "A million" sounds large only until it is normalised to per-second.',
      },
    ],
  },
  {
    slug: 'what-happens-when-you-type-a-url',
    title: 'What Happens When You Type a URL?',
    tagline: 'One request, a dozen systems - the guided tour of the whole stack.',
    category: 'getting-started',
    difficulty: 'Beginner',
    lab: 'url-journey',
    labFocus: 'what-happens-when-you-type-a-url',
    keywords: ['dns', 'tcp', 'tls', 'cdn', 'rendering', 'journey'],
    what: 'A step-by-step walk through everything that happens between pressing Enter and seeing a rendered page: name resolution, connection setup, encryption, caching layers, the backend, and rendering.',
    why: 'It is the single best map of how the pieces relate. Almost every other concept in system design appears somewhere along this path.',
    how: [
      'The browser checks its caches, then resolves the hostname through DNS.',
      'A TCP connection is opened (or reused), then TLS negotiates encryption.',
      'The HTTP request may be answered by a CDN edge without reaching your origin at all.',
      'At the origin, a load balancer picks a server, which checks a cache before querying the database.',
      'The response travels back and the browser parses, lays out and paints it.',
    ],
    when: [
      'As the map: almost every other Concept sits somewhere on this path.',
      'When a page is slow: find which stage the time goes to before optimising any one of them.',
      'In a design interview, as the first sketch of the request path.',
    ],
    advantages: [
      'Shows that connection setup and rendering often cost more than the server code.',
      'Shows every place a request can be answered early: browser cache, DNS cache, CDN, application cache.',
    ],
    diagram: `Browser -> DNS -> TCP -> TLS -> HTTP request
   -> CDN edge (hit? done)
   -> Load Balancer -> Backend -> Cache -> Database
   -> HTTP response -> parse, layout, paint`,
    tradeoffs: [
      {
        approach: 'Keep connections and DNS answers warm (keep-alive, DNS caching, TLS resumption)',
        gains: ['Later requests skip the DNS lookup and TCP and TLS handshakes', 'Cuts several round trips from every repeat visit'],
        costs: ['Cached DNS answers delay failover to a new address until the TTL expires', 'Open connections hold memory and file descriptors on both ends'],
      },
      {
        approach: 'Serve the first byte from a nearby CDN edge',
        gains: ['Handshakes finish over a short round trip instead of a cross-continent one', 'Cached static assets are served without a trip to the origin'],
        costs: ['Another layer to configure, pay for and debug', 'Stale content until caches expire or are purged'],
      },
    ],
    mistakes: [
      'Assuming the server is the slow part - DNS, connection setup and rendering often dominate.',
      'Forgetting that the first request on a cold connection pays DNS + TCP + TLS before any work starts.',
    ],
    related: ['dns', 'http-https', 'tls-https', 'cdn', 'load-balancing', 'caching'],
    quiz: [
      {
        id: 'url-1',
        prompt:
          'A user opens your page and waits 400 ms. A few seconds later they click a link to another page on the same site, and it takes 150 ms. Same server, same code. What explains most of the difference?',
        options: [
          'The server was still starting up during the first request',
          'The second page is smaller',
          'The first request paid for a DNS lookup and the TCP and TLS handshakes; the second reused the open connection',
          'The browser rendered the second page from its cache without asking the server',
        ],
        answer: 2,
        explanation:
          'A new connection pays DNS + TCP + TLS before the request is even sent; a reused one skips all three. In the Lab, turn Warm connection on and watch those stages turn to skipped. The server warming up is the tempting answer, but the Lesson shows the setup cost alone is often 150 ms or more.',
      },
      {
        id: 'url-2',
        prompt:
          'Your only origin is in Virginia. Users in Singapore see slow first loads, although the handler takes 30 ms. Which change cuts their time the most?',
        options: [
          'Put a CDN in front, so the TCP and TLS handshakes end at an edge near them and static files are served there',
          'Add a database index',
          'Double the number of app servers',
          'Move from TLS 1.3 back to TLS 1.2',
        ],
        answer: 0,
        explanation:
          'Every handshake costs a full round trip, and the round trip to Virginia is the big number. In the Lab, set the round trip to the origin to 200 ms and toggle the CDN: the TCP and TLS stages drop to the 10 ms edge round trip. An index or more servers only touch the 30 ms of backend work, and TLS 1.2 adds a round trip instead of removing one.',
      },
      {
        id: 'url-3',
        prompt:
          'A cold page load takes 1.2 s. Profiling shows your server code runs for 40 ms. The team plans a sprint to make the handler twice as fast. What should you say?',
        options: [
          'Good plan - the handler is the only part you control',
          'Make the database faster first, it is always the slowest part',
          'Buy bigger servers instead, it is quicker',
          'It saves 20 ms of 1,200. Look at the handshakes, the transfer and the rendering first - that is where the time is',
        ],
        answer: 3,
        explanation:
          'The worked example in the Lesson is exactly this: 40 ms of server time in about 1.19 s. Halving the handler saves under 2 percent, while a CDN and a smaller JavaScript bundle save more than half. "It is the only part we control" is wrong - you control connection reuse, the CDN, cache headers and the bundle too.',
      },
      {
        id: 'url-4',
        prompt:
          'After a deploy the cache hit rate drops from 95% to 50%. What does the path of a request that misses look like now?',
        options: [
          'Load balancer, app server, then an error, because the cache failed',
          'Load balancer, app server, cache (miss), database, then the result is stored in the cache and the response goes back',
          'Load balancer straight to the database, skipping the app server',
          'CDN edge, then the database',
        ],
        answer: 1,
        explanation:
          'A miss is not an error: the app server asks the cache, and on a miss it queries the database and fills the cache for the next request. In the Lab, turn Cache hit off and the Database query stage appears. Half the requests now pay the 35 ms query, which is why the drop hurts.',
      },
      {
        id: 'url-5',
        prompt:
          'A page loads fonts, scripts and images from eight different domains. Every one of those servers answers in under 10 ms, yet the page is slow on a first visit. Why?',
        options: [
          'Browsers can only download one file at a time',
          'The servers must be overloaded',
          'Each new domain needs its own DNS lookup, TCP handshake and TLS handshake before its first file arrives',
          'Images are always slower than HTML',
        ],
        answer: 2,
        explanation:
          'Connection setup is paid per origin. Eight domains means up to eight lookups and sixteen handshake round trips on a cold visit, and no server optimisation can remove them. Serving from fewer origins, and reusing one connection with HTTP/2, removes them. The servers being overloaded does not fit: each one answers in under 10 ms.',
      },
      {
        id: 'url-6',
        prompt:
          'A user on cafe Wi-Fi types example.com without https:// for the first time. Your site redirects HTTP to HTTPS. What is the risk, and what closes it?',
        options: [
          'The first request goes out as plain HTTP and can be intercepted before the redirect; HSTS, and the HSTS preload list for first visits, make the browser use HTTPS from the start',
          'There is no risk, because the redirect happens before any data is sent',
          'The risk is DNS, and a shorter TTL closes it',
          'The risk is the CDN, and turning it off closes it',
        ],
        answer: 0,
        explanation:
          'The browser only learns about HTTPS from the redirect, and that redirect arrives over plain HTTP that anyone on the Wi-Fi can read or replace. HSTS tells the browser to never try plain HTTP again, and preloading ships that rule inside the browser, so even the first visit is protected. "No risk" is wrong because the request carrying the redirect is itself unprotected.',
      },
      {
        id: 'url-7',
        prompt:
          'A CDN sits in front of your site. Which requests does the edge answer on its own, without contacting your origin?',
        options: [
          'Every request, because that is what a CDN is for',
          'None - a CDN only speeds up the network, it never answers',
          'Only POST requests',
          'Cacheable files it already holds, such as images, scripts and styles; a page built for each user is forwarded to the origin',
        ],
        answer: 3,
        explanation:
          'The edge can only answer with a response it may cache and has cached. A personalised page has to come from your servers, so the edge forwards it - that is the "miss, forward" you see on the CDN edge in the Lab. It still helps that page, because the handshakes end at the nearby edge.',
      },
      {
        id: 'url-8',
        prompt:
          'You moved the site to a new server and updated the A record an hour ago. Some users still reach the old server. At which stage of the journey does that happen?',
        options: [
          'The TLS handshake, because the old certificate is still valid',
          'DNS resolution: resolvers and browsers still hold the old answer until its TTL runs out',
          'The load balancer, because it has not been restarted',
          'Rendering, because the browser cached the old page',
        ],
        answer: 1,
        explanation:
          'Nothing is pushed to DNS caches. Each one keeps the old address until the TTL of the record runs out, so a 24-hour TTL can mean a day of traffic to the old server. The certificate is the tempting answer, but it does not choose which address the browser connects to - DNS does.',
      },
      {
        id: 'url-9',
        prompt:
          'A user reports that your site does not load and their browser says the name could not be resolved. From your office, the site works. Which part of the journey failed for them?',
        options: [
          'DNS resolution - their browser never got an IP address, so it never even contacted your servers',
          'The TLS handshake',
          'The database',
          'Rendering',
        ],
        answer: 0,
        explanation:
          'A name that cannot be resolved stops the journey at the first network stage: no address, so no TCP, no TLS and no request. Your servers saw nothing, which is why they look healthy. A TLS failure would show a certificate or connection error instead, after the address was found.',
      },
      {
        id: 'url-10',
        prompt: 'In the Lab, with the CDN on, where does the TLS connection of the browser end?',
        options: [
          'At the app server',
          'At the database',
          'At the load balancer, always',
          'At the CDN edge, which holds a certificate for your domain and opens its own connection to the origin',
        ],
        answer: 3,
        explanation:
          'The browser handshakes with whatever it connects to, and with a CDN that is the edge. That is why the TLS stage costs the 10 ms edge round trip, not the origin round trip. With the CDN off, the load balancer shows "ends here" instead - so "always the load balancer" is only true without a CDN.',
      },
    ],
  },
];
