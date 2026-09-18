import type { ConceptDepth } from '@/types';

/**
 * One category file of long-form teaching content, keyed by concept slug.
 *
 * It lives apart from the concept catalogue for two reasons: the catalogue is a
 * dense index (one screen per concept) and this is the opposite, several hundred
 * words each; and keeping it separate is what lets it be code-split away from
 * the main bundle. See ./index.ts for how it is loaded.
 */
export type DepthMap = Record<string, ConceptDepth>;
