import { UNLOCK_TIERS } from '../game/catalog';
import { PROMOS } from '../game/promo';
import { dailyNumber } from '../game/rng';
import { useStore } from '../game/store';
import { BrandLogo } from './BrandLogo';

interface Props {
  onHelp: () => void;
}

export function TopBar({ onHelp }: Props) {
  const game = useStore((s) => s.game);
  const toMenu = useStore((s) => s.toMenu);
  const viewingShared = useStore((s) => s.viewingShared);
  if (!game) return null;
  const nextTier = UNLOCK_TIERS.find((t) => t > game.score.total);
  const progress = nextTier ? Math.min(1, game.score.total / nextTier) : 1;

  return (
    <div className="topbar">
      <button className="btn ghost" onClick={toMenu} title="返回菜单">
        ←
      </button>
      <span className="brand">
        <BrandLogo size="sm" markOnly />
        像素货架
      </span>
      <span className="pill mode">
        {game.mode === 'daily' ? `每日挑战 #${dailyNumber(game.seed)}` : `无尽 · ${game.board.cols}×${game.board.rows}`}
        {viewingShared && ' · 回看'}
      </span>
      <div className="score-block">
        <span className="score-value">⭐ {game.score.total.toLocaleString('zh-CN')}</span>
        <div className="unlock-bar" title={nextTier ? `${nextTier} 分解锁新货架 / 促销卡` : '已全部解锁'}>
          <div className="unlock-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <span className="spacer" />
      <span className="pill" title="牌库剩余">
        🂠 {game.deckRemaining}
      </span>
      <span className="promo-chips">
        {game.promos.map((p) => (
          <span key={p} className="promo-chip" title={`${PROMOS[p].name}：${PROMOS[p].desc}`}>
            {PROMOS[p].icon}
          </span>
        ))}
      </span>
      <button className="btn ghost" onClick={onHelp} title="玩法说明">
        ?
      </button>
    </div>
  );
}
