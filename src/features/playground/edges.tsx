import { BaseEdge, getBezierPath, type EdgeProps } from 'reactflow';

export interface PlaygroundEdgeData {
  running: boolean;
  /** Particles per second on this edge - drives how many dots are in flight. */
  intensity: number;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
}

const TONE: Record<NonNullable<PlaygroundEdgeData['tone']>, string> = {
  ok: 'rgb(var(--c-brand))',
  warn: 'rgb(var(--c-warn))',
  danger: 'rgb(var(--c-danger))',
  muted: 'rgb(var(--c-faint))',
};

/**
 * Edge with real request particles: SVG animateMotion follows the same path the
 * edge is drawn with, so dots track the curve without a JS animation loop.
 */
export function PlaygroundEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<PlaygroundEdgeData>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const tone = data?.tone ?? 'muted';
  const color = TONE[tone];
  const particleCount = data?.running ? Math.min(4, Math.max(1, Math.round((data.intensity ?? 0) * 3))) : 0;
  const duration = 1.8;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: color, strokeWidth: tone === 'muted' ? 1.5 : 2, opacity: tone === 'muted' ? 0.5 : 0.9 }}
      />
      {Array.from({ length: particleCount }, (_, index) => (
        <circle key={index} r={4} fill={color}>
          <animateMotion
            dur={`${duration}s`}
            begin={`${(index * duration) / particleCount}s`}
            repeatCount="indefinite"
            path={path}
          />
        </circle>
      ))}
    </>
  );
}

export const edgeTypes = { request: PlaygroundEdge };
