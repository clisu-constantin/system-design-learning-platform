export interface MachineTier {
  id: string;
  name: string;
  cpu: number;
  ramGb: number;
  capacity: number;
  /** Relative monthly cost - only useful for comparing tiers to each other. */
  costPerMonth: number;
}

/** Vertical scaling ladder. Note that cost grows faster than capacity. */
export const MACHINE_TIERS: MachineTier[] = [
  { id: 'small', name: 'Small', cpu: 2, ramGb: 4, capacity: 500, costPerMonth: 40 },
  { id: 'medium', name: 'Medium', cpu: 4, ramGb: 16, capacity: 1000, costPerMonth: 120 },
  { id: 'large', name: 'Large', cpu: 8, ramGb: 32, capacity: 2000, costPerMonth: 320 },
  { id: 'xlarge', name: 'XLarge', cpu: 16, ramGb: 64, capacity: 3600, costPerMonth: 780 },
  { id: 'metal', name: 'Bare metal', cpu: 64, ramGb: 256, capacity: 8000, costPerMonth: 2600 },
];
