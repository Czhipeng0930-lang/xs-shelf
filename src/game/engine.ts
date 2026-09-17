import { FIXTURES, FIXTURE_IDS, UNLOCK_TIERS } from './catalog';
import { computeFlow } from './flow';
import { anyLegalSpot, buildOccupancy, canPlace, createBoard, expandBoard, MAX_COLS, type PlaceContext } from './grid';
import { MAX_PROMOS, PROMO_IDS } from './promo';
import { createRng, forkRng, type Rng } from './rng';
import { scoreAll } from './scoring';
import type { Action, Board, FixtureTypeId, FlowInfo, GameMode, Placement, PromoId, Rot, ScoreSummary } from './types';

export const DECK_SIZE = 36;
export const ENDLESS_DECK_BONUS = 14;
export const DISCARDS = 3;

export interface HandCard {
  uid: number;
  typeId: FixtureTypeId;
  variant: number;
}

export interface GameState {
  mode: GameMode;
  seed: number;
  board: Board;
  placements: Placement[];
  hand: HandCard[];
  deckRemaining: number;
  promos: PromoId[];
  promoOffer: PromoId[] | null;
  tier: number;
  pendingOffers: number;
  discardsLeft: number;
  actions: Action[];
  occ: Int32Array;
  flow: FlowInfo;
  score: ScoreSummary;
  finished: boolean;
  expansions: number;
  /** 最近一次放置的得分（用于飘分） */
  lastGain: number;
  rng: Rng;
  nextUid: number;
}

function modeSalt(mode: GameMode) {
  return mode === 'daily' ? 0x9e3779b9 : 0x7f4a7c15;
}

export function handLimit(s: Pick<GameState, 'promos'>) {
  return s.promos.includes('clearance') ? 4 : 3;
}

function unlockedScore(tier: number) {
  return tier === 0 ? 0 : UNLOCK_TIERS[Math.min(tier, UNLOCK_TIERS.length) - 1];
}

export function unlockedTypes(tier: number): FixtureTypeId[] {
  const limit = unlockedScore(tier);
  return FIXTURE_IDS.filter((t) => FIXTURES[t].weight > 0 && FIXTURES[t].unlockAt <= limit);
}

function drawOne(s: GameState): HandCard {
  const pool = unlockedTypes(s.tier);
  const total = pool.reduce((sum, t) => sum + FIXTURES[t].weight, 0);
  let r = s.rng.next() * total;
  let typeId = pool[pool.length - 1];
  for (const t of pool) {
    r -= FIXTURES[t].weight;
    if (r <= 0) {
      typeId = t;
      break;
    }
  }
  const variant = s.rng.int(FIXTURES[typeId].variants);
  return { uid: s.nextUid++, typeId, variant };
}

function refill(s: GameState) {
  const limit = handLimit(s);
  while (s.hand.length < limit && s.deckRemaining > 0) {
    s.hand.push(drawOne(s));
    s.deckRemaining--;
  }
}

function recompute(s: GameState) {
  s.occ = buildOccupancy(s.board, s.placements);
  s.flow = computeFlow(s.board, s.occ);
  s.score = scoreAll(s.board, s.placements, s.occ, s.promos, s.flow, { noCheckout: s.finished && !checkoutPlaced(s) });
}

export function newGame(mode: GameMode, seed: number): GameState {
  const rng = createRng((seed ^ modeSalt(mode)) >>> 0);
  const board = createBoard(rng);
  const s: GameState = {
    mode,
    seed,
    board,
    placements: [],
    hand: [],
    deckRemaining: DECK_SIZE,
    promos: [],
    promoOffer: null,
    tier: 0,
    pendingOffers: 0,
    discardsLeft: DISCARDS,
    actions: [],
    occ: new Int32Array(0),
    flow: { empty: new Uint8Array(0), dist: new Int32Array(0), mainPath: new Uint8Array(0), unreachable: [] },
    score: { fixtures: [], base: 0, bonus: 0, wastedCells: 0, deadFaces: 0, penalty: 0, total: 0 },
    finished: false,
    expansions: 0,
    lastGain: 0,
    rng,
    nextUid: 1,
  };
  refill(s);
  // 开局保底：手里至少有一张双面货架，避免端架无处可贴
  if (!s.hand.some((c) => c.typeId === 'double-gondola')) s.hand[0] = { ...s.hand[0], typeId: 'double-gondola' };
  recompute(s);
  return s;
}

export function placeContext(s: GameState): PlaceContext {
  return { board: s.board, placements: s.placements, occ: s.occ, promos: s.promos };
}

export function checkoutPlaced(s: GameState) {
  return s.placements.some((p) => p.typeId === 'checkout');
}

