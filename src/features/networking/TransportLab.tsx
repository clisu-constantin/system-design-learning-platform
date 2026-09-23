import { useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { ArchNode, DiagramCanvas, NodeStatRow, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { Insight, LabShell } from '@/components/learning';
import { Button, SegmentedControl, Slider } from '@/components/ui';
import { useTicker, useEventLog } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { NodeStatus, RequestOutcome } from '@/types';
import {
  DUP_ACK_THRESHOLD,
  FILE_PACING_MS,
  FILE_PACKETS,
  MIN_RTO_MS,
  PLAYOUT_BUFFER_MS,
  VOICE_FRAME_MS,
  cellState,
  createStream,
  emptyStats,
  stepStream,
  type CellState,
  type NetworkSetup,
  type Payload,
  type Stream,
  type StreamEvent,
  type Transport,
} from './transportModel';

/** The simulation runs this many times slower than real time, so single packets can be followed. */
const SLOW_MOTION = 15;
const SEED = 20260923;
const VOICE_CELLS = 30;
/** Keyed log lines (drops, handshakes) are shown at most this often, in real ms. */
const LOG_GAP_MS = 1500;

interface Setup extends NetworkSetup {
  /** Which of the two streams the diagram draws. Both always run. */
  view: Transport;
}

/** What the lab opens on. It has one host Concept, so there is no Lab focus. */
const DEFAULT_SETUP: Setup = { payload: 'voice', view: 'tcp', lossRate: 0.05, delayMs: 40, jitterMs: 10 };

interface Sim {
  now: number;
  tcp: Stream;
  udp: Stream;
}

const createSim = (payload: Payload, now = 0): Sim => ({
  now,
  tcp: createStream('tcp', payload, now),
  udp: createStream('udp', payload, now),
});

const LAYOUT: Layout = {
  client: { x: 30, y: 40, w: 230, h: 126 },
  network: { x: 365, y: 48, w: 230, h: 110 },
  server: { x: 700, y: 40, w: 230, h: 126 },
};

const EDGES: DiagramEdge[] = [
  { from: 'client', to: 'network', tone: 'brand', width: 2 },
  { from: 'network', to: 'server', tone: 'brand', width: 2 },
];

const OUTCOME: Record<string, RequestOutcome> = {
  syn: 'success',
  data: 'success',
  retransmit: 'warning',
  ack: 'cache-hit',
  'syn-ack': 'cache-hit',
};

/**
 * Every packet on the wire, placed by simulated time: the first half of its trip
 * is Client (or Server) to Network, the second half Network to the other end.
 * A dropped packet stops at the Network node and shows as a cross until it would
 * have arrived.
 */
function particlesOf(stream: Stream, now: number): ParticleView[] {
  const views: ParticleView[] = [];
  for (const flight of stream.flights) {
    const progress = Math.min(1, Math.max(0, (now - flight.sentAt) / Math.max(1, flight.arriveAt - flight.sentAt)));
    const origin = flight.toServer ? 'client' : 'server';
    const target = flight.toServer ? 'server' : 'client';
    if (flight.dropped && progress >= 0.5) {
      views.push({ id: flight.id, from: origin, to: 'network', t: 0.9, outcome: 'failure' });
    } else if (progress < 0.5) {
      views.push({ id: flight.id, from: origin, to: 'network', t: progress * 2, outcome: OUTCOME[flight.kind] });
    } else {
      views.push({ id: flight.id, from: 'network', to: target, t: (progress - 0.5) * 2, outcome: OUTCOME[flight.kind] });
    }
  }
  return views;
}

/** Packets that reached the server but wait for an earlier one before the app gets them. */
function heldBack(stream: Stream) {
  let held = 0;
  for (const record of stream.packets.values()) if (record.arrivedAt !== null && record.deliveredAt === null) held += 1;
  return held;
}

export function TransportLab() {
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const { payload, view, lossRate, delayMs, jitterMs } = setup;
  const [running, setRunning] = useState(true);
  const sim = useRef<Sim>(createSim(DEFAULT_SETUP.payload));
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();
  const lastLogged = useRef(new Map<string, number>());

  const report = (event: StreamEvent) => {
    if (event.transport !== setup.view && !event.always) return;
    if (event.key) {
      const at = performance.now();
      if (at - (lastLogged.current.get(event.key) ?? -Infinity) < LOG_GAP_MS) return;
      lastLogged.current.set(event.key, at);
    }
    log(event.always ? event.message : `${event.transport.toUpperCase()}: ${event.message}`, event.tone);
  };

  useTicker(running, (dt) => {
    const state = sim.current;
    state.now += (dt * 1000) / SLOW_MOTION;
    stepStream(state.tcp, state.now, setup, SEED, report);
    stepStream(state.udp, state.now, setup, SEED, report);
    rerender();
  });

  /** Loss, delay and jitter apply to the next packets sent; the counters restart so they describe the new network. */
  const changeNetwork =
    <K extends 'lossRate' | 'delayMs' | 'jitterMs'>(key: K) =>
    (value: Setup[K]) => {
      setSetup((current) => ({ ...current, [key]: value }));
      sim.current.tcp.stats = emptyStats();
      sim.current.udp.stats = emptyStats();
    };

  const changePayload = (next: Payload) => {
    if (next === payload) return;
    setSetup((current) => ({ ...current, payload: next }));
    sim.current = createSim(next, sim.current.now);
    log(next === 'voice' ? 'Started a voice call over both transports' : 'Started a file download over both transports', 'info');
  };

  const dropNext = () => {
    sim.current.tcp.dropNext = true;
    sim.current.udp.dropNext = true;
    log('The network will drop the next new packet on both transports', 'warn');
  };

  const reset = () => {
    setSetup(DEFAULT_SETUP);
    sim.current = createSim(DEFAULT_SETUP.payload);
    lastLogged.current.clear();
    clear();
  };

  const { now, tcp, udp } = sim.current;
  const shown = view === 'tcp' ? tcp : udp;
  const particles = particlesOf(shown, now);
  const held = heldBack(shown);
  const rtt = 2 * delayMs;
  const lossPct = formatPercent(lossRate);

  const clientStatus: { status: NodeStatus; label: string } =
    shown.phase === 'handshake'
      ? { status: 'starting', label: 'Handshake' }
      : shown.phase === 'waiting'
        ? { status: 'starting', label: 'Opening' }
        : shown.phase === 'draining'
          ? { status: 'healthy', label: 'All packets sent' }
          : { status: 'healthy', label: 'Sending' };

  return (
    <LabShell
      title="TCP vs UDP Lab"
      description="One client sends a voice call or a file to a server across a network that drops and delays packets. The same stream runs over TCP and over UDP at the same time, so you can compare what each one does with the same losses."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      events={events}
      legend={<WireLegend />}
      actions={
        <Button variant="secondary" onClick={dropNext}>
          <Scissors className="h-4 w-4" />
          Drop the next packet
        </Button>
      }
      insight={<Insight>{insightText(setup, tcp, udp)}</Insight>}
      metrics={
        <>
          <ReceiverStrip stream={shown} now={now} />
          <Comparison payload={payload} view={view} tcp={tcp} udp={udp} />
        </>
      }
      controls={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">What the client sends</p>
            <SegmentedControl
              size="sm"
              className="w-full"
              value={payload}
              options={[
                { value: 'voice', label: 'Voice call' },
                { value: 'file', label: 'File' },
              ]}
              onChange={changePayload}
            />
            <p className="text-[11px] text-faint">
              {payload === 'voice'
                ? `A frame of audio every ${VOICE_FRAME_MS} ms. Each must be played ${PLAYOUT_BUFFER_MS} ms after it would normally arrive, or it is useless.`
                : `${FILE_PACKETS} packets, one every ${FILE_PACING_MS} ms. Every byte must arrive, in order. Each file opens a new connection.`}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Diagram shows</p>
            <SegmentedControl
              size="sm"
              className="w-full"
              value={view}
              options={[
                { value: 'tcp', label: 'TCP' },
                { value: 'udp', label: 'UDP' },
              ]}
              onChange={(value) => setSetup((current) => ({ ...current, view: value }))}
            />
            <p className="text-[11px] text-faint">Both run all the time over the same network; this picks which one you watch.</p>
          </div>
          <Slider
            label="Packet loss"
            value={lossRate}
            min={0}
            max={0.2}
            step={0.01}
            onChange={changeNetwork('lossRate')}
            format={(value) => formatPercent(value)}
            tone="danger"
            hint="Share of data packets the network drops. Both transports lose the same packets."
          />
          <Slider
            label="One-way delay"
            value={delayMs}
            min={10}
            max={150}
            step={5}
            onChange={changeNetwork('delayMs')}
            format={(value) => `${value} ms`}
            hint={`Round trip ${rtt} ms. A TCP resend costs at least one round trip.`}
          />
          <Slider
            label="Jitter"
            value={jitterMs}
            min={0}
            max={100}
            step={5}
            onChange={changeNetwork('jitterMs')}
            format={(value) => `0-${value} ms`}
            tone="warn"
            hint="Random extra delay per packet, so packets can overtake each other."
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Simplified model</p>
            <ul className="space-y-1 text-[11px] text-muted">
              <li>Shown {SLOW_MOTION}x slower than real time; times in the log are simulated.</li>
              <li>
                A drop is resent after {DUP_ACK_THRESHOLD} duplicate ACKs, or after a timeout of twice the round trip (at
                least {MIN_RTO_MS} ms).
              </li>
              <li>No congestion control: real TCP also slows down after a loss.</li>
              <li>Handshake packets and ACKs are never dropped.</li>
            </ul>
          </div>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={EDGES} particles={particles} height={206} className="bg-canvas">
        <ArchNode
          kind="client"
          title={`Client (${view.toUpperCase()})`}
          subtitle={payload === 'voice' ? `Voice, a frame every ${VOICE_FRAME_MS} ms` : `File of ${FILE_PACKETS} packets`}
          placed={LAYOUT.client}
          status={clientStatus.status}
          statusLabel={clientStatus.label}
        >
          <NodeStatRow label="Packets sent" value={formatNumber(shown.stats.sent)} />
          <NodeStatRow
            label="Resent"
            value={view === 'tcp' ? formatNumber(shown.stats.retransmits) : 'never'}
            tone={view === 'tcp' && shown.stats.retransmits > 0 ? 'text-warn' : 'text-ink'}
          />
          <NodeStatRow label="Handshake" value={view === 'tcp' ? `1 round trip, ${rtt} ms` : 'none'} />
        </ArchNode>
        {/* The Network kind borrows the CDN icon (a network glyph); it stands for every router on the path. */}
        <ArchNode
          kind="cdn"
          title="Network"
          subtitle={`Delay ${delayMs} ms + 0-${jitterMs} ms jitter`}
          placed={LAYOUT.network}
          status={lossRate > 0 ? 'degraded' : 'healthy'}
          statusLabel={lossRate > 0 ? `Drops ${lossPct} of packets` : 'No loss'}
        >
          <NodeStatRow
            label="Dropped"
            value={formatNumber(shown.stats.dropped)}
            tone={shown.stats.dropped > 0 ? 'text-danger' : 'text-ink'}
          />
          <NodeStatRow label="Round trip" value={`${rtt} ms`} />
        </ArchNode>
        <ArchNode
          kind="server"
          title={`Server (${view.toUpperCase()})`}
          subtitle={view === 'tcp' ? 'To the app in order, or it waits' : 'To the app as they arrive'}
          placed={LAYOUT.server}
          status={held > 0 ? 'degraded' : 'healthy'}
          statusLabel={held > 0 ? 'Head-of-line blocked' : 'Receiving'}
          alert={held > 0}
        >
          {view === 'tcp' ? (
            <>
              <NodeStatRow label="Held back" value={formatNumber(held)} tone={held > 0 ? 'text-warn' : 'text-ink'} />
              <NodeStatRow label="Waiting for" value={held > 0 ? `#${shown.expected}` : 'nothing'} />
            </>
          ) : (
            <>
              <NodeStatRow label="Out of order" value={formatNumber(shown.stats.outOfOrder)} />
              <NodeStatRow
                label="Never arrived"
                value={formatNumber(payload === 'voice' ? shown.stats.lost : shown.stats.missing)}
                tone="text-danger"
              />
            </>
          )}
          {payload === 'voice' ? (
            <NodeStatRow
              label="Too late to play"
              value={formatNumber(shown.stats.late)}
              tone={shown.stats.late > 0 ? 'text-warn' : 'text-ink'}
            />
          ) : (
            <NodeStatRow label="Complete files" value={`${shown.stats.filesComplete} of ${shown.stats.files}`} />
          )}
        </ArchNode>
      </DiagramCanvas>
    </LabShell>
  );
}

function insightText(setup: Setup, tcp: Stream, udp: Stream) {
  const { payload, lossRate, jitterMs } = setup;
  if (payload === 'voice') {
    const decided = tcp.stats.onTime + tcp.stats.late + tcp.stats.lost;
    if (lossRate === 0 && jitterMs <= PLAYOUT_BUFFER_MS && tcp.stats.late === 0) {
      return `Nothing is dropped, so TCP and UDP deliver the same call. Raise Packet loss, or press Drop the next packet, and watch what each one does with the gap.`;
    }
    if (decided < 50) return 'Collecting frames. Watch the server on TCP when a packet is dropped: the frames behind it wait.';
    return `Over TCP, ${tcp.stats.late} of ${decided} frames (${formatPercent(tcp.stats.late / decided, 1)}) came too late to play, although TCP lost none: each resend comes at least a round trip later, and the frames behind it wait in the buffer too, so one drop becomes several missed frames. Over UDP on the same network, ${udp.stats.lost} frames were lost and ${udp.stats.late} were late - each lost one is a single ${VOICE_FRAME_MS} ms gap that the codec can hide. For a live call, late data is worth nothing.${
      jitterMs > PLAYOUT_BUFFER_MS ? ` Jitter above the ${PLAYOUT_BUFFER_MS} ms playout buffer also makes UDP frames late.` : ''
    }`;
  }
  if (!tcp.stats.files || !udp.stats.files) {
    return 'The first files are on their way. TCP spends one round trip on the handshake before its first byte; UDP starts sending at once.';
  }
  const tcpAvg = tcp.stats.fileMsTotal / tcp.stats.files;
  const udpAvg = udp.stats.fileMsTotal / udp.stats.files;
  return `TCP finished ${tcp.stats.files} files, ${tcp.stats.filesComplete} of them complete, in ${formatLatency(tcpAvg)} on average. UDP finished ${udp.stats.files} in ${formatLatency(udpAvg)}, but ${udp.stats.files - udp.stats.filesComplete} were missing packets (${udp.stats.missing} in all). A file with a hole in it is broken, so for a file, late but complete is the only useful answer - that is the trade TCP makes.`;
}

/* ---------------------------------------------------------------------------------------------- */

const CELL_LABEL: Record<Payload, Record<CellState, string>> = {
  voice: {
    unsent: 'Not sent yet',
    flight: 'On the wire',
    resend: 'Dropped, resend coming',
    held: 'Arrived, held back',
    ok: 'Played on time',
    late: 'Too late to play',
    lost: 'Lost for good',
  },
  file: {
    unsent: 'Not sent yet',
    flight: 'On the wire',
    resend: 'Dropped, resend coming',
    held: 'Arrived, held back',
    ok: 'Delivered',
    late: 'Delivered after a wait',
    lost: 'Lost for good',
  },
};

/** Shape plus colour, so no state depends on colour alone. */
function CellGlyph({ state, size = 14 }: { state: CellState; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-7 -7 14 14" aria-hidden>
      {state === 'unsent' ? <circle r={4} fill="none" strokeDasharray="2 2" className="stroke-faint" /> : null}
      {state === 'flight' ? <circle r={2.5} className="fill-faint" /> : null}
      {state === 'resend' ? <polygon points="0,-5 4.5,3.5 -4.5,3.5" fill="none" strokeWidth={1.5} className="stroke-warn" /> : null}
      {state === 'held' ? <rect x={-4} y={-4} width={8} height={8} fill="none" strokeWidth={1.5} className="stroke-info" /> : null}
      {state === 'ok' ? <circle r={4.5} className="fill-ok" /> : null}
      {state === 'late' ? <polygon points="0,-5 4.5,3.5 -4.5,3.5" className="fill-warn" /> : null}
      {state === 'lost' ? (
        <g strokeWidth={2.2} strokeLinecap="round" className="stroke-danger">
          <line x1={-3.5} y1={-3.5} x2={3.5} y2={3.5} />
          <line x1={-3.5} y1={3.5} x2={3.5} y2={-3.5} />
        </g>
      ) : null}
    </svg>
  );
}

function ReceiverStrip({ stream, now }: { stream: Stream; now: number }) {
  const { payload } = stream;
  const first = payload === 'voice' ? Math.max(0, stream.nextSeq - VOICE_CELLS) : 0;
  const count = payload === 'voice' ? VOICE_CELLS : FILE_PACKETS;
  const cells = Array.from({ length: count }, (_, index) => first + index);
  const states: CellState[] = payload === 'voice' ? ['flight', 'resend', 'held', 'ok', 'late', 'lost'] : ['unsent', 'flight', 'resend', 'held', 'ok', 'late', 'lost'];
  return (
    <div className="card p-4">
      <p className="label mb-1">What the app on the server gets ({stream.transport.toUpperCase()})</p>
      <p className="mb-3 text-xs text-faint">
        {payload === 'voice'
          ? `The last ${VOICE_CELLS} voice frames, oldest on the left.`
          : `Every packet of the current file.`}{' '}
        {stream.transport === 'tcp'
          ? 'TCP gives the app nothing past a gap: packets behind a dropped one wait, held back, until its resend arrives.'
          : 'UDP gives the app each datagram the moment it arrives, in whatever order, and never fills a gap.'}
      </p>
      <div className="flex flex-wrap gap-1">
        {cells.map((seq) => {
          const state = cellState(stream.packets.get(seq), payload, now);
          return (
            <span
              key={seq}
              title={`#${seq}: ${CELL_LABEL[payload][state]}`}
              className={cn(
                'flex w-7 flex-col items-center rounded border py-0.5',
                state === 'held' ? 'border-info/50 bg-info/10' : state === 'lost' ? 'border-danger/40' : 'border-line',
              )}
            >
              <CellGlyph state={state} />
              <span className="font-mono text-[9px] text-faint">{seq}</span>
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {states.map((state) => (
          <span key={state} className="flex items-center gap-1.5 text-[11px] text-muted">
            <CellGlyph state={state} />
            {CELL_LABEL[payload][state]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Comparison({ payload, view, tcp, udp }: { payload: Payload; view: Transport; tcp: Stream; udp: Stream }) {
  const rows: { label: string; value: (stream: Stream) => string }[] =
    payload === 'voice'
      ? [
          { label: 'Frames played on time', value: (s) => ratio(s.stats.onTime, s.stats.onTime + s.stats.late + s.stats.lost) },
          { label: 'Frames too late to play', value: (s) => formatNumber(s.stats.late) },
          { label: 'Frames lost for good', value: (s) => formatNumber(s.stats.lost) },
          { label: 'Packets resent', value: (s) => formatNumber(s.stats.retransmits) },
          { label: 'Longest wait behind a gap', value: (s) => formatLatency(s.stats.maxHoldMs) },
          { label: 'Arrived out of order', value: (s) => formatNumber(s.stats.outOfOrder) },
        ]
      : [
          { label: 'Files finished', value: (s) => formatNumber(s.stats.files) },
          { label: 'Files with no missing packet', value: (s) => formatNumber(s.stats.filesComplete) },
          { label: 'Average time per file', value: (s) => (s.stats.files ? formatLatency(s.stats.fileMsTotal / s.stats.files) : '-') },
          { label: 'Packets never delivered', value: (s) => formatNumber(s.stats.missing) },
          { label: 'Packets resent', value: (s) => formatNumber(s.stats.retransmits) },
          { label: 'Longest wait behind a gap', value: (s) => formatLatency(s.stats.maxHoldMs) },
        ];
  return (
    <div className="card p-4">
      <p className="label mb-3">Same network, both transports</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-faint">
            <th className="pb-2 font-medium" />
            {(['tcp', 'udp'] as const).map((transport) => (
              <th key={transport} className={cn('pb-2 text-right font-semibold', view === transport ? 'text-brand' : 'text-muted')}>
                {transport.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <td className="py-1.5 text-muted">{row.label}</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-ink">{row.value(tcp)}</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-ink">{row.value(udp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-faint">
        Both streams run at once and the network drops the same packets on both. Counters restart when you change the
        network. Simplified model, not a measurement: see the list under the controls.
      </p>
    </div>
  );
}

const ratio = (part: number, whole: number) => (whole ? formatPercent(part / whole, 1) : '-');

/** The particle shapes on the wires, with what each one means in this lab. */
function WireLegend() {
  const items: { label: string; shape: JSX.Element }[] = [
    { label: 'Data packet (and the SYN)', shape: <circle r={4.2} className="fill-brand" /> },
    { label: 'ACK going back (and the SYN-ACK)', shape: <rect x={-4} y={-4} width={8} height={8} rx={1} transform="rotate(45)" className="fill-ok" /> },
    { label: 'Resent packet', shape: <polygon points="0,-5 4.5,3.5 -4.5,3.5" className="fill-warn" /> },
    {
      label: 'Dropped by the network',
      shape: (
        <g strokeWidth={2.2} strokeLinecap="round" className="stroke-danger">
          <line x1={-3.5} y1={-3.5} x2={3.5} y2={3.5} />
          <line x1={-3.5} y1={3.5} x2={3.5} y2={-3.5} />
        </g>
      ),
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <svg width={14} height={14} viewBox="-7 -7 14 14" aria-hidden>
            {item.shape}
          </svg>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default TransportLab;
