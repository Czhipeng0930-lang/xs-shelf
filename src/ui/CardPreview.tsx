import { useEffect, useRef } from 'react';
import type { FixtureTypeId, Level, Rot } from '../game/types';
import { fixtureSprite, spriteSize } from '../render/sprites';

interface Props {
  typeId: FixtureTypeId;
  rot?: Rot;
  variant?: number;
  level?: Level;
  scale?: number;
}

/** 手牌 / 图鉴用的货架小图 */
export function CardPreview({ typeId, rot = 0, variant = 0, level = 1, scale = 2 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const spr = fixtureSprite(typeId, rot, variant, level, scale);
    const { W, H } = spriteSize(typeId, rot);
    c.width = W * scale;
    c.height = H * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(spr, 0, 0);
  }, [typeId, rot, variant, level, scale]);
  return <canvas ref={ref} className="card-preview" />;
}
