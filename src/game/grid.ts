import { DIR_DX, DIR_DY, FIXTURES, footprint, opposite, rotDir } from './catalog';
import type { Rng } from './rng';
import type { Board, Dir, FixtureTypeId, Placement, PromoId, Rot } from './types';

export const DEFAULT_COLS = 14;
export const DEFAULT_ROWS = 10;
export const MAX_COLS = 20;
export const POWER_LEN = 4;

export function createBoard(rng: Rng, cols = DEFAULT_COLS, rows = DEFAULT_ROWS): Board {
  const doorW = 2;
  const doorX = Math.floor(cols / 2) - 1;
  const power: Board['power'] = [];
  // 北墙必有一段，东/西墙随机再来一段
  power.push({ side: 0, from: rng.int(cols - POWER_LEN + 1), len: POWER_LEN });
  if (rng.next() < 0.7) {
    const side: Dir = rng.next() < 0.5 ? 1 : 3;
    power.push({ side, from: rng.int(rows - 2 - POWER_LEN + 1), len: POWER_LEN });
  }
  return { cols, rows, doorX, doorW, power };
}

/** 无尽模式：向右扩 2 列，并在北墙新区域加一段电源 */
export function expandBoard(board: Board, rng: Rng): Board {
  if (board.cols >= MAX_COLS) return board;
  const cols = board.cols + 2;
  const power = [...board.power];
  if (rng.next() < 0.6) {
    const from = Math.max(0, cols - POWER_LEN - rng.int(2));
    power.push({ side: 0, from, len: POWER_LEN });
  }
  return { ...board, cols, power };
}

export function idx(board: Board, x: number, y: number) {
  return y * board.cols + x;
}

export function inBounds(board: Board, x: number, y: number) {
  return x >= 0 && y >= 0 && x < board.cols && y < board.rows;
}

export function isBuffer(board: Board, x: number, y: number) {
  return y >= board.rows - 2 && x >= board.doorX - 1 && x <= board.doorX + board.doorW;
}

export function doorCells(board: Board): { x: number; y: number }[] {
  const out = [];
  for (let i = 0; i < board.doorW; i++) out.push({ x: board.doorX + i, y: board.rows - 1 });
  return out;
}

export function cellsOf(p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>): { x: number; y: number }[] {
  const { w, h } = footprint(p.typeId, p.rot);
  const out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: p.x + dx, y: p.y + dy });
  return out;
}

/** 某一侧（世界方向）的格子及其外侧邻格 */
export function sideCells(p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>, dir: Dir) {
  const { w, h } = footprint(p.typeId, p.rot);
  const out: { x: number; y: number; ox: number; oy: number }[] = [];
  const push = (x: number, y: number) => out.push({ x, y, ox: x + DIR_DX[dir], oy: y + DIR_DY[dir] });
  if (dir === 0) for (let dx = 0; dx < w; dx++) push(p.x + dx, p.y);
  if (dir === 2) for (let dx = 0; dx < w; dx++) push(p.x + dx, p.y + h - 1);
  if (dir === 3) for (let dy = 0; dy < h; dy++) push(p.x, p.y + dy);
  if (dir === 1) for (let dy = 0; dy < h; dy++) push(p.x + w - 1, p.y + dy);
  return out;
}

/** 世界方向下的取货面 */
export function worldFaces(p: Pick<Placement, 'typeId' | 'rot'>): Dir[] {
  return FIXTURES[p.typeId].faces.map((d) => rotDir(d, p.rot));
}

export function buildOccupancy(board: Board, placements: Placement[]): Int32Array {
  const occ = new Int32Array(board.cols * board.rows).fill(-1);
  placements.forEach((p, i) => {
    for (const c of cellsOf(p)) if (inBounds(board, c.x, c.y)) occ[idx(board, c.x, c.y)] = i;
  });
  return occ;
}

