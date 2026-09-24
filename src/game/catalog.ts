import type { Dir, FixtureTypeId, Level, Rot } from './types';

export interface FixtureDef {
  typeId: FixtureTypeId;
  name: string;
  short: string;
  /** rot=0 时占格 */
  w: number;
  h: number;
  /** rot=0 时的取货面 */
  faces: Dir[];
  /** rot=0 时的背面（贴墙有加成，但不强制） */
  back?: Dir;
  /** 1 级日营业额 */
  base: number;
  /** 1 级造价 */
  cost: number;
  /** 抽卡权重（0 = 不进牌库） */
  weight: number;
  /** 解锁所需店铺等级 */
  unlockLevel: number;
  color: string;
  dark: string;
  hint: string;
  /** 一句话赚钱要点，显示在卡片和选中提示上 */
  tip: string;
  variants: number;
}

export const FIXTURES: Record<FixtureTypeId, FixtureDef> = {
  'double-gondola': {
    typeId: 'double-gondola', name: '双面货架', short: '双面', w: 2, h: 1, faces: [0, 2],
    base: 60, cost: 50, weight: 5, unlockLevel: 1, color: '#3fb47f', dark: '#1c6a4a',
    hint: '前后两面都能取货', tip: '两面都留通道；同类连排每多一件 +12%', variants: 3,
  },
  'single-wall': {
    typeId: 'single-wall', name: '单面货架', short: '单面', w: 2, h: 1, faces: [2], back: 0,
    base: 46, cost: 38, weight: 4, unlockLevel: 1, color: '#5b8fe6', dark: '#2b4f9e',
    hint: '只有一面取货', tip: '背面贴墙 +45%，不贴也能放', variants: 3,
  },
  endcap: {
    typeId: 'endcap', name: '端架', short: '端架', w: 1, h: 1, faces: [0, 1, 2, 3],
    base: 28, cost: 26, weight: 3, unlockLevel: 1, color: '#f0a03a', dark: '#a5621a',
    hint: '小巧的黄金位', tip: '贴在双面货架端头 ×2.2，主动线旁再 +25%', variants: 2,
  },
  'promo-display': {
    typeId: 'promo-display', name: '促销堆头', short: '堆头', w: 1, h: 1, faces: [0, 1, 2, 3],
    base: 24, cost: 22, weight: 3, unlockLevel: 1, color: '#ef6b5c', dark: '#a53a2f',
    hint: '冲动消费之王', tip: '挨着主动线（黄脚印）×3', variants: 2,
  },
  'warehouse-rack': {
    typeId: 'warehouse-rack', name: '仓储架', short: '仓储', w: 3, h: 1, faces: [2], back: 0,
    base: 115, cost: 95, weight: 2, unlockLevel: 2, color: '#e58b37', dark: '#8f4f16',
    hint: '又长又能装', tip: '背面贴墙 +30%；别挨着冷柜（−30%）', variants: 2,
  },
  'upright-chiller': {
    typeId: 'upright-chiller', name: '立式冷柜', short: '立冷', w: 2, h: 1, faces: [2], back: 0,
    base: 125, cost: 110, weight: 2, unlockLevel: 2, color: '#4fc6d8', dark: '#1e7a8a',
    hint: '冷饮利润高', tip: '背面贴 ⚡ 电源墙 +60%；两台连排成冷链区 +50%', variants: 2,
  },
  'island-freezer': {
    typeId: 'island-freezer', name: '卧式冰柜', short: '冰柜', w: 2, h: 1, faces: [0, 2],
    base: 105, cost: 92, weight: 2, unlockLevel: 3, color: '#6c86d6', dark: '#3a4f96',
    hint: '矮柜，能放中间', tip: '3 格内有立式冷柜 +45%（共用线路）', variants: 2,
  },
  'wood-display': {
    typeId: 'wood-display', name: '生鲜木架', short: '木架', w: 2, h: 2, faces: [0, 1, 2, 3],
    base: 95, cost: 88, weight: 2, unlockLevel: 3, color: '#b98455', dark: '#5b3a22',
    hint: '四面都能拿，聚人气', tip: '离门 ≤4 格 +60%，≤2 格 +120%', variants: 2,
  },
  checkout: {
    typeId: 'checkout', name: '收银台', short: '收银', w: 2, h: 1, faces: [2],
    base: 0, cost: 60, weight: 0, unlockLevel: 1, color: '#8e78e0', dark: '#4d3e9a',
    hint: '结账口', tip: '每台最多服务 45 位顾客，不够会流失客人', variants: 1,
  },
};

export const FIXTURE_IDS = Object.keys(FIXTURES) as FixtureTypeId[];

export const LEVELS: Level[] = [1, 2, 3];

/** 等级对造价的倍率 */
export const LEVEL_COST = [1, 2.6, 6.2] as const;
/** 等级对营业额的倍率（空间有限，所以高级永远更划算） */
export const LEVEL_REVENUE = [1, 2.4, 5.6] as const;
export const LEVEL_NAME = ['普通', '精品', '旗舰'] as const;

export function costOf(typeId: FixtureTypeId, level: Level): number {
  return Math.round(FIXTURES[typeId].cost * LEVEL_COST[level - 1]);
}

/** 从当前级升到下一级要补的差价（越往后越贵） */
export function upgradeCost(typeId: FixtureTypeId, fromLevel: Level): number {
  if (fromLevel >= 3) return 0;
  const next = (fromLevel + 1) as Level;
  return costOf(typeId, next) - costOf(typeId, fromLevel);
}

export function baseRevenueOf(typeId: FixtureTypeId, level: Level): number {
  return Math.round(FIXTURES[typeId].base * LEVEL_REVENUE[level - 1]);
}

/** 拆除退款比例 */
export const REFUND_RATE = 0.6;

export function refundOf(typeId: FixtureTypeId, level: Level): number {
  return Math.round(costOf(typeId, level) * REFUND_RATE);
}

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
