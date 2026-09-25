import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
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
import { Boxes, Map as MapIcon, Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useLayout } from '@/app/providers/LayoutProvider';
import { useThemeColors } from '@/app/providers/ThemeProvider';
import { Button, Select } from '@/components/ui';
import { LG_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import type { NodeKind } from '@/types';
import { NODE_SIZE, nodeTypes, type PlaygroundNodeData } from './nodes';
import { edgeTypes } from './edges';
import { analyze } from './analysis';
import { makeNode, PRESETS } from './presets';
import { withAlpha } from './color';
import { BottomSheet } from './BottomSheet';
import { CanvasToolbar, ToolbarButton } from './CanvasToolbar';
import { ConnectBanner } from './ConnectBanner';
import { Inspector } from './Inspector';
import { NODE_DRAG_TYPE, Palette } from './Palette';
import { SidePanel } from './SidePanel';

/** The preset shown on first load; the select, the canvas and Reset all read this. */
const DEFAULT_PRESET = 'scaled';
/** Never zoom in past 1:1, so a three node preset does not fill the screen with one card. */
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };
/** Below this width the sidebar, the component list and the inspector leave the canvas too little room. */
const ROOMY_QUERY = '(min-width: 1440px)';
/** Enough to find a node in a diagram that has outgrown the screen, small enough to stay out of the way. */
const MINIMAP_SIZE = { width: 160, height: 100 };
/** How far a new node steps aside when the view center already holds one. */
const STACK_OFFSET = 28;

type Sheet = 'palette' | 'inspector';

/** Tap-to-connect: the node the new wire starts at, and whether the last tap was refused. */
interface ConnectMode {
  source: string;
  refusedSelf: boolean;
}

const newEdge = (connection: Connection) => ({
  ...connection,
  type: 'request',
  data: { running: false, intensity: 0, tone: 'muted' as const },
});

