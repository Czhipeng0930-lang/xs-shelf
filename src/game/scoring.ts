import { DIR_DX, DIR_DY, FIXTURES, footprint, opposite, rotDir } from './catalog';
import { computeFlow, touchesMainPath } from './flow';
import { cellsOf, idx, inBounds, manhattanToDoor, minDistance, sideCells, worldFaces } from './grid';
import type { Board, FaceInfo, FixtureScore, FlowInfo, Placement, PromoId, ScoreSummary } from './types';

export const WASTE_PENALTY = 5;
export const DEAD_FACE_PENALTY = 15;

function faceWidth(board: Board, occ: Int32Array, p: Placement, dir: number): number {
  let min = Infinity;
  for (const s of sideCells(p, dir as 0 | 1 | 2 | 3)) {
    let x = s.ox;
    let y = s.oy;
    let n = 0;
    while (inBounds(board, x, y) && occ[idx(board, x, y)] === -1 && n < 3) {
      n++;
      x += DIR_DX[dir];
      y += DIR_DY[dir];
    }
    min = Math.min(min, n);
  }
  return min === Infinity ? 0 : min;
}

function isHorizontal(p: Placement) {
  const fp = footprint(p.typeId, p.rot);
  return fp.w >= fp.h;
}

function inLine(a: Placement, b: Placement) {
  if (a.typeId !== b.typeId || isHorizontal(a) !== isHorizontal(b)) return false;
  const horiz = isHorizontal(a);
  for (const ca of cellsOf(a)) {
    for (const cb of cellsOf(b)) {
      if (horiz && ca.y === cb.y && Math.abs(ca.x - cb.x) === 1) return true;
      if (!horiz && ca.x === cb.x && Math.abs(ca.y - cb.y) === 1) return true;
    }
  }
  return false;
}

/** 同类联排链长度（并查集） */
function chainSizes(placements: Placement[]): number[] {
  const parent = placements.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < placements.length; i++) {
    const fp = footprint(placements[i].typeId, placements[i].rot);
    if (fp.w === fp.h) continue; // 1×1 / 2×2 不联排
    for (let j = i + 1; j < placements.length; j++) {
      if (inLine(placements[i], placements[j])) parent[find(i)] = find(j);
    }
  }
  const count = new Map<number, number>();
  for (let i = 0; i < placements.length; i++) count.set(find(i), (count.get(find(i)) ?? 0) + 1);
  return placements.map((_, i) => count.get(find(i)) ?? 1);
}

function adjacent(a: Placement, b: Placement) {
  return minDistance(a, b) === 1;
}

export interface ScoreOpts {
  /** 没放收银台就开业：总分减半 */
  noCheckout?: boolean;
}

