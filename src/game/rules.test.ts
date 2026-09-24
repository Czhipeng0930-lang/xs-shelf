import { describe, expect, it } from 'vitest';
import { baseRevenueOf, costOf, LEVEL_COST, LEVEL_REVENUE } from './catalog';
import { computeFlow } from './flow';
import { anyLegalSpot, backsToWall, buildOccupancy, canPlace, createBoard, isBuffer, snapToWall, type PlaceContext } from './grid';
import { STORE_TIERS, tierForRevenue, tierOf, unlockedTypes } from './progress';
import { computeRevenue } from './revenue';
import { createRng } from './rng';
import type { Board, Level, Placement } from './types';

function board(): Board {
  return { cols: 14, rows: 10, doorX: 6, doorW: 2, power: [{ side: 0, from: 2, len: 4 }] };
}

function ctx(b: Board, placements: Placement[]): PlaceContext {
  return { board: b, placements, occ: buildOccupancy(b, placements) };
}

let n = 0;
function p(typeId: Placement['typeId'], x: number, y: number, rot: Placement['rot'] = 0, level: Level = 1): Placement {
  return { id: `t${++n}`, typeId, level, x, y, rot, variant: 0 };
}

function revenue(b: Board, placements: Placement[], storeLevel = 3) {
  return computeRevenue(b, placements, buildOccupancy(b, placements), { storeLevel, promos: [] });
}

describe('createBoard', () => {
  it('按店铺等级出场地，门居中，北墙有电源', () => {
    const b = createBoard(createRng(42), 1);
    expect(b.cols).toBe(STORE_TIERS[0].cols);
    expect(b.rows).toBe(STORE_TIERS[0].rows);
    expect(b.doorX).toBe(Math.floor(b.cols / 2) - 1);
    expect(b.power.length).toBeGreaterThan(0);
    expect(isBuffer(b, b.doorX, b.rows - 1)).toBe(true);
    expect(isBuffer(b, b.doorX, 0)).toBe(false);
  });

  it('升级后场地变大、配额变多', () => {
    const rng = createRng(7);
    const small = createBoard(rng, 1);
    const big = createBoard(rng, 3, small);
    expect(big.cols).toBeGreaterThan(small.cols);
    expect(tierOf(3).quota).toBeGreaterThan(tierOf(1).quota);
  });
});

describe('snapToWall', () => {
  it('贴北墙时单面货架背面朝上，不用手转', () => {
    const b = board();
    const s = snapToWall(b, 'single-wall', 4, 0, 1);
    expect(s.snapped).toBe(true);
    expect(s.rot).toBe(0);
    expect(s.y).toBe(0);
    expect(backsToWall(b, { typeId: 'single-wall', x: s.x, y: s.y, rot: s.rot })).toBe(true);
  });

  it('贴西墙时转成竖放', () => {
    const b = board();
    const s = snapToWall(b, 'warehouse-rack', 0, 4, 0);
    expect(s.rot).toBe(3);
    expect(s.x).toBe(0);
    expect(backsToWall(b, { typeId: 'warehouse-rack', x: s.x, y: s.y, rot: s.rot })).toBe(true);
  });

  it('店面中间不改朝向，双面货架从不自动转', () => {
    const b = board();
    expect(snapToWall(b, 'single-wall', 5, 4, 1).snapped).toBe(false);
    expect(snapToWall(b, 'double-gondola', 0, 0, 1).snapped).toBe(false);
  });
});

describe('canPlace', () => {
  it('只有越界 / 门口 / 重叠三条硬规则', () => {
    const b = board();
    expect(canPlace(ctx(b, []), { typeId: 'double-gondola', x: 13, y: 0, rot: 0 }).ok).toBe(false);
    expect(canPlace(ctx(b, []), { typeId: 'promo-display', x: 6, y: 9, rot: 0 }).ok).toBe(false);
    const c = ctx(b, [p('double-gondola', 2, 2)]);
    expect(canPlace(c, { typeId: 'double-gondola', x: 3, y: 2, rot: 0 }).ok).toBe(false);
    expect(canPlace(c, { typeId: 'double-gondola', x: 4, y: 2, rot: 0 }).ok).toBe(true);
  });

  it('贴墙 / 电源 / 端头都不再是硬限制，随便放', () => {
    const b = board();
    const c = ctx(b, []);
    expect(canPlace(c, { typeId: 'single-wall', x: 4, y: 4, rot: 0 }).ok).toBe(true);
    expect(canPlace(c, { typeId: 'upright-chiller', x: 8, y: 5, rot: 0 }).ok).toBe(true);
    expect(canPlace(c, { typeId: 'endcap', x: 5, y: 5, rot: 0 }).ok).toBe(true);
    expect(canPlace(c, { typeId: 'island-freezer', x: 2, y: 3, rot: 0 }).ok).toBe(true);
    expect(canPlace(c, { typeId: 'warehouse-rack', x: 4, y: 4, rot: 0 }).ok).toBe(true);
    expect(canPlace(c, { typeId: 'checkout', x: 0, y: 0, rot: 0 }).ok).toBe(true);
  });

  it('移动时忽略自己那块地', () => {
    const b = board();
    const placements = [p('double-gondola', 4, 4)];
    const c = ctx(b, placements);
    expect(canPlace(c, { typeId: 'double-gondola', x: 5, y: 4, rot: 0 }).ok).toBe(false);
    expect(canPlace(c, { typeId: 'double-gondola', x: 5, y: 4, rot: 0 }, 0).ok).toBe(true);
  });

  it('anyLegalSpot 在空板上为真', () => {
    expect(anyLegalSpot(ctx(board(), []), 'wood-display')).toBe(true);
  });
});

