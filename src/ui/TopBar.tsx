import { queueInfo, quotaLeft } from '../game/engine';
import { nextTier, tierOf } from '../game/progress';
import { PROMOS } from '../game/promo';
import { useStore } from '../game/store';
import { BrandLogo } from './BrandLogo';

interface Props {
  onHelp: () => void;
  /** 客人还在店里，顶栏仍显示这一天，而不是已经加过的下一天 */
  opening?: boolean;
}

export function TopBar({ onHelp, opening = false }: Props) {
  const game = useStore((s) => s.game);
  const toMenu = useStore((s) => s.toMenu);
  const musicOn = useStore((s) => s.musicOn);
  const toggleMusic = useStore((s) => s.toggleMusic);
  if (!game) return null;

  const tier = tierOf(game.storeLevel);
  const next = nextTier(game.storeLevel);
  const prevNeed = tier.need;
  const progress = next ? Math.min(1, (game.totalRevenue - prevNeed) / (next.need - prevNeed)) : 1;
  const queue = queueInfo(game);
  const tight = queue.expected > queue.capacity;

  return (
    <div className="topbar">
      <button className="btn ghost" onClick={toMenu} title="返回菜单">
        ←
      </button>
      <span className="brand">
        <BrandLogo size="sm" markOnly />
      </span>
      <span className="pill coins" title="分数：放货架和升级要花分，开门赚的钱自动换成分">
        ⭐ {game.coins.toLocaleString('zh-CN')}
      </span>
      <div className="tier-block">
        <span className="tier-name">
          {opening && game.lastReport ? `第 ${game.lastReport.day} 天开业中` : `第 ${game.day} 天 · ${tier.name}`}
        </span>
        <div className="tier-bar" title={next ? `累计 ¥${next.need} 升级扩店` : '已是最高等级'}>
          <div className="tier-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <span className="spacer" />
      <span className="pill quota" title="今天还能放几个货架">
        🧱 {quotaLeft(game)}/{tier.quota}
      </span>
      <span className={`pill queue ${tight ? 'bad' : ''}`} title="预计客流 / 收银台承载力">
        🧍 {queue.expected}/{queue.capacity}
      </span>
      <span className="promo-chips">
        {game.promos.map((p) => (
          <span key={p} className="promo-chip" title={`${PROMOS[p].name}：${PROMOS[p].desc}`}>
            {PROMOS[p].icon}
          </span>
        ))}
      </span>
      <button className="btn ghost" onClick={toggleMusic} title={musicOn ? '关闭音乐' : '打开音乐'}>
        {musicOn ? '🔊' : '🔇'}
      </button>
      <button className="btn ghost" onClick={onHelp} title="玩法说明">
        ?
      </button>
    </div>
  );
}
