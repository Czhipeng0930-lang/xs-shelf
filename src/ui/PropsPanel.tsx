import { CATEGORIES, FIXTURE_DEFS } from '../game/catalog';
import { useGame } from '../game/store';

export function PropsPanel() {
  const fixtures = useGame((s) => s.fixtures);
  const selectedId = useGame((s) => s.selectedId);
  const rotateFixture = useGame((s) => s.rotateFixture);
  const removeFixture = useGame((s) => s.removeFixture);
  const setCategory = useGame((s) => s.setCategory);

  const fixture = fixtures.find((f) => f.id === selectedId);
  if (!fixture) {
    return (
      <aside className="props">
        <h3>属性</h3>
        <p className="muted">点击画布中的设备查看属性。</p>
        <div className="hint-card">
          <b>💡 摆货小窍门</b>
          <ul>
            <li>零食挨着饮料，销量 +15%</li>
            <li>饮料放冷柜，价格 ×1.6</li>
            <li>端头架 / 堆头放在必经之路，触发冲动消费</li>
            <li>收银台太少，排队会吓跑顾客</li>
          </ul>
        </div>
      </aside>
    );
  }

  const def = FIXTURE_DEFS[fixture.typeId];

  return (
    <aside className="props">
      <h3>
        {def.emoji} {def.name}
      </h3>
      <p className="muted">
        {def.size.w}m × {def.size.d}m × {def.size.h}m · ¥{def.price}
      </p>
      <p className="muted small">{def.hint}</p>
      <div className="prop-actions">
        <button className="btn" onClick={() => rotateFixture(fixture.id)}>↻ 旋转 (R)</button>
        <button className="btn danger" onClick={() => removeFixture(fixture.id)}>🗑 删除 (Del)</button>
      </div>
      {def.allowedCategories.length > 0 && (
        <div className="category-section">
          <h4>上架品类</h4>
          <div className="cat-chips">
            {def.allowedCategories.map((cat) => (
              <button
                key={cat}
                className={`cat-chip ${fixture.category === cat ? 'active' : ''}`}
                onClick={() => setCategory(fixture.id, cat)}
              >
                {CATEGORIES[cat].emoji} {CATEGORIES[cat].name}
                <span className="chip-price">¥{CATEGORIES[cat].price}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
