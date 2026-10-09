import type Phaser from 'phaser';

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * Rounded rectangle with a vertical gradient. Phaser's gradient fill only interpolates correctly on
 * plain rectangles, so the shape is assembled from gradient rectangles plus solid corner discs.
 */
export function fillRoundedGradient(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  top: number,
  bottom: number,
  alpha = 1,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  const at = (yy: number) => lerpColor(top, bottom, (yy - y) / h);
  // Middle band (full width).
  g.fillGradientStyle(at(y + radius), at(y + radius), at(y + h - radius), at(y + h - radius), alpha);
  g.fillRect(x, y + radius, w, h - radius * 2);
  // Top and bottom bands between the corners.
  g.fillGradientStyle(top, top, at(y + radius), at(y + radius), alpha);
  g.fillRect(x + radius, y, w - radius * 2, radius);
  g.fillGradientStyle(at(y + h - radius), at(y + h - radius), bottom, bottom, alpha);
  g.fillRect(x + radius, y + h - radius, w - radius * 2, radius);
  // Corners.
  g.fillStyle(at(y + radius * 0.6), alpha);
  g.slice(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
  g.fillPath();
  g.slice(x + w - radius, y + radius, radius, Math.PI * 1.5, Math.PI * 2, false);
  g.fillPath();
  g.fillStyle(at(y + h - radius * 0.6), alpha);
  g.slice(x + radius, y + h - radius, radius, Math.PI * 0.5, Math.PI, false);
  g.fillPath();
  g.slice(x + w - radius, y + h - radius, radius, 0, Math.PI * 0.5, false);
  g.fillPath();
}
