/**
 * Concepts that were merged into another one, as retired slug -> kept slug.
 *
 * A retired slug has no page, lesson or Diagram any more. It is listed here
 * only so that old links and bookmarks redirect to the kept Concept (see the
 * router), and so that progress saved under it moves to the kept Concept (see
 * ProgressProvider). Keep entries forever: removing one breaks both.
 */
export const MERGED_CONCEPTS: Readonly<Record<string, string>> = {
  'circuit-breaker-pattern': 'circuit-breaker',
  'event-driven-architecture-arch': 'event-driven-architecture',
  tracing: 'distributed-tracing',
  'publish-subscribe': 'pub-sub',
};
