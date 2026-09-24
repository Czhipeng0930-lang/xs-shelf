import { useEffect, useState } from 'react';
import { useMusic } from './audio/useMusic';
import type { TrackId } from './audio/tracks';
import { CHECKOUT_UID, useStore } from './game/store';
import { Board } from './render/Board';
import { DayReport } from './ui/DayReport';
import { HandBar } from './ui/HandBar';
import { HelpOverlay } from './ui/HelpOverlay';
import { Menu } from './ui/Menu';
import { TopBar } from './ui/TopBar';
import { UpgradePanel } from './ui/UpgradePanel';

/** 开业演出最长播多久 */
const CROWD_MS = 7000;

export default function App() {
  const screen = useStore((s) => s.screen);
  const game = useStore((s) => s.game);
  const helpSeen = useStore((s) => s.helpSeen);
  const musicOn = useStore((s) => s.musicOn);
  const toast = useStore((s) => s.toast);
  const dismissHelp = useStore((s) => s.dismissHelp);
  const loadShared = useStore((s) => s.loadShared);
  const [helpOpen, setHelpOpen] = useState(false);
  /** 记录哪一天的开业演出已经看完，换天自动重置 */
  const [crowdDoneFor, setCrowdDoneFor] = useState<number | null>(null);
  const day = game?.day ?? 0;
  const crowdDone = crowdDoneFor === day;

  const showHelp = helpOpen || (screen === 'play' && !helpSeen);
  const showingCrowd = screen === 'report' && !crowdDone;
  const track: TrackId = screen === 'menu' ? 'menu' : showingCrowd ? 'rush' : screen === 'report' ? 'night' : 'build';
  useMusic(track, musicOn);

  // 分享链接直接打开
  useEffect(() => {
    if (window.location.hash.length > 1) {
      if (!loadShared(window.location.hash)) useStore.getState().showToast('分享链接无法解析');
    }
  }, [loadShared]);

  // 进入结算先看演出，超时兜底
  useEffect(() => {
    if (screen !== 'report') return;
    const t = setTimeout(() => setCrowdDoneFor(day), CROWD_MS);
    return () => clearTimeout(t);
  }, [screen, day]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === 'Escape') {
        setHelpOpen(false);
        s.cancelDraft();
        s.selectFixture(null);
        return;
      }
      if (s.screen !== 'play' || !s.game || s.game.promoOffer) return;
      if (e.key === 'r' || e.key === 'R') {
        if (s.selectedFixtureId && !s.draft) s.rotateSelectedFixture();
        else s.rotate();
      }
      if ((e.key === 'u' || e.key === 'U') && s.selectedFixtureId && !s.draft) s.upgradeSelectedFixture();
      if (e.key === 'Enter' && s.draft) s.confirmDraft();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedFixtureId) s.removeSelectedFixture();
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
        <HelpOverlay open={helpOpen} onClose={closeHelp} />
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar onHelp={() => setHelpOpen(true)} />
      {toast && <div className="toast">{toast}</div>}
      <div className="play-layout">
        <div className="main">
          <Board showCrowd={showingCrowd} onCrowdDone={() => setCrowdDoneFor(day)} />
          {showingCrowd && (
            <button className="btn primary skip-btn" onClick={() => setCrowdDoneFor(day)}>
              跳过 · 看账本 →
            </button>
          )}
        </div>
        {screen === 'play' && <HandBar />}
      </div>
      <DayReport open={screen === 'report' && crowdDone} />
      <UpgradePanel />
      <HelpOverlay open={showHelp} onClose={closeHelp} />
    </div>
  );
}
