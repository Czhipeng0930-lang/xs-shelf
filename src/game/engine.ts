import { FIXTURES, costOf, footprint, refundOf, upgradeCost } from './catalog';
import { computeFlow } from './flow';
import { anyLegalSpot, buildOccupancy, canPlace, createBoard, type PlaceContext } from './grid';
import { costRate, MAX_PROMOS, PROMO_IDS } from './promo';
import { CHECKOUT_CAPACITY, REROLLS_PER_DAY, STARTING_COINS, tierForRevenue, tierOf, unlockedTypes } from './progress';
import { computeRevenue } from './revenue';
import { createRng, forkRng, type Rng } from './rng';
import type {
  Action,
  Board,
  DayReport,
  FixtureTypeId,
  FlowInfo,
  GameMode,
  Level,
  Placement,
  PromoId,
  RevenueSummary,
  Rot,
} from './types';

/** 一天没赚到钱时的街道补贴，防止彻底卡死 */
export const SUBSIDY = 90;
/** 每升一级触发一次功能牌三选一 */
export const PROMO_CHOICES = 3;

export interface HandCard {
  uid: number;
  typeId: FixtureTypeId;
  level: Level;
  variant: number;
}

export interface GameState {
  mode: GameMode;
  seed: number;
  day: number;
  storeLevel: number;
  board: Board;
  placements: Placement[];
  coins: number;
  /** 累计营业额，决定店铺等级 */
  totalRevenue: number;
  totalSpent: number;
  /** 本日已新增的货架数（收银台不占配额） */
  placedToday: number;
  hand: HandCard[];
  promos: PromoId[];
  promoOffer: PromoId[] | null;
  /** 刚升到的等级，用于弹升级面板 */
  justUpgraded: number | null;
  rerollsLeft: number;
  actions: Action[];
  occ: Int32Array;
  flow: FlowInfo;
  /** 当前布局的预估日营业额 */
  preview: RevenueSummary;
  lastReport: DayReport | null;
  lastGain: number;
  rng: Rng;
  nextUid: number;
  nextPid: number;
}

const EMPTY_SUMMARY: RevenueSummary = {
  fixtures: [], base: 0, bonus: 0, wastedCells: 0, deadFaces: 0, queueLoss: 0, demand: 0, customers: 0, total: 0,
};

function modeSalt(mode: GameMode) {
  return mode === 'daily' ? 0x9e3779b9 : 0x7f4a7c15;
}

export function handLimit(s: Pick<GameState, 'promos'>) {
  return s.promos.includes('clearance') ? 4 : 3;
}

export function quotaOf(s: Pick<GameState, 'storeLevel'>) {
  return tierOf(s.storeLevel).quota;
}

export function quotaLeft(s: Pick<GameState, 'storeLevel' | 'placedToday'>) {
  return Math.max(0, tierOf(s.storeLevel).quota - s.placedToday);
}

export function checkoutCount(s: Pick<GameState, 'placements'>) {
  return s.placements.filter((p) => p.typeId === 'checkout').length;
}

/** 第一台收银台免费，之后按原价 */
export function checkoutCost(s: Pick<GameState, 'placements' | 'promos'>) {
  return checkoutCount(s) === 0 ? 0 : Math.round(costOf('checkout', 1) * costRate(s.promos));
}

export function priceOf(s: Pick<GameState, 'placements' | 'promos'>, typeId: FixtureTypeId, level: Level) {
  if (typeId === 'checkout') return checkoutCost(s);
  return Math.round(costOf(typeId, level) * costRate(s.promos));
}

function drawOne(s: GameState): HandCard {
  const pool = unlockedTypes(s.storeLevel);
  const totalW = pool.reduce((sum, t) => sum + FIXTURES[t].weight, 0);
  let r = s.rng.next() * totalW;
  let typeId = pool[pool.length - 1];
  for (const t of pool) {
    r -= FIXTURES[t].weight;
    if (r <= 0) {
      typeId = t;
      break;
    }
  }
  // 抽到的货架一律 1 级，高级靠花分现场升级
  return { uid: s.nextUid++, typeId, level: 1, variant: s.rng.int(FIXTURES[typeId].variants) };
}

function refill(s: GameState) {
  const limit = handLimit(s);
  while (s.hand.length < limit) s.hand.push(drawOne(s));
}

function redrawHand(s: GameState) {
  s.hand = [];
  refill(s);
}

function recompute(s: GameState) {
  s.occ = buildOccupancy(s.board, s.placements);
  s.flow = computeFlow(s.board, s.occ);
  s.preview = computeRevenue(s.board, s.placements, s.occ, { storeLevel: s.storeLevel, promos: s.promos }, s.flow);
}

