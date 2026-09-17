import type { Dir, FixtureTypeId, Rot } from './types';

export interface FixtureDef {
  typeId: FixtureTypeId;
  name: string;
  short: string;
  /** rot=0 时占格 */
  w: number;
  h: number;
  /** rot=0 时的取货面 */
  faces: Dir[];
  /** rot=0 时必须贴墙的一侧 */
  wall?: Dir;
  /** 贴墙一侧需要电源 */
  power?: boolean;
  /** rot=0 时必须贴双面货架短边端头的一侧（端架） */
  attach?: Dir;
  /** 曼哈顿距离内必须有立式冷柜 */
  nearChiller?: number;
  /** 距门格数上限（收银台） */
  nearDoor?: number;
  base: number;
  /** 抽卡权重（0 = 不进牌库） */
  weight: number;
  /** 解锁分数阈值 */
  unlockAt: number;
  color: string;
  dark: string;
  hint: string;
  variants: number;
}

export const FIXTURES: Record<FixtureTypeId, FixtureDef> = {
  'double-gondola': {
    typeId: 'double-gondola', name: '双面货架', short: '双面', w: 2, h: 1, faces: [0, 2],
    base: 60, weight: 5, unlockAt: 0, color: '#3fb47f', dark: '#1c6a4a',
    hint: '前后两面都能取货，两面都要留通道', variants: 3,
  },
  'single-wall': {
    typeId: 'single-wall', name: '单面货架', short: '单面', w: 2, h: 1, faces: [2], wall: 0,
    base: 40, weight: 3, unlockAt: 0, color: '#5b8fe6', dark: '#2b4f9e',
    hint: '背面必须贴墙，正面留通道', variants: 3,
  },
  endcap: {
    typeId: 'endcap', name: '端架', short: '端架', w: 1, h: 1, faces: [2], attach: 0,
    base: 30, weight: 2, unlockAt: 0, color: '#f0a03a', dark: '#a5621a',
    hint: '贴在双面货架的端头，得分翻倍', variants: 2,
  },
  'promo-display': {
    typeId: 'promo-display', name: '促销堆头', short: '堆头', w: 1, h: 1, faces: [0, 1, 2, 3],
    base: 20, weight: 2, unlockAt: 0, color: '#ef6b5c', dark: '#a53a2f',
    hint: '放在主动线旁 ×3', variants: 2,
  },
  'warehouse-rack': {
    typeId: 'warehouse-rack', name: '仓储架', short: '仓储', w: 3, h: 1, faces: [2],
    base: 110, weight: 2, unlockAt: 300, color: '#e58b37', dark: '#8f4f16',
    hint: '又高又长，单面取货，靠墙不靠墙都行；别挨着冷柜', variants: 2,
  },
  'upright-chiller': {
    typeId: 'upright-chiller', name: '立式冷柜', short: '立冷', w: 2, h: 1, faces: [2], wall: 0, power: true,
    base: 120, weight: 2, unlockAt: 300, color: '#4fc6d8', dark: '#1e7a8a',
    hint: '背面必须贴电源墙；两台以上连排成冷链区', variants: 2,
  },
  'island-freezer': {
    typeId: 'island-freezer', name: '卧式冰柜', short: '冰柜', w: 2, h: 1, faces: [0, 2], nearChiller: 2,
    base: 100, weight: 1.5, unlockAt: 800, color: '#6c86d6', dark: '#3a4f96',
    hint: '2 格内要有立式冷柜共用线路', variants: 2,
  },
  'wood-display': {
    typeId: 'wood-display', name: '木架', short: '木架', w: 2, h: 2, faces: [0, 1, 2, 3],
    base: 90, weight: 1.5, unlockAt: 800, color: '#b98455', dark: '#5b3a22',
    hint: '生鲜烘焙台，离门越近人气越高', variants: 2,
  },
  checkout: {
    typeId: 'checkout', name: '收银台', short: '收银', w: 2, h: 1, faces: [2], nearDoor: 3,
    base: 0, weight: 0, unlockAt: 0, color: '#8e78e0', dark: '#4d3e9a',
    hint: '必须放在门口 3 格内，放好才能开业', variants: 1,
  },
};

export const FIXTURE_IDS = Object.keys(FIXTURES) as FixtureTypeId[];

export const UNLOCK_TIERS = [400, 1000, 1800] as const;

export function rotDir(d: Dir, rot: Rot): Dir {
  return ((d + rot) % 4) as Dir;
}

export function footprint(typeId: FixtureTypeId, rot: Rot): { w: number; h: number } {
  const def = FIXTURES[typeId];
  return rot % 2 === 1 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

export const DIR_DX = [0, 1, 0, -1] as const;
export const DIR_DY = [-1, 0, 1, 0] as const;

export function opposite(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}
