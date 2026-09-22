import type { RequestOutcome } from '@/types';

export interface Particle {
  id: number;
  /** Ordered list of node ids the particle still has to visit. */
  route: string[];
  /** Index of the current leg: route[leg] -> route[leg + 1]. */
  leg: number;
  /** Progress along the current leg, 0..1 */
  t: number;
  /** Legs per second - higher is faster. */
  speed: number;
  outcome?: RequestOutcome;
  meta?: Record<string, unknown>;
}

let particleId = 0;
export const nextParticleId = () => (particleId += 1);

export interface AdvanceResult {
  alive: Particle[];
  finished: Particle[];
}

/**
 * Moves every particle forward by `dt` seconds and splits out the ones that
 * reached the end of their route. Pure so it can be unit-tested and reused by
 * every lab instead of each one re-implementing movement.
 */
export function advanceParticles(particles: Particle[], dt: number): AdvanceResult {
  const alive: Particle[] = [];
  const finished: Particle[] = [];

  for (const particle of particles) {
    let { leg, t } = particle;
    t += particle.speed * dt;
    while (t >= 1 && leg < particle.route.length - 2) {
      t -= 1;
      leg += 1;
    }
    if (t >= 1 && leg >= particle.route.length - 2) {
      finished.push({ ...particle, leg, t: 1 });
      continue;
    }
    alive.push({ ...particle, leg, t });
  }

  return { alive, finished };
}

export const particleEdge = (particle: Particle): [string, string] => [
  particle.route[particle.leg],
  particle.route[particle.leg + 1],
];

/**
 * Share of arrivals a lab should animate, so the canvas keeps a steady and
 * readable particle count at any traffic level.
 *
 * Particles are a *sample* of the traffic, never the traffic itself. A lab that
 * both animates and counts the same particle is capped by whatever the canvas
 * can hold: at 500 req/sec a 90-particle budget evicts every request long
 * before it reaches the end of its route, and the metrics read zero. Count
 * every arrival, and emit a particle for `visualShare(rate, target)` of them.
 *
 * `target` is particles emitted per second, not particles on screen: a route
 * that takes ~1.2s to walk holds roughly `target * 1.2` of them at once.
 */
export const visualShare = (rate: number, targetPerSecond: number) =>
  rate <= targetPerSecond ? 1 : targetPerSecond / rate;
