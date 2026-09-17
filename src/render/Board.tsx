import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { footprint } from '../game/catalog';
import { placeContext } from '../game/engine';
import { canPlace } from '../game/grid';
import { getSelectedType, useStore } from '../game/store';
import { Crowd } from './crowd';
import { logicalSize, makeView, renderScene, type Ghost, type View } from './draw';
import { TILE } from './sprites';

interface Props {
  /** 开业演出 */
  showCrowd: boolean;
  onCrowdDone?: () => void;
}

export function Board({ showCrowd, onCrowdDone }: Props) {
  const game = useStore((s) => s.game);
  const rot = useStore((s) => s.rot);
  const selectedType = useStore(getSelectedType);
  const placeAt = useStore((s) => s.placeAt);
  const rotate = useStore((s) => s.rotate);
  const showToast = useStore((s) => s.showToast);
  const fx = useStore((s) => s.fx);
  const removeFx = useStore((s) => s.removeFx);
  const finished = game?.finished ?? false;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ scale: 3, css: 3, ox: 6, oy: 20 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  /** 触屏待确认的格子 */
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  // 开业人群（可变对象，随 game / showCrowd 重建）
  const crowd = useMemo(() => (game && showCrowd ? new Crowd(game) : null), [game, showCrowd]);
  const doorOpen = showCrowd;

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

  const ghostAt = useCallback(
    (cell: { x: number; y: number }): (Ghost & { reason: string | null }) | null => {
      if (!game || finished || !selectedType) return null;
      const fp = footprint(selectedType, rot);
      const x = cell.x - Math.floor((fp.w - 1) / 2);
      const y = cell.y - Math.floor((fp.h - 1) / 2);
      const check = canPlace(placeContext(game), { typeId: selectedType, x, y, rot });
      return { typeId: selectedType, x, y, rot, ok: check.ok, reason: check.reason ?? null };
    },
    [game, finished, selectedType, rot],
  );

  const ghost = useMemo(() => (hover ? ghostAt(hover) : null), [hover, ghostAt]);
  const ghostReason = ghost && !ghost.ok ? ghost.reason : null;

  // 渲染循环：闲时低频，演出时逐帧
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
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      if (crowd) crowd.update(dt);
      const animated = !!crowd || (ghost && !ghost.ok);
      if (animated || acc >= 0.45) {
        if (acc >= 0.45) {
          acc = 0;
          frame++;
        }
        renderScene(ctx, game, view, { ghost, crowd: crowd?.people ?? [], frame, showFlow: !showCrowd, doorOpen });
      }
      if (crowd && crowd.finished && !doneFired) {
        doneFired = true;
        onCrowdDone?.();
      }
      raf = requestAnimationFrame(loop);
    };
    renderScene(ctx, game, view, { ghost, crowd: crowd?.people ?? [], frame, showFlow: !showCrowd, doorOpen });
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game, view, ghost, showCrowd, doorOpen, onCrowdDone, crowd]);

  const cellFromEvent = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || !game) return null;
      const r = canvas.getBoundingClientRect();
      const lx = (e.clientX - r.left) / view.css - view.ox;
      const ly = (e.clientY - r.top) / view.css - view.oy;
      const x = Math.floor(lx / TILE);
      const y = Math.floor(ly / TILE);
      if (x < 0 || y < 0 || x >= game.board.cols || y >= game.board.rows) return null;
      return { x, y };
    },
    [game, view],
  );

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const c = cellFromEvent(e);
    if (!c) {
      setHover(null);
      return;
    }
    if (!hover || hover.x !== c.x || hover.y !== c.y) setHover(c);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (finished || e.button === 2) return;
    const c = cellFromEvent(e);
    if (!c) return;
    if (e.pointerType === 'touch') {
      // 触屏两步放置：第一次点预览 + 弹出确认栏；再点同一格或点 ✓ 才落地
      if (pending && pending.x === c.x && pending.y === c.y) {
        tryPlace(c);
      } else {
        if (!selectedType) showToast('先在下方选一张货架卡');
        setHover(c);
        setPending(c);
      }
      return;
    }
    setPending(null);
    setHover(c);
    tryPlace(c);
  };

  const clearPending = () => {
    setPending(null);
    setHover(null);
  };

  const tryPlace = (cell: { x: number; y: number }) => {
    if (!selectedType) {
      showToast('先在下方选一张货架卡');
      return;
    }
    const g = ghostAt(cell);
    if (!g) return;
    if (!g.ok) {
      showToast(g.reason ?? '这里放不下');
      return;
    }
    if (placeAt(g.x, g.y)) clearPending();
  };

  if (!game) return null;
  const { w, h } = logicalSize(game.board);

  return (
    <div className="board-wrap" ref={wrapRef}>
      <div className="board-inner" style={{ width: w * view.css, height: h * view.css }}>
        <canvas
          ref={canvasRef}
          className="board-canvas"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerLeave={() => {
            if (!pending) setHover(null);
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
        {ghost && !ghost.ok && ghostReason && hover && !pending && (
          <div
            className="ghost-reason"
            style={{ left: (view.ox + hover.x * TILE + TILE / 2) * view.css, top: (view.oy + hover.y * TILE - 8) * view.css }}
          >
            {ghostReason}
          </div>
        )}
      </div>
      {pending && !finished && (
        <div className="touch-bar" onPointerDown={(e) => e.stopPropagation()}>
          <span className={`touch-reason ${ghost && !ghost.ok ? 'bad' : ''}`}>
            {!selectedType ? '先选一张卡' : ghost && !ghost.ok ? ghostReason ?? '这里放不下' : '放在这里？'}
          </span>
          <button className="btn" onClick={rotate} aria-label="旋转">
            ⟳
          </button>
          <button className="btn primary" onClick={() => tryPlace(pending)} disabled={!ghost || !ghost.ok}>
            ✓ 放置
          </button>
          <button className="btn" onClick={clearPending} aria-label="取消">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ScorePop({ id, text, good, left, top, onDone }: { id: number; text: string; good: boolean; left: number; top: number; onDone: (id: number) => void }) {
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
