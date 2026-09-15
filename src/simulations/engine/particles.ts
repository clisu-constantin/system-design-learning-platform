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
