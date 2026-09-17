import { ECON } from '../game/catalog';
import { useGame } from '../game/store';

export function TopBar({ onHelp }: { onHelp: () => void }) {
  const day = useGame((s) => s.day);
  const money = useGame((s) => s.money);
  const phase = useGame((s) => s.phase);
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const openStore = useGame((s) => s.openStore);
  const fastClose = useGame((s) => s.fastClose);
  const autoFinish = useGame((s) => s.autoFinish);
  const resetGame = useGame((s) => s.resetGame);

  return (
    <header className="topbar">
      <span className="brand">🏪 开店吧！超市</span>
      <span className="pill">📅 第 {day} 天</span>
      <span className="pill money">💰 ¥{money.toLocaleString()}</span>
      {phase === 'edit' && (
        <span className={`pill goal ${money >= ECON.goalMoney ? 'reached' : ''}`}>
          🎯 目标 ¥{ECON.goalMoney.toLocaleString()}
        </span>
      )}
      <div className="spacer" />
      <div className="tabs">
        <button className={`tab ${view === '2d' ? 'active' : ''}`} disabled={phase !== 'edit'} onClick={() => setView('2d')}>
          ✏️ 2D 布局
        </button>
        <button className={`tab ${view === '3d' ? 'active' : ''}`} disabled={phase !== 'edit'} onClick={() => setView('3d')}>
          🎥 3D 视角
        </button>
      </div>
      {phase === 'edit' && (
        <button className="btn primary" onClick={openStore}>
          ▶ 开门营业
        </button>
      )}
      {phase === 'open' && (
        <button className="btn" onClick={fastClose} disabled={autoFinish}>
          {autoFinish ? '⏩ 打烊中…' : '⏩ 快速打烊'}
        </button>
      )}
      <button className="btn ghost" onClick={onHelp} title="玩法说明">❓</button>
      <button
        className="btn ghost"
        title="重新开始"
        onClick={() => {
          if (window.confirm('确定重新开始吗？当前进度将被清空。')) resetGame();
        }}
      >
        🔄
      </button>
    </header>
  );
}