export function scoreAll(board: Board, placements: Placement[], occ: Int32Array, promos: PromoId[], flowIn?: FlowInfo, opts: ScoreOpts = {}): ScoreSummary {
  const flow = flowIn ?? computeFlow(board, occ);
  const chains = chainSizes(placements);
  const checkouts = placements.filter((p) => p.typeId === 'checkout');
  const fixtures: FixtureScore[] = [];
  let deadFaces = 0;

  placements.forEach((p, i) => {
    const def = FIXTURES[p.typeId];
    const faces: FaceInfo[] = worldFaces(p).map((dir) => {
      const width = faceWidth(board, occ, p, dir);
      return { dir, alive: width >= 1, width };
    });
    const bonuses: FixtureScore['bonuses'] = [];
    if (def.base === 0) {
      fixtures.push({ id: p.id, typeId: p.typeId, base: 0, bonuses, faces, total: 0 });
      return;
    }
    const alive = faces.filter((f) => f.alive).length;
    deadFaces += faces.length - alive;
    if (alive === 0) {
      fixtures.push({ id: p.id, typeId: p.typeId, base: def.base, bonuses: [{ label: '没有取货面朝通道', value: 0 }], faces, total: 0 });
      return;
    }
    let mult = alive / faces.length;
    if (alive < faces.length) bonuses.push({ label: `${faces.length - alive} 个死面`, value: mult });

    const aliveFaces = faces.filter((f) => f.alive);
    const minWidth = Math.min(...aliveFaces.map((f) => f.width));
    if (minWidth >= 2 || (promos.includes('narrow-master') && minWidth >= 1)) {
      bonuses.push({ label: minWidth >= 2 ? '舒适通道' : '窄巷高手', value: 1.1 });
      mult *= 1.1;
    }

    const chain = chains[i];
    if (p.typeId === 'upright-chiller') {
      if (chain >= 2) {
        bonuses.push({ label: `冷链区 ×${chain}`, value: 1.5 });
        mult *= 1.5;
      }
      if (placements.some((o) => o.typeId === 'warehouse-rack' && adjacent(p, o))) {
        bonuses.push({ label: '挨着仓储架', value: 0.7 });
        mult *= 0.7;
      }
    } else if (chain >= 2) {
      const v = 1 + Math.min(0.4, 0.1 * (chain - 1));
      bonuses.push({ label: `联排 ×${chain}`, value: v });
      mult *= v;
    }

    if (p.typeId === 'endcap') {
      const dir = rotDir(def.attach!, p.rot);
      const [s] = sideCells(p, dir);
      const o = inBounds(board, s.ox, s.oy) ? occ[idx(board, s.ox, s.oy)] : -1;
      if (o !== -1 && placements[o].typeId === 'double-gondola' && !worldFaces(placements[o]).includes(opposite(dir))) {
        const v = promos.includes('golden-endcap') ? 3 : 2;
        bonuses.push({ label: '端头黄金位', value: v });
        mult *= v;
        if (chains[o] >= 3) {
          bonuses.push({ label: '长排端头', value: 1.2 });
          mult *= 1.2;
        }
      }
      if (touchesMainPath(board, flow, p.x, p.y)) {
        bonuses.push({ label: '主动线旁', value: 1.2 });
        mult *= 1.2;
      }
    }

    if (p.typeId === 'promo-display') {
      if (promos.includes('big-sale') || touchesMainPath(board, flow, p.x, p.y)) {
        bonuses.push({ label: promos.includes('big-sale') ? '大促周' : '主动线旁', value: 3 });
        mult *= 3;
      }
    }

    if (p.typeId === 'wood-display') {
      const d = manhattanToDoor(board, p);
      if (d <= 2) {
        bonuses.push({ label: '入口聚人气', value: 2 });
        mult *= 2;
      } else if (d <= 4) {
        bonuses.push({ label: '近门人气', value: 1.5 });
        mult *= 1.5;
      }
    }
    if (p.typeId === 'wood-display' || p.typeId === 'island-freezer') {
      const other = p.typeId === 'wood-display' ? 'island-freezer' : 'wood-display';
      if (placements.some((o) => o.typeId === other && adjacent(p, o))) {
        bonuses.push({ label: '生鲜冷链相邻', value: 1.2 });
        mult *= 1.2;
      }
    }

    if (promos.includes('double-checkout') && checkouts.some((c) => minDistance(p, c) <= 4)) {
      bonuses.push({ label: '收银区', value: 1.15 });
      mult *= 1.15;
    }

    fixtures.push({ id: p.id, typeId: p.typeId, base: def.base, bonuses, faces, total: Math.round(def.base * mult) });
  });

  const base = fixtures.reduce((s, f) => s + (f.total > 0 ? f.base : 0), 0);
  const gross = fixtures.reduce((s, f) => s + f.total, 0);
  const wastedCells = flow.unreachable.length;
  let penalty = wastedCells * WASTE_PENALTY + deadFaces * DEAD_FACE_PENALTY;
  let total = Math.max(0, gross - penalty);
  if (opts.noCheckout) {
    const cut = Math.ceil(total / 2);
    penalty += cut;
    total -= cut;
  }
  return {
    fixtures,
    base,
    bonus: gross - base,
    wastedCells,
    deadFaces,
    penalty,
    total,
  };
}
