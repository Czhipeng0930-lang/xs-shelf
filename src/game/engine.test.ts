import { describe, expect, it } from 'vitest';
import {
  canOpen,
  checkoutCount,
  moveFixture,
  newGame,
  openStore,
  pickPromo,
  place,
  placeContext,
  priceOf,
  quotaLeft,
  removeFixture,
  reroll,
  replay,
  SUBSIDY,
  upgradeFixture,
  upgradePrice,
  type GameState,
} from './engine';
import { canPlace } from './grid';
import { STARTING_COINS, tierOf } from './progress';
import { decodeShare, emojiGrid, encodeShare } from './share';
import type { Rot } from './types';

/** 找一个能放下的位置（第一个合法点） */
function findSpot(s: GameState, typeId: Parameters<typeof place>[1]) {
  const ctx = placeContext(s);
  for (const rot of [0, 1] as Rot[]) {
    for (let y = 0; y < s.board.rows; y++) {
      for (let x = 0; x < s.board.cols; x++) {
        if (canPlace(ctx, { typeId, x, y, rot }).ok) return { x, y, rot };
      }
    }
  }
  return null;
}

/** 在若干候选落点里挑当日营业额最高的（候选数封顶，避免大店面上跑太久） */
const MAX_CANDIDATES = 40;

function bestPlacement(s: GameState, typeId: Parameters<typeof place>[1], level: 1 | 2 | 3): GameState | null {
  const ctx = placeContext(s);
  const spots: { x: number; y: number; rot: Rot }[] = [];
  for (const rot of [0, 1] as Rot[]) {
    for (let y = 0; y < s.board.rows; y++) {
      for (let x = 0; x < s.board.cols; x++) {
        if (canPlace(ctx, { typeId, x, y, rot }).ok) spots.push({ x, y, rot });
      }
    }
  }
  if (spots.length === 0) return null;
  const stride = Math.max(1, Math.floor(spots.length / MAX_CANDIDATES));
  let best: GameState | null = null;
  for (let i = 0; i < spots.length; i += stride) {
    const sp = spots[i];
    const next = place(s, typeId, level, sp.x, sp.y, sp.rot);
    if (next && (!best || next.preview.total > best.preview.total)) best = next;
  }
  return best ?? place(s, typeId, level, spots[0].x, spots[0].y, spots[0].rot);
}

/** 贪心跑若干天：每天把配额用满再开门 */
function autoPlay(start: GameState, days: number): GameState {
  let s = start;
  for (let d = 0; d < days; d++) {
    if (s.promoOffer) {
      const picked = pickPromo(s, s.promoOffer[0]);
      if (picked) s = picked;
    }
    // 第一台收银台必放，之后客流超过承载就补
    let guard = 0;
    while (
      (checkoutCount(s) === 0 || (s.preview.demand > checkoutCount(s) * 45 && s.coins > 200)) &&
      guard++ < 5
    ) {
      const next = bestPlacement(s, 'checkout', 1);
      if (!next) break;
      s = next;
    }
    guard = 0;
    while (quotaLeft(s) > 0 && guard++ < 40) {
      const card = s.hand.find((c) => s.coins >= priceOf(s, c.typeId, c.level));
      if (!card) break;
      const next = bestPlacement(s, card.typeId, card.level);
      if (!next) break;
      s = next;
    }
    // 当天剩的分拿去升级
    let upgraded = true;
    while (upgraded) {
      upgraded = false;
      for (const p of s.placements) {
        const next = upgradeFixture(s, p.id);
        if (next) {
          s = next;
          upgraded = true;
          break;
        }
      }
    }
    const opened = openStore(s);
    if (!opened) break;
    s = opened;
  }
  return s;
}

describe('开局', () => {
  it('第 1 天：起始分数、手牌 3 张、配额按等级', () => {
    const s = newGame('endless', 20260924);
    expect(s.day).toBe(1);
    expect(s.storeLevel).toBe(1);
    expect(s.coins).toBe(STARTING_COINS);
    expect(s.hand).toHaveLength(3);
    expect(quotaLeft(s)).toBe(tierOf(1).quota);
    // 1 级店只抽得到 1 级卡
    expect(s.hand.every((c) => c.level === 1)).toBe(true);
  });

  it('同种子完全可复现', () => {
    const a = newGame('daily', 20260924);
    const b = newGame('daily', 20260924);
    expect(a.hand.map((c) => `${c.typeId}${c.level}`)).toEqual(b.hand.map((c) => `${c.typeId}${c.level}`));
    expect(a.board).toEqual(b.board);
  });
});

