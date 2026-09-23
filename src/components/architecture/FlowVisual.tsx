import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { NodeKind, NodeStatus, RequestOutcome } from '@/types';
import { advanceParticles, nextParticleId, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { useInView } from '@/hooks/useInView';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ArchNode, NodeStatRow } from './ArchNode';
import { DiagramCanvas, type DiagramEdge, type ParticleView } from './DiagramCanvas';
import type { FitRange } from '@/hooks/useFitScale';
import type { Layout } from './geometry';

export interface VisualNode {
  id: string;
  kind: NodeKind;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  status?: NodeStatus;
  /** One short metric line inside the card, e.g. "CPU 38%". */
  stat?: [string, string];
  alert?: boolean;
}

export interface VisualEdge {
  from: string;
  to: string;
  tone?: DiagramEdge['tone'];
  label?: string;
  /** Where the label sits along the edge, 0..1. Use it to clear a node box. */
  labelT?: number;
  dashed?: boolean;
  /** Particles per second on this edge. 0 means a static connection. */
  rate?: number;
  outcome?: RequestOutcome;
  curvature?: number;
}

export interface VisualStep {
  from: string;
  to: string;
  /** Six words or fewer - this is a caption, not a paragraph. */
  label: string;
  outcome?: RequestOutcome;
  /**
   * The hop is deliberately not taken - a pruned partition, a feature cut from
   * scope. The wire is shown dashed and no request travels it, so the step can
   * point at the part without claiming traffic reaches it.
   */
  skipped?: boolean;
}

export interface VisualSpec {
  nodes: VisualNode[];
  edges: VisualEdge[];
  /** Optional stepped walkthrough of the same diagram. */
  steps?: VisualStep[];
  width?: number;
  height?: number;
  /** One short line under the diagram. */
  caption?: string;
  /**
   * Why replicas in this diagram are deliberately wired differently - a failed
   * node, one partition holding the key, one attempt that succeeds. Setting it
   * exempts the spec from the replica-wiring rule in scripts/check-visuals.mjs,
   * so it must say what the asymmetry is teaching.
   */
  asymmetric?: string;
}

/**
 * Concept diagrams are authored in a smaller design space (760px by default)
 * than labs, so they may grow up to 1.3x to fill a wide card instead of sitting
 * in its top-left corner. Below 0.5x they scroll sideways instead of clipping.
 */
const FLOW_FIT: FitRange = { min: 0.5, max: 1.3 };

const toLayout = (spec: VisualSpec): Layout =>
  Object.fromEntries(
    spec.nodes.map((node) => [node.id, { x: node.x, y: node.y, w: node.w ?? 150, h: node.h ?? 74 }]),
  );

/**
 * Play/pause state for a diagram that animates on its own: it starts paused
 * when the OS asks for reduced motion, and the ticker only runs while the
 * diagram is on screen. WCAG 2.2.2 requires the explicit pause either way.
 */
export function useAutoplay<T extends HTMLElement = HTMLElement>() {
  const reducedMotion = usePrefersReducedMotion();
  // null until the learner presses Play/Pause; until then the OS setting decides.
  const [choice, setChoice] = useState<boolean | null>(null);
  const ref = useRef<T>(null);
  const inView = useInView(ref);

  const playing = choice ?? !reducedMotion;
  const setPlaying = (next: boolean | ((current: boolean) => boolean)) =>
    setChoice(typeof next === 'function' ? next(playing) : next);

  return { ref, playing, setPlaying, running: playing && inView, reducedMotion };
}

export function PlayPauseButton({ playing, onToggle, className }: { playing: boolean; onToggle: () => void; className?: string }) {
  const Icon = playing ? Pause : Play;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? 'Pause animation' : 'Play animation'}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-line bg-surface/90 px-2 py-1 text-[11px] text-muted transition-colors hover:border-brand hover:text-brand',
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {playing ? 'Pause' : 'Play'}
    </button>
  );
}

/**
 * The drawn edge a Walkthrough step travels. A step may run against the arrow
 * (a response going back), so it reuses that edge reversed instead of drawing
 * a second curve between the same two nodes.
 */
