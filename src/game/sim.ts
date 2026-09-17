import { CATEGORIES, CATEGORY_IDS, ECON, FIXTURE_DEFS, STORE, buddyBonusAt, fixtureAABB } from './catalog';
import { buildNavGrid, findPath, pathLengthFrom, type NavGrid } from './pathfinding';
import type { CategoryId, DayReport, Fixture } from './types';

export type Rng = () => number;

export type CustomerState = 'to-shelf' | 'browsing' | 'to-queue' | 'queuing' | 'to-exit' | 'exiting';
export type BubbleKind = 'find' | 'happy' | 'wait' | 'pay' | 'angry' | null;

export interface BasketItem {
  category: CategoryId;
  price: number;
  fixtureId: string;
  impulse: boolean;
}

export interface Want {
  category: CategoryId;
  state: 'pending' | 'done' | 'missing';
}

export interface SimCustomer {
  id: number;
  x: number;
  y: number;
  facing: number;
  speed: number;
  color: string;
  state: CustomerState;
  angry: boolean;
  path: { x: number; y: number }[];
  pathIndex: number;
  pauseTimer: number;
  waitTimer: number;
  wants: Want[];
  basket: BasketItem[];
  patience: number;
  mood: number;
  elapsed: number;
  targetFixtureId: string | null;
  triedFixtures: Set<string>;
  impulseSeen: Set<string>;
  impulseTimer: number;
  queueCheckout: number;
  queueJoinTime: number;
  tripLen: number;
  tripDirect: number;
}

export type SimEvent =
  | { type: 'sale'; x: number; y: number; amount: number }
  | { type: 'abandon'; x: number; y: number }
  | { type: 'day-end'; report: DayReport };

interface CheckoutLane {
  fixture: Fixture;
  queue: number[];
  progress: number;
}

export function bubbleOf(c: SimCustomer, paying: boolean): BubbleKind {
  if (c.angry) return 'angry';
  if (c.state === 'queuing') return paying ? 'pay' : 'wait';
  if (c.state === 'browsing') return 'happy';
  if (c.state === 'to-shelf') return 'find';
  return null;
}

export class Simulation {
  readonly grid: NavGrid;
  readonly fixtures: Fixture[];
  readonly rng: Rng;
  customers: SimCustomer[] = [];
  done = false;
  events: SimEvent[] = [];
  time = 0;
  revenue = 0;
  served = 0;
  abandoned = 0;
  windowShoppers = 0;
  impulseBuys = 0;
  missingHits = 0;

  private readonly door = { x: STORE.door.x, y: STORE.depth - 0.4 };
  private readonly fixtureById: Map<string, Fixture>;
  private readonly fixturesByCategory: Map<CategoryId, Fixture[]>;
  private readonly stockedCategories: Set<CategoryId>;
  private readonly impulseFixtures: Fixture[];
  private readonly lanes: CheckoutLane[];
  private readonly byId = new Map<number, SimCustomer>();
  private readonly moods: number[] = [];
  private readonly queueWaits: number[] = [];
  private spawnQueue: number[] = [];
  private nextCustomerId = 1;

  constructor(fixtures: Fixture[], day: number, rng: Rng = Math.random) {
    this.fixtures = fixtures;
    this.rng = rng;
    this.grid = buildNavGrid(fixtures);
    this.fixtureById = new Map(fixtures.map((f) => [f.id, f]));
    this.fixturesByCategory = new Map();
    for (const f of fixtures) {
      if (!f.category) continue;
      const list = this.fixturesByCategory.get(f.category) ?? [];
      list.push(f);
      this.fixturesByCategory.set(f.category, list);
    }
    this.stockedCategories = new Set(this.fixturesByCategory.keys());
    this.impulseFixtures = fixtures.filter((f) => FIXTURE_DEFS[f.typeId].impulsePower > 0 && f.category);
    this.lanes = fixtures.filter((f) => f.typeId === 'checkout').map((f) => ({ fixture: f, queue: [], progress: 0 }));
    const count = Math.round(ECON.customersBase(day) * (0.6 + (0.4 * this.stockedCategories.size) / CATEGORY_IDS.length));
    const window = count * 4.2;
    for (let i = 0; i < count; i++) this.spawnQueue.push(this.rng() * window * 0.9);
    this.spawnQueue.sort((a, b) => a - b);
  }

  isPaying(c: SimCustomer): boolean {
    const lane = this.lanes[c.queueCheckout];
    return !!lane && lane.queue[0] === c.id && lane.progress > 0.15;
  }

  remainingVisitors(): number {
    return this.spawnQueue.length + this.customers.length;
  }