describe('放置与分数', () => {
  it('放货架扣钱、占配额、补手牌', () => {
    const s = newGame('endless', 5);
    const card = s.hand[0];
    const spot = findSpot(s, card.typeId)!;
    const price = priceOf(s, card.typeId, card.level);
    const next = place(s, card.typeId, card.level, spot.x, spot.y, spot.rot)!;
    expect(next).not.toBeNull();
    expect(next.coins).toBe(s.coins - price);
    expect(next.placedToday).toBe(1);
    expect(next.hand).toHaveLength(3);
    expect(next.placements).toHaveLength(1);
  });

  it('第一台收银台免费，第二台要钱', () => {
    const s = newGame('endless', 5);
    expect(priceOf(s, 'checkout', 1)).toBe(0);
    const spot = findSpot(s, 'checkout')!;
    const next = place(s, 'checkout', 1, spot.x, spot.y, spot.rot)!;
    expect(next.coins).toBe(s.coins);
    expect(next.placedToday).toBe(0); // 收银台不占配额
    expect(priceOf(next, 'checkout', 1)).toBeGreaterThan(0);
  });

  it('钱不够就放不了', () => {
    const s = { ...newGame('endless', 5), coins: 0 };
    const card = s.hand[0];
    const spot = findSpot(s, card.typeId)!;
    expect(place(s, card.typeId, card.level, spot.x, spot.y, spot.rot)).toBeNull();
  });

  it('配额用完就放不了', () => {
    let s = newGame('endless', 11);
    s = { ...s, coins: 99999 };
    let guard = 0;
    while (quotaLeft(s) > 0 && guard++ < 20) {
      const card = s.hand[0];
      const spot = findSpot(s, card.typeId)!;
      s = place(s, card.typeId, card.level, spot.x, spot.y, spot.rot)!;
    }
    expect(quotaLeft(s)).toBe(0);
    const card = s.hand[0];
    const spot = findSpot(s, card.typeId)!;
    expect(place(s, card.typeId, card.level, spot.x, spot.y, spot.rot)).toBeNull();
  });
});

describe('挪动与拆除', () => {
  it('挪动免费，不占配额', () => {
    const s = newGame('endless', 5);
    const card = s.hand[0];
    const spot = findSpot(s, card.typeId)!;
    const placed = place(s, card.typeId, card.level, spot.x, spot.y, spot.rot)!;
    const id = placed.placements[0].id;
    const moved = moveFixture(placed, id, spot.x + 3, spot.y + 2, spot.rot);
    expect(moved).not.toBeNull();
    expect(moved!.coins).toBe(placed.coins);
    expect(moved!.placedToday).toBe(placed.placedToday);
    expect(moved!.placements[0].x).toBe(spot.x + 3);
  });

  it('现场升级扣分、等级 +1、不占配额', () => {
    const s = newGame('endless', 5);
    const card = s.hand[0];
    const spot = findSpot(s, card.typeId)!;
    const placed = place(s, card.typeId, card.level, spot.x, spot.y, spot.rot)!;
    const id = placed.placements[0].id;
    const price = upgradePrice(placed, card.typeId, 1);
    expect(price).toBeGreaterThan(0);
    const up = upgradeFixture({ ...placed, coins: placed.coins + price }, id)!;
    expect(up.placements[0].level).toBe(2);
    expect(up.placedToday).toBe(placed.placedToday);
    expect(up.coins).toBe(placed.coins);
    const price2 = upgradePrice(up, card.typeId, 2);
    expect(price2).toBeGreaterThan(price);
    const up2 = upgradeFixture({ ...up, coins: up.coins + price2 }, id)!;
    expect(up2.placements[0].level).toBe(3);
    expect(upgradeFixture(up2, id)).toBeNull();
  });

  it('拆除退 60% 并把配额还回来', () => {
    const s = newGame('endless', 5);
    const card = s.hand[0];
    const spot = findSpot(s, card.typeId)!;
    const placed = place(s, card.typeId, card.level, spot.x, spot.y, spot.rot)!;
    const removed = removeFixture(placed, placed.placements[0].id)!;
    expect(removed.placements).toHaveLength(0);
    expect(removed.placedToday).toBe(0);
    expect(removed.coins).toBeGreaterThan(placed.coins);
    expect(removed.coins).toBeLessThan(s.coins);
  });
});

