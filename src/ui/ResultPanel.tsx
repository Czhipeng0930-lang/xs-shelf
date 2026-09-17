import { useMemo, useState } from 'react';
import { FIXTURES } from '../game/catalog';
import { DEAD_FACE_PENALTY, WASTE_PENALTY } from '../game/scoring';
import { emojiGrid, encodeShare, shareText, shareTitle } from '../game/share';
import { useStore } from '../game/store';
import type { FixtureTypeId } from '../game/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ResultPanel({ open, onClose }: Props) {
  const game = useStore((s) => s.game);
  const startGame = useStore((s) => s.startGame);
  const toMenu = useStore((s) => s.toMenu);
  const bestDaily = useStore((s) => s.bestDaily);
  const bestEndless = useStore((s) => s.bestEndless);
  const showToast = useStore((s) => s.showToast);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    if (!game) return '';
    const base = `${location.origin}${location.pathname}`;
    return `${base}#${encodeShare({ mode: game.mode, seed: game.seed, actions: game.actions })}`;
  }, [game]);

  if (!game || !open) return null;
  const s = game.score;
  const byType = new Map<FixtureTypeId, { count: number; total: number }>();
  for (const f of s.fixtures) {
    const cur = byType.get(f.typeId) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += f.total;
    byType.set(f.typeId, cur);
  }
  const best = game.mode === 'daily' ? bestDaily[String(game.seed)] ?? 0 : bestEndless;

  const copy = async () => {
    const text = shareText(game, url);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('已复制，去群里比拼吧');
    } catch {
      showToast('复制失败，请手动选择文本');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal result-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{shareTitle(game)}</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-value">{s.base}</span>
            <span className="stat-label">基础分</span>
          </div>
          <div className="stat">
            <span className="stat-value good">+{s.bonus}</span>
            <span className="stat-label">相邻 / 通道加成</span>
          </div>
          <div className="stat">
            <span className={`stat-value ${s.penalty > 0 ? 'bad' : ''}`}>−{s.penalty}</span>
            <span className="stat-label">
              浪费 {s.wastedCells}×{WASTE_PENALTY} · 死面 {s.deadFaces}×{DEAD_FACE_PENALTY}
              {!game.placements.some((p) => p.typeId === 'checkout') && ' · 无收银台 −50%'}
            </span>
          </div>
          <div className="stat total">
            <span className="stat-value">{s.total.toLocaleString('zh-CN')}</span>
            <span className="stat-label">{best > 0 && best <= s.total ? '🏆 新纪录' : `最佳 ${best.toLocaleString('zh-CN')}`}</span>
          </div>
        </div>
        <div className="type-breakdown">
          {[...byType.entries()].map(([t, v]) => (
            <span key={t} className="type-chip" style={{ borderColor: FIXTURES[t].color }}>
              {FIXTURES[t].name} ×{v.count} <b>{v.total}</b>
            </span>
          ))}
        </div>
        <pre className="emoji-grid">{emojiGrid(game)}</pre>
        <div className="result-actions">
          <button className="btn primary" onClick={copy}>
            {copied ? '✅ 已复制' : '📋 复制分享'}
          </button>
          <button className="btn" onClick={() => startGame(game.mode, game.mode === 'daily' ? game.seed : undefined)}>
            {game.mode === 'daily' ? '🔁 重摆今日' : '🎲 再来一局'}
          </button>
          <button className="btn" onClick={toMenu}>
            菜单
          </button>
        </div>
        <p className="muted small">链接打开可复现整家店：{url.length > 60 ? `${url.slice(0, 60)}…` : url}</p>
      </div>
    </div>
  );
}