  tick(dt: number) {
    if (this.done) return;
    this.time += dt;
    if (this.time > 300) {
      this.spawnQueue = [];
      for (const c of this.customers) c.patience = Math.min(c.patience, 5);
    }
    while (this.spawnQueue.length > 0 && this.spawnQueue[0] <= this.time) {
      this.spawnQueue.shift();
      this.spawnCustomer();
    }
    for (const c of [...this.customers]) this.stepCustomer(c, dt);
    this.stepCheckouts(dt);
    if (this.customers.some((c) => c.state === 'exiting')) {
      this.customers = this.customers.filter((c) => c.state !== 'exiting');
    }
    if (this.spawnQueue.length === 0 && this.customers.length === 0) {
      this.done = true;
      this.events.push({ type: 'day-end', report: this.buildReport() });
    }
  }

  private spawnCustomer() {
    const rng = this.rng;
    const wantCount = 1 + (rng() < 0.35 ? 1 : 0) + (rng() < 0.18 ? 1 : 0) + (rng() < 0.08 ? 1 : 0);
    const wants: Want[] = [];
    const stocked = [...this.stockedCategories];
    for (let i = 0; i < wantCount; i++) {
      const category: CategoryId =
        stocked.length > 0 && rng() < 0.8
          ? stocked[Math.floor(rng() * stocked.length)]
          : CATEGORY_IDS[Math.floor(rng() * CATEGORY_IDS.length)];
      wants.push({ category, state: 'pending' });
    }
    const id = this.nextCustomerId++;
    const c: SimCustomer = {
      id,
      x: this.door.x + (rng() - 0.5) * 0.9,
      y: STORE.depth - 0.25,
      facing: -Math.PI / 2,
      speed: 0.8 + rng() * 0.35,
      color: `hsl(${Math.floor(rng() * 360)} 68% 60%)`,
      state: 'to-exit',
      angry: false,
      path: [],
      pathIndex: 0,
      pauseTimer: 0,
      waitTimer: 0,
      wants,
      basket: [],
      patience: 90,
      mood: 100,
      elapsed: 0,
      targetFixtureId: null,
      triedFixtures: new Set(),
      impulseSeen: new Set(),
      impulseTimer: rng() * 0.3,
      queueCheckout: -1,
      queueJoinTime: 0,
      tripLen: 0,
      tripDirect: 0,
    };
    this.customers.push(c);
    this.byId.set(id, c);
    this.chooseNextTarget(c);
  }

  private chooseNextTarget(c: SimCustomer) {
    for (;;) {
      const want = c.wants.find((w) => w.state === 'pending');
      if (!want) {
        this.headToCheckout(c);
        return;
      }
      const candidates = (this.fixturesByCategory.get(want.category) ?? [])
        .filter((f) => !c.triedFixtures.has(f.id))
        .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
      let found = false;
      for (const f of candidates) {
        c.triedFixtures.add(f.id);
        const spot = this.browseSpot(f);
        if (!spot) continue;
        const path = findPath(this.grid, c.x, c.y, spot.x, spot.y);
        if (!path) continue;
        c.targetFixtureId = f.id;
        c.tripLen = pathLengthFrom(c, path);
        c.tripDirect = Math.hypot(spot.x - c.x, spot.y - c.y);
        c.path = path;
        c.pathIndex = 0;
        c.state = 'to-shelf';
        found = true;
        break;
      }
      if (found) return;
      want.state = 'missing';
      this.missingHits++;
      c.mood -= 18;
    }
  }

  private browseSpot(f: Fixture): { x: number; y: number } | null {
    const b = fixtureAABB(f);
    const m = 0.55;
    const candidates = [
      { x: f.x, y: b.y0 - m },
      { x: f.x, y: b.y1 + m },
      { x: b.x0 - m, y: f.y },
      { x: b.x1 + m, y: f.y },
    ];
    for (const p of candidates) {
      if (p.x < 0.05 || p.y < 0.05 || p.x > STORE.width - 0.05 || p.y > STORE.depth - 0.05) continue;
      if (this.grid.isWalkableAt(p.x, p.y)) return p;
      const cell = this.grid.nearestWalkable(...this.grid.worldToCell(p.x, p.y), 2);
      if (cell) return this.grid.cellToWorld(cell[0], cell[1]);
    }
    return null;
  }

