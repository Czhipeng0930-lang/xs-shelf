import type { PromoId } from './types';

export interface PromoDef {
  id: PromoId;
  name: string;
  icon: string;
  desc: string;
}

export const PROMOS: Record<PromoId, PromoDef> = {
  'ice-summer': { id: 'ice-summer', name: '冰爽夏日', icon: '🧊', desc: '立式冷柜不再需要贴电源墙，贴任何墙都行' },
  'golden-endcap': { id: 'golden-endcap', name: '黄金端头', icon: '🏅', desc: '端架的端头加成从 ×2 变为 ×3' },
  'narrow-master': { id: 'narrow-master', name: '窄巷高手', icon: '🧭', desc: '1 格宽的紧凑通道也享受舒适通道 +10%' },
  'big-sale': { id: 'big-sale', name: '大促周', icon: '📣', desc: '促销堆头无论放哪都算主动线旁 ×3' },
  'double-checkout': { id: 'double-checkout', name: '双倍收银', icon: '💳', desc: '可放第二张收银台；收银台 4 格内的货架 +15%' },
  clearance: { id: 'clearance', name: '清仓', icon: '🃏', desc: '手牌上限变为 4 张，多一张选择' },
};

export const PROMO_IDS = Object.keys(PROMOS) as PromoId[];
export const MAX_PROMOS = 3;
