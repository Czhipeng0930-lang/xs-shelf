import { create } from 'zustand';
import { footprint } from './catalog';
import {
  canAfford,
  canOpen,
  checkoutCount,
  dismissUpgrade,
  fixtureAt,
  moveFixture,
  newGame,
  openStore as engineOpen,
  pickPromo,
  place,
  placeContext,
  removeFixture,
  reroll,
  replay,
  upgradeFixture,
  type GameState,
} from './engine';
import { canPlace, flushWall, snapToWall } from './grid';
import { loadSave, writeSave, type SaveData } from './persistence';
import { dailySeed } from './rng';
import { decodeShare } from './share';
import type { Dir, FixtureTypeId, GameMode, Level, PromoId, Rot } from './types';

export type Screen = 'menu' | 'play' | 'report';

/** 收银台常驻槽位的 uid */
export const CHECKOUT_UID = 0;

export interface CardRef {
  uid: number;
  typeId: FixtureTypeId;
  level: Level;
}

/** 棋盘上正在确认的操作 */
export type Draft =
  | { kind: 'place'; uid: number; x: number; y: number }
  | { kind: 'move'; id: string; x: number; y: number };

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
  /** 棋盘上被点中的已放货架 */
  selectedFixtureId: string | null;
  draft: Draft | null;
  rot: Rot;
  /** 玩家手动转过；只在同一面墙上保持，换墙或离开墙后恢复自动贴墙 */
  rotPinned: boolean;
  pinnedWall: Dir | null;
  helpSeen: boolean;
  musicOn: boolean;
  bestRevenue: number;
  bestDay: number;
  bestLevel: number;
  toast: string | null;
  fx: PopFx[];
  viewingShared: boolean;

  startGame: (mode: GameMode, seed?: number) => void;
  resume: () => boolean;
  loadShared: (hash: string) => boolean;
  selectCard: (uid: number | null) => void;
  rotate: () => void;
  beginDraftAt: (x: number, y: number) => void;
  moveDraftTo: (x: number, y: number) => void;
  beginMove: (id: string) => void;
  confirmDraft: () => void;
  cancelDraft: () => void;
  selectFixture: (id: string | null) => void;
  rotateSelectedFixture: () => void;
  upgradeSelectedFixture: () => void;
  removeSelectedFixture: () => void;
  rerollHand: () => void;
  pick: (promo: PromoId) => void;
  openStore: () => void;
  closeReport: () => void;
  ackUpgrade: () => void;
  toMenu: () => void;
  dismissHelp: () => void;
  toggleMusic: () => void;
  showToast: (msg: string) => void;
  removeFx: (id: number) => void;
}

const saved: SaveData =
  typeof window !== 'undefined'
    ? loadSave()
    : { v: 2, helpSeen: false, musicOn: true, bestRevenue: 0, bestDay: 0, bestLevel: 1, current: null };

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let fxCounter = 1;

function persist(s: Store) {
  const g = s.game;
  writeSave({
    v: 2,
    helpSeen: s.helpSeen,
    musicOn: s.musicOn,
    bestRevenue: s.bestRevenue,
    bestDay: s.bestDay,
    bestLevel: s.bestLevel,
    current: g && !s.viewingShared ? { mode: g.mode, seed: g.seed, actions: g.actions } : null,
  });
}

function autoSelect(g: GameState): number | null {
  if (checkoutCount(g) === 0) return CHECKOUT_UID;
  return g.hand.length > 0 ? g.hand[0].uid : null;
}

/** 当前选中的卡（收银台走常驻槽位） */
export function selectedCard(s: Pick<Store, 'game' | 'selectedUid'>): CardRef | null {
  const g = s.game;
  if (!g || s.selectedUid === null) return null;
  if (s.selectedUid === CHECKOUT_UID) return { uid: CHECKOUT_UID, typeId: 'checkout', level: 1 };
  const c = g.hand.find((h) => h.uid === s.selectedUid);
  return c ? { uid: c.uid, typeId: c.typeId, level: c.level } : null;
}

