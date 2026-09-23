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
    keywords: ['estimation', 'qps', 'storage', 'bandwidth', 'back of the envelope'],
    what: 'Capacity estimation converts product numbers (users, actions per user) into infrastructure numbers (requests per second, storage per year, bandwidth).',
    why: 'It tells you whether you are designing for 50 requests per second or 50,000 - and those are different systems. It also catches impossible requirements early.',
    how: [
      'Start from daily active users and actions per user per day.',
      'Divide by 86,400 to get the average rate per second.',
      'Multiply by a peak factor (2-10x) - traffic is never flat.',
      'Multiply object size by write rate for storage growth; add the retention period.',
      'Compute bandwidth as request rate times payload size, and check it against a single machine.',
    ],
    when: ['Early in any design discussion.', 'Before picking a storage engine or a sharding strategy.'],
    diagram: `10,000,000 DAU x 20 requests/day = 200,000,000 requests/day

200,000,000 / 86,400  ~=  2,315 req/sec  (average)
2,315 x 5 peak factor ~= 11,575 req/sec  (peak)

Writes 10% -> ~230 writes/sec average
2 KB per write -> ~40 GB/day -> ~14 TB/year`,
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
      'Precision theatre: 11,575 and "about 10k" lead to the same decisions.',
    ],
    related: ['non-functional-requirements', 'sharding', 'horizontal-scaling'],
    quiz: [
      {
        id: 'cap-est-1',
        prompt: 'A system has 86.4 million requests per day with a 4x peak factor. Roughly what peak QPS should you design for?',
        options: ['1,000', '4,000', '10,000', '40,000'],
        answer: 1,
        explanation:
          '86.4M / 86,400 = 1,000 requests/sec average. With a 4x peak factor you size for about 4,000 requests/sec.',
      },
    ],
  },
  {
    slug: 'back-of-the-envelope',
    title: 'Back-of-the-envelope Calculations',
    tagline: 'The handful of numbers every engineer should know by heart.',
    category: 'getting-started',
    difficulty: 'Beginner',
    keywords: ['latency numbers', 'estimation', 'napkin math'],
    what: 'A small set of memorised latency and size constants that let you sanity-check a design in seconds, without benchmarks.',
    why: 'If you know a disk seek is roughly 100,000x slower than an L1 cache reference, you can reject a design in your head instead of discovering the problem in production.',
    how: [
      'Memorise orders of magnitude, not exact values.',
      'Round aggressively: 86,400 seconds per day is "about 100k".',
      'Always compare the result to one machine: can a single server do this?',
    ],
    diagram: `Approximate latencies (order of magnitude)

L1 cache reference                    ~1 ns
Main memory reference                ~100 ns
Read 1 MB sequentially from memory    ~10 us
SSD random read                      ~100 us
Read 1 MB from SSD                   ~200 us
Round trip within a datacenter       ~500 us
Disk seek (spinning)                  ~10 ms
Round trip California -> Netherlands ~150 ms

1 day ~= 86,400 s ~= 10^5 s
1 million seconds ~= 11.6 days`,
    when: ['During design reviews.', 'Whenever someone says "that should be fast enough".'],
    tradeoffs: [
      {
        approach: 'Round, order-of-magnitude arithmetic',
        gains: ['Fast enough to do in an interview or a design review', 'Quickly rules out designs that cannot work, such as one disk for 1 PB'],
        costs: ['Misses constant factors that can matter near a limit', 'Easy to trust a rounded number more than it deserves'],
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
    ],
    related: ['capacity-estimation', 'caching', 'cdn'],
  },
  {
    slug: 'what-happens-when-you-type-a-url',
    title: 'What Happens When You Type a URL?',
    tagline: 'One request, twelve systems - the guided tour of the whole stack.',
    category: 'getting-started',
    difficulty: 'Beginner',
    lab: 'url-journey',
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
    related: ['dns', 'tls-https', 'cdn', 'load-balancing', 'caching'],
  },
];