export function newGame(mode: GameMode, seed: number): GameState {
  const rng = createRng((seed ^ modeSalt(mode)) >>> 0);
  const s: GameState = {
    mode,
    seed,
    day: 1,
    storeLevel: 1,
    board: createBoard(rng, 1),
    placements: [],
    coins: STARTING_COINS,
    totalRevenue: 0,
    totalSpent: 0,
    placedToday: 0,
    hand: [],
    promos: [],
    promoOffer: null,
    justUpgraded: null,
    rerollsLeft: REROLLS_PER_DAY,
    actions: [],
    occ: new Int32Array(0),
    flow: { empty: new Uint8Array(0), dist: new Int32Array(0), mainPath: new Uint8Array(0), heat: new Float32Array(0), unreachable: [] },
    preview: EMPTY_SUMMARY,
    lastReport: null,
    lastGain: 0,
    rng,
    nextUid: 1,
    nextPid: 1,
  };
  refill(s);
  recompute(s);
  return s;
}

export function placeContext(s: GameState): PlaceContext {
  return { board: s.board, placements: s.placements, occ: s.occ };
}

function clone(s: GameState): GameState {
  return {
    ...s,
    rng: forkRng(s.rng),
    hand: [...s.hand],
    placements: [...s.placements],
    promos: [...s.promos],
    actions: [...s.actions],
  };
}

/** 本轮能不能再放这张牌 */
export function canAfford(s: GameState, typeId: FixtureTypeId, level: Level): { ok: boolean; reason?: string } {
  if (s.promoOffer) return { ok: false, reason: '先选一张功能牌' };
  if (typeId !== 'checkout' && quotaLeft(s) <= 0) return { ok: false, reason: '今天的货架配额用完了，开门营业吧' };
  if (s.coins < priceOf(s, typeId, level)) return { ok: false, reason: '分数不够' };
  return { ok: true };
}

/** 把已放货架升一级要花的分 */
export function upgradePrice(s: Pick<GameState, 'promos'>, typeId: FixtureTypeId, fromLevel: Level) {
  if (typeId === 'checkout' || fromLevel >= 3) return 0;
  return Math.round(upgradeCost(typeId, fromLevel) * costRate(s.promos));
}

export function canUpgrade(s: GameState, id: string): { ok: boolean; reason?: string; price: number; next: Level | null } {
  if (s.promoOffer) return { ok: false, reason: '先选一张功能牌', price: 0, next: null };
  const p = s.placements.find((q) => q.id === id);
  if (!p) return { ok: false, reason: '找不到这件货架', price: 0, next: null };
  if (p.typeId === 'checkout') return { ok: false, reason: '收银台不用升级', price: 0, next: null };
  if (p.level >= 3) return { ok: false, reason: '已经是旗舰了', price: 0, next: null };
  const next = (p.level + 1) as Level;
  const price = upgradePrice(s, p.typeId, p.level);
  if (s.coins < price) return { ok: false, reason: '分数不够', price, next };
  return { ok: true, price, next };
}

export function place(
  state: GameState,
  typeId: FixtureTypeId,
  level: Level,
  x: number,
  y: number,
  rot: Rot,
): GameState | null {
  const afford = canAfford(state, typeId, level);
  if (!afford.ok) return null;
  if (!canPlace(placeContext(state), { typeId, x, y, rot }).ok) return null;

  const s = clone(state);
  let variant = 0;
  if (typeId === 'checkout') {
    // 收银台是常驻槽位，不占手牌
  } else {
    const i = s.hand.findIndex((c) => c.typeId === typeId && c.level === level);
    if (i === -1) return null;
    variant = s.hand[i].variant;
    s.hand.splice(i, 1);
    s.placedToday++;
  }
  const price = priceOf(s, typeId, level);
  s.coins -= price;
  s.totalSpent += price;
  const before = s.preview.total;
  s.placements.push({ id: `p${s.nextPid++}`, typeId, level, x, y, rot, variant });
  s.actions.push({ kind: 'place', typeId, level, x, y, rot });
  refill(s);
  recompute(s);
  s.lastGain = s.preview.total - before;
  return s;
}

/** 摆错了可以免费挪，只要还没开门 */
export function moveFixture(state: GameState, id: string, x: number, y: number, rot: Rot): GameState | null {
  if (state.promoOffer) return null;
  const i = state.placements.findIndex((p) => p.id === id);
  if (i === -1) return null;
  const p = state.placements[i];
  if (!canPlace(placeContext(state), { typeId: p.typeId, x, y, rot }, i).ok) return null;
  const s = clone(state);
  const before = s.preview.total;
  s.placements[i] = { ...p, x, y, rot };
  s.actions.push({ kind: 'move', id, x, y, rot });
  recompute(s);
  s.lastGain = s.preview.total - before;
  return s;
}

/** 花分把已放货架升一级，不占当天配额 */
export function upgradeFixture(state: GameState, id: string): GameState | null {
  const check = canUpgrade(state, id);
  if (!check.ok || !check.next) return null;
  const i = state.placements.findIndex((p) => p.id === id);
  if (i === -1) return null;
  const p = state.placements[i];
  const s = clone(state);
  s.coins -= check.price;
  s.totalSpent += check.price;
  const before = s.preview.total;
  s.placements[i] = { ...p, level: check.next };
  s.actions.push({ kind: 'upgrade', id });
  recompute(s);
  s.lastGain = s.preview.total - before;
  return s;
}

