import type { VisualSpec } from '@/components/architecture/FlowVisual';

/** Getting started, plus the remaining quality-attribute concepts. */
export const foundationVisuals: Record<string, VisualSpec> = {
  'what-is-system-design': {
    width: 800,
    height: 300,
    caption: 'Find the bottleneck, remove it with one component, name the cost it added. Repeat.',
    nodes: [
      { id: 'req', kind: 'client', label: 'Requirements', x: 30, y: 110, w: 160, h: 78 },
      { id: 'simple', kind: 'server', label: 'Simplest design', x: 240, y: 30, w: 180, h: 78 },
      { id: 'bottleneck', kind: 'sql', label: 'Bottleneck', sub: 'measured', x: 240, y: 190, w: 180, h: 80, alert: true },
      { id: 'fix', kind: 'cache', label: 'One component', x: 470, y: 110, w: 170, h: 78 },
      { id: 'cost', kind: 'monitoring', label: 'New cost', x: 668, y: 110, w: 118, h: 78 },
    ],
    edges: [
      { from: 'req', to: 'simple', tone: 'brand', rate: 1.6 },
      { from: 'simple', to: 'bottleneck', tone: 'warn', rate: 1.6, outcome: 'warning' },
      { from: 'bottleneck', to: 'fix', tone: 'ok', rate: 1.6 },
      { from: 'fix', to: 'cost', tone: 'violet', rate: 1.6, outcome: 'warning' },
    ],
    steps: [
      { from: 'req', to: 'simple', label: 'Start from requirements' },
      { from: 'simple', to: 'bottleneck', label: 'Run it, find the limit', outcome: 'warning' },
      { from: 'bottleneck', to: 'fix', label: 'Add one component' },
      { from: 'fix', to: 'cost', label: 'Name what it cost', outcome: 'warning' },
    ],
  },

  'functional-requirements': {
    width: 760,
    height: 309,
    caption: 'Each feature you keep pulls a component into the diagram.',
    nodes: [
      { id: 'send', kind: 'client', label: 'Send a message', x: 30, y: 25, w: 180, h: 72 },
      { id: 'live', kind: 'client', label: 'Receive live', x: 30, y: 115, w: 180, h: 72 },
      { id: 'video', kind: 'client', label: 'Video calls', sub: 'out of scope', x: 30, y: 205, w: 180, h: 80, status: 'down' },
      { id: 'store', kind: 'sql', label: 'Message store', x: 330, y: 25, w: 180, h: 76 },
      { id: 'ws', kind: 'service', label: 'WebSocket gateway', x: 330, y: 125, w: 200, h: 76 },
      { id: 'media', kind: 'storage', label: 'Media servers', sub: 'not built', x: 330, y: 215, w: 180, h: 80, status: 'down' },
      { id: 'sys', kind: 'server', label: 'System', x: 610, y: 105, w: 120, h: 80 },
    ],
    edges: [
      { from: 'send', to: 'store', tone: 'ok', rate: 1.6 },
      { from: 'live', to: 'ws', tone: 'ok', rate: 1.6 },
      { from: 'video', to: 'media', tone: 'muted', dashed: true },
      { from: 'store', to: 'sys', tone: 'brand', rate: 1.4 },
      { from: 'ws', to: 'sys', tone: 'brand', rate: 1.4 },
    ],
    steps: [
      { from: 'send', to: 'store', label: 'Sending needs a message store' },
      { from: 'store', to: 'sys', label: 'Store joins the system' },
      { from: 'live', to: 'ws', label: 'Live delivery needs WebSockets' },
      { from: 'ws', to: 'sys', label: 'Gateway joins the system' },
      { from: 'video', to: 'media', label: 'Video cut: nothing gets built', outcome: 'failure' },
    ],
  },

  'non-functional-requirements': {
    width: 760,
    height: 300,
    caption: '99.99% is not a setting - it is redundancy, failover and multi-zone deployment.',
    nodes: [
      { id: 'target', kind: 'client', label: '99.99% availability', x: 30, y: 110, w: 190, h: 82 },
      { id: 'redundancy', kind: 'server', label: 'Redundant instances', x: 300, y: 15, w: 200, h: 74 },
      { id: 'zones', kind: 'cdn', label: 'Multi-zone', x: 300, y: 105, w: 200, h: 74 },
      { id: 'failover', kind: 'sql', label: 'Automated failover', x: 300, y: 195, w: 200, h: 74 },
      { id: 'cost', kind: 'monitoring', label: 'Cost 2-3x', x: 580, y: 105, w: 150, h: 80, alert: true },
    ],
    edges: [
      { from: 'target', to: 'redundancy', tone: 'ok', rate: 1.4 },
      { from: 'target', to: 'zones', tone: 'ok', rate: 1.4 },
      { from: 'target', to: 'failover', tone: 'ok', rate: 1.4 },
      { from: 'redundancy', to: 'cost', tone: 'warn', rate: 1, outcome: 'warning' },
      { from: 'zones', to: 'cost', tone: 'warn', rate: 1, outcome: 'warning' },
    ],
    steps: [
      { from: 'target', to: 'redundancy', label: 'No single instance may matter' },
      { from: 'target', to: 'zones', label: 'Survive losing a whole zone' },
      { from: 'target', to: 'failover', label: 'Recover without waking a human' },
      { from: 'redundancy', to: 'cost', label: 'Every extra copy is billed', outcome: 'warning' },
      { from: 'zones', to: 'cost', label: 'Cross-zone traffic is billed too', outcome: 'warning' },
    ],
  },

  'capacity-estimation': {
    width: 786,
    height: 280,
    caption: '10M DAU x 20 requests = 200M/day = ~2,300 req/sec average, ~11,500 at peak.',
    nodes: [
      { id: 'dau', kind: 'client', label: '10M DAU', x: 30, y: 100, w: 150, h: 78 },
      { id: 'day', kind: 'server', label: '200M req/day', x: 220, y: 100, w: 170, h: 78 },
      { id: 'avg', kind: 'server', label: '2,315 req/sec', sub: 'average', x: 430, y: 25, w: 170, h: 80 },
      { id: 'peak', kind: 'server', label: '11,575 req/sec', sub: 'peak x5', x: 430, y: 175, w: 170, h: 80, alert: true },
      { id: 'fleet', kind: 'load-balancer', label: '~18 servers', x: 632, y: 100, w: 140, h: 78 },
    ],
    edges: [
      { from: 'dau', to: 'day', tone: 'brand', rate: 2 },
      { from: 'day', to: 'avg', tone: 'ok', rate: 2 },
      { from: 'day', to: 'peak', tone: 'warn', rate: 2, outcome: 'warning' },
      { from: 'peak', to: 'fleet', tone: 'brand', rate: 2 },
    ],
    steps: [
      { from: 'dau', to: 'day', label: 'Users times actions' },
      { from: 'day', to: 'avg', label: 'Divide by 86,400' },
      { from: 'day', to: 'peak', label: 'Multiply by peak factor', outcome: 'warning' },
      { from: 'peak', to: 'fleet', label: 'Size the fleet for peak' },
    ],
  },

  'back-of-the-envelope': {
    width: 760,
    height: 280,
    caption: 'Memory is ~100 ns, SSD ~100 us, a datacenter round trip ~500 us, cross-Atlantic ~150 ms.',
    nodes: [
      { id: 'mem', kind: 'cache', label: 'Memory', sub: '100 ns', x: 30, y: 100, w: 150, h: 80 },
      { id: 'ssd', kind: 'storage', label: 'SSD read', sub: '100 us', x: 215, y: 100, w: 150, h: 80 },
      { id: 'dc', kind: 'server', label: 'Datacenter RTT', sub: '500 us', x: 400, y: 100, w: 170, h: 80 },
      { id: 'ocean', kind: 'cdn', label: 'Cross-Atlantic', sub: '150 ms', x: 590, y: 100, w: 150, h: 80, alert: true },
    ],
    edges: [
      { from: 'mem', to: 'ssd', tone: 'ok', rate: 3 },
      { from: 'ssd', to: 'dc', tone: 'warn', rate: 2, outcome: 'warning' },
      { from: 'dc', to: 'ocean', tone: 'danger', rate: 1, outcome: 'failure' },
    ],
    steps: [
      { from: 'mem', to: 'ssd', label: 'SSD: 1,000x slower than memory' },
      { from: 'ssd', to: 'dc', label: 'Network hop: 5x an SSD', outcome: 'warning' },
      { from: 'dc', to: 'ocean', label: 'Ocean trip: 300x a datacenter', outcome: 'warning' },
    ],
  },

  // ---- Quality attributes -------------------------------------------------
  availability: {
    width: 760,
    height: 280,
    caption: 'Dependencies in series multiply: three 99.9% components give about 99.7%.',
    nodes: [
      { id: 'lb', kind: 'load-balancer', label: 'LB', sub: '99.99%', x: 40, y: 100, w: 140, h: 80 },
      { id: 'api', kind: 'server', label: 'API', sub: '99.9%', x: 230, y: 100, w: 140, h: 80 },
      { id: 'db', kind: 'sql', label: 'Database', sub: '99.9%', x: 420, y: 100, w: 150, h: 80 },
      { id: 'total', kind: 'monitoring', label: '~99.79%', sub: '18 h/year down', x: 610, y: 100, w: 130, h: 80, alert: true },
    ],
    edges: [
      { from: 'lb', to: 'api', tone: 'ok', rate: 2.4 },
      { from: 'api', to: 'db', tone: 'ok', rate: 2.4 },
      { from: 'db', to: 'total', tone: 'warn', rate: 2, outcome: 'warning' },
    ],
    steps: [
      { from: 'lb', to: 'api', label: 'LB hands the request on' },
      { from: 'api', to: 'db', label: 'API cannot answer without DB' },
      { from: 'db', to: 'total', label: 'Multiply: 99.79%, 18 h down', outcome: 'warning' },
    ],
  },

  consistency: {
    width: 760,
    height: 290,
    caption: 'Same write, three contracts about what a reader may see next.',
    nodes: [
      { id: 'write', kind: 'client', label: 'write(x = 2)', x: 40, y: 105, w: 160, h: 78 },
      { id: 'lin', kind: 'sql', label: 'Linearizable', sub: 'everyone sees 2', x: 300, y: 15, w: 190, h: 80 },
      { id: 'ryw', kind: 'sql', label: 'Read-your-writes', sub: 'the writer sees 2', x: 300, y: 105, w: 190, h: 80 },
      { id: 'eventual', kind: 'nosql', label: 'Eventual', sub: 'someone still sees 1', x: 300, y: 195, w: 190, h: 80, alert: true },
      { id: 'reader', kind: 'client', label: 'Reader', x: 580, y: 105, w: 150, h: 78 },
    ],
    edges: [
      { from: 'write', to: 'lin', tone: 'ok', rate: 1.6 },
      { from: 'write', to: 'ryw', tone: 'ok', rate: 1.6 },
      { from: 'write', to: 'eventual', tone: 'warn', rate: 1.6, outcome: 'warning' },
      { from: 'lin', to: 'reader', tone: 'ok', rate: 1.4 },
      { from: 'eventual', to: 'reader', tone: 'warn', rate: 1.4, outcome: 'warning' },
    ],
    steps: [
      { from: 'write', to: 'lin', label: 'Write to a linearizable store' },
      { from: 'lin', to: 'reader', label: 'Every reader now sees 2' },
      { from: 'write', to: 'ryw', label: 'Same write, read-your-writes store' },
      { from: 'ryw', to: 'write', label: 'Only the writer must see 2' },
      { from: 'write', to: 'eventual', label: 'Same write, eventual store' },
      { from: 'eventual', to: 'reader', label: 'Another reader still sees 1', outcome: 'warning' },
    ],
  },

  'partition-tolerance': {
    width: 760,
    height: 306,
    caption: 'Only the majority side may accept writes, so two halves cannot both be in charge.',
    nodes: [
      { id: 'a', kind: 'sql', label: 'Node A', x: 40, y: 30, w: 140, h: 72 },
      { id: 'b', kind: 'sql', label: 'Node B', x: 40, y: 125, w: 140, h: 72 },
      { id: 'c', kind: 'sql', label: 'Node C', x: 40, y: 220, w: 140, h: 72 },
      { id: 'quorum', kind: 'api-gateway', label: 'Majority {A,B,C}', sub: 'accepts writes', x: 300, y: 70, w: 200, h: 84 },
      { id: 'd', kind: 'sql', label: 'Node D', sub: 'read-only', x: 600, y: 60, w: 140, h: 80, status: 'degraded' },
      { id: 'e', kind: 'sql', label: 'Node E', sub: 'read-only', x: 600, y: 160, w: 140, h: 80, status: 'degraded' },
    ],
    edges: [
      { from: 'a', to: 'quorum', tone: 'ok', rate: 1.6 },
      { from: 'b', to: 'quorum', tone: 'ok', rate: 1.6 },
      { from: 'c', to: 'quorum', tone: 'ok', rate: 1.6 },
      { from: 'quorum', to: 'd', tone: 'danger', dashed: true, label: 'X partition X' },
      { from: 'quorum', to: 'e', tone: 'danger', dashed: true },
    ],
    steps: [
      { from: 'a', to: 'quorum', label: 'Node A: one of five' },
      { from: 'b', to: 'quorum', label: 'Node B: two of five' },
      { from: 'c', to: 'quorum', label: 'Node C: majority, writes allowed' },
      { from: 'quorum', to: 'd', label: 'Partition cuts off Node D', outcome: 'failure' },
      { from: 'quorum', to: 'e', label: 'D and E: minority, read-only', outcome: 'failure' },
    ],
  },

  sli: {
    width: 760,
    height: 260,
    caption: 'SLI = good events / valid events, measured as close to the user as possible.',
    nodes: [
      { id: 'reqs', kind: 'client', label: 'All requests', x: 40, y: 90, w: 160, h: 78 },
      { id: 'good', kind: 'monitoring', label: 'Under 300 ms, non-5xx', x: 290, y: 20, w: 220, h: 76 },
      { id: 'bad', kind: 'client', label: 'Slow or failed', x: 290, y: 165, w: 220, h: 72 },
      { id: 'sli', kind: 'monitoring', label: 'SLI 99.93%', x: 590, y: 90, w: 150, h: 78 },
    ],
    edges: [
      { from: 'reqs', to: 'good', tone: 'ok', rate: 4 },
      { from: 'reqs', to: 'bad', tone: 'danger', rate: 0.4, outcome: 'failure' },
      { from: 'good', to: 'sli', tone: 'brand', rate: 2.4 },
    ],
    steps: [
      { from: 'reqs', to: 'good', label: 'Fast and non-5xx: good event' },
      { from: 'reqs', to: 'bad', label: 'Slow or 5xx: bad event', outcome: 'failure' },
      { from: 'good', to: 'sli', label: 'Good over valid: 99.93%' },
    ],
  },

  slo: {
    width: 760,
    height: 260,
    caption: '99.9% over 30 days is an error budget of 43 minutes - a number you can spend.',
    nodes: [
      { id: 'sli', kind: 'monitoring', label: 'SLI', x: 40, y: 90, w: 140, h: 78 },
      { id: 'slo', kind: 'server', label: 'SLO 99.9%', sub: '30 days', x: 240, y: 85, w: 170, h: 84 },
      { id: 'budget', kind: 'queue', label: 'Error budget', sub: '43 minutes', x: 470, y: 20, w: 180, h: 80 },
      { id: 'freeze', kind: 'client', label: 'Budget spent', sub: 'reliability first', x: 470, y: 165, w: 180, h: 80, alert: true },
    ],
    edges: [
      { from: 'sli', to: 'slo', tone: 'brand', rate: 2 },
      { from: 'slo', to: 'budget', tone: 'ok', rate: 2 },
      { from: 'budget', to: 'freeze', tone: 'danger', rate: 1, outcome: 'failure' },
    ],
    steps: [
      { from: 'sli', to: 'slo', label: 'Measure against 99.9% target' },
      { from: 'slo', to: 'budget', label: '0.1% of 30 days: 43 min' },
      { from: 'budget', to: 'freeze', label: 'Budget spent: freeze risky changes', outcome: 'failure' },
    ],
  },

  sla: {
    width: 760,
    height: 250,
    caption: 'Keep the SLA below the SLO, so you see trouble before a customer can claim.',
    nodes: [
      { id: 'sli', kind: 'monitoring', label: 'SLI', sub: 'measurement', x: 60, y: 85, w: 150, h: 80 },
      { id: 'slo', kind: 'server', label: 'SLO 99.9%', sub: 'internal target', x: 300, y: 85, w: 170, h: 80 },
      { id: 'sla', kind: 'client', label: 'SLA 99.5%', sub: 'contract + credits', x: 560, y: 85, w: 180, h: 80 },
    ],
    edges: [
      { from: 'sli', to: 'slo', tone: 'brand', rate: 2 },
      { from: 'slo', to: 'sla', tone: 'ok', rate: 2 },
    ],
    steps: [
      { from: 'sli', to: 'slo', label: 'Alerts fire below 99.9%' },
      { from: 'slo', to: 'sla', label: 'Credits owed only below 99.5%' },
    ],
  },

  alerting: {
    width: 760,
    height: 270,
    caption: 'Fast burn pages a human; slow burn opens a ticket. Everything else is noise.',
    nodes: [
      { id: 'signal', kind: 'monitoring', label: 'Burn rate', x: 40, y: 95, w: 160, h: 80 },
      { id: 'page', kind: 'client', label: 'Page on-call', sub: '14x burn', x: 300, y: 20, w: 180, h: 80 },
      { id: 'ticket', kind: 'storage', label: 'Ticket', sub: '2x burn', x: 300, y: 170, w: 180, h: 80 },
      { id: 'runbook', kind: 'search', label: 'Runbook', x: 570, y: 95, w: 160, h: 78 },
    ],
    edges: [
      { from: 'signal', to: 'page', tone: 'danger', rate: 1.2, outcome: 'failure' },
      { from: 'signal', to: 'ticket', tone: 'warn', rate: 1.6, outcome: 'warning' },
      { from: 'page', to: 'runbook', tone: 'ok', rate: 1.2 },
    ],
    steps: [
      { from: 'signal', to: 'page', label: 'Burn 14x: gone in 2 hours', outcome: 'failure' },
      { from: 'page', to: 'runbook', label: 'On-call opens the runbook' },
      { from: 'signal', to: 'ticket', label: 'Burn 2x: a ticket, no page', outcome: 'warning' },
    ],
  },

  'event-driven-architecture-arch': {
    width: 760,
    height: 290,
    caption: 'Choreography spreads the workflow; orchestration keeps it in one place.',
    nodes: [
      { id: 'event', kind: 'queue', label: 'OrderPlaced', x: 40, y: 30, w: 170, h: 74 },
      { id: 'a', kind: 'service', label: 'Payment reacts', x: 300, y: 15, w: 180, h: 72 },
      { id: 'b', kind: 'service', label: 'Shipping reacts', x: 300, y: 100, w: 180, h: 72 },
      { id: 'orch', kind: 'api-gateway', label: 'Workflow service', sub: 'explicit steps', x: 300, y: 195, w: 180, h: 80 },
      { id: 'result', kind: 'client', label: 'Order completed', x: 570, y: 100, w: 170, h: 80 },
    ],
    edges: [
      { from: 'event', to: 'a', tone: 'ok', rate: 1.6 },
      { from: 'event', to: 'b', tone: 'ok', rate: 1.6 },
      { from: 'orch', to: 'result', tone: 'brand', rate: 1.6 },
      { from: 'a', to: 'result', tone: 'muted', rate: 1.2, dashed: true },
      { from: 'b', to: 'result', tone: 'muted', rate: 1.2, dashed: true },
    ],
    steps: [
      { from: 'event', to: 'a', label: 'Payment reacts to OrderPlaced' },
      { from: 'event', to: 'b', label: 'Shipping reacts on its own' },
      { from: 'a', to: 'result', label: 'Payment finishes its part' },
      { from: 'b', to: 'result', label: 'Done, but no one owns it', outcome: 'warning' },
      { from: 'orch', to: 'result', label: 'Orchestration: one service runs it' },
    ],
  },
};
