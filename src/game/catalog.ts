import type { CategoryId, Fixture, FixtureTypeId } from './types';

export const STORE = {
  width: 12,
  depth: 9,
  wallHeight: 3,
  door: { x: 6, width: 1.5 },
};

export const ECON = {
  startMoney: 6000,
  goalMoney: 20000,
  serviceSeconds: 4.5,
  customersBase: (day: number) => Math.min(12 + day * 3, 60),
};

export interface CategoryDef {
  name: string;
  emoji: string;
  price: number;
  impulse: number;
}

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  snacks: { name: '零食', emoji: '🍿', price: 8, impulse: 0.9 },
  drinks: { name: '饮料', emoji: '🥤', price: 5, impulse: 1.0 },
  household: { name: '日化', emoji: '🧴', price: 16, impulse: 0.2 },
  general: { name: '百货', emoji: '🧺', price: 22, impulse: 0.25 },
  produce: { name: '生鲜', emoji: '🥬', price: 12, impulse: 0.35 },
  bakery: { name: '烘焙', emoji: '🥖', price: 10, impulse: 0.5 },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export const BUDDY_PAIRS: [CategoryId, CategoryId][] = [
  ['snacks', 'drinks'],
  ['produce', 'bakery'],
  ['household', 'general'],
];

export interface FixtureDef {
  typeId: FixtureTypeId;
  name: string;
  emoji: string;
  size: { w: number; d: number; h: number };
  color: string;
  darkColor: string;
  price: number;
  allowedCategories: CategoryId[];
  impulsePower: number;
  hint: string;
}

export const FIXTURE_DEFS: Record<FixtureTypeId, FixtureDef> = {
  'single-wall': {
    typeId: 'single-wall', name: '靠墙货架', emoji: '🗄️',
    size: { w: 1.2, d: 0.45, h: 2.05 }, color: '#5d9bf7', darkColor: '#2d67be',
    price: 340, allowedCategories: ['household', 'snacks'], impulsePower: 0,
    hint: '薄而高，适合贴墙陈列',
  },
  'double-gondola': {
    typeId: 'double-gondola', name: '双面货架', emoji: '🛍️',
    size: { w: 1.2, d: 0.9, h: 1.65 }, color: '#36b98c', darkColor: '#177c5b',
    price: 612, allowedCategories: ['snacks', 'household', 'general'], impulsePower: 0,
    hint: '主陈列主力，两侧都能拿货',
  },
  endcap: {
    typeId: 'endcap', name: '端头架', emoji: '🎯',
    size: { w: 0.9, d: 0.45, h: 1.65 }, color: '#f4a63a', darkColor: '#b0731a',
    price: 242, allowedCategories: ['drinks', 'snacks'], impulsePower: 0.3,
    hint: '摆在动线转角，触发冲动消费',
  },
  'promo-display': {
    typeId: 'promo-display', name: '促销堆头', emoji: '📣',
    size: { w: 1, d: 1, h: 0.9 }, color: '#f17668', darkColor: '#b4453b',
    price: 250, allowedCategories: ['general', 'produce', 'bakery'], impulsePower: 0.45,
    hint: '冲动消费之王，放在必经之路',
  },
  'upright-chiller': {
    typeId: 'upright-chiller', name: '立式冷柜', emoji: '🧊',
    size: { w: 1.8, d: 0.8, h: 2.2 }, color: '#55c5d4', darkColor: '#238595',
    price: 1740, allowedCategories: ['drinks'], impulsePower: 0,
    hint: '冰镇饮料价格 ×1.6',
  },
  'wood-display': {
    typeId: 'wood-display', name: '木质展台', emoji: '🪵',
    size: { w: 2.8, d: 1.6, h: 1.25 }, color: '#b78962', darkColor: '#49372d',
    price: 1280, allowedCategories: ['produce', 'bakery'], impulsePower: 0,
    hint: '生鲜/烘焙专用大台面',
  },
  checkout: {
    typeId: 'checkout', name: '收银台', emoji: '💳',
    size: { w: 1.5, d: 0.6, h: 1.05 }, color: '#8972df', darkColor: '#5b46b0',
    price: 570, allowedCategories: [], impulsePower: 0,
    hint: '结账速度决定排队长度',
  },
};

export const FIXTURE_ORDER: FixtureTypeId[] = [
  'double-gondola', 'single-wall', 'endcap', 'promo-display', 'upright-chiller', 'wood-display', 'checkout',
];

export function defaultCategory(typeId: FixtureTypeId): CategoryId | null {
  const allowed = FIXTURE_DEFS[typeId].allowedCategories;
  return allowed.length > 0 ? allowed[0] : null;
}

export function modelFileFor(f: Fixture): string {
  switch (f.typeId) {
    case 'double-gondola':
      return f.category === 'snacks' ? 'kenney-shelf-boxes-v3.glb' : 'kenney-shelf-bags-v3.glb';
    case 'wood-display':
      return f.category === 'produce' ? 'kenney-display-fruit-v4.glb' : 'kenney-display-bread-v2.glb';
    case 'single-wall':
    case 'endcap':
      return 'kenney-shelf-end-v3.glb';
    case 'promo-display':
      return 'kenney-display-fruit-v4.glb';
    case 'upright-chiller':
      return 'kenney-freezers-standing-v3.glb';
    case 'checkout':
      return 'cash-register.glb';
  }
}

export function footprint(f: Pick<Fixture, 'typeId' | 'rotationDeg'>): { w: number; d: number } {
  const size = FIXTURE_DEFS[f.typeId].size;
  const rotated = ((((f.rotationDeg % 180) + 180) % 180) === 90);
  return rotated ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
}

export function fixtureAABB(f: Pick<Fixture, 'typeId' | 'rotationDeg' | 'x' | 'y'>) {
  const fp = footprint(f);
  return { x0: f.x - fp.w / 2, y0: f.y - fp.d / 2, x1: f.x + fp.w / 2, y1: f.y + fp.d / 2 };
}

function rectsOverlap(a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }, gap: number) {
  return a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;
}

export function doorClearanceRect() {
  return {
    x0: STORE.door.x - STORE.door.width / 2 - 0.35,
    y0: STORE.depth - 1.1,
    x1: STORE.door.x + STORE.door.width / 2 + 0.35,
    y1: STORE.depth + 0.01,
  };
}

export function canPlaceAt(fixtures: Fixture[], candidate: Pick<Fixture, 'typeId' | 'x' | 'y' | 'rotationDeg'>, ignoreId?: string): boolean {
  const box = fixtureAABB(candidate);
  if (box.x0 < -0.001 || box.y0 < -0.001 || box.x1 > STORE.width + 0.001 || box.y1 > STORE.depth + 0.001) return false;
  if (rectsOverlap(box, doorClearanceRect(), 0)) return false;
  for (const other of fixtures) {
    if (other.id === ignoreId) continue;
    if (rectsOverlap(box, fixtureAABB(other), -0.01)) return false;
  }
  return true;
}

export function buddyBonusAt(fixtures: Fixture[], fixture: Fixture): boolean {
  if (!fixture.category) return false;
  const buddy = BUDDY_PAIRS.find(([a, b]) => (a === fixture.category && b !== fixture.category && fixtures.some((f) => f.id !== fixture.id && f.category === b)) || (b === fixture.category && fixtures.some((f) => f.id !== fixture.id && f.category === a)));
  if (!buddy) return false;
  const other = buddy[0] === fixture.category ? buddy[1] : buddy[0];
  return fixtures.some((f) => f.id !== fixture.id && f.category === other && Math.hypot(f.x - fixture.x, f.y - fixture.y) < 2.3);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
