import { CATEGORIES, FIXTURE_DEFS, STORE } from './catalog';
import type { Fixture, SaveData } from './types';

const KEY = 'supermarket-tycoon-save-v1';
const MAX_FIXTURES = 200;

export function saveGame(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    return;
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const d = parsed as Partial<SaveData>;
    if (d.v !== 1) return null;
    if (typeof d.day !== 'number' || !Number.isFinite(d.day) || d.day < 1) return null;
    if (typeof d.money !== 'number' || !Number.isFinite(d.money)) return null;
    if (!Array.isArray(d.fixtures) || d.fixtures.length > MAX_FIXTURES) return null;
    const fixtures: Fixture[] = [];
    for (const f of d.fixtures) {
      if (typeof f !== 'object' || f === null) return null;
      const { id, typeId, x, y, rotationDeg, category } = f as Partial<Fixture>;
      if (typeof id !== 'string' || id.length === 0) return null;
      if (typeof typeId !== 'string' || !(typeId in FIXTURE_DEFS)) return null;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < -1 || y < -1 || x > STORE.width + 1 || y > STORE.depth + 1) return null;
      if (typeof rotationDeg !== 'number' || !Number.isFinite(rotationDeg)) return null;
      if (category !== null && category !== undefined && !(category in CATEGORIES)) return null;
      const rot = ((Math.round(rotationDeg / 90) * 90) % 360 + 360) % 360;
      fixtures.push({ id, typeId, x, y, rotationDeg: rot, category: category ?? null });
    }
    return {
      v: 1,
      day: Math.floor(d.day),
      money: d.money,
      fixtures,
      helpSeen: d.helpSeen === true,
      goalReached: d.goalReached === true,
    };
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
}
