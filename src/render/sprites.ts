import { FIXTURES, footprint, rotDir } from '../game/catalog';
import type { Dir, FixtureTypeId, Level, Rot } from '../game/types';
import { FRESH, GOODS, LEVEL_LIFT, LEVEL_TRIM, PAL, shade, vivid } from './palette';

export const TILE = 16;

/** 各货架立面高度（像素） */
export const ELEV: Record<FixtureTypeId, number> = {
  'double-gondola': 14,
  'single-wall': 20,
  endcap: 14,
  'warehouse-rack': 24,
  'upright-chiller': 22,
  'island-freezer': 8,
  'wood-display': 10,
  'promo-display': 9,
  checkout: 10,
};

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function hline(ctx: Ctx, x: number, y: number, w: number, color: string) {
  px(ctx, x, y, w, 1, color);
}

/** 一排小商品盒子 */
function goodsRow(ctx: Ctx, x: number, y: number, w: number, h: number, colors: string[], seed: number) {
  let cx = x;
  let i = seed;
  while (cx + 2 <= x + w) {
    const bw = 2 + (i % 2);
    if (cx + bw > x + w) break;
    const c = colors[i % colors.length];
    px(ctx, cx, y, bw, h, c);
    px(ctx, cx, y, 1, h, shade(c, 30));
    px(ctx, cx, y + h - 1, bw, 1, shade(c, -40));
    cx += bw + 1;
    i++;
  }
}

/** 顶面边缘的取货面“商品沿” */
function topEdgeGoods(ctx: Ctx, dir: Dir, W: number, topH: number, colors: string[]) {
  if (dir === 0) goodsRow(ctx, 2, 1, W - 4, 2, colors, 1);
  if (dir === 2) goodsRow(ctx, 2, topH - 3, W - 4, 2, colors, 2);
  if (dir === 3) for (let y = 2; y + 2 <= topH - 2; y += 3) px(ctx, 1, y, 2, 2, colors[(y / 3) % colors.length]);
  if (dir === 1) for (let y = 2; y + 2 <= topH - 2; y += 3) px(ctx, W - 3, y, 2, 2, colors[((y / 3) + 1) % colors.length]);
}

interface SpriteSpec {
  W: number;
  H: number;
  topH: number;
  elev: number;
  faces: Dir[];
}

function spec(typeId: FixtureTypeId, rot: Rot): SpriteSpec {
  const fp = footprint(typeId, rot);
  const elev = ELEV[typeId];
  return {
    W: fp.w * TILE,
    H: fp.h * TILE + elev,
    topH: fp.h * TILE,
    elev,
    faces: FIXTURES[typeId].faces.map((d) => rotDir(d, rot)),
  };
}

/** 等级外观：2 级镀金边 + 角钉，3 级霓虹边 + 顶角星星 */
function levelTrim(ctx: Ctx, level: Level, W: number, H: number, topH: number, frame: number) {
  if (level === 1) return;
  const trim = LEVEL_TRIM[level - 1];
  hline(ctx, 1, 1, W - 2, trim);
  px(ctx, 1, 1, 1, topH - 2, trim);
  px(ctx, W - 2, 1, 1, topH - 2, trim);
  hline(ctx, 1, H - 2, W - 2, trim);
  if (level === 2) {
    px(ctx, 1, 1, 2, 2, PAL.white);
    px(ctx, W - 3, 1, 2, 2, PAL.white);
    return;
  }
  // 3 级：立面描边 + 闪烁的星
  px(ctx, 1, topH, 1, H - topH - 2, trim);
  px(ctx, W - 2, topH, 1, H - topH - 2, trim);
  const on = frame % 2 === 0;
  const star = (sx: number, sy: number) => {
    px(ctx, sx, sy - 1, 1, 3, PAL.white);
    px(ctx, sx - 1, sy, 3, 1, PAL.white);
    if (on) {
      px(ctx, sx - 2, sy, 1, 1, trim);
      px(ctx, sx + 2, sy, 1, 1, trim);
    }
  };
  star(3, 3);
  star(W - 4, 3);
}

