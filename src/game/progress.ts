import type { FixtureTypeId } from './types';
import { FIXTURES, FIXTURE_IDS } from './catalog';

export interface StoreTier {
  level: number;
  name: string;
  cols: number;
  rows: number;
  /** 每天最多新增几个货架 */
  quota: number;
  /** 升到本级所需的累计营业额（开门赚的钱自动进分数） */
  need: number;
  /** 每日客流基数 */
  customers: number;
}

export const STORE_TIERS: StoreTier[] = [
  { level: 1, name: '街角小卖部', cols: 12, rows: 8, quota: 5, need: 0, customers: 18 },
  { level: 2, name: '社区便利店', cols: 15, rows: 9, quota: 7, need: 1200, customers: 30 },
  { level: 3, name: '生鲜超市', cols: 18, rows: 11, quota: 9, need: 4500, customers: 46 },
  { level: 4, name: '连锁大卖场', cols: 21, rows: 12, quota: 11, need: 13000, customers: 64 },
  { level: 5, name: '旗舰购物中心', cols: 24, rows: 14, quota: 14, need: 32000, customers: 88 },
];

export const MAX_TIER = STORE_TIERS.length;

export function tierOf(level: number): StoreTier {
  return STORE_TIERS[Math.min(Math.max(level, 1), MAX_TIER) - 1];
}

/** 累计营业额能支撑的店铺等级 */
export function tierForRevenue(totalRevenue: number): number {
  let level = 1;
  for (const t of STORE_TIERS) if (totalRevenue >= t.need) level = t.level;
  return level;
}

export function nextTier(level: number): StoreTier | null {
  return level < MAX_TIER ? STORE_TIERS[level] : null;
}

export function unlockedTypes(storeLevel: number): FixtureTypeId[] {
  return FIXTURE_IDS.filter((t) => FIXTURES[t].weight > 0 && FIXTURES[t].unlockLevel <= storeLevel);
}

/** 升到某级时新解锁的货架 */
export function newTypesAt(storeLevel: number): FixtureTypeId[] {
  return FIXTURE_IDS.filter((t) => FIXTURES[t].weight > 0 && FIXTURES[t].unlockLevel === storeLevel);
}

export const STARTING_COINS = 260;
/** 每台收银台的服务上限：够撑十来个货架，再多就得加台 */
export const CHECKOUT_CAPACITY = 45;
/** 每天可免费换一次手牌的次数 */
export const REROLLS_PER_DAY = 1;
