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

/** 方向：0 北(上, -y) 1 东(右, +x) 2 南(下, +y) 3 西(左, -x) */
export type Dir = 0 | 1 | 2 | 3;
/** 顺时针旋转的四分之一圈数 */
export type Rot = 0 | 1 | 2 | 3;

export interface Placement {
  id: string;
  typeId: FixtureTypeId;
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
  | 'ice-summer'
  | 'golden-endcap'
  | 'narrow-master'
  | 'big-sale'
  | 'double-checkout'
  | 'clearance';

export type Action =
  | { kind: 'place'; typeId: FixtureTypeId; x: number; y: number; rot: Rot }
  | { kind: 'pick'; promo: PromoId }
  | { kind: 'discard'; typeId: FixtureTypeId }
  | { kind: 'finish' };

export interface FaceInfo {
  dir: Dir;
  alive: boolean;
  /** 面前连续空地格数（0 = 死面） */
  width: number;
}

export interface FixtureScore {
  id: string;
  typeId: FixtureTypeId;
  base: number;
  /** 各乘数条目，用于 UI 解释 */
  bonuses: { label: string; value: number }[];
  faces: FaceInfo[];
  total: number;
}

export interface ScoreSummary {
  fixtures: FixtureScore[];
  base: number;
  bonus: number;
  wastedCells: number;
  deadFaces: number;
  penalty: number;
  total: number;
}

export interface FlowInfo {
  /** 每格是否为空地 */
  empty: Uint8Array;
  /** 每格从门出发的 BFS 距离，-1 不可达 / 非空地 */
  dist: Int32Array;
  /** 主动线格子 */
  mainPath: Uint8Array;
  unreachable: number[];
}
