import { DIR_DX, DIR_DY, FIXTURES, baseRevenueOf, footprint, opposite } from './catalog';
import { computeFlow, touchesMainPath } from './flow';
import {
  backsToPower,
  backsToWall,
  cellsOf,
  idx,
  inBounds,
  manhattanToDoor,
  minDistance,
  sideCells,
  worldFaces,
} from './grid';
import { CHECKOUT_CAPACITY, tierOf } from './progress';
import type { Board, FaceInfo, FixtureRevenue, FlowInfo, Placement, PromoId, RevenueSummary } from './types';

/** 被围死的空地每格扣多少营业额 */
export const WASTE_PENALTY = 6;
/** 没朝通道的取货面每个扣多少 */
export const DEAD_FACE_PENALTY = 18;

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

/** 取货面前方那一格的人流均值 */
function faceTraffic(board: Board, flow: FlowInfo, p: Placement, dir: number): number {
  let sum = 0;
  let n = 0;
  for (const s of sideCells(p, dir as 0 | 1 | 2 | 3)) {
    if (!inBounds(board, s.ox, s.oy)) continue;
    sum += flow.heat[idx(board, s.ox, s.oy)];
    n++;
  }
  return n === 0 ? 0 : sum / n;
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
    if (fp.w === fp.h) continue; // 1×1 / 2×2 不算联排
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

export interface RevenueOpts {
  storeLevel: number;
  promos: PromoId[];
}

export function computeRevenue(
  board: Board,
  placements: Placement[],
  occ: Int32Array,
  opts: RevenueOpts,
  flowIn?: FlowInfo,
): RevenueSummary {
  const { storeLevel, promos } = opts;
  const flow = flowIn ?? computeFlow(board, occ);
  const chains = chainSizes(placements);
  const checkouts = placements.filter((p) => p.typeId === 'checkout');
  const fixtures: FixtureRevenue[] = [];
  let deadFaces = 0;

  const crowdBoost = promos.includes('loyal-crowd') ? 1.25 : 1;
  const chainCap = promos.includes('chain-effect') ? 0.8 : 0.4;

  placements.forEach((p, i) => {
    const def = FIXTURES[p.typeId];
    const worldDirs = worldFaces(p);
    const faces: FaceInfo[] = worldDirs.map((dir) => {
      const width = faceWidth(board, occ, p, dir);
      return { dir, alive: width >= 1, width };
    });
    const bonuses: FixtureRevenue['bonuses'] = [];
    const base = baseRevenueOf(p.typeId, p.level);

    if (def.base === 0) {
      fixtures.push({ id: p.id, typeId: p.typeId, level: p.level, base: 0, traffic: 0, bonuses, faces, total: 0 });
      return;
    }

    const aliveFaces = faces.filter((f) => f.alive);
    deadFaces += faces.length - aliveFaces.length;
    if (aliveFaces.length === 0) {
      bonuses.push({ label: '没有取货面朝通道', value: 0 });
      fixtures.push({ id: p.id, typeId: p.typeId, level: p.level, base, traffic: 0, bonuses, faces, total: 0 });
      return;
    }

    // 人流：取最旺的那一面
    let traffic = 0;
    for (const f of aliveFaces) traffic = Math.max(traffic, faceTraffic(board, flow, p, f.dir));
    traffic *= crowdBoost;

    let mult = aliveFaces.length / faces.length;
    if (aliveFaces.length < faces.length) bonuses.push({ label: `${faces.length - aliveFaces.length} 个面被堵`, value: mult });

    const minWidth = Math.min(...aliveFaces.map((f) => f.width));
    if (minWidth >= 2 || (promos.includes('narrow-master') && minWidth >= 1)) {
      bonuses.push({ label: minWidth >= 2 ? '通道宽敞' : '窄巷高手', value: 1.12 });
      mult *= 1.12;
    }

    const chain = chains[i];
    if (p.typeId === 'upright-chiller') {
      if (backsToPower(board, p)) {
        bonuses.push({ label: '接上电源墙 ⚡', value: 1.6 });
        mult *= 1.6;
      }
      if (chain >= 2) {
        bonuses.push({ label: `冷链区 ×${chain}`, value: 1.5 });
        mult *= 1.5;
      }
      if (placements.some((o) => o.typeId === 'warehouse-rack' && adjacent(p, o))) {
        bonuses.push({ label: '挨着仓储架', value: 0.7 });
        mult *= 0.7;
      }
      if (promos.includes('cold-chain')) {
        bonuses.push({ label: '冷链专家', value: 1.4 });
        mult *= 1.4;
      }
    } else if (chain >= 2) {
      const v = 1 + Math.min(chainCap, 0.12 * (chain - 1));
      bonuses.push({ label: `联排 ×${chain}`, value: v });
      mult *= v;
    }

    if (def.back !== undefined && p.typeId !== 'upright-chiller' && backsToWall(board, p)) {
      const v = p.typeId === 'single-wall' ? 1.45 : 1.3;
      bonuses.push({ label: '背面贴墙', value: v });
      mult *= v;
    }
    if (p.typeId === 'warehouse-rack' && placements.some((o) => o.typeId === 'upright-chiller' && adjacent(p, o))) {
      bonuses.push({ label: '挨着冷柜', value: 0.7 });
      mult *= 0.7;
    }

    if (p.typeId === 'endcap') {
      const attached = worldDirs.some((dir) => {
        const [s] = sideCells(p, dir);
        if (!inBounds(board, s.ox, s.oy)) return false;
        const o = occ[idx(board, s.ox, s.oy)];
        if (o === -1 || placements[o].typeId !== 'double-gondola') return false;
        // 必须贴在短边端头，而不是挡住取货面
        return !worldFaces(placements[o]).includes(opposite(dir));
      });
      if (attached) {
        const v = promos.includes('golden-endcap') ? 3.2 : 2.2;
        bonuses.push({ label: '端头黄金位', value: v });
        mult *= v;
      }
      if (touchesMainPath(board, flow, p.x, p.y)) {
        bonuses.push({ label: '主动线旁', value: 1.25 });
        mult *= 1.25;
      }
    }

    if (p.typeId === 'promo-display' && (promos.includes('big-sale') || touchesMainPath(board, flow, p.x, p.y))) {
      bonuses.push({ label: promos.includes('big-sale') ? '大促周' : '主动线旁', value: 3 });
      mult *= 3;
    }

    if (p.typeId === 'island-freezer') {
      if (placements.some((o) => o.typeId === 'upright-chiller' && minDistance(p, o) <= 3)) {
        bonuses.push({ label: '共用冷链线路', value: 1.45 });
        mult *= 1.45;
      }
      if (promos.includes('cold-chain')) {
        bonuses.push({ label: '冷链专家', value: 1.4 });
        mult *= 1.4;
      }
    }

    if (p.typeId === 'wood-display') {
      const d = manhattanToDoor(board, p);
      if (d <= 2) {
        bonuses.push({ label: '入口聚人气', value: 2.2 });
        mult *= 2.2;
      } else if (d <= 4) {
        bonuses.push({ label: '近门人气', value: 1.6 });
        mult *= 1.6;
      }
    }
    if (p.typeId === 'wood-display' || p.typeId === 'island-freezer') {
      const other = p.typeId === 'wood-display' ? 'island-freezer' : 'wood-display';
      if (placements.some((o) => o.typeId === other && adjacent(p, o))) {
        bonuses.push({ label: '生鲜冷链相邻', value: 1.2 });
        mult *= 1.2;
      }
    }

    if (promos.includes('member-day') && manhattanToDoor(board, p) <= 4) {
      bonuses.push({ label: '会员日', value: 1.5 });
      mult *= 1.5;
    }
    if (promos.includes('double-checkout') && checkouts.some((c) => minDistance(p, c) <= 4)) {
      bonuses.push({ label: '收银区', value: 1.15 });
      mult *= 1.15;
    }

    fixtures.push({
      id: p.id,
      typeId: p.typeId,
      level: p.level,
      base,
      traffic,
      bonuses,
      faces,
      total: Math.round(base * mult * traffic),
    });
  });

  const baseSum = fixtures.reduce((s, f) => s + (f.total > 0 ? f.base : 0), 0);
  const gross = fixtures.reduce((s, f) => s + f.total, 0);
  const wastedCells = flow.unreachable.length;
  const penalty = wastedCells * WASTE_PENALTY + deadFaces * DEAD_FACE_PENALTY;

  // 客流：店铺基数 + 货架吸引力；收银台不够会流失
  const tier = tierOf(storeLevel);
  const pull = fixtures.reduce((s, f) => s + (f.total > 0 ? 1 : 0), 0);
  const demand = Math.round((tier.customers + pull * 3) * crowdBoost);
  const capacity = checkouts.length * CHECKOUT_CAPACITY * (promos.includes('night-shift') ? 1.6 : 1);
  const served = capacity <= 0 ? 0 : Math.min(demand, Math.round(capacity));
  const serveRate = demand === 0 ? 1 : served / demand;

  const afterPenalty = Math.max(0, gross - penalty);
  const beforeQueue = Math.round(afterPenalty * serveRate);
  const queueLoss = afterPenalty - beforeQueue;
  const sample = promos.includes('free-sample') && beforeQueue > 0 ? 200 : 0;
  if (sample) fixtures.push({ id: 'free-sample', typeId: 'promo-display', level: 1, base: sample, traffic: 1, bonuses: [{ label: '免费样品', value: 1 }], faces: [], total: sample });

  return {
    fixtures,
    base: baseSum,
    bonus: gross - baseSum,
    wastedCells,
    deadFaces,
    queueLoss,
    demand,
    customers: served,
    total: beforeQueue + sample,
  };
}
