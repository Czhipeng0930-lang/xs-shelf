import { useState } from 'react';
import { FIXTURES } from '../game/catalog';
import { SUBSIDY } from '../game/engine';
import { nextTier, tierOf } from '../game/progress';
import { DEAD_FACE_PENALTY, WASTE_PENALTY } from '../game/revenue';
import { encodeShare, shareText } from '../game/share';
import { useStore } from '../game/store';
import type { FixtureTypeId } from '../game/types';

interface Props {
  open: boolean;
}

/** 每天开门营业后的结算面板 */
export function DayReport({ open }: Props) {
  const game = useStore((s) => s.game);
  const closeReport = useStore((s) => s.closeReport);
  const showToast = useStore((s) => s.showToast);
  const [shareBox, setShareBox] = useState<string | null>(null);
  if (!game || !open || !game.lastReport) return null;

  const r = game.lastReport;
  const s = r.summary;
  const byType = new Map<FixtureTypeId, { count: number; total: number }>();
  for (const f of s.fixtures) {
    if (f.id === 'free-sample') continue;
    const cur = byType.get(f.typeId) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += f.total;
    byType.set(f.typeId, cur);
  }
  const top = [...byType.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  const next = nextTier(game.storeLevel);
  const toNext = next ? Math.max(0, next.need - game.totalRevenue) : 0;
  const subsidy = s.total <= 0;

  const tips: string[] = [];
  if (s.deadFaces > 0) tips.push(`有 ${s.deadFaces} 个取货面被挡住了（红叉处），每个少赚 ${DEAD_FACE_PENALTY}。挪开前面的货架就能救回来。`);
  if (s.wastedCells > 0) tips.push(`有 ${s.wastedCells} 格空地顾客走不进去（红色区域），每格扣 ${WASTE_PENALTY}。留一条路通到那边。`);
  if (s.queueLoss > 0) tips.push(`收银台不够，排队走掉了 ¥${s.queueLoss} 的生意。再加一台收银台。`);
  if (tips.length === 0 && !subsidy) tips.push('布局很干净，继续按人流旺的位置（地面偏橙）铺货架就能稳定涨钱。');

  return (
    <div className="modal-backdrop" onClick={closeReport}>
      <div className="modal report-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          第 {r.day} 天打烊 · {tierOf(r.storeLevel).name}
        </h2>
        <div className="revenue-hero">
          <span className="revenue-label">今日营业额</span>
          <span className="revenue-value">¥{r.revenue.toLocaleString('zh-CN')}</span>
          <span className="revenue-sub">
            {subsidy ? `没做成生意，街道补贴 ¥${SUBSIDY}` : `${r.customers} 位顾客结了账`}
          </span>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <span className="stat-value">{s.base}</span>
            <span className="stat-label">货架基础额</span>
          </div>
          <div className="stat">
            <span className="stat-value good">+{s.bonus}</span>
            <span className="stat-label">位置 / 动线加成</span>
          </div>
          <div className="stat">
            <span className={`stat-value ${s.deadFaces + s.wastedCells > 0 ? 'bad' : ''}`}>
              −{s.deadFaces * DEAD_FACE_PENALTY + s.wastedCells * WASTE_PENALTY}
            </span>
            <span className="stat-label">
              堵面 {s.deadFaces} · 死角 {s.wastedCells}
            </span>
          </div>
          <div className="stat total">
            <span className="stat-value">⭐ {game.coins.toLocaleString('zh-CN')}</span>
            <span className="stat-label">现在的分数</span>
          </div>
        </div>

        {top.length > 0 && (
          <div className="type-breakdown">
            {top.map(([t, v]) => (
              <span key={t} className="type-chip" style={{ borderColor: FIXTURES[t].color }}>
                {FIXTURES[t].name} ×{v.count} <b>¥{v.total}</b>
              </span>
            ))}
          </div>
        )}

        <ul className="tips">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        {next ? (
          <p className="muted small next-goal">
            再赚 <b>¥{toNext.toLocaleString('zh-CN')}</b> 就能升级成「{next.name}」，店面扩到 {next.cols}×{next.rows}，每天配额 {next.quota} 个。
          </p>
        ) : (
          <p className="muted small next-goal">已经是旗舰购物中心了，冲累计营业额新高吧。</p>
        )}

        {shareBox && <textarea className="share-fallback" readOnly value={shareBox} onFocus={(e) => e.currentTarget.select()} rows={5} />}

        <div className="report-actions">
          <button className="btn primary" onClick={closeReport}>
            开始第 {game.day} 天 →
          </button>
          <button className="btn" onClick={share}>
            📋 晒一下
          </button>
        </div>
      </div>
    </div>
  );

  async function share() {
    if (!game) return;
    const url = `${location.origin}${location.pathname}#${encodeShare({ mode: game.mode, seed: game.seed, actions: game.actions })}`;
    const text = shareText(game, url);
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      showToast('已复制，去群里晒店吧');
    } catch {
      setShareBox(text);
      showToast('请长按下方文本复制');
    }
  }
}
