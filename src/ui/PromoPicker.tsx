import { FIXTURES, UNLOCK_TIERS } from '../game/catalog';
import { unlockedTypes } from '../game/engine';
import { PROMOS } from '../game/promo';
import { useStore } from '../game/store';
import { CardPreview } from './CardPreview';

export function PromoPicker() {
  const game = useStore((s) => s.game);
  const pick = useStore((s) => s.pick);
  if (!game || !game.promoOffer) return null;
  const prevTier = game.tier - 1;
  const newly = unlockedTypes(game.tier).filter((t) => !unlockedTypes(Math.max(0, prevTier)).includes(t));
  const threshold = UNLOCK_TIERS[Math.min(game.tier, UNLOCK_TIERS.length) - 1];

  return (
    <div className="modal-backdrop">
      <div className="modal promo-modal">
        <h2>🎉 达到 {threshold} 分！</h2>
        {newly.length > 0 && (
          <div className="unlock-row">
            <span className="muted">新货架加入牌库：</span>
            {newly.map((t) => (
              <span key={t} className="unlock-item">
                <CardPreview typeId={t} scale={2} />
                <span>{FIXTURES[t].name}</span>
              </span>
            ))}
          </div>
        )}
        <p className="muted">选一张促销卡，本局生效：</p>
        <div className="promo-grid">
          {game.promoOffer.map((id) => (
            <button key={id} className="promo-card" onClick={() => pick(id)}>
              <span className="promo-icon">{PROMOS[id].icon}</span>
              <b>{PROMOS[id].name}</b>
              <span className="small">{PROMOS[id].desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
