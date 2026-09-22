import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useStoreApi,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertTriangle, Pause, Play, Power, RotateCcw, Trash2 } from 'lucide-react';
import { NODE_KINDS, NODE_KIND_LIST } from '@/components/architecture';
import { Badge, Button, Meter, Select, Slider } from '@/components/ui';
import { formatNumber, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { NodeKind } from '@/types';
import { nodeTypes, type PlaygroundNodeData } from './nodes';
import { edgeTypes } from './edges';
import { analyze } from './analysis';
import { makeNode, PRESETS } from './presets';

const SEVERITY_TONE = { high: 'danger', medium: 'warn', low: 'neutral' } as const;

/** The preset shown on first load; the select, the canvas and Reset all read this. */
const DEFAULT_PRESET = 'scaled';
/** Never zoom in past 1:1, so a three node preset does not fill the screen with one card. */
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };

function PlaygroundCanvas() {
  const initial = useMemo(() => (PRESETS.find((item) => item.id === DEFAULT_PRESET) ?? PRESETS[0]).build(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<PlaygroundNodeData>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [traffic, setTraffic] = useState(800);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const wrapper = useRef<HTMLDivElement>(null);
  const instance = useRef<ReactFlowInstance | null>(null);
  const store = useStoreApi();

  const analysis = useMemo(() => analyze(nodes, edges, traffic), [nodes, edges, traffic]);

  /** Nodes and edges decorated with the current simulation results. */
  const viewNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      load: running ? Math.round(analysis.load[node.id] ?? 0) : 0,
      bottleneck: running && analysis.bottlenecks.includes(node.id),
    },
  }));

  const clientCount = nodes.filter((node) => node.data.kind === 'client').length;
  const viewEdges = edges.map((edge) => {
    // Clients are traffic sources and carry no load of their own; their share of the traffic is what leaves them.
    const sourceIsClient = nodes.find((node) => node.id === edge.source)?.data.kind === 'client';
    const sourceLoad = sourceIsClient ? traffic / Math.max(clientCount, 1) : (analysis.load[edge.source] ?? traffic);
    const targetDown = nodes.find((node) => node.id === edge.target)?.data.status === 'down';
    const targetBottleneck = analysis.bottlenecks.includes(edge.target);
    return {
      ...edge,
      type: 'request',
      data: {
        running,
        intensity: Math.min(1, sourceLoad / Math.max(traffic, 1)),
        tone: targetDown ? 'danger' : targetBottleneck ? 'warn' : running ? 'ok' : 'muted',
      },
    };
  });

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) =>
        addEdge({ ...connection, type: 'request', data: { running: false, intensity: 0, tone: 'muted' } }, current),
      ),
    [setEdges],
  );

  const addComponent = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      const point = position ?? { x: 320 + Math.random() * 160, y: 160 + Math.random() * 160 };
      setNodes((current) => [...current, makeNode(kind, point.x, point.y)]);
    },
    [setNodes],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/sdi-node') as NodeKind;
      if (!kind || !instance.current) return;
      const position = instance.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addComponent(kind, position);
    },
    [addComponent],
  );

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const toggleFailure = useCallback(() => {
    if (!selectedId) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedId
          ? { ...node, data: { ...node.data, status: node.data.status === 'down' ? 'healthy' : 'down' } }
          : node,
      ),
    );
  }, [selectedId, setNodes]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId(null);
  }, [selectedId, setNodes, setEdges]);

  const loadPreset = useCallback(
    (id: string) => {
      const definition = PRESETS.find((item) => item.id === id);
      if (!definition) return;
      const built = definition.build();
      setNodes(built.nodes);
      setEdges(built.edges);
      setPreset(id);
      setSelectedId(null);
      // Re-frame the new diagram, otherwise the viewport keeps the previous preset's zoom and most
      // of the new one sits off screen. fitView() cannot run yet - the new nodes are unmeasured -
      // so re-arm React Flow's own fit-on-init, which fires once their dimensions arrive.
      if (built.nodes.length === 0) instance.current?.setViewport({ x: 0, y: 0, zoom: 1 });
      else store.setState({ fitViewOnInitDone: false });
    },
    [setNodes, setEdges, store],
  );

  const totalCapacity = nodes
    .filter((node) => node.data.kind === 'server' || node.data.kind === 'service')
    .reduce((sum, node) => sum + (node.data.status === 'down' ? 0 : node.data.capacity), 0);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <div>
          <h1 className="text-sm font-semibold text-ink">Architecture Playground</h1>
          <p className="text-[11px] text-faint">Drag components in, connect them, run traffic and see what breaks.</p>
        </div>
        <div className="flex-1" />
        <Select
          value={preset}
          options={PRESETS.map((item) => ({ value: item.id, label: item.name }))}
          onChange={loadPreset}
          className="w-56"
        />
        <Button variant={running ? 'secondary' : 'primary'} onClick={() => setRunning((value) => !value)}>
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? 'Stop simulation' : 'Start simulation'}
        </Button>
        <Button size="icon" aria-label="Reset canvas" onClick={() => loadPreset(preset)}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <aside className="w-52 shrink-0 overflow-y-auto border-r border-line bg-surface p-3">
          <p className="label mb-2">Components</p>
          <p className="mb-3 text-[11px] leading-relaxed text-faint">
            Drag onto the canvas, or click to add. Connect nodes by dragging from the bottom handle to the top handle
            of another node.
          </p>
          <div className="space-y-1.5">
            {NODE_KIND_LIST.map((kind) => {
              const style = NODE_KINDS[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('application/sdi-node', kind)}
                  onClick={() => addComponent(kind)}
                  title={style.blurb}
                  className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left transition-colors hover:border-brand/60 hover:bg-elevated"
                >
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded', style.accent)}>
                    <style.Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-ink">{style.label}</span>
                    {style.capacity > 0 ? (
                      <span className="block font-mono text-[9px] text-faint">
                        {formatNumber(style.capacity)} req/s
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Canvas */}
        <div className="relative min-w-0 flex-1" ref={wrapper} onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
          <ReactFlow
            nodes={viewNodes}
            edges={viewEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={(connection) => connection.source !== connection.target}
            onInit={(flow) => {
              instance.current = flow;
            }}
            onNodeClick={(_, node: Node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={FIT_VIEW}
            proOptions={{ hideAttribution: true }}
            className="bg-canvas"
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgb(var(--c-line))" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={() => 'rgb(var(--c-faint))'} maskColor="rgb(var(--c-canvas) / 0.7)" />
          </ReactFlow>
        </div>

        {/* Inspector */}
        <aside className="w-80 shrink-0 space-y-3 overflow-y-auto border-l border-line bg-surface p-3">
          <div className="rounded-xl border border-line p-3">
            <p className="label mb-2">Traffic</p>
            <Slider
              label="Incoming"
              value={traffic}
              min={100}
              max={20000}
              step={100}
              onChange={setTraffic}
              format={(value) => `${formatNumber(value)} req/sec`}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
              <span>App tier capacity</span>
              <span className="font-mono text-ink">{formatNumber(totalCapacity)} req/s</span>
            </div>
            {analysis.dropped > 0 ? (
              <p className="mt-2 font-mono text-[11px] text-danger">
                {formatNumber(analysis.dropped)} req/s dropped at failed components
              </p>
            ) : null}
          </div>

          {selected ? (
            <div className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <p className="label">Selected</p>
                <Badge tone={selected.data.status === 'down' ? 'danger' : 'ok'}>{selected.data.status}</Badge>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-ink">{selected.data.label}</p>
              <p className="text-[11px] text-faint">{NODE_KINDS[selected.data.kind].blurb}</p>
              {selected.data.capacity > 0 ? (
                <div className="mt-3">
                  <Meter
                    label={`${formatNumber(analysis.load[selected.id] ?? 0)} / ${formatNumber(selected.data.capacity)} req/s`}
                    value={(analysis.load[selected.id] ?? 0) / Math.max(selected.data.capacity, 1)}
                  />
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant={selected.data.status === 'down' ? 'success' : 'danger'}
                  className="flex-1 justify-center"
                  onClick={toggleFailure}
                >
                  <Power className="h-3 w-3" />
                  {selected.data.status === 'down' ? 'Restore' : 'Simulate failure'}
                </Button>
                <Button size="sm" variant="secondary" onClick={removeSelected} aria-label="Delete component">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-line p-3 text-[11px] text-muted">
              Select a component to inspect it, simulate a failure or delete it.
            </div>
          )}

          <div className="rounded-xl border border-line p-3">
            <p className="label mb-3">Architecture health</p>
            <div className="space-y-2.5">
              <ScoreRow label="Scalability" value={analysis.scores.scalability} />
              <ScoreRow label="Availability" value={analysis.scores.availability} />
              <ScoreRow label="Performance" value={analysis.scores.performance} />
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">Complexity</span>
                <Badge tone={analysis.complexity === 'High' ? 'warn' : 'neutral'}>{analysis.complexity}</Badge>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">Cost</span>
                <Badge tone={analysis.cost === 'High' ? 'warn' : 'neutral'}>{analysis.cost}</Badge>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              These scores are an educational heuristic, not an engineering measurement. They reward redundancy,
              caching and traffic distribution - the same things a reviewer would ask about.
            </p>
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="label mb-2">Detected risks</p>
            {analysis.risks.length === 0 ? (
              <p className="text-[11px] text-muted">
                None of the checks this heuristic runs found a risk at this traffic level. That is not a
                production-readiness review: it does not look at security, backups, data growth or deployment.
              </p>
            ) : (
              <ul className="space-y-2">
                {analysis.risks.map((risk) => (
                  <li key={risk.id} className="rounded-lg border border-line p-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0',
                          risk.severity === 'high' ? 'text-danger' : risk.severity === 'medium' ? 'text-warn' : 'text-faint',
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] leading-relaxed text-ink">{risk.message}</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-faint">+ {risk.fix}</p>
                      </div>
                      <Badge tone={SEVERITY_TONE[risk.severity]}>{risk.severity}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {running && analysis.bottlenecks.length > 0 ? (
            <div className="rounded-xl border border-warn/40 bg-warn/5 p-3">
              <p className="label mb-2 text-warn">Bottlenecks</p>
              {analysis.bottlenecks.map((id) => {
                const node = nodes.find((item) => item.id === id);
                if (!node) return null;
                const load = analysis.load[id] ?? 0;
                return (
                  <div key={id} className="mb-2 font-mono text-[11px]">
                    <p className="text-ink">{node.data.label}</p>
                    <p className="text-faint">
                      capacity {formatNumber(node.data.capacity)} / incoming {formatNumber(load)} (
                      {formatPercent(load / Math.max(node.data.capacity, 1))})
                    </p>
                  </div>
                );
              })}
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                Possible fixes: add another instance, put a cache in front, move the work to a queue, or make the
                operation cheaper.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-ink">{value} / 100</span>
      </div>
      {/* Higher is better here, the opposite of a utilization bar, so the colour is set explicitly. */}
      <Meter
        value={value / 100}
        tone={value >= 70 ? 'ok' : value >= 40 ? 'warn' : 'danger'}
        showValue={false}
        size="xs"
        className="mt-1"
      />
    </div>
  );
}

export function PlaygroundPage() {
  return (
    <ReactFlowProvider>
      <PlaygroundCanvas />
    </ReactFlowProvider>
  );
}

export default PlaygroundPage;
