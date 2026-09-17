import { describe, expect, it } from 'vitest';
import { Simulation } from './sim';
import type { Fixture } from './types';

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gondola(id: string, x: number, y: number, category: Fixture['category'] = 'snacks'): Fixture {
  return { id, typeId: 'double-gondola', x, y, rotationDeg: 0, category };
}

function checkout(id: string, x: number, y: number): Fixture {
  return { id, typeId: 'checkout', x, y, rotationDeg: 0, category: null };
}

function runToEnd(sim: Simulation, maxSeconds = 3000) {
  let t = 0;
  while (!sim.done && t < maxSeconds) {
    sim.tick(0.1);
    t += 0.1;
  }
  return t;
}

describe('Simulation', () => {
  it('货架 + 收银台：正常营业并日结', () => {
    const fixtures = [gondola('g1', 3, 3), gondola('g2', 6, 3), gondola('g3', 9, 3), checkout('c1', 6, 7.5)];
    const sim = new Simulation(fixtures, 1, seededRng(42));
    runToEnd(sim);
    expect(sim.done).toBe(true);
    expect(sim.served).toBeGreaterThan(0);
    expect(sim.revenue).toBeGreaterThan(0);
    expect(sim.customers.length).toBe(0);
    const endEvent = sim.events.find((e) => e.type === 'day-end');
    expect(endEvent).toBeDefined();
  });

  it('没有收银台：拿了货的顾客全部弃购', () => {
    const fixtures = [gondola('g1', 3, 3), gondola('g2', 6, 3)];
    const sim = new Simulation(fixtures, 1, seededRng(7));
    runToEnd(sim);
    expect(sim.done).toBe(true);
    expect(sim.served).toBe(0);
    expect(sim.revenue).toBe(0);
    expect(sim.abandoned).toBeGreaterThan(0);
  });

  it('想买的品类缺货时记录 missing 并拉低满意度', () => {
    const fixtures = [checkout('c1', 6, 7.5)];
    const sim = new Simulation(fixtures, 1, seededRng(99));
    runToEnd(sim);
    expect(sim.done).toBe(true);
    expect(sim.missingHits).toBeGreaterThan(0);
    expect(sim.served).toBe(0);
    const report = (sim.events.find((e) => e.type === 'day-end') as { report: { satisfaction: number } } | undefined)?.report;
    expect(report).toBeDefined();
    expect(report!.satisfaction).toBeLessThan(100);
  });

  it('模拟数值始终有限', () => {
    const fixtures = [gondola('g1', 3, 3), checkout('c1', 6, 7.5)];
    const sim = new Simulation(fixtures, 5, seededRng(123));
    runToEnd(sim);
    expect(Number.isFinite(sim.revenue)).toBe(true);
    expect(sim.revenue).toBeGreaterThanOrEqual(0);
    for (const c of sim.customers) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
    }
  });
});
