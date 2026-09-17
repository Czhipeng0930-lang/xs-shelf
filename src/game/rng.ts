/** mulberry32：小而快的可复现随机数；state 可读写以便不可变状态克隆 */
export interface Rng {
  state: number;
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
}

export function createRng(seed: number): Rng {
  const rng: Rng = {
    state: seed >>> 0,
    next() {
      rng.state = (rng.state + 0x6d2b79f5) >>> 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int: (max) => Math.floor(rng.next() * max),
    pick: (arr) => arr[Math.floor(rng.next() * arr.length)],
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return rng;
}

/** 复制一个独立的随机数生成器（状态相同、互不影响） */
export function forkRng(src: Rng): Rng {
  const r = createRng(0);
  r.state = src.state;
  return r;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 每日挑战种子：YYYYMMDD（本地时区） */
export function dailySeed(date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function dailyNumber(seed: number): number {
  const y = Math.floor(seed / 10000);
  const m = Math.floor((seed % 10000) / 100);
  const d = seed % 100;
  const epoch = Date.UTC(2026, 0, 1);
  return Math.floor((Date.UTC(y, m - 1, d) - epoch) / 86400000) + 1;
}
