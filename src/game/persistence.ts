import type { Action, GameMode } from './types';

const KEY = 'pixel-shelves-v2';

export interface SavedRun {
  mode: GameMode;
  seed: number;
  actions: Action[];
}

export interface SaveData {
  v: 2;
  helpSeen: boolean;
  musicOn: boolean;
  /** 各模式历史最高累计营业额 */
  bestRevenue: number;
  bestDay: number;
  bestLevel: number;
  current: SavedRun | null;
}

const EMPTY: SaveData = { v: 2, helpSeen: false, musicOn: true, bestRevenue: 0, bestDay: 0, bestLevel: 1, current: null };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (d.v !== 2) return { ...EMPTY };
    return {
      v: 2,
      helpSeen: d.helpSeen === true,
      musicOn: d.musicOn !== false,
      bestRevenue: typeof d.bestRevenue === 'number' ? d.bestRevenue : 0,
      bestDay: typeof d.bestDay === 'number' ? d.bestDay : 0,
      bestLevel: typeof d.bestLevel === 'number' ? d.bestLevel : 1,
      current: d.current && typeof d.current === 'object' && Array.isArray(d.current.actions) ? d.current : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    return;
  }
}