export function canPlaceCheckout(s: GameState) {
  const max = s.promos.includes('double-checkout') ? 2 : 1;
  return s.placements.filter((p) => p.typeId === 'checkout').length < max;
}

/** 手牌里是否有该类型（收银台是常驻槽位） */
function takeFromHand(s: GameState, typeId: FixtureTypeId): HandCard | null {
  if (typeId === 'checkout') return canPlaceCheckout(s) ? { uid: 0, typeId, variant: 0 } : null;
  const i = s.hand.findIndex((c) => c.typeId === typeId);
  if (i === -1) return null;
  return s.hand.splice(i, 1)[0];
}

function clone(s: GameState): GameState {
  return { ...s, rng: forkRng(s.rng), hand: [...s.hand], placements: [...s.placements], promos: [...s.promos], actions: [...s.actions] };
}

function checkUnlock(s: GameState) {
  while (s.tier < UNLOCK_TIERS.length && s.score.total >= UNLOCK_TIERS[s.tier]) {
    s.tier++;
    s.pendingOffers++;
  }
  if (!s.promoOffer && s.pendingOffers > 0) {
    s.pendingOffers--;
    if (s.promos.length < MAX_PROMOS) {
      const remaining = PROMO_IDS.filter((p) => !s.promos.includes(p));
      if (remaining.length > 0) s.promoOffer = s.rng.shuffle([...remaining]).slice(0, 3);
    }
  }
}

function afterMove(s: GameState) {
  recompute(s);
  checkUnlock(s);
  const exhausted = s.hand.length === 0 && s.deckRemaining === 0;
  if (s.mode === 'endless' && s.board.cols < MAX_COLS && (exhausted || handStuck(s))) {
    // 无尽模式：牌抽干或无处可放 → 扩店、补牌
    s.board = expandBoard(s.board, s.rng);
    s.expansions++;
    s.deckRemaining += ENDLESS_DECK_BONUS;
    s.discardsLeft++;
    refill(s);
    recompute(s);
    return;
  }
  if (exhausted && checkoutPlaced(s)) s.finished = true;
}

export function place(state: GameState, typeId: FixtureTypeId, x: number, y: number, rot: Rot): GameState | null {
  if (state.finished || state.promoOffer) return null;
  if (!canPlace(placeContext(state), { typeId, x, y, rot }).ok) return null;
  const s = clone(state);
  const card = takeFromHand(s, typeId);
  if (!card) return null;
  const before = s.score.total;
  s.placements.push({ id: `p${s.placements.length + 1}`, typeId, x, y, rot, variant: card.variant });
  s.actions.push({ kind: 'place', typeId, x, y, rot });
  refill(s);
  afterMove(s);
  s.lastGain = s.score.total - before;
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
  checkUnlock(s);
  return s;
}

export function discard(state: GameState, typeId: FixtureTypeId): GameState | null {
  if (state.finished || state.promoOffer || state.discardsLeft <= 0 || typeId === 'checkout') return null;
  const s = clone(state);
  if (!takeFromHand(s, typeId)) return null;
  s.discardsLeft--;
  s.actions.push({ kind: 'discard', typeId });
  refill(s);
  afterMove(s);
  s.lastGain = 0;
  return s;
}

/** 开业：需要已放收银台；若手牌已无处可放（含收银台），允许无收银台开业但总分减半 */
export function canFinish(state: GameState): boolean {
  if (state.finished) return false;
  return checkoutPlaced(state) || handStuck(state);
}

export function finish(state: GameState): GameState | null {
  if (!canFinish(state)) return null;
  const s = clone(state);
  s.finished = true;
  s.promoOffer = null;
  s.actions.push({ kind: 'finish' });
  recompute(s);
  return s;
}

/** 手牌是否全部无处可放（用于提示开业） */
export function handStuck(s: GameState): boolean {
  if (s.finished) return false;
  const ctx = placeContext(s);
  const anyHand = s.hand.some((c) => anyLegalSpot(ctx, c.typeId));
  if (anyHand) return false;
  if (canPlaceCheckout(s) && !checkoutPlaced(s) && anyLegalSpot(ctx, 'checkout')) return false;
  return true;
}

export function replay(mode: GameMode, seed: number, actions: Action[]): GameState {
  let s = newGame(mode, seed);
  for (const a of actions) {
    let next: GameState | null = null;
    if (a.kind === 'place') next = place(s, a.typeId, a.x, a.y, a.rot);
    else if (a.kind === 'pick') next = pickPromo(s, a.promo);
    else if (a.kind === 'discard') next = discard(s, a.typeId);
    else next = finish(s);
    if (!next) break;
    s = next;
  }
  return s;
}