function bodyColor(typeId: FixtureTypeId, level: Level) {
  const def = FIXTURES[typeId];
  return vivid(shade(def.color, LEVEL_LIFT[level - 1]), level === 3 ? 0.35 : level === 2 ? 0.15 : 0);
}

function drawShelfLike(ctx: Ctx, typeId: FixtureTypeId, rot: Rot, variant: number, level: Level) {
  const def = FIXTURES[typeId];
  const { W, H, topH, elev, faces } = spec(typeId, rot);
  const goods = GOODS[variant % GOODS.length];
  const frontIsFace = faces.includes(2);
  const body = bodyColor(typeId, level);
  px(ctx, 0, 0, W, H, PAL.outline);
  px(ctx, 1, 1, W - 2, topH - 2, shade(body, 40));
  hline(ctx, 1, 1, W - 2, shade(body, 70));
  px(ctx, 1, topH, W - 2, elev - 1, body);
  px(ctx, 1, topH, 1, elev - 1, shade(body, -30));
  px(ctx, W - 2, topH, 1, elev - 1, shade(body, -50));
  hline(ctx, 1, H - 2, W - 2, def.dark);
  if (frontIsFace) {
    // 层板 + 商品，等级越高层数越多
    const rows = elev >= 20 ? 3 : 2;
    const rowH = Math.floor((elev - 3) / rows);
    for (let r = 0; r < rows; r++) {
      const y = topH + 1 + r * rowH;
      hline(ctx, 1, y + rowH - 1, W - 2, shade(body, 60));
      goodsRow(ctx, 3, y + 1, W - 6, rowH - 3, goods, r + variant + level);
    }
  } else {
    px(ctx, 3, topH + 2, W - 6, Math.max(3, elev - 6), shade(body, -20));
    px(ctx, W / 2 - 2, topH + 3, 4, 2, PAL.white);
  }
  for (const d of faces) if (d !== 2) topEdgeGoods(ctx, d, W, topH, goods);
}

function drawChiller(ctx: Ctx, rot: Rot, variant: number, level: Level) {
  const { W, H, topH, elev, faces } = spec('upright-chiller', rot);
  const body = bodyColor('upright-chiller', level);
  px(ctx, 0, 0, W, H, PAL.outline);
  px(ctx, 1, 1, W - 2, topH - 2, shade(body, 40));
  hline(ctx, 1, 1, W - 2, PAL.white);
  px(ctx, 1, topH, W - 2, elev - 1, FIXTURES['upright-chiller'].dark);
  if (faces.includes(2)) {
    px(ctx, 2, topH + 1, W - 4, elev - 4, '#bdf3fb');
    px(ctx, 3, topH + 2, 1, elev - 6, PAL.white);
    const goods = variant % 2 === 0 ? GOODS[1] : ['#e43b44', '#feae34', '#ffffff', '#63c74d'];
    for (let r = 0; r < 3; r++) {
      const y = topH + 2 + r * Math.floor((elev - 5) / 3);
      goodsRow(ctx, 4, y + 1, W - 8, 3, goods, r + level);
      hline(ctx, 2, y + 4, W - 4, '#8fdbe8');
    }
    px(ctx, W / 2 - 1, topH + 4, 1, elev - 9, PAL.light);
  } else {
    px(ctx, 3, topH + 2, W - 6, elev - 6, shade(FIXTURES['upright-chiller'].dark, -15));
  }
  hline(ctx, 1, H - 2, W - 2, PAL.ink);
  for (const d of faces) if (d !== 2) topEdgeGoods(ctx, d, W, topH, GOODS[1]);
  px(ctx, 2, 2, 3, 1, PAL.white);
}