describe('flow', () => {
  it('围死的空地不可达，主动线连通门与最远格，人流近门更旺', () => {
    const b = board();
    const placements = [p('single-wall', 0, 1, 3), p('single-wall', 1, 0, 0)];
    const occ = buildOccupancy(b, placements);
    const flow = computeFlow(b, occ);
    expect(flow.unreachable).toContain(0);
    expect(flow.heat[0]).toBe(0);
    let mainCount = 0;
    for (let i = 0; i < flow.mainPath.length; i++) mainCount += flow.mainPath[i];
    expect(mainCount).toBeGreaterThan(5);
    const nearDoor = flow.heat[6 + 8 * 14];
    const farCorner = flow.heat[13 + 0 * 14];
    expect(nearDoor).toBeGreaterThan(farCorner);
  });
});

describe('等级', () => {
  it('等级越高越贵也越赚，且每格产出更高', () => {
    for (const lv of [2, 3] as Level[]) {
      expect(costOf('double-gondola', lv)).toBeGreaterThan(costOf('double-gondola', 1));
      expect(baseRevenueOf('double-gondola', lv)).toBeGreaterThan(baseRevenueOf('double-gondola', 1));
    }
    // 空间有限，所以高等级的性价比必须随等级提升
    expect(LEVEL_REVENUE[1] / LEVEL_COST[1]).toBeLessThan(LEVEL_REVENUE[2] / LEVEL_COST[2] * 1.2);
  });

  it('同一位置 3 级比 1 级赚得多', () => {
    const b = board();
    const lo = revenue(b, [p('double-gondola', 4, 4, 0, 1)]);
    const hi = revenue(b, [p('double-gondola', 4, 4, 0, 3)]);
    expect(hi.fixtures[0].total).toBeGreaterThan(lo.fixtures[0].total * 3);
  });
});

describe('营业额', () => {
  it('两面留空拿满分，被堵一面就少赚并记死面', () => {
    const b = board();
    const alone = revenue(b, [p('double-gondola', 4, 4), p('checkout', 6, 6)]);
    const blocked = revenue(b, [p('double-gondola', 4, 4), p('double-gondola', 4, 5), p('checkout', 6, 6)]);
    expect(alone.fixtures[0].total).toBeGreaterThan(0);
    expect(blocked.deadFaces).toBe(2);
    expect(blocked.fixtures[0].total).toBeLessThan(alone.fixtures[0].total);
  });

  it('单面货架贴墙有加成', () => {
    const b = board();
    const onWall = revenue(b, [p('single-wall', 4, 0), p('checkout', 6, 6)]);
    const middle = revenue(b, [p('single-wall', 4, 4), p('checkout', 6, 6)]);
    expect(onWall.fixtures[0].bonuses.some((x) => x.label === '背面贴墙')).toBe(true);
    expect(middle.fixtures[0].bonuses.some((x) => x.label === '背面贴墙')).toBe(false);
  });

  it('冷柜贴电源墙 + 连排冷链都有加成', () => {
    const b: Board = { ...board(), power: [{ side: 0, from: 0, len: 8 }] };
    const chain = revenue(b, [p('upright-chiller', 0, 0), p('upright-chiller', 2, 0), p('checkout', 6, 6)]);
    const f = chain.fixtures[0];
    expect(f.bonuses.some((x) => x.label === '接上电源墙 ⚡')).toBe(true);
    expect(f.bonuses.some((x) => x.label.startsWith('冷链区'))).toBe(true);
  });

  it('端架贴双面端头翻倍，联排有加成', () => {
    const b = board();
    const s = revenue(b, [
      p('double-gondola', 2, 4),
      p('double-gondola', 4, 4),
      p('double-gondola', 6, 4),
      p('endcap', 8, 4),
      p('checkout', 6, 6),
    ]);
    expect(s.fixtures[3].bonuses.some((x) => x.label === '端头黄金位')).toBe(true);
    expect(s.fixtures[0].bonuses.some((x) => x.label.startsWith('联排'))).toBe(true);
  });

  it('没有收银台就一分钱收不到', () => {
    const b = board();
    const s = revenue(b, [p('double-gondola', 4, 4)]);
    expect(s.total).toBe(0);
    expect(s.customers).toBe(0);
  });

  it('围死的空地会扣钱', () => {
    const b = board();
    const s = revenue(b, [p('single-wall', 0, 1, 3), p('single-wall', 1, 0, 0), p('checkout', 6, 6)]);
    expect(s.wastedCells).toBe(1);
  });
});

describe('店铺升级', () => {
  it('累计营业额决定等级，等级决定解锁的货架', () => {
    expect(tierForRevenue(0)).toBe(1);
    expect(tierForRevenue(STORE_TIERS[1].need)).toBe(2);
    expect(tierForRevenue(999999)).toBe(STORE_TIERS.length);
    expect(unlockedTypes(1)).not.toContain('upright-chiller');
    expect(unlockedTypes(2)).toContain('upright-chiller');
    expect(unlockedTypes(3)).toContain('wood-display');
    expect(unlockedTypes(5)).not.toContain('checkout');
  });
});
