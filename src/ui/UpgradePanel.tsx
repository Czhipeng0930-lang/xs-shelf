import { FIXTURES } from '../game/catalog';
import { newTypesAt, tierOf } from '../game/progress';
import { PROMOS } from '../game/promo';
import { useStore } from '../game/store';
import { CardPreview } from './CardPreview';

/** 升级播报 + 功能牌三选一 */
export function UpgradePanel() {
  const game = useStore((s) => s.game);
  const pick = useStore((s) => s.pick);
  const ackUpgrade = useStore((s) => s.ackUpgrade);
  if (!game) return null;

  const upgraded = game.justUpgraded;
  const offer = game.promoOffer;
  if (!upgraded && !offer) return null;

  const tier = tierOf(upgraded ?? game.storeLevel);
  const newTypes = upgraded ? newTypesAt(upgraded) : [];

  return (
    <div className="modal-backdrop">
      <div className="modal promo-modal">
        {upgraded && (
          <>
            <h2>🎉 升级成「{tier.name}」</h2>
            <div className="upgrade-facts">
              <span className="fact">
                店面 <b>{tier.cols}×{tier.rows}</b>
              </span>
              <span className="fact">
                每日配额 <b>{tier.quota}</b> 个
              </span>
              <span className="fact">
                客流基数 <b>{tier.customers}</b>
              </span>
              <span className="fact">
                点货架花分升到 <b>精品 / 旗舰</b>
              </span>
            </div>
            {newTypes.length > 0 && (
              <div className="unlock-row">
                <span className="muted">新货架进牌库：</span>
                {newTypes.map((t) => (
                  <span key={t} className="unlock-item">
                    <CardPreview typeId={t} scale={2} />
                    <span>{FIXTURES[t].name}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {offer ? (
          <>
            <p className="muted">选一张功能牌，本局永久生效：</p>
            <div className="promo-grid">
              {offer.map((id) => (
                <button key={id} className="promo-card" onClick={() => pick(id)}>
                  <span className="promo-icon">{PROMOS[id].icon}</span>
                  <b>{PROMOS[id].name}</b>
                  <span className="small">{PROMOS[id].desc}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <button className="btn primary big" onClick={ackUpgrade}>
            继续经营 →
          </button>
        )}
      </div>
    </div>
  );
}
