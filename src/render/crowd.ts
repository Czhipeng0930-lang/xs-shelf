import { DIR_DX, DIR_DY } from '../game/catalog';
import type { GameState } from '../game/engine';
import { doorCells, idx, inBounds, sideCells, worldFaces } from '../game/grid';
import { createRng, type Rng } from '../game/rng';

type Cell = { x: number; y: number };

export interface Person {
  x: number;
  y: number;
  look: { skin: number; shirt: number; pants: number; hair: number };
  frame: number;
  bubble: 'grab' | 'pay' | null;
  path: Cell[];
  /** 到达路径终点后的停顿 */
  arrive: { bubble: 'grab' | 'pay'; wait: number } | null;
  state: 'shop' | 'pay' | 'leave' | 'exiting' | 'done';
  wait: number;
  visits: number;
  walkT: number;
}

const SPEED = 3.2; // 格/秒

/** 开业演出：像素小人沿通道逛店、拿货、结账、离场（纯装饰） */
export class Crowd {
  people: Person[] = [];
  private rng: Rng;
  private spawnTimer = 0;
  private spawned = 0;
  private readonly targets: Cell[];
  private readonly payCells: Cell[];
  private readonly doors: Cell[];
  readonly total: number;

  constructor(private g: GameState) {
    this.rng = createRng((g.seed ^ 0x51ed270b) >>> 0);
    this.doors = doorCells(g.board);
    const targets: Cell[] = [];
    for (const fs of g.score.fixtures) {
      const p = g.placements.find((q) => q.id === fs.id);
      if (!p || fs.base === 0) continue;
      for (const f of fs.faces) {
        if (!f.alive) continue;
        for (const s of sideCells(p, f.dir)) if (this.reachable(s.ox, s.oy)) targets.push({ x: s.ox, y: s.oy });
      }
    }
    this.targets = targets;
    const pay: Cell[] = [];
    for (const p of g.placements) {
      if (p.typeId !== 'checkout') continue;
      for (const dir of worldFaces(p)) for (const s of sideCells(p, dir)) if (this.reachable(s.ox, s.oy)) pay.push({ x: s.ox, y: s.oy });
    }
    this.payCells = pay;
    this.total = Math.min(18, 6 + Math.floor(g.placements.length / 2));
  }

  private reachable(x: number, y: number) {
    return inBounds(this.g.board, x, y) && this.g.flow.dist[idx(this.g.board, x, y)] >= 0;
  }

  private route(from: Cell, to: Cell): Cell[] {
    const b = this.g.board;
    const n = b.cols * b.rows;
    if (!inBounds(b, from.x, from.y) || !inBounds(b, to.x, to.y)) return [];
    const parent = new Int32Array(n).fill(-2);
    const start = idx(b, from.x, from.y);
    const goal = idx(b, to.x, to.y);
    parent[start] = -1;
    const q = [start];
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === goal) break;
      const cx = cur % b.cols;
      const cy = Math.floor(cur / b.cols);
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIR_DX[d];
        const ny = cy + DIR_DY[d];
        if (!inBounds(b, nx, ny)) continue;
        const ni = idx(b, nx, ny);
        if (!this.g.flow.empty[ni] || parent[ni] !== -2) continue;
        parent[ni] = cur;
        q.push(ni);
      }
    }
    if (parent[goal] === -2) return [];
    const path: Cell[] = [];
    for (let cur = goal; cur !== start; cur = parent[cur]) path.push({ x: cur % b.cols, y: Math.floor(cur / b.cols) });
    return path.reverse();
  }

  get finished() {
    return this.spawned >= this.total && this.people.length === 0;
  }

  update(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawned < this.total && this.spawnTimer <= 0 && this.doors.length > 0) {
      this.spawnTimer = 0.55 + this.rng.next() * 0.5;
      this.spawned++;
      const door = this.rng.pick(this.doors);
      this.people.push({
        x: door.x,
        y: door.y + 1.2,
        look: { skin: this.rng.int(4), shirt: this.rng.int(8), pants: this.rng.int(4), hair: this.rng.int(5) },
        frame: 0,
        bubble: null,
        path: [door],
        arrive: null,
        state: 'shop',
        wait: 0,
        visits: 0,
        walkT: 0,
      });
    }
    for (const p of this.people) this.step(p, dt);
    this.people = this.people.filter((p) => p.state !== 'done');
  }

  private step(p: Person, dt: number) {
    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait <= 0) p.bubble = null;
      return;
    }
    if (p.path.length === 0) {
      if (p.state === 'exiting') {
        p.state = 'done';
        return;
      }
      this.nextGoal(p);
      return;
    }
    const t = p.path[0];
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const dist = Math.hypot(dx, dy);
    const stepLen = SPEED * dt;
    if (dist <= stepLen) {
      p.x = t.x;
      p.y = t.y;
      p.path.shift();
      if (p.path.length === 0 && p.arrive) {
        p.bubble = p.arrive.bubble;
        p.wait = p.arrive.wait;
        p.arrive = null;
      }
    } else {
      p.x += (dx / dist) * stepLen;
      p.y += (dy / dist) * stepLen;
    }
    p.walkT += dt;
    p.frame = Math.floor(p.walkT * 8) % 2;
  }

  private nextGoal(p: Person) {
    const here = { x: Math.round(p.x), y: Math.round(p.y) };
    if (p.state === 'shop') {
      if (p.visits < 3 && this.targets.length > 0) {
        p.visits++;
        const target = this.rng.pick(this.targets);
        const path = this.route(here, target);
        if (path.length > 0) {
          p.path = path;
          p.arrive = { bubble: 'grab', wait: 0.5 };
        } else {
          p.bubble = 'grab';
          p.wait = 0.4;
        }
        return;
      }
      p.state = 'pay';
    }
    if (p.state === 'pay') {
      p.state = 'leave';
      if (this.payCells.length > 0) {
        const path = this.route(here, this.rng.pick(this.payCells));
        if (path.length > 0) {
          p.path = path;
          p.arrive = { bubble: 'pay', wait: 0.8 };
          return;
        }
      }
    }
    if (p.state === 'leave') {
      const door = this.rng.pick(this.doors);
      p.path = [...this.route(here, door), { x: door.x, y: door.y + 1.4 }];
      p.state = 'exiting';
    }
  }
}
