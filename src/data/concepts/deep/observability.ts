import type { DepthMap } from './types';

export const observabilityDepth: DepthMap = {
  logging: {
    analogy: {
      title: 'The ship log book',
      body:
        'Each entry records what happened, when, and in what conditions. Written well, an investigator can reconstruct the voyage months later. Written as "problem occurred", it proves only that somebody was on board. The value of a log is entirely in whether it answers a question you have not asked yet.',
    },
    deepDive: [
      {
        heading: 'Structured logs, because a human is not the reader',
        paragraphs: [
          'A log line like "User 42 failed to update order 91 after 320ms" is readable and nearly useless at scale - you cannot filter, aggregate or graph it without writing a regular expression that breaks whenever somebody rewords the message.',
          'Structured logging emits key-value data, normally JSON: event, user_id, order_id, duration_ms, status, trace_id. Now you can ask for all failures for one tenant in a time window, or the p95 duration by route, with a query rather than an archaeological dig.',
          'The single most valuable field is the correlation or trace id. With it, one query reconstructs everything that happened for one request across every service. Without it, you are matching timestamps by hand, and in a system with more than two services that is the difference between a five-minute investigation and a five-hour one.',
        ],
        code: {
          caption: 'The same event, two ways',
          body: `UNSTRUCTURED
  "User 42 failed to update order 91 after 320ms"
  -> grep and hope the wording never changes

STRUCTURED
  {"ts":"2026-09-18T10:03:22Z","level":"error","event":"order.update.failed",
   "user_id":42,"order_id":91,"duration_ms":320,"reason":"stock_unavailable",
   "trace_id":"4bf92f3577b34da6","service":"orders","version":"1.42.0"}

  -> filter by reason, group by version, correlate by trace_id`,
        },
      },
      {
        heading: 'Levels, volume and cost',
        paragraphs: [
          'Use levels with discipline: ERROR means something needs human attention, WARN means something unexpected that the system handled, INFO means a significant business event, DEBUG means detail useful while diagnosing. The common failure is logging everything at INFO, which produces a stream where the important lines are invisible.',
          'Volume becomes a real budget line quickly. A service at 1,000 requests per second logging ten 500-byte lines per request produces roughly 400 GB per day, and ingestion pricing makes that expensive. Sampling high-volume successful paths while keeping all errors gives you most of the value at a fraction of the cost.',
          'Retention should be tiered rather than uniform: recent logs searchable for days, older ones in cheap object storage for compliance. And logs are usually the wrong place for high-cardinality numeric data - if you want to graph it, emit a metric; if you want to explain one request, log it.',
        ],
        bullets: [
          'ERROR: a human must look. If nobody would act, it is not an error.',
          'Log at the boundary - one line per request with the outcome - plus errors.',
          'Sample successful high-volume paths; never sample errors.',
          'Never log secrets, tokens, passwords, card numbers or full personal records.',
          'Include service, version and trace id on every line, automatically.',
        ],
      },
      {
        heading: 'Logs, metrics and traces are not interchangeable',
        paragraphs: [
          'Metrics tell you that something is wrong: error rate is up, latency is up. They are cheap, aggregatable and ideal for alerting, and they cannot tell you why. Traces tell you where the time or the failure occurred across services. Logs tell you the detail of what happened in one place, with the context the code had at that moment.',
          'The efficient investigation uses all three in that order: an alert fires from a metric, a trace identifies the slow or failing hop, and logs for that trace id explain what that hop was doing. Teams that only have logs end up grepping; teams that only have metrics know something is wrong and nothing else.',
          'A practical bridge: emit the trace id in every log line and attach log links to your traces. That one integration turns three separate tools into one workflow, and it is usually a small amount of configuration.',
        ],
      },
    ],
    examples: [
      {
        title: 'A debugging session with and without structure',
        setup:
          'Customers report intermittent checkout failures. About 2 percent of attempts fail, across 6 services.',
        walkthrough: [
          'Unstructured: grep for "error" across services, get thousands of lines, try to match timestamps between services, guess which failures belong to the same request. Hours, with no certainty.',
          'Structured with trace ids: query for event=checkout.failed in the last hour, group by reason. Three reasons appear, one accounting for 89 percent.',
          'Take a trace id from one of those and query all services for it. Eleven lines describe the entire request path in order.',
          'The lines show: inventory check succeeded, payment succeeded, then the shipping service returned an error for postcodes in one region.',
          'Add a field: group by shipping_region across all failures. Confirmed - one region, one bad rate table entry.',
          'Total time: about 12 minutes, and the answer is certain rather than inferred.',
        ],
        result:
          'The difference was not the amount of logging but its shape. Structured fields plus a correlation id turn logs from a text search into a queryable dataset, which is the entire point.',
      },
    ],
    jargon: [
      { term: 'Structured logging', plain: 'Emitting key-value data rather than sentences, so logs can be queried.' },
      { term: 'Correlation / trace id', plain: 'An identifier shared by all logs for one request. The most valuable field you have.' },
      { term: 'Log level', plain: 'Severity: ERROR, WARN, INFO, DEBUG. Meaningful only if used with discipline.' },
      { term: 'Cardinality', plain: 'How many distinct values a field has. High cardinality is fine in logs, costly in metrics.' },
      { term: 'Sampling', plain: 'Keeping a fraction of high-volume lines to control cost. Never sample errors.' },
      { term: 'Retention tiering', plain: 'Searchable for days, archived cheaply for months.' },
    ],
    remember: [
      'Log structured key-value data - sentences cannot be queried.',
      'A trace id on every line is the single highest-value field.',
      'ERROR means someone must act; everything else is noise at 3am.',
      'Sample successful paths, never errors, and never log secrets.',
      'Metrics say something is wrong, traces say where, logs say what.',
    ],
  },

  metrics: {
    analogy: {
      title: 'The dashboard in a car',
      body:
        'Speed, fuel, temperature - a few numbers, updated constantly, that tell you whether things are normal. They do not explain why the engine is hot; they tell you to look. Cheap to read at a glance, and that is exactly the role metrics play: continuous, aggregated, ideal for alerting and useless for explaining a single journey.',
    },
    deepDive: [
      {
        heading: 'Four types, and picking the right one',
        paragraphs: [
          'A counter only goes up: requests served, errors, bytes sent. You graph its rate, not its value. A gauge goes up and down: queue depth, memory in use, active connections. A histogram buckets observations so you can compute percentiles: request duration is almost always a histogram. A summary computes percentiles at the source, which is cheaper but cannot be aggregated across instances.',
          'The common mistake is using a gauge for something that should be a counter, then losing data whenever the process restarts, or computing an average duration instead of a histogram and never being able to see p99. The type is a decision about what questions you will be able to ask later.',
          'For latency specifically, always use a histogram. Averages hide the tail, and the tail is where users have a bad experience - a service with a 50 ms mean and a 3 s p99 looks healthy on one graph and is failing for one user in a hundred.',
        ],
        code: {
          caption: 'Choosing the type',
          body: `counter    http_requests_total{route,status}     rate() it
gauge      queue_depth, memory_bytes            read it directly
histogram  http_request_duration_seconds        percentiles, SLOs
summary    same, computed client-side           cannot aggregate across pods

USE
  error rate   = rate(requests_total{status=~"5.."}) / rate(requests_total)
  p99 latency  = histogram_quantile(0.99, rate(duration_bucket[5m]))
  saturation   = gauge / capacity`,
        },
      },
      {
        heading: 'Cardinality is the cost, and it explodes quietly',
        paragraphs: [
          'Every unique combination of label values creates a separate time series stored and indexed forever. A metric with 5 routes and 4 status codes is 20 series - fine. Add a user_id label with a million users and it is 20 million series, which will take down your monitoring system and cost more than the service it observes.',
          'So labels must be bounded and low cardinality: route (from a template, never the raw path with ids in it), status class, method, region, service version. Never user id, order id, session id, full URL, or an error message string.',
          'This is also the clean division of labour with logs. High-cardinality context - which user, which order, which exact error - belongs in logs and traces, where it costs a row rather than a permanent time series. If you find yourself wanting a per-customer metric, you usually want a log query instead.',
        ],
        bullets: [
          'Labels: route template, method, status class, region, version.',
          'Never: user id, order id, email, full path, raw error text.',
          'Watch total series count as a metric in its own right.',
          'Use a fixed set of histogram buckets chosen around your SLO threshold.',
        ],
      },
      {
        heading: 'What to measure: RED, USE and the four golden signals',
        paragraphs: [
          'For request-driven services, RED is the shortest useful checklist: Rate (requests per second), Errors (failed requests per second), Duration (latency distribution). Three metrics per service, and they answer most operational questions.',
          'For resources - CPU, disk, connection pools, queues - USE is the counterpart: Utilisation (how busy), Saturation (how much queued work), Errors. A pool at 100 percent utilisation with a growing wait queue is the clearest possible signal of a bottleneck.',
          'The four golden signals (latency, traffic, errors, saturation) are essentially both combined, and any of the three frameworks is fine. What matters is that every service has the same small set, consistently named, so an engineer can open an unfamiliar service dashboard and read it immediately.',
        ],
      },
    ],
    examples: [
      {
        title: 'The dashboard that showed everything except the problem',
        setup:
          'A service has 40 graphs: CPU, memory, GC, thread counts, connection counts per host. Users report slowness and none of the graphs look unusual.',
        walkthrough: [
          'Problem 1: no latency histogram. Average response time is graphed at 95 ms, which hides a p99 of 4 seconds affecting one request in a hundred.',
          'Problem 2: no error rate by route. Errors are graphed as a total count, so a route failing 40 percent of the time is invisible next to millions of successful requests elsewhere.',
          'Problem 3: everything is per host. With 30 hosts, one unhealthy host is a thin line nobody notices among 30 others.',
          'Rebuild with RED: request rate by route, error ratio by route, and a duration histogram - about 6 graphs replacing 40.',
          'Immediately visible: one route with a p99 of 4 seconds and an error ratio of 3 percent, both starting at the time of a deploy two days earlier.',
          'Resource graphs are kept but moved to a second dashboard, used after the RED metrics point somewhere.',
        ],
        result:
          'Six well-chosen metrics beat forty incidental ones. Measure what users experience first; resource metrics explain a problem but rarely reveal one.',
      },
    ],
    jargon: [
      { term: 'Counter / gauge', plain: 'A value that only increases, versus one that moves up and down.' },
      { term: 'Histogram', plain: 'Bucketed observations enabling percentile queries. Use it for latency.' },
      { term: 'Cardinality', plain: 'The number of distinct label combinations. The main cost driver.' },
      { term: 'RED / USE', plain: 'Rate, Errors, Duration for services; Utilisation, Saturation, Errors for resources.' },
      { term: 'Scrape / push', plain: 'The collector pulling metrics from your service, or your service sending them.' },
      { term: 'Aggregation window', plain: 'The time range a rate or percentile is computed over.' },
    ],
    remember: [
      'Counters, gauges and histograms answer different questions - pick the type deliberately.',
      'Latency must be a histogram; averages hide the users having a bad time.',
      'Labels must be low cardinality - never user or request ids.',
      'High-cardinality context belongs in logs and traces, not metrics.',
      'RED per service plus USE per resource covers most of what you need.',
    ],
  },

  'distributed-tracing': {
    analogy: {
      title: 'A baton passed between runners',
      body:
        'Each runner writes their leg time on the baton and passes it on. At the finish you have the whole race broken down by leg, so when the team is slow you do not guess - you see which leg took the time. Drop the baton once - hand over without it - and every leg after that is unattributed, which is exactly what happens when context is not propagated across a queue.',
    },
    deepDive: [
      {
        heading: 'Spans, parents and the waterfall',
        paragraphs: [
          'A trace is a tree of spans. Each span represents one operation - handling an HTTP request, executing a query, calling another service - and records a start time, a duration, a parent span id and a set of attributes. The trace id ties them all together; the parent links give the tree its shape.',
          'Reading a trace is mostly reading the waterfall. Sequential bars mean work happening one after another, which is where batching or parallelism might help. A wide parent with a narrow set of children means time is being spent in the parent itself rather than in its calls. A long gap between a parent starting and its first child means queuing or slow initialisation.',
          'The classic finding is the N+1 pattern rendered visually: fifty tiny identical spans in a row. Nobody reading code notices it; in a trace it is unmistakable, and the fix - batching - is obvious from the picture.',
        ],
        code: {
          caption: 'Reading a waterfall, and keeping it whole across a queue',
          body: `trace 4bf92f  total 480 ms
  api.request                [============================] 480
    auth.verify              [=]                              8
    orders.get               [======]                        95
      db.query               [=====]                         88
    pricing.calculate        [==================]           340   <- here
      http POST /prices      [=]  x40 sequential                  <- N+1
    render                   [==]                            30

340 of 480 ms in one child, made of 40 sequential calls.

across a queue
  producer:  inject(current_context, message.headers)
  consumer:  ctx = extract(message.headers)
             span = tracer.start("order.process", links=[ctx])
forget either line and the consumer starts a brand-new trace`,
        },
      },
      {
        heading: 'Context propagation is the whole mechanism',
        paragraphs: [
          'Tracing works across services because every outbound call carries the trace context. For HTTP that is the W3C traceparent header, containing the trace id, the current span id and a sampled flag. The receiving service reads it, creates a child span, and passes its own context onward.',
          'It breaks wherever something in the chain does not forward that header. A hand-rolled HTTP client, a third-party SDK, a queue publisher that does not copy the context into message metadata - each becomes a point where the trace ends and everything downstream appears unrelated.',
          'Asynchronous hops need explicit work. The producer injects the context into message headers, the consumer extracts it and creates a span linked to the original trace. Without that, the two halves of a workflow are two disconnected traces, and the async half - where problems usually hide - becomes invisible. This is the single most common gap in real deployments.',
        ],
        bullets: [
          'Propagate across HTTP, gRPC, queues and scheduled work.',
          'Inject at every publish, extract at every consume.',
          'Propagate the sampling decision too, or you get partial traces.',
        ],
      },
      {
        heading: 'Instrumentation, attributes and sampling',
        paragraphs: [
          'Most of the value comes free: OpenTelemetry auto-instrumentation covers HTTP servers and clients, database drivers and popular frameworks, giving you a full request tree without writing code. Because it is vendor-neutral, that expensive instrumentation work survives a change of backend. Manual spans are worth adding only around meaningful internal operations - a business step, an expensive computation, a cache lookup.',
          'Attributes are what make traces searchable: tenant, route template, cache hit or miss, queue name, result status, retry count. Keep span names and attribute values low cardinality, never put secrets or personal data in them, and mark failed spans with their exception so error traces are easy to query as a population.',
          'A busy service generates far more trace data than logs, so you keep a fraction. Head-based sampling decides at the start of the request - simple and cheap, and it discards most errors precisely because errors are rare. Tail-based sampling buffers the complete trace in a collector and decides after seeing the outcome, so you keep every error, every slow request and 1 percent of the rest. The collector is also where you redact attributes and change policy without redeploying thirty services.',
          'Finally, emit the trace id in logs and attach exemplars to metrics. Then a latency spike on a graph links to a trace of a slow request, which links to the logs of the service that caused it - and the traces themselves give you a dependency map of the calls that really happen, including the ones nobody remembered.',
        ],
        bullets: [
          'Auto-instrument first; add manual spans only where they explain something.',
          'Keep span names low cardinality - /orders/{id}, never /orders/4711.',
          'Centralise sampling and redaction in the collector.',
          'Emit trace ids in logs so the two link in both directions.',
        ],
      },
    ],
    examples: [
      {
        title: 'Finding 340 ms nobody suspected',
        setup:
          'A product page has a p95 of 480 ms. The team believes the database is slow, based on the fact that the database is usually the answer.',
        walkthrough: [
          'The trace shows the database query at 88 ms - real, but not the problem.',
          'The pricing step is 340 ms, and it is made of 40 sequential HTTP calls of about 8 ms each, one per item in the basket.',
          'Nobody had noticed because each call is fast; only the accumulation is slow, and no metric showed the count per request.',
          'Fix 1: batch the calls into one request carrying 40 item ids. Pricing drops from 340 ms to 12 ms.',
          'Fix 2: add a span attribute pricing.items_count, so a future regression is visible as a distribution rather than a mystery.',
          'p95 for the page falls from 480 ms to roughly 150 ms, without touching the database everyone was suspicious of.',
        ],
        result:
          'Tracing replaced a plausible assumption with a measurement. The accumulation of many small calls is the single most common finding when a team looks at traces for the first time.',
      },
      {
        title: 'The invisible half of the workflow',
        setup:
          'Checkout publishes to a queue; a worker processes payment. Traces end at the publish, so the payment half is invisible. Customers report orders stuck for minutes.',
        walkthrough: [
          'Current state: the API trace shows 120 ms and looks healthy. The worker produces its own unrelated traces, with no way to connect them to an order.',
          'Fix 1: inject the trace context into the message headers at publish, and extract it in the consumer with a span link.',
          'Immediately the full picture appears: 120 ms in the API, then 4 minutes of queue wait, then 900 ms of processing.',
          'The queue wait was never visible in any metric, because queue depth looked normal on average - the delay came from a single slow consumer holding a partition.',
          'Fix 2: add span attributes for queue name, partition and consumer id, making the pattern queryable rather than anecdotal.',
          'Fix 3: alert on the span duration representing queue wait, which is what users actually feel, rather than on queue depth.',
        ],
        result:
          'Propagating context across one queue boundary revealed a four-minute delay nobody could see. Async hops are where traces most often break and where the worst delays most often live.',
      },
    ],
    jargon: [
      { term: 'Span', plain: 'One operation with a start, a duration and attributes.' },
      { term: 'Trace id / parent span id', plain: 'What ties spans into one tree.' },
      { term: 'Waterfall', plain: 'The visual timeline of spans. Reading it is the main skill.' },
      { term: 'traceparent', plain: 'The W3C header carrying trace context to the next hop.' },
      { term: 'Span link', plain: 'Connecting a consumer span to the producer trace for async work.' },
      { term: 'Head / tail sampling', plain: 'Deciding to keep a trace at the start, or after seeing the outcome.' },
    ],
    remember: [
      'A trace is a tree of timed spans for one request - the waterfall shows where the time went.',
      'Everything depends on propagating context to the next hop.',
      'Queues are where traces break - inject and extract explicitly.',
      'Instrument with OpenTelemetry, and keep every error and slow trace with tail-based sampling.',
      'Keep span names and attributes low cardinality, and emit trace ids in logs.',
    ],
  },

  monitoring: {
    analogy: {
      title: 'Health checks at the clinic versus a hospital monitor',
      body:
        'A routine check asks a fixed set of known questions: blood pressure, temperature, pulse. That catches the problems somebody anticipated. A patient with unusual symptoms needs investigation - asking new questions of raw data. Monitoring is the fixed set; observability is being able to ask the new question without adding a sensor first.',
    },
    deepDive: [
      {
        heading: 'Monitoring answers known questions; observability enables new ones',
        paragraphs: [
          'Monitoring is dashboards and alerts built on metrics you decided to collect: error rate, latency, CPU, queue depth. It works well for failure modes you have seen before, and it is the right foundation - cheap, continuous, and directly alertable.',
          'Observability is the property of being able to answer questions you did not anticipate, from data you already have. "Why are Android users in Germany on version 4.2 seeing 3-second responses only when the cart has more than ten items?" is not a dashboard, and it cannot be answered by any fixed set of metrics.',
          'In practice that means high-cardinality, high-dimensional data: traces and structured events with many attributes. The distinction is not academic - it decides whether a novel incident takes ten minutes or a day, and novel incidents are the expensive ones.',
        ],
        code: {
          caption: 'What each layer is for',
          body: `METRICS   cheap, aggregated, alertable      "error rate is 4%"
TRACES    per request, cross-service        "the 3 s is in pricing"
LOGS      detail in one place               "stock lookup threw for EU-3"
EVENTS    wide structured records           "only for carts > 10 items,
                                             app 4.2, region DE"

alert on metrics -> narrow with traces -> confirm with logs
add dimensions to events for the questions you cannot predict`,
        },
      },
      {
        heading: 'Black box and white box, and why you need both',
        paragraphs: [
          'Black box monitoring probes the system from outside as a user would: a synthetic request through the real path, from another region, checking the response. It catches things internal metrics cannot - DNS problems, expired certificates, a CDN misconfiguration, a firewall rule - because it exercises everything between a user and you.',
          'White box monitoring is instrumentation inside: request rates, queue depths, pool utilisation, cache hit rates. It tells you why, and it can detect problems before users do, such as a connection pool trending toward exhaustion.',
          'Use both, and treat the black box check as the authority on whether you are up. Plenty of incidents have the internal dashboards entirely green while users cannot reach the service at all, which is exactly the class of failure internal monitoring is blind to.',
        ],
        bullets: [
          'Synthetic checks from outside, from more than one region.',
          'Real user monitoring for what actual clients experience, including the browser.',
          'Internal RED metrics per service and USE metrics per resource.',
          'Watch the monitoring system itself - a silent alerting pipeline looks like health.',
        ],
      },
      {
        heading: 'Dashboards that get used',
        paragraphs: [
          'Most dashboards are built during one incident and never read again. The ones that survive follow a hierarchy: a single service overview with RED metrics that fits on one screen, then drill-down dashboards per subsystem, then raw exploration for novel questions.',
          'Consistency matters more than completeness. When every service dashboard has the same layout, names and units, an engineer who has never seen this service can read it during an incident. Forty bespoke graphs per service guarantee nobody can.',
          'Add context to the graphs: deploy markers, incident annotations and the SLO threshold drawn as a line. "Latency rose at 14:02" is much more useful when a deploy marker sits at 14:01, and a threshold line turns "is this bad?" into a visual answer.',
        ],
      },
    ],
    examples: [
      {
        title: 'Green dashboards, broken site',
        setup:
          'All internal metrics are normal - error rate under 0.1 percent, latency nominal, CPU fine. Customers cannot reach the site for 25 minutes.',
        walkthrough: [
          'Cause: a DNS change removed a record for the apex domain. Requests never reached the load balancer, so no internal metric recorded anything unusual.',
          'From the inside, low traffic looked like a quiet period. Nothing alerted, because no alert existed on traffic dropping.',
          'Fix 1: synthetic checks from three external regions performing a full user journey - DNS resolution, TLS handshake, page load, an API call.',
          'Fix 2: an alert on traffic falling below the expected range for the time of day. A sudden drop to zero is as much a signal as a spike in errors.',
          'Fix 3: DNS changes go through code review and a pipeline, with a check that the apex record resolves after any change.',
          'Fix 4: the status page and alerting run on infrastructure independent of the affected domain, so an outage does not disable the way you find out about it.',
        ],
        result:
          'Internal monitoring cannot see failures that occur before traffic reaches you. An external synthetic check and a low-traffic alert would each have caught this within a minute.',
      },
    ],
    jargon: [
      { term: 'Black box / white box', plain: 'Probing from outside, versus instrumenting inside.' },
      { term: 'Synthetic monitoring', plain: 'Scripted requests run on a schedule from outside your network.' },
      { term: 'RUM', plain: 'Real user monitoring: data collected from actual browsers and apps.' },
      { term: 'Observability', plain: 'Being able to answer unanticipated questions from data you already collect.' },
      { term: 'High cardinality', plain: 'Many distinct values per field. Expensive in metrics, essential for investigation.' },
      { term: 'Deploy marker', plain: 'An annotation on graphs showing when a release happened.' },
    ],
    remember: [
      'Monitoring answers known questions; observability lets you ask new ones.',
      'Internal metrics cannot see failures that happen before traffic reaches you.',
      'A sudden drop in traffic deserves an alert as much as a spike in errors.',
      'Consistent dashboards across services beat comprehensive bespoke ones.',
      'Annotate deploys and draw SLO thresholds on the graphs.',
    ],
  },

  alerting: {
    analogy: {
      title: 'A smoke alarm, not a thermometer',
      body:
        'A smoke alarm wakes you because the house may be on fire and you must act. A thermometer that beeps whenever the room passes 22 degrees is removed from the wall within a week. An alert that does not require immediate human action trains people to ignore alerts, including the one that mattered.',
    },
    deepDive: [
      {
        heading: 'Alert on symptoms, not causes',
        paragraphs: [
          'Cause-based alerts - high CPU, low disk, a pod restarting - fire constantly and often mean nothing: a service can run at 90 percent CPU perfectly happily, and a pod restart may be routine. They also miss failures that do not have an obvious resource signature.',
          'Symptom-based alerts fire on what users experience: the error rate for checkout is above 2 percent, p99 latency is above 2 seconds, the order pipeline has processed nothing for 10 minutes. These have almost no false positives, because if they are true then something is genuinely wrong for somebody.',
          'A useful rule of thumb: one good symptom alert can replace twenty cause alerts. Keep cause metrics on dashboards for diagnosis - they are valuable there - but page on the handful of signals that mean a user is affected.',
        ],
        code: {
          caption: 'The same failure, two alerting strategies',
          body: `CAUSE-BASED (noisy, incomplete)
  CPU > 80%            fires during every normal peak
  memory > 75%         fires because the JVM uses its heap
  pod restarted        fires on every deploy
  disk > 70%           fires weeks before it matters

SYMPTOM-BASED (few, meaningful)
  checkout error ratio > 2% for 5 min          -> page
  p99 latency > 2 s for 10 min                 -> page
  queue oldest message age > 15 min            -> page
  cert expires in < 14 days                    -> ticket, not a page
  disk will be full in < 4 days (trend)        -> ticket, not a page`,
        },
      },
      {
        heading: 'Every page must be actionable, urgent and real',
        paragraphs: [
          'Before creating a page, ask three questions. Is a human needed right now, or can it wait for business hours? Is there something they can actually do? Does it indicate real user impact? If any answer is no, it belongs in a ticket or a dashboard, not on a pager.',
          'Alert fatigue is the failure mode that matters. When a team receives twenty pages a night and nineteen are noise, they stop reading carefully, and eventually the real one is acknowledged and forgotten. Every noisy alert degrades the value of every other alert, so deleting a bad alert is real reliability work.',
          'Attach a runbook link to each alert: what it means, how to confirm, what to check, how to mitigate, who to escalate to. An alert without one requires the responder to already know the system, which defeats the purpose of having a rota.',
        ],
        bullets: [
          'Page only for urgent, actionable, user-affecting conditions.',
          'Everything else: a ticket, a dashboard, or a daily digest.',
          'Every alert links to a runbook with concrete steps.',
          'Review alert noise regularly and delete what nobody acts on.',
          'Alert on trends for slow problems - "disk full in 4 days" beats "disk 90 percent".',
        ],
      },
      {
        heading: 'Thresholds, duration and burn rate',
        paragraphs: [
          'A threshold alone produces flapping: a metric hovering around the line fires and resolves repeatedly. Require the condition to hold for a duration - five minutes is a common default - so momentary spikes are ignored while genuine problems still page quickly.',
          'Error budget burn rate is the more sophisticated version, and it is worth adopting once you have SLOs. Instead of a fixed threshold, alert on how fast you are consuming your allowed failures: burning at 14 times the normal rate over an hour is urgent, while burning at 2 times over six hours is a ticket. This automatically distinguishes a sudden outage from a slow degradation.',
          'Also suppress the noise created by your own alerts. Grouping (one notification for fifty pods with the same problem), inhibition (do not page for a downstream symptom when the upstream cause is already paging) and maintenance windows are what keep an incident from producing forty separate notifications.',
        ],
      },
    ],
    examples: [
      {
        title: 'From 200 alerts a week to 12',
        setup:
          'A team receives roughly 200 alerts per week. Fewer than 5 require action. Engineers have muted several channels, and a genuine incident was missed for 40 minutes.',
        walkthrough: [
          'Audit: for each alert type over the last three months, count how often it fired and how often anyone did anything.',
          'Delete alerts with a zero action rate - 60 percent of the volume. CPU, memory and routine restarts all go.',
          'Convert slow-moving conditions to tickets: certificate expiry, disk trending full, deprecated API usage. Important, not urgent.',
          'Add the missing symptom alerts: per-route error ratio, p99 latency against the SLO, queue oldest-message age, and a drop in traffic.',
          'Group by service so one incident produces one notification with a count, rather than one per pod.',
          'Add inhibition: if the database alert is firing, do not page separately for every service that depends on it.',
          'Write a runbook for each remaining alert, and delete any alert nobody can write a runbook for - that absence is itself the signal.',
        ],
        result:
          'Twelve alerts a week, nearly all actionable, and the median acknowledgement time fell from 18 minutes to 2. Removing alerts improved reliability, which is counter-intuitive until you have lived through alert fatigue.',
      },
    ],
    jargon: [
      { term: 'Symptom vs cause alert', plain: 'Alerting on user impact versus on an internal resource condition.' },
      { term: 'Alert fatigue', plain: 'Noise training people to ignore alerts. The main reason real incidents are missed.' },
      { term: 'Runbook', plain: 'The written procedure attached to an alert.' },
      { term: 'Burn rate', plain: 'How fast you are consuming the error budget. A better alert trigger than a fixed threshold.' },
      { term: 'Grouping / inhibition', plain: 'Collapsing related notifications, and suppressing downstream symptoms.' },
      { term: 'Page vs ticket', plain: 'Wake someone now, versus handle it in business hours.' },
    ],
    remember: [
      'Page on symptoms users feel, not on internal causes.',
      'Urgent, actionable and real - all three, or it is not a page.',
      'Every noisy alert reduces the value of every other alert.',
      'Require a duration, and prefer burn-rate alerts once you have SLOs.',
      'If nobody can write a runbook for an alert, delete the alert.',
    ],
  },

  sli: {
    analogy: {
      title: 'The measurement, before the target',
      body:
        'Before promising a delivery time, you must first be able to measure how long deliveries take - and agree whether the clock starts when the order is placed or when the parcel leaves the warehouse. An SLI is that agreed measurement. Arguments about targets are usually arguments about what is being measured.',
    },
    deepDive: [
      {
        heading: 'A good SLI is a ratio of good events to valid events',
        paragraphs: [
          'The most useful form is: good events divided by valid events, as a percentage. Successful requests over all requests. Requests faster than 300 ms over all requests. This shape is easy to reason about, aggregates cleanly, and maps directly onto an error budget.',
          'Both halves need definitions. What is a good event - status under 500? Does a 429 count as a failure when it is you protecting yourself? What is a valid event - do health checks count, do requests from bots, do requests that were cancelled by the client? These questions look pedantic and they determine whether your number means anything.',
          'Measure as close to the user as possible. Server-side latency excludes network time and client rendering, so it can look excellent while users wait. Load balancer or CDN metrics are better, and real user monitoring is best - though each step outward adds noise from things you do not control, which is the trade-off to make consciously.',
        ],
        code: {
          caption: 'Writing an SLI so it cannot be argued about later',
          body: `AVAILABILITY
  good  = requests with status < 500, excluding 429
  valid = all requests to /api/*, excluding health checks and bots
  SLI   = good / valid, measured at the load balancer

LATENCY
  good  = requests completed in < 300 ms
  valid = same as above
  SLI   = good / valid

FRESHNESS (for a pipeline)
  good  = records processed within 5 min of creation
  valid = all records
  SLI   = good / valid`,
        },
      },
      {
        heading: 'Choose few, and choose what users feel',
        paragraphs: [
          'Two or three SLIs per user-facing journey is usually right: availability, latency, and where relevant correctness or freshness. More than that and nobody remembers them, and conflicting signals make decisions harder rather than easier.',
          'Pick them per journey rather than per service. Users care about completing a checkout, not about whether the pricing service responded - and a service-level number can look fine while the journey is broken because one of its six dependencies is failing intermittently.',
          'Latency SLIs should be expressed as a threshold ratio rather than a percentile value. "99 percent of requests under 300 ms" is easier to combine into an error budget than "p99 is under 300 ms", and it degrades more gracefully when traffic volumes change.',
        ],
        bullets: [
          'Availability: successful responses over valid requests.',
          'Latency: requests under a threshold over valid requests.',
          'Quality: correct or complete responses, for systems where wrong is possible.',
          'Freshness: data updated within a window, for pipelines and caches.',
          'Two or three per journey, not per service.',
        ],
      },
      {
        heading: 'The measurement decisions that quietly change the number',
        paragraphs: [
          'Where you measure matters enormously. The same system can show 99.99 percent at the application, 99.9 percent at the load balancer and 99.5 percent from real users - none of them wrong, all measuring different things. Write down the measurement point alongside the definition.',
          'Aggregation windows matter too. A four-minute outage is invisible in a monthly average and glaring in a five-minute window. Rolling windows (the last 30 days) are generally more useful than calendar months, because they do not reset the picture on the first of the month.',
          'And decide about excluded traffic explicitly: bots, scrapers, health checks, load tests, requests from your own office. Each exclusion is defensible and each one moves the number, so they should be agreed and documented rather than discovered during a dispute.',
        ],
      },
    ],
    examples: [
      {
        title: 'Two teams, one system, two different numbers',
        setup:
          'The platform team reports 99.98 percent availability. The product team insists customers experienced far worse. Both are measuring honestly.',
        walkthrough: [
          'Platform measures at the application: requests that reached the handler and returned under 500. Requests that never arrived are invisible.',
          'Product measures from the mobile app: any request that did not produce a usable result, including timeouts, DNS failures and connection errors.',
          'The gap is entirely requests that never reached the application - a load balancer misconfiguration dropping about 0.1 percent of connections.',
          'Resolution: define one SLI measured at the CDN, which sees everything that reaches the infrastructure, plus a client-side SLI for the app that includes network conditions.',
          'Definitions agreed: 429 is not a failure (it is protection working), client-cancelled requests are not valid events, health checks are excluded.',
          'New number: 99.91 percent at the CDN and 99.7 percent client-side. Both published, both understood, and the difference is itself a useful signal.',
        ],
        result:
          'The disagreement was about the measurement, not the system. Agreeing the SLI definition - what counts as good, what counts as valid, and where it is measured - resolves most arguments about reliability before they start.',
      },
    ],
    jargon: [
      { term: 'SLI', plain: 'Service level indicator: the measurement itself, usually good events over valid events.' },
      { term: 'Good event / valid event', plain: 'What counts as success, and what counts at all.' },
      { term: 'Measurement point', plain: 'Where the number is taken: app, load balancer, CDN or client.' },
      { term: 'Threshold ratio', plain: 'Share of requests under a latency limit. Preferred over a raw percentile for SLOs.' },
      { term: 'Rolling window', plain: 'A trailing period such as the last 30 days, rather than a calendar month.' },
      { term: 'Freshness', plain: 'How current the data is. The right SLI for pipelines and caches.' },
    ],
    remember: [
      'An SLI is good events over valid events - define both halves precisely.',
      'Measure as close to the user as you can bear, and write down where.',
      'Two or three per user journey, not per service.',
      'Express latency as a threshold ratio, not a percentile value.',
      'Exclusions and windows change the number - agree them in advance.',
    ],
  },

  slo: {
    analogy: {
      title: 'A budget, not a wish',
      body:
        'Saying "we will spend less" changes nothing. Saying "we have 500 euro this month" changes every decision, because you can see how much is left. An SLO works the same way: 99.9 percent means 43 minutes of failure this month, and the useful question becomes how much of that remains.',
    },
    deepDive: [
      {
        heading: 'The error budget is the point',
        paragraphs: [
          'An SLO is a target for an SLI over a window: 99.9 percent of requests successful over 30 days. The complement - 0.1 percent - is the error budget, and it converts reliability from an argument into arithmetic. At a million requests a month, you may fail a thousand of them.',
          'That changes how teams decide. Budget remaining means you can ship risky changes, run experiments and do migrations. Budget exhausted means you stop feature work and spend the next period on reliability. The rule is agreed in advance, so nobody has to win an argument during an incident.',
          'It also stops the pursuit of perfection. A team well inside budget is arguably being too cautious - unspent budget is velocity nobody used. That framing is genuinely useful, because "more reliable" is not free and beyond a point it costs more than the failures it prevents.',
        ],
        code: {
          caption: 'What each target actually permits',
          body: `over 30 days
  99%      7 h 12 m of failure    a hobby project
  99.5%    3 h 36 m
  99.9%    43 m 12 s              a sensible default for most services
  99.95%   21 m 36 s
  99.99%   4 m 19 s               needs automated everything
  99.999%  26 s                   no human can be in the loop

burn rate = how fast you are spending it
  1x    = you will exactly exhaust the budget at the end of the window
  14.4x = 2% of the budget per hour, all of it in about 2 days -> page`,
        },
      },
      {
        heading: 'Setting a target you can defend',
        paragraphs: [
          'Use what you currently achieve as a starting point, not as the goal. Measure the SLI for a month; if you are at 99.5 percent, setting 99.99 percent means being permanently out of budget, which makes the whole mechanism meaningless. But do not simply copy the current number either - the Google SRE book warns against it, because it can lock you into a level users never needed. Start near what you achieve, then move the target towards what users need.',
          'Then check it against what users need. If users cannot tell the difference between 99.9 and 99.95 percent - and for many products they cannot - the extra nine buys nothing and costs a great deal. Conversely, if a payment failure loses a customer permanently, the target should be higher than what feels comfortable.',
          'Deliberately aim to be slightly worse than perfect. If you consistently deliver 99.999 percent against a 99.9 percent target, users start depending on the higher number, and you are spending effort nobody asked for. Some organisations inject failures precisely to keep expectations aligned with the commitment.',
        ],
        bullets: [
          'Start from measured performance, then move the target towards what users need.',
          'Different SLOs for different journeys - checkout and the help page are not equally critical.',
          'Rolling windows (30 days, or 28 so every window holds four of each weekday) avoid calendar-boundary resets.',
          'Write down the policy for an exhausted budget before you need it.',
        ],
      },
      {
        heading: 'Alerting on burn rate instead of thresholds',
        paragraphs: [
          'A fixed threshold alert cannot distinguish a brief spike from a sustained problem. Burn-rate alerting does: measure how fast the budget is being consumed relative to the rate that would exactly exhaust it over the window, and alert on multiples.',
          'The Google SRE Workbook recommends three rules for a 30-day SLO. A fast burn - 14.4 times the sustainable rate over an hour - spends 2 percent of the budget in that hour and would spend all of it in about two days, so it pages. A burn of 6 times over six hours also pages. A slow burn - 1 time over three days, on track to spend exactly the whole budget - opens a ticket, because it is real degradation but not an emergency. Each rule also checks a short window (5 minutes, 30 minutes, 6 hours), so the alert stops soon after the problem does.',
          'The benefit is fewer, more meaningful pages. A 30-second blip of total failure spends about 1 percent of the budget and averages to about 8 times over the hour, so it does not page; a sustained 2 percent error rate (20 times) does, even though it is well below any threshold someone would have picked by hand. The alert is tied directly to the promise you made rather than to a guess.',
        ],
      },
    ],
    examples: [
      {
        title: 'The first quarter with an error budget',
        setup:
          'A team adopts a 99.9 percent availability SLO over a rolling 30 days - about 43 minutes of allowed failure.',
        walkthrough: [
          'Week 1: a bad deploy causes 12 minutes of errors. That is 28 percent of the budget for one release, which makes the cost of skipping canary testing concrete rather than theoretical.',
          'Week 2: a dependency outage costs 8 minutes. Budget remaining: 23 of 43 minutes, a little over half, halfway through the window.',
          'Week 3: the team wants to ship a risky database migration. With 23 minutes left, they decide to do it behind a feature flag with a tested rollback - a decision driven by the number rather than by opinion.',
          'Week 4: 6 more minutes are spent, 26 in total. The window closes at 99.94 percent (26 of 43,200 minutes failed), inside target.',
          'Retrospective: 12 of the 26 minutes came from deploys without canaries. Automated canary analysis is prioritised, and the following window uses 9 minutes total.',
          'Effect on culture: the conversation moved from "was that outage acceptable?" to "we have 23 minutes left, what do we want to spend them on?", which is a question engineers and product managers can answer together.',
        ],
        result:
          'The budget turned reliability into a shared, quantified resource. The most valuable outcome was not the target itself but that risky changes and reliability work became comparable in the same unit.',
      },
    ],
    jargon: [
      { term: 'SLO', plain: 'The target for an SLI over a window, e.g. 99.9 percent over 30 days.' },
      { term: 'Error budget', plain: 'The permitted failure: 100 percent minus the target.' },
      { term: 'Burn rate', plain: 'How fast the budget is being consumed relative to the sustainable rate.' },
      { term: 'Rolling window', plain: 'A trailing period so the budget does not reset on a calendar boundary.' },
      { term: 'Budget policy', plain: 'The agreed rule for what happens when the budget is exhausted.' },
      { term: 'Overachievement', plain: 'Being far better than the target - unspent budget, and possibly wasted effort.' },
    ],
    remember: [
      'The error budget is the useful half of an SLO - it turns reliability into arithmetic.',
      'Set the target from measured performance and what users actually notice.',
      'Agree the exhausted-budget policy before you need it.',
      'Alert on burn rate, with a fast window that pages and a slow window that tickets.',
      'Being far better than the target is also a signal - unspent budget is unused velocity.',
    ],
  },

  sla: {
    analogy: {
      title: 'The warranty, with a refund clause',
      body:
        'The warranty is a contract: if the product fails to meet what was promised, you get money back. It is deliberately more forgiving than the internal quality targets of the manufacturer: the internal target is where they start worrying, and the warranty is where they start paying.',
    },
    deepDive: [
      {
        heading: 'SLI, SLO, SLA - three different audiences',
        paragraphs: [
          'The SLI is the measurement. The SLO is your internal target, chosen by engineering and product. The SLA is a contractual commitment to a customer, with financial or contractual consequences when it is missed. Same underlying number, three different purposes.',
          'The SLA must be looser than the SLO, always. If both are 99.9 percent, then the instant you breach your internal target you are also in breach of contract, with no buffer to react. A common shape is an SLO of 99.9 percent and an SLA of 99.5 percent: the internal budget of 43 minutes a month runs out long before the 216 minutes the contract allows, so the internal alarm goes off well before money is at stake.',
          'And not everything with an SLO needs an SLA. Internal services, free tiers and non-critical features usually have targets without contracts. SLAs appear where a customer is paying for a guarantee and has negotiated one - typically enterprise contracts.',
        ],
        code: {
          caption: 'The buffer, drawn',
          body: `SLA  99.5%   216 min a month, credits owed below   <- customer-facing
SLO  99.9%    43 min a month, alerting fires here   <- engineering
SLI  actual measured value, the same for both

the gap between SLO and SLA is your reaction time.
If they are equal, the first alert is also the first invoice credit.`,
        },
      },
      {
        heading: 'What the fine print actually says',
        paragraphs: [
          'Read any real SLA and most of its length is definitions and exclusions. Scheduled maintenance windows are excluded. Failures caused by the customer, by their network, or by third-party providers are excluded. Force majeure is excluded. Beta and preview features are excluded. Sometimes only "unavailability" of a narrowly defined core API counts, while degraded performance does not.',
          'Remedies are almost always service credits - a percentage of the monthly fee applied to a future invoice, in tiers (Amazon EC2 gives 10, 30 or 100 percent as availability falls) and capped at the fee itself. They rarely come close to the actual business cost of an outage, which is why an SLA is best understood as a commitment signal rather than as insurance.',
          'Many SLAs also require the customer to claim: in writing, with evidence, before a deadline (Amazon EC2 asks by the end of the second billing cycle after the incident). Credits are frequently not automatic, which means an unclaimed breach costs the provider nothing.',
        ],
        bullets: [
          'Measurement point and method - who measures, and where.',
          'Exclusions: maintenance, customer-caused, third party, beta features.',
          'Remedy: credit percentage tiers, and the cap.',
          'Claim process and deadline - often the customer must ask.',
          'What counts as downtime: total unavailability only, or degraded service too?',
        ],
      },
      {
        heading: 'Consuming other people SLAs',
        paragraphs: [
          'When you depend on a provider, their SLA is a ceiling on your own achievable reliability. If your database provider guarantees 99.95 percent and you depend on it synchronously for every request, you cannot credibly promise more than that without adding redundancy that does not share their failure mode.',
          'Compose the numbers honestly. Three dependencies at 99.9 percent, all required, give 99.7 percent before you have written a line of code. Either reduce the number of hard dependencies, add fallbacks so a failure degrades rather than fails, or set a target that reflects reality.',
          'Also remember that a provider SLA credit does not compensate you for your own losses. The mitigation is architectural - caching, fallbacks, a secondary provider for critical paths - not contractual. The contract tells you what they are willing to commit to; the design decides what you can survive.',
        ],
      },
    ],
    examples: [
      {
        title: 'Working out what an SLA is worth',
        setup:
          'A SaaS provider offers 99.5 percent, with a 10 percent service credit below that and 30 percent below 99 percent. A customer pays 5,000 euro per month. An outage lasts 6 hours.',
        walkthrough: [
          '99.5 percent of a 30-day month allows 216 minutes, 3 hours 36 minutes. A 6-hour outage is 360 minutes, roughly 99.17 percent availability - a clear breach.',
          '99.17 percent is below 99.5 but above 99, so the 10 percent tier applies: 500 euro, applied to the next invoice.',
          'Customer cost of the outage: 6 hours of their own operations stopped, staff idle, customers affected - realistically tens of thousands.',
          'So the credit covers roughly 2 percent of the impact. The SLA is not insurance; it is a statement of how seriously the provider takes availability.',
          'The customer must also file a claim with evidence before the deadline in the contract, or receive nothing at all.',
          'What the customer actually does with this: keeps a read-only cached fallback so the provider outage degrades their product rather than stopping it, and reduces the number of user journeys that depend on that provider synchronously.',
        ],
        result:
          'The credit was a rounding error against the real cost. Treat an SLA as information about what a provider is willing to commit to, and handle the risk architecturally - with caching, fallbacks and reduced hard dependencies.',
      },
    ],
    jargon: [
      { term: 'SLA', plain: 'A contractual availability commitment with consequences for missing it.' },
      { term: 'Service credit', plain: 'The usual remedy: a percentage of fees credited to a future invoice.' },
      { term: 'Exclusions', plain: 'What does not count: maintenance, customer-caused, third party, beta.' },
      { term: 'Claim window', plain: 'The period in which a customer must request credit, or forfeit it.' },
      { term: 'Composite availability', plain: 'The product of your dependencies availability. Your realistic ceiling.' },
      { term: 'Uptime vs degraded', plain: 'Many SLAs count only total unavailability, not slow or partial service.' },
    ],
    remember: [
      'SLI measures, SLO targets, SLA promises with consequences.',
      'The SLA must be looser than the SLO - that gap is your reaction time.',
      'Credits rarely approach the real cost of an outage; an SLA is a signal, not insurance.',
      'Exclusions and the claim process are most of what an SLA actually says.',
      'The SLAs of your dependencies set a ceiling on what you can honestly promise.',
    ],
  },
};
