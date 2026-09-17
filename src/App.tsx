import { useCallback, useEffect, useState } from 'react';
import type { GameState } from './game/engine';
import { CHECKOUT_UID, useStore } from './game/store';
import { Board } from './render/Board';
import { HandBar } from './ui/HandBar';
import { HelpOverlay } from './ui/HelpOverlay';
import { Menu } from './ui/Menu';
import { PromoPicker } from './ui/PromoPicker';
import { ResultPanel } from './ui/ResultPanel';
import { TopBar } from './ui/TopBar';

export default function App() {
  const screen = useStore((s) => s.screen);
  const game = useStore((s) => s.game);
  const helpSeen = useStore((s) => s.helpSeen);
  const toast = useStore((s) => s.toast);
  const dismissHelp = useStore((s) => s.dismissHelp);
  const loadShared = useStore((s) => s.loadShared);
  const [helpOpen, setHelpOpen] = useState(false);
  // 计分板：记录"为哪一局打开"，切局自动关闭
  const [resultFor, setResultFor] = useState<GameState | null>(null);
  const resultOpen = screen === 'result' && resultFor === game;
  // 第一次进入游戏自动弹帮助
  const showHelp = helpOpen || (screen === 'play' && !helpSeen);

  // 分享链接直接打开
  useEffect(() => {
    if (window.location.hash.length > 1) {
      if (!loadShared(window.location.hash)) useStore.getState().showToast('分享链接无法解析');
    }
  }, [loadShared]);

  // 结算：先看开业演出，最多 9 秒后弹计分板
  useEffect(() => {
    if (screen !== 'result') return;
    const t = setTimeout(() => setResultFor(useStore.getState().game), 9000);
    return () => clearTimeout(t);
  }, [screen, game]);
  const openResult = useCallback(() => setResultFor(useStore.getState().game), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === 'Escape') {
        setHelpOpen(false);
        if (s.screen === 'result') setResultFor(null);
        return;
      }
      if (s.screen !== 'play' || !s.game || s.game.promoOffer) return;
      if (e.key === 'r' || e.key === 'R') s.rotate();
      if (e.key === 'c' || e.key === 'C') s.selectCard(CHECKOUT_UID);
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && s.game.hand[n - 1]) s.selectCard(s.game.hand[n - 1].uid);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeHelp = () => {
    setHelpOpen(false);
    dismissHelp();
  };

  if (screen === 'menu' || !game) {
    return (
      <div className="app">
        <Menu onHelp={() => setHelpOpen(true)} />
        <HelpOverlay open={showHelp} onClose={closeHelp} />
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar onHelp={() => setHelpOpen(true)} />
      {toast && <div className="toast">{toast}</div>}
      <div className="main">
        <Board showCrowd={screen === 'result'} onCrowdDone={openResult} />
        {screen === 'result' && !resultOpen && (
          <button className="btn primary skip-btn" onClick={openResult}>
            查看计分板 →
          </button>
        )}
      </div>
      <HandBar />
      <PromoPicker />
      <ResultPanel open={resultOpen} onClose={() => setResultFor(null)} />
      <HelpOverlay open={showHelp} onClose={closeHelp} />
    </div>
  );
}
