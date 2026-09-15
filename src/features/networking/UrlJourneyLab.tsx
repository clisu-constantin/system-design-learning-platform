import { useCallback, useRef, useState } from 'react';
import { ChevronRight, Globe } from 'lucide-react';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Badge, Button, Toggle } from '@/components/ui';
import { useTicker } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { cn } from '@/utils/cn';
import { formatLatency } from '@/utils/format';

interface Stage {
  id: string;
  title: string;
  short: string;
  detail: string;
  /** Latency on a cold connection, and when everything is warm/cached. */
  coldMs: number;
  warmMs: number;
  concept?: string;
}

const STAGES: Stage[] = [
  {
    id: 'browser',
    title: 'Browser processing',
    short: 'URL parsed, caches checked',
    detail:
      'The browser parses the URL, checks its own HTTP cache, HSTS list and service worker. A cached response can end the journey right here - the fastest request is the one never sent.',
    coldMs: 2,
    warmMs: 1,
  },
  {
    id: 'dns',
    title: 'DNS resolution',
    short: 'hostname -> IP address',
    detail:
      'Browser cache, then OS cache, then the recursive resolver. On a miss the resolver walks root -> .com -> authoritative nameserver. The answer is cached everywhere for the record TTL.',
    coldMs: 60,
    warmMs: 0,
    concept: 'dns',
  },
  {
    id: 'tcp',
    title: 'TCP connection',
    short: 'three-way handshake',
    detail:
      'SYN, SYN-ACK, ACK - one full round trip before any data moves. Connection reuse (keep-alive, HTTP/2 multiplexing) is why the second request on a page is so much cheaper.',
    coldMs: 40,
    warmMs: 0,
  },
  {
    id: 'tls',
    title: 'TLS handshake',
    short: 'certificate + session keys',
    detail:
      'The server proves it owns the hostname with a certificate chain, and both sides derive session keys. TLS 1.3 needs one round trip, or zero when resuming a previous session.',
    coldMs: 50,
    warmMs: 0,
    concept: 'tls-https',
  },
  {
    id: 'request',
    title: 'HTTP request sent',
    short: 'GET / with headers',
    detail:
      'Method, path, headers and cookies travel to the server. Headers like Cache-Control and If-None-Match decide whether any intermediary can answer instead of your origin.',
    coldMs: 5,
    warmMs: 5,
    concept: 'http-https',
  },
  {
    id: 'cdn',
    title: 'CDN edge',
    short: 'nearest point of presence',
    detail:
      'Anycast or DNS routes you to a nearby edge. A hit is served from a few kilometres away in single-digit milliseconds and your origin never hears about the request.',
    coldMs: 12,
    warmMs: 6,
    concept: 'cdn',
  },
  {
    id: 'lb',
    title: 'Load balancer',
    short: 'pick a healthy server',
    detail:
      'On a miss the request reaches your infrastructure. The load balancer terminates TLS, picks a healthy backend by its algorithm, and forwards the request.',
    coldMs: 3,
    warmMs: 3,
    concept: 'load-balancing',
  },
  {
    id: 'app',
    title: 'Application server',
    short: 'your code runs',
    detail:
      'Routing, authentication, authorization and business logic. Usually a small fraction of total time unless something downstream is slow.',
    coldMs: 20,
    warmMs: 18,
  },
  {
    id: 'cache',
    title: 'Cache lookup',
    short: 'Redis hit or miss',
    detail:
      'A hit returns in a few milliseconds and the database is never touched. A miss means paying for the query and then storing the result.',
    coldMs: 4,
    warmMs: 3,
    concept: 'caching',
  },
  {
    id: 'db',
    title: 'Database query',
    short: 'indexed lookup',
    detail:
      'With an index this is a handful of page reads. Without one it is a sequential scan, and the difference is the entire indexing lesson.',
    coldMs: 35,
    warmMs: 0,
    concept: 'database-indexing',
  },
  {
    id: 'response',
    title: 'HTTP response',
    short: 'status, headers, body',
    detail:
      'The response travels back, compressed and possibly cached at the edge and in the browser according to its Cache-Control headers.',
    coldMs: 15,
    warmMs: 10,
  },
  {
    id: 'render',
    title: 'Browser rendering',
    short: 'parse, layout, paint',
    detail:
      'HTML is parsed into the DOM, CSS into style rules, then layout and paint. Render-blocking resources here often cost more than everything the backend did.',
    coldMs: 120,
    warmMs: 90,
  },
];

