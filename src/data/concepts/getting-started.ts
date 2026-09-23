import type { Concept } from '@/types';

export const gettingStartedConcepts: Concept[] = [
  {
    slug: 'what-is-system-design',
    title: 'What is System Design?',
    tagline: 'Choosing a structure that satisfies requirements you can actually name.',
    category: 'getting-started',
    difficulty: 'Beginner',
    lab: 'requirements',
    labFocus: 'what-is-system-design',
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
          'Architecture is justified by requirements. With 300 users, none of that machinery is paid for by a real constraint, and every piece of it adds operational cost. Picking a cloud or a partition count first skips the question of whether the parts are needed at all.',
      },
      {
        id: 'wsd-2',
        prompt: 'In the Requirements Lab you tick only "Send messages", at 99% availability and 1k daily users. The diagram shows Users, one App server and one Database. A teammate says the design is too simple to be real. What is the right response?',
        options: [
          'Add a cache and a queue now so the design looks complete',
          'Add a second region so the design is ready for growth',
          'It meets these requirements; add a part only when a requirement or a measured bottleneck forces it',
          'Replace the database with a NoSQL store, because messaging apps use NoSQL',
        ],
        answer: 2,
        explanation:
          'A design is right relative to its requirements. At 1k users and 99%, one server and one database meet every stated number. A cache or a second region would be parts no requirement pays for - they cost money and operations every day. The Lab shows the same thing: nothing else appears until you raise a target or tick a feature.',
      },
      {
        id: 'wsd-3',
        prompt: 'A URL shortener is estimated at about 1,160 redirects per second and 12 new links per second, running on one Postgres instance. Which single component is the most useful to add first?',
        options: [
          'A cache in front of the database, keyed by short code',
          'Sharding the database across four machines',
          'A message queue in front of the writes',
          'Splitting the app into microservices',
        ],
        answer: 0,
        explanation:
          'Reads outnumber writes about 100 to 1, so the first thing to saturate is the read path, and a cache relieves exactly that. Sharding solves a storage or write problem the estimate does not show (about 0.5 GB a day fits one machine for years), and a queue in front of 12 writes per second fixes nothing.',
      },
      {
        id: 'wsd-4',
        prompt: 'You just added a cache in front of the database and the read latency dropped. According to the design loop, what is the step people most often skip?',
        options: [
          'Adding a second cache for redundancy',
          'Naming the new problem it creates - for example a deleted link that still resolves until its cache entry expires',
          'Sharding the database while you are at it',
          'Nothing - the bottleneck is fixed, so the design is finished',
        ],
        answer: 1,
        explanation:
          'Every component solves one problem and brings a new one. A cache brings stale data; saying so out loud is what lets you decide whether an expiry time or an invalidation is needed. Declaring the design finished hides that cost, and adding more parts before naming it repeats the mistake.',
      },
      {
        id: 'wsd-5',
        prompt: 'Two teams build products with the same feature list. One must reach 99.9% availability, the other 99.999%. What should you expect of their architectures?',
        options: [
          'They will be the same, because the features are the same',
          'The 99.999% team only needs faster servers',
          'They will differ only in their monitoring dashboards',
          'They will differ: the stricter target forces extra copies, automated failover and more than one region',
        ],
        answer: 3,
        explanation:
          'Features decide what the system does; the quality targets decide how it must be built. 99.999% allows about 5 minutes of downtime a year - no human can react in time - so it forces redundancy everywhere and automated failover across regions. Faster servers do not survive a machine or a region failing.',
      },
      {
        id: 'wsd-6',
        prompt: 'In an interview you are asked "SQL or NoSQL for this service?" and you do not know the access pattern yet. What is the most useful answer?',
        options: [
          'Name what the choice depends on - the access pattern, the write rate, whether ad-hoc joins are needed - and pick once those are known',
          'NoSQL, because it scales',
          'SQL, because it is always the safe choice',
          'Both, so either kind of query is covered',
        ],
        answer: 0,
        explanation:
          '"It depends" is only useful when you say what it depends on. One known key at 50k writes per second points to a key-value store; ad-hoc joins across five entities point to a relational database. A blanket answer ignores the inputs, and "both" doubles the parts to operate without a requirement asking for it.',
      },
      {
        id: 'wsd-7',
        prompt: 'In the Requirements Lab (Design WhatsApp) you tick "Send images". Object storage, a CDN and a Queue + workers box appear on the diagram. What does that show?',
        options: [
          'Every chat app needs a CDN from day one',
          'Images made the database the bottleneck',
          'A new requirement brings in the parts its own traffic needs',
          'A quality target was raised',
        ],
        answer: 2,
        explanation:
          'Each box names the requirement that forced it: images need somewhere to keep large files, a way to process them off the request path, and a CDN to serve them close to users. No slider moved, so no quality target changed, and the database is not on the image path at all.',
      },
      {
        id: 'wsd-8',
        prompt: 'Your team decides to evolve the design as usage grows instead of designing everything up front. Which decision still deserves careful thought now?',
        options: [
          'The number of app servers',
          'The cache expiry time',
          'The log format',
          'The data model and the partitioning key',
        ],
        answer: 3,
        explanation:
          'Evolving the design ships sooner, but some choices are expensive to reverse: changing the data model or the partitioning key means migrating data under load. Server counts, cache expiry times and log formats can change any day with little risk.',
      },
      {
        id: 'wsd-9',
        prompt: 'An engineer adds Kafka to a design "in case we need it later". No requirement or estimate mentions streaming or high write rates. What is the real cost?',
        options: [
          'None - an unused component costs nothing',
          'A part that must be deployed, monitored, upgraded and paged for, with no requirement paying for it',
          'Only the licence fee',
          'It makes the design more reliable, so there is no cost',
        ],
        answer: 1,
        explanation:
          'Over-engineering is complexity no requirement pays for. Every component can fail, needs on-call knowledge and adds a hop, so it lowers reliability rather than raising it. Kafka is open source, so the cost is not a licence - it is the operations.',
      },
      {
        id: 'wsd-10',
        prompt: 'A design review shows one database box that everything depends on. The target is 99.99% availability, and nobody has asked what happens when that box dies. What should you do next?',
        options: [
          'Ask what happens when it fails: 99.99% leaves about 52 minutes a year, so the database needs a standby with automated failover',
          'Approve it - databases rarely fail',
          'Add more CPU to the database',
          'Add a cache so the database is used less',
        ],
        answer: 0,
        explanation:
          'A diagram is not finished until every box has been asked "what if this dies?". A recovery done by hand takes a large part of the 52-minute yearly budget, so 99.99% forces a standby with automatic promotion - which is what the Lab adds when you move Availability to 99.99%. More CPU or a cache do nothing when the machine is gone.',
      },
      {
        id: 'wsd-11',
        prompt: 'A service passes every unit test, yet the product goes down for 20 minutes whenever its only machine reboots for a kernel update. What does this show?',
        options: [
          'The unit tests were wrong',
          'The code needs better error handling',
          'Correct code is not enough: the design decides what happens when a machine disappears',
          'Kernel updates should never be installed',
        ],
        answer: 2,
        explanation:
          'Code answers "is the output correct for this input?". Design answers "does it keep working at scale, with a dead node, during a partition?". The tests can be perfect and the function correct; with one machine, its reboot is an outage. Skipping security updates just trades this outage for a worse one.',
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
    labFocus: 'functional-requirements',
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
        prompt: 'You are sorting a product brief for a social app into two lists before designing. Which line belongs on the functional requirements list?',
        options: [
          'The feed loads in under 200 ms at p95',
          'A user can follow another user',
          'The service is available 99.99% of the time',
          'Data is replicated to three availability zones',
        ],
        answer: 1,
        explanation:
          'Following a user is behaviour a user can observe. Latency and availability describe how well the system behaves - they go on the non-functional list - and replication across zones is not a requirement at all but a design decision made to meet one.',
      },
      {
        id: 'fr-2',
        prompt: 'An interviewer opens with "Design Twitter" and waits. What is the best first move?',
        options: [
          'Draw the load balancer, app servers and database straight away',
          'Ask which database Twitter uses in production',
          'Estimate the storage needed for ten years of tweets',
          'Propose a scope - post a tweet, follow a user, read the home timeline - and say that DMs, ads and search are out unless wanted',
        ],
        answer: 3,
        explanation:
          '"Design Twitter" is a brand name, not a set of requirements. Thirty seconds of agreed scope decides what every later box is for. Drawing or estimating first sizes the design for a product nobody agreed on, and the real Twitter database says nothing about your requirements.',
      },
      {
        id: 'fr-3',
        prompt: 'A requirements list for a photo app contains the line "Photos are stored in S3". What is wrong with it?',
        options: [
          'Nothing - S3 is a good choice for photos',
          'It is a solution written as a requirement; rewrite it as "a user can upload a photo up to 25 MB and see it on their profile"',
          'It should say "Photos are stored in a CDN" instead',
          'It is a non-functional requirement and belongs in the other list',
        ],
        answer: 1,
        explanation:
          'A technology name in the requirements smuggles a decision in without debate. Stated as user behaviour, the requirement leaves the storage choice open until the design, where it can be argued. It is not non-functional either - it names no quality target, only an implementation.',
      },
      {
        id: 'fr-4',
        prompt: 'A stakeholder adds "The app must be fast" to the functional requirements. What should you do with it?',
        options: [
          'Move it to the non-functional list and give it a number, for example "the feed loads in under 200 ms at p95"',
          'Keep it - speed is a feature users notice',
          'Delete it - speed cannot be designed for',
          'Replace it with "use a cache"',
        ],
        answer: 0,
        explanation:
          'It describes how well, not what, so it is non-functional - and without a number nobody can tell when it is met. Deleting it loses a real expectation, and "use a cache" is a solution that may or may not be what meets the number.',
      },
      {
        id: 'fr-5',
        prompt: 'In the Requirements Lab (Design Instagram) you tick "Search users and tags". A Search index appears, fed by the Queue + workers box. Why does one checkbox add these parts?',
        options: [
          'Search is a quality target, so it adds infrastructure',
          'The database cannot store user names',
          'Searching needs its own index, kept in step with the database by background work - the feature pulls in the parts its traffic needs',
          'Every Instagram design must have a search index',
        ],
        answer: 2,
        explanation:
          'Full-text and prefix search over names and tags is served by a separate index, and something must copy every change into it - here, workers reading events from a queue. Search is a feature, not a quality target, and the diagram only has an index while that feature is ticked.',
      },
      {
        id: 'fr-6',
        prompt: 'You have the requirement "A user can see a feed of posts from people they follow". Which question about it shapes the architecture most?',
        options: [
          'Which framework will render the feed',
          'What colour the feed cards are',
          'Whether posts need an edit history',
          'What it reads and writes and how often - here a feed read far more often than posts are written',
        ],
        answer: 3,
        explanation:
          'Reads, writes and their rate are what components are built to serve. A read-heavy feed points to caching and precomputed timelines. The framework and the card colour do not change a single box, and edit history is a separate requirement.',
      },
      {
        id: 'fr-7',
        prompt: 'A team listed only post, follow and view feed. A year later a legal request arrives: "a user can delete their account and all their data". Why is this now painful?',
        options: [
          'Deleting touches every table, every cache, the CDN copies and the object storage, and the data model was never designed for it',
          'Deletes are slower than inserts in every database',
          'Legal requests always need a new database',
          'It is not painful - a single DELETE statement handles it',
        ],
        answer: 0,
        explanation:
          'The unglamorous requirements - delete, export, search, edit - shape the data model. Missing one at the start means reworking storage later. One DELETE on one table leaves copies in caches, feeds, the CDN and object storage.',
      },
      {
        id: 'fr-8',
        prompt: 'In the Requirements Lab (Design WhatsApp) you tick "Voice and video calls". Media servers appear and "Beyond core" goes up. The product manager says it is just one more checkbox. What is the honest answer?',
        options: [
          'Agree - the app servers can relay the audio',
          'Calls are a separate system (media relays and call signalling); keep them out of scope, or plan them as a subsystem with their own budget',
          'Add it, because it does not change the diagram much',
          'Replace WebSockets with calls',
        ],
        answer: 1,
        explanation:
          'Real-time audio and video need media relays built for it, with their own scaling and bandwidth costs - the Lab marks the feature as extra for that reason. App servers built for small messages are the wrong place to relay media, and the WebSocket tier is still needed to ring the other phone.',
      },
      {
        id: 'fr-9',
        prompt: 'You design posting, following and the feed without mentioning direct messages. Near the end the interviewer asks "and where do DMs fit?". What would have prevented this?',
        options: [
          'Designing for every possible feature from the start',
          'Adding a message queue in advance',
          'Saying at the start that DMs are out of scope, so the exclusion was agreed',
          'Nothing - interviewers always add features at the end',
        ],
        answer: 2,
        explanation:
          'An unlisted feature is an assumed feature: the other person was holding it in their head. Naming exclusions makes them negotiable at the start instead of a surprise at the end. Designing for everything, or adding parts in advance, pays for features that may never be asked for.',
      },
      {
        id: 'fr-10',
        prompt: 'You have nine candidate features for a photo app. Which ones should drive the architecture?',
        options: [
          'All nine equally, so nothing is missed',
          'The ones that are hardest to build',
          'The ones the team has built before',
          'The two or three core flows that carry most of the traffic, such as viewing the home feed',
        ],
        answer: 3,
        explanation:
          'A few core flows create nearly all the load and so all the architectural pressure; everything else rides on the same infrastructure. Weighting all nine equally sizes the system for rare features, and difficulty or familiarity say nothing about load.',
      },
      {
        id: 'fr-11',
        prompt: 'A team designs for fifteen features although only three are planned this year, "so we will not have to redesign later". What do they pay for it?',
        options: [
          'Nothing - a broad design is always cheaper in the long run',
          'More components to build, run and explain now, paid for features that may never ship',
          'Only a slightly longer design document',
          'Lower availability, because fifteen features cannot run on one server',
        ],
        answer: 1,
        explanation:
          'Designing broad up front gains fewer surprises later but costs complexity today, much of it for features that may be cut. Pinning a short list costs some rework when a real need appears late. Neither is free - that is the trade-off.',
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
    labFocus: 'non-functional-requirements',
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
        costs: ['Copies in 2-3 zones cost roughly 2-3x', 'More moving parts to operate', 'Going multi-region usually forces weaker consistency'],
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
          '99.999% allows about 5 minutes of downtime per year - less than it takes to page a human, let them log in and restart anything. The number is an architecture decision, not a configuration flag. More CPU, an alert or backups all leave the single instance as the thing that takes everything down.',
      },
      {
        id: 'nfr-2',
        prompt: 'The dashboard shows an average latency of 99 ms, yet users complain the app is slow. Out of 100 requests, 99 take 50 ms and one takes 5 seconds. How should the latency target be stated?',
        options: [
          'As the average - 99 ms is well under any sensible limit',
          'As the median, because it ignores outliers',
          'As a percentile such as p99, which shows the slow tail the average hides',
          'As the fastest request, to show what the system can do',
        ],
        answer: 2,
        explanation:
          'The average mixes one 5-second wait into 99 fast requests and looks fine. p99 reports what the slowest 1 in 100 requests experience - exactly the users complaining. The median ignores them by design, which is the opposite of what you need here.',
      },
      {
        id: 'nfr-3',
        prompt: 'A page makes 20 backend calls. Each call has a p99 latency of 1 second. Roughly what share of page loads waits for at least one 1-second call?',
        options: [
          'About 1%',
          'About 18%',
          'About 50%',
          'About 99%',
        ],
        answer: 1,
        explanation:
          'The chance that all 20 calls are fast is 0.99^20, about 0.82, so about 18% of page loads hit at least one slow call. 1% would be true for a single call; the tail grows with every call a page makes, which is why tail latency matters more at scale.',
      },
      {
        id: 'nfr-4',
        prompt: 'In the Requirements Lab you move Availability from 99.9% to 99.99%. What changes on the diagram, and why?',
        options: [
          'Nothing - availability is a monitoring setting',
          'A second region appears, because four nines always needs two regions',
          'Only the load balancer gets bigger',
          'The system spreads over 3 zones and the database keeps a standby that is promoted automatically, because 52 minutes a year leaves no time for manual recovery or a zone outage',
        ],
        answer: 3,
        explanation:
          'At 99.99% a manual database recovery or one lost zone would use up the yearly budget, so the database gets a standby that is promoted automatically and the app servers spread across zones. A second region is what the Lab adds at 99.999%, where even a region outage must be survived.',
      },
      {
        id: 'nfr-5',
        prompt: 'A social app has like counters and in-app payments. How should its consistency requirement be written?',
        options: [
          'Per operation: a like count may be a few seconds stale, a payment balance must never be',
          'Strong consistency everywhere, to be safe',
          'Eventual consistency everywhere, for speed',
          'Consistency does not need to be specified',
        ],
        answer: 0,
        explanation:
          'Almost every real product has both kinds of data. Strong everywhere makes likes pay for guarantees nobody needs; eventual everywhere lets a balance be wrong. Leaving it unspecified means each engineer picks a different answer.',
      },
      {
        id: 'nfr-6',
        prompt: 'A global app asks for strong consistency on every write across two regions, and a p95 write latency of 20 ms. What happens?',
        options: [
          'Both targets can be met with faster databases',
          'Both targets can be met with a cache in front of the writes',
          'The targets conflict: a strongly consistent write waits for the other region, and a round trip between regions far apart often takes 50-100 ms or more',
          'Strong consistency makes writes faster, so 20 ms is easy',
        ],
        answer: 2,
        explanation:
          'Strong consistency across regions means a write is not confirmed until the other region has it, so every write pays a cross-region round trip - a limit set by distance, not by hardware. One target has to give way. A cache does not help writes that must be confirmed in two places.',
      },
      {
        id: 'nfr-7',
        prompt: 'A service targets 99.99%. Each deploy restarts it for about 45 seconds, and the team deploys 12 times a month. What does that mean?',
        options: [
          'Nothing - planned downtime does not count',
          'Deploys alone take about 108 minutes a year, twice the 52-minute budget, so deploys must be zero-downtime with at least two instances behind a load balancer',
          'The team should deploy less often and keep the single instance',
          'The budget is fine - 45 seconds is short',
        ],
        answer: 1,
        explanation:
          '12 deploys x 12 months x 45 seconds is 108 minutes, and 99.99% allows about 52 minutes a year for everything. Users do not care whether downtime was planned. Deploying less often still leaves every restart as an outage and slows the team down.',
      },
      {
        id: 'nfr-8',
        prompt: 'A product owner writes "The system must be reliable" in the requirements. What is the most useful thing to do with it?',
        options: [
          'Accept it as written',
          'Replace it with "use Kubernetes"',
          'Delete it, because reliability cannot be measured',
          'Turn it into numbers, for example 99.9% monthly availability and no acknowledged write lost when one node fails',
        ],
        answer: 3,
        explanation:
          'A requirement without a number has no stopping rule: nobody can tell when it is met or what it costs. With numbers it can be priced and designed for. Naming a tool is a solution, not a target, and reliability is measured all the time.',
      },
      {
        id: 'nfr-9',
        prompt: 'The payments database must lose no acknowledged payment if the machine holding it dies. Which design meets that target?',
        options: [
          'Synchronous replication - a write is confirmed only after a second copy has it - plus backups that are restored in tests',
          'Asynchronous replication to a replica',
          'Nightly backups only',
          'A bigger disk on the one machine',
        ],
        answer: 0,
        explanation:
          'With asynchronous replication the primary confirms before the copy arrives, so the last moments of writes can vanish with the machine. Nightly backups lose up to a day, and a bigger disk dies with its machine. Only a copy confirmed before the acknowledgement meets "no acknowledged write lost" - the Critical durability level in the Lab.',
      },
      {
        id: 'nfr-10',
        prompt: 'A team copies Netflix multi-region architecture for an internal HR tool used by 200 people in one office. What is the problem?',
        options: [
          'Netflix uses technologies that are not available to others',
          'Nothing - copying a proven architecture removes risk',
          'That architecture answers the Netflix spec sheet; the HR tool has far lower targets, so the team pays for redundancy no requirement asks for',
          'Multi-region is not possible for internal tools',
        ],
        answer: 2,
        explanation:
          'An architecture is the answer to a set of numbers. Netflix built for hundreds of millions of streams and region failures; 200 users in one office need neither. Copying it adds cost and operations with nothing in return - the risk goes up, not down.',
      },
      {
        id: 'nfr-11',
        prompt: 'In the Requirements Lab you keep the features and move Daily active users from 100k to 10M. Which change do you see, and why?',
        options: [
          'The database splits into shards, a cache and background workers appear, and the app tier grows to about a dozen servers - because peak traffic rises about 100x',
          'Only the number of app servers changes',
          'A second region appears',
          'Nothing changes - users are a functional requirement',
        ],
        answer: 0,
        explanation:
          'At 10M users a single database and uncached reads no longer hold, and slow work has to leave the request path. The Lab model puts peak traffic near 11,600 requests per second (20 requests a user, 5x peak), so the app tier grows too. A second region only appears at 100M users or 99.999%.',
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
