import { DIR_DX, DIR_DY, FIXTURES, footprint, rotDir } from './catalog';
import { tierOf } from './progress';
import type { Rng } from './rng';
import type { Board, Dir, FixtureTypeId, Placement, Rot } from './types';

export const POWER_LEN = 4;

/** 按店铺等级建场地；同一 seed 扩店时保留原有电源段，只在新增区域补 */
export function createBoard(rng: Rng, storeLevel: number, prev?: Board): Board {
  const tier = tierOf(storeLevel);
  const { cols, rows } = tier;
  const doorW = 2;
  const doorX = Math.floor(cols / 2) - 1;
  const power: Board['power'] = prev ? prev.power.filter((s) => s.side === 0 || s.from + s.len <= rows - 2) : [];
  if (power.length === 0) power.push({ side: 0, from: rng.int(Math.max(1, cols - POWER_LEN + 1)), len: POWER_LEN });
  // 每升一级补一段电源，保证冷柜够用
  const wanted = 1 + Math.floor(storeLevel / 2);
  while (power.length < wanted) {
    const side: Dir = rng.next() < 0.5 ? 0 : rng.next() < 0.5 ? 1 : 3;
    const span = side === 0 ? cols : rows - 2;
    power.push({ side, from: rng.int(Math.max(1, span - POWER_LEN + 1)), len: POWER_LEN });
  }
  return { cols, rows, doorX, doorW, power };
}

export function idx(board: Board, x: number, y: number) {
  return y * board.cols + x;
}

export function inBounds(board: Board, x: number, y: number) {
  return x >= 0 && y >= 0 && x < board.cols && y < board.rows;
}

/** 门口地垫：必须留空，否则顾客进不来 */
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

/** 世界方向下的背面（没有背面的返回 null） */
export function worldBack(p: Pick<Placement, 'typeId' | 'rot'>): Dir | null {
  const back = FIXTURES[p.typeId].back;
  return back === undefined ? null : rotDir(back, p.rot);
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

/** 让背面朝向某面墙所需的旋转 */
export function rotBacking(typeId: FixtureTypeId, wall: Dir): Rot {
  const back = FIXTURES[typeId].back ?? 0;
  return ((wall - back + 4) % 4) as Rot;
}

/** 货架当前贴着的墙；优先背面那一侧 */
export function flushWall(board: Board, p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>): Dir | null {
  const back = worldBack(p);
  if (back !== null && sideCells(p, back).every((s) => !inBounds(board, s.ox, s.oy))) return back;
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    if (sideCells(p, dir).length > 0 && sideCells(p, dir).every((s) => !inBounds(board, s.ox, s.oy))) return dir;
  }
  return null;
}

/**
 * 有背面的货架，手指落在墙边时自动转成背面贴墙，并贴齐。
 * 门口地垫会沿墙挪开。店面中间不改朝向。
 */
export function snapToWall(
  board: Board,
  typeId: FixtureTypeId,
  fx: number,
  fy: number,
  fallbackRot: Rot,
): { x: number; y: number; rot: Rot; snapped: boolean; wall: Dir | null } {
  const fp0 = footprint(typeId, fallbackRot);
  const plain = {
    x: fx - Math.floor((fp0.w - 1) / 2),
    y: fy - Math.floor((fp0.h - 1) / 2),
    rot: fallbackRot,
    snapped: false,
    wall: null as Dir | null,
  };
  if (FIXTURES[typeId].back === undefined) return plain;

  const edges: Dir[] = [];
  if (fy === 0) edges.push(0);
  if (fx === board.cols - 1) edges.push(1);
  if (fy === board.rows - 1) edges.push(2);
  if (fx === 0) edges.push(3);
  if (edges.length === 0) return plain;

  const facing = worldBack({ typeId, rot: fallbackRot });
  const pref: Dir[] = [0, 3, 1, 2];
  const wall = facing !== null && edges.includes(facing) ? facing : pref.find((d) => edges.includes(d))!;
  const rot = rotBacking(typeId, wall);
  const fp = footprint(typeId, rot);
  if (fp.w > board.cols || fp.h > board.rows) return plain;

  let x = fx - Math.floor((fp.w - 1) / 2);
  let y = fy - Math.floor((fp.h - 1) / 2);
  if (wall === 0) y = 0;
  if (wall === 2) y = board.rows - fp.h;
  if (wall === 3) x = 0;
  if (wall === 1) x = board.cols - fp.w;
  x = Math.max(0, Math.min(board.cols - fp.w, x));
  y = Math.max(0, Math.min(board.rows - fp.h, y));

  const along = wall === 0 || wall === 2;
  const max = along ? board.cols - fp.w : board.rows - fp.h;
  const origin = along ? x : y;
  let placed = false;
  for (let d = 0; d <= max; d++) {
    const steps = d === 0 ? [0] : [-d, d];
    for (const s of steps) {
      const v = origin + s;
      if (v < 0 || v > max) continue;
      const nx = along ? v : x;
      const ny = along ? y : v;
      const clear = cellsOf({ typeId, x: nx, y: ny, rot }).every((c) => inBounds(board, c.x, c.y) && !isBuffer(board, c.x, c.y));
      if (!clear) continue;
      x = nx;
      y = ny;
      placed = true;
      break;
    }
    if (placed) break;
  }
  if (!placed) return plain;
  return { x, y, rot, snapped: true, wall };
}

/** 背面是否贴墙 */
export function backsToWall(board: Board, p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>): boolean {
  const dir = worldBack(p);
  if (dir === null) return false;
  return sideCells(p, dir).every((s) => !inBounds(board, s.ox, s.oy));
}

/** 背面是否贴在电源墙上 */
export function backsToPower(board: Board, p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>): boolean {
  const dir = worldBack(p);
  if (dir === null || !backsToWall(board, p)) return false;
  return sideCells(p, dir).some((s) => hasPower(board, s.x, s.y, dir));
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
}

/**
 * 只有三条硬规则：不出界、不压门口地垫、不重叠。
 * 贴墙 / 电源 / 端头 / 冷链全部改成营业额加成，放哪都合法。
 */
export function canPlace(
  ctx: PlaceContext,
  cand: { typeId: FixtureTypeId; x: number; y: number; rot: Rot },
  ignoreIndex = -1,
): PlaceCheck {
  const { board, occ } = ctx;
  for (const c of cellsOf(cand)) {
    if (!inBounds(board, c.x, c.y)) return { ok: false, reason: '超出店面' };
    if (isBuffer(board, c.x, c.y)) return { ok: false, reason: '门口要留空' };
    const o = occ[idx(board, c.x, c.y)];
    if (o !== -1 && o !== ignoreIndex) return { ok: false, reason: '这里已经有货架了' };
  }
  return { ok: true };
}

/** 该类型在当前局面是否还有任何合法落点 */
export function anyLegalSpot(ctx: PlaceContext, typeId: FixtureTypeId): boolean {
  const rots: Rot[] = [0, 1];
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