describe('开门营业', () => {
  it('没收银台不能开业', () => {
    const s = newGame('endless', 5);
    expect(canOpen(s).ok).toBe(false);
    expect(openStore(s)).toBeNull();
  });

  it('开业后进账、天数 +1、配额和换牌重置', () => {
    const s = newGame('endless', 5);
    const spot = findSpot(s, 'checkout')!;
    const withCheckout = place(s, 'checkout', 1, spot.x, spot.y, spot.rot)!;
    const card = withCheckout.hand[0];
    const spot2 = findSpot(withCheckout, card.typeId)!;
    const built = place(withCheckout, card.typeId, card.level, spot2.x, spot2.y, spot2.rot)!;
    const opened = openStore(built)!;
    expect(opened.day).toBe(2);
    expect(opened.placedToday).toBe(0);
    expect(opened.rerollsLeft).toBeGreaterThan(0);
    expect(opened.coins).toBeGreaterThan(built.coins);
    expect(opened.lastReport?.revenue).toBeGreaterThan(0);
    expect(opened.totalRevenue).toBe(opened.lastReport!.revenue);
  });

  it('一分没赚也有街道补贴，不会卡死', () => {
    const s = newGame('endless', 5);
    const spot = findSpot(s, 'checkout')!;
    const opened = openStore(place(s, 'checkout', 1, spot.x, spot.y, spot.rot)!)!;
    expect(opened.lastReport!.revenue).toBe(SUBSIDY);
  });
});

describe('长线经营', () => {
  it('连跑 14 天：分在涨、店在升级、货架能升到高级', () => {
    const end = autoPlay(newGame('endless', 20260924), 14);
    expect(end.day).toBe(15);
    expect(end.totalRevenue).toBeGreaterThan(2000);
    expect(end.storeLevel).toBeGreaterThan(1);
    expect(end.board.cols).toBeGreaterThan(tierOf(1).cols);
    expect(end.promos.length).toBeGreaterThan(0);
    expect(end.placements.some((p) => p.level > 1)).toBe(true);
  });

  it('升级会触发功能牌三选一', () => {
    let s = autoPlay(newGame('endless', 777), 6);
    let sawOffer = s.promoOffer !== null;
    for (let i = 0; i < 8 && !sawOffer; i++) {
      s = autoPlay(s, 1);
      sawOffer = s.promoOffer !== null || s.promos.length > 0;
    }
    expect(sawOffer).toBe(true);
  });

  it('回放同一串操作得到同样的店', () => {
    const end = autoPlay(newGame('daily', 20260924), 8);
    const again = replay('daily', 20260924, end.actions);
    expect(again.day).toBe(end.day);
    expect(again.coins).toBe(end.coins);
    expect(again.totalRevenue).toBe(end.totalRevenue);
    expect(again.placements.map((p) => [p.typeId, p.level, p.x, p.y, p.rot])).toEqual(
      end.placements.map((p) => [p.typeId, p.level, p.x, p.y, p.rot]),
    );
  });

  it('换牌每天一次', () => {
    const s = newGame('endless', 3);
    const before = s.hand.map((c) => c.uid);
    const r = reroll(s)!;
    expect(r.hand.map((c) => c.uid)).not.toEqual(before);
    expect(r.rerollsLeft).toBe(0);
    expect(reroll(r)).toBeNull();
  });
});

describe('分享链接', () => {
  it('编解码往返一致', () => {
    const end = autoPlay(newGame('daily', 20260924), 6);
    const code = encodeShare({ mode: 'daily', seed: 20260924, actions: end.actions });
    const back = decodeShare(`#${code}`)!;
    expect(back.mode).toBe('daily');
    expect(back.seed).toBe(20260924);
    expect(back.actions).toEqual(end.actions);
    expect(emojiGrid(end).split('\n')).toHaveLength(end.board.rows);
  });

  it('坏链接返回 null', () => {
    expect(decodeShare('#zzz')).toBeNull();
    expect(decodeShare('#d123.!!!')).toBeNull();
  });
});