/** 草稿对应的货架形状与合法性，渲染幽灵用 */
export function draftPreview(s: Pick<Store, 'game' | 'draft' | 'rot' | 'selectedUid'>) {
  const g = s.game;
  const d = s.draft;
  if (!g || !d) return null;
  if (d.kind === 'place') {
    const card = selectedCard(s);
    if (!card || card.uid !== d.uid) return null;
    const check = canPlace(placeContext(g), { typeId: card.typeId, x: d.x, y: d.y, rot: s.rot });
    const afford = canAfford(g, card.typeId, card.level);
    return {
      kind: 'place' as const,
      typeId: card.typeId,
      level: card.level,
      x: d.x,
      y: d.y,
      rot: s.rot,
      ok: check.ok && afford.ok,
      reason: !check.ok ? check.reason ?? null : !afford.ok ? afford.reason ?? null : null,
    };
  }
  const i = g.placements.findIndex((p) => p.id === d.id);
  if (i === -1) return null;
  const p = g.placements[i];
  const check = canPlace(placeContext(g), { typeId: p.typeId, x: d.x, y: d.y, rot: s.rot }, i);
  return {
    kind: 'move' as const,
    typeId: p.typeId,
    level: p.level,
    x: d.x,
    y: d.y,
    rot: s.rot,
    ok: check.ok,
    reason: check.reason ?? null,
  };
}

/** 把点到的格子换算成货架左上角，让手指落点大致居中 */
function anchor(typeId: FixtureTypeId, rot: Rot, x: number, y: number) {
  const fp = footprint(typeId, rot);
  return { x: x - Math.floor((fp.w - 1) / 2), y: y - Math.floor((fp.h - 1) / 2) };
}

/** 贴墙货架默认背面靠墙；同一面墙上手动转过则保持 */
function orientDraft(
  s: Pick<Store, 'game' | 'rot' | 'rotPinned' | 'pinnedWall'>,
  typeId: FixtureTypeId,
  x: number,
  y: number,
) {
  const g = s.game;
  if (!g) return { x, y, rot: s.rot, rotPinned: s.rotPinned, pinnedWall: s.pinnedWall };
  const snap = snapToWall(g.board, typeId, x, y, s.rot);
  if (snap.snapped && !(s.rotPinned && s.pinnedWall === snap.wall)) {
    return { x: snap.x, y: snap.y, rot: snap.rot, rotPinned: false, pinnedWall: null as Dir | null };
  }
  const a = anchor(typeId, s.rot, x, y);
  const leftWall = snap.snapped ? s.pinnedWall : null;
  return { x: a.x, y: a.y, rot: s.rot, rotPinned: snap.snapped ? s.rotPinned : false, pinnedWall: leftWall };
}

