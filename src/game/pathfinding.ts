import { STORE, fixtureAABB, clamp } from './catalog';
import type { Fixture } from './types';

export const CELL = 0.3;

export class NavGrid {
  readonly blocked: Uint8Array;
  constructor(readonly cols: number, readonly rows: number) {
    this.blocked = new Uint8Array(cols * rows);
  }
  inBounds(cx: number, cy: number) {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows;
  }
  isWalkableCell(cx: number, cy: number) {
    return this.inBounds(cx, cy) && this.blocked[cy * this.cols + cx] === 0;
  }
  worldToCell(x: number, y: number): [number, number] {
    return [clamp(Math.floor(x / CELL), 0, this.cols - 1), clamp(Math.floor(y / CELL), 0, this.rows - 1)];
  }
  cellToWorld(cx: number, cy: number) {
    return { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
  }
  isWalkableAt(x: number, y: number) {
    const [cx, cy] = this.worldToCell(x, y);
    return this.isWalkableCell(cx, cy);
  }
  blockRect(x0: number, y0: number, x1: number, y1: number) {
    const [cx0, cy0] = this.worldToCell(x0, y0);
    const [cx1, cy1] = this.worldToCell(x1, y1);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (this.inBounds(cx, cy)) this.blocked[cy * this.cols + cx] = 1;
      }
    }
  }
  nearestWalkable(cx: number, cy: number, radius = 4): [number, number] | null {
    if (this.isWalkableCell(cx, cy)) return [cx, cy];
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.isWalkableCell(cx + dx, cy + dy)) return [cx + dx, cy + dy];
        }
      }
    }
    return null;
  }
}

export function buildNavGrid(fixtures: Fixture[]): NavGrid {
  const grid = new NavGrid(Math.floor(STORE.width / CELL), Math.floor(STORE.depth / CELL));
  for (const f of fixtures) {
    const b = fixtureAABB(f);
    grid.blockRect(b.x0 - 0.05, b.y0 - 0.05, b.x1 + 0.05, b.y1 + 0.05);
  }
  return grid;
}

const SQRT2 = Math.SQRT2;
const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

function heapPush(heap: number[], f: Float64Array, i: number) {
  heap.push(i);
  let c = heap.length - 1;
  while (c > 0) {
    const p = (c - 1) >> 1;
    if (f[heap[p]] <= f[heap[c]]) break;
    [heap[p], heap[c]] = [heap[c], heap[p]];
    c = p;
  }
}

function heapPop(heap: number[], f: Float64Array): number {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let p = 0;
    for (;;) {
      const l = p * 2 + 1;
      const r = l + 1;
      let s = p;
      if (l < heap.length && f[heap[l]] < f[heap[s]]) s = l;
      if (r < heap.length && f[heap[r]] < f[heap[s]]) s = r;
      if (s === p) break;
      [heap[p], heap[s]] = [heap[s], heap[p]];
      p = s;
    }
  }
  return top;
}

function lineWalkable(grid: NavGrid, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / (CELL * 0.4)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!grid.isWalkableAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

function smoothPath(grid: NavGrid, pts: { x: number; y: number }[]) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineWalkable(grid, pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

export function findPath(grid: NavGrid, sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
  const startCell = grid.nearestWalkable(...grid.worldToCell(sx, sy));
  const goalCell = grid.nearestWalkable(...grid.worldToCell(gx, gy), 6);
  if (!startCell || !goalCell) return null;
  const { cols } = grid;
  const size = cols * grid.rows;
  const startI = startCell[1] * cols + startCell[0];
  const goalI = goalCell[1] * cols + goalCell[0];
  if (startI === goalI) return [grid.cellToWorld(goalCell[0], goalCell[1])];
  const g = new Float64Array(size).fill(Infinity);
  const f = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open: number[] = [];
  g[startI] = 0;
  f[startI] = octile(startCell[0], startCell[1], goalCell[0], goalCell[1]);
  heapPush(open, f, startI);
  while (open.length > 0) {
    const cur = heapPop(open, f);
    if (cur === goalI) {
      const cells: { x: number; y: number }[] = [];
      let node = cur;
      while (node !== -1) {
        const cx = node % cols;
        const cy = (node - cx) / cols;
        cells.push(grid.cellToWorld(cx, cy));
        node = came[node];
      }
      cells.reverse();
      return smoothPath(grid, cells);
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % cols;
    const cy = (cur - cx) / cols;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.isWalkableCell(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!grid.isWalkableCell(cx + dx, cy) || !grid.isWalkableCell(cx, cy + dy))) continue;
      const ni = ny * cols + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        f[ni] = ng + octile(nx, ny, goalCell[0], goalCell[1]);
        heapPush(open, f, ni);
      }
    }
  }
  return null;
}

export function pathLengthFrom(start: { x: number; y: number }, path: { x: number; y: number }[]) {
  let len = 0;
  let prev = start;
  for (const p of path) {
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}
