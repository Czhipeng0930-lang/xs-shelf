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
  const [crowdSpeed, setCrowdSpeed] = useState(1);
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

  // 新的一天开业，速度回到原速
  useEffect(() => {
    if (screen === 'report') setCrowdSpeed(1);
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
      <TopBar opening={showingCrowd} onHelp={() => { if (!showingCrowd) setHelpOpen(true); }} />
      {toast && <div className="toast">{toast}</div>}
      <div className="play-layout">
        <div className="main">
          <Board showCrowd={showingCrowd} crowdSpeed={crowdSpeed} onCrowdDone={() => setCrowdDoneFor(day)} />
        </div>
        {screen === 'play' && <HandBar />}
        {showingCrowd && (
          <div className="crowd-actions">
            <button className="btn big" onClick={() => setCrowdSpeed((v) => (v === 1 ? 2 : 1))}>
              {crowdSpeed === 1 ? '⏩ 加速' : '▶ 原速'}
            </button>
            <button className="btn primary big" onClick={() => setCrowdDoneFor(day)}>
              跳过 · 看账本
            </button>
          </div>
        )}
      </div>
      <DayReport open={screen === 'report' && crowdDone} />
      {screen === 'play' && <UpgradePanel />}
      <HelpOverlay open={showHelp && !showingCrowd} onClose={closeHelp} />
    </div>
  );
}
