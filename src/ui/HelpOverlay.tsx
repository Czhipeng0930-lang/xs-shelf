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
        <h2>一句话玩法</h2>
        <p>
          <b>花分数买货架 → 摆进店里 → 开门营业收钱 → 钱自动变成分，再抽卡或升级。</b>
          累计营业额够了就扩店，还能抽功能牌。
        </p>

        <h3>一天是这样的</h3>
        <ul className="help-steps small">
          <li>手上 3 张随机货架卡，都是 1 级。今天能放几个看顶栏 🧱 配额。</li>
          <li>点卡 → 点店面出现预览 → 点 <b>✓ 放下</b> 才真的放。单面、仓储、立冷贴墙时会自动背面靠墙。</li>
          <li>点已放的货架可以 <b>升级 / 旋转 / 重摆 / 拆除</b>；<b>长按</b> 直接拿起来挪，挪动免费。</li>
          <li>点「开门营业」，今天赚的钱立刻变成明天的分数。</li>
        </ul>

        <h3>怎么赚得更多</h3>
        <ul className="help-steps">
          <li>
            <CardPreview typeId="double-gondola" scale={2} />
            <span>
              <b>取货面要朝通道</b>：面前那格必须空着，被挡住会打红叉且不赚钱。地面越<b>偏橙</b>的通道人流越旺，货架朝着它摆。
            </span>
          </li>
          <li>
            <CardPreview typeId="endcap" scale={2} />
            <span>
              <b>位置决定倍率</b>：端架贴双面货架端头 ×2.2；堆头挨着黄脚印主动线 ×3；木架靠门 +120%；冷柜背面贴 ⚡ 电源墙 +60%。
            </span>
          </li>
          <li>
            <CardPreview typeId="upright-chiller" level={3} scale={2} />
            <span>
              <b>货架能升到 3 级</b>：点已放的货架花分升级。Lv2 镀金赚 2.4 倍，Lv3 霓虹赚 5.6 倍，越往后越贵。
            </span>
          </li>
          <li>
            <CardPreview typeId="checkout" scale={2} />
            <span>
              <b>收银台别少</b>：每台只能服务 45 位顾客，顶栏 🧍 变红就该加一台了。第一台免费。
            </span>
          </li>
        </ul>

        <p className="small muted">
          没有「放不下」的死规则——哪儿都能放，只是放对位置赚得多。摆错了随时点货架重摆或拆掉（退 60% 造价）。
        </p>

        <button className="btn primary big" onClick={onClose}>
          开始营业
        </button>
      </div>
    </div>
  );
}
