import {
  Activity,
  Boxes,
  Cog,
  Database,
  DoorOpen,
  Globe,
  HardDrive,
  Layers,
  Monitor,
  Network,
  Scale,
  Search,
  Server,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { NodeKind } from '@/types';

export interface KindStyle {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  /** Tailwind classes for the icon chip inside a node card. */
  accent: string;
  /** Stroke colour used by edges and the node border glow. */
  stroke: string;
  /** Default capacity in req/sec used by the playground. */
  capacity: number;
  blurb: string;
}

/**
 * Single source of truth for what each infrastructure component looks like.
 * Labs and the playground both read from here, so a Redis node is recognisable
 * in every screen of the app.
 */
export const NODE_KINDS: Record<NodeKind, KindStyle> = {
  client: {
    label: 'Client',
    Icon: Monitor,
    accent: 'bg-info/10 text-info',
    stroke: 'rgb(var(--c-info))',
    capacity: 0,
    blurb: 'Browsers, mobile apps and other API consumers.',
  },
  dns: {
    label: 'DNS',
    Icon: Globe,
    accent: 'bg-violet/10 text-violet',
    stroke: 'rgb(var(--c-violet))',
    capacity: 50000,
    blurb: 'Resolves a hostname to an IP address.',
  },
  cdn: {
    label: 'CDN',
    Icon: Network,
    accent: 'bg-violet/10 text-violet',
    stroke: 'rgb(var(--c-violet))',
    capacity: 50000,
    blurb: 'Serves cached static content from an edge near the user.',
  },
  'load-balancer': {
    label: 'Load Balancer',
    Icon: Scale,
    accent: 'bg-brand/10 text-brand',
    stroke: 'rgb(var(--c-brand))',
    capacity: 20000,
    blurb: 'Distributes traffic across healthy servers.',
  },
  'api-gateway': {
    label: 'API Gateway',
    Icon: DoorOpen,
    accent: 'bg-brand/10 text-brand',
    stroke: 'rgb(var(--c-brand))',
    capacity: 8000,
    blurb: 'One entry point for auth, rate limiting and routing.',
  },
  server: {
    label: 'Server',
    Icon: Server,
    accent: 'bg-ok/10 text-ok',
    stroke: 'rgb(var(--c-ok))',
    capacity: 1000,
    blurb: 'Application server running your business logic.',
  },
  service: {
    label: 'Microservice',
    Icon: Boxes,
    accent: 'bg-ok/10 text-ok',
    stroke: 'rgb(var(--c-ok))',
    capacity: 800,
    blurb: 'Independently deployable service owning one capability.',
  },
  cache: {
    label: 'Redis Cache',
    Icon: Zap,
    accent: 'bg-danger/10 text-danger',
    stroke: 'rgb(var(--c-danger))',
    capacity: 20000,
    blurb: 'In-memory store for hot data and sessions.',
  },
  sql: {
    label: 'SQL Database',
    Icon: Database,
    accent: 'bg-info/10 text-info',
    stroke: 'rgb(var(--c-info))',
    capacity: 600,
    blurb: 'Relational database with transactions and joins.',
  },
  nosql: {
    label: 'NoSQL Database',
    Icon: Database,
    accent: 'bg-warn/10 text-warn',
    stroke: 'rgb(var(--c-warn))',
    capacity: 3000,
    blurb: 'Document or wide-column store with flexible schema.',
  },
  queue: {
    label: 'Message Queue',
    Icon: Layers,
    accent: 'bg-warn/10 text-warn',
    stroke: 'rgb(var(--c-warn))',
    capacity: 50000,
    blurb: 'Buffers work so producers and consumers can move at different speeds.',
  },
  worker: {
    label: 'Worker',
    Icon: Cog,
    accent: 'bg-violet/10 text-violet',
    stroke: 'rgb(var(--c-violet))',
    capacity: 300,
    blurb: 'Background consumer processing queued jobs.',
  },
  storage: {
    label: 'Object Storage',
    Icon: HardDrive,
    accent: 'bg-muted/10 text-muted',
    stroke: 'rgb(var(--c-faint))',
    capacity: 10000,
    blurb: 'Blob storage for images, video and backups.',
  },
  search: {
    label: 'Search Engine',
    Icon: Search,
    accent: 'bg-brand/10 text-brand',
    stroke: 'rgb(var(--c-brand))',
    capacity: 1500,
    blurb: 'Inverted index for full-text queries.',
  },
  monitoring: {
    label: 'Monitoring',
    Icon: Activity,
    accent: 'bg-ok/10 text-ok',
    stroke: 'rgb(var(--c-ok))',
    capacity: 100000,
    blurb: 'Collects metrics, logs and traces from every component.',
  },
};

export const NODE_KIND_LIST = Object.keys(NODE_KINDS) as NodeKind[];
