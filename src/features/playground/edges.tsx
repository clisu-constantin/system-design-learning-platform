import { BaseEdge, getBezierPath, type EdgeProps } from 'reactflow';
import { useThemeColors, type ColorToken } from '@/app/providers/ThemeProvider';

export interface PlaygroundEdgeData {
  running: boolean;
  /** Particles per second on this edge - drives how many dots are in flight. */
  intensity: number;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
}

/** Theme token per tone. The particles are SVG `fill` attributes, which cannot read var(). */
const TONE: Record<NonNullable<PlaygroundEdgeData['tone']>, ColorToken> = {
  ok: 'brand',
  warn: 'warn',
  danger: 'danger',
  muted: 'faint',
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
  const colors = useThemeColors();
  const tone = data?.tone ?? 'muted';
  const color = colors[TONE[tone]];
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