function drawIslandFreezer(ctx: Ctx, rot: Rot, variant: number, level: Level) {
  const { W, H, topH, elev } = spec('island-freezer', rot);
  const body = bodyColor('island-freezer', level);
  px(ctx, 0, 0, W, H, PAL.outline);
  px(ctx, 1, 1, W - 2, topH - 2, '#bdf3fb');
  px(ctx, 2, 2, W - 4, topH - 4, '#8fdbe8');
  const goods = variant % 2 === 0 ? ['#ffffff', '#0099db', '#f6757a', '#c0cbdc'] : ['#feae34', '#63c74d', '#ffffff', '#e43b44'];
  for (let y = 4; y + 3 <= topH - 3; y += 4) goodsRow(ctx, 4, y, W - 8, 3, goods, y + level);
  px(ctx, 3, 2, 1, topH - 5, PAL.white);
  hline(ctx, 1, topH / 2, W - 2, 'rgba(255,255,255,0.6)');
  px(ctx, 1, topH, W - 2, elev - 1, PAL.white);
  hline(ctx, 1, topH, W - 2, body);
  hline(ctx, 1, H - 2, W - 2, PAL.light);
  px(ctx, W - 4, topH + 2, 2, 2, FIXTURES['island-freezer'].dark);
}

function drawWood(ctx: Ctx, rot: Rot, variant: number, level: Level) {
  const { W, H, topH, elev } = spec('wood-display', rot);
  const body = bodyColor('wood-display', level);
  const dark = FIXTURES['wood-display'].dark;
  const fresh = FRESH[variant % FRESH.length];
  px(ctx, 0, 0, W, H, PAL.outline);
  px(ctx, 1, 1, W - 2, topH - 2, shade(body, 35));
  for (let y = 3; y < topH - 1; y += 4) hline(ctx, 1, y, W - 2, shade(body, 10));
  const bw = Math.floor((W - 6) / 2);
  const bh = Math.floor((topH - 6) / 2);
  for (let i = 0; i < 4; i++) {
    const bx = 2 + (i % 2) * (bw + 2);
    const by = 2 + Math.floor(i / 2) * (bh + 2);
    px(ctx, bx, by, bw, bh, dark);
    px(ctx, bx + 1, by + 1, bw - 2, bh - 2, fresh[(i + variant) % fresh.length]);
    for (let k = 0; k < 3; k++) px(ctx, bx + 2 + k * 3, by + 2 + (k % 2) * 2, 2, 2, shade(fresh[(i + variant + 1) % fresh.length], 25));
  }
  px(ctx, 1, topH, W - 2, elev - 1, body);
  for (let x = 1; x < W - 1; x += 6) px(ctx, x, topH, 1, elev - 1, dark);
  hline(ctx, 1, H - 2, W - 2, dark);
}

function drawPromo(ctx: Ctx, variant: number, level: Level) {
  const { W, H, topH, elev } = spec('promo-display', 0);
  const body = bodyColor('promo-display', level);
  const goods = GOODS[variant % GOODS.length];
  px(ctx, 0, 0, W, H, PAL.outline);
  px(ctx, 1, 1, W - 2, topH - 2, shade(body, 40));
  px(ctx, 2, 4, W - 4, topH - 5, goods[0]);
  px(ctx, 4, 2, W - 8, 3, goods[1]);
  px(ctx, 6, 1, W - 12, 1, goods[2]);
  hline(ctx, 2, 4, W - 4, shade(goods[0], 40));
  px(ctx, 1, topH, W - 2, elev - 1, body);
  px(ctx, 3, topH + 1, W - 6, elev - 4, PAL.white);
  px(ctx, 5, topH + 3, W - 10, 1, FIXTURES['promo-display'].dark);
  px(ctx, 5, topH + 5, W - 10, 1, FIXTURES['promo-display'].dark);
  hline(ctx, 1, H - 2, W - 2, FIXTURES['promo-display'].dark);
}

