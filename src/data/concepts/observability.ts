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
      'trace_id',
      'waterfall',
      'latency breakdown',
      'instrumentation',
      'opentelemetry',
      'context propagation',
      'traceparent',
      'w3c trace context',
      'sampling',
      'span attributes',
    ],
    what: 'A trace records the path of one request through the system as a tree of spans, each with a start time, a duration, a parent span id and attributes. Distributed tracing keeps that tree whole across process boundaries by propagating the trace context - the W3C traceparent header on HTTP calls, the same context in message headers on a queue.',
    why: 'In a system with several services, "the request was slow" is useless on its own. Metrics show that something is slow; a trace answers "where did those 900 ms go?" - which hop consumed the time, including the asynchronous ones.',
    how: [
      'The entry point creates a trace_id; every outbound call carries it in the W3C traceparent header, next to the span id of the caller.',
      'Each operation opens a span whose parent is the span that called it, producing a tree - the waterfall.',
      'On a queue, the producer injects the context into the message headers and the consumer extracts it; forget either and the trace ends at the publish.',
      'Instrument with OpenTelemetry: auto-instrumentation covers HTTP, database drivers and frameworks, and the data is not tied to one vendor.',
      'Keep a sample: tail-based sampling keeps every error and slow trace and a small share of the rest.',
      'Name spans after the operation or route template (/orders/{id}); put ids such as order.id in attributes, and never secrets.',
    ],
    when: [
      'A request crosses more than two or three services, queues or datastores.',
      'A latency or error question that metrics can show but cannot attribute to one hop.',
      'Not as a replacement for metrics: traces are sampled, so rates and alerts still come from metrics.',
    ],
    advantages: [
      'Exact attribution: the span with the largest self time is the hop that owns the latency.',
      'Shows the calls that really happen - N+1 loops, forgotten dependencies, sync calls that could be async.',
      'With the trace_id in every log line, one slow trace leads straight to the log lines that explain it.',
    ],
    diagram: `trace_id 4bf92f35...   response 260 ms
POST /api/orders      [##########################] 260
  order-service       [  ########################] 242
    redis GET cart    [     #                    ]   3
    inventory reserve [      #####               ]  55
      postgres UPDATE [         ##               ]  25
    payment authorize [           ###############] 145 <- 120 own
      postgres INSERT [                       ###]  25
    kafka publish     [                          #]   4

HTTP:   traceparent: 00-4bf92f35...-00f067aa0ba902b7-01
Queue:  the same context rides in the message headers`,
    tradeoffs: [
      {
        approach: 'Distributed tracing',
        gains: ['Exact latency attribution to one hop', 'Shows the real service dependencies'],
        costs: ['Instrumentation in every service', 'Storage cost forces sampling', 'Context must be propagated everywhere, including async hops'],
      },
      {
        approach: 'Auto-instrumentation (OpenTelemetry)',
        gains: ['A full request tree without writing code', 'Vendor-neutral, so a backend change keeps the instrumentation'],
        costs: ['Generic spans only - business steps need manual spans', 'An agent or library in every service, with some overhead'],
      },
      {
        approach: 'Tail-based sampling',
        gains: ['Keeps every error and slow trace', 'Much more signal per stored byte'],
        costs: ['A collector must buffer every span until the trace is complete', 'More infrastructure to run and size'],
      },
      {
        approach: 'Head-based sampling',
        gains: ['Simple and cheap: decided once at the entry point', 'The sampled flag in traceparent makes every service keep or drop the same trace'],
        costs: ['Rare failures are usually not kept - exactly the traces you wanted'],
      },
    ],
    mistakes: [
      'Losing trace context across a queue, so the async half of the workflow is invisible.',
      'A hand-written HTTP client or SDK that does not forward traceparent, so the trace breaks in two at that hop.',
      'Naming spans with raw ids (/orders/4711), which makes traces impossible to group and expensive to index.',
      'Head-based sampling at 1% and expecting to find the rare failed request.',
      'Not logging the trace_id, so a slow trace cannot be joined to the log lines that explain it.',
    ],
    related: ['logging', 'metrics', 'monitoring', 'microservices'],
    quiz: [
      {
        id: 'dt-1',
        prompt:
          'Checkout p99 jumped from 300 ms to 1.2 s. The gateway latency graph shows it, but each of the 6 services behind it looks only a little slower on its own dashboard. What finds the hop that owns the time?',
        options: [
          'Add CPU to the gateway, since that is where the latency is measured',
          'Compare the average latency of the 6 services and pick the highest',
          'Open traces of slow checkouts and find the span with the largest self time in the waterfall',
          'Raise every service to DEBUG logging and read the lines',
        ],
        answer: 2,
        explanation:
          'A trace breaks one slow request into its hops, and self time says which hop spent the time itself rather than waiting on a child. The gateway only measures the total, so more gateway CPU fixes nothing. Service averages hide the slow tail and do not tell you which calls a slow request made.',
      },
      {
        id: 'dt-2',
        prompt:
          'In the Lab you raise Payment service to 800 ms. The order-service bar grows by the same amount, although its own work is still 35 ms. What does that tell you?',
        options: [
          'A parent span lasts as long as its children, so read self time: order-service is waiting, payment-service owns the time',
          'order-service got slower too and needs its own fix',
          'The trace is broken - a parent cannot be longer than its own work',
          'The gateway is retrying the order call',
        ],
        answer: 0,
        explanation:
          'A span duration includes every child it waits on, so a slow leaf makes every ancestor bar long. The Slowest span (self) metric and the lit Payment node point at the real owner. Blaming order-service is the tempting mistake - its self time did not move.',
      },
      {
        id: 'dt-3',
        prompt:
          'In the Lab you turn off "Inject context into the message". Emails are still sent, but the waterfall now ends at kafka publish order.created. What happened?',
        options: [
          'Kafka dropped the message, so the notification service never ran',
          'The consumer found no traceparent in the message headers and started a new trace_id, so its span is in a trace nothing links to',
          'The notification service stopped recording spans',
          'Sampling removed the consumer span to save storage',
        ],
        answer: 1,
        explanation:
          'The message still arrives - the Lab shows its dot reach Notification as a triangle - but it carries no context, so the consumer span starts a fresh trace. Inject the context at every publish and extract it at every consume. Kafka dropping the message is the tempting reading, but the email was sent.',
      },
      {
        id: 'dt-4',
        prompt:
          'The payment team replaced the instrumented HTTP library with a hand-written client to call the card-risk service. Since then, payment spans have no children and card-risk spans show up as root spans of their own traces. What is the cause?',
        options: [
          'The card-risk service needs a bigger sampling rate',
          'The clocks of the two services drifted apart',
          'The card-risk service is too fast to be traced',
          'The new client does not send the traceparent header, so card-risk sees no parent and starts a new trace',
        ],
        answer: 3,
        explanation:
          'Tracing only works across a hop if the caller sends the context and the callee reads it. A client that skips the header breaks the trace in two at that exact hop. Clock drift can misplace bars on the waterfall, but it cannot turn a child into a root span.',
      },
      {
        id: 'dt-5',
        prompt:
          'A service handles 1,000,000 requests a day and 0.1% of them fail. You use head-based sampling at 1%. About how many traces of failed requests do you keep each day?',
        options: [
          'All 1,000, because errors are always kept',
          'About 100',
          'About 10 - the decision is made before the outcome is known; tail-based sampling would keep all 1,000',
          'None, because head-based sampling drops errors on purpose',
        ],
        answer: 2,
        explanation:
          '1,000,000 x 0.1% = 1,000 failures, and a 1% coin flip at the start keeps about 10 of them. Head-based sampling cannot keep errors because it decides before the error happens. Tail-based sampling buffers the whole trace in a collector and decides after seeing the outcome, so it keeps every error.',
      },
      {
        id: 'dt-6',
        prompt:
          'A developer names each gateway span with the real path, such as "GET /orders/4711". Why is that a problem, and what is the fix?',
        options: [
          'Every order becomes its own operation name, so latency cannot be grouped per endpoint and the index grows without limit; name it GET /orders/{id} and put the id in an attribute',
          'Span names cannot contain numbers',
          'The trace_id stops being propagated',
          'Nothing - more detail in the name makes traces easier to find',
        ],
        answer: 0,
        explanation:
          'Span names are what the backend groups by, so they must be low cardinality: one name per route template. The id still belongs in the span, as an attribute such as order.id. "More detail is easier to find" is the tempting answer, but it makes every request look like a different operation.',
      },
      {
        id: 'dt-7',
        prompt:
          'A customer complains that their checkout was slow yesterday. Where should their user id be recorded so you can find their traces?',
        options: [
          'In the span name, so it shows in the waterfall',
          'As a label on the request latency metric',
          'Nowhere - traces cannot be searched by user',
          'As a span attribute such as user.id on the root span',
        ],
        answer: 3,
        explanation:
          'Attributes are what make traces searchable, and a trace is per request, so a user id costs one field, not a new time series. As a metric label it would make every user their own series - the cardinality problem from the Metrics Concept. In the span name it breaks grouping per endpoint.',
      },
      {
        id: 'dt-8',
        prompt:
          'A trace of a 480 ms product page shows pricing.calculate at 340 ms, made of 40 identical http POST /prices spans of about 8 ms each, one after another. What is the fix?',
        options: [
          'Give the pricing service a faster database',
          'Batch the 40 calls into one request with 40 item ids',
          'Cache the product page for 1 second',
          'Raise the timeout of the pricing call',
        ],
        answer: 1,
        explanation:
          'Each call is fast; the count is the problem - an N+1 pattern. One batched call takes about 12 ms instead of 340 ms. A faster database is the tempting answer, but no single span is slow, so there is little to gain there.',
      },
      {
        id: 'dt-9',
        prompt:
          'A span for report.generate lasts 900 ms. Its only children are two database queries of 20 ms each, and the first one starts 700 ms after the span starts. Where is the time going?',
        options: [
          'In the database, because it is the only dependency',
          'In the network between the two services',
          'Inside the report service itself - queuing for a thread or connection, or slow work before the first call',
          'Nowhere - the trace is missing spans, so it cannot be read',
        ],
        answer: 2,
        explanation:
          'The children account for 40 ms, so about 860 ms is self time in the parent, and a long gap before the first child means waiting or work inside the parent. Blaming the database is the reflex, but the waterfall shows its queries are small. Add manual spans or a profile inside the service to split that time.',
      },
      {
        id: 'dt-10',
        prompt:
          'In the Lab, with async notification on, the notification-service span ends after the root span has already ended. Is the trace broken?',
        options: [
          'Yes - every span must end before its root span',
          'Yes - the consumer should have been a separate trace',
          'No, but the response time now includes the email',
          'No - the consumer runs after the response went back; the trace covers all work the request caused, while the response time is the root span alone',
        ],
        answer: 3,
        explanation:
          'Async work is the point of the queue: the user gets the response after the root span, and the email is sent later in the same trace. That is why the Lab shows the response time separately from the length of the trace. Turning async off puts the 150 ms email call back on the request path, and the response grows by 150 ms.',
      },
      {
        id: 'dt-11',
        prompt:
          'You found the trace of a failing checkout: the error is in payment-service. How do you get the log lines that explain it?',
        options: [
          'Search every log line from payment-service in the minute around the failure',
          'Query the log store for the trace_id of that trace - every line of that request carries it',
          'Increase the sampling rate and wait for it to happen again',
          'Read the span attributes; logs are not needed once you have traces',
        ],
        answer: 1,
        explanation:
          'When services write the trace_id in every log line, one query returns the lines of exactly that request, from every service. A time window is the tempting approach, but at thousands of lines a second it returns everyone else too. Span attributes carry a few fields; logs carry the story of the step.',
      },
      {
        id: 'dt-12',
        prompt:
          'A company wants to move from one tracing vendor to another. Its 30 services use the first vendor SDK directly. What would have made the move a configuration change?',
        options: [
          'Writing spans to log files instead',
          'Using head-based sampling everywhere',
          'Instrumenting with OpenTelemetry and exporting through a collector, so only the exporter changes',
          'Running both vendors in parallel from the start',
        ],
        answer: 2,
        explanation:
          'OpenTelemetry keeps instrumentation vendor-neutral, and the collector decides where spans go, so a backend change is an exporter setting instead of 30 code changes. Running two vendors doubles the cost and still ties the code to both SDKs. Sampling has nothing to do with the lock-in.',
      },
      {
        id: 'dt-13',
        prompt:
          'In the Lab, click the postgres INSERT payments span. Postgres never receives a traceparent header, yet the span is in the trace. How?',
        options: [
          'It is a client span recorded by the database driver inside payment-service, which already has the context',
          'Postgres reads the trace_id from the SQL text',
          'The collector guesses which queries belong to which trace by time',
          'It is not really in the trace; the waterfall only draws it nearby',
        ],
        answer: 0,
        explanation:
          'Database and cache spans are usually recorded on the calling side: the instrumented driver wraps the query in a child span of the current span. The database does not need to know about tracing. Guessing by time would mix up concurrent requests, which is exactly what the trace context avoids.',
      },
    ],
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
