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
    slug: 'tracing',
    title: 'Tracing',
    tagline: 'One request, every hop, with timings.',
    category: 'observability',
    difficulty: 'Intermediate',
    lab: 'tracing',
    keywords: ['span', 'trace id', 'latency breakdown', 'instrumentation'],
    what: 'A trace records the path of a single request through the system as a tree of spans, each with a start time, duration and attributes.',
    why: 'In a system with several services, "the request was slow" is useless on its own. A trace shows which hop consumed the time.',
    how: [
      'Generate a trace id at the entry point and propagate it in headers (W3C traceparent).',
      'Each operation opens a span with the parent span id, producing a tree.',
      'Sample: keep all errors and slow traces, sample the rest to control cost.',
    ],
    diagram: `trace abc123 (total 265 ms)
API Gateway      [#######]                 40 ms
  Order Service     [#########]            80 ms
    Payment Service    [###########]      120 ms
      Database              [###]          25 ms

The bottleneck is visible instead of guessed.`,
    tradeoffs: [
      {
        approach: 'Distributed tracing',
        gains: ['Exact latency attribution', 'Shows real service dependencies'],
        costs: ['Instrumentation effort across every service', 'Storage cost drives sampling', 'Context must be propagated everywhere, including async hops'],
      },
    ],
    mistakes: ['Losing trace context across a queue, so the async half of the workflow is invisible.'],
    related: ['distributed-tracing', 'logging', 'metrics'],
  },
  {
    slug: 'distributed-tracing',
    title: 'Distributed Tracing',
    tagline: 'Tracing across service, queue and datastore boundaries.',
    category: 'observability',
    difficulty: 'Advanced',
    lab: 'tracing',
    keywords: ['opentelemetry', 'context propagation', 'sampling', 'span attributes'],
    what: 'Distributed tracing applies tracing across process boundaries, propagating context through HTTP headers, message metadata and database instrumentation.',
    why: 'It is the only practical way to answer "where did those 900 ms go?" in a system with a dozen services and asynchronous steps.',
    how: [
      'Adopt OpenTelemetry so instrumentation is vendor-neutral.',
      'Propagate traceparent on every outbound call, including into queue messages.',
      'Use tail-based sampling to keep the interesting traces (errors, slow) rather than a blind percentage.',
      'Attach useful attributes: tenant, route, cache hit/miss - not unbounded ids.',
    ],
    diagram: `HTTP:   traceparent: 00-4bf92f...-00f067aa0ba902b7-01
Queue:  message headers carry the same context
  producer span --> [queue] --> consumer span (linked to the same trace)`,
    tradeoffs: [
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
    related: ['tracing', 'microservices', 'monitoring'],
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
    keywords: ['indicator', 'good events', 'availability', 'latency'],
    what: 'A Service Level Indicator is a carefully defined metric of service behaviour, usually expressed as the ratio of good events to valid events.',
    why: 'You cannot set a target without a measurement everyone agrees on. Most SLO arguments are really arguments about the SLI definition.',
    how: [
      'Define good precisely: "requests answered in under 300 ms with a non-5xx status".',
      'Define valid: exclude health checks and known bot traffic.',
      'Measure as close to the user as possible - at the load balancer or in the client.',
    ],
    diagram: `SLI = good events / valid events

availability SLI = non-5xx responses / all responses
latency SLI      = requests under 300 ms / all requests`,
    tradeoffs: [
      {
        approach: 'Measure SLIs at the server or load balancer',
        gains: ['Cheap, complete and already in your logs and metrics', 'Easy to break down by endpoint, region or version'],
        costs: ['Misses DNS, network and client-side failures users still feel', 'Requests that never arrive are invisible'],
      },
      {
        approach: 'Measure SLIs from the client or with synthetic probes',
        gains: ['Closest to what users actually experience', 'Catches outages upstream of your servers'],
        costs: ['Noisy data from slow devices and bad networks', 'Extra instrumentation, sampling and privacy handling'],
      },
    ],
    mistakes: ['Measuring only server-side, missing the network and client experience.'],
    related: ['slo', 'sla', 'metrics', 'monitoring'],
  },
  {
    slug: 'slo',
    title: 'SLO',
    tagline: 'The target for an SLI - and the error budget that comes with it.',
    category: 'observability',
    difficulty: 'Intermediate',
    keywords: ['objective', 'error budget', 'reliability', 'burn rate'],
    what: 'A Service Level Objective is the target value for an SLI over a window, such as "99.9% of requests succeed over 30 days".',
    why: 'The gap between 100% and the objective is the error budget: a concrete, spendable amount of unreliability that makes the reliability-versus-velocity argument quantitative.',
    how: [
      'Pick a target from user expectations and cost, not from how many nines sound impressive.',
      'Track burn rate; when the budget is exhausted, reliability work takes priority over features.',
      'Review quarterly - an SLO nobody ever misses is set too low to inform anything.',
    ],
    diagram: `99.9% over 30 days -> error budget 43 min
spent 40 min in week 1 -> freeze risky changes, fix reliability first`,
    tradeoffs: [
      {
        approach: 'Higher SLO',
        gains: ['Better user experience'],
        costs: ['Exponentially more engineering and infrastructure', 'Less capacity for feature work'],
      },
    ],
    mistakes: ['Setting an SLO of 100%, which leaves no budget for deploys or experiments.'],
    related: ['sli', 'sla', 'availability', 'alerting'],
  },
  {
    slug: 'sla',
    title: 'SLA',
    tagline: 'The contractual promise, with consequences attached.',
    category: 'observability',
    difficulty: 'Beginner',
    keywords: ['contract', 'credits', 'legal', 'customer'],
    what: 'A Service Level Agreement is a contract with customers specifying a service level and the remedy (usually credits) if it is missed.',
    why: 'It is the external, legal version of your internal objective, and it should always be looser than the SLO so you notice trouble before customers can claim.',
    how: [
      'Set the SLA below the SLO to leave an internal safety margin.',
      'Define exclusions clearly: maintenance windows, customer-caused errors, force majeure.',
      'Make the measurement method explicit - disputes are usually about measurement.',
    ],
    diagram: `SLA 99.5%  (contract, credits if missed)
SLO 99.9%  (internal target - alerts fire long before the SLA is at risk)
SLI        the measurement both are based on`,
    tradeoffs: [
      {
        approach: 'Offer a strict SLA (for example 99.95%)',
        gains: ['Wins customers who need a contractual guarantee', 'Forces investment in redundancy and incident response'],
        costs: ['Service credits or penalties are paid on every miss', 'Leaves a small error budget, which slows risky changes'],
      },
      {
        approach: 'Offer a loose SLA set below the internal SLO',
        gains: ['A buffer between an internal miss and a contractual breach', 'Fewer payouts during routine incidents'],
        costs: ['Less attractive to enterprise buyers', 'Customers may treat the low number as the real quality bar'],
      },
    ],
    mistakes: ['Promising an SLA the architecture cannot support.'],
    related: ['slo', 'sli', 'availability'],
  },
];