const wireFor = (edges: VisualEdge[], from: string, to: string) => {
  const forward = edges.find((edge) => edge.from === from && edge.to === to);
  if (forward) return { edge: forward, reversed: false };
  const backward = edges.find((edge) => edge.from === to && edge.to === from);
  return backward ? { edge: backward, reversed: true } : undefined;
};

const renderNodes = (spec: VisualSpec, layout: Layout, activeIds?: Set<string>) =>
  spec.nodes.map((node) => (
    <ArchNode
      key={node.id}
      kind={node.kind}
      title={node.label}
      subtitle={node.sub}
      placed={layout[node.id]}
      status={node.status ?? 'healthy'}
      alert={node.alert}
      selected={activeIds?.has(node.id)}
      compact
    >
      {node.stat ? <NodeStatRow label={node.stat[0]} value={node.stat[1]} /> : null}
    </ArchNode>
  ));

/**
 * A self-running architecture diagram: traffic flows along the edges on its own.
 * Used as the primary content of a concept page, so the first thing a learner
 * meets is a working system rather than a paragraph.
 *
 * With `walkthrough`, a spec that has `steps` also gets a chip row under the
 * canvas: "Live" for the traffic, then one chip per step. Picking a step stops
 * the traffic and walks one request along that hop over the same diagram, so
 * the Walkthrough is never a second copy of the picture in another tab.
 */
