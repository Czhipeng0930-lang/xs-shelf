import { tierOf } from '../game/progress';
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
  const bestRevenue = useStore((s) => s.bestRevenue);
  const bestDay = useStore((s) => s.bestDay);
  const bestLevel = useStore((s) => s.bestLevel);
  const musicOn = useStore((s) => s.musicOn);
  const toggleMusic = useStore((s) => s.toggleMusic);
  const today = dailySeed();
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
          <CardPreview typeId="double-gondola" scale={3} variant={0} level={1} />
          <CardPreview typeId="upright-chiller" scale={3} level={3} />
          <CardPreview typeId="wood-display" scale={3} variant={0} level={2} />
        </div>
        <h1>像素货架</h1>
        <p className="tagline">每天限量抽货架，开门赚钱自动变成分，摆对动线把小卖部做成购物中心。</p>

        {resumable && info && (
          <button className="btn big" onClick={() => resume()}>
            ▶ 继续经营
            <span className="btn-sub">{info.mode === 'daily' ? '每日挑战' : '自由经营'}</span>
          </button>
        )}
        <button className="btn primary big" onClick={() => startGame('endless')}>
          🏪 新开一家店
        </button>
        <button className="btn big" onClick={() => startGame('daily')}>
          📅 每日挑战 #{dailyNumber(today)}
          <span className="btn-sub">全球同种子</span>
        </button>
        <button className="btn big ghost" onClick={onHelp}>
          ? 玩法说明
        </button>

        {bestRevenue > 0 && (
          <p className="muted small">
            历史最好：{tierOf(bestLevel).name} · 经营 {bestDay} 天 · 累计 ¥{bestRevenue.toLocaleString('zh-CN')}
          </p>
        )}
        <button className="btn ghost music-toggle" onClick={toggleMusic}>
          {musicOn ? '🔊 音乐开' : '🔇 音乐关'}
        </button>
      </div>
    </div>
  );
}