export const useStore = create<Store>((set, get) => ({
  screen: 'menu',
  game: null,
  selectedUid: null,
  selectedFixtureId: null,
  draft: null,
  rot: 0,
  rotPinned: false,
  pinnedWall: null,
  helpSeen: saved.helpSeen,
  musicOn: saved.musicOn,
  bestRevenue: saved.bestRevenue,
  bestDay: saved.bestDay,
  bestLevel: saved.bestLevel,
  toast: null,
  fx: [],
  viewingShared: false,

  startGame(mode, seed) {
    const s = seed ?? (mode === 'daily' ? dailySeed() : (Math.random() * 0xffffffff) >>> 0);
    const game = newGame(mode, s);
    set({
      game,
      screen: 'play',
      selectedUid: autoSelect(game),
      selectedFixtureId: null,
      draft: null,
      rot: 0,
      rotPinned: false,
      pinnedWall: null,
      fx: [],
      viewingShared: false,
    });
    persist(get());
  },

  resume() {
    const cur = saved.current;
    if (!cur || cur.actions.length === 0) return false;
    const game = replay(cur.mode, cur.seed, cur.actions);
    set({
      game,
      screen: 'play',
      selectedUid: autoSelect(game),
      selectedFixtureId: null,
      draft: null,
      rot: 0,
      rotPinned: false,
      pinnedWall: null,
      fx: [],
      viewingShared: false,
    });
    return true;
  },

  loadShared(hash) {
    const payload = decodeShare(hash);
    if (!payload) return false;
    const game = replay(payload.mode, payload.seed, payload.actions);
    set({
      game,
      screen: 'play',
      selectedUid: autoSelect(game),
      selectedFixtureId: null,
      draft: null,
      rot: 0,
      rotPinned: false,
      pinnedWall: null,
      fx: [],
      viewingShared: true,
    });
    return true;
  },

  selectCard(uid) {
    set({ selectedUid: uid, selectedFixtureId: null, draft: null, rotPinned: false, pinnedWall: null });
  },

  rotate() {
    set((s) => {
      const rot = ((s.rot + 1) % 4) as Rot;
      const g = s.game;
      const d = s.draft;
      if (!g || !d) return { rot, rotPinned: true, pinnedWall: null };
      const typeId = d.kind === 'place' ? selectedCard(s)?.typeId : g.placements.find((p) => p.id === d.id)?.typeId;
      if (!typeId) return { rot, rotPinned: true, pinnedWall: null };
      const pinnedWall = flushWall(g.board, { typeId, x: d.x, y: d.y, rot: s.rot });
      const fp = footprint(typeId, s.rot);
      const cx = d.x + Math.floor((fp.w - 1) / 2);
      const cy = d.y + Math.floor((fp.h - 1) / 2);
      const a = anchor(typeId, rot, cx, cy);
      return { rot, rotPinned: true, pinnedWall, draft: { ...d, x: a.x, y: a.y } };
    });
  },

  beginDraftAt(x, y) {
    const s = get();
    const g = s.game;
    if (!g || g.promoOffer) return;
    const hit = fixtureAt(g, x, y);
    if (hit) {
      set({ selectedFixtureId: hit.id, draft: null });
      return;
    }
    const card = selectedCard(s);
    if (!card) {
      s.showToast('先在下面选一张货架卡');
      return;
    }
    const afford = canAfford(g, card.typeId, card.level);
    if (!afford.ok) {
      s.showToast(afford.reason ?? '现在放不了');
      return;
    }
    const o = orientDraft(s, card.typeId, x, y);
    set({
      draft: { kind: 'place', uid: card.uid, x: o.x, y: o.y },
      rot: o.rot,
      rotPinned: o.rotPinned,
      pinnedWall: o.pinnedWall,
      selectedFixtureId: null,
    });
  },

  moveDraftTo(x, y) {
    const s = get();
    const d = s.draft;
    if (!d || !s.game) return;
    const typeId = d.kind === 'place' ? selectedCard(s)?.typeId : s.game.placements.find((p) => p.id === d.id)?.typeId;
    if (!typeId) return;
    const o = orientDraft(s, typeId, x, y);
    if (o.x === d.x && o.y === d.y && o.rot === s.rot) return;
    set({ draft: { ...d, x: o.x, y: o.y }, rot: o.rot, rotPinned: o.rotPinned, pinnedWall: o.pinnedWall });
  },

  beginMove(id) {
    const s = get();
    const g = s.game;
    if (!g || g.promoOffer) return;
    const p = g.placements.find((q) => q.id === id);
    if (!p) return;
    set({ draft: { kind: 'move', id, x: p.x, y: p.y }, rot: p.rot, rotPinned: false, pinnedWall: null, selectedFixtureId: id, selectedUid: null });
  },

  confirmDraft() {
    const s = get();
    const g = s.game;
    const d = s.draft;
    if (!g || !d) return;
    const pv = draftPreview(s);
    if (!pv) return;
    if (!pv.ok) {
      s.showToast(pv.reason ?? '这里放不了');
      return;
    }
    const next = d.kind === 'place' ? place(g, pv.typeId, pv.level, pv.x, pv.y, s.rot) : moveFixture(g, d.id, pv.x, pv.y, s.rot);
    if (!next) {
      s.showToast('这里放不了');
      return;
    }
    const gain = next.lastGain;
    const fx: PopFx[] =
      gain !== 0 ? [...s.fx, { id: fxCounter++, x: pv.x, y: pv.y, text: `${gain > 0 ? '+' : ''}${gain}`, good: gain > 0 }] : s.fx;
    set({
      game: next,
      draft: null,
      fx,
      selectedFixtureId: d.kind === 'move' ? d.id : null,
      selectedUid: d.kind === 'place' ? autoSelect(next) : null,
    });
    persist(get());
  },

  cancelDraft() {
    set({ draft: null });
  },

  selectFixture(id) {
    set({ selectedFixtureId: id, draft: null, selectedUid: id ? null : get().selectedUid });
  },

  rotateSelectedFixture() {
    const s = get();
    const g = s.game;
    const id = s.selectedFixtureId;
    if (!g || !id) return;
    const p = g.placements.find((q) => q.id === id);
    if (!p) return;
    const rot = ((p.rot + 1) % 4) as Rot;
    const next = moveFixture(g, id, p.x, p.y, rot);
    if (!next) {
      s.showToast('这里转不开，先挪个位置');
      return;
    }
    set({ game: next, rot });
    persist(get());
  },

  upgradeSelectedFixture() {
    const s = get();
    const g = s.game;
    const id = s.selectedFixtureId;
    if (!g || !id) return;
    const next = upgradeFixture(g, id);
    if (!next) {
      s.showToast('分数不够，开门赚点再升');
      return;
    }
    const gain = next.lastGain;
    const p = next.placements.find((q) => q.id === id);
    const fx: PopFx[] =
      p && gain !== 0 ? [...s.fx, { id: fxCounter++, x: p.x, y: p.y, text: `${gain > 0 ? '+' : ''}${gain}`, good: gain > 0 }] : s.fx;
    set({ game: next, fx });
    persist(get());
  },

  removeSelectedFixture() {
    const s = get();
    const g = s.game;
    const id = s.selectedFixtureId;
    if (!g || !id) return;
    const p = g.placements.find((q) => q.id === id);
    const next = removeFixture(g, id);
    if (!next) return;
    if (p?.typeId === 'checkout') s.showToast('收银台已拆除，开业前要记得放回来');
    set({ game: next, selectedFixtureId: null, draft: null, selectedUid: autoSelect(next) });
    persist(get());
  },

  rerollHand() {
    const s = get();
    if (!s.game) return;
    const next = reroll(s.game);
    if (!next) {
      s.showToast('今天的换牌次数用完了');
      return;
    }
    set({ game: next, selectedUid: autoSelect(next), draft: null });
    persist(get());
  },

  pick(promo) {
    const s = get();
    if (!s.game) return;
    const next = pickPromo(s.game, promo);
    if (!next) return;
    set({ game: next, selectedUid: autoSelect(next) });
    persist(get());
  },

  openStore() {
    const s = get();
    const g = s.game;
    if (!g) return;
    const check = canOpen(g);
    if (!check.ok) {
      s.showToast(check.reason ?? '还不能开业');
      return;
    }
    const next = engineOpen(g);
    if (!next) return;
    set({
      game: next,
      screen: 'report',
      draft: null,
      selectedFixtureId: null,
      selectedUid: autoSelect(next),
      bestRevenue: Math.max(s.bestRevenue, next.totalRevenue),
      bestDay: Math.max(s.bestDay, next.day - 1),
      bestLevel: Math.max(s.bestLevel, next.storeLevel),
    });
    persist(get());
  },

  closeReport() {
    set({ screen: 'play' });
  },

  ackUpgrade() {
    const g = get().game;
    if (g) set({ game: dismissUpgrade(g) });
  },

  toMenu() {
    set({ screen: 'menu', viewingShared: false, draft: null, selectedFixtureId: null });
    if (typeof window !== 'undefined' && window.location.hash) history.replaceState(null, '', window.location.pathname);
  },

  dismissHelp() {
    set({ helpSeen: true });
    persist(get());
  },

  toggleMusic() {
    set((s) => ({ musicOn: !s.musicOn }));
    persist(get());
  },

  showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 2200);
  },

  removeFx(id) {
    set((s) => ({ fx: s.fx.filter((f) => f.id !== id) }));
  },
}));

export function hasResumableRun() {
  return !!saved.current && saved.current.actions.length > 0;
}

export function savedRunInfo() {
  return saved.current;
}
