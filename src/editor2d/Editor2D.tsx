import { useCallback, useEffect, useRef, useState } from 'react';
import { CATEGORIES, FIXTURE_DEFS, STORE, canPlaceAt, doorClearanceRect, fixtureAABB } from '../game/catalog';
import { useGame } from '../game/store';
import type { Fixture, FixtureTypeId } from '../game/types';

const MARGIN = 1;
const DEFAULT_VB = { x: -MARGIN, y: -MARGIN, w: STORE.width + MARGIN * 2, h: STORE.depth + MARGIN * 2 };

function FixtureShape({ f, selected }: { f: Fixture; selected: boolean }) {
  const def = FIXTURE_DEFS[f.typeId];
  const b = fixtureAABB(f);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const cat = f.category ? CATEGORIES[f.category] : null;
  const fill = cat || f.typeId === 'checkout' ? def.color : '#c9c2b4';
  const label = f.typeId === 'checkout' ? '💳' : cat ? cat.emoji : '❓';
  return (
    <g>
      <rect x={b.x0} y={b.y0} width={w} height={h} rx={0.08} fill={fill} stroke={selected ? '#1c1a17' : def.darkColor} strokeWidth={selected ? 0.09 : 0.045} />
      {f.typeId === 'double-gondola' && w > h && (
        <line x1={b.x0 + 0.06} y1={f.y} x2={b.x1 - 0.06} y2={f.y} stroke="rgba(255,255,255,0.55)" strokeWidth={0.03} />
      )}
      {f.typeId === 'upright-chiller' && (
        <text x={f.x} y={b.y0 + 0.28} textAnchor="middle" fontSize={0.24}>❄️</text>
      )}
      <text x={f.x} y={f.y + 0.03} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(0.55, Math.min(w, h) * 0.55)}>{label}</text>
      {!cat && f.typeId !== 'checkout' && (
        <text x={f.x} y={b.y1 + 0.3} textAnchor="middle" fontSize={0.26} fill="#a09780">未上架</text>
      )}
    </g>
  );
}

function GhostShape({ typeId, x, y, valid }: { typeId: FixtureTypeId; x: number; y: number; valid: boolean }) {
  const def = FIXTURE_DEFS[typeId];
  return (
    <g pointerEvents="none">
      <rect
        x={x - def.size.w / 2}
        y={y - def.size.d / 2}
        width={def.size.w}
        height={def.size.d}
        rx={0.08}
        fill={valid ? def.color : '#e2503f'}
        fillOpacity={0.45}
        stroke={valid ? def.darkColor : '#b3362a'}
        strokeWidth={0.05}
        strokeDasharray={valid ? undefined : '0.15 0.1'}
      />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={0.38}>{def.emoji}</text>
    </g>
  );
}

