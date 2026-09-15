import {
  Activity,
  ArrowLeftRight,
  Boxes,
  Circle,
  Compass,
  Database,
  Globe,
  Layers,
  Lock,
  Network,
  Shapes,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Explicit icon map for the navigation.
 *
 * Importing the whole lucide-react namespace to resolve icons by name pulls
 * every icon into the main bundle, so the icons used by categories are listed
 * here instead.
 */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Activity,
  ArrowLeftRight,
  Boxes,
  Compass,
  Database,
  Globe,
  Layers,
  Lock,
  Network,
  Shapes,
  ShieldCheck,
  TrendingUp,
  Zap,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon className={className} />;
}
