import type { Concept } from '@/types';

export const observabilityConcepts: Concept[] = [
  {
    slug: 'logging',
    title: 'Logging',
    tagline: 'Structured records of what happened, with enough context to be searchable.',
    category: 'observability',
    difficulty: 'Beginner',
    keywords: ['structured', 'correlation id', 'levels', 'retention', 'cardinality'],
    what: 'Logs are timestamped records of discrete events, ideally emitted as structured data (JSON) with consistent fields.',
    why: 'Metrics tell you that error rate rose; logs tell you which requests failed and why. Without correlation ids they tell you almost nothing in a distributed system.',
    how: [
      'Emit structured logs with a stable schema: timestamp, level, service, trace_id, user_id, message.',
      'Propagate a correlation/trace id through every hop so one request can be reconstructed.',
      'Use levels meaningfully and sample high-volume debug logs.',
      'Never log secrets, tokens or personal data you would not want in a search index.',
    ],
    diagram: `{"ts":"2026-09-15T10:42:03Z","level":"error","service":"orders",
 "trace_id":"abc123","user_id":"42","msg":"payment declined","code":"card_declined"}

Search by trace_id -> every hop of that one request.`,
    tradeoffs: [
      {
        approach: 'Verbose logging',
        gains: ['Rich detail during incidents'],
        costs: ['Storage and ingestion cost dominates quickly', 'Signal buried in noise'],
      },
    ],
    mistakes: ['Free-text logs that cannot be queried.', 'Logging inside tight loops and taking the service down with IO.'],
    related: ['distributed-tracing', 'metrics', 'monitoring'],
  },
  {
    slug: 'metrics',
    title: 'Metrics',
    tagline: 'Cheap numeric time series - the first thing you look at.',
    category: 'observability',
    difficulty: 'Beginner',
    keywords: ['counter', 'gauge', 'histogram', 'percentile', 'cardinality'],
    what: 'Metrics are aggregated numeric measurements over time: counters (requests), gauges (queue depth), histograms (latency distribution).',
    why: 'They are cheap to store at high resolution and are what alerts fire on. Percentiles from histograms show what users actually experience.',
    how: [
      'Instrument the four golden signals: latency, traffic, errors, saturation.',
      'Use histograms for latency and read p50/p95/p99 - averages hide the tail.',
      'Keep label cardinality bounded: user_id as a label will destroy your metrics backend.',
      'Alert on symptoms users feel, not on every internal fluctuation.',
    ],
    diagram: `http_requests_total{route="/orders",status="500"}   counter
http_request_duration_seconds_bucket{le="0.25"}     histogram
queue_depth{queue="emails"}                         gauge

avg latency 120 ms looks fine
p99 latency 4.2 s  -> 1% of users are having a terrible time`,
    tradeoffs: [
      {
        approach: 'Metrics-first observability',
        gains: ['Cheap, high resolution, good for alerting', 'Long retention'],
        costs: ['No per-request detail', 'Cardinality limits what you can slice by'],
      },
    ],
    mistakes: ['Alerting on averages.', 'Adding unbounded labels and blowing up the time-series database.'],
    related: ['monitoring', 'alerting', 'sli', 'logging'],
  },
  {
    slug: 'distributed-tracing',
    title: 'Distributed Tracing',
    tagline: 'One request, every hop, with timings - across service, queue and datastore boundaries.',
    category: 'observability',
    difficulty: 'Intermediate',
    lab: 'tracing',
    keywords: [
      'span',
      'trace id',
      'waterfall',
      'latency breakdown',
      'instrumentation',
      'opentelemetry',
      'context propagation',
      'sampling',
      'span attributes',
    ],
    what: 'A trace records the path of one request through the system as a tree of spans, each with a start time, a duration and attributes. Distributed tracing keeps that tree whole across process boundaries, by propagating context through HTTP headers, message metadata and database instrumentation.',
    why: 'In a system with several services, "the request was slow" is useless on its own. A trace answers "where did those 900 ms go?" - which hop consumed the time, including the asynchronous ones.',
    how: [
      'Generate a trace id at the entry point and propagate it on every outbound call (W3C traceparent), including into queue messages.',
      'Each operation opens a span with its parent span id, producing a tree.',
      'Adopt OpenTelemetry so instrumentation is vendor-neutral.',
      'Use tail-based sampling to keep the interesting traces (errors, slow) rather than a blind percentage.',
      'Attach useful attributes: tenant, route, cache hit/miss - not unbounded ids.',
    ],
    when: [
      'A request crosses more than two or three services, queues or datastores.',
      'A latency or error question that metrics can show but cannot attribute to one hop.',
    ],
    diagram: `trace abc123 (total 265 ms)
API Gateway      [#######]                 40 ms
  Order Service     [#########]            80 ms
    Payment Service    [###########]      120 ms
      Database              [###]          25 ms

HTTP:   traceparent: 00-4bf92f...-00f067aa0ba902b7-01
Queue:  message headers carry the same context
  producer span --> [queue] --> consumer span (same trace)`,
    tradeoffs: [
      {
        approach: 'Distributed tracing',
        gains: ['Exact latency attribution', 'Shows real service dependencies'],
        costs: ['Instrumentation effort across every service', 'Storage cost drives sampling', 'Context must be propagated everywhere, including async hops'],
      },
      {
        approach: 'Tail-based sampling',
        gains: ['Keeps every error and slow trace', 'Much better signal per stored byte'],
        costs: ['Needs a collector buffering complete traces', 'More infrastructure'],
      },
      {
        approach: 'Head-based sampling',
        gains: ['Simple and cheap'],
        costs: ['Rare failures are usually not sampled - exactly the traces you wanted'],
      },
    ],
    mistakes: [
      'Losing trace context across a queue, so the async half of the workflow is invisible.',
      'Naming spans with raw ids (/orders/4711), which makes traces unsearchable and expensive.',
    ],
    related: ['logging', 'metrics', 'microservices', 'monitoring'],
  },
  {
    slug: 'monitoring',
    title: 'Monitoring',
    tagline: 'Watching known signals, and asking whether users are having a good time.',
    category: 'observability',
    difficulty: 'Beginner',
    keywords: ['dashboards', 'golden signals', 'black box', 'white box', 'synthetic'],
    what: 'Monitoring is the ongoing collection and display of signals plus the rules that decide when a human should be involved.',
    why: 'Systems fail in ways nobody anticipated. Monitoring decides how long it takes to notice - and MTTR dominates availability.',
    how: [
      'Black-box monitoring probes from outside, the way a user experiences the service.',
      'White-box monitoring exposes internal state: queue depth, pool saturation, replication lag.',
      'Dashboards answer "is it healthy?" in under ten seconds, or they are too busy.',
      'Every alert should link to a runbook.',
    ],
    diagram: `Golden signals
  Latency     p50 / p95 / p99
  Traffic     requests per second
  Errors      rate and ratio
  Saturation  how full the constrained resource is`,
    tradeoffs: [
      {
        approach: 'Alert on symptoms (SLO burn)',
        gains: ['Fewer, more meaningful pages', 'Directly tied to user experience'],
        costs: ['Needs well-chosen SLIs', 'Some causes are detected later'],
      },
      {
        approach: 'Alert on causes (CPU, disk)',
        gains: ['Early warning of resource exhaustion'],
        costs: ['Noisy; most cause alerts do not correspond to user pain'],
      },
    ],
    mistakes: ['Alerting on everything until responders ignore pages.'],
    related: ['alerting', 'metrics', 'health-checks', 'slo'],
  },
  {
    slug: 'alerting',
    title: 'Alerting',
    tagline: 'Waking someone up only when a human decision is needed.',
    category: 'observability',
    difficulty: 'Intermediate',
    keywords: ['paging', 'burn rate', 'runbook', 'fatigue', 'severity'],
    what: 'Alerting turns monitoring signals into notifications, routed by severity to the people who can act.',
    why: 'Alert quality determines incident response quality. Too many alerts and real ones are missed; too few and outages are discovered by customers.',
    how: [
      'Page only for conditions that are urgent, actionable and user-visible.',
      'Use SLO burn-rate alerts: a fast burn pages, a slow burn opens a ticket.',
      'Attach a runbook and an owner to every alert.',
      'Review and delete alerts that never led to action.',
    ],
    diagram: `Error budget for the month: 43 min (99.9%)
burn rate 14x  -> budget gone in ~2 h  -> PAGE
burn rate 2x   -> budget gone in ~2 wk -> ticket`,
    tradeoffs: [
      {
        approach: 'Sensitive thresholds',
        gains: ['Catch problems early'],
        costs: ['Alert fatigue, which makes responders slower for real incidents'],
      },
    ],
    mistakes: ['Paging on a single failed health check.', 'Alerts with no runbook and no owner.'],
    related: ['monitoring', 'slo', 'sli', 'metrics'],
  },
  {
    slug: 'sli',
    title: 'SLI',
    tagline: 'The measurement that represents user happiness.',
    category: 'observability',
    difficulty: 'Intermediate',
    lab: 'slo',
    labFocus: 'sli',
    keywords: ['indicator', 'good events', 'valid events', 'availability', 'latency', 'measurement point'],
    what: 'A Service Level Indicator is a carefully defined measure of service behaviour, usually expressed as the ratio of good events to valid events.',
    why: 'You cannot set a target without a measurement everyone agrees on. Most SLO arguments are really arguments about the SLI definition.',
    how: [
      'Define good precisely: "requests answered in under 300 ms with a non-5xx status".',
      'Define valid: exclude health checks and known bot traffic.',
      'Measure as close to the user as possible - at the load balancer, the CDN or in the client.',
      'Write the measurement point, the window and the exclusions down next to the definition.',
    ],
    when: [
      'Before setting any SLO or SLA - they are only as good as the SLI under them.',
      'For every user journey that matters: two or three SLIs each (availability, latency, and freshness or correctness where it applies).',
    ],
    advantages: [
      'Turns "is the service fine?" into one number everyone reads the same way.',
      'The good-over-valid ratio feeds straight into an error budget.',
    ],
    diagram: `SLI = good events / valid events

availability SLI = non-5xx responses / valid requests
latency SLI      = requests under 300 ms / valid requests
valid            = all requests minus health checks and bots`,
    tradeoffs: [
      {
        approach: 'Measure SLIs at the server',
        gains: ['Cheap, complete and already in your logs and metrics', 'Easy to break down by endpoint, region or version'],
        costs: ['Requests dropped before the server - by the load balancer, DNS or the network - are invisible', 'Can look excellent while users wait or fail'],
      },
      {
        approach: 'Measure SLIs at the load balancer or CDN',
        gains: ['Sees every request that reached your infrastructure, including the 502s the server never saw'],
        costs: ['Still misses DNS, mobile network and client-side failures'],
      },
      {
        approach: 'Measure SLIs from the client or with synthetic probes',
        gains: ['Closest to what users actually experience', 'Catches outages upstream of your servers'],
        costs: ['Noisy data from slow devices and bad networks', 'Extra instrumentation, sampling and privacy handling'],
      },
      {
        approach: 'Count only the status code as good',
        gains: ['Simple: every log line already has a status'],
        costs: ['A slow 200 counts as good, so latency pain never shows up'],
      },
    ],
    mistakes: [
      'Measuring only at the server, missing requests the load balancer or the network dropped.',
      'Counting health checks and bots as valid events, which pads the number with easy successes.',
      'Checking only the status code, so a request that took 8 seconds still counts as good.',
      'Choosing SLIs per service instead of per user journey.',
    ],
    related: ['slo', 'sla', 'metrics', 'monitoring'],
    quiz: [
      {
        id: 'sli-1',
        prompt:
          'The availability SLI, measured from the API server logs, reads 99.98%. Support is flooded with complaints about failed checkouts, and the mobile app reports connection errors. What is the most likely explanation?',
        options: [
          'Users are exaggerating - the SLI proves the service is fine',
          'The failing requests never reach the server - dropped by the load balancer or the network - so the server cannot count them',
          'The server needs more CPU',
          'The SLI window is too long',
        ],
        answer: 1,
        explanation:
          'A server can only count requests that arrive. Drops before it are invisible, so its SLI can read 99.98% while users fail. Measuring at the load balancer or in the client would show them. More CPU is tempting but nothing points at load.',
      },
      {
        id: 'sli-2',
        prompt:
          'In the SLO Lab on the SLI focus, the SLI reads about 99.92% while users felt about 98.6%. The load balancer drops 0.3% of requests, 1% are slower than 300 ms, and bots are counted. Which single change closes the largest part of the gap?',
        options: [
          'Stop counting bots and probes',
          'Measure at the load balancer instead of the API server',
          'Count a request as good only if it is non-5xx and under 300 ms',
          'Raise the SLO to 99.99%',
        ],
        answer: 2,
        explanation:
          'The 1% of slow requests is the largest hidden share, and only a good definition that checks speed counts them. Moving to the load balancer adds the 0.3% of drops, and removing bots moves the number by a few hundredths. Changing the SLO changes the target, not the measurement.',
      },
      {
        id: 'sli-3',
        prompt:
          'A small internal API gets 30 real requests a second and 20 health-check requests a second, which always return 200. The real endpoints start failing 10% of the time. What does an SLI that counts every request report?',
        options: [
          'About 94% instead of 90%, because the health checks pad the valid count with easy successes',
          'Exactly 90%, health checks do not matter',
          '100%, because the service is still up',
          'Nothing, SLIs ignore internal APIs',
        ],
        answer: 0,
        explanation:
          '3 failures out of 50 requests is 94%, while real users see 3 out of 30, which is 90%. Health checks are not user requests, so they belong outside the valid events. The tempting "exactly 90%" forgets that they enter the denominator.',
      },
      {
        id: 'sli-4',
        prompt:
          'The team wants an error budget for latency. Someone proposes the SLI "p99 latency is under 300 ms". What shape works better for an error budget?',
        options: [
          'The average latency over the month',
          'The maximum latency seen that day',
          'The p50 latency, because it is more stable',
          'The share of valid requests answered in under 300 ms',
        ],
        answer: 3,
        explanation:
          'A threshold ratio counts good and valid events like any other SLI, so 99% under 300 ms leaves a budget of 1% slow requests. A percentile value cannot be added up into a budget, and an average hides the slow tail users actually feel.',
      },
      {
        id: 'sli-5',
        prompt:
          'One client exceeds its documented request quota and your rate limiter answers it with 429. How should the availability SLI treat those 429s?',
        options: [
          'As bad events - every non-200 is a failure',
          'As 5xx errors, because the request was refused',
          'Not as bad events, because the service did what it promised; and write that rule into the SLI definition',
          'Remove the rate limiter so the SLI stays clean',
        ],
        answer: 2,
        explanation:
          'The client broke the contract and the service protected itself as designed, so counting it as a failure would punish working behaviour. The key is to decide and document it, because each such rule moves the number. Removing the rate limiter trades a clean number for an outage.',
      },
      {
        id: 'sli-6',
        prompt:
          'A pipeline feeds the sales dashboard. The API is up and fast, yet the numbers on the dashboard are two hours old. Which SLI would have caught this?',
        options: [
          'Freshness: the share of records processed within 5 minutes of creation',
          'Availability of the API',
          'API latency under 300 ms',
          'CPU usage of the pipeline workers',
        ],
        answer: 0,
        explanation:
          'For a pipeline the user cares how current the data is, so freshness is the indicator. Availability and latency of the API both look perfect here, and CPU is a cause, not something the user feels.',
      },
      {
        id: 'sli-7',
        prompt:
          'Checkout calls six services. Each one reports an SLI of 99.95%, yet 2% of checkouts fail. What should the team change?',
        options: [
          'Nothing, every service meets its target',
          'Add a seventh service to watch the other six',
          'Raise every service to 99.99%',
          'Add an SLI for the journey itself: checkouts completed over checkouts started',
        ],
        answer: 3,
        explanation:
          'Users care about completing checkout, not about each service. Per-service numbers can all look fine while the journey breaks, for example on timeouts between services. Raising every service target costs a lot and still does not measure the journey.',
      },
      {
        id: 'sli-8',
        prompt:
          'In the SLO Lab, the load balancer drops 0.3% of requests. You switch the measurement point from the API server to the load balancer. What happens to the SLI?',
        options: [
          'It goes up, because the load balancer is faster',
          'It drops, because the load balancer logged the 502s the server never saw',
          'Nothing, both places see the same requests',
          'It becomes 0%, because the load balancer cannot see status codes',
        ],
        answer: 1,
        explanation:
          'The load balancer answered the dropped requests with 502 and logged them, so they now count as bad events. The server never received them. The dots in the Lab show it: from the server, a dropped request sends no dot into the SLI.',
      },
      {
        id: 'sli-9',
        prompt:
          'The platform team reports 99.98% and the product team, measuring in the mobile app, reports 99.7%. Both are measuring honestly. What should happen first?',
        options: [
          'Use the higher number, it is better for morale',
          'Use the lower number and discard the other',
          'Agree the definition: what counts as good, what counts as valid, and where it is measured - and publish both with their measurement points',
          'Average the two numbers',
        ],
        answer: 2,
        explanation:
          'The numbers differ because they measure different things, and the gap itself is a signal about failures between the user and the servers. Picking or averaging one hides that. Agreeing the definition resolves most reliability arguments before they start.',
      },
      {
        id: 'sli-10',
        prompt: 'A team proposes 15 SLIs for one service, including CPU, memory, garbage collection time and queue depth. What is the best advice?',
        options: [
          'Keep all 15, more data is better',
          'Keep two or three that users feel, such as availability and latency, and keep the rest as ordinary metrics for debugging',
          'Keep only CPU, it predicts everything else',
          'Replace them all with one uptime check',
        ],
        answer: 1,
        explanation:
          'An SLI represents what users feel. CPU and memory are causes: useful when debugging, noisy as targets, and often high while users are fine. Too many SLIs make decisions harder. A single uptime check swings the other way and misses slow or partial failures.',
      },
      {
        id: 'sli-11',
        prompt:
          'The SLI is reported per calendar month. A bad outage on the 31st vanishes from the report on the 1st, although customers still remember it. What change helps?',
        options: [
          'Report over a rolling window, such as the last 30 days',
          'Shorten the month to two weeks',
          'Exclude the last day of each month',
          'Report only the best week',
        ],
        answer: 0,
        explanation:
          'A rolling window always covers the most recent 30 days, so it does not reset the picture on a calendar boundary. Excluding days or picking the best week makes the number flatter, not more honest.',
      },
    ],
  },
  {
    slug: 'slo',
    title: 'SLO',
    tagline: 'The target for an SLI - and the error budget that comes with it.',
    category: 'observability',
    difficulty: 'Intermediate',
    lab: 'slo',
    labFocus: 'slo',
    keywords: ['objective', 'error budget', 'reliability', 'burn rate', 'budget policy'],
    what: 'A Service Level Objective is the target value for an SLI over a window, such as "99.9% of requests succeed over 30 days".',
    why: 'The gap between 100% and the objective is the error budget: a concrete, spendable amount of unreliability that makes the reliability-versus-velocity argument quantitative.',
    how: [
      'Pick a target from what users need and what it costs; use measured performance as a starting point, not as the goal.',
      'Turn it into an error budget: 99.9% over 30 days leaves 43 minutes of full outage, or 0.1% of requests.',
      'Alert on burn rate: 14.4x over 1 hour pages, 1x over 3 days opens a ticket.',
      'Agree the budget policy in advance: when the budget is spent, risky changes stop and reliability work comes first.',
      'Review targets regularly - one that is never close to being missed may be too loose to guide decisions.',
    ],
    when: [
      'Any service whose users notice when it fails - internal users count.',
      'When reliability work and feature work compete for the same people.',
    ],
    advantages: [
      'Makes the reliability-versus-velocity argument a question of arithmetic.',
      'Gives alerts a meaning: page when the budget burns fast, not on every blip.',
    ],
    diagram: `99.9% over 30 days -> error budget 43 min (0.1% of requests)
burn 1x              -> budget lasts exactly 30 days
burn 14.4x over 1 h  -> 2% of the budget gone in that hour -> page
budget spent         -> freeze risky changes, fix reliability first`,
    tradeoffs: [
      {
        approach: 'Higher SLO (for example 99.99%)',
        gains: ['Users see fewer failures'],
        costs: ['A budget of 4 minutes a month leaves little room for deploys or experiments', 'Each extra nine cuts the budget tenfold and costs much more engineering'],
      },
      {
        approach: 'Lower SLO (for example 99%)',
        gains: ['A budget of 7 hours a month: room to ship fast and experiment'],
        costs: ['Users may notice the failures', 'Dependent teams build on the lower number'],
      },
      {
        approach: 'Burn-rate alerts instead of fixed thresholds',
        gains: ['Pages only when the budget is really at risk', 'A short blip does not wake anyone'],
        costs: ['Needs a well-defined SLI and some window arithmetic', 'A slow leak is caught as a ticket, not a page'],
      },
    ],
    mistakes: [
      'Setting an SLO of 100%, which leaves no budget for deploys or experiments.',
      'Copying the current number as the SLO without asking what users need.',
      'Having an error budget but no agreed policy for when it runs out.',
      'Paging on every error spike instead of on burn rate.',
    ],
    related: ['sli', 'sla', 'availability', 'alerting'],
    quiz: [
      {
        id: 'slo-1',
        prompt: 'The SLO is 99.9% over 30 days. In week one a bad deploy causes 20 minutes of full outage. How much error budget is left for the rest of the window?',
        options: ['About 23 minutes', 'About 40 minutes', 'None - any outage breaks the SLO', 'About 3 minutes'],
        answer: 0,
        explanation:
          '0.1% of 30 days is 43.2 minutes, and 43.2 - 20 leaves about 23. The SLO is not broken by one outage: it is broken only when the whole budget is spent. "None" confuses an SLO with a promise of zero failures.',
      },
      {
        id: 'slo-2',
        prompt:
          'The SLO is 99.9%. With 3 minutes of budget left and 10 days to go, a product manager wants to ship a risky database migration. What does a sensible budget policy say?',
        options: [
          'Ship it - an SLO is only a goal',
          'Ship it, then raise the SLO to make up for it',
          'Hold it, or cut its risk first (feature flag, canary, tested rollback), because the budget cannot absorb another incident',
          'Cancel all deploys forever',
        ],
        answer: 2,
        explanation:
          'The budget is what makes risky work affordable, and there is almost none left. The policy, agreed in advance, says reliability comes first until the budget recovers. Freezing forever is the opposite mistake: once the budget recovers, shipping resumes.',
      },
      {
        id: 'slo-3',
        prompt:
          'In the SLO Lab the SLO is 99.9% and you press Bad deploy: 10% of requests fail for 4 hours. Roughly how much of the 43-minute budget does it spend, and does anyone get paged?',
        options: [
          'About 4 minutes, and no page',
          'About 24 minutes - more than half - and a page, because the budget burns at 100x',
          'All 43 minutes, and a ticket',
          'None, because 90% of requests still succeed',
        ],
        answer: 1,
        explanation:
          '10% of 240 minutes is 24 minutes of full-outage equivalent. A 10% error rate against a 0.1% allowance is a burn rate of 100x, far above the 14.4x page threshold. "90% still succeed" sounds reassuring, but the budget counts every failed request.',
      },
      {
        id: 'slo-4',
        prompt: 'The error rate holds steady at 0.2% against a 99.9% SLO. What is the burn rate, and what should the alerting do?',
        options: [
          '0.2x - nothing',
          '20x - page immediately',
          '2x - the budget runs out in about 15 days, so open a ticket rather than page',
          '2x - page immediately',
        ],
        answer: 2,
        explanation:
          '0.2% divided by the allowed 0.1% is a burn rate of 2x, so 30 days of budget last 15. That is real but not urgent, which is what the slow-burn ticket (1x over 3 days) is for. Paging on it would wake people for something that can wait until morning.',
      },
      {
        id: 'slo-5',
        prompt:
          'For 30 seconds every request fails, then everything recovers. The page rule is "burn rate over 14.4x in both the last hour and the last 5 minutes". Does it page?',
        options: [
          'No - over the last hour the burn is about 8x, under 14.4x, so the brief blip does not page',
          'Yes - 100% errors is always a page',
          'Yes - the 5-minute window alone is enough',
          'No - burn-rate alerts ignore full outages',
        ],
        answer: 0,
        explanation:
          '30 seconds at 1000x burn averages to about 8x over an hour, below the long-window threshold, so it does not page. It spent about 1% of the budget. Requiring both windows is exactly what keeps short blips from waking people, while a sustained outage would cross 14.4x within minutes.',
      },
      {
        id: 'slo-6',
        prompt:
          'Users cannot tell 99.9% from 99.95%, and reaching 99.95% would need a second region. What does moving the SLO to 99.95% gain and cost?',
        options: [
          'It gains nothing and costs nothing',
          'It gains fewer failures users do not notice, and costs half the budget (43 to about 22 minutes) plus a second region',
          'It doubles the error budget',
          'It gains a contract with customers',
        ],
        answer: 1,
        explanation:
          'Each step up shrinks the budget and raises the cost of engineering. If users cannot feel the difference, the extra reliability buys little. It halves the budget, not doubles it, and an SLO is internal - a contract is an SLA.',
      },
      {
        id: 'slo-7',
        prompt: 'A director asks for an SLO of 100%. What happens?',
        options: [
          'Users get a perfect service',
          'The team gets a larger budget for experiments',
          'Nothing changes, the number is symbolic',
          'The error budget is zero, so every deploy, every dependency blip and every hardware failure is a violation, and the SLO stops guiding any decision',
        ],
        answer: 3,
        explanation:
          'Nothing real is 100% reliable - networks, disks and dependencies fail. With no budget the SLO is always broken, so it stops informing decisions. The tempting "perfect service" is not something a target can buy.',
      },
      {
        id: 'slo-8',
        prompt:
          'A lock service has delivered 99.999% for a year against a 99.9% SLO. Teams that call it have stopped handling its errors. Then a 20-minute outage takes all of them down. What should the owners of the lock service have done?',
        options: [
          'Nothing, the outage was bad luck',
          'Raise the SLO to 99.999% to match reality',
          'Keep expectations at 99.9%, for example by using some of the unspent budget on planned outages, so callers learn to handle failure',
          'Hide the outage from the SLI',
        ],
        answer: 2,
        explanation:
          'Google did this with its Chubby lock service: when it ran far above its SLO, users built on the higher number, so it was taken down on purpose to expose those dependencies. Raising the SLO would lock the team into a costly promise nobody asked for.',
      },
      {
        id: 'slo-9',
        prompt:
          'In the SLO Lab, 0.05% of requests fail and the SLO is 99.9% (burn 0.5x). You change the SLO to 99.99% without touching the faults. What happens?',
        options: [
          'The budget shrinks to about 4.3 minutes and the burn rate jumps to 5x, so the budget is gone in about 6 days',
          'Nothing, the service did not change',
          'The burn rate halves',
          'The SLI rises to 99.99%',
        ],
        answer: 0,
        explanation:
          'The same 0.05% of failures is now half of the whole allowance every day: 0.05% / 0.01% is 5x, so 30 days of budget last 6. The service did not change, but the target did - which is why a target must come from what users need, not from ambition.',
      },
      {
        id: 'slo-10',
        prompt: 'Checkout and the help-centre pages share one SLO of 99.9%. What is the better setup?',
        options: [
          'One SLO for everything keeps it simple, so keep it',
          'Separate SLOs per journey: a tighter one for checkout, a looser one for the help pages',
          'Drop the SLO for checkout',
          'Give the help pages the tighter SLO because they get more traffic',
        ],
        answer: 1,
        explanation:
          'Journeys are not equally critical: a failed checkout loses money, a slow help page mostly annoys. One shared number either over-invests in the help pages or under-protects checkout. Traffic volume is not what decides how much reliability a journey needs.',
      },
      {
        id: 'slo-11',
        prompt: 'The error rate has sat at 0.15% for two weeks against a 99.9% SLO, and nobody was paged. Is the alerting broken?',
        options: [
          'Yes - every error should page',
          'Yes - burn-rate alerts cannot see slow leaks',
          'No - it should never alert on this',
          'No - a 1.5x burn is a slow leak: it opens a ticket through the 3-day window, and the budget runs out in about 20 days, which is not a middle-of-the-night emergency',
        ],
        answer: 3,
        explanation:
          '0.15% / 0.1% is 1.5x, so 30 days of budget last 20. The 1x-over-3-days rule catches it as a ticket for working hours. It should be handled, just not by waking someone - that is the point of separating pages from tickets.',
      },
    ],
  },
  {
    slug: 'sla',
    title: 'SLA',
    tagline: 'The contractual promise, with consequences attached.',
    category: 'observability',
    difficulty: 'Beginner',
    lab: 'slo',
    labFocus: 'sla',
    keywords: ['contract', 'service credits', 'legal', 'customer', 'exclusions'],
    what: 'A Service Level Agreement is a contract with customers specifying a service level and the remedy (usually service credits) if it is missed.',
    why: 'It is the external, contractual version of your internal objective, and it should always be looser than the SLO, so you notice trouble before customers can claim.',
    how: [
      'Set the SLA below the SLO to leave an internal safety margin: SLO 99.9% (43 min a month), SLA 99.5% (216 min).',
      'Define exclusions clearly: maintenance windows, customer-caused errors, force majeure.',
      'Make the measurement method explicit - disputes are usually about measurement.',
      'Tie credits to tiers, for example 10% of the monthly fee below the SLA, 30% below 99%, 100% below 95%.',
    ],
    when: [
      'Paying customers who need a contractual commitment - usually enterprise deals.',
      'Not for internal services, free tiers or beta features: they get SLOs without a contract.',
    ],
    advantages: [
      'A commitment buyers can compare between providers.',
      'Forces the provider to define the measurement and the exclusions precisely.',
    ],
    diagram: `SLA 99.5%  contract: 216 min a month, credits owed below it
SLO 99.9%  internal:  43 min a month - alerts fire long before the SLA
SLI        the one measurement both are judged on`,
    tradeoffs: [
      {
        approach: 'Offer a strict SLA (for example 99.95%)',
        gains: ['Wins customers who need a contractual guarantee', 'Forces investment in redundancy and incident response'],
        costs: ['Service credits are paid on every miss', 'The SLO above it must be even stricter, which leaves a small error budget'],
      },
      {
        approach: 'Offer a loose SLA set below the internal SLO',
        gains: ['A buffer between an internal miss and a contractual breach', 'Fewer payouts during routine incidents'],
        costs: ['Less attractive to enterprise buyers', 'Customers may treat the low number as the real quality bar'],
      },
    ],
    mistakes: [
      'Promising an SLA the architecture cannot support.',
      'Setting the SLA equal to the SLO, so the first internal miss is also a breach of contract.',
      'Promising more than the SLAs of your own hard dependencies allow.',
      'Treating a provider credit as insurance - it rarely covers the real cost of an outage.',
    ],
    realWorld: [
      'Amazon EC2 promises 99.99% monthly uptime per region, with credits of 10%, 30% and 100% below 99.99%, 99.0% and 95.0%.',
    ],
    related: ['slo', 'sli', 'availability'],
    quiz: [
      {
        id: 'sla-1',
        prompt: 'A team sets both its internal SLO and its customer SLA to 99.9%. What is the problem?',
        options: [
          'None, the numbers agree, which avoids confusion',
          'The SLA is too loose',
          'Customers cannot measure 99.9%',
          'There is no buffer: the moment the internal target is missed, the contract is breached too, with no time to react',
        ],
        answer: 3,
        explanation:
          'The gap between SLO and SLA is reaction time: internal alerts should fire while there is still room before money is at stake. Matching numbers look tidy but remove that room. In the SLO Lab, setting the SLA equal to the SLO makes the first missed target a credit.',
      },
      {
        id: 'sla-2',
        prompt: 'An SLA promises 99.5% availability over a 30-day month. How much full outage does it allow before credits are owed?',
        options: ['About 43 minutes', 'About 3 hours 36 minutes', 'About 7 hours', 'About 5 minutes'],
        answer: 1,
        explanation:
          '0.5% of 43,200 minutes is 216 minutes, or 3 hours 36 minutes. 43 minutes is the allowance of 99.9%, a common internal SLO sitting above this SLA.',
      },
      {
        id: 'sla-3',
        prompt:
          'Your SLA is 99.5% with a credit of 10% of the monthly fee below it (30% below 99%). A customer pays 5,000 euro a month, and a 6-hour outage happens. What do you owe?',
        options: ['Nothing, 6 hours is within the SLA', '1,500 euro', '500 euro', '5,000 euro'],
        answer: 2,
        explanation:
          '6 hours is 360 of 43,200 minutes, so availability is about 99.17%: below 99.5%, but above 99%, which puts it in the 10% tier - 500 euro. 1,500 euro would need availability below 99%.',
      },
      {
        id: 'sla-4',
        prompt:
          'In the SLO Lab on the SLA focus, the month closes at 99.80%. The SLO is 99.9% and the SLA is 99.5%. What do you owe the customer?',
        options: [
          'No credit - the SLO is internal; missing it triggers your own budget policy, not a payment',
          '10% of the fee, because a target was missed',
          'A refund of the full month',
          'An apology but also a 5% credit',
        ],
        answer: 0,
        explanation:
          'Only the SLA carries consequences for the customer, and 99.80% is above its 99.5%. Missing the SLO means the team freezes risky changes and fixes reliability. This is the buffer working as intended.',
      },
      {
        id: 'sla-5',
        prompt:
          'Your service calls three providers synchronously on every request, each with a 99.9% SLA. Sales wants to promise customers 99.95%. What is the problem?',
        options: [
          'None, 99.95% is lower than 99.9%',
          'All three together give about 99.7% before your own code fails at all, so 99.95% needs fallbacks or redundancy that do not share their failures',
          'Providers always beat their SLAs, so it is safe',
          'The SLA must equal the lowest provider SLA',
        ],
        answer: 1,
        explanation:
          '0.999 x 0.999 x 0.999 is about 0.997. Hard dependencies multiply, so they set a ceiling on what you can honestly promise. 99.95% is higher than 99.9%, not lower, and hoping providers beat their SLAs is not a plan.',
      },
      {
        id: 'sla-6',
        prompt:
          'A provider outage cost your business about 40,000 euro. Their SLA gives you a 500 euro credit. What should you take from this?',
        options: [
          'Sue for the rest, the SLA guarantees full compensation',
          'Choose a provider with a larger credit percentage',
          'Nothing, 500 euro is fair',
          'An SLA is a signal, not insurance - protect the business in the architecture with caching, fallbacks or a second provider for the critical path',
        ],
        answer: 3,
        explanation:
          'Credits are a share of the fee, usually capped, and rarely come close to the real cost. A larger percentage of a small fee is still small. The design, not the contract, decides what you survive.',
      },
      {
        id: 'sla-7',
        prompt:
          'The provider was down for 2 hours during a maintenance window announced a week earlier. You file for a credit. What usually happens?',
        options: [
          'The claim is rejected, because scheduled maintenance is a standard exclusion',
          'You get the full credit automatically',
          'The provider must pay double for announced maintenance',
          'The SLA is void for the whole year',
        ],
        answer: 0,
        explanation:
          'Most of the length of a real SLA is definitions and exclusions: scheduled maintenance, customer-caused failures, third parties and beta features usually do not count. Read the exclusions before relying on the number.',
      },
      {
        id: 'sla-8',
        prompt:
          'Last month clearly breached the SLA of your cloud provider, yet no credit appeared on this invoice. What is the most likely reason?',
        options: [
          'Breaches are only paid yearly',
          'The provider forgot',
          'Credits are usually not automatic: the customer must file a claim with evidence before a deadline - for Amazon EC2, by the end of the second billing cycle after the incident',
          'Credits are paid in cash, not on invoices',
        ],
        answer: 2,
        explanation:
          'Many SLAs require the customer to ask, in writing, with evidence, within a claim window. An unclaimed breach costs the provider nothing. Credits are normally applied to a future invoice, not paid in cash.',
      },
      {
        id: 'sla-9',
        prompt:
          'The API of a provider answers every request, but each one takes 8 seconds for 3 hours. Their SLA defines unavailability as error responses. Does this count against the SLA?',
        options: [
          'Yes, slow is the same as down',
          'No - by that definition only errors count, so degraded performance is not a breach; check what counts as downtime before signing',
          'Yes, but only after 24 hours',
          'Only if more than half the requests fail',
        ],
        answer: 1,
        explanation:
          'Many SLAs count only total unavailability, not slow or partial service. For users 8 seconds feels broken, which is why your own SLI should include latency - but the contract only pays on what it defines.',
      },
      {
        id: 'sla-10',
        prompt: 'A startup is launching a free tier and a paid enterprise plan. Which should get an SLA?',
        options: [
          'Both, with the same terms',
          'Only the free tier, it has the most users',
          'Neither, SLAs are only for cloud providers',
          'The enterprise plan, where customers pay for and negotiate a guarantee; the free tier gets an internal SLO without a contract',
        ],
        answer: 3,
        explanation:
          'An SLA is a contract with consequences, which makes sense where customers pay for a guarantee. Free tiers, internal services and beta features usually have targets without contracts. User count does not create a contract.',
      },
      {
        id: 'sla-11',
        prompt: 'In the SLO Lab you set the SLA to 99.95% while the SLO stays at 99.9%. What changes?',
        options: [
          'Nothing, the SLA is only paperwork',
          'The error budget grows',
          'Credits become owed before your own error budget is even spent, because the contract is stricter than the internal target',
          'The SLI becomes more accurate',
        ],
        answer: 2,
        explanation:
          'With the SLA above the SLO, the contract allows about 22 minutes a month while the internal budget allows 43, so customers can claim before your own alarms consider it a problem. The SLA should sit below the SLO, never above it.',
      },
    ],
  },
];
