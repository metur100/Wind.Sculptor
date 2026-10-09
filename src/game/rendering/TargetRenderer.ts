import type Phaser from 'phaser';

import type { Primitive, TargetPlacement } from '../targets/TargetDefinition';
import { getShape } from '../targets/TargetShapes';
import { createCanvas, css } from './TextureFactory';

/** Adds the outline of one primitive (in shape space) to the current path. */
function tracePrimitive(ctx: CanvasRenderingContext2D, p: Primitive): void {
  switch (p.kind) {
    case 'circle':
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      break;
    case 'ring':
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.moveTo(p.x + p.inner, p.y);
      ctx.arc(p.x, p.y, p.inner, 0, Math.PI * 2, true);
      break;
    case 'ellipse':
      ctx.moveTo(p.x + p.rx * Math.cos(p.rot ?? 0), p.y + p.rx * Math.sin(p.rot ?? 0));
      ctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot ?? 0, 0, Math.PI * 2);
      break;
    case 'rect': {
      const rot = p.rot ?? 0;
      const r = Math.min(p.r ?? 0, p.w / 2, p.h / 2);
      const hw = p.w / 2;
      const hh = p.h / 2;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const pt = (x: number, y: number): [number, number] => [p.x + x * c - y * s, p.y + x * s + y * c];
      // Rounded rectangle as a polygon with arc corners (works in every browser).
      const corners: [number, number, number][] = [
        [hw - r, -hh + r, -Math.PI / 2],
        [hw - r, hh - r, 0],
        [-hw + r, hh - r, Math.PI / 2],
        [-hw + r, -hh + r, Math.PI],
      ];
      let first = true;
      for (const [cx, cy, start] of corners) {
        const steps = r > 0 ? 6 : 1;
        for (let i = 0; i <= steps; i++) {
          const a = start + (i / steps) * (Math.PI / 2);
          const [x, y] = pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      break;
    }
    case 'poly':
      ctx.moveTo(p.pts[0], p.pts[1]);
      for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i + 1]);
      ctx.closePath();
      break;
    case 'capsule': {
      const a = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
      ctx.moveTo(p.x1 + Math.cos(a + Math.PI / 2) * p.r, p.y1 + Math.sin(a + Math.PI / 2) * p.r);
      ctx.arc(p.x1, p.y1, p.r, a + Math.PI / 2, a + (3 * Math.PI) / 2);
      ctx.arc(p.x2, p.y2, p.r, a - Math.PI / 2, a + Math.PI / 2);
      ctx.closePath();
      break;
    }
    case 'points':
      for (let i = 0; i < p.pts.length; i += 2) {
        ctx.moveTo(p.pts[i] + p.r, p.pts[i + 1]);
        ctx.arc(p.pts[i], p.pts[i + 1], p.r, 0, Math.PI * 2);
      }
      break;
  }
}

/**
 * Draws a shape's union silhouette with an outline: every primitive is first stroked thickly in the
 * outline colour, then all are filled on top (hiding inner seams), then cuts are punched out with an
 * outline of their own.
 */
export function drawShape(ctx: CanvasRenderingContext2D, shapeId: string, fill: string, line: string, lineWidth: number): void {
  const shape = getShape(shapeId);
  const additive = shape.primitives.filter((p) => !p.cut);
  const cuts = shape.primitives.filter((p) => p.cut);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = line;
  for (const p of additive) {
    ctx.beginPath();
    tracePrimitive(ctx, p);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const p of additive) {
    ctx.beginPath();
    tracePrimitive(ctx, p);
    ctx.fill(p.kind === 'ring' ? 'evenodd' : 'nonzero');
  }
  for (const p of cuts) {
    ctx.beginPath();
    tracePrimitive(ctx, p);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.restore();
  }
}

export interface SilhouetteTexture {
  key: string;
  /** Top-left of the texture in stage coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Renders every placement of a level into one texture (stage coordinates, `scale` px per unit). */
export function silhouetteTexture(
  scene: Phaser.Scene,
  key: string,
  placements: readonly TargetPlacement[],
  fill: number,
  line: number,
  scale: number,
): SilhouetteTexture {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of placements) {
    const half = 52 * p.size * 1.45;
    minX = Math.min(minX, p.x - half);
    minY = Math.min(minY, p.y - half);
    maxX = Math.max(maxX, p.x + half);
    maxY = Math.max(maxY, p.y + half);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const tex = createCanvas(scene, key, width * scale, height * scale);
  const ctx = tex.getContext();
  for (const p of placements) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(p.x - minX, p.y - minY);
    if (p.rotation) ctx.rotate(p.rotation);
    ctx.scale(p.flip ? -p.size : p.size, p.size);
    ctx.translate(-50, -50);
    drawShape(ctx, p.shape, css(fill), css(line), 7 / p.size);
    ctx.restore();
  }
  tex.refresh();
  return { key, x: minX, y: minY, width, height };
}
