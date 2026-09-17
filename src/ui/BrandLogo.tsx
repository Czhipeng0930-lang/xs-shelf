export const BRAND = {
  name: '润达货架',
  en: 'RUNDA SHELF',
  green: '#123f37',
  gold: '#dcb879',
} as const;

interface Props {
  size?: 'sm' | 'md' | 'lg';
  /** 只显示像素标，不显示文字 */
  markOnly?: boolean;
}

/** 像素风货架标：12×12 逻辑像素，crispEdges 任意放大不糊 */
function Mark({ px }: { px: number }) {
  const g = BRAND.green;
  const gold = BRAND.gold;
  const light = '#1e5c50';
  const goods = ['#e43b44', '#feae34', '#63c74d', '#0099db'];
  const rects: [number, number, number, number, string][] = [
    [0, 0, 12, 12, g],
    [1, 1, 10, 1, light],
    // 两层层板
    [1, 5, 10, 1, gold],
    [1, 10, 10, 1, gold],
    // 立柱
    [1, 1, 1, 10, gold],
    [10, 1, 1, 10, gold],
    // 上层商品
    [2, 2, 2, 3, goods[0]],
    [5, 3, 2, 2, goods[1]],
    [8, 2, 1, 3, goods[2]],
    // 下层商品
    [2, 7, 1, 3, goods[3]],
    [4, 8, 3, 2, goods[0]],
    [8, 7, 2, 3, goods[1]],
  ];
  return (
    <svg className="brand-mark" width={12 * px} height={12 * px} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      {rects.map(([x, y, w, h, c], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={c} />
      ))}
    </svg>
  );
}

export function BrandLogo({ size = 'md', markOnly = false }: Props) {
  const px = size === 'lg' ? 5 : size === 'md' ? 3 : 2;
  return (
    <span className={`brand-logo brand-${size}`} title={`${BRAND.name} ${BRAND.en}`}>
      <Mark px={px} />
      {!markOnly && (
        <span className="brand-text">
          <span className="brand-cn">{BRAND.name}</span>
          <span className="brand-en">{BRAND.en}</span>
        </span>
      )}
    </span>
  );
}