export function UrlJourneyLab() {
  const [warm, setWarm] = useState(false);
  const [cacheHit, setCacheHit] = useState(true);
  const [cdnEnabled, setCdnEnabled] = useState(true);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string>('dns');
  const progress = useRef(0);
  const rerender = useRerender(20);

  const stages = STAGES.filter((stage) => {
    if (stage.id === 'cdn' && !cdnEnabled) return false;
    if (stage.id === 'db' && cacheHit) return false;
    return true;
  });

  const latencyOf = (stage: Stage) => (warm ? stage.warmMs : stage.coldMs);
  const total = stages.reduce((sum, stage) => sum + latencyOf(stage), 0);

  useTicker(playing, (dt) => {
    progress.current += dt * 1.1;
    if (progress.current >= 1) {
      progress.current = 0;
      setActive((index) => {
        const next = index + 1;
        if (next >= stages.length) {
          setPlaying(false);
          return stages.length - 1;
        }
        setSelected(stages[next].id);
        return next;
      });
    }
    rerender();
  });

  const play = useCallback(() => {
    setActive(0);
    setSelected(stages[0].id);
    progress.current = 0;
    setPlaying(true);
  }, [stages]);

  const detail = STAGES.find((stage) => stage.id === selected) ?? STAGES[0];

  return (
    <LabShell
      title="What Happens When You Type a URL?"
      description="Twelve stages between pressing Enter and seeing a page. Click any stage to read what it does and what it costs."
      running={playing}
      onToggleRun={() => (playing ? setPlaying(false) : play())}
      onReset={() => {
        setActive(0);
        setPlaying(false);
        setSelected('dns');
      }}
      actions={
        <Button variant="primary" onClick={play}>
          <Globe className="h-4 w-4" />
          Replay the journey
        </Button>
      }
      insight={
        <Insight title={detail.title}>
          {detail.detail}
          {detail.concept ? (
            <span className="mt-2 block text-xs text-faint">
              Related concept: <span className="text-brand">{detail.concept.replace(/-/g, ' ')}</span>
            </span>
          ) : null}
        </Insight>
      }
      metrics={
        <MetricsPanel
          items={[
            { key: 'total', label: 'Total time', value: formatLatency(total), tone: total > 250 ? 'warn' : 'ok' },
            { key: 'stages', label: 'Stages', value: stages.length, hint: 'Steps involved in this configuration.' },
            {
              key: 'setup',
              label: 'Connection setup',
              value: formatLatency(
                stages.filter((stage) => ['dns', 'tcp', 'tls'].includes(stage.id)).reduce((sum, stage) => sum + latencyOf(stage), 0),
              ),
              tone: warm ? 'ok' : 'warn',
              hint: 'DNS + TCP + TLS - paid before any application work happens.',
            },
            {
              key: 'backend',
              label: 'Backend time',
              value: formatLatency(
                stages.filter((stage) => ['lb', 'app', 'cache', 'db'].includes(stage.id)).reduce((sum, stage) => sum + latencyOf(stage), 0),
              ),
              hint: 'Everything your servers control.',
            },
            {
              key: 'render',
              label: 'Rendering',
              value: formatLatency(latencyOf(STAGES[STAGES.length - 1])),
              tone: 'violet',
              hint: 'Often larger than the entire backend time.',
            },
          ]}
        />
      }
      controls={
        <>
          <Toggle
            label="Warm connection"
            checked={warm}
            onChange={setWarm}
            description="DNS cached, connection reused, TLS session resumed"
          />
          <Toggle label="CDN in front" checked={cdnEnabled} onChange={setCdnEnabled} description="Edge cache before your origin" />
          <Toggle label="Cache hit" checked={cacheHit} onChange={setCacheHit} description="Off: the request reaches the database" />
          <div className="rounded-xl border border-line bg-elevated p-3 text-[11px] text-muted">
            <p className="label mb-2">Notice</p>
            <p>
              On a cold connection, DNS + TCP + TLS cost{' '}
              {formatLatency(STAGES.filter((s) => ['dns', 'tcp', 'tls'].includes(s.id)).reduce((sum, s) => sum + s.coldMs, 0))}{' '}
              before your server does anything at all. That is why connection reuse and edge termination matter as much
              as backend optimisation.
            </p>
          </div>
        </>
      }
    >
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-elevated px-4 py-2.5 font-mono text-sm">
          <span className="text-faint">https://</span>
          <span className="text-ink">example.com</span>
          <span className="text-faint">/products/42</span>
          <Badge tone="brand" className="ml-auto">
            {formatLatency(total)} total
          </Badge>
        </div>

        <ol className="space-y-1.5">
          {stages.map((stage, index) => {
            const isActive = playing && index === active;
            const isSelected = stage.id === selected;
            const value = latencyOf(stage);
            const share = total > 0 ? (value / total) * 100 : 0;
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(stage.id);
                    setActive(index);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                    isActive
                      ? 'border-brand bg-brand/10'
                      : isSelected
                        ? 'border-brand/40 bg-brand/5'
                        : 'border-line hover:border-brand/40',
                  )}
                >
                  <span className="font-mono text-[11px] text-faint">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{stage.title}</span>
                    <span className="block text-xs text-faint">{stage.short}</span>
                  </span>
                  <span className="hidden h-2 w-40 overflow-hidden rounded-full bg-line sm:block">
                    <span
                      className={cn('block h-full rounded-full', value === 0 ? 'bg-ok' : 'bg-brand')}
                      style={{ width: `${Math.max(share, value === 0 ? 100 : 2)}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      'w-16 shrink-0 text-right font-mono text-xs',
                      value === 0 ? 'text-ok' : 'text-ink',
                    )}
                  >
                    {value === 0 ? 'cached' : formatLatency(value)}
                  </span>
                  <ChevronRight className={cn('h-4 w-4 shrink-0 text-faint', isSelected && 'text-brand')} />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </LabShell>
  );
}

export default UrlJourneyLab;
