import type { Category } from '@/types';

/**
 * Left-hand navigation groups. `icon` refers to a lucide-react icon name and is
 * resolved in the sidebar so that this file stays free of JSX.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    blurb: 'Requirements, estimation and how to think about a design.',
    icon: 'Compass',
    accent: 'brand',
  },
  {
    id: 'scaling',
    title: 'Scaling',
    blurb: 'Make one machine bigger, or make many machines cooperate.',
    icon: 'TrendingUp',
    accent: 'ok',
  },
  {
    id: 'networking',
    title: 'Networking',
    blurb: 'How a request finds your servers and gets there fast.',
    icon: 'Globe',
    accent: 'violet',
  },
  {
    id: 'data',
    title: 'Data',
    blurb: 'Storing, indexing, replicating and splitting your data.',
    icon: 'Database',
    accent: 'info',
  },
  {
    id: 'performance',
    title: 'Performance',
    blurb: 'Caching layers and the cost of every millisecond.',
    icon: 'Zap',
    accent: 'warn',
  },
  {
    id: 'distributed',
    title: 'Distributed Systems',
    blurb: 'What breaks once state lives on more than one machine.',
    icon: 'Network',
    accent: 'violet',
  },
  {
    id: 'communication',
    title: 'Communication',
    blurb: 'How services talk: REST, gRPC, GraphQL, streaming.',
    icon: 'ArrowLeftRight',
    accent: 'brand',
  },
  {
    id: 'async',
    title: 'Asynchronous Systems',
    blurb: 'Queues, events and work that happens later.',
    icon: 'Layers',
    accent: 'warn',
  },
  {
    id: 'reliability',
    title: 'Reliability',
    blurb: 'Staying up while individual components fail.',
    icon: 'ShieldCheck',
    accent: 'ok',
  },
  {
    id: 'security',
    title: 'Security',
    blurb: 'Identity, access, transport and abuse protection.',
    icon: 'Lock',
    accent: 'danger',
  },
  {
    id: 'architecture',
    title: 'Architecture',
    blurb: 'Monoliths, services, events - and when each fits.',
    icon: 'Boxes',
    accent: 'info',
  },
  {
    id: 'observability',
    title: 'Observability',
    blurb: 'Knowing what your system is doing right now.',
    icon: 'Activity',
    accent: 'ok',
  },
  {
    id: 'patterns',
    title: 'Design Patterns',
    blurb: 'Reusable shapes that show up in every large system.',
    icon: 'Shapes',
    accent: 'violet',
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<Category['id'], Category>;
