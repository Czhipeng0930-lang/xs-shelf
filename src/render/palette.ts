/** Endesga-32 为主的统一调色板 */
export const PAL = {
  outline: '#262b44',
  ink: '#181425',
  white: '#ffffff',
  light: '#c0cbdc',
  grey: '#8b9bb4',
  slate: '#5a6988',
  navy: '#3a4466',

  floorA: '#e9e2d0',
  floorB: '#e1d9c4',
  grout: '#cfc6ad',
  wallTop: '#c0cbdc',
  wallFace: '#8b9bb4',
  wallDark: '#5a6988',
  door: '#b86f50',
  doorDark: '#733e39',

  path: 'rgba(247, 118, 34, 0.75)',
  waste: 'rgba(228, 59, 68, 0.35)',
  ghostOk: 'rgba(99, 199, 77, 0.55)',
  ghostBad: 'rgba(228, 59, 68, 0.55)',
  power: '#fee761',
  powerDark: '#feae34',
  select: '#2ce8f5',

  skin: ['#e8b796', '#c28569', '#f6cfa8', '#a56f4f'],
  shirt: ['#e43b44', '#0099db', '#63c74d', '#feae34', '#b55088', '#f77622', '#2ce8f5', '#68386c'],
  pants: ['#3a4466', '#124e89', '#3e2731', '#265c42'],
  hair: ['#3e2731', '#181425', '#b86f50', '#feae34', '#733e39'],
};

/** 等级配色：2 级镀金，3 级霓虹 */
export const LEVEL_TRIM = ['', '#feae34', '#2ce8f5'] as const;
export const LEVEL_GLOW = ['', 'rgba(254,174,52,0.5)', 'rgba(44,232,245,0.55)'] as const;
/** 等级对机身颜色的提亮量 */
export const LEVEL_LIFT = [0, 16, 34] as const;

/** 商品配色（按变体） */
export const GOODS: string[][] = [
  ['#e43b44', '#feae34', '#f77622', '#fee761'], // 零食
  ['#0099db', '#2ce8f5', '#63c74d', '#124e89'], // 饮料
  ['#ffffff', '#f6757a', '#b55088', '#c0cbdc'], // 日化
];

export const FRESH: string[][] = [
  ['#63c74d', '#e43b44', '#feae34', '#3e8948'], // 果蔬
  ['#e4a672', '#b86f50', '#ead4aa', '#d77643'], // 烘焙
];

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 拉高饱和度，让高等级货架更扎眼 */
export function vivid(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const avg = (r + g + b) / 3;
  r = Math.max(0, Math.min(255, Math.round(r + (r - avg) * amt)));
  g = Math.max(0, Math.min(255, Math.round(g + (g - avg) * amt)));
  b = Math.max(0, Math.min(255, Math.round(b + (b - avg) * amt)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 人流热度 → 地面染色 */
export function heatTint(heat: number): string | null {
  if (heat <= 0.001) return null;
  const t = Math.max(0, Math.min(1, (heat - 0.35) / 0.95));
  const a = 0.06 + t * 0.26;
  const r = Math.round(250 - t * 6);
  const g = Math.round(210 - t * 96);
  const b = Math.round(120 - t * 86);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}
