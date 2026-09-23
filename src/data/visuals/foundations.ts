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
      { from: 'video', to: 'media', label: 'Video cut: nothing gets built', skipped: true },
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
      { from: 'write', to: 'eventual', tone: 'ok', rate: 1.6 },
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
    height: 330,
    caption: 'Only the side holding a majority may accept writes; the cut-off minority refuses them.',
    nodes: [
      { id: 'client', kind: 'client', label: 'Client', x: 30, y: 128, w: 130, h: 74 },
      { id: 'a', kind: 'sql', label: 'Node A', sub: 'leader', x: 240, y: 123, w: 150, h: 84 },
      { id: 'b', kind: 'sql', label: 'Node B', sub: 'majority side', x: 550, y: 4, w: 180, h: 74 },
      { id: 'c', kind: 'sql', label: 'Node C', sub: 'majority side', x: 550, y: 86, w: 180, h: 74 },
      { id: 'd', kind: 'sql', label: 'Node D', sub: 'minority: no writes', x: 550, y: 168, w: 180, h: 74, status: 'degraded' },
      { id: 'e', kind: 'sql', label: 'Node E', sub: 'minority: no writes', x: 550, y: 250, w: 180, h: 74, status: 'degraded' },
    ],
    edges: [
      { from: 'client', to: 'a', tone: 'brand', rate: 1.6 },
      { from: 'a', to: 'b', tone: 'ok', rate: 1.6 },
      { from: 'a', to: 'c', tone: 'ok', rate: 1.6 },
      { from: 'a', to: 'd', tone: 'danger', dashed: true, label: 'X partition X' },
      { from: 'a', to: 'e', tone: 'danger', dashed: true },
    ],
    steps: [
      { from: 'client', to: 'a', label: 'Write reaches leader Node A' },
      { from: 'a', to: 'b', label: 'Stored on B: two of five' },
      { from: 'a', to: 'c', label: 'Stored on C: three, a majority' },
      { from: 'a', to: 'd', label: 'Partition: D never receives it', outcome: 'failure' },
      { from: 'a', to: 'e', label: 'E cut off too: minority', outcome: 'failure' },
      { from: 'a', to: 'client', label: 'Three of five: write acknowledged' },
    ],
  },

  sli: {
    width: 760,
    height: 260,
    caption: 'SLI = good events / valid events, measured as close to the user as possible.',
    nodes: [
      { id: 'reqs', kind: 'client', label: 'Valid requests', sub: 'health checks excluded', x: 40, y: 88, w: 180, h: 84 },
      { id: 'good', kind: 'monitoring', label: 'Good: non-5xx', sub: 'and under 300 ms', x: 300, y: 20, w: 210, h: 80 },
      { id: 'bad', kind: 'client', label: 'Bad: slow or 5xx', x: 300, y: 165, w: 210, h: 76 },
      { id: 'sli', kind: 'monitoring', label: 'SLI 99.93%', sub: 'good / valid', x: 590, y: 88, w: 150, h: 84 },
    ],
    edges: [
      { from: 'reqs', to: 'good', tone: 'ok', rate: 4 },
      { from: 'reqs', to: 'bad', tone: 'danger', rate: 0.4, outcome: 'failure' },
      { from: 'good', to: 'sli', tone: 'brand', rate: 2.4 },
      { from: 'bad', to: 'sli', tone: 'danger', rate: 0.3, outcome: 'failure' },
    ],
    steps: [
      { from: 'reqs', to: 'good', label: 'Fast and non-5xx: good event' },
      { from: 'reqs', to: 'bad', label: 'Slow or 5xx: bad event', outcome: 'failure' },
      { from: 'bad', to: 'sli', label: 'Bad events still count as valid', outcome: 'failure' },
      { from: 'good', to: 'sli', label: 'Good over valid: 99.93%' },
    ],
  },

  slo: {
    width: 760,
    height: 260,
    caption: '99.9% over 30 days is an error budget of 43 minutes - a number you can spend.',
    nodes: [
      { id: 'sli', kind: 'monitoring', label: 'SLI', sub: 'measured', x: 20, y: 88, w: 130, h: 84 },
      { id: 'slo', kind: 'server', label: 'SLO 99.9%', sub: '30 days', x: 190, y: 88, w: 150, h: 84 },
      { id: 'budget', kind: 'queue', label: 'Error budget', sub: '43 minutes', x: 380, y: 88, w: 170, h: 84 },
      { id: 'ship', kind: 'client', label: 'Budget left', sub: 'ship risky changes', x: 590, y: 20, w: 160, h: 80 },
      { id: 'freeze', kind: 'client', label: 'Budget spent', sub: 'reliability first', x: 590, y: 165, w: 160, h: 80, alert: true },
    ],
    edges: [
      { from: 'sli', to: 'slo', tone: 'brand', rate: 2 },
      { from: 'slo', to: 'budget', tone: 'ok', rate: 2 },
      { from: 'budget', to: 'ship', tone: 'ok', rate: 1.4 },
      { from: 'budget', to: 'freeze', tone: 'danger', rate: 0.6, outcome: 'failure' },
    ],
    steps: [
      { from: 'sli', to: 'slo', label: 'Measure against 99.9% target' },
      { from: 'slo', to: 'budget', label: '0.1% of 30 days: 43 min' },
      { from: 'budget', to: 'ship', label: 'Budget left: ship and experiment' },
      { from: 'budget', to: 'freeze', label: 'Budget spent: freeze risky changes', outcome: 'failure' },
    ],
  },

  sla: {
    width: 760,
    height: 250,
    caption: 'Keep the SLA below the SLO, so you see trouble before a customer can claim.',
    nodes: [
      { id: 'sli', kind: 'monitoring', label: 'SLI', sub: 'one measurement', x: 30, y: 85, w: 150, h: 80 },
      { id: 'slo', kind: 'server', label: 'SLO 99.9%', sub: 'internal, 43 min', x: 290, y: 20, w: 180, h: 80 },
      { id: 'sla', kind: 'api-gateway', label: 'SLA 99.5%', sub: 'contract, 216 min', x: 290, y: 150, w: 180, h: 80 },
      { id: 'oncall', kind: 'client', label: 'On-call', sub: 'burn-rate page', x: 570, y: 20, w: 170, h: 80 },
      { id: 'credits', kind: 'client', label: 'Credits', sub: '10% of monthly fee', x: 570, y: 150, w: 170, h: 80 },
    ],
    edges: [
      { from: 'sli', to: 'slo', tone: 'brand', rate: 2 },
      { from: 'sli', to: 'sla', tone: 'violet', rate: 2 },
      { from: 'slo', to: 'oncall', tone: 'warn', rate: 0.8, outcome: 'warning' },
      { from: 'sla', to: 'credits', tone: 'danger', rate: 0.4, outcome: 'failure' },
    ],
    steps: [
      { from: 'sli', to: 'slo', label: 'Internal target: 99.9%' },
      { from: 'slo', to: 'oncall', label: 'Budget burning fast: page on-call', outcome: 'warning' },
      { from: 'sli', to: 'sla', label: 'Same SLI, judged monthly' },
      { from: 'sla', to: 'credits', label: 'Below 99.5%: credits owed', outcome: 'failure' },
    ],
  },

  alerting: {
    width: 760,
    height: 270,
    caption: 'Fast burn pages a human; slow burn opens a ticket. Everything else is noise.',
    nodes: [
      { id: 'signal', kind: 'monitoring', label: 'Burn rate', x: 40, y: 95, w: 160, h: 80 },
      { id: 'page', kind: 'client', label: 'Page on-call', sub: '14.4x burn', x: 300, y: 20, w: 180, h: 80 },
      { id: 'ticket', kind: 'storage', label: 'Ticket', sub: '1x burn', x: 300, y: 170, w: 180, h: 80 },
      { id: 'runbook', kind: 'search', label: 'Runbook', x: 570, y: 95, w: 160, h: 78 },
    ],
    edges: [
      { from: 'signal', to: 'page', tone: 'danger', rate: 1.2, outcome: 'failure' },
      { from: 'signal', to: 'ticket', tone: 'warn', rate: 1.6, outcome: 'warning' },
      { from: 'page', to: 'runbook', tone: 'ok', rate: 1.2 },
    ],
    steps: [
      { from: 'signal', to: 'page', label: 'Burn 14.4x: gone in 2 days', outcome: 'failure' },
      { from: 'page', to: 'runbook', label: 'On-call opens the runbook' },
      { from: 'signal', to: 'ticket', label: 'Burn 1x: a ticket, no page', outcome: 'warning' },
    ],
  },
};
