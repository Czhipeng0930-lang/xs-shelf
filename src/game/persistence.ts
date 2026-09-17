import type { Action, GameMode } from './types';

const KEY = 'pixel-shelves-v1';

export interface SavedRun {
  mode: GameMode;
  seed: number;
  actions: Action[];
  finished: boolean;
}

export interface SaveData {
  v: 1;
  helpSeen: boolean;
  bestDaily: Record<string, number>;
  bestEndless: number;
  current: SavedRun | null;
}

const EMPTY: SaveData = { v: 1, helpSeen: false, bestDaily: {}, bestEndless: 0, current: null };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (d.v !== 1) return { ...EMPTY };
    return {
      v: 1,
      helpSeen: d.helpSeen === true,
      bestDaily: typeof d.bestDaily === 'object' && d.bestDaily ? d.bestDaily : {},
      bestEndless: typeof d.bestEndless === 'number' ? d.bestEndless : 0,
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
