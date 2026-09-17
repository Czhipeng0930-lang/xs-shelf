export function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal help">
        <h2>🏪 欢迎开店！</h2>
        <p className="muted">目标：把小超市经营到总资产 <b>¥20,000</b>。</p>
        <ol className="help-steps">
          <li>左侧选择设备，点击画布放置（<b>拖动</b>移动 · <b>R</b> 旋转 · <b>Del</b> 删除）</li>
          <li>选中货架，在右侧给上架的品类</li>
          <li>点 <b>▶ 开门营业</b>，切到 3D 看顾客逛街购物</li>
          <li>日结报表会告诉你哪里出了问题，调整布局再开一天</li>
        </ol>
        <div className="hint-card">
          <b>💡 零售小知识</b>
          <ul>
            <li>零食挨着饮料，销量 +15%</li>
            <li>饮料放冷柜，能卖更贵</li>
            <li>端头架、堆头摆在必经之路，顾客会冲动加购</li>
            <li>收银台太少，排长队会吓跑顾客</li>
          </ul>
        </div>
        <button className="btn primary big" onClick={onClose}>
          知道了，开工！
        </button>
      </div>
    </div>
  );
}
