import { ECON } from '../game/catalog';
import { useGame } from '../game/store';

export function DayReportModal() {
  const phase = useGame((s) => s.phase);
  const report = useGame((s) => s.lastReport);
  const money = useGame((s) => s.money);
  const goalReached = useGame((s) => s.goalReached);
  const nextDay = useGame((s) => s.nextDay);

  if (phase !== 'report' || !report) return null;
  const stars = Math.max(1, Math.round(report.satisfaction / 20));

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>📅 第 {report.day} 天 · 日结</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-value">¥{report.revenue.toLocaleString()}</span>
            <span className="stat-label">营业额</span>
          </div>
          <div className="stat">
            <span className="stat-value">{report.served}</span>
            <span className="stat-label">顾客结账</span>
          </div>
          <div className="stat">
            <span className={`stat-value ${report.abandoned > 0 ? 'bad' : ''}`}>{report.abandoned}</span>
            <span className="stat-label">失去耐心</span>
          </div>
          <div className="stat">
            <span className="stat-value">{'⭐'.repeat(stars)}</span>
            <span className="stat-label">满意度 {report.satisfaction}%</span>
          </div>
        </div>
        <div className="report-extra">
          冲动消费 {report.impulseBuys} 单 · 平均排队 {report.avgQueueWait}s
          {report.windowShoppers > 0 ? ` · ${report.windowShoppers} 人只逛没买` : ''}
        </div>
        <ul className="tips">
          {report.tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <div className="money-line">
          当前资金：<b>¥{money.toLocaleString()}</b>
          {!goalReached && <span className="muted"> / 目标 ¥{ECON.goalMoney.toLocaleString()}</span>}
        </div>
        {goalReached && (
          <div className="goal-banner">
            🎉 恭喜通关！总资产达到 ¥{ECON.goalMoney.toLocaleString()}。可以继续挑战更高营收。
          </div>
        )}
        <button className="btn primary big" onClick={nextDay}>
          开始第 {report.day + 1} 天 →
        </button>
      </div>
    </div>
  );
}