export function Editor2D() {
  const fixtures = useGame((s) => s.fixtures);
  const selectedId = useGame((s) => s.selectedId);
  const placing = useGame((s) => s.placing);
  const phase = useGame((s) => s.phase);
  const addFixture = useGame((s) => s.addFixture);
  const moveFixture = useGame((s) => s.moveFixture);
  const select = useGame((s) => s.select);
  const setPlacing = useGame((s) => s.setPlacing);
  const editable = phase === 'edit';

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [vb, setVb] = useState(DEFAULT_VB);
  const [ghost, setGhost] = useState<{ x: number; y: number; valid: boolean } | null>(null);
  const dragRef = useRef<{ id: string; fixtureX: number; fixtureY: number } | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const vbRef = useRef(vb);
  useEffect(() => {
    vbRef.current = vb;
  }, [vb]);

  const toWorld = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const hitTest = useCallback(
    (x: number, y: number): Fixture | null => {
      for (let i = fixtures.length - 1; i >= 0; i--) {
        const b = fixtureAABB(fixtures[i]);
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return fixtures[i];
      }
      return null;
    },
    [fixtures],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      setVb((v) => {
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        const nw = Math.min(40, Math.max(4, v.w * factor));
        const nh = nw * (v.h / v.w);
        const rx = (p.x - v.x) / v.w;
        const ry = (p.y - v.y) / v.h;
        return { x: p.x - rx * nw, y: p.y - ry * nh, w: nw, h: nh };
      });
    };
    svg.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onNativeWheel);
  }, []);

  const zoomBy = (factor: number) => {
    setVb((v) => {
      const nw = Math.min(40, Math.max(4, v.w * factor));
      const nh = nw * (v.h / v.w);
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable || placing || e.button !== 0) return;
    const w = toWorld(e);
    const hit = hitTest(w.x, w.y);
    if (hit) {
      select(hit.id);
      dragRef.current = { id: hit.id, fixtureX: hit.x, fixtureY: hit.y };
    } else {
      select(null);
      panRef.current = { clientX: e.clientX, clientY: e.clientY, x: vbRef.current.x, y: vbRef.current.y };
    }
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (placing) {
      const w = toWorld(e);
      const x = Math.round(w.x * 10) / 10;
      const y = Math.round(w.y * 10) / 10;
      const valid = canPlaceAt(fixtures, { typeId: placing, x, y, rotationDeg: 0 });
      setGhost({ x, y, valid });
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      const w = toWorld(e);
      moveFixture(drag.id, Math.round(w.x * 10) / 10, Math.round(w.y * 10) / 10);
      return;
    }
    const pan = panRef.current;
    if (pan) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = Math.max(vbRef.current.w / rect.width, vbRef.current.h / rect.height);
      setVb((v) => ({ ...v, x: pan.x - (e.clientX - pan.clientX) * scale, y: pan.y - (e.clientY - pan.clientY) * scale }));
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    panRef.current = null;
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!placing) return;
    const w = toWorld(e);
    addFixture(placing, Math.round(w.x * 10) / 10, Math.round(w.y * 10) / 10);
  };

  const clearance = doorClearanceRect();
  const doorHalf = STORE.door.width / 2;

  return (
    <div className={`editor2d ${editable ? '' : 'locked'}`}>
      <svg
        ref={svgRef}
        className={`editor-svg ${placing ? 'placing' : ''}`}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setGhost(null)}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setPlacing(null);
          setGhost(null);
        }}
      >
        <rect x={-60} y={-60} width={STORE.width + 120} height={STORE.depth + 120} fill="#e8e2d4" />
        {Array.from({ length: STORE.width - 1 }, (_, i) => (
          <line key={`v${i}`} x1={i + 1} y1={0} x2={i + 1} y2={STORE.depth} stroke="#eee7d8" strokeWidth={0.02} />
        ))}
        {Array.from({ length: STORE.depth - 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i + 1} x2={STORE.width} y2={i + 1} stroke="#eee7d8" strokeWidth={0.02} />
        ))}
        <rect x={0} y={0} width={STORE.width} height={STORE.depth} fill="#fdfaf3" stroke="#3a352e" strokeWidth={0.12} />
        <line
          x1={STORE.door.x - doorHalf}
          y1={STORE.depth}
          x2={STORE.door.x + doorHalf}
          y2={STORE.depth}
          stroke="#fdfaf3"
          strokeWidth={0.14}
        />
        <line
          x1={STORE.door.x - doorHalf}
          y1={STORE.depth}
          x2={STORE.door.x + doorHalf}
          y2={STORE.depth}
          stroke="#2f9e6b"
          strokeWidth={0.07}
          strokeDasharray="0.25 0.15"
        />
        <text x={STORE.door.x} y={STORE.depth + 0.55} textAnchor="middle" fontSize={0.4} fill="#2f9e6b">🚪 入口 / 出口</text>
        {placing && (
          <rect
            x={clearance.x0}
            y={clearance.y0}
            width={clearance.x1 - clearance.x0}
            height={clearance.y1 - clearance.y0}
            fill="#e2503f"
            opacity={0.08}
            stroke="#e2503f"
            strokeWidth={0.03}
            strokeDasharray="0.2 0.15"
          />
        )}
        {fixtures.map((f) => (
          <FixtureShape key={f.id} f={f} selected={f.id === selectedId} />
        ))}
        {ghost && placing && <GhostShape typeId={placing} x={ghost.x} y={ghost.y} valid={ghost.valid} />}
      </svg>
      <div className="editor-zoom">
        <button onClick={() => zoomBy(0.8)} title="放大">＋</button>
        <button onClick={() => zoomBy(1.25)} title="缩小">－</button>
        <button onClick={() => setVb(DEFAULT_VB)} title="适应画布">⛶</button>
      </div>
      {placing && editable && (
        <div className="placing-hint">点击放置「{FIXTURE_DEFS[placing].name}」· 右键 / Esc 取消</div>
      )}
    </div>
  );
}
