import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { FIXTURE_IDS } from './catalog';
import type { GameState } from './engine';
import { PROMO_IDS } from './promo';
import { dailyNumber } from './rng';
import type { Action, FixtureTypeId, GameMode } from './types';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '';
    out += i + 2 < bytes.length ? B64[n & 63] : '';
  }
  return out;
}

function fromBase64Url(s: string): Uint8Array {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad base64url');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

type Packed = number[];

function packAction(a: Action): Packed {
  if (a.kind === 'place') return [0, FIXTURE_IDS.indexOf(a.typeId), a.x, a.y, a.rot];
  if (a.kind === 'pick') return [1, PROMO_IDS.indexOf(a.promo)];
  if (a.kind === 'discard') return [2, FIXTURE_IDS.indexOf(a.typeId)];
  return [3];
}

function unpackAction(p: Packed): Action | null {
  if (!Array.isArray(p) || p.some((n) => typeof n !== 'number' || !Number.isInteger(n))) return null;
  if (p[0] === 0 && p.length === 5) {
    const typeId = FIXTURE_IDS[p[1]];
    if (!typeId || p[4] < 0 || p[4] > 3) return null;
    return { kind: 'place', typeId, x: p[2], y: p[3], rot: p[4] as 0 | 1 | 2 | 3 };
  }
  if (p[0] === 1 && p.length === 2) {
    const promo = PROMO_IDS[p[1]];
    return promo ? { kind: 'pick', promo } : null;
  }
  if (p[0] === 2 && p.length === 2) {
    const typeId = FIXTURE_IDS[p[1]];
    return typeId ? { kind: 'discard', typeId } : null;
  }
  if (p[0] === 3 && p.length === 1) return { kind: 'finish' };
  return null;
}

export interface SharePayload {
  mode: GameMode;
  seed: number;
  actions: Action[];
}

export function encodeShare(p: SharePayload): string {
  const json = JSON.stringify(p.actions.map(packAction));
  const bytes = deflateSync(strToU8(json), { level: 9 });
  return `${p.mode === 'daily' ? 'd' : 'e'}${p.seed}.${toBase64Url(bytes)}`;
}

export function decodeShare(hash: string): SharePayload | null {
  try {
    const s = hash.replace(/^#/, '');
    const m = /^([de])(\d+)\.([A-Za-z0-9_-]*)$/.exec(s);
    if (!m) return null;
    const mode: GameMode = m[1] === 'd' ? 'daily' : 'endless';
    const seed = Number(m[2]);
    if (!Number.isSafeInteger(seed)) return null;
    const actions: Action[] = [];
    if (m[3].length > 0) {
      const raw: unknown = JSON.parse(strFromU8(inflateSync(fromBase64Url(m[3]))));
      if (!Array.isArray(raw) || raw.length > 400) return null;
      for (const item of raw) {
        const a = unpackAction(item as Packed);
        if (!a) return null;
        actions.push(a);
      }
    }
    return { mode, seed, actions };
  } catch {
    return null;
  }
}

const EMOJI: Record<FixtureTypeId, string> = {
  'double-gondola': '🟩',
  'single-wall': '🟦',
  endcap: '🟨',
  'promo-display': '🟥',
  'warehouse-rack': '🟧',
  'upright-chiller': '🔷',
  'island-freezer': '🔵',
  'wood-display': '🟫',
  checkout: '🟪',
};

export function emojiGrid(s: GameState): string {
  const rows: string[] = [];
  const unreachable = new Set(s.flow.unreachable);
  for (let y = 0; y < s.board.rows; y++) {
    let line = '';
    for (let x = 0; x < s.board.cols; x++) {
      const i = y * s.board.cols + x;
      const o = s.occ[i];
      if (o === -1) line += unreachable.has(i) ? '⬛' : '⬜';
      else line += EMOJI[s.placements[o].typeId];
    }
    rows.push(line);
  }
  return rows.join('\n');
}

export function shareTitle(s: GameState): string {
  const score = s.score.total.toLocaleString('zh-CN');
  if (s.mode === 'daily') return `像素货架 每日挑战 #${dailyNumber(s.seed)}  ⭐ ${score}`;
  return `像素货架 无尽模式  ⭐ ${score}  ${s.board.cols}×${s.board.rows} 店面`;
}

export const SHARE_FOOTER = '润达货架 RUNDA SHELF 出品';

export function shareText(s: GameState, url: string): string {
  return `${shareTitle(s)}\n${emojiGrid(s)}\n${url}\n${SHARE_FOOTER}`;
}
