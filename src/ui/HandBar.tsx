import { FIXTURES } from '../game/catalog';
import { canFinish, canPlaceCheckout, checkoutPlaced, handStuck } from '../game/engine';
import { CHECKOUT_UID, useStore } from '../game/store';
import { CardPreview } from './CardPreview';

export function HandBar() {
  const game = useStore((s) => s.game);
  const selectedUid = useStore((s) => s.selectedUid);
  const rot = useStore((s) => s.rot);
  const selectCard = useStore((s) => s.selectCard);
  const rotate = useStore((s) => s.rotate);
  const discardSelected = useStore((s) => s.discardSelected);
  const openStore = useStore((s) => s.openStore);
  if (!game || game.finished) return null;

  const showCheckout = canPlaceCheckout(game);
  const stuck = handStuck(game);
  const selected = selectedUid === CHECKOUT_UID ? FIXTURES.checkout : game.hand.find((c) => c.uid === selectedUid) ? FIXTURES[game.hand.find((c) => c.uid === selectedUid)!.typeId] : null;

  return (
    <div className="handbar">
      <div className="hand-cards">
        {game.hand.map((c, i) => {
          const def = FIXTURES[c.typeId];
          return (
            <button
              key={c.uid}
              className={`hand-card ${selectedUid === c.uid ? 'active' : ''}`}
              onClick={() => selectCard(c.uid)}
              title={def.hint}
            >
              <span className="hand-key">{i + 1}</span>
              <CardPreview typeId={c.typeId} rot={selectedUid === c.uid ? rot : 0} variant={c.variant} scale={2} />
              <span className="hand-name">{def.name}</span>
              <span className="hand-base">{def.base} 分</span>
            </button>
          );
        })}
        {showCheckout && (
          <button
            className={`hand-card checkout ${selectedUid === CHECKOUT_UID ? 'active' : ''} ${checkoutPlaced(game) ? 'extra' : ''}`}
            onClick={() => selectCard(CHECKOUT_UID)}
            title={FIXTURES.checkout.hint}
          >
            <span className="hand-key">C</span>
            <CardPreview typeId="checkout" rot={selectedUid === CHECKOUT_UID ? rot : 0} scale={2} />
            <span className="hand-name">收银台</span>
            <span className="hand-base">{checkoutPlaced(game) ? '第二台' : '必放'}</span>
          </button>
        )}
      </div>
      <div className="hand-actions">
        <div className="hand-hint">
          {selected ? (
            <>
              <b>{selected.name}</b>
              <span>{selected.hint}</span>
            </>
          ) : (
            <span>选一张卡，再点店面放置</span>
          )}
        </div>
        <div className="hand-buttons">
          <button className="btn" onClick={rotate} title="R / 右键">
            ⟳ 旋转
          </button>
          <button className="btn" onClick={discardSelected} disabled={game.discardsLeft <= 0 || !selected || selected.typeId === 'checkout'} title="丢弃当前卡并补一张">
            🗑 丢弃 ×{game.discardsLeft}
          </button>
          <button
            className={`btn primary ${stuck ? 'pulse' : ''}`}
            onClick={openStore}
            disabled={!canFinish(game)}
            title={checkoutPlaced(game) ? '结算并观看开业演出' : stuck ? '手牌已无处可放；没放收银台开业总分减半' : '先放收银台'}
          >
            🏪 开业结算{stuck && !checkoutPlaced(game) ? '（无收银 −50%）' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
