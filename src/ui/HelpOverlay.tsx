import { CardPreview } from './CardPreview';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpOverlay({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <h2>玩法一句话</h2>
        <p>抽货架卡放进店里，<b>每个取货面前面留出通道才得分</b>；摆满或牌抽完就开业结算。</p>
        <h3>三条核心规则</h3>
        <ul className="help-steps">
          <li>
            <CardPreview typeId="double-gondola" scale={2} /> <b>取货面要朝通道</b>：面前一格必须留空，否则是"死面"，不得分还扣 15。留 2 格是舒适通道 +10%。
          </li>
          <li>
            <CardPreview typeId="endcap" scale={2} /> <b>端架贴端头 ×2</b>：贴在双面货架的短边端头，靠主动线（黄色格）再 +20%。
          </li>
          <li>
            <CardPreview typeId="checkout" scale={2} /> <b>收银台放门口 3 格内</b>：放好才能开业。门口地垫不能放东西。
          </li>
        </ul>
        <h3>更多技巧（随分数解锁）</h3>
        <ul className="help-steps small">
          <li>同类货架连排：每多一件 +10%，最多 +40%。</li>
          <li>立式冷柜要贴 ⚡ 电源墙；两台连排成冷链区，每台 +50%；别挨着仓储架。</li>
          <li>卧式冰柜 2 格内要有立式冷柜；挨着木架双方 +20%。</li>
          <li>木架离门 ≤4 格 +50%，≤2 格 +100%。促销堆头挨着主动线 ×3。</li>
          <li>被围死的空地每格 −5；所有空地都要能从门走到。</li>
        </ul>
        <h3>操作</h3>
        <p className="small">点卡片选牌（数字键 1-4 / C 选收银台），鼠标移到店面预览，点击放置；<b>R</b> 或右键旋转；手机上点一次预览、再点一次确认。</p>
        <button className="btn primary big" onClick={onClose}>
          开始摆货架
        </button>
      </div>
    </div>
  );
}
