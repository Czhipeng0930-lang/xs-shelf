import { create } from 'zustand';
import { ECON, FIXTURE_DEFS, canPlaceAt, defaultCategory } from './catalog';
import { clearSave, loadGame, saveGame } from './persistence';
import { Simulation } from './sim';
import type { CategoryId, DayReport, Fixture, FixtureTypeId, Phase, ViewMode } from './types';

let simInstance: Simulation | null = null;

export function getSim() {
  return simInstance;
}

let fixtureCounter = 1;

function nextFixtureId() {
  return `f${fixtureCounter++}`;
}

interface GameStore {
  day: number;
  money: number;
  fixtures: Fixture[];
  helpSeen: boolean;
  goalReached: boolean;
  phase: Phase;
  view: ViewMode;
  selectedId: string | null;
  placing: FixtureTypeId | null;
  speed: number;
  autoFinish: boolean;
  lastReport: DayReport | null;
  toast: string | null;
  addFixture: (typeId: FixtureTypeId, x: number, y: number) => boolean;
  moveFixture: (id: string, x: number, y: number) => void;
  rotateFixture: (id: string) => void;
  removeFixture: (id: string) => void;
  setCategory: (id: string, category: CategoryId) => void;
  openStore: () => void;
  finishDay: (report: DayReport) => void;
  nextDay: () => void;
  fastClose: () => void;
  setView: (view: ViewMode) => void;
  setPlacing: (typeId: FixtureTypeId | null) => void;
  select: (id: string | null) => void;
  setSpeed: (speed: number) => void;
  dismissHelp: () => void;
  resetGame: () => void;
  showToast: (message: string) => void;
}

const saved = typeof window !== 'undefined' ? loadGame() : null;
if (saved) {
  for (const f of saved.fixtures) {
    const n = Number(f.id.slice(1));
    if (Number.isFinite(n) && n >= fixtureCounter) fixtureCounter = n + 1;
  }
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function persist(s: GameStore) {
  saveGame({ v: 1, day: s.day, money: s.money, fixtures: s.fixtures, helpSeen: s.helpSeen, goalReached: s.goalReached });
}

export const useGame = create<GameStore>((set, get) => ({
  day: saved?.day ?? 1,
  money: saved?.money ?? ECON.startMoney,
  fixtures: saved?.fixtures ?? [],
  helpSeen: saved?.helpSeen ?? false,
  goalReached: saved?.goalReached ?? false,
  phase: 'edit',
  view: '2d',
  selectedId: null,
  placing: null,
  speed: 1,
  autoFinish: false,
  lastReport: null,
  toast: null,

  addFixture(typeId, x, y) {
    const s = get();
    const def = FIXTURE_DEFS[typeId];
    if (!def) return false;
    if (s.money < def.price) {
      s.showToast('资金不足');
      return false;
    }
    const candidate = { typeId, x, y, rotationDeg: 0 };
    if (!canPlaceAt(s.fixtures, candidate)) return false;
    const fixture: Fixture = { id: nextFixtureId(), ...candidate, category: defaultCategory(typeId) };
    set({ fixtures: [...s.fixtures, fixture], money: s.money - def.price, selectedId: fixture.id });
    persist(get());
    return true;
  },

  moveFixture(id, x, y) {
    const s = get();
    const f = s.fixtures.find((v) => v.id === id);
    if (!f) return;
    if (!canPlaceAt(s.fixtures, { typeId: f.typeId, x, y, rotationDeg: f.rotationDeg }, id)) return;
    set({ fixtures: s.fixtures.map((v) => (v.id === id ? { ...v, x, y } : v)) });
    persist(get());
  },

  rotateFixture(id) {
    const s = get();
    const f = s.fixtures.find((v) => v.id === id);
    if (!f) return;
    const rotationDeg = (f.rotationDeg + 90) % 360;
    if (!canPlaceAt(s.fixtures, { typeId: f.typeId, x: f.x, y: f.y, rotationDeg }, id)) {
      s.showToast('这里转不开');
      return;
    }
    set({ fixtures: s.fixtures.map((v) => (v.id === id ? { ...v, rotationDeg } : v)) });
    persist(get());
  },

  removeFixture(id) {
    const s = get();
    const f = s.fixtures.find((v) => v.id === id);
    if (!f) return;
    set({
      fixtures: s.fixtures.filter((v) => v.id !== id),
      money: s.money + FIXTURE_DEFS[f.typeId].price,
      selectedId: s.selectedId === id ? null : s.selectedId,
    });
    persist(get());
  },

  setCategory(id, category) {
    const s = get();
    set({ fixtures: s.fixtures.map((v) => (v.id === id ? { ...v, category } : v)) });
    persist(get());
  },

  openStore() {
    const s = get();
    if (!s.fixtures.some((f) => f.typeId === 'checkout')) {
      s.showToast('至少需要 1 个收银台才能营业');
      return;
    }
    if (!s.fixtures.some((f) => f.typeId !== 'checkout' && f.category)) {
      s.showToast('至少需要 1 个上架了品类的货架');
      return;
    }
    simInstance = new Simulation(s.fixtures, s.day);
    set({ phase: 'open', view: '3d', selectedId: null, placing: null, speed: 1, autoFinish: false });
  },

  finishDay(report) {
    const s = get();
    const money = s.money + report.revenue;
    set({
      phase: 'report',
      money,
      lastReport: { ...report, day: s.day },
      speed: 1,
      autoFinish: false,
      goalReached: s.goalReached || money >= ECON.goalMoney,
    });
    persist(get());
  },

  nextDay() {
    simInstance = null;
    set((s) => ({ phase: 'edit', view: '2d', day: s.day + 1, lastReport: null }));
    persist(get());
  },

  fastClose() {
    set({ autoFinish: true, speed: 6 });
  },

  setView(view) {
    set({ view });
  },

  setPlacing(typeId) {
    set({ placing: typeId, selectedId: typeId ? null : get().selectedId });
  },

  select(id) {
    set({ selectedId: id, placing: id ? null : get().placing });
  },

  setSpeed(speed) {
    set({ speed });
  },

  dismissHelp() {
    set({ helpSeen: true });
    persist(get());
  },

  resetGame() {
    clearSave();
    simInstance = null;
    set({
      day: 1,
      money: ECON.startMoney,
      fixtures: [],
      helpSeen: true,
      goalReached: false,
      phase: 'edit',
      view: '2d',
      selectedId: null,
      placing: null,
      speed: 1,
      autoFinish: false,
      lastReport: null,
      toast: null,
    });
  },

  showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 2600);
  },
}));
