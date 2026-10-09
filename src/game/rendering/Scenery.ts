import type Phaser from 'phaser';

import type { WorldDefinition } from '../levels/LevelDefinition';
import { Rng } from '../utils/MathUtils';
import { createCanvas, css, shade } from './TextureFactory';

/**
 * Paints a world's background (sky gradient + layered scenery) into a canvas texture.
 * Scenery stays low-contrast and mostly in the lower third so the sculpture always reads clearly.
 */
export function sceneryTexture(scene: Phaser.Scene, world: WorldDefinition, width: number, height: number, scale: number): string {
  const key = `bg-${world.key}-${width}x${height}@${scale}`;
  if (scene.textures.exists(key)) return key;
  const tex = createCanvas(scene, key, width * scale, height * scale);
  const ctx = tex.getContext();
  ctx.scale(scale, scale);
  paintScenery(ctx, world, width, height);
  tex.refresh();
  return key;
}

export function paintScenery(ctx: CanvasRenderingContext2D, world: WorldDefinition, w: number, h: number): void {
  const t = world.theme;
  const rng = new Rng(world.id * 977 + 13);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, css(t.skyTop));
  sky.addColorStop(1, css(t.skyBottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const hill = (baseY: number, amp: number, color: number, alpha: number, waves: number, phase: number) => {
    ctx.fillStyle = css(color, alpha);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = baseY + Math.sin((x / w) * Math.PI * waves + phase) * amp + Math.sin((x / w) * Math.PI * waves * 2.3 + phase * 2) * amp * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  const glow = (x: number, y: number, r: number, color: number, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(color, alpha));
    g.addColorStop(1, css(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  switch (world.scenery) {
    case 'desert': {
      glow(w * 0.78, h * 0.16, 260, 0xfff6c8, 0.75);
      ctx.fillStyle = css(0xfff3c4, 0.95);
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.16, 62, 0, Math.PI * 2);
      ctx.fill();
      hill(h * 0.8, 26, t.far, 0.55, 2.2, 0.6);
      hill(h * 0.87, 20, t.near, 0.55, 1.6, 2.1);
      hill(h * 0.94, 12, shade(t.near, -0.1), 0.6, 2.8, 1.2);
      break;
    }
    case 'park': {
      hill(h * 0.82, 18, t.far, 0.45, 1.4, 0.2);
      for (let i = 0; i < 7; i++) {
        const x = rng.range(0, w);
        const y = h * 0.8 + rng.range(-10, 20);
        const r = rng.range(36, 70);
        ctx.fillStyle = css(shade(t.near, 0.15), 0.45);
        ctx.fillRect(x - 5, y - r * 0.2, 10, r * 1.2);
        ctx.fillStyle = css(rng.pick([0xe0773d, 0xd8a33f, 0xc95f37]), 0.4);
        ctx.beginPath();
        ctx.arc(x, y - r * 0.6, r, 0, Math.PI * 2);
        ctx.fill();
      }
      hill(h * 0.92, 10, 0xb3a065, 0.55, 2.4, 1.3);
      break;
    }
    case 'winter': {
      ctx.fillStyle = css(t.far, 0.75);
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      const peaks = [0.12, 0.3, 0.5, 0.7, 0.9, 1.05];
      peaks.forEach((p, i) => {
        ctx.lineTo(w * (p - 0.09), h * (0.62 + (i % 2) * 0.08));
        ctx.lineTo(w * p, h * (0.5 + (i % 3) * 0.04));
      });
      ctx.lineTo(w, h * 0.78);
      ctx.closePath();
      ctx.fill();
      hill(h * 0.86, 16, t.near, 0.95, 1.8, 0.4);
      for (let i = 0; i < 9; i++) {
        const x = rng.range(0, w);
        const y = h * 0.84 + rng.range(0, 30);
        const s = rng.range(26, 48);
        ctx.fillStyle = css(0x6d8fb3, 0.38);
        ctx.beginPath();
        ctx.moveTo(x, y - s * 1.6);
        ctx.lineTo(x - s * 0.55, y);
        ctx.lineTo(x + s * 0.55, y);
        ctx.closePath();
        ctx.fill();
      }
      hill(h * 0.95, 8, 0xffffff, 0.9, 2.2, 1.7);
      break;
    }
    case 'festival': {
      for (let i = 0; i < 18; i++) glow(rng.range(0, w), rng.range(0, h * 0.75), rng.range(30, 80), rng.pick([0xffffff, 0xffe28a, 0xffb3d9]), 0.3);
      for (let row = 0; row < 2; row++) {
        const y0 = h * (0.14 + row * 0.07);
        ctx.strokeStyle = css(0x7a5aa6, 0.35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(w / 2, y0 + 50, w, y0);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const x = (i + 0.5) * (w / 12);
          const tt = x / w;
          const y = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * (y0 + 50) + tt * tt * y0;
          ctx.fillStyle = css([0xff5d8f, 0xffc83d, 0x3ec7e0, 0x7a6cf0, 0x5fd38d][(i + row) % 5], 0.55);
          ctx.beginPath();
          ctx.moveTo(x - 14, y);
          ctx.lineTo(x + 14, y);
          ctx.lineTo(x, y + 30);
          ctx.closePath();
          ctx.fill();
        }
      }
      hill(h * 0.9, 12, t.near, 0.5, 2, 0.5);
      break;
    }
    case 'night': {
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = css(0xffffff, rng.range(0.2, 0.8));
        ctx.beginPath();
        ctx.arc(rng.range(0, w), rng.range(0, h * 0.6), rng.range(0.6, 1.8), 0, Math.PI * 2);
        ctx.fill();
      }
      glow(w * 0.2, h * 0.13, 120, 0xdfe8ff, 0.35);
      ctx.fillStyle = css(0xf2f4ff, 0.9);
      ctx.beginPath();
      ctx.arc(w * 0.2, h * 0.13, 34, 0, Math.PI * 2);
      ctx.fill();
      for (let layer = 0; layer < 2; layer++) {
        const color = layer === 0 ? t.far : t.near;
        for (let i = 0; i < 12; i++) {
          const x = (i / 11) * w + rng.range(-20, 20);
          const base = h * (0.86 + layer * 0.06);
          const s = rng.range(40, 80) * (layer ? 1.2 : 0.9);
          ctx.fillStyle = css(color, 0.95);
          ctx.beginPath();
          ctx.moveTo(x, base - s * 2.4);
          ctx.lineTo(x - s * 0.6, base);
          ctx.lineTo(x + s * 0.6, base);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = css(t.near);
      ctx.fillRect(0, h * 0.95, w, h * 0.05);
      break;
    }
    case 'ocean': {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const x = rng.range(0, w);
        ctx.fillStyle = css(0xffffff, 0.06);
        ctx.beginPath();
        ctx.moveTo(x - 30, 0);
        ctx.lineTo(x + 40, 0);
        ctx.lineTo(x + 160, h * 0.85);
        ctx.lineTo(x + 40, h * 0.85);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 9; i++) {
        const x = rng.range(0, w);
        const height = rng.range(h * 0.12, h * 0.3);
        ctx.strokeStyle = css(0x0b5d55, 0.45);
        ctx.lineWidth = rng.range(8, 14);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, h);
        for (let y = 0; y < height; y += 12) ctx.lineTo(x + Math.sin(y * 0.03 + i) * 14, h - y);
        ctx.stroke();
      }
      hill(h * 0.95, 8, 0xd8c690, 0.55, 2.4, 0.9);
      break;
    }
  }
}
