import { describe, expect, it } from 'vitest';
import { discard, finish, handStuck, newGame, pickPromo, place, placeContext, replay, type GameState } from './engine';
import { anyLegalSpot, canPlace } from './grid';
import { decodeShare, emojiGrid, encodeShare } from './share';
import type { Rot } from './types';

/** 贪心：把手牌放到当前得分增量最大的合法位置（fast 模式取第一个合法位置） */
function autoPlay(s: GameState, maxSteps = 200, fast = false): GameState {
  let cur = s;
  for (let step = 0; step < maxSteps && !cur.finished; step++) {
    if (cur.promoOffer) {
      const picked = pickPromo(cur, cur.promoOffer[0]);
      if (!picked) break;
      cur = picked;
      continue;
    }
    let best: GameState | null = null;
    const candidates = [...cur.hand.map((c) => c.typeId), 'checkout' as const];
    const ctx = placeContext(cur);
    for (const typeId of candidates) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        for (let y = 0; y < cur.board.rows; y++) {
          for (let x = 0; x < cur.board.cols; x++) {
            if (!canPlace(ctx, { typeId, x, y, rot }).ok) continue;
            const next = place(cur, typeId, x, y, rot);
            if (next && (!best || next.score.total > best.score.total)) best = next;
            if (fast && best) break;
          }
        }
      }
    }
    const moved = !!best;
    if (best) cur = best;
    if (!moved) {
      const d = cur.hand[0] ? discard(cur, cur.hand[0].typeId) : null;
      if (d) cur = d;
      else {
        const f = finish(cur);
        if (f) cur = f;
        break;
      }
    }
  }
  return cur;
}

describe('engine', () => {
  it('新局手牌 3 张、牌库 33 张，且同种子可复现', () => {
    const a = newGame('daily', 20260917);
    const b = newGame('daily', 20260917);
    expect(a.hand.length).toBe(3);
    expect(a.deckRemaining).toBe(33);
    expect(a.hand.map((c) => c.typeId)).toEqual(b.hand.map((c) => c.typeId));
    expect(a.board).toEqual(b.board);
  });

  it('不同模式同种子的店面不同', () => {
    const a = newGame('daily', 1);
    const b = newGame('endless', 1);
    expect(a.hand.map((c) => c.typeId).join() === b.hand.map((c) => c.typeId).join() && JSON.stringify(a.board) === JSON.stringify(b.board)).toBe(false);
  });

  it('放置后手牌补齐、分数增长、动作被记录', () => {
    const s = newGame('daily', 7);
    const typeId = s.hand[0].typeId;
    let placed: GameState | null = null;
    for (let y = 0; y < s.board.rows && !placed; y++) {
      for (let x = 0; x < s.board.cols && !placed; x++) {
        for (const rot of [0, 1, 2, 3] as Rot[]) {
          placed = place(s, typeId, x, y, rot);
          if (placed) break;
        }
      }
    }
    expect(placed).not.toBeNull();
    expect(placed!.hand.length).toBe(3);
    expect(placed!.deckRemaining).toBe(32);
    expect(placed!.actions).toHaveLength(1);
    expect(placed!.placements).toHaveLength(1);
  });

  it('手牌里没有的类型不能放', () => {
    const s = newGame('daily', 7);
    const missing = (['wood-display', 'island-freezer', 'warehouse-rack'] as const).find((t) => !s.hand.some((c) => c.typeId === t))!;
    expect(place(s, missing, 2, 2, 0)).toBeNull();
  });

  it('没放收银台不能开业', () => {
    const s = newGame('daily', 7);
    expect(finish(s)).toBeNull();
    const withCheckout = place(s, 'checkout', 6, 7, 0)!;
    expect(withCheckout).not.toBeNull();
    const done = finish(withCheckout)!;
    expect(done.finished).toBe(true);
    // 开业动作也进回放
    expect(replay('daily', 7, done.actions).finished).toBe(true);
  });

  it('自动跑完一局：能结束、有分数、回放得到同样结果', () => {
    const end = autoPlay(newGame('daily', 20260917));
    expect(end.score.total).toBeGreaterThan(0);
    expect(end.placements.length).toBeGreaterThan(10);
    const again = replay('daily', 20260917, end.actions);
    expect(again.score.total).toBe(end.score.total);
    expect(again.placements.map((p) => [p.typeId, p.x, p.y, p.rot])).toEqual(end.placements.map((p) => [p.typeId, p.x, p.y, p.rot]));
  });

  it('无尽模式牌库抽干后扩店', () => {
    const end = autoPlay(newGame('endless', 3), 120, true);
    expect(end.expansions).toBeGreaterThanOrEqual(1);
    expect(end.board.cols).toBeGreaterThan(14);
    expect(end.deckRemaining + end.hand.length).toBeGreaterThan(0);
  });

  it('handStuck 在空板上为假', () => {
    const s = newGame('daily', 9);
    expect(handStuck(s)).toBe(false);
    expect(anyLegalSpot(placeContext(s), s.hand[0].typeId)).toBe(true);
  });
});

describe('share', () => {
  it('编码 / 解码往返一致，且链接足够短', () => {
    const end = autoPlay(newGame('daily', 20260917));
    const code = encodeShare({ mode: 'daily', seed: 20260917, actions: end.actions });
    expect(code.length).toBeLessThan(400);
    const back = decodeShare(`#${code}`)!;
    expect(back.mode).toBe('daily');
    expect(back.seed).toBe(20260917);
    expect(back.actions).toEqual(end.actions);
    const grid = emojiGrid(end);
    expect(grid.split('\n')).toHaveLength(end.board.rows);
  });

  it('坏链接返回 null', () => {
    expect(decodeShare('#zzz')).toBeNull();
    expect(decodeShare('#d123.!!!')).toBeNull();
  });
});
