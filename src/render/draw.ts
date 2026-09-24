import { DIR_DX, DIR_DY, footprint } from '../game/catalog';
import type { GameState } from '../game/engine';
import { hasPower, idx, isBuffer, sideCells } from '../game/grid';
import type { Board, FixtureTypeId, Level, Placement, Rot } from '../game/types';
import type { Person } from './crowd';
import { heatTint, PAL } from './palette';
import { ELEV, fixtureSprite, personSprite, TILE } from './sprites';

export const WALL_SIDE = 6;
export const WALL_N = 20;
export const WALL_S = 6;

export interface View {
  /** 每逻辑像素对应的设备像素数（整数，保证像素锐利） */
  scale: number;
  /** 每逻辑像素对应的 CSS 像素数（= scale / devicePixelRatio） */
  css: number;
  /** 板原点在逻辑像素中的偏移 */
  ox: number;
  oy: number;
}

export function logicalSize(board: Board) {
  return { w: board.cols * TILE + WALL_SIDE * 2, h: board.rows * TILE + WALL_N + WALL_S };
}

export function makeView(board: Board, availW: number, availH: number, dpr = 1): View {
  const { w, h } = logicalSize(board);
  const scale = Math.max(1, Math.floor(Math.min((availW * dpr) / w, (availH * dpr) / h)));
  return { scale, css: scale / dpr, ox: WALL_SIDE, oy: WALL_N };
}

export interface Ghost {
  typeId: FixtureTypeId;
  level: Level;
  x: number;
  y: number;
  rot: Rot;
  ok: boolean;
  /** 移动模式下原位置要画成半透明 */
  movingId?: string;
}

export interface SceneOpts {
  ghost?: Ghost | null;
  crowd?: Person[];
  frame?: number;
  showFlow?: boolean;
  selectedId?: string | null;
  doorOpen?: boolean;
}

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawFloor(ctx: Ctx, g: GameState, v: View, showFlow: boolean) {
  const b = g.board;
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      const px = v.ox + x * TILE;
      const py = v.oy + y * TILE;
      rect(ctx, px, py, TILE, TILE, (x + y) % 2 === 0 ? PAL.floorA : PAL.floorB);
      rect(ctx, px, py + TILE - 1, TILE, 1, PAL.grout);
      rect(ctx, px + TILE - 1, py, 1, TILE, PAL.grout);
      if (isBuffer(b, x, y)) {
        rect(ctx, px, py, TILE, TILE, '#c9b7a2');
        for (let k = 0; k < TILE; k += 4) rect(ctx, px + k, py, 2, TILE, '#b89f86');
        rect(ctx, px, py + TILE - 1, TILE, 1, '#a08468');
      }
    }
  }
  if (!showFlow) return;
  const unreachable = new Set(g.flow.unreachable);
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      const i = idx(b, x, y);
      const px = v.ox + x * TILE;
      const py = v.oy + y * TILE;
      // 人流热度：越旺的通道地面越暖
      const tint = heatTint(g.flow.heat[i]);
      if (tint) rect(ctx, px, py, TILE, TILE, tint);
      if (g.flow.mainPath[i]) {
        rect(ctx, px + 5, py + 6, 2, 2, PAL.path);
        rect(ctx, px + 9, py + 9, 2, 2, PAL.path);
      }
      if (unreachable.has(i)) rect(ctx, px, py, TILE, TILE, PAL.waste);
    }
  }
}

function drawSocket(ctx: Ctx, x: number, y: number, horizontal: boolean) {
  if (horizontal) {
    rect(ctx, x, y, 6, 4, PAL.powerDark);
    rect(ctx, x + 1, y + 1, 4, 2, PAL.power);
  } else {
    rect(ctx, x, y, 4, 6, PAL.powerDark);
    rect(ctx, x + 1, y + 1, 2, 4, PAL.power);
  }
}

function drawWalls(ctx: Ctx, g: GameState, v: View, doorOpen: boolean) {
  const b = g.board;
  const W = b.cols * TILE;
  const H = b.rows * TILE;
  const totalW = W + WALL_SIDE * 2;
  rect(ctx, 0, 0, totalW, WALL_N, PAL.outline);
  rect(ctx, 1, 1, totalW - 2, 5, PAL.wallTop);
  rect(ctx, 1, 6, totalW - 2, WALL_N - 7, PAL.wallFace);
  rect(ctx, 1, WALL_N - 2, totalW - 2, 1, PAL.wallDark);
  rect(ctx, 1, 10, totalW - 2, 1, PAL.light);
  rect(ctx, 0, WALL_N, WALL_SIDE, H, PAL.outline);
  rect(ctx, 1, WALL_N, WALL_SIDE - 2, H, PAL.wallFace);
  rect(ctx, totalW - WALL_SIDE, WALL_N, WALL_SIDE, H, PAL.outline);
  rect(ctx, totalW - WALL_SIDE + 1, WALL_N, WALL_SIDE - 2, H, PAL.wallFace);
  const sy = WALL_N + H;
  rect(ctx, 0, sy, totalW, WALL_S, PAL.outline);
  rect(ctx, 1, sy, totalW - 2, WALL_S - 1, PAL.wallDark);
  const dx = v.ox + b.doorX * TILE;
  const dw = b.doorW * TILE;
  rect(ctx, dx, sy, dw, WALL_S, doorOpen ? PAL.floorA : PAL.door);
  if (!doorOpen) {
    rect(ctx, dx, sy, dw, 1, PAL.doorDark);
    rect(ctx, dx + dw / 2 - 1, sy, 2, WALL_S, PAL.doorDark);
    rect(ctx, dx + dw / 2 - 4, sy + 2, 2, 1, PAL.power);
    rect(ctx, dx + dw / 2 + 2, sy + 2, 2, 1, PAL.power);
  } else {
    rect(ctx, dx - 2, sy, 2, WALL_S, PAL.doorDark);
    rect(ctx, dx + dw, sy, 2, WALL_S, PAL.doorDark);
  }
  for (let x = 0; x < b.cols; x++) {
    if (hasPower(b, x, 0, 0)) drawSocket(ctx, v.ox + x * TILE + 5, 12, true);
  }
  for (let y = 0; y < b.rows; y++) {
    if (hasPower(b, 0, y, 3)) drawSocket(ctx, 1, v.oy + y * TILE + 5, false);
    if (hasPower(b, b.cols - 1, y, 1)) drawSocket(ctx, totalW - WALL_SIDE + 1, v.oy + y * TILE + 5, false);
  }
}