export function removeFixture(state: GameState, id: string): GameState | null {
  if (state.promoOffer) return null;
  const i = state.placements.findIndex((p) => p.id === id);
  if (i === -1) return null;
  const p = state.placements[i];
  const s = clone(state);
  const refund = p.typeId === 'checkout' ? 0 : refundOf(p.typeId, p.level);
  s.coins += refund;
  s.placements.splice(i, 1);
  if (p.typeId !== 'checkout' && s.placedToday > 0) s.placedToday--;
  s.actions.push({ kind: 'remove', id });
  recompute(s);
  s.lastGain = 0;
  return s;
}

export function reroll(state: GameState): GameState | null {
  if (state.promoOffer || state.rerollsLeft <= 0) return null;
  const s = clone(state);
  s.rerollsLeft--;
  s.actions.push({ kind: 'reroll' });
  redrawHand(s);
  return s;
}

export function pickPromo(state: GameState, promo: PromoId): GameState | null {
  if (!state.promoOffer || !state.promoOffer.includes(promo)) return null;
  const s = clone(state);
  s.promos.push(promo);
  s.promoOffer = null;
  s.actions.push({ kind: 'pick', promo });
  refill(s);
  recompute(s);
  return s;
}

export function canOpen(s: GameState): { ok: boolean; reason?: string } {
  if (s.promoOffer) return { ok: false, reason: '先选一张功能牌' };
  if (checkoutCount(s) === 0) return { ok: false, reason: '先放一台收银台（第一台免费）' };
  return { ok: true };
}

/** 开门营业：结算当天营业额，钱进账，然后进入第二天 */
export function openStore(state: GameState): GameState | null {
  if (!canOpen(state).ok) return null;
  const s = clone(state);
  const summary = s.preview;
  const revenue = summary.total > 0 ? summary.total : SUBSIDY;

  s.lastReport = {
    day: s.day,
    storeLevel: s.storeLevel,
    revenue,
    spent: 0,
    customers: summary.customers,
    placed: s.placedToday,
    summary,
  };
  s.coins += revenue;
  s.totalRevenue += revenue;
  s.day++;
  s.placedToday = 0;
  s.rerollsLeft = REROLLS_PER_DAY;
  s.actions.push({ kind: 'open' });

  const target = tierForRevenue(s.totalRevenue);
  if (target > s.storeLevel) {
    s.storeLevel = target;
    s.board = createBoard(s.rng, target, s.board);
    s.justUpgraded = target;
    if (s.promos.length < MAX_PROMOS) {
      const remaining = PROMO_IDS.filter((p) => !s.promos.includes(p));
      if (remaining.length > 0) s.promoOffer = s.rng.shuffle([...remaining]).slice(0, PROMO_CHOICES);
    }
  } else {
    s.justUpgraded = null;
  }

  redrawHand(s);
  recompute(s);
  s.lastGain = 0;
  return s;
}

export function dismissUpgrade(state: GameState): GameState {
  return { ...state, justUpgraded: null };
}

/** 手牌是否全都买不起或没处放 */
export function handStuck(s: GameState): boolean {
  if (s.promoOffer) return false;
  if (checkoutCount(s) === 0) return false;
  if (quotaLeft(s) <= 0) return true;
  const ctx = placeContext(s);
  return !s.hand.some((c) => s.coins >= priceOf(s, c.typeId, c.level) && anyLegalSpot(ctx, c.typeId));
}

/** 店面剩余空格是否已经塞不下任何货架 */
export function boardFull(s: GameState): boolean {
  const ctx = placeContext(s);
  return !s.hand.some((c) => anyLegalSpot(ctx, c.typeId));
}

export function fixtureAt(s: GameState, x: number, y: number): Placement | null {
  for (const p of s.placements) {
    const fp = footprint(p.typeId, p.rot);
    if (x >= p.x && x < p.x + fp.w && y >= p.y && y < p.y + fp.h) return p;
  }
  return null;
}

/** 收银台承载力提示：上门人数 vs 结得了账的人数 */
export function queueInfo(s: GameState) {
  const cap = checkoutCount(s) * CHECKOUT_CAPACITY * (s.promos.includes('night-shift') ? 1.6 : 1);
  return { capacity: Math.round(cap), expected: s.preview.demand };
}

export function replay(mode: GameMode, seed: number, actions: Action[]): GameState {
  let s = newGame(mode, seed);
  for (const a of actions) {
    let next: GameState | null = null;
    if (a.kind === 'place') next = place(s, a.typeId, a.level, a.x, a.y, a.rot);
    else if (a.kind === 'move') next = moveFixture(s, a.id, a.x, a.y, a.rot);
    else if (a.kind === 'remove') next = removeFixture(s, a.id);
    else if (a.kind === 'upgrade') next = upgradeFixture(s, a.id);
    else if (a.kind === 'pick') next = pickPromo(s, a.promo);
    else if (a.kind === 'reroll') next = reroll(s);
    else next = openStore(s);
    if (!next) break;
    s = next;
  }
  return s;
}
