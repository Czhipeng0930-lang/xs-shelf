import type { PromoId } from './types';

export interface PromoDef {
  id: PromoId;
  name: string;
  icon: string;
  desc: string;
}

export const PROMOS: Record<PromoId, PromoDef> = {
  'cold-chain': { id: 'cold-chain', name: '冷链专家', icon: '🧊', desc: '所有冷柜和冰柜营业额 +40%' },
  'golden-endcap': { id: 'golden-endcap', name: '黄金端头', icon: '🏅', desc: '端架贴端头的加成从 ×2.2 提到 ×3.2' },
  'narrow-master': { id: 'narrow-master', name: '窄巷高手', icon: '🧭', desc: '1 格窄通道也享受宽敞通道 +12%' },
  'big-sale': { id: 'big-sale', name: '大促周', icon: '📣', desc: '促销堆头放哪都算主动线旁 ×3' },
  'double-checkout': { id: 'double-checkout', name: '双倍收银', icon: '💳', desc: '收银台 4 格内的货架 +15%' },
  clearance: { id: 'clearance', name: '清仓甩卖', icon: '🃏', desc: '手牌上限变 4 张，选择更多' },
  'bulk-buy': { id: 'bulk-buy', name: '批量采购', icon: '📦', desc: '所有货架造价永久 −25%' },
  'loyal-crowd': { id: 'loyal-crowd', name: '熟客盈门', icon: '👥', desc: '全店人流 +25%，客流也变多' },
  'chain-effect': { id: 'chain-effect', name: '连锁效应', icon: '🔗', desc: '联排加成上限从 +40% 提到 +80%' },
  'free-sample': { id: 'free-sample', name: '免费试吃', icon: '🍡', desc: '每天营业额额外 +200' },
  'member-day': { id: 'member-day', name: '会员日', icon: '🎫', desc: '离门 4 格内的货架 +50%' },
  'night-shift': { id: 'night-shift', name: '夜班收银', icon: '🌙', desc: '每台收银台的服务上限 +60%' },
};

export const PROMO_IDS = Object.keys(PROMOS) as PromoId[];
export const MAX_PROMOS = 5;

/** 造价折扣 */
export function costRate(promos: PromoId[]): number {
  return promos.includes('bulk-buy') ? 0.75 : 1;
}
