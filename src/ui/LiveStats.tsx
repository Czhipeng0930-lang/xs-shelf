import { useEffect, useState } from 'react';
import { getSim, useGame } from '../game/store';

export function LiveStats() {
  const phase = useGame((s) => s.phase);
  const speed = useGame((s) => s.speed);
  const autoFinish = useGame((s) => s.autoFinish);
  const setSpeed = useGame((s) => s.setSpeed);
  const [stats, setStats] = useState({ revenue: 0, inStore: 0, served: 0, abandoned: 0, remaining: 0 });

  useEffect(() => {
    if (phase !== 'open') return;
    const timer = setInterval(() => {
      const sim = getSim();
      if (!sim) return;
      setStats({
        revenue: Math.round(sim.revenue),
        inStore: sim.customers.length,
        served: sim.served,
        abandoned: sim.abandoned,
        remaining: sim.remainingVisitors(),
      });
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  if (phase !== 'open') return null;

  return (
    <div className="live-stats">
      <span className="ls-item">今日 <b>¥{stats.revenue.toLocaleString()}</b></span>
      <span className="ls-divider" />
      <span className="ls-item">在店 <b>{stats.inStore}</b></span>
      <span className="ls-item">已结账 <b>{stats.served}</b></span>
      <span className={`ls-item ${stats.abandoned > 0 ? 'bad' : ''}`}>弃购 <b>{stats.abandoned}</b></span>
      <span className="ls-item muted">待进场 {stats.remaining}</span>
      <span className="ls-divider" />
      {!autoFinish &&
        [1, 2, 4].map((s) => (
          <button key={s} className={`speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
      {autoFinish && <span className="ls-item muted">⏩ 打烊中…</span>}
    </div>
  );
}
