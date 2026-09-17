import { describe, expect, it } from 'vitest';
import { computeFlow } from './flow';
import { anyLegalSpot, buildOccupancy, canPlace, createBoard, isBuffer, type PlaceContext } from './grid';
import { createRng } from './rng';
import { scoreAll } from './scoring';
import type { Board, Placement, PromoId } from './types';

function board(): Board {
  return { cols: 14, rows: 10, doorX: 6, doorW: 2, power: [{ side: 0, from: 2, len: 4 }] };
}

function ctx(b: Board, placements: Placement[], promos: PromoId[] = []): PlaceContext {
  return { board: b, placements, occ: buildOccupancy(b, placements), promos };
}

let n = 0;
function p(typeId: Placement['typeId'], x: number, y: number, rot: Placement['rot'] = 0): Placement {
  return { id: `t${++n}`, typeId, x, y, rot, variant: 0 };
}

describe('createBoard', () => {
  it('门居中且北墙一定有电源', () => {
    const b = createBoard(createRng(42));
    expect(b.doorX).toBe(6);
    expect(b.power.some((s) => s.side === 0)).toBe(true);
    expect(isBuffer(b, 6, 9)).toBe(true);
    expect(isBuffer(b, 6, 7)).toBe(false);
  });
});

describe('canPlace', () => {
  it('越界 / 门口缓冲 / 重叠均拒绝', () => {
    const b = board();
    expect(canPlace(ctx(b, []), { typeId: 'double-gondola', x: 13, y: 0, rot: 0 }).ok).toBe(false);
    expect(canPlace(ctx(b, []), { typeId: 'promo-display', x: 6, y: 9, rot: 0 }).ok).toBe(false);
    const c = ctx(b, [p('double-gondola', 2, 2)]);
    expect(canPlace(c, { typeId: 'double-gondola', x: 3, y: 2, rot: 0 }).ok).toBe(false);
    expect(canPlace(c, { typeId: 'double-gondola', x: 4, y: 2, rot: 0 }).ok).toBe(true);
  });

  it('单面货架必须贴墙，立式冷柜必须贴电源墙', () => {
    const b = board();
    expect(canPlace(ctx(b, []), { typeId: 'single-wall', x: 2, y: 0, rot: 0 }).ok).toBe(true);
    expect(canPlace(ctx(b, []), { typeId: 'single-wall', x: 2, y: 1, rot: 0 }).ok).toBe(false);
    // 贴西墙需要旋转让背面朝西（rot=3：北 → 西）
    expect(canPlace(ctx(b, []), { typeId: 'single-wall', x: 0, y: 2, rot: 3 }).ok).toBe(true);
    expect(canPlace(ctx(b, []), { typeId: 'upright-chiller', x: 2, y: 0, rot: 0 }).ok).toBe(true);
    expect(canPlace(ctx(b, []), { typeId: 'upright-chiller', x: 8, y: 0, rot: 0 }).ok).toBe(false);
    expect(canPlace(ctx(b, [], ['ice-summer']), { typeId: 'upright-chiller', x: 8, y: 0, rot: 0 }).ok).toBe(true);
  });

  it('仓储架不必靠墙', () => {
    const b = board();
    expect(canPlace(ctx(b, []), { typeId: 'warehouse-rack', x: 4, y: 4, rot: 0 }).ok).toBe(true);
    expect(canPlace(ctx(b, []), { typeId: 'warehouse-rack', x: 4, y: 0, rot: 0 }).ok).toBe(true);
  });

  it('端架必须贴双面货架短边端头', () => {
    const b = board();
    const c = ctx(b, [p('double-gondola', 4, 4)]);
    // 贴东端：端架在 (6,4)，attach 侧朝西 → rot 3
    expect(canPlace(c, { typeId: 'endcap', x: 6, y: 4, rot: 3 }).ok).toBe(true);
    // 贴到长边（取货面）不行
    expect(canPlace(c, { typeId: 'endcap', x: 4, y: 5, rot: 0 }).ok).toBe(false);
    // 方向不对也不行
    expect(canPlace(c, { typeId: 'endcap', x: 6, y: 4, rot: 0 }).ok).toBe(false);
  });

  it('收银台距门 ≤3 且仅一张', () => {
    const b = board();
    expect(canPlace(ctx(b, []), { typeId: 'checkout', x: 6, y: 7, rot: 0 }).ok).toBe(true);
    expect(canPlace(ctx(b, []), { typeId: 'checkout', x: 0, y: 0, rot: 0 }).ok).toBe(false);
    const c = ctx(b, [p('checkout', 6, 7)]);
    expect(canPlace(c, { typeId: 'checkout', x: 3, y: 8, rot: 0 }).ok).toBe(false);
    expect(canPlace(ctx(b, c.placements, ['double-checkout']), { typeId: 'checkout', x: 3, y: 8, rot: 0 }).ok).toBe(true);
  });

  it('卧式冰柜需要附近有立式冷柜', () => {
    const b = board();
    expect(canPlace(ctx(b, []), { typeId: 'island-freezer', x: 2, y: 3, rot: 0 }).ok).toBe(false);
    expect(canPlace(ctx(b, [p('upright-chiller', 2, 0)]), { typeId: 'island-freezer', x: 2, y: 2, rot: 0 }).ok).toBe(true);
    expect(canPlace(ctx(b, [p('upright-chiller', 2, 0)]), { typeId: 'island-freezer', x: 2, y: 4, rot: 0 }).ok).toBe(false);
  });

  it('anyLegalSpot 在空板上为真', () => {
    expect(anyLegalSpot(ctx(board(), []), 'wood-display')).toBe(true);
  });
});

