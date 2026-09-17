import { dailyNumber, dailySeed } from '../game/rng';
import { hasResumableRun, savedRunInfo, useStore } from '../game/store';
import { BrandLogo } from './BrandLogo';
import { CardPreview } from './CardPreview';

interface Props {
  onHelp: () => void;
}

export function Menu({ onHelp }: Props) {
  const startGame = useStore((s) => s.startGame);
  const resume = useStore((s) => s.resume);
  const bestDaily = useStore((s) => s.bestDaily);
  const bestEndless = useStore((s) => s.bestEndless);
  const today = dailySeed();
  const todayBest = bestDaily[String(today)];
  const resumable = hasResumableRun();
  const info = savedRunInfo();

  return (
    <div className="menu">
      <div className="menu-card">
        <div className="menu-brand">
          <BrandLogo size="md" />
          <span className="menu-brand-sub">出品</span>
        </div>
        <div className="menu-logo">
          <CardPreview typeId="double-gondola" scale={3} variant={0} />
          <CardPreview typeId="upright-chiller" scale={3} />
          <CardPreview typeId="wood-display" scale={3} variant={0} />
        </div>
        <h1>像素货架</h1>
        <p className="tagline">在一间像素小店里，把货架摆到满、摆到分最高。</p>
        {resumable && info && (
          <button className="btn big" onClick={() => resume()}>
            ▶ 继续上局（{info.mode === 'daily' ? '每日挑战' : '无尽模式'} · 已放 {info.actions.filter((a) => a.kind === 'place').length} 件）
          </button>
        )}
        <button className="btn primary big" onClick={() => startGame('daily')}>
          📅 每日挑战 #{dailyNumber(today)}
          {todayBest !== undefined && <span className="btn-sub">今日最佳 {todayBest}</span>}
        </button>
        <button className="btn big" onClick={() => startGame('endless')}>
          ♾ 无尽模式
          {bestEndless > 0 && <span className="btn-sub">最佳 {bestEndless}</span>}
        </button>
        <button className="btn big ghost" onClick={onHelp}>
          ? 玩法说明
        </button>
        <p className="muted small">全球同种子、同牌序，把结果贴到群里比拼。纯前端，无需联网。</p>
      </div>
    </div>
  );
}
