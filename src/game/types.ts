export type FixtureTypeId =
  | 'double-gondola'
  | 'single-wall'
  | 'endcap'
  | 'warehouse-rack'
  | 'upright-chiller'
  | 'island-freezer'
  | 'wood-display'
  | 'promo-display'
  | 'checkout';

/** 货架等级：1 普通 / 2 精品 / 3 旗舰 */
export type Level = 1 | 2 | 3;

/** 方向：0 北(上, -y) 1 东(右, +x) 2 南(下, +y) 3 西(左, -x) */
export type Dir = 0 | 1 | 2 | 3;
/** 顺时针旋转的四分之一圈数 */
export type Rot = 0 | 1 | 2 | 3;

export interface Placement {
  id: string;
  typeId: FixtureTypeId;
  level: Level;
  x: number;
  y: number;
  rot: Rot;
  /** 商品贴图变体 */
  variant: number;
}

export interface PowerSegment {
  side: Dir;
  /** 沿该墙的起始坐标（北/南墙为 x，东/西墙为 y） */
  from: number;
  len: number;
}

export interface Board {
  cols: number;
  rows: number;
  /** 门在南墙，占 [doorX, doorX + doorW) 列 */
  doorX: number;
  doorW: number;
  power: PowerSegment[];
}

export type GameMode = 'daily' | 'endless';

export type PromoId =
  | 'cold-chain'
  | 'golden-endcap'
  | 'narrow-master'
  | 'big-sale'
  | 'double-checkout'
  | 'clearance'
  | 'bulk-buy'
  | 'loyal-crowd'
  | 'chain-effect'
  | 'free-sample'
  | 'member-day'
  | 'night-shift';

export type Action =
  | { kind: 'place'; typeId: FixtureTypeId; level: Level; x: number; y: number; rot: Rot }
  | { kind: 'move'; id: string; x: number; y: number; rot: Rot }
  | { kind: 'remove'; id: string }
  | { kind: 'upgrade'; id: string }
  | { kind: 'pick'; promo: PromoId }
  | { kind: 'reroll' }
  | { kind: 'open' };

export interface FaceInfo {
  dir: Dir;
  alive: boolean;
  /** 面前连续空地格数（0 = 死面） */
  width: number;
}

export interface FixtureRevenue {
  id: string;
  typeId: FixtureTypeId;
  level: Level;
  /** 类型基础额 × 等级倍率 */
  base: number;
  /** 人流系数 */
  traffic: number;
  /** 各加成条目，用于 UI 解释 */
  bonuses: { label: string; value: number }[];
  faces: FaceInfo[];
  total: number;
}

export interface RevenueSummary {
  fixtures: FixtureRevenue[];
  /** 未计加成的基础额合计 */
  base: number;
  /** 加成带来的增量 */
  bonus: number;
  /** 被围死、走不到的空地数 */
  wastedCells: number;
  /** 没朝通道的取货面数 */
  deadFaces: number;
  /** 收银台不足导致的流失 */
  queueLoss: number;
  /** 当日上门的顾客总数 */
  demand: number;
  /** 真正结了账的顾客数 */
  customers: number;
  /** 当日营业额 */
  total: number;
}

export interface DayReport {
  day: number;
  storeLevel: number;
  revenue: number;
  spent: number;
  customers: number;
  placed: number;
  summary: RevenueSummary;
}

export interface FlowInfo {
  /** 每格是否为空地 */
  empty: Uint8Array;
  /** 每格从门出发的 BFS 距离，-1 不可达 / 非空地 */
  dist: Int32Array;
  /** 主动线格子 */
  mainPath: Uint8Array;
  /** 每格人流强度 0~1.4，非空地为 0 */
  heat: Float32Array;
  unreachable: number[];
}
