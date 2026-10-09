import Phaser from 'phaser';

import type { ParticleMaterial } from '../particles/ParticleMaterial';

/** All textures are drawn procedurally on canvases – there are no image assets. */

export const FX = {
  soft: 'fx-soft',
  spark: 'fx-spark',
  ring: 'fx-ring',
  dot: 'fx-dot',
} as const;

const css = (color: number, alpha = 1) =>
  `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;

function shade(color: number, amount: number): number {
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount > 0 ? (255 - c) * amount : c * amount))));
  return (f((color >> 16) & 255) << 16) | (f((color >> 8) & 255) << 8) | f(color & 255);
}

function createCanvas(scene: Phaser.Scene, key: string, width: number, height: number): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
  if (!tex) throw new Error(`Could not create canvas texture ${key}`);
  return tex;
}

/** Shared effect textures (soft glow, sparkle, ring, dot). Drawn at 64 px and scaled down in use. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(FX.soft)) return;
  const size = 64;
  const c = size / 2;

  let tex = createCanvas(scene, FX.soft, size, size);
  let ctx = tex.getContext();
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();

  tex = createCanvas(scene, FX.spark, size, size);
  ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? c * 0.95 : c * 0.18;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  tex.refresh();

  tex = createCanvas(scene, FX.ring, size, size);
  ctx = tex.getContext();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.stroke();
  tex.refresh();

  tex = createCanvas(scene, FX.dot, 16, 16);
  ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(8, 8, 7, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

export interface ParticleAtlas {
  key: string;
  /** frames[variant][rotationStep] */
  frames: Phaser.Textures.Frame[][];
  rotationSteps: number;
  /** Frame size in canvas pixels. */
  cell: number;
}

/**
 * Bakes one material at one size into an atlas: one row per colour variant, one column per rotation
 * step. Drawn at `scale` pixels per design unit so particles stay crisp on high-DPI screens.
 */
export function createParticleAtlas(scene: Phaser.Scene, material: ParticleMaterial, diameter: number, scale: number, key: string): ParticleAtlas {
  const { visual } = material;
  const d = diameter * scale;
  const cell = Math.ceil(d * (visual.shape === 'glow' ? 2.2 : 1.5)) + 2;
  const steps = visual.rotationFrames;
  const tex = createCanvas(scene, key, cell * steps, cell * visual.colors.length);
  const ctx = tex.getContext();
  const frames: Phaser.Textures.Frame[][] = [];
  visual.colors.forEach((color, v) => {
    const row: Phaser.Textures.Frame[] = [];
    for (let s = 0; s < steps; s++) {
      const angle = (s / steps) * Math.PI * (visual.shape === 'flake' ? 2 / 3 : 2);
      const cx = s * cell + cell / 2;
      const cy = v * cell + cell / 2;
      ctx.save();
      ctx.translate(cx, cy);
      drawParticle(ctx, visual.shape, color, d, angle, s / steps);
      ctx.restore();
      row.push(tex.add(`${v}-${s}`, 0, s * cell, v * cell, cell, cell) as Phaser.Textures.Frame);
    }
    frames.push(row);
  });
  tex.refresh();
  return { key, frames, rotationSteps: steps, cell };
}

function drawParticle(ctx: CanvasRenderingContext2D, shape: ParticleMaterial['visual']['shape'], color: number, d: number, angle: number, t: number): void {
  const r = d / 2;
  switch (shape) {
    case 'grain': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, css(shade(color, 0.45)));
      g.addColorStop(0.6, css(color));
      g.addColorStop(1, css(shade(color, -0.25)));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.9, 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'leaf': {
      ctx.rotate(angle);
      const len = r * 1.05;
      const w = r * 0.55;
      ctx.fillStyle = css(color);
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(-len * 0.1, -w * 1.6, len, 0);
      ctx.quadraticCurveTo(-len * 0.1, w * 1.6, -len, 0);
      ctx.fill();
      ctx.strokeStyle = css(shade(color, -0.35), 0.9);
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(-len * 1.15, 0);
      ctx.lineTo(len * 0.8, 0);
      ctx.stroke();
      break;
    }
    case 'flake': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, css(color, 1));
      g.addColorStop(0.55, css(color, 0.85));
      g.addColorStop(1, css(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // Cool blue rim so white flakes stay visible on snowy ground.
      ctx.strokeStyle = css(0x7f9fca, 0.7);
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(angle);
      ctx.strokeStyle = css(0xffffff, 0.95);
      ctx.lineWidth = Math.max(1, r * 0.12);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, 0);
        ctx.lineTo(r * 0.75, 0);
        ctx.stroke();
      }
      break;
    }
    case 'ribbon': {
      ctx.rotate(angle);
      // Squash vertically through the rotation steps to fake a 3D tumble.
      const flip = 0.35 + 0.65 * Math.abs(Math.cos(t * Math.PI * 4));
      ctx.scale(1, flip);
      ctx.fillStyle = css(color);
      ctx.fillRect(-r, -r * 0.42, d, r * 0.84);
      ctx.fillStyle = css(shade(color, 0.35), 0.8);
      ctx.fillRect(-r, -r * 0.42, d, r * 0.25);
      break;
    }
    case 'glow': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.05);
      g.addColorStop(0, css(0xffffff, 1));
      g.addColorStop(0.18, css(color, 1));
      g.addColorStop(0.45, css(color, 0.35));
      g.addColorStop(1, css(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bubble': {
      const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r);
      g.addColorStop(0, css(color, 0.12));
      g.addColorStop(0.8, css(color, 0.35));
      g.addColorStop(1, css(0xffffff, 0.9));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = css(0xffffff, 0.85);
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.stroke();
      ctx.fillStyle = css(0xffffff, 0.9);
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

export { css, shade, createCanvas };