function PlaygroundCanvas() {
  const initial = useMemo(() => (PRESETS.find((item) => item.id === DEFAULT_PRESET) ?? PRESETS[0]).build(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<PlaygroundNodeData>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [traffic, setTraffic] = useState(800);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  // A seven node diagram fits on screen, so the minimap waits until the learner asks for it.
  const [showMap, setShowMap] = useState(false);
  const [openSheet, setOpenSheet] = useState<Sheet | null>(null);
  const [connectMode, setConnectMode] = useState<ConnectMode | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const instance = useRef<ReactFlowInstance | null>(null);
  const store = useStoreApi();
  const colors = useThemeColors();
  const layout = useLayout();
  // From the laptop breakpoint the panels are columns beside the canvas; below it they are bottom sheets.
  const isWide = useMediaQuery(LG_QUERY);
  const roomy = useMediaQuery(ROOMY_QUERY);
  const sheet = isWide ? null : openSheet;
  const paletteFolded = layout.paletteFolded;
  // Opened by a node selection, not by the learner: shown for this visit, never saved as their choice.
  const [inspectorPeek, setInspectorPeek] = useState(false);
  // Without a saved choice the inspector starts folded on a laptop, so the canvas keeps its room.
  const inspectorFolded = !inspectorPeek && (layout.inspectorFolded ?? !roomy);
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
      setInspectorPeek(false);
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

  /** The minimap reads the decorated nodes from the store, so each one shows its current health. */
  const minimapNodeColor = useCallback(
    (node: Node<PlaygroundNodeData>) => {
      if (node.data.status === 'down') return colors.danger;
      if (node.data.bottleneck || node.data.status === 'degraded') return colors.warn;
      return colors.ok;
    },
    [colors],
  );

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
    (connection: Connection) => setEdges((current) => addEdge(newEdge(connection), current)),
    [setEdges],
  );

  /** The flow position that puts a new node's card in the middle of what the learner sees now. */
  const viewCenter = useCallback(() => {
    const rect = wrapper.current?.getBoundingClientRect();
    const flow = instance.current;
    if (!rect || !flow) return { x: 320, y: 160 };
    const center = flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    return { x: center.x - NODE_SIZE.width / 2, y: center.y - NODE_SIZE.height / 2 };
  }, []);

  const addComponent = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      const start = position ?? viewCenter();
      const node = makeNode(kind, start.x, start.y);
      setNodes((current) => {
        // Two taps on the same item would stack the cards exactly; step the new one aside instead.
        const taken = (x: number, y: number) =>
          current.some((item) => Math.abs(item.position.x - x) < 12 && Math.abs(item.position.y - y) < 12);
        let point = start;
        for (let step = 0; step < 20 && taken(point.x, point.y); step += 1) {
          point = { x: point.x + STACK_OFFSET, y: point.y + STACK_OFFSET };
        }
        return [...current, { ...node, position: point }];
      });
      // On a phone the sheet covers the canvas; close it so the learner sees the new node.
      setOpenSheet(null);
    },
    [setNodes, viewCenter],
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
  // A removed source ends tap-to-connect on its own.
  const connecting = connectMode && nodes.some((node) => node.id === connectMode.source) ? connectMode : null;
  const connectSource = connecting ? nodes.find((node) => node.id === connecting.source) : undefined;

  const startConnect = useCallback(() => {
    if (!selectedId) return;
    setConnectMode({ source: selectedId, refusedSelf: false });
    setOpenSheet(null);
  }, [selectedId]);

  useEffect(() => {
    if (!connecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConnectMode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [connecting]);

  const onNodeClick = useCallback(
    (id: string) => {
      if (connecting) {
        // Same rule as a drag between handles: a component cannot send requests to itself.
        if (id === connecting.source) {
          setConnectMode({ ...connecting, refusedSelf: true });
          return;
        }
        onConnect({ source: connecting.source, target: id, sourceHandle: null, targetHandle: null });
        setConnectMode(null);
        setSelectedId(id);
        return;
      }
      setSelectedId(id);
      // A selection is a question about that node, so a folded inspector opens to answer it. It does
      // not re-frame the diagram, which would move the node away from under the pointer.
      if (!isWide) setOpenSheet('inspector');
      else if (inspectorFolded) setInspectorPeek(true);
    },
    [connecting, onConnect, isWide, inspectorFolded],
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
      setConnectMode(null);
      // Re-frame the new diagram, otherwise the viewport keeps the previous preset's zoom and most
      // of the new one sits off screen. fitView() cannot run yet - the new nodes are unmeasured -
      // so re-arm React Flow's own fit-on-init, which fires once their dimensions arrive.
      if (built.nodes.length === 0) instance.current?.setViewport({ x: 0, y: 0, zoom: 1 });
      else store.setState({ fitViewOnInitDone: false });
    },
    [setNodes, setEdges, store],
  );

  const palette = <Palette onAdd={addComponent} />;
  const inspector = (
    <Inspector
      nodes={nodes}
      analysis={analysis}
      traffic={traffic}
      onTrafficChange={setTraffic}
      selected={selected}
      onToggleFailure={toggleFailure}
      onRemove={removeSelected}
      onConnect={startConnect}
    />
  );

  return (
    // dvh follows the visible viewport, so the mobile address bar never hides the bottom of the canvas.
    <div className="flex h-[calc(100vh-3.5rem)] flex-col supports-[height:100dvh]:h-[calc(100dvh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <div className="sr-only sm:not-sr-only sm:min-w-0 sm:flex-1">
          <h1 className="text-sm font-semibold text-ink">Architecture Playground</h1>
          <p className="text-[11px] text-faint">Drag components in, connect them, run traffic and see what breaks.</p>
        </div>
        <Select
          value={preset}
          options={PRESETS.map((item) => ({ value: item.id, label: item.name }))}
          onChange={loadPreset}
          className="min-w-0 flex-1 sm:w-56 sm:flex-none"
        />
        <Button
          variant={running ? 'secondary' : 'primary'}
          onClick={() => setRunning((value) => !value)}
          className="shrink-0"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span>
            {running ? 'Stop' : 'Start'}
            <span className="hidden sm:inline"> simulation</span>
          </span>
        </Button>
        <Button size="icon" aria-label="Reset canvas" onClick={() => loadPreset(preset)} className="shrink-0">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {isWide ? (
          <SidePanel
            id="playground-palette"
            side="left"
            title="Components"
            folded={paletteFolded}
            onFoldedChange={foldPalette}
            width="w-52"
          >
            {palette}
          </SidePanel>
        ) : null}

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
            onNodeClick={(_, node: Node) => onNodeClick(node.id)}
            onPaneClick={() => {
              setSelectedId(null);
              setConnectMode(null);
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={FIT_VIEW}
            proOptions={{ hideAttribution: true }}
            className="bg-canvas"
          >
            {/* Background, MiniMap: React Flow writes these colors into SVG attributes, so no var() strings. */}
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color={colors.line} />
            {connecting && connectSource ? (
              <ConnectBanner
                sourceLabel={connectSource.data.label}
                refusedSelf={connecting.refusedSelf}
                onCancel={() => setConnectMode(null)}
              />
            ) : null}
            <CanvasToolbar fitViewOptions={FIT_VIEW}>
              <ToolbarButton
                aria-label="Minimap"
                aria-pressed={showMap}
                onClick={() => setShowMap((value) => !value)}
                className="playground-minimap-toggle"
              >
                <MapIcon className="h-4 w-4" />
              </ToolbarButton>
            </CanvasToolbar>
            {showMap ? (
              <MiniMap
                pannable
                zoomable
                ariaLabel="Diagram overview"
                className="glass-panel playground-panel playground-minimap"
                style={MINIMAP_SIZE}
                nodeColor={minimapNodeColor}
                maskColor={withAlpha(colors.canvas, 0.6)}
                maskStrokeColor={colors.brand}
                maskStrokeWidth={1.5}
              />
            ) : null}
          </ReactFlow>
        </div>

        {isWide ? (
          <SidePanel
            id="playground-inspector"
            side="right"
            title="Inspector"
            folded={inspectorFolded}
            onFoldedChange={foldInspector}
            width="w-80"
          >
            {inspector}
          </SidePanel>
        ) : null}
      </div>

      {/* Below the laptop breakpoint the canvas takes the full width and the panels open as sheets from here. */}
      {!isWide ? (
        <div className="flex gap-2 border-t border-line bg-surface px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button
            variant="secondary"
            className="h-11 flex-1 justify-center"
            onClick={() => setOpenSheet('palette')}
            aria-haspopup="dialog"
            aria-expanded={sheet === 'palette'}
          >
            <Boxes className="h-4 w-4" />
            Components
          </Button>
          <Button
            variant="secondary"
            className="h-11 flex-1 justify-center"
            onClick={() => setOpenSheet('inspector')}
            aria-haspopup="dialog"
            aria-expanded={sheet === 'inspector'}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Inspector
            {analysis.risks.length > 0 ? (
              <span className="rounded-full bg-warn/15 px-1.5 font-mono text-[11px] text-warn">
                {analysis.risks.length}
                <span className="sr-only"> risks</span>
              </span>
            ) : null}
          </Button>
        </div>
      ) : null}

      <BottomSheet open={sheet === 'palette'} title="Components" onClose={() => setOpenSheet(null)}>
        {palette}
      </BottomSheet>
      <BottomSheet open={sheet === 'inspector'} title="Inspector" onClose={() => setOpenSheet(null)}>
        {inspector}
      </BottomSheet>
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
