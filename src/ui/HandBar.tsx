import { FIXTURES, LEVEL_NAME } from '../game/catalog';
import { canOpen, checkoutCost, checkoutCount, handStuck, priceOf, quotaLeft } from '../game/engine';
import { CHECKOUT_UID, selectedCard, useStore } from '../game/store';
import { CardPreview } from './CardPreview';

export function HandBar() {
  const game = useStore((s) => s.game);
  const selectedUid = useStore((s) => s.selectedUid);
  const rot = useStore((s) => s.rot);
  const card = selectedCard({ game, selectedUid });
  const selectCard = useStore((s) => s.selectCard);
  const rerollHand = useStore((s) => s.rerollHand);
  const openStore = useStore((s) => s.openStore);
  if (!game || game.promoOffer) return null;

  const needCheckout = checkoutCount(game) === 0;
  const quota = quotaLeft(game);
  const stuck = handStuck(game);
  const openable = canOpen(game).ok;
  const def = card ? FIXTURES[card.typeId] : null;

  return (
    <div className="handbar">
      <div className="hand-cards">
        {game.hand.map((c, i) => {
          const d = FIXTURES[c.typeId];
          const price = priceOf(game, c.typeId, c.level);
          const poor = game.coins < price;
          const noQuota = quota <= 0;
          return (
            <button
              key={c.uid}
              className={`hand-card lv${c.level} ${selectedUid === c.uid ? 'active' : ''} ${poor || noQuota ? 'poor' : ''}`}
              onClick={() => selectCard(c.uid)}
              title={`${LEVEL_NAME[c.level - 1]}${d.name}：${d.tip}`}
            >
              <span className="hand-key">{i + 1}</span>
              {c.level > 1 && <span className={`lv-badge lv${c.level}`}>Lv{c.level}</span>}
              <CardPreview typeId={c.typeId} rot={selectedUid === c.uid ? rot : 0} variant={c.variant} level={c.level} scale={2} />
              <span className="hand-name">{d.short}</span>
              <span className="hand-price">{price}分</span>
            </button>
          );
        })}
        <button
          className={`hand-card checkout ${selectedUid === CHECKOUT_UID ? 'active' : ''} ${needCheckout ? 'must' : ''}`}
          onClick={() => selectCard(CHECKOUT_UID)}
          title={FIXTURES.checkout.tip}
        >
          <span className="hand-key">C</span>
          <CardPreview typeId="checkout" rot={selectedUid === CHECKOUT_UID ? rot : 0} scale={2} />
          <span className="hand-name">收银</span>
          <span className="hand-price">{checkoutCost(game) === 0 ? '免费' : `${checkoutCost(game)}分`}</span>
        </button>
      </div>

      <div className="hand-actions">
        <div className="hand-hint">
          {needCheckout ? (
            <>
              <b>先放一台收银台</b>
              <span>没有收银台顾客没法结账，第一台免费</span>
            </>
          ) : def && card ? (
            <>
              <b>
                {LEVEL_NAME[card.level - 1]}
                {def.name}
              </b>
              <span>{def.tip}</span>
            </>
          ) : (
            <span>选一张卡，点店面预览，再点 ✓ 放下。点已放的货架可升级或重摆。</span>
          )}
        </div>
        <div className="hand-buttons">
          <button className="btn" onClick={rerollHand} disabled={game.rerollsLeft <= 0} title="重新抽一手牌">
            🔄<span className="btn-label"> 换牌</span> {game.rerollsLeft}
          </button>
          <button
            className={`btn primary ${stuck || quota <= 0 ? 'pulse' : ''}`}
            onClick={openStore}
            disabled={!openable}
            title={openable ? '结算今天的营业额' : '先放一台收银台'}
          >
            🏪 开门营业
          </button>
        </div>
      </div>
    </div>
  );
}