  private headToCheckout(c: SimCustomer) {
    if (c.basket.length === 0) {
      this.windowShoppers++;
      this.sendToExit(c);
      return;
    }
    let bestLane = -1;
    let bestPath: { x: number; y: number }[] | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i];
      const spot = this.queueSlotPos(lane, lane.queue.length);
      if (!spot) continue;
      const path = findPath(this.grid, c.x, c.y, spot.x, spot.y);
      if (!path) continue;
      const score = pathLengthFrom(c, path) + lane.queue.length * 3;
      if (score < bestScore) {
        bestScore = score;
        bestLane = i;
        bestPath = path;
      }
    }
    if (bestLane < 0 || !bestPath) {
      this.abandon(c);
      return;
    }
    const lane = this.lanes[bestLane];
    lane.queue.push(c.id);
    c.queueCheckout = bestLane;
    c.queueJoinTime = this.time;
    c.state = 'to-queue';
    c.path = bestPath;
    c.pathIndex = 0;
  }

  private queueSlotPos(lane: CheckoutLane, k: number): { x: number; y: number } | null {
    const cx = STORE.width / 2;
    const cy = STORE.depth / 2;
    let dx = cx - lane.fixture.x;
    let dy = cy - lane.fixture.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const p = { x: lane.fixture.x + dx * (0.75 + 0.7 * k), y: lane.fixture.y + dy * (0.75 + 0.7 * k) };
    if (this.grid.isWalkableAt(p.x, p.y)) return p;
    const cell = this.grid.nearestWalkable(...this.grid.worldToCell(p.x, p.y), 3);
    if (!cell) return null;
    return this.grid.cellToWorld(cell[0], cell[1]);
  }

  private stepCustomer(c: SimCustomer, dt: number) {
    if (c.state === 'exiting') return;
    c.elapsed += dt;
    if (!c.angry) {
      let drain = 1;
      if (c.state === 'queuing') {
        const lane = this.lanes[c.queueCheckout];
        drain = 1.8 + Math.max(0, (lane ? lane.queue.length : 1) - 4) * 0.5;
      } else if (c.state === 'browsing') {
        drain = 0.3;
      }
      if (c.elapsed > 100) drain *= 1.5;
      c.patience -= drain * dt;
      if (c.patience <= 0) {
        this.abandon(c);
        return;
      }
    }
    if (c.pauseTimer > 0) {
      c.pauseTimer -= dt;
      return;
    }
    if (c.state === 'browsing') {
      c.waitTimer -= dt;
      if (c.waitTimer <= 0) this.pickUp(c);
      return;
    }
    if (c.state === 'queuing') return;
    this.moveAlong(c, dt);
    if (c.state === 'to-shelf' || c.state === 'to-queue') this.tryImpulse(c, dt);
  }

  private moveAlong(c: SimCustomer, dt: number) {
    const speed = c.speed * (c.basket.length > 2 ? 0.85 : 1) * (c.angry ? 1.4 : 1);
    let move = speed * dt;
    while (move > 0 && c.pathIndex < c.path.length) {
      const t = c.path[c.pathIndex];
      const dx = t.x - c.x;
      const dy = t.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) {
        c.pathIndex++;
        continue;
      }
      if (d <= move) {
        c.x = t.x;
        c.y = t.y;
        move -= d;
        c.pathIndex++;
      } else {
        c.x += (dx / d) * move;
        c.y += (dy / d) * move;
        move = 0;
      }
      c.facing = Math.atan2(dy, dx);
    }
    if (c.pathIndex >= c.path.length) this.onArrive(c);
  }

  private onArrive(c: SimCustomer) {
    if (c.state === 'to-shelf') {
      if (c.tripLen > c.tripDirect * 2.3 + 1.2) c.mood -= 8;
      c.state = 'browsing';
      c.waitTimer = 1.2 + this.rng() * 1.4;
    } else if (c.state === 'to-queue') {
      c.state = 'queuing';
    } else if (c.state === 'to-exit') {
      this.despawn(c);
    }
  }

  private pickUp(c: SimCustomer) {
    const want = c.wants.find((w) => w.state === 'pending');
    const f = c.targetFixtureId ? this.fixtureById.get(c.targetFixtureId) : undefined;
    if (want && f && f.category === want.category) {
      c.basket.push({ category: want.category, price: this.priceAt(f), fixtureId: f.id, impulse: false });
      want.state = 'done';
    }
    this.chooseNextTarget(c);
  }

  private priceAt(f: Fixture): number {
    const category = f.category;
    if (!category) return 0;
    let mult = 1;
    if (f.typeId === 'upright-chiller' && category === 'drinks') mult *= 1.6;
    if (buddyBonusAt(this.fixtures, f)) mult *= 1.15;
    return Math.max(1, Math.round(CATEGORIES[category].price * mult));
  }

  private tryImpulse(c: SimCustomer, dt: number) {
    c.impulseTimer -= dt;
    if (c.impulseTimer > 0) return;
    c.impulseTimer = 0.35;
    for (const f of this.impulseFixtures) {
      if (c.impulseSeen.has(f.id)) continue;
      if (Math.hypot(f.x - c.x, f.y - c.y) > 1.2) continue;
      c.impulseSeen.add(f.id);
      if (this.rng() < FIXTURE_DEFS[f.typeId].impulsePower * CATEGORIES[f.category!].impulse) {
        c.basket.push({ category: f.category!, price: this.priceAt(f), fixtureId: f.id, impulse: true });
        this.impulseBuys++;
        c.mood = Math.min(100, c.mood + 5);
        c.pauseTimer = Math.max(c.pauseTimer, 1.0);
      }
    }
  }

  private stepCheckouts(dt: number) {
    for (const lane of this.lanes) {
      const frontId = lane.queue[0];
      if (frontId === undefined) {
        lane.progress = 0;
        continue;
      }
      const front = this.byId.get(frontId);
      if (!front || front.state !== 'queuing') {
        if (!front) lane.queue.shift();
        continue;
      }
      lane.progress += dt / ECON.serviceSeconds;
      if (lane.progress >= 1) {
        lane.progress = 0;
        lane.queue.shift();
        const value = front.basket.reduce((s, it) => s + it.price, 0);
        this.revenue += value;
        this.served++;
        this.queueWaits.push(this.time - front.queueJoinTime);
        this.events.push({ type: 'sale', x: lane.fixture.x, y: lane.fixture.y, amount: value });
        this.sendToExit(front);
        lane.queue.forEach((id, k) => {
          const qc = this.byId.get(id);
          if (!qc || qc.state !== 'queuing') return;
          const spot = this.queueSlotPos(lane, k);
          if (spot) {
            qc.state = 'to-queue';
            qc.path = [spot];
            qc.pathIndex = 0;
          }
        });
      }
    }
  }

  private sendToExit(c: SimCustomer) {
    const path = findPath(this.grid, c.x, c.y, this.door.x, this.door.y);
    c.state = 'to-exit';
    c.queueCheckout = -1;
    if (path) {
      c.path = path;
      c.pathIndex = 0;
    } else {
      this.despawn(c);
    }
  }

  private abandon(c: SimCustomer) {
    if (c.angry) return;
    c.angry = true;
    c.mood = Math.min(c.mood, 20);
    this.abandoned++;
    this.events.push({ type: 'abandon', x: c.x, y: c.y });
    for (const lane of this.lanes) {
      const idx = lane.queue.indexOf(c.id);
      if (idx >= 0) lane.queue.splice(idx, 1);
    }
    this.sendToExit(c);
  }

  private despawn(c: SimCustomer) {
    c.state = 'exiting';
    this.moods.push(c.mood);
    this.byId.delete(c.id);
    for (const lane of this.lanes) {
      const idx = lane.queue.indexOf(c.id);
      if (idx >= 0) lane.queue.splice(idx, 1);
    }
  }

  private buildReport(): DayReport {
    const satisfaction = this.moods.length > 0 ? this.moods.reduce((s, m) => s + m, 0) / this.moods.length : 0;
    const avgQueueWait = this.queueWaits.length > 0 ? this.queueWaits.reduce((s, w) => s + w, 0) / this.queueWaits.length : 0;
    const tips: string[] = [];
    if (this.abandoned > 0) tips.push(`💢 有 ${this.abandoned} 位顾客失去耐心离开：检查排队长度和动线是否绕远`);
    if (avgQueueWait > 18) tips.push(`⏳ 平均排队 ${Math.round(avgQueueWait)} 秒：考虑增设收银台`);
    if (this.missingHits > 0) tips.push('🤔 有顾客没找到想要的品类：补齐缺的品类能留住他们');
    if (this.impulseBuys === 0 && this.served > 0) tips.push('🎯 把端头架/堆头摆在顾客必经之路上，能触发冲动消费');
    if (satisfaction >= 85 && this.served > 0) tips.push('🌟 顾客非常满意，好口碑正在传开');
    if (tips.length === 0) tips.push('📈 营业平稳：试着扩大高利润品类，或优化货架布局');
    return {
      day: 0,
      revenue: Math.round(this.revenue),
      served: this.served,
      windowShoppers: this.windowShoppers,
      abandoned: this.abandoned,
      impulseBuys: this.impulseBuys,
      missingHits: this.missingHits,
      satisfaction: Math.round(satisfaction),
      avgQueueWait: Math.round(avgQueueWait),
      tips,
    };
  }
}

export function advanceSimulation(sim: Simulation, dt: number, speed: number) {
  let remaining = Math.min(dt, 0.05) * speed;
  while (remaining > 0 && !sim.done) {
    const step = Math.min(remaining, 0.05);
    sim.tick(step);
    remaining -= step;
  }
}
