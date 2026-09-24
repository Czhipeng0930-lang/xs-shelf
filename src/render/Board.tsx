import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FIXTURES, LEVEL_NAME, refundOf } from '../game/catalog';
import { canUpgrade, fixtureAt } from '../game/engine';
import { draftPreview, selectedCard, useStore } from '../game/store';
import { Crowd } from './crowd';
import { logicalSize, makeView, renderScene, type Ghost, type View } from './draw';
import { TILE } from './sprites';

/** 长按多久算“拿起货架” */
const LONG_PRESS_MS = 320;
/** 手指滑动超过这个距离就当成拖拽，不再触发单击 */
const DRAG_SLOP = 10;

interface Props {
  /** 开业演出 */
  showCrowd: boolean;
  onCrowdDone?: () => void;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  fixtureId: string | null;
  touch: boolean;
  dragging: boolean;
  longPressed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function Board({ showCrowd, onCrowdDone }: Props) {
  const game = useStore((s) => s.game);
  const draft = useStore((s) => s.draft);
  const rot = useStore((s) => s.rot);
  const selectedUid = useStore((s) => s.selectedUid);
  const selectedFixtureId = useStore((s) => s.selectedFixtureId);
  const card = selectedCard({ game, selectedUid });
  const preview = draftPreview({ game, draft, rot, selectedUid });
  const beginDraftAt = useStore((s) => s.beginDraftAt);
  const moveDraftTo = useStore((s) => s.moveDraftTo);
  const beginMove = useStore((s) => s.beginMove);
  const confirmDraft = useStore((s) => s.confirmDraft);
  const cancelDraft = useStore((s) => s.cancelDraft);
  const selectFixture = useStore((s) => s.selectFixture);
  const rotateSelectedFixture = useStore((s) => s.rotateSelectedFixture);
  const upgradeSelectedFixture = useStore((s) => s.upgradeSelectedFixture);
  const removeSelectedFixture = useStore((s) => s.removeSelectedFixture);
  const rotate = useStore((s) => s.rotate);
  const showToast = useStore((s) => s.showToast);
  const fx = useStore((s) => s.fx);
  const removeFx = useStore((s) => s.removeFx);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [view, setView] = useState<View>({ scale: 3, css: 3, ox: 6, oy: 20 });
  const crowd = useMemo(() => (game && showCrowd ? new Crowd(game) : null), [game, showCrowd]);
  const locked = showCrowd || !!game?.promoOffer;

  // 自适应整数缩放
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !game) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      setView((prev) => {
        const next = makeView(game.board, r.width - 8, r.height - 8, window.devicePixelRatio || 1);
        return prev.scale === next.scale && prev.css === next.css ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [game?.board.cols, game?.board.rows, game]);

  const ghost: Ghost | null = useMemo(() => {
    if (!preview || locked) return null;
    return {
      typeId: preview.typeId,
      level: preview.level,
      x: preview.x,
      y: preview.y,
      rot: preview.rot,
      ok: preview.ok,
      movingId: preview.kind === 'move' && draft?.kind === 'move' ? draft.id : undefined,
    };
  }, [preview, locked, draft]);

  // 渲染循环：闲时低频，演出/预览时逐帧
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !game) return;
    const { w, h } = logicalSize(game.board);
    canvas.width = w * view.scale;
    canvas.height = h * view.scale;
    canvas.style.width = `${w * view.css}px`;
    canvas.style.height = `${h * view.css}px`;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frame = 0;
    let doneFired = false;
    const opts = () => ({
      ghost,
      crowd: crowd?.people ?? [],
      frame,
      showFlow: !showCrowd,
      selectedId: selectedFixtureId,
      doorOpen: showCrowd,
    });
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      if (crowd) crowd.update(dt);
      const animated = !!crowd || !!ghost || !!selectedFixtureId;
      if (acc >= 0.22) {
        acc = 0;
        frame++;
        renderScene(ctx, game, view, opts());
      } else if (animated) {
        renderScene(ctx, game, view, opts());
      }
      if (crowd && crowd.finished && !doneFired) {
        doneFired = true;
        onCrowdDone?.();
      }
      raf = requestAnimationFrame(loop);
    };
    renderScene(ctx, game, view, opts());
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game, view, ghost, showCrowd, onCrowdDone, crowd, selectedFixtureId]);

  const cellFrom = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !game) return null;
      const r = canvas.getBoundingClientRect();
      const lx = (clientX - r.left) / view.css - view.ox;
      const ly = (clientY - r.top) / view.css - view.oy;
      const x = Math.floor(lx / TILE);
      const y = Math.floor(ly / TILE);
      if (x < 0 || y < 0 || x >= game.board.cols || y >= game.board.rows) return null;
      return { x, y };
    },
    [game, view],
  );

  const clearTimer = () => {
    const g = gesture.current;
    if (g?.timer) {
      clearTimeout(g.timer);
      g.timer = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked || !game || e.button === 2) return;
    const cell = cellFrom(e.clientX, e.clientY);
    if (!cell) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const hit = fixtureAt(game, cell.x, cell.y);
    const g: Gesture = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      fixtureId: hit?.id ?? null,
      touch: e.pointerType !== 'mouse',
      dragging: false,
      longPressed: false,
      timer: null,
    };
    gesture.current = g;

    if (hit) {
      // 长按已放的货架 = 直接拿起来挪
      g.timer = setTimeout(() => {
        g.longPressed = true;
        g.timer = null;
        beginMove(hit.id);
        navigator.vibrate?.(18);
      }, LONG_PRESS_MS);
      return;
    }
    if (g.touch && card) beginDraftAt(cell.x, cell.y);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (locked || !game) return;
    const g = gesture.current;
    const cell = cellFrom(e.clientX, e.clientY);

    if (!g) {
      // 鼠标悬停：幽灵跟着光标走
      if (e.pointerType !== 'mouse' || !cell || !card) return;
      if (fixtureAt(game, cell.x, cell.y)) return;
      if (draft?.kind === 'place') moveDraftTo(cell.x, cell.y);
      else if (!draft) beginDraftAt(cell.x, cell.y);
      return;
    }
    if (e.pointerId !== g.pointerId) return;
    if (!g.dragging && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > DRAG_SLOP) {
      g.dragging = true;
      if (!g.longPressed) clearTimer();
    }
    if (cell && (g.dragging || g.longPressed) && draft) moveDraftTo(cell.x, cell.y);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    clearTimer();
    if (locked || !game || !g || e.pointerId !== g.pointerId) return;
    const cell = cellFrom(e.clientX, e.clientY);
    if (g.longPressed || g.dragging) return; // 拖完停在原地，等确认栏点 ✓

    if (g.fixtureId) {
      // 再点一次已选中的货架 = 拿起来重新放
      if (selectedFixtureId === g.fixtureId) beginMove(g.fixtureId);
      else selectFixture(g.fixtureId);
      return;
    }
    if (!cell) return;
    if (!card) {
      showToast('先在下面选一张货架卡');
      return;
    }
    // 触屏和鼠标都只出预览，必须点 ✓ 才落地，避免误触
    beginDraftAt(cell.x, cell.y);
  };

  if (!game) return null;
  const { w, h } = logicalSize(game.board);
  const selected = selectedFixtureId ? game.placements.find((p) => p.id === selectedFixtureId) : null;
  const selectedRevenue = selected ? game.preview.fixtures.find((f) => f.id === selected.id)?.total ?? 0 : 0;
  const upgrade = selected ? canUpgrade(game, selected.id) : null;

  return (
    <div className="board-wrap" ref={wrapRef}>
      <div className="board-inner" style={{ width: w * view.css, height: h * view.css }}>
        <canvas
          ref={canvasRef}
          className="board-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            clearTimer();
            gesture.current = null;
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            rotate();
          }}
        />
        {fx.map((f) => (
          <ScorePop
            key={f.id}
            id={f.id}
            text={f.text}
            good={f.good}
            left={(view.ox + f.x * TILE + TILE / 2) * view.css}
            top={(view.oy + f.y * TILE) * view.css}
            onDone={removeFx}
          />
        ))}
      </div>

      {preview && !locked && (
        <div className="action-bar" onPointerDown={(e) => e.stopPropagation()}>
          <span className={`action-label ${preview.ok ? '' : 'bad'}`}>
            {preview.ok ? (preview.kind === 'move' ? '挪到这里？' : '放在这里？') : preview.reason ?? '这里放不了'}
          </span>
          <button className="btn" onClick={rotate} aria-label="旋转">
            ⟳
          </button>
          <button className="btn primary" onClick={confirmDraft} disabled={!preview.ok}>
            ✓ {preview.kind === 'move' ? '挪好' : '放下'}
          </button>
          <button className="btn" onClick={cancelDraft} aria-label="取消">
            ✕
          </button>
        </div>
      )}

      {selected && !preview && !locked && (
        <div className="action-bar" onPointerDown={(e) => e.stopPropagation()}>
          <span className="action-label">
            {selected.typeId !== 'checkout' && <span className={`lv-badge lv${selected.level}`}>Lv{selected.level}</span>}
            {FIXTURES[selected.typeId].name}
            {selected.typeId !== 'checkout' && <b> 日赚 ¥{selectedRevenue}</b>}
          </span>
          {upgrade && selected.level < 3 && (
            <button
              className="btn primary"
              onClick={upgradeSelectedFixture}
              disabled={!upgrade.ok}
              title={upgrade.ok && upgrade.next ? `升到${LEVEL_NAME[upgrade.next - 1]}` : (upgrade.reason ?? '')}
            >
              ↑Lv{selected.level + 1} {upgrade.price}分
            </button>
          )}
          <button className="btn" onClick={rotateSelectedFixture} aria-label="旋转">
            ⟳
          </button>
          <button className="btn" onClick={() => beginMove(selected.id)}>
            ✥ 挪
          </button>
          <button className="btn danger" onClick={removeSelectedFixture}>
            ♻ {selected.typeId === 'checkout' ? '拆' : `+${refundOf(selected.typeId, selected.level)}`}
          </button>
          <button className="btn" onClick={() => selectFixture(null)} aria-label="取消">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ScorePop({
  id,
  text,
  good,
  left,
  top,
  onDone,
}: {
  id: number;
  text: string;
  good: boolean;
  left: number;
  top: number;
  onDone: (id: number) => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => onDone(id), 900);
    return () => clearTimeout(t);
  }, [id, onDone]);
  return (
    <div className={`score-pop ${good ? 'good' : 'bad'}`} style={{ left, top }}>
      {text}
    </div>
  );
}