export function FlowVisual({
  spec,
  className,
  grid = true,
  zoom,
  walkthrough = false,
}: {
  spec: VisualSpec;
  className?: string;
  grid?: boolean;
  /** Fixes the scale instead of fitting to the container width. */
  zoom?: number;
  /** Shows the Walkthrough chip row when the spec has steps. */
  walkthrough?: boolean;
}) {
  const steps = useMemo(() => (walkthrough ? (spec.steps ?? []) : []), [walkthrough, spec.steps]);
  // null is Live: free-flowing traffic. A number is the Walkthrough step on show.
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const particles = useRef<Particle[]>([]);
  const carry = useRef<number[]>(spec.edges.map(() => 0));
  const rerender = useRerender(30);
  const autoplay = useAutoplay();
  // How far the stepped request is along its hop. A picked step parks it
  // mid-edge, where it is visible instead of hidden under the node card.
  const progress = useRef(0.5);

  const active = stepIndex === null ? undefined : steps[Math.min(stepIndex, steps.length - 1)];
  const activeFrom = active?.from;
  const activeTo = active?.to;
  const activeSkipped = active?.skipped ?? false;

  // Only the particles change from frame to frame. Keeping layout, edges and
  // node elements referentially stable lets DiagramCanvas reuse its curves and
  // lets React skip the node cards entirely - each is a framer-motion `layout`
  // component, which measures the DOM whenever it re-renders. In a Walkthrough
  // they change once per step, not once per frame.
  const layout = useMemo(() => toLayout(spec), [spec]);
  const wire = useMemo(
    () => (activeFrom && activeTo ? wireFor(spec.edges, activeFrom, activeTo) : undefined),
    [spec, activeFrom, activeTo],
  );
  const edges = useMemo(() => {
    const wiring: DiagramEdge[] = spec.edges.map((edge) => {
      const isActive = edge === wire?.edge;
      return {
        from: edge.from,
        to: edge.to,
        // A skipped hop stays neutral and dashed: pointed at, not travelled.
        tone: isActive && !activeSkipped ? 'brand' : (edge.tone ?? 'default'),
        label: edge.label,
        labelT: edge.labelT,
        dashed: edge.dashed || (isActive && activeSkipped),
        curvature: edge.curvature,
        // The marching ants run with the arrow, so they would contradict a reversed step.
        animated: isActive && !activeSkipped && !wire?.reversed,
        faded: activeFrom !== undefined && !isActive,
      };
    });
    // check:visuals keeps every step on a drawn edge; this only stops an
    // undrawn hop from showing nothing at all.
    if (activeFrom && activeTo && !wire) {
      wiring.push({ from: activeFrom, to: activeTo, tone: 'brand', animated: true });
    }
    return wiring;
  }, [spec, wire, activeFrom, activeTo, activeSkipped]);
  const nodes = useMemo(
    () =>
      renderNodes(
        spec,
        layout,
        activeFrom && activeTo ? new Set([activeFrom, activeTo]) : undefined,
      ),
    [spec, layout, activeFrom, activeTo],
  );

  useTicker(autoplay.running, (dt) => {
    if (stepIndex !== null) {
      progress.current += dt * 0.85;
      if (progress.current >= 1.25) {
        progress.current = 0;
        setStepIndex((value) => ((value ?? 0) + 1) % steps.length);
      }
      rerender();
      return;
    }

    spec.edges.forEach((edge, index) => {
      const rate = edge.rate ?? 0;
      if (rate <= 0) return;
      carry.current[index] = (carry.current[index] ?? 0) + rate * dt;
      while (carry.current[index] >= 1) {
        carry.current[index] -= 1;
        particles.current.push({
          id: nextParticleId(),
          route: [edge.from, edge.to],
          leg: 0,
          t: 0,
          speed: 0.75 + Math.random() * 0.35,
          outcome: edge.outcome ?? 'success',
        });
      }
    });

    const { alive } = advanceParticles(particles.current, dt);
    particles.current = alive.slice(-60);
    rerender();
  });

  const stepT = Math.min(1, progress.current);
  const particleViews: ParticleView[] = active
    ? active.skipped
      ? []
      : [
          {
            id: 1,
            from: wire?.edge.from ?? active.from,
            to: wire?.edge.to ?? active.to,
            t: wire?.reversed ? 1 - stepT : stepT,
            outcome: active.outcome ?? 'success',
          },
        ]
    : particles.current.map((particle) => ({
        id: particle.id,
        from: particle.route[0],
        to: particle.route[1],
        t: particle.t,
        outcome: particle.outcome ?? 'success',
      }));

  const showStep = (position: number) => {
    // The live traffic stops: one request on one hop is the whole point of a step.
    particles.current = [];
    progress.current = 0.5;
    setStepIndex(position);
    autoplay.setPlaying(false);
  };

  const showLive = () => {
    setStepIndex(null);
    autoplay.setPlaying(!autoplay.reducedMotion);
  };

  const width = spec.width ?? 760;
  const height = spec.height ?? 320;

  return (
    <figure ref={autoplay.ref} className={cn('overflow-hidden rounded-2xl border border-line bg-canvas', className)}>
      {steps.length > 0 ? (
        // The step caption gets its own strip above the canvas. Not an edge label
        // (on a short edge it lands on a node), and not floated over the canvas
        // (it covered whichever node sat top-left). The strip is always there, so
        // switching between Live and a step never shifts the Diagram.
        <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[11px] font-medium">
          {active && stepIndex !== null ? (
            <>
              <span className="font-mono text-faint">
                {stepIndex + 1}/{steps.length}
              </span>
              <span className="text-brand">{active.label}</span>
            </>
          ) : (
            <span className="text-muted">Live traffic - pick a step to follow one request</span>
          )}
        </div>
      ) : null}
      <DiagramCanvas
        layout={layout}
        edges={edges}
        particles={particleViews}
        width={width}
        height={height}
        grid={grid}
        fit={FLOW_FIT}
        zoom={zoom}
      >
        {nodes}
      </DiagramCanvas>
      {/* The controls sit under the canvas, not over it, so they can never cover a node. */}
      <div className="space-y-2 border-t border-line px-4 py-2">
        {steps.length > 0 ? (
          <div role="group" aria-label="Walkthrough" className="flex flex-wrap items-center gap-1.5">
            <WalkthroughChip selected={stepIndex === null} onClick={showLive}>
              Live
            </WalkthroughChip>
            {steps.map((step, position) => (
              <WalkthroughChip
                key={`${step.from}-${step.to}-${position}`}
                selected={position === stepIndex}
                onClick={() => showStep(position)}
              >
                <span className="mr-1.5 font-mono text-faint">{position + 1}</span>
                {step.label}
              </WalkthroughChip>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          {spec.caption ? <figcaption className="min-w-0 flex-1 text-xs text-muted">{spec.caption}</figcaption> : null}
          <PlayPauseButton
            playing={autoplay.playing}
            onToggle={() => autoplay.setPlaying((value) => !value)}
            className="ml-auto shrink-0"
          />
        </div>
      </div>
    </figure>
  );
}

function WalkthroughChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
        selected ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand/40 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
