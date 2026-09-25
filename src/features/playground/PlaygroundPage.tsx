import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useLayout } from '@/app/providers/LayoutProvider';
import { useThemeColors } from '@/app/providers/ThemeProvider';
import { Button, Select } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { NodeKind } from '@/types';
import { nodeTypes, type PlaygroundNodeData } from './nodes';
import { edgeTypes } from './edges';
import { analyze } from './analysis';
import { makeNode, PRESETS } from './presets';
import { withAlpha } from './color';
import { Inspector } from './Inspector';
import { NODE_DRAG_TYPE, Palette } from './Palette';
import { SidePanel } from './SidePanel';

/** The preset shown on first load; the select, the canvas and Reset all read this. */
const DEFAULT_PRESET = 'scaled';
/** Never zoom in past 1:1, so a three node preset does not fill the screen with one card. */
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };
/** Below this width the sidebar, the component list and the inspector leave the canvas too little room. */
const ROOMY_QUERY = '(min-width: 1440px)';

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
  const colors = useThemeColors();
  const layout = useLayout();
  const roomy = useMediaQuery(ROOMY_QUERY);
  const paletteFolded = layout.paletteFolded;
  // Without a saved choice the inspector starts folded on a laptop, so the canvas keeps its room.
  const inspectorFolded = layout.inspectorFolded ?? !roomy;
  /** Set by a fold or unfold; the next canvas resize re-frames the diagram in the new space. */
  const refitPending = useRef(false);

  const foldPalette = useCallback(
    (folded: boolean) => {
      refitPending.current = true;
      layout.setPaletteFolded(folded);
    },
    [layout],
  );
  const foldInspector = useCallback(
    (folded: boolean) => {
      refitPending.current = true;
      layout.setInspectorFolded(folded);
    },
    [layout],
  );

  useEffect(() => {
    const element = wrapper.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (!refitPending.current) return;
      refitPending.current = false;
      // One frame later, so React Flow has read the new size before it frames the diagram.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => instance.current?.fitView(FIT_VIEW));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const analysis = useMemo(() => analyze(nodes, edges, traffic), [nodes, edges, traffic]);

  /** Nodes and edges decorated with the current simulation results. */
  const viewNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      // The analysis is a static calculation, so cards always show it; Start only animates the particles.
      load: Math.round(analysis.load[node.id] ?? 0),
      bottleneck: analysis.bottlenecks.includes(node.id),
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
      const kind = event.dataTransfer.getData(NODE_DRAG_TYPE) as NodeKind;
      if (!kind || !instance.current) return;
      const position = instance.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addComponent(kind, position);
    },
    [addComponent],
  );

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const selectNode = useCallback(
    (id: string) => {
      setSelectedId(id);
      // A selection is a question about that node, so a folded inspector opens to answer it.
      if (inspectorFolded) foldInspector(false);
    },
    [inspectorFolded, foldInspector],
  );

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
        <SidePanel
          id="playground-palette"
          side="left"
          title="Components"
          folded={paletteFolded}
          onFoldedChange={foldPalette}
          width="w-52"
        >
          <Palette onAdd={addComponent} />
        </SidePanel>

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
            onNodeClick={(_, node: Node) => selectNode(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={FIT_VIEW}
            proOptions={{ hideAttribution: true }}
            className="bg-canvas"
          >
            {/* Background, MiniMap: React Flow writes these colors into SVG attributes, so no var() strings. */}
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color={colors.line} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={colors.faint} maskColor={withAlpha(colors.canvas, 0.7)} />
          </ReactFlow>
        </div>

        <SidePanel
          id="playground-inspector"
          side="right"
          title="Inspector"
          folded={inspectorFolded}
          onFoldedChange={foldInspector}
          width="w-80"
        >
          <Inspector
            nodes={nodes}
            analysis={analysis}
            traffic={traffic}
            onTrafficChange={setTraffic}
            selected={selected}
            onToggleFailure={toggleFailure}
            onRemove={removeSelected}
          />
        </SidePanel>
      </div>
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