describe('flow', () => {
  it('被围死的空地不可达，主动线连通门与最远格', () => {
    const b = board();
    // 用货架围出一格：(0,0) 被 (1,0) 竖向单面架和 (0,1) 横向单面架困住
    const placements = [p('single-wall', 0, 1, 3), p('single-wall', 1, 0, 0)];
    const occ = buildOccupancy(b, placements);
    const flow = computeFlow(b, occ);
    expect(flow.unreachable).toContain(0);
    expect(flow.mainPath[6 + 9 * 14] || flow.mainPath[7 + 9 * 14]).toBe(1);
    let count = 0;
    for (let i = 0; i < flow.mainPath.length; i++) count += flow.mainPath[i];
    expect(count).toBeGreaterThan(5);
  });
});

describe('scoring', () => {
  it('双面货架两面留空得满分，一面被堵减半并扣死面', () => {
    const b = board();
    const alone = [p('double-gondola', 4, 4)];
    const s1 = scoreAll(b, alone, buildOccupancy(b, alone), []);
    expect(s1.fixtures[0].total).toBeGreaterThanOrEqual(60);
    const blocked = [p('double-gondola', 4, 4), p('double-gondola', 4, 5)];
    const s2 = scoreAll(b, blocked, buildOccupancy(b, blocked), []);
    expect(s2.deadFaces).toBe(2);
    expect(s2.fixtures[0].total).toBeLessThan(s1.fixtures[0].total);
  });

  it('端架贴端头 ×2，联排 +10%/件', () => {
    const b = board();
    const placements = [p('double-gondola', 2, 4), p('double-gondola', 4, 4), p('double-gondola', 6, 4), p('endcap', 8, 4, 3)];
    const s = scoreAll(b, placements, buildOccupancy(b, placements), []);
    const endcap = s.fixtures[3];
    expect(endcap.bonuses.some((x) => x.label === '端头黄金位' && x.value === 2)).toBe(true);
    expect(endcap.bonuses.some((x) => x.label === '长排端头')).toBe(true);
    expect(s.fixtures[0].bonuses.some((x) => x.label.startsWith('联排'))).toBe(true);
  });

  it('冷链区每台 +50%，挨着仓储架 −30%', () => {
    const b: Board = { ...board(), power: [{ side: 0, from: 0, len: 8 }] };
    const chain = [p('upright-chiller', 0, 0), p('upright-chiller', 2, 0)];
    const s = scoreAll(b, chain, buildOccupancy(b, chain), []);
    expect(s.fixtures[0].bonuses.some((x) => x.label.startsWith('冷链区'))).toBe(true);
    const mixed = [p('upright-chiller', 0, 0), p('warehouse-rack', 2, 0)];
    const s2 = scoreAll(b, mixed, buildOccupancy(b, mixed), []);
    expect(s2.fixtures[0].bonuses.some((x) => x.label === '挨着仓储架')).toBe(true);
  });

  it('浪费格扣分', () => {
    const b = board();
    const placements = [p('single-wall', 0, 1, 3), p('single-wall', 1, 0, 0)];
    const s = scoreAll(b, placements, buildOccupancy(b, placements), []);
    expect(s.wastedCells).toBe(1);
    expect(s.penalty).toBeGreaterThanOrEqual(5);
  });
});
