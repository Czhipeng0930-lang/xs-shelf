import { CATEGORIES, FIXTURE_DEFS, FIXTURE_ORDER } from '../game/catalog';
import { useGame } from '../game/store';

export function Palette() {
  const money = useGame((s) => s.money);
  const placing = useGame((s) => s.placing);
  const setPlacing = useGame((s) => s.setPlacing);

  return (
    <aside className="palette">
      <h3>
        设备 <span className="muted">点击放置 · Esc 取消</span>
      </h3>
      {FIXTURE_ORDER.map((id) => {
        const def = FIXTURE_DEFS[id];
        const affordable = money >= def.price;
        const active = placing === id;
        const mainCategory = def.allowedCategories.length > 0 ? CATEGORIES[def.allowedCategories[0]].name : '结账';
        return (
          <button
            key={id}
            className={`palette-card ${active ? 'active' : ''} ${affordable ? '' : 'disabled'}`}
            onClick={() => setPlacing(active ? null : id)}
            title={def.hint}
          >
            <span className="icon">{def.emoji}</span>
            <span className="info">
              <span className="name">{def.name}</span>
              <span className="meta">
                {def.size.w}×{def.size.d}m · {mainCategory}
                {def.allowedCategories.length > 1 ? '等' : ''}
              </span>
            </span>
            <span className="price">¥{def.price}</span>
          </button>
        );
      })}
      <p className="muted small">删除设备全额退款，放心试错。</p>
    </aside>
  );
}