function drawFixture(
  ctx: Ctx,
  p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot' | 'variant' | 'level'>,
  v: View,
  frame: number,
  alpha = 1,
) {
  const spr = fixtureSprite(p.typeId, p.rot, p.variant, p.level, v.scale, frame);
  const fp = footprint(p.typeId, p.rot);
  const px = v.ox + p.x * TILE;
  const py = v.oy + p.y * TILE - ELEV[p.typeId];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, 0, 0, spr.width, spr.height, px, py, fp.w * TILE, fp.h * TILE + ELEV[p.typeId]);
  ctx.restore();
}

function drawPerson(ctx: Ctx, person: Person, v: View) {
  const spr = personSprite(person.look, person.frame, v.scale);
  const px = v.ox + person.x * TILE + 5;
  const py = v.oy + person.y * TILE + 3;
  ctx.drawImage(spr, 0, 0, spr.width, spr.height, px, py, 6, 11);
  if (person.bubble) {
    rect(ctx, px, py - 6, 6, 5, PAL.white);
    rect(ctx, px + 2, py - 1, 2, 1, PAL.white);
    rect(ctx, px + 2, py - 5, 2, 3, person.bubble === 'grab' ? '#e43b44' : '#feae34');
  }
}

/** 没朝通道的取货面打红叉，提醒玩家这面白摆了 */
function drawFaceMarkers(ctx: Ctx, g: GameState, v: View) {
  for (const fs of g.preview.fixtures) {
    const p = g.placements.find((q) => q.id === fs.id);
    if (!p || fs.base === 0) continue;
    for (const f of fs.faces) {
      if (f.alive) continue;
      for (const s of sideCells(p, f.dir)) {
        const cx = v.ox + s.x * TILE + TILE / 2 + DIR_DX[f.dir] * 6;
        const cy = v.oy + s.y * TILE + TILE / 2 + DIR_DY[f.dir] * 6;
        rect(ctx, cx - 2, cy - 2, 4, 4, PAL.outline);
        rect(ctx, cx - 1, cy - 1, 2, 2, '#e43b44');
      }
    }
  }
}

function outline(ctx: Ctx, v: View, p: Pick<Placement, 'typeId' | 'x' | 'y' | 'rot'>, color: string, dashPhase = 0) {
  const fp = footprint(p.typeId, p.rot);
  const x = v.ox + p.x * TILE;
  const y = v.oy + p.y * TILE - ELEV[p.typeId];
  const w = fp.w * TILE;
  const h = fp.h * TILE + ELEV[p.typeId];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2]);
  ctx.lineDashOffset = dashPhase;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  ctx.restore();
}

function drawGhost(ctx: Ctx, ghost: Ghost, v: View, frame: number) {
  const fp = footprint(ghost.typeId, ghost.rot);
  rect(ctx, v.ox + ghost.x * TILE, v.oy + ghost.y * TILE, fp.w * TILE, fp.h * TILE, ghost.ok ? PAL.ghostOk : PAL.ghostBad);
  const jitter = ghost.ok ? 0 : frame % 2 === 0 ? 0 : 1;
  drawFixture(ctx, { ...ghost, variant: 0 }, { ...v, ox: v.ox + jitter }, frame, 0.8);
  outline(ctx, v, ghost, ghost.ok ? '#63c74d' : '#e43b44', frame % 4);
}

export function renderScene(ctx: Ctx, g: GameState, v: View, opts: SceneOpts = {}) {
  const frame = opts.frame ?? 0;
  const { w, h } = logicalSize(g.board);
  ctx.setTransform(v.scale, 0, 0, v.scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  rect(ctx, 0, 0, w, h, PAL.outline);
  drawFloor(ctx, g, v, opts.showFlow ?? true);
  drawWalls(ctx, g, v, opts.doorOpen ?? false);

  const movingId = opts.ghost?.movingId;
  type Item = { bottom: number; draw: () => void };
  const items: Item[] = g.placements.map((p) => ({
    bottom: (p.y + footprint(p.typeId, p.rot).h) * TILE,
    draw: () => drawFixture(ctx, p, v, frame, p.id === movingId ? 0.3 : 1),
  }));
  for (const person of opts.crowd ?? []) {
    items.push({ bottom: person.y * TILE + 14, draw: () => drawPerson(ctx, person, v) });
  }
  items.sort((a, b) => a.bottom - b.bottom);
  for (const it of items) it.draw();

  if (opts.selectedId) {
    const p = g.placements.find((q) => q.id === opts.selectedId);
    if (p) outline(ctx, v, p, PAL.select, frame % 4);
  }
  drawFaceMarkers(ctx, g, v);
  if (opts.ghost) drawGhost(ctx, opts.ghost, v, frame);
}
