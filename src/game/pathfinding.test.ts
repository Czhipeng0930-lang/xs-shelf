import { describe, expect, it } from 'vitest';
import { STORE, fixtureAABB } from './catalog';
import { buildNavGrid, findPath } from './pathfinding';
import type { Fixture } from './types';

function promo(id: string, x: number, y: number): Fixture {
  return { id, typeId: 'promo-display', x, y, rotationDeg: 0, category: 'general' };
}

describe('findPath', () => {
  it('空场地上总能找到路径', () => {
    const grid = buildNavGrid([]);
    const path = findPath(grid, 1, 1, STORE.width - 1, STORE.depth - 1);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
    expect(grid.isWalkableAt(path![path!.length - 1].x, path![path!.length - 1].y)).toBe(true);
  });

  it('目标被完全围死时返回 null', () => {
    const blockers: Fixture[] = [];
    for (let i = 0; i < 12; i++) blockers.push(promo(`b${i}`, 0.5 + i, 4.5));
    const grid = buildNavGrid(blockers);
    const path = findPath(grid, 6, 2, 6, 7);
    expect(path).toBeNull();
  });

  it('路径避开阻挡物', () => {
    const blockers = [promo('b0', 2, 3), promo('b1', 3, 3), promo('b2', 4, 3)];
    const grid = buildNavGrid(blockers);
    const path = findPath(grid, 3, 1.5, 3, 5);
    expect(path).not.toBeNull();
    for (const p of path!) {
      for (const b of blockers) {
        const box = fixtureAABB(b);
        const inside = p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1;
        expect(inside).toBe(false);
      }
    }
  });
});
