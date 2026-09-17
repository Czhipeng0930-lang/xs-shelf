import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, FIXTURE_DEFS, FIXTURE_ORDER, canPlaceAt, modelFileFor } from './catalog';
import type { Fixture } from './types';

const MODELS_DIR = fileURLToPath(new URL('../../public/models', import.meta.url));

function makeFixture(typeId: Fixture['typeId'], category: Fixture['category'] = null): Fixture {
  return { id: 'x', typeId, x: 3, y: 3, rotationDeg: 0, category };
}

describe('设备目录', () => {
  it('尺寸、价格为正，品类引用有效', () => {
    for (const id of FIXTURE_ORDER) {
      const def = FIXTURE_DEFS[id];
      expect(def.size.w).toBeGreaterThan(0);
      expect(def.size.d).toBeGreaterThan(0);
      expect(def.size.h).toBeGreaterThan(0);
      expect(def.price).toBeGreaterThanOrEqual(0);
      if (id === 'checkout') {
        expect(def.allowedCategories.length).toBe(0);
      } else {
        expect(def.allowedCategories.length).toBeGreaterThan(0);
      }
      for (const c of def.allowedCategories) expect(CATEGORIES[c]).toBeDefined();
    }
  });

  it('每个设备类型都有对应的 GLB 模型文件', () => {
    for (const id of FIXTURE_ORDER) {
      const category = FIXTURE_DEFS[id].allowedCategories[0] ?? null;
      const file = modelFileFor(makeFixture(id, category));
      expect(existsSync(join(MODELS_DIR, file)), `${id} -> ${file}`).toBe(true);
    }
  });
});

describe('摆放校验', () => {
  it('越界与重叠均不允许', () => {
    const a: Fixture = { id: 'a', typeId: 'double-gondola', x: 6, y: 4.5, rotationDeg: 0, category: 'snacks' };
    expect(canPlaceAt([a], { typeId: 'double-gondola', x: 6, y: 4.5, rotationDeg: 0 })).toBe(false);
    expect(canPlaceAt([a], { typeId: 'double-gondola', x: 13, y: 4.5, rotationDeg: 0 })).toBe(false);
    expect(canPlaceAt([a], { typeId: 'double-gondola', x: 8, y: 4.5, rotationDeg: 0 })).toBe(true);
  });

  it('入口缓冲区禁止摆放', () => {
    expect(canPlaceAt([], { typeId: 'promo-display', x: 6, y: 8.4, rotationDeg: 0 })).toBe(false);
    expect(canPlaceAt([], { typeId: 'promo-display', x: 2, y: 8.4, rotationDeg: 0 })).toBe(true);
  });

  it('移动自身时忽略自身占位', () => {
    const a: Fixture = { id: 'a', typeId: 'double-gondola', x: 6, y: 4.5, rotationDeg: 0, category: 'snacks' };
    expect(canPlaceAt([a], { typeId: 'double-gondola', x: 6, y: 4.5, rotationDeg: 90 }, 'a')).toBe(true);
  });
});