/** 边界某格是否有电源（x,y 为板内贴墙格，dir 为墙方向） */
export function hasPower(board: Board, x: number, y: number, dir: Dir) {
  const coord = dir === 0 || dir === 2 ? x : y;
  return board.power.some((seg) => seg.side === dir && coord >= seg.from && coord < seg.from + seg.len);
}

export function manhattanToDoor(board: Board, p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>) {
  let best = Infinity;
  for (const c of cellsOf(p)) for (const d of doorCells(board)) best = Math.min(best, Math.abs(c.x - d.x) + Math.abs(c.y - d.y));
  return best;
}

export function minDistance(a: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>, b: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>) {
  let best = Infinity;
  for (const ca of cellsOf(a)) for (const cb of cellsOf(b)) best = Math.min(best, Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y));
  return best;
}

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

export interface PlaceContext {
  board: Board;
  placements: Placement[];
  occ: Int32Array;
  promos: PromoId[];
}

export function canPlace(ctx: PlaceContext, cand: { typeId: FixtureTypeId; x: number; y: number; rot: Rot }): PlaceCheck {
  const { board, placements, occ, promos } = ctx;
  const def = FIXTURES[cand.typeId];
  for (const c of cellsOf(cand)) {
    if (!inBounds(board, c.x, c.y)) return { ok: false, reason: '超出店面' };
    if (isBuffer(board, c.x, c.y)) return { ok: false, reason: '门口要留空' };
    if (occ[idx(board, c.x, c.y)] !== -1) return { ok: false, reason: '位置已被占' };
  }
  if (def.wall !== undefined) {
    const dir = rotDir(def.wall, cand.rot);
    const side = sideCells(cand, dir);
    if (side.some((s) => inBounds(board, s.ox, s.oy))) return { ok: false, reason: '背面必须贴墙' };
    if (def.power && !promos.includes('ice-summer')) {
      if (!side.some((s) => hasPower(board, s.x, s.y, dir))) return { ok: false, reason: '需要贴电源墙 ⚡' };
    }
  }
  if (def.attach !== undefined) {
    const dir = rotDir(def.attach, cand.rot);
    const [s] = sideCells(cand, dir);
    if (!inBounds(board, s.ox, s.oy)) return { ok: false, reason: '要贴双面货架端头' };
    const o = occ[idx(board, s.ox, s.oy)];
    if (o === -1 || placements[o].typeId !== 'double-gondola') return { ok: false, reason: '要贴双面货架端头' };
    const gondola = placements[o];
    const gondolaSide = opposite(dir);
    if (worldFaces(gondola).includes(gondolaSide)) return { ok: false, reason: '要贴短边端头，不能挡取货面' };
    if (!sideCells(gondola, gondolaSide).some((g) => g.x === s.ox && g.y === s.oy)) return { ok: false, reason: '要贴双面货架端头' };
  }
  if (def.nearChiller !== undefined) {
    const ok = placements.some((p) => p.typeId === 'upright-chiller' && minDistance(cand, p) <= def.nearChiller!);
    if (!ok) return { ok: false, reason: `${def.nearChiller} 格内要有立式冷柜` };
  }
  if (def.nearDoor !== undefined) {
    const max = promos.includes('double-checkout') ? 2 : 1;
    if (placements.filter((p) => p.typeId === cand.typeId).length >= max) return { ok: false, reason: '收银台已放' };
    if (manhattanToDoor(board, cand) > def.nearDoor) return { ok: false, reason: `要在门口 ${def.nearDoor} 格内` };
  }
  return { ok: true };
}

/** 该类型在当前局面是否还有任何合法落点 */
export function anyLegalSpot(ctx: PlaceContext, typeId: FixtureTypeId): boolean {
  const rots: Rot[] = [0, 1, 2, 3];
  for (const rot of rots) {
    const { w, h } = footprint(typeId, rot);
    for (let y = 0; y + h <= ctx.board.rows; y++) {
      for (let x = 0; x + w <= ctx.board.cols; x++) {
        if (canPlace(ctx, { typeId, x, y, rot }).ok) return true;
      }
    }
  }
  return false;
}
