export type FixtureTypeId =
  | 'single-wall'
  | 'double-gondola'
  | 'endcap'
  | 'promo-display'
  | 'upright-chiller'
  | 'wood-display'
  | 'checkout';

export type CategoryId = 'snacks' | 'drinks' | 'household' | 'general' | 'produce' | 'bakery';

export interface Fixture {
  id: string;
  typeId: FixtureTypeId;
  x: number;
  y: number;
  rotationDeg: number;
  category: CategoryId | null;
}

export type Phase = 'edit' | 'open' | 'report';
export type ViewMode = '2d' | '3d';

export interface DayReport {
  day: number;
  revenue: number;
  served: number;
  windowShoppers: number;
  abandoned: number;
  impulseBuys: number;
  missingHits: number;
  satisfaction: number;
  avgQueueWait: number;
  tips: string[];
}

export interface SaveData {
  v: 1;
  day: number;
  money: number;
  fixtures: Fixture[];
  helpSeen: boolean;
  goalReached: boolean;
}
