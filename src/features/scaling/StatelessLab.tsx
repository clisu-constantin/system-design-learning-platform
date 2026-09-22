import { useCallback, useRef, useState } from 'react';
import { Power, RotateCw, UserCheck } from 'lucide-react';
import {
  ArchNode,
  DiagramCanvas,
  NodeStatRow,
  ParticleLegend,
  spread,
  type DiagramEdge,
  type Layout,
  type ParticleView,
} from '@/components/architecture';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, SegmentedControl, Slider } from '@/components/ui';
import { advanceParticles, nextParticleId, useEventLog, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import type { NodeStatus } from '@/types';

type Mode = 'local' | 'sticky' | 'shared' | 'jwt';

const MODES: { value: Mode; label: string }[] = [
  { value: 'local', label: 'Local sessions' },
  { value: 'sticky', label: 'Sticky sessions' },
  { value: 'shared', label: 'Shared store' },
  { value: 'jwt', label: 'Stateless JWT' },
];

const MODE_NOTE: Record<Mode, string> = {
  local:
    'Sessions live in the memory of whichever server handled the login. Round robin sends the next request somewhere else, and that server has never heard of this user.',
  sticky:
    'The load balancer pins each user to one server, so sessions are found - until that server dies and takes its users sessions with it. Load also becomes uneven.',
  shared:
    'Sessions live in Redis. Any server can serve any user, at the cost of one network hop per request and a new critical dependency.',
  jwt: 'The client carries a signed token. Every server verifies it locally - no lookup, no shared store. The trade is that revoking a token before it expires needs extra machinery.',
};

const USERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface ServerModel {
  id: string;
  name: string;
  status: NodeStatus;
  /** Session ids held in local memory (local and sticky modes only). */
  sessions: Set<string>;
  handled: number;
}

interface RequestRow {
  id: number;
  user: string;
  server: string;
  result: 'ok' | 'lost';
  detail: string;
}

interface State {
  servers: ServerModel[];
  redisUp: boolean;
  particles: Particle[];
  cursor: number;
  ok: number;
  lost: number;
  lookups: number;
  recent: RequestRow[];
}

const createState = (): State => ({
  servers: [0, 1, 2].map((index) => ({
    id: `s${index}`,
    name: `Server ${index + 1}`,
    status: 'healthy',
    sessions: new Set<string>(),
    handled: 0,
  })),
  redisUp: true,
  particles: [],
  cursor: 0,
  ok: 0,
  lost: 0,
  lookups: 0,
  recent: [],
});

const LAYOUT: Layout = {
  users: { x: 380, y: 14, w: 200, h: 58 },
  lb: { x: 380, y: 130, w: 200, h: 80 },
  s0: { x: 160, y: 260, w: 180, h: 118 },
  s1: { x: 390, y: 260, w: 180, h: 118 },
  s2: { x: 620, y: 260, w: 180, h: 118 },
  redis: { x: 390, y: 410, w: 180, h: 92 },
};

export function StatelessLab() {
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<Mode>('local');
  const [traffic, setTraffic] = useState(6);
  const state = useRef<State>(createState());
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();

  /** Clears the counters but keeps the servers and their sessions. */
  const resetStats = useCallback(() => {
    const current = state.current;
    current.ok = 0;
    current.lost = 0;
    current.lookups = 0;
    current.recent = [];
  }, []);

  const reset = useCallback(() => {
    state.current = createState();
    clear();
  }, [clear]);

  const login = useCallback(() => {
    const current = state.current;
    const healthy = current.servers.filter((server) => server.status === 'healthy');
    if (healthy.length === 0) return;
    for (const server of current.servers) server.sessions.clear();
    USERS.forEach((user, index) => {
      const server = healthy[index % healthy.length];
      server.sessions.add(user);
    });
    log('All users logged in - sessions created on the servers that handled the login', 'ok');
    rerender();
  }, [log, rerender]);

  const toggleServer = useCallback(
    (id: string) => {
      const server = state.current.servers.find((item) => item.id === id);
      if (!server) return;
      if (server.status === 'healthy') {
        server.status = 'down';
        if (server.sessions.size && (mode === 'local' || mode === 'sticky')) {
          log(`${server.name} down - ${server.sessions.size} in-memory session(s) lost`, 'danger');
        } else {
          log(`${server.name} down`, 'warn');
        }
        server.sessions.clear();
      } else {
        server.status = 'healthy';
        log(`${server.name} back in the pool`, 'ok');
      }
      rerender();
    },
    [log, mode, rerender],
  );

  useTicker(running, (dt) => {
    const current = state.current;
    const healthy = current.servers.filter((server) => server.status === 'healthy');
    const arrivals = sampleArrivals(traffic, dt);

    for (let index = 0; index < arrivals; index += 1) {
      const user = USERS[Math.floor(Math.random() * USERS.length)];

      if (healthy.length === 0) {
        // Every server is down: the request still arrives and still fails.
        current.lost += 1;
        current.recent.unshift({
          id: nextParticleId(),
          user,
          server: 'no server',
          result: 'lost',
          detail: 'NO HEALTHY SERVER - request failed',
        });
        current.recent = current.recent.slice(0, 8);
        current.particles.push({ id: nextParticleId(), route: ['users', 'lb'], leg: 0, t: 0, speed: 1.1, outcome: 'failure' });
        continue;
      }

      let server: ServerModel;
      if (mode === 'sticky') {
        // The load balancer keeps a user on the server that holds their session
        // (a cookie, in real life). Only users whose server is gone get re-pinned.
        server =
          healthy.find((item) => item.sessions.has(user)) ?? healthy[user.charCodeAt(0) % healthy.length];
      } else {
        current.cursor = (current.cursor + 1) % healthy.length;
        server = healthy[current.cursor];
      }

      let ok = true;
      let detail: string;
      const route: string[] = ['users', 'lb', server.id];

      if (mode === 'local') {
        ok = server.sessions.has(user);
        detail = ok ? 'session found in local memory' : 'SESSION NOT FOUND - user logged out';
        if (!ok) {
          // The user logs in again on this server. The new session cookie
          // replaces the old one, so the session on any other server is dead.
          for (const other of current.servers) other.sessions.delete(user);
          server.sessions.add(user);
        }
      } else if (mode === 'sticky') {
        if (!server.sessions.has(user)) {
          ok = false;
          server.sessions.add(user);
          detail = 'SESSION NOT FOUND - re-pinned here, user logs in again';
        } else {
          detail = 'sticky route found the session';
        }
      } else if (mode === 'shared') {
        route.push('redis');
        current.lookups += 1;
        ok = current.redisUp;
        detail = ok ? 'session loaded from Redis (+1 network hop)' : 'Redis unavailable - no session store';
      } else {
        detail = 'JWT verified locally, no session lookup';
      }

      if (ok) {
        current.ok += 1;
        server.handled += 1;
      } else {
        current.lost += 1;
      }

      current.recent.unshift({
        id: nextParticleId(),
        user,
        server: server.name,
        result: ok ? 'ok' : 'lost',
        detail,
      });
      current.recent = current.recent.slice(0, 8);

      current.particles.push({
        id: nextParticleId(),
        route,
        leg: 0,
        t: 0,
        speed: 1.1,
        outcome: ok ? (mode === 'shared' ? 'cache-hit' : 'success') : 'failure',
      });
    }

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.slice(-60);
    rerender();
  });

  const current = state.current;
  const showRedis = mode === 'shared';
  const total = current.ok + current.lost;
  const successRate = total ? current.ok / total : 1;
  const healthyCount = current.servers.filter((server) => server.status === 'healthy').length;

  const layout: Layout = { ...LAYOUT };
  const serverXs = spread(3, 480, 180, 50);
  current.servers.forEach((server, index) => {
    layout[server.id] = { x: serverXs[index], y: 260, w: 180, h: 118 };
  });

  const edges: DiagramEdge[] = [
    { from: 'users', to: 'lb', tone: 'brand', width: 2 },
    ...current.servers.map<DiagramEdge>((server) => ({
      from: 'lb',
      to: server.id,
      tone: server.status === 'healthy' ? 'ok' : 'muted',
      dashed: server.status !== 'healthy',
      label:
        mode === 'sticky' && server.status === 'healthy'
          ? [...server.sessions].slice(0, 3).join(',') || undefined
          : undefined,
    })),
    ...(showRedis
      ? current.servers.map<DiagramEdge>((server) => ({
          from: server.id,
          to: 'redis',
          tone: current.redisUp ? 'danger' : 'muted',
          dashed: !current.redisUp,
        }))
      : []),
  ];

  const particleViews: ParticleView[] = current.particles.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  return (
    <LabShell
      title="Stateless vs Stateful Lab"
      description="Six users, three servers, one load balancer. Switch session strategy and watch which requests survive a round-robin hop or a dead server."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['success', 'cache-hit', 'failure']} />}
      events={events}
      actions={
        <Button onClick={login}>
          <UserCheck className="h-4 w-4" />
          Log all users in
        </Button>
      }
      insight={<Insight title={MODES.find((item) => item.value === mode)?.label}>{MODE_NOTE[mode]}</Insight>}
      metrics={
        <>
          <MetricsPanel
            items={[
              {
                key: 'ok',
                label: 'Successful',
                value: formatPercent(successRate, 1),
                tone: successRate > 0.98 ? 'ok' : successRate > 0.8 ? 'warn' : 'danger',
                hint: 'Requests that found a valid session.',
              },
              {
                key: 'lost',
                label: 'Lost / failed',
                value: formatNumber(current.lost),
                tone: current.lost > 0 ? 'danger' : 'ok',
                hint: 'Requests that landed on a server without the session, found no session store, or found no server up at all.',
              },
              {
                key: 'lookups',
                label: 'Store lookups',
                value: formatNumber(current.lookups),
                hint: 'Round trips to the shared session store.',
              },
              {
                key: 'latency',
                label: 'Extra latency',
                value: mode === 'shared' ? formatLatency(2.5) : formatLatency(0),
                hint: 'Additional per-request cost of the session strategy. An illustrative figure, not measured.',
              },
              { key: 'instances', label: 'Healthy servers', value: `${healthyCount}/3` },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Recent requests</p>
            <div className="space-y-1 font-mono text-[11px]">
              {current.recent.length === 0 ? (
                <p className="text-faint">Run the simulation to see individual requests.</p>
              ) : (
                current.recent.map((row) => (
                  <p
                    key={row.id}
                    className={row.result === 'ok' ? 'text-muted' : 'text-danger'}
                  >
                    <span className="text-faint">user {row.user}</span> {'->'} {row.server}{' '}
                    <span className="text-faint">{row.detail}</span>
                  </p>
                ))
              )}
            </div>
          </div>
        </>
      }
      controls={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Session strategy</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setMode(item.value);
                    // Each strategy is its own experiment. Without this the
                    // success rate keeps averaging in the sessions the previous
                    // strategy lost, so switching to JWT looked broken too.
                    resetStats();
                    log(`Strategy: ${item.label}`, 'info');
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                    mode === item.value
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line text-muted hover:border-brand/50 hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Traffic"
            value={traffic}
            min={1}
            max={30}
            onChange={setTraffic}
            format={(value) => `${value} req/sec`}
            hint="Kept low so individual requests stay visible."
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Failure injection</p>
            {current.servers.map((server) => (
              <Button
                key={server.id}
                size="sm"
                variant={server.status === 'down' ? 'success' : 'danger'}
                className="w-full justify-center"
                onClick={() => toggleServer(server.id)}
              >
                {server.status === 'down' ? <RotateCw className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                {server.status === 'down' ? `Restart ${server.name}` : `Kill ${server.name}`}
              </Button>
            ))}
            {showRedis ? (
              <Button
                size="sm"
                variant={current.redisUp ? 'danger' : 'success'}
                className="w-full justify-center"
                onClick={() => {
                  current.redisUp = !current.redisUp;
                  log(
                    current.redisUp ? 'Redis recovered' : 'Redis down - every request loses its session',
                    current.redisUp ? 'ok' : 'danger',
                  );
                  rerender();
                }}
              >
                {current.redisUp ? 'Kill Redis' : 'Restart Redis'}
              </Button>
            ) : null}
          </div>
          <SegmentedControl
            size="sm"
            value={running ? 'run' : 'pause'}
            options={[
              { value: 'run', label: 'Running' },
              { value: 'pause', label: 'Paused' },
            ]}
            onChange={(value) => setRunning(value === 'run')}
          />
        </>
      }
    >
      <DiagramCanvas layout={layout} edges={edges} particles={particleViews} height={510} className="bg-canvas">
        <ArchNode
          kind="client"
          title={`${USERS.length} users`}
          subtitle={`${traffic} req/sec`}
          placed={layout.users}
          compact
        />
        <ArchNode
          kind="load-balancer"
          title="Load Balancer"
          subtitle={mode === 'sticky' ? 'sticky by user, 2 nodes' : 'round robin, 2 nodes'}
          placed={layout.lb}
          compact
        />
        {current.servers.map((server) => (
          <ArchNode
            key={server.id}
            kind="server"
            title={server.name}
            placed={layout[server.id]}
            status={server.status}
          >
            <NodeStatRow
              label="Local sessions"
              value={mode === 'local' || mode === 'sticky' ? [...server.sessions].join(' ') || 'none' : 'none'}
              tone={mode === 'local' || mode === 'sticky' ? 'text-warn' : 'text-ok'}
            />
            <NodeStatRow label="Handled" value={formatNumber(server.handled)} />
          </ArchNode>
        ))}
        {showRedis ? (
          <ArchNode
            kind="cache"
            title="Redis"
            subtitle="shared session store"
            placed={layout.redis}
            status={current.redisUp ? 'healthy' : 'down'}
            compact
          >
            <NodeStatRow label="Sessions" value={USERS.length} />
          </ArchNode>
        ) : null}
      </DiagramCanvas>
    </LabShell>
  );
}

export default StatelessLab;