function drawCheckout(ctx: Ctx, rot: Rot, blink: boolean) {
  const def = FIXTURES.checkout;
  const { W, H, topH, elev } = spec('checkout', rot);
  px(ctx, 0, 0, W, H, PAL.outline);
  px(ctx, 1, 1, W - 2, topH - 2, shade(def.color, 45));
  px(ctx, 2, 3, Math.max(6, W - 12), topH - 6, PAL.navy);
  for (let x = 3; x < W - 12; x += 3) px(ctx, x, 4, 1, topH - 8, PAL.slate);
  px(ctx, W - 9, 1, 7, topH - 3, def.dark);
  px(ctx, W - 8, 2, 5, 3, blink ? '#2ce8f5' : '#63c74d');
  px(ctx, W - 8, 6, 5, 2, PAL.light);
  px(ctx, 1, topH, W - 2, elev - 1, def.color);
  px(ctx, 3, topH + 2, W - 6, elev - 6, shade(def.color, -25));
  hline(ctx, 1, H - 2, W - 2, def.dark);
}

const cache = new Map<string, HTMLCanvasElement>();

/** 取货架 sprite（按类型/旋转/变体/等级/缩放/帧缓存） */
export function fixtureSprite(
  typeId: FixtureTypeId,
  rot: Rot,
  variant: number,
  level: Level,
  scale: number,
  frame = 0,
): HTMLCanvasElement {
  const animated = typeId === 'checkout' || typeId === 'upright-chiller' || level === 3;
  const f = animated ? frame % 2 : 0;
  const key = `${typeId}|${rot}|${variant}|${level}|${scale}|${f}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { W, H, topH } = spec(typeId, rot);
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  switch (typeId) {
    case 'upright-chiller':
      drawChiller(ctx, rot, variant, level);
      if (f === 1) px(ctx, 5, 2, 2, 1, PAL.white);
      break;
    case 'island-freezer':
      drawIslandFreezer(ctx, rot, variant, level);
      break;
    case 'wood-display':
      drawWood(ctx, rot, variant, level);
      break;
    case 'promo-display':
      drawPromo(ctx, variant, level);
      break;
    case 'checkout':
      drawCheckout(ctx, rot, f === 1);
      break;
    default:
      drawShelfLike(ctx, typeId, rot, variant, level);
  }
  if (typeId !== 'checkout') levelTrim(ctx, level, W, H, topH, f);
  cache.set(key, c);
  return c;
}

export function spriteSize(typeId: FixtureTypeId, rot: Rot) {
  const { W, H } = spec(typeId, rot);
  return { W, H };
}

/** 小人 sprite：6×11，2 帧走路 */
export function personSprite(
  look: { skin: number; shirt: number; pants: number; hair: number },
  frame: number,
  scale: number,
): HTMLCanvasElement {
  const key = `person|${look.skin}|${look.shirt}|${look.pants}|${look.hair}|${frame % 2}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 6 * scale;
  c.height = 11 * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const skin = PAL.skin[look.skin % PAL.skin.length];
  const shirt = PAL.shirt[look.shirt % PAL.shirt.length];
  const pants = PAL.pants[look.pants % PAL.pants.length];
  const hair = PAL.hair[look.hair % PAL.hair.length];
  px(ctx, 1, 0, 4, 1, hair);
  px(ctx, 1, 1, 4, 3, skin);
  px(ctx, 1, 1, 1, 1, hair);
  px(ctx, 4, 1, 1, 1, hair);
  px(ctx, 2, 2, 1, 1, PAL.ink);
  px(ctx, 4, 2, 1, 1, PAL.ink);
  px(ctx, 1, 4, 4, 4, shirt);
  px(ctx, 0, 4, 1, 3, skin);
  px(ctx, 5, 4, 1, 3, skin);
  if (frame % 2 === 0) {
    px(ctx, 1, 8, 2, 2, pants);
    px(ctx, 3, 8, 2, 2, pants);
    px(ctx, 1, 10, 2, 1, PAL.ink);
    px(ctx, 3, 10, 2, 1, PAL.ink);
  } else {
    px(ctx, 1, 8, 2, 3, pants);
    px(ctx, 3, 8, 2, 1, pants);
    px(ctx, 3, 9, 2, 1, PAL.ink);
  }
  cache.set(key, c);
  return c;
}

export function clearSpriteCache() {
  cache.clear();
}
