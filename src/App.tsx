import { useEffect, useState } from 'react';
import { Editor2D } from './editor2d/Editor2D';
import { Sim3D } from './sim3d/Sim3D';
import { DayReportModal } from './ui/DayReport';
import { HelpOverlay } from './ui/HelpOverlay';
import { LiveStats } from './ui/LiveStats';
import { Palette } from './ui/Palette';
import { PropsPanel } from './ui/PropsPanel';
import { TopBar } from './ui/TopBar';
import { advanceSimulation } from './game/sim';
import { getSim, useGame } from './game/store';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const view = useGame((s) => s.view);
  const helpSeen = useGame((s) => s.helpSeen);
  const toast = useGame((s) => s.toast);
  const dismissHelp = useGame((s) => s.dismissHelp);
  const [helpOpen, setHelpOpen] = useState(!helpSeen);
  const [webgl] = useState(webglAvailable);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (e.key === 'Escape') {
        s.setPlacing(null);
        s.select(null);
        setHelpOpen(false);
        return;
      }
      if (s.phase !== 'edit' || !s.selectedId) return;
      if (e.key === 'r' || e.key === 'R') s.rotateFixture(s.selectedId);
      if (e.key === 'Delete' || e.key === 'Backspace') s.removeFixture(s.selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (phase !== 'open' || webgl) return;
    const timer = setInterval(() => {
      const sim = getSim();
      if (sim) advanceSimulation(sim, 0.05, 6);
    }, 50);
    return () => clearInterval(timer);
  }, [phase, webgl]);

  return (
    <div className="app">
      <TopBar onHelp={() => setHelpOpen(true)} />
      {toast && <div className="toast">{toast}</div>}
      <div className={`main ${phase === 'edit' ? 'edit' : ''}`}>
        {phase === 'edit' && <Palette />}
        <div className="canvas-wrap">
          {view === '2d' ? (
            <Editor2D />
          ) : webgl ? (
            <Sim3D />
          ) : (
            <div className="no-webgl">当前设备不支持 3D，已自动切换到 2D 编辑视图。</div>
          )}
          <LiveStats />
        </div>
        {phase === 'edit' && <PropsPanel />}
      </div>
      <DayReportModal />
      <HelpOverlay
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
          dismissHelp();
        }}
      />
    </div>
  );
}
