import type { Concept } from '@/types';

export const observabilityConcepts: Concept[] = [
  {
    slug: 'logging',
    title: 'Logging',
    tagline: 'Structured records of what happened, with enough context to be searchable.',
    category: 'observability',
    difficulty: 'Beginner',
    lab: 'monitoring',
    labFocus: 'logging',
    keywords: ['structured', 'correlation id', 'trace id', 'levels', 'sampling', 'retention', 'cardinality'],
    what: 'Logs are timestamped records of discrete events, ideally emitted as structured data (JSON) with consistent fields: time, level, service, trace id and the facts of the event.',
    why: 'Metrics tell you that the error rate rose; logs tell you which requests failed and why. Without a trace id shared by every line of a request they tell you almost nothing in a distributed system.',
    how: [
      'Emit structured logs with a stable schema: timestamp, level, service, version, trace_id, event and its fields.',
      'Propagate a correlation/trace id through every hop - HTTP headers and queue messages - so one query rebuilds one request.',
      'Use levels with discipline: ERROR means a human must look, WARN means handled but unexpected, INFO one line per significant step, DEBUG for diagnosis.',
      'Sample high-volume successful requests (by trace id, so a request is kept whole); never sample errors.',
      'Never log secrets, tokens or personal data you would not want in a search index.',
    ],
    when: [
      'Always, for every service - the question is how much, at which level, and in what shape.',
      'To explain one request or one event: which user, which order, which error, in which order.',
      'Not for trends you want to graph and alert on - that is a metric.',
    ],
    advantages: [
      'Full context of one event, including high-cardinality fields like user_id and order_id.',
      'With a shared trace id, one query rebuilds a request across every service.',
      'Answers questions nobody planned for, as long as the fields were logged.',
    ],
    diagram: `{"ts":"2026-09-15T10:42:03Z","level":"error","service":"payments",
 "trace_id":"4bf92f","route":"/checkout","msg":"card processor returned 503"}

Search by trace_id -> every line of that one request, from every service.
1,000 req/s x 10 lines x 500 bytes = about 430 GB a day.`,
    tradeoffs: [
      {
        approach: 'Verbose logging (DEBUG everywhere)',
        gains: ['Rich detail during incidents', 'Fewer "we did not log that" moments'],
        costs: ['Storage and ingestion cost dominates quickly', 'Signal buried in noise', 'Logging in hot loops can slow the service itself'],
      },
      {
        approach: 'Structured JSON with a trace id',
        gains: ['Filter, group and join lines with a query instead of grep', 'One request rebuilt across services'],
        costs: ['Larger lines, so more bytes per day', 'Needs a shared schema and context propagation in every service'],
      },
      {
        approach: 'Sampling successful requests',
        gains: ['Cuts volume and cost by close to the sampling rate', 'Every error is still kept'],
        costs: ['A successful request you later need may be gone', 'Must sample per request, not per line, or requests are kept in pieces'],
      },
    ],
    mistakes: [
      'Free-text logs that cannot be queried, so a reworded message breaks every search built on it.',
      'No trace id, so the lines of one request cannot be joined across services.',
      'Logging expected events (a wrong password) at ERROR, which buries the errors that matter.',
      'Logging inside tight loops and taking the service down with IO.',
      'Logging secrets, tokens or card numbers into a widely readable search index.',
    ],
    related: ['distributed-tracing', 'metrics', 'monitoring'],
    quiz: [
      {
        id: 'log-1',
        prompt:
          'About 2% of checkouts fail across 6 services. Every service logs plain sentences such as "payment failed". What change shortens the next investigation the most?',
        options: [
          'Switch every service to DEBUG so there is more to read',
          'Log structured fields with a trace_id that every service passes on, so one query returns every line of one failing request',
          'Add more servers to the log cluster so grep runs faster',
          'Write the failures to a separate file per service',
        ],
        answer: 1,
        explanation:
          'The problem is shape, not amount: without a shared trace_id nobody can tell which lines belong to the same request. With one, a single query rebuilds the request in order - the Lab shows 5 lines from 3 services. More DEBUG lines are the tempting answer, but they add volume without adding the one field that joins the lines.',
      },
      {
        id: 'log-2',
        prompt:
          'In the Lab you set the lowest level written to ERROR. The trace_id query for a failing checkout now returns a single line from payments. What did you lose?',
        options: [
          'Nothing - the error line is the only one that matters',
          'The trace_id itself, so the query no longer works',
          'The steps around the failure: the route, that orders called payments, and the 502 the user got back',
          'The error message, because ERROR lines are sampled',
        ],
        answer: 2,
        explanation:
          'The INFO lines were never written, so you know what failed but not which request it was or what the user saw. The trace_id still works - it just has little to find. Errors are never sampled, so the message is still there.',
      },
      {
        id: 'log-3',
        prompt:
          'A service handles 1,000 requests per second and writes 10 lines of about 500 bytes per request. Roughly how much log data is that per day?',
        options: ['About 4 GB', 'About 40 GB', 'About 430 GB', 'About 4 TB'],
        answer: 2,
        explanation:
          '1,000 x 10 x 500 bytes = 5 MB per second, and 5 MB x 86,400 seconds is about 432 GB a day. That is why volume becomes a budget line, and why sampling successful requests matters. 40 GB comes from dropping one factor of ten.',
      },
      {
        id: 'log-4',
        prompt:
          'To cut cost, someone proposes keeping a random 10% of all log lines, decided line by line. What goes wrong?',
        options: [
          'Nothing, as long as the rate is 10%',
          'Log lines become larger',
          'The trace id stops being propagated',
          'Requests are kept in pieces and 90% of error lines are thrown away; sample whole requests by trace id and keep every error',
        ],
        answer: 3,
        explanation:
          'Per-line sampling keeps one line of a request and drops the next, and it drops errors - the lines you most need. Deciding per trace id keeps or drops a request whole, and errors are always kept, which is what the Lab sampling toggle does. The rate alone is not the problem; the unit of sampling is.',
      },
      {
        id: 'log-5',
        prompt:
          'To debug a payment bug, a developer logs the full request, including the Authorization header and the card number. What should happen?',
        options: [
          'Remove or redact secrets and card data at the source - logs are copied into search indexes many people can read, and kept for months',
          'Keep it, logs are internal',
          'Keep it but lower the level to DEBUG',
          'Encrypt the log file on the server',
        ],
        answer: 0,
        explanation:
          'Logs travel: collectors, indexes, backups, exports - each one a new place a token or card number can leak from. Never log them. "Logs are internal" is the tempting answer, but internal systems are exactly where broad read access and long retention live.',
      },
      {
        id: 'log-6',
        prompt:
          'The team graphs p95 checkout duration per route over six months by parsing duration_ms out of every log line. The log bill is huge and the query takes minutes. What fits better?',
        options: [
          'Keep parsing logs but store them longer',
          'Emit a latency histogram metric per route and keep logs for explaining single requests',
          'Log the p95 once a minute as a text line',
          'Stop measuring latency',
        ],
        answer: 1,
        explanation:
          'A trend you graph and alert on is a metric: a histogram costs a few series, not a row per request, and keeps long history cheaply. Logs stay the place for per-request detail. Logging a pre-computed p95 cannot be combined across instances or windows.',
      },
      {
        id: 'log-7',
        prompt:
          'The API logs with trace ids, but lines from the worker that processes the queued order never share the trace id of the request that queued it. What is missing?',
        options: [
          'The worker needs its own log store',
          'Workers cannot log trace ids',
          'The queue is too slow',
          'The trace context is not passed in the message metadata, so the worker starts a new id',
        ],
        answer: 3,
        explanation:
          'Propagation has to cross every hop, including asynchronous ones: put the trace context in the message headers and have the consumer continue it. A separate store does not help - the lines still would not join.',
      },
      {
        id: 'log-8',
        prompt: 'The login service logs an ERROR every time a user types a wrong password - thousands a day. What is the problem?',
        options: [
          'Wrong passwords are an expected, handled event; at ERROR they bury the errors a human must act on',
          'None, failed logins are important',
          'The lines should be DEBUG so they are never stored',
          'ERROR lines cost more to store',
        ],
        answer: 0,
        explanation:
          'ERROR should mean someone must look. An expected outcome belongs at INFO (and maybe a counter metric for a spike). DEBUG is the tempting fix but it hides a real security signal: failed logins are worth recording, just not as errors.',
      },
      {
        id: 'log-9',
        prompt:
          'A batch job processes 1 million items and logs one INFO line per item. The job slows down and the disk fills. What do you change?',
        options: [
          'Log one summary line per batch or chunk with counts, and log individual items only when they fail',
          'Move the logs to a faster disk',
          'Switch the lines to JSON',
          'Log each item twice so none is lost',
        ],
        answer: 0,
        explanation:
          'Logging inside a tight loop turns every item into IO. A summary line (processed 1,000,000, failed 12, took 41 s) plus a line per failure keeps the value and drops the cost. A faster disk only postpones it; JSON makes each line larger.',
      },
      {
        id: 'log-10',
        prompt:
          'A dashboard counts payment failures by searching log messages for the text "payment failed". After a release, it drops to zero although customers still complain. What happened, and what prevents it?',
        options: [
          'Payments were fixed; nothing to prevent',
          'The log store lost data; add replicas',
          'Someone reworded the message; query a stable structured field such as event = "payment.failed" instead of the sentence',
          'Errors are sampled; turn sampling off',
        ],
        answer: 2,
        explanation:
          'Free text is not an interface - a harmless rewording breaks every search built on it. A stable event field is a contract that queries can rely on. Sampling never drops errors, and the complaints rule out a real fix.',
      },
      {
        id: 'log-11',
        prompt: 'Compliance needs a year of logs, but keeping a year in the search cluster costs more than the service. What is the usual answer?',
        options: [
          'Delete logs after a week and ignore compliance',
          'Keep a year in the search cluster',
          'Tier retention: recent days searchable, older logs archived in cheap object storage',
          'Log less so a year fits',
        ],
        answer: 2,
        explanation:
          'Most searches touch the last few days. Tiered retention keeps those fast and moves the rest to storage that costs a fraction, still available when an audit asks. Logging less may help but does not meet a one-year requirement on its own.',
      },
    ],
  },
  {
    slug: 'metrics',
    title: 'Metrics',
    tagline: 'Cheap numeric time series - the first thing you look at.',
    category: 'observability',
    difficulty: 'Beginner',
    lab: 'monitoring',
    labFocus: 'metrics',
    keywords: ['counter', 'gauge', 'histogram', 'percentile', 'cardinality', 'aggregation window', 'red', 'use'],
    what: 'Metrics are aggregated numeric measurements over time: counters (requests served), gauges (queue depth), histograms (the latency distribution), each identified by a name and a small set of labels.',
    why: 'They are cheap to store at high resolution and are what alerts fire on. Percentiles from histograms show what users actually experience, which an average hides.',
    how: [
      'Instrument the four golden signals: latency, traffic, errors, saturation (RED for services, USE for resources).',
      'Use histograms for latency and read p50/p95/p99 - averages hide the tail.',
      'Pick the aggregation window on purpose: a short one reacts fast but is jumpy, a long one is smooth but dilutes short spikes.',
      'Keep label cardinality bounded: user_id as a label will destroy your metrics backend.',
      'Alert on symptoms users feel, not on every internal fluctuation.',
    ],
    when: [
      'Always, as the first layer: is it healthy, and since when is it not?',
      'For anything you want to graph over time or alert on.',
      'Not for per-request detail - which user, which order - that is logs and traces.',
    ],
    advantages: [
      'Constant cost per series, whatever the traffic: 10 or 10,000 requests a second is the same number of series.',
      'Fast to query over months, so trends and deploy regressions stand out.',
      'Histograms from many instances can be summed, then turned into one percentile.',
    ],
    diagram: `http_requests_total{route="/orders",status="5xx"}   counter
http_request_duration_seconds_bucket{le="0.25"}     histogram
queue_depth{queue="emails"}                         gauge

avg latency 100 ms  looks fine
p99 latency 1.7 s   -> 1 request in 100 takes 1.7 s or more`,
    tradeoffs: [
      {
        approach: 'Metrics-first observability',
        gains: ['Cheap, high resolution, good for alerting', 'Long retention'],
        costs: ['No per-request detail', 'Cardinality limits what you can slice by'],
      },
      {
        approach: 'Histogram for latency',
        gains: ['Percentiles that can be aggregated across instances and windows', 'Shows the tail that averages hide'],
        costs: ['A series per bucket', 'Percentiles are estimates, only as precise as the bucket bounds'],
      },
      {
        approach: 'Short aggregation window (10 s)',
        gains: ['Short spikes stay visible', 'Reacts quickly'],
        costs: ['Jumpy lines that invite false alarms', 'A long window is the opposite: smooth, slow, spikes diluted'],
      },
    ],
    mistakes: [
      'Alerting on averages.',
      'Adding unbounded labels (user_id, raw URL path) and blowing up the time-series database.',
      'Averaging percentiles from several instances - quantiles cannot be averaged; sum the histogram buckets instead.',
      'Graphing a total error count instead of an error ratio per route.',
    ],
    related: ['monitoring', 'alerting', 'sli', 'logging'],
    quiz: [
      {
        id: 'met-1',
        prompt: 'The latency graph shows an average of 100 ms and looks fine, yet users complain about slow pages. What do you look at next?',
        options: [
          'The average over a longer window',
          'CPU per host',
          'p99 from the latency histogram - the average hides the slow tail',
          'The request count',
        ],
        answer: 2,
        explanation:
          'An average blends a few very slow requests into many fast ones. In the Lab, 3% slow product queries leave the average near 100 ms while p99 sits near 1.7 s. A longer window smooths the average even more; CPU can be normal while a slow dependency makes users wait.',
      },
      {
        id: 'met-2',
        prompt:
          'In the Lab, 3% of product queries take about 2 s, and product pages are 60% of requests. p99 jumps to about 1.7 s but p95 stays near 220 ms. Why?',
        options: [
          'About 1.8% of all requests are slow: more than 1 in 100, so p99 lands among them, but fewer than 5 in 100, so p95 does not',
          'p95 is computed less often than p99',
          'The histogram has no bucket for 2 s',
          'p95 ignores database time',
        ],
        answer: 0,
        explanation:
          '0.6 x 3% = 1.8% of requests are slow. The 99th percentile is the value 1% of requests exceed, which is inside that slow 1.8%; the 95th is exceeded by 5%, which is mostly fast requests. Every percentile is computed from the same histogram at the same time.',
      },
      {
        id: 'met-3',
        prompt: 'A product manager wants latency per customer, so an engineer adds a user_id label to the request histogram. There are 25,000 active users. What happens?',
        options: [
          'Nothing notable, labels are free',
          'The histogram becomes more precise',
          'Only dashboards get slower',
          'The number of time series multiplies by about 25,000 - millions of series the metrics backend must store and index',
        ],
        answer: 3,
        explanation:
          'Every distinct label combination is its own series. The Lab goes from about 300 series to about 7 million. Per-user questions belong in logs and traces, where high cardinality costs a row, not a permanent series. It is not only dashboards: ingestion and memory suffer first.',
      },
      {
        id: 'met-4',
        prompt: 'After a deploy restarts every pod, the raw value of http_requests_total drops to zero and climbs again. Was traffic lost?',
        options: [
          'Yes, every request during the drop failed',
          'No - a counter resets when the process restarts; graph rate() of it, which handles resets',
          'Yes, the metrics backend lost data',
          'No, but the counter should have been a gauge',
        ],
        answer: 1,
        explanation:
          'Counters only go up within one process and start again at zero after a restart. You read them through rate(), which detects resets. A gauge is the wrong fix: it cannot tell you how many requests happened between two scrapes.',
      },
      {
        id: 'met-5',
        prompt: 'Twenty pods each export their own p99 as a summary. The team averages the twenty values to get the service p99. What is wrong?',
        options: [
          'Nothing, averaging is fine',
          'They should take the maximum instead',
          'Quantiles cannot be averaged into a correct quantile; export histograms, sum their buckets across pods, then compute p99',
          'They should use p95',
        ],
        answer: 2,
        explanation:
          'The average of twenty p99 values is not the p99 of all requests - a pod with little traffic counts as much as a busy one, and the tail shape is lost. Histogram buckets can be summed and turned into one percentile. The maximum is another wrong number, just a pessimistic one.',
      },
      {
        id: 'met-6',
        prompt:
          'Errors spike for 20 seconds, then recover. The error graph uses a 5-minute aggregation window, and the on-call engineer sees only a small bump. Why?',
        options: [
          'The spike was not real',
          'The metrics backend drops short spikes',
          'Error ratios cannot show spikes',
          'The window sums 300 seconds, so 20 bad seconds are diluted about 15 times',
        ],
        answer: 3,
        explanation:
          'Every point on a 5-minute graph is an aggregate of 5 minutes. Switch the Lab window to 10 s and short spikes stand out, at the cost of a jumpier line. The data is all there - the window decided what you see.',
      },
      {
        id: 'met-7',
        prompt: 'A route label is filled with the raw path, such as /orders/4711 and /orders/4712. What should it hold instead?',
        options: [
          'The route template, /orders/:id - a small, fixed set of values',
          'The full URL with the query string',
          'Nothing, remove all labels',
          'The order id in a separate label',
        ],
        answer: 0,
        explanation:
          'Raw paths create a new series per order, which is unbounded cardinality in disguise. The template keeps one series per route. A separate order-id label is the same mistake with a different name.',
      },
      {
        id: 'met-8',
        prompt: 'The SLO says 95% of requests must finish under 300 ms. The latency histogram has buckets at 100 ms, 500 ms and 1 s. What is the problem?',
        options: [
          'None, three buckets are enough',
          'No bucket bound sits at 300 ms, so the share under 300 ms is an interpolated guess; add a bucket at 300 ms',
          'Histograms cannot measure SLOs',
          'The buckets should be in seconds',
        ],
        answer: 1,
        explanation:
          'Percentiles from buckets are interpolated inside the bucket the value lands in, so the answer is only as precise as that bucket - here anywhere from 100 to 500 ms. Put a bucket bound at the SLO threshold and the question is answered exactly.',
      },
      {
        id: 'met-9',
        prompt:
          'The error graph shows the total error count for the whole service. One small route is failing 40% of the time, and nobody notices. What would have shown it?',
        options: [
          'An error ratio per route (errors / requests, labelled by route template)',
          'A longer retention period',
          'CPU per host',
          'A larger y-axis',
        ],
        answer: 0,
        explanation:
          'A small route failing badly adds a few errors to millions of successes and disappears in a total. A ratio per route puts it at 40% where it cannot be missed. Resource graphs explain a problem; they rarely reveal this one.',
      },
      {
        id: 'met-10',
        prompt: 'A new service goes live next week and you may add only a few metrics. Which set covers the most?',
        options: [
          'CPU, memory and GC time per host',
          'Log line count per level',
          'Request rate, error ratio and a latency histogram per route (RED)',
          'One gauge per internal function',
        ],
        answer: 2,
        explanation:
          'RED measures what users experience: how many requests, how many fail, how long they take. Resource metrics (USE) come next, to explain a problem once RED shows one. Forty host graphs often show everything except the problem.',
      },
    ],
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
    lab: 'monitoring',
    labFocus: 'monitoring',
    keywords: ['dashboards', 'golden signals', 'black box', 'white box', 'synthetic', 'probe', 'saturation'],
    what: 'Monitoring is the ongoing collection and display of known signals - the four golden signals of every part - plus the rules that decide when a human should be involved.',
    why: 'Systems fail in ways nobody anticipated. Monitoring decides how long it takes to notice, and the time to notice is part of every outage: nobody fixes what nobody has seen.',
    how: [
      'Watch the four golden signals per part: latency, traffic, errors and saturation of the most constrained resource.',
      'Black-box monitoring probes from outside, the way a user experiences the service - it sees DNS, TLS and network failures.',
      'White-box monitoring exposes internal state: queue depth, pool saturation, replication lag - it shows why, and what is about to break.',
      'Dashboards answer "is it healthy, and if not, where?" in under ten seconds, or they are too busy.',
      'Alert on traffic dropping, not only on errors rising, and monitor the monitoring itself.',
    ],
    when: [
      'From the first day in production - before the first incident, not after it.',
      'Black-box probes for anything users reach from outside; white-box metrics for every part inside.',
    ],
    advantages: [
      'Problems are noticed by you, not by your customers.',
      'One consistent dashboard per service lets anyone read an unfamiliar system during an incident.',
      'White-box saturation trends warn before users feel anything.',
    ],
    diagram: `Golden signals, per part
  Latency     p50 / p95 / p99
  Traffic     requests per second
  Errors      rate and ratio
  Saturation  how full the constrained resource is

Inside (white box):  sees why, and what is about to break
Outside (black box): sees what users see, even DNS and TLS`,
    tradeoffs: [
      {
        approach: 'White-box monitoring (internal metrics)',
        gains: ['Explains why - which part, which resource', 'Warns before users notice (a pool trending full)'],
        costs: ['Blind to failures before traffic reaches you (DNS, certificates, network)', 'Needs instrumentation in every part'],
      },
      {
        approach: 'Black-box monitoring (synthetic probes)',
        gains: ['Sees the service as users do, end to end', 'Catches failures internal metrics cannot see'],
        costs: ['Says that it is broken, not why', 'A scripted journey covers only the paths you scripted'],
      },
      {
        approach: 'One golden-signals overview per service',
        gains: ['Readable in seconds, the same layout everywhere', 'Points to the part to drill into'],
        costs: ['Hides detail that needs a drill-down dashboard', 'Needs discipline to keep consistent'],
      },
    ],
    mistakes: [
      'Only white-box monitoring, so an outage in DNS or the CDN leaves every internal graph green.',
      'Alerting on errors but never on traffic dropping to near zero.',
      'Forty bespoke graphs per service that nobody can read during an incident.',
      'Running the monitoring on the same infrastructure it watches.',
    ],
    related: ['alerting', 'metrics', 'health-checks', 'slo'],
    quiz: [
      {
        id: 'mon-1',
        prompt:
          'A DNS change deletes the record for your domain. For 25 minutes customers cannot reach the site, while every internal dashboard stays green. What would have caught it within a minute?',
        options: [
          'More CPU and memory graphs',
          'A black-box probe loading the site from outside, and an alert on traffic dropping below the expected range',
          'A lower error-ratio threshold',
          'Longer log retention',
        ],
        answer: 1,
        explanation:
          'Requests that never arrive produce no errors inside. In the Lab, "Users cannot reach us" keeps errors at 0% and latency normal; only the traffic line and the probe show it. A lower error threshold is tempting but there are no errors to cross it.',
      },
      {
        id: 'mon-2',
        prompt:
          'In the Lab dashboard the gateway shows 4% errors and Payments shows 10%. Checkouts are 40% of requests and only checkouts call Payments. What do you conclude?',
        options: [
          'Payments failing explains all of it: 40% of requests x 10% = 4% at the gateway',
          'Two separate problems: one in the gateway, one in Payments',
          'The gateway is the cause because it is the entry point',
          'The dashboard is wrong because the numbers differ',
        ],
        answer: 0,
        explanation:
          'Errors travel upstream: a failed payment becomes a 502 from orders and then from the gateway. The per-part rows tell you where to look first; the gateway row says users are hurt, the Payments row says why.',
      },
      {
        id: 'mon-3',
        prompt: 'For a service whose real bottleneck is a database connection pool of 50, which number is its saturation signal?',
        options: [
          'Requests per second',
          'p50 latency',
          'Disk space on the application servers',
          'Connections in use out of 50, and how many requests wait for one',
        ],
        answer: 3,
        explanation:
          'Saturation is how full the most constrained resource is. When the pool is full, requests queue and latency grows even though CPU looks fine. Requests per second is traffic, a different golden signal.',
      },
      {
        id: 'mon-4',
        prompt: 'Latency rose sharply at 14:02. What single addition to the dashboard makes the cause fastest to spot?',
        options: [
          'A second latency graph with a different colour',
          'A graph of disk usage',
          'Deploy markers - a line on every graph where a release happened',
          'Refreshing the page every second',
        ],
        answer: 2,
        explanation:
          '"Latency rose at 14:02" is a puzzle; "latency rose at 14:02 and a deploy went out at 14:01" is a lead. Annotations turn graphs into a timeline of cause and effect.',
      },
      {
        id: 'mon-5',
        prompt: 'An incident starts. The service dashboard has 40 graphs per host across 30 hosts, and nobody can say whether the service is healthy. What should the first screen be?',
        options: [
          'The same 40 graphs, larger',
          'One overview with the golden signals per service, the same layout as every other service, with drill-downs behind it',
          'A raw log search',
          'A list of every alert that ever fired',
        ],
        answer: 1,
        explanation:
          'The first question is "is it healthy, and where not?", and it must be answered in seconds. Per-host detail and raw logs are for the second step, once the overview points somewhere.',
      },
      {
        id: 'mon-6',
        prompt: 'The database connection pool has climbed from 40% to 85% over two days while users notice nothing. Which kind of monitoring shows this, and why does it matter?',
        options: [
          'Black-box, because it sees what users see',
          'Neither - it is not a problem until users complain',
          'Log search, because pools write logs',
          'White-box: it sees internal state, so you can act before the pool runs out and users feel it',
        ],
        answer: 3,
        explanation:
          'A black-box probe passes until the moment the pool is exhausted. White-box saturation trends are the early warning - usually a ticket, not a page. Waiting for complaints turns a planned fix into an incident.',
      },
      {
        id: 'mon-7',
        prompt: 'Your metrics, dashboards and alerting run on the same cluster as the application. The cluster goes down at night. What happens?',
        options: [
          'The monitoring goes down with it, so nothing pages - silence looks like health',
          'The alerting pages everyone at once',
          'Nothing, monitoring cannot fail',
          'The dashboards switch to read-only',
        ],
        answer: 0,
        explanation:
          'A silent alerting pipeline looks exactly like a quiet night. Run monitoring and the status page on independent infrastructure, and have something outside check that the monitoring is alive.',
      },
      {
        id: 'mon-8',
        prompt: 'On a normal weekday at 11:00, traffic drops by 90% within two minutes while the error ratio stays at 0%. How do you read it?',
        options: [
          'Good news, the service is quiet',
          'The error ratio proves everything is fine',
          'Something before your service is stopping requests (DNS, CDN, a client release); a traffic drop deserves an alert as much as an error spike',
          'The metrics backend is overloaded',
        ],
        answer: 2,
        explanation:
          'Error ratio is errors divided by requests that arrived; when requests stop arriving it stays calm. Compare traffic with what users normally send at this hour, as the Lab dashboard does with its dashed line.',
      },
      {
        id: 'mon-9',
        prompt:
          'Support reports that only Android users on app version 4.2 in Germany with more than ten items in the cart get 3-second responses. No dashboard shows it. What would let you answer it?',
        options: [
          'A new dashboard for this exact case',
          'Wide structured events or traces with many attributes, so you can slice by version, country and cart size after the fact',
          'A higher-resolution CPU graph',
          'A metric with a label per user',
        ],
        answer: 1,
        explanation:
          'Monitoring answers known questions; this is a new one. High-cardinality events and traces let you ask it from data you already have - that property is observability. A new dashboard only helps next time, and a per-user metric label breaks the metrics backend.',
      },
      {
        id: 'mon-10',
        prompt: 'The only synthetic probe runs from a machine in the same data centre as the service. Users in another region cannot connect, and the probe passes. Why?',
        options: [
          'Probes cannot detect outages',
          'The probe interval is too long',
          'The probe should check CPU',
          'The probe does not travel the path users travel; run probes from outside, in several regions',
        ],
        answer: 3,
        explanation:
          'Black-box monitoring is only as good as the path it exercises. From inside the data centre it skips the public DNS, the CDN and the internet routes that failed. Checking more often does not change which path it takes.',
      },
    ],
  },
  {
    slug: 'alerting',
    title: 'Alerting',
    tagline: 'Waking someone up only when a human decision is needed.',
    category: 'observability',
    difficulty: 'Intermediate',
    lab: 'monitoring',
    labFocus: 'alerting',
    keywords: ['paging', 'burn rate', 'runbook', 'fatigue', 'severity', 'for duration', 'symptom', 'inhibition'],
    what: 'Alerting turns monitoring signals into notifications: a rule (condition, threshold, how long it must hold) decides, and routing sends a page or a ticket to the people who can act.',
    why: 'Alert quality determines incident response quality. Too many alerts and real ones are missed; too few and outages are discovered by customers.',
    how: [
      'Page only for conditions that are urgent, actionable and user-visible; everything else is a ticket or a dashboard.',
      'Alert on symptoms (error ratio, latency users feel), keep causes (CPU, disk) for diagnosis.',
      'Require the condition to hold for a duration, so short blips that heal on their own do not page.',
      'Use SLO burn-rate alerts: 14.4x over 1 hour or 6x over 6 hours pages, 1x over 3 days opens a ticket.',
      'Attach a runbook and an owner to every alert, group related alerts, and delete alerts that never led to action.',
    ],
    when: [
      'For every user-facing symptom that needs a human now - a page.',
      'For slow problems that need a human this week (certificate expiry, disk trend) - a ticket.',
      'Never for conditions nobody would act on.',
    ],
    advantages: [
      'People find out before customers do.',
      'Burn-rate alerts separate a sudden outage from a slow degradation automatically.',
      'Few, trusted pages get fast responses.',
    ],
    diagram: `Error budget for 30 days at 99.9%: 43 min
burn rate 14.4x over 1 h  -> budget gone in ~2 days -> PAGE
burn rate 6x    over 6 h  -> budget gone in 5 days  -> PAGE
burn rate 1x    over 3 d  -> budget gone in 30 days -> ticket`,
    tradeoffs: [
      {
        approach: 'Sensitive thresholds, no duration',
        gains: ['Catch problems early'],
        costs: ['Blips that heal alone page anyway', 'Alert fatigue, which makes responders slower for real incidents'],
      },
      {
        approach: 'Longer for duration',
        gains: ['Short blips stop paging', 'Fewer flapping alerts'],
        costs: ['A real, lasting fault also pages that much later'],
      },
      {
        approach: 'Alert on symptoms (error ratio, latency)',
        gains: ['Pages mean users are hurt', 'Catches failures with no obvious resource signature'],
        costs: ['Needs well-chosen signals and thresholds', 'Some causes are seen only once users feel them'],
      },
      {
        approach: 'Alert on causes (CPU, disk, restarts)',
        gains: ['Early warning of resource exhaustion'],
        costs: ['Noisy: fires at every normal peak', 'Misses failures that do not move the resource'],
      },
    ],
    mistakes: [
      'Paging on a single failed health check.',
      'Alerts with no runbook and no owner.',
      'A threshold above what a real fault produces, so users hurt and nothing fires.',
      'Paging on CPU at every daily peak while users are fine.',
    ],
    related: ['monitoring', 'slo', 'sli', 'metrics'],
    quiz: [
      {
        id: 'alert-1',
        prompt:
          'In the Lab, payments fail in 20-second blips that heal on their own, and the rule "error ratio > 2%" has a for of 0 s. It pages after every blip. What is the smallest fix?',
        options: [
          'Delete the rule',
          'Raise the threshold to 20%',
          'Give the rule a for duration of about 2 minutes, so the condition must hold before anyone is paged',
          'Page two people instead of one',
        ],
        answer: 2,
        explanation:
          'A duration filters out conditions that end on their own - nobody could have acted on a 20-second blip. Raising the threshold to 20% also silences the blips, but it would miss a lasting 10% payment failure too.',
      },
      {
        id: 'alert-2',
        prompt: 'You set for: 2m on the error-ratio rule. Payments now start failing for good. What is the cost of that choice?',
        options: [
          'The page arrives about 2 minutes after the condition starts, while users are already hurting',
          'None, the rule fires at once',
          'The rule never fires for lasting faults',
          'The rule fires twice',
        ],
        answer: 0,
        explanation:
          'The duration is a trade: blips are skipped, and real faults wait that long before a human hears about them. In the Lab the Missed pain counter grows for about a minute before the page. Choose it knowing both halves.',
      },
      {
        id: 'alert-3',
        prompt:
          'The rule pages at gateway error ratio above 5%. Payments fail 10% of charges, and checkouts are 40% of requests. What happens?',
        options: [
          'It pages at once: 10% is above 5%',
          'It never pages: the gateway sees 4%, so users hurt and nothing fires',
          'It pages after the for duration',
          'It pages only at night',
        ],
        answer: 1,
        explanation:
          '40% x 10% = 4% at the gateway, under the 5% threshold. One in ten customers cannot pay and the rule stays quiet - a missed alert. Lower the threshold, or add a symptom rule on the checkout route itself.',
      },
      {
        id: 'alert-4',
        prompt: 'A rule pages when CPU is above 70%. It fires at every daily peak while error ratio and latency are normal. What do you do?',
        options: [
          'Keep it, CPU matters',
          'Raise it to 95%',
          'Stop paging on it: keep CPU on the dashboard or as a capacity ticket, and page on symptoms users feel',
          'Add more servers until it stops',
        ],
        answer: 2,
        explanation:
          'High CPU with happy users is a busy service, not an incident. It is a cause, useful for diagnosis and capacity planning. Raising it to 95% keeps a cause rule that still misses failures that never move CPU, such as payments failing.',
      },
      {
        id: 'alert-5',
        prompt: 'A team gets about 200 alerts a week; fewer than 5 need action. Last month a real incident went unnoticed for 40 minutes. What is the root problem?',
        options: [
          'Too few people on call',
          'The pager app is too quiet',
          'Not enough alerts',
          'Alert fatigue: noise taught people to ignore alerts, including the real one',
        ],
        answer: 3,
        explanation:
          'Every noisy alert lowers the value of every other alert. The fix is deleting and converting alerts that nobody acts on - more people would just share the same noise.',
      },
      {
        id: 'alert-6',
        prompt: 'A service has a 99.9% SLO over 30 days. It is burning its error budget at 14.4 times the sustainable rate. If nothing changes, when is the budget gone?',
        options: ['In about 2 hours', 'In about 2 days', 'In about 2 weeks', 'In 30 days'],
        answer: 1,
        explanation:
          '30 days / 14.4 = about 2.1 days. That rate spends 2% of the monthly budget in a single hour, which is why the Google SRE Workbook pages on it. 2 weeks is a burn rate of about 2; 30 days is a burn rate of 1.',
      },
      {
        id: 'alert-7',
        prompt: 'Over the last three days the service has burned its error budget at exactly 1 times the sustainable rate. Page or ticket?',
        options: [
          'Ticket: at that rate the budget lasts exactly the 30 days - worth a look in working hours, not a wake-up',
          'Page, because budget is being spent',
          'Neither, it is fine forever',
          'Page, and roll back the last deploy',
        ],
        answer: 0,
        explanation:
          'A burn rate of 1 lands exactly on the SLO at the end of the window. Nobody needs to wake up, but a steady burn deserves attention before it grows - a ticket.',
      },
      {
        id: 'alert-8',
        prompt: 'A TLS certificate expires in 10 days. How should the alert reach people?',
        options: [
          'Page on-call now',
          'No alert, someone will notice',
          'Email the whole company',
          'A ticket for the owning team - important, not urgent',
        ],
        answer: 3,
        explanation:
          'It is actionable and real but not urgent - there are days to act. Pages are for what needs a human right now. Ignoring it is the tempting mistake that becomes a full outage on day 10.',
      },
      {
        id: 'alert-9',
        prompt: 'The shared database goes down and 30 services each page separately. What would have kept this to one useful page?',
        options: [
          'Longer thresholds on every service',
          'Removing the database alert',
          'Grouping and inhibition: one notification for the database, with the downstream symptom alerts suppressed while it fires',
          'Paging a different person per service',
        ],
        answer: 2,
        explanation:
          'Thirty pages for one cause bury the one that says where to look. Inhibition mutes downstream alerts while the upstream one fires; grouping collapses many similar alerts into one message.',
      },
      {
        id: 'alert-10',
        prompt: 'An alert fires, and the on-call engineer has no idea what it means or what to do. Nobody on the team can write a runbook for it. What is the right move?',
        options: [
          'Keep it; alerts should be hard',
          'Delete it, or rewrite it until someone can say what to check and what to do',
          'Send it to a different team',
          'Lower its threshold so it fires more and people learn it',
        ],
        answer: 1,
        explanation:
          'A page must be actionable. If nobody can describe the action, the alert is noise with a pager attached. Every alert that stays gets a runbook: what it means, how to confirm, how to mitigate, whom to escalate to.',
      },
      {
        id: 'alert-11',
        prompt: 'In the Lab you pick "Users cannot reach us". The error-ratio rule stays Inactive while the Missed pain counter grows. Why, and what covers it?',
        options: [
          'The threshold is too high; lower it to 0.5%',
          'The for duration is too long',
          'The rule is broken',
          'No requests arrive, so there are no errors to count; add a traffic-drop alert and a black-box probe alert',
        ],
        answer: 3,
        explanation:
          'Error ratio is computed over requests that arrived, and almost none do. No threshold on that signal can catch it. A rule on traffic far below the expected level, or on the synthetic probe failing, sees it at once.',
      },
      {
        id: 'alert-12',
        prompt: 'Disk usage is at 70% and growing about 5% a day. The current rule pages at 90%. What alert would serve better?',
        options: [
          'A trend alert, "disk full in under 4 days", as a ticket - it gives days of notice without a night-time page',
          'Page at 70% instead',
          'No alert, disks are cheap',
          'Page at 99%',
        ],
        answer: 0,
        explanation:
          'A fixed threshold either fires too early or leaves hours to react. A prediction from the trend says how much time is left, which is what decides urgency; days of notice make it a ticket, not a page.',
      },
    ],
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
