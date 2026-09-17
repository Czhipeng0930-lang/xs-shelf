import { create } from 'zustand';
import { canPlaceCheckout, checkoutPlaced, discard, finish, newGame, pickPromo, place, replay, type GameState } from './engine';
import { loadSave, writeSave, type SaveData } from './persistence';
import { dailySeed } from './rng';
import { decodeShare } from './share';
import type { FixtureTypeId, GameMode, PromoId, Rot } from './types';

export type Screen = 'menu' | 'play' | 'result';

/** 收银台常驻槽位的 uid */
export const CHECKOUT_UID = 0;

export interface PopFx {
  id: number;
  x: number;
  y: number;
  text: string;
  good: boolean;
}

interface Store {
  screen: Screen;
  game: GameState | null;
  selectedUid: number | null;
  rot: Rot;
  helpSeen: boolean;
  bestDaily: Record<string, number>;
  bestEndless: number;
  toast: string | null;
  fx: PopFx[];
  /** 分享链接是回看别人的局 */
  viewingShared: boolean;

  startGame: (mode: GameMode, seed?: number) => void;
  resume: () => boolean;
  loadShared: (hash: string) => boolean;
  selectCard: (uid: number | null) => void;
  rotate: () => void;
  placeAt: (x: number, y: number) => boolean;
  discardSelected: () => void;
  pick: (promo: PromoId) => void;
  openStore: () => void;
  toMenu: () => void;
  dismissHelp: () => void;
  showToast: (msg: string) => void;
  removeFx: (id: number) => void;
}

const saved: SaveData = typeof window !== 'undefined' ? loadSave() : { v: 1, helpSeen: false, bestDaily: {}, bestEndless: 0, current: null };
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let fxCounter = 1;

function persist(s: Store) {
  const g = s.game;
  writeSave({
    v: 1,
    helpSeen: s.helpSeen,
    bestDaily: s.bestDaily,
    bestEndless: s.bestEndless,
    current: g && !s.viewingShared ? { mode: g.mode, seed: g.seed, actions: g.actions, finished: g.finished } : null,
  });
}

function autoSelect(g: GameState): number | null {
  if (g.hand.length > 0) return g.hand[0].uid;
  if (canPlaceCheckout(g) && !checkoutPlaced(g)) return CHECKOUT_UID;
  return null;
}

function selectedType(s: Store): FixtureTypeId | null {
  const g = s.game;
  if (!g || s.selectedUid === null) return null;
  if (s.selectedUid === CHECKOUT_UID) return canPlaceCheckout(g) ? 'checkout' : null;
  return g.hand.find((c) => c.uid === s.selectedUid)?.typeId ?? null;
}

export function getSelectedType(s: Store) {
  return selectedType(s);
}

export const useStore = create<Store>((set, get) => ({
  screen: 'menu',
  game: null,
  selectedUid: null,
  rot: 0,
  helpSeen: saved.helpSeen,
  bestDaily: saved.bestDaily,
  bestEndless: saved.bestEndless,
  toast: null,
  fx: [],
  viewingShared: false,

  startGame(mode, seed) {
    const s = seed ?? (mode === 'daily' ? dailySeed() : (Math.random() * 0xffffffff) >>> 0);
    const game = newGame(mode, s);
    set({ game, screen: 'play', selectedUid: autoSelect(game), rot: 0, fx: [], viewingShared: false });
    persist(get());
  },

  resume() {
    const cur = saved.current;
    if (!cur || cur.finished) return false;
    const game = replay(cur.mode, cur.seed, cur.actions);
    set({ game, screen: game.finished ? 'result' : 'play', selectedUid: autoSelect(game), rot: 0, fx: [], viewingShared: false });
    return true;
  },

  loadShared(hash) {
    const payload = decodeShare(hash);
    if (!payload) return false;
    const game = replay(payload.mode, payload.seed, payload.actions);
    set({ game, screen: game.finished ? 'result' : 'play', selectedUid: autoSelect(game), rot: 0, fx: [], viewingShared: true });
    return true;
  },

  selectCard(uid) {
    set({ selectedUid: uid });
  },

  rotate() {
    set((s) => ({ rot: ((s.rot + 1) % 4) as Rot }));
  },

  placeAt(x, y) {
    const s = get();
    const g = s.game;
    const typeId = selectedType(s);
    if (!g || !typeId) return false;
    const next = place(g, typeId, x, y, s.rot);
    if (!next) return false;
    const gain = next.lastGain;
    const fx: PopFx = { id: fxCounter++, x, y, text: gain >= 0 ? `+${gain}` : `${gain}`, good: gain >= 0 };
    const keep = typeId !== 'checkout' && next.hand.some((c) => c.typeId === typeId);
    const selectedUid = keep ? next.hand.find((c) => c.typeId === typeId)!.uid : autoSelect(next);
    set({ game: next, selectedUid, fx: [...s.fx, fx], screen: next.finished ? 'result' : 'play' });
    if (next.finished) recordBest(next, set, get);
    persist(get());
    return true;
  },

  discardSelected() {
    const s = get();
    const typeId = selectedType(s);
    if (!s.game || !typeId || typeId === 'checkout') return;
    const next = discard(s.game, typeId);
    if (!next) {
      s.showToast('丢弃次数用完了');
      return;
    }
    set({ game: next, selectedUid: autoSelect(next), screen: next.finished ? 'result' : 'play' });
    if (next.finished) recordBest(next, set, get);
    persist(get());
  },

  pick(promo) {
    const s = get();
    if (!s.game) return;
    const next = pickPromo(s.game, promo);
    if (!next) return;
    set({ game: next, selectedUid: s.selectedUid ?? autoSelect(next) });
    persist(get());
  },

  openStore() {
    const s = get();
    if (!s.game) return;
    const next = finish(s.game);
    if (!next) {
      s.showToast('先把收银台放在门口 3 格内');
      return;
    }
    set({ game: next, screen: 'result', selectedUid: null });
    recordBest(next, set, get);
    persist(get());
  },

  toMenu() {
    set({ screen: 'menu', viewingShared: false });
    if (typeof window !== 'undefined' && window.location.hash) history.replaceState(null, '', window.location.pathname);
  },

  dismissHelp() {
    set({ helpSeen: true });
    persist(get());
  },

  showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 2400);
  },

  removeFx(id) {
    set((s) => ({ fx: s.fx.filter((f) => f.id !== id) }));
  },
}));

function recordBest(g: GameState, set: (p: Partial<Store>) => void, get: () => Store) {
  const s = get();
  if (s.viewingShared) return;
  if (g.mode === 'daily') {
    const key = String(g.seed);
    if ((s.bestDaily[key] ?? 0) < g.score.total) set({ bestDaily: { ...s.bestDaily, [key]: g.score.total } });
  } else if (s.bestEndless < g.score.total) {
    set({ bestEndless: g.score.total });
  }
}

export function hasResumableRun() {
  return !!saved.current && !saved.current.finished && saved.current.actions.length > 0;
}

export function savedRunInfo() {
  return saved.current;
}
