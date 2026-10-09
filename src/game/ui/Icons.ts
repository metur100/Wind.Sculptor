import type Phaser from 'phaser';

/**
 * Vector icons drawn with Graphics, so they look identical on every platform (no emoji fonts).
 * Every icon is paired with a text label somewhere in the UI – icons never carry meaning alone.
 */
export type IconName =
  | 'play'
  | 'pause'
  | 'retry'
  | 'next'
  | 'home'
  | 'levels'
  | 'star'
  | 'starOutline'
  | 'lock'
  | 'gear'
  | 'sound'
  | 'music'
  | 'vibrate'
  | 'motion'
  | 'check'
  | 'cross'
  | 'hint'
  | 'back'
  | 'cards'
  | 'calendar'
  | 'wind'
  | 'trash'
  | 'clock';

export function starPoints(x: number, y: number, outer: number, inner = outer * 0.45): Phaser.Types.Math.Vector2Like[] {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return pts;
}

/** Draws `name` centred on (x, y) inside a box of `size`. */
export function drawIcon(g: Phaser.GameObjects.Graphics, name: IconName, x: number, y: number, size: number, color: number, alpha = 1): void {
  const s = size / 2;
  const lw = Math.max(2.5, size * 0.11);
  g.fillStyle(color, alpha);
  g.lineStyle(lw, color, alpha);
  switch (name) {
    case 'play':
      g.fillTriangle(x - s * 0.5, y - s * 0.7, x - s * 0.5, y + s * 0.7, x + s * 0.75, y);
      break;
    case 'pause':
      g.fillRoundedRect(x - s * 0.6, y - s * 0.7, s * 0.42, s * 1.4, s * 0.1);
      g.fillRoundedRect(x + s * 0.18, y - s * 0.7, s * 0.42, s * 1.4, s * 0.1);
      break;
    case 'retry': {
      g.beginPath();
      g.arc(x, y, s * 0.62, -Math.PI * 0.2, Math.PI * 1.45, false);
      g.strokePath();
      const ax = x + Math.cos(-Math.PI * 0.2) * s * 0.62;
      const ay = y + Math.sin(-Math.PI * 0.2) * s * 0.62;
      g.fillTriangle(ax - s * 0.32, ay - s * 0.12, ax + s * 0.22, ay - s * 0.3, ax + s * 0.12, ay + s * 0.3);
      break;
    }
    case 'next':
      g.fillTriangle(x - s * 0.7, y - s * 0.6, x - s * 0.7, y + s * 0.6, x + s * 0.1, y);
      g.fillTriangle(x - s * 0.05, y - s * 0.6, x - s * 0.05, y + s * 0.6, x + s * 0.75, y);
      break;
    case 'home':
      g.fillTriangle(x - s * 0.8, y - s * 0.05, x + s * 0.8, y - s * 0.05, x, y - s * 0.78);
      g.fillRect(x - s * 0.55, y - s * 0.1, s * 1.1, s * 0.8);
      break;
    case 'levels':
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) g.fillRoundedRect(x - s * 0.7 + c * s * 0.78, y - s * 0.7 + r * s * 0.78, s * 0.62, s * 0.62, s * 0.12);
      break;
    case 'star':
      g.fillPoints(starPoints(x, y + s * 0.06, s * 0.95), true);
      break;
    case 'starOutline':
      g.strokePoints(starPoints(x, y + s * 0.06, s * 0.88), true, true);
      break;
    case 'lock':
      g.fillRoundedRect(x - s * 0.6, y - s * 0.1, s * 1.2, s * 0.85, s * 0.15);
      g.beginPath();
      g.arc(x, y - s * 0.15, s * 0.38, Math.PI, 0, false);
      g.strokePath();
      g.lineBetween(x - s * 0.38, y - s * 0.15, x - s * 0.38, y);
      g.lineBetween(x + s * 0.38, y - s * 0.15, x + s * 0.38, y);
      break;
    case 'gear': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * s * 0.66, y + Math.sin(a) * s * 0.66, s * 0.17);
      }
      g.fillCircle(x, y, s * 0.6);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, s * 0.24);
      break;
    }
    case 'sound':
      g.fillRect(x - s * 0.75, y - s * 0.25, s * 0.35, s * 0.5);
      g.fillTriangle(x - s * 0.45, y - s * 0.25, x - s * 0.45, y + s * 0.25, x + s * 0.05, y - s * 0.7);
      g.fillTriangle(x - s * 0.45, y + s * 0.25, x + s * 0.05, y + s * 0.7, x + s * 0.05, y - s * 0.7);
      g.beginPath();
      g.arc(x + s * 0.1, y, s * 0.42, -0.8, 0.8, false);
      g.strokePath();
      g.beginPath();
      g.arc(x + s * 0.1, y, s * 0.72, -0.8, 0.8, false);
      g.strokePath();
      break;
    case 'music':
      g.fillEllipse(x - s * 0.4, y + s * 0.5, s * 0.6, s * 0.44);
      g.fillEllipse(x + s * 0.45, y + s * 0.35, s * 0.6, s * 0.44);
      g.lineBetween(x - s * 0.12, y + s * 0.5, x - s * 0.12, y - s * 0.6);
      g.lineBetween(x + s * 0.73, y + s * 0.35, x + s * 0.73, y - s * 0.75);
      g.fillPoints(
        [
          { x: x - s * 0.17, y: y - s * 0.62 },
          { x: x + s * 0.78, y: y - s * 0.82 },
          { x: x + s * 0.78, y: y - s * 0.5 },
          { x: x - s * 0.17, y: y - s * 0.3 },
        ],
        true,
      );
      break;
    case 'vibrate':
      g.strokeRoundedRect(x - s * 0.32, y - s * 0.65, s * 0.64, s * 1.3, s * 0.12);
      g.lineBetween(x - s * 0.6, y - s * 0.35, x - s * 0.6, y + s * 0.35);
      g.lineBetween(x + s * 0.6, y - s * 0.35, x + s * 0.6, y + s * 0.35);
      g.lineBetween(x - s * 0.85, y - s * 0.2, x - s * 0.85, y + s * 0.2);
      g.lineBetween(x + s * 0.85, y - s * 0.2, x + s * 0.85, y + s * 0.2);
      break;
    case 'motion':
      for (let i = 0; i < 3; i++) {
        const yy = y - s * 0.45 + i * s * 0.45;
        g.lineBetween(x - s * 0.75 + i * s * 0.15, yy, x + s * 0.35 + i * s * 0.15, yy);
      }
      g.fillCircle(x + s * 0.6, y, s * 0.2);
      break;
    case 'check':
      g.lineStyle(lw * 1.3, color, alpha);
      g.beginPath();
      g.moveTo(x - s * 0.6, y);
      g.lineTo(x - s * 0.15, y + s * 0.45);
      g.lineTo(x + s * 0.65, y - s * 0.5);
      g.strokePath();
      break;
    case 'cross':
      g.lineStyle(lw * 1.3, color, alpha);
      g.lineBetween(x - s * 0.5, y - s * 0.5, x + s * 0.5, y + s * 0.5);
      g.lineBetween(x + s * 0.5, y - s * 0.5, x - s * 0.5, y + s * 0.5);
      break;
    case 'hint':
      g.fillCircle(x, y - s * 0.2, s * 0.52);
      g.fillRoundedRect(x - s * 0.28, y + s * 0.2, s * 0.56, s * 0.35, s * 0.08);
      g.fillRoundedRect(x - s * 0.2, y + s * 0.6, s * 0.4, s * 0.16, s * 0.06);
      break;
    case 'back':
      g.lineStyle(lw * 1.3, color, alpha);
      g.beginPath();
      g.moveTo(x + s * 0.25, y - s * 0.6);
      g.lineTo(x - s * 0.35, y);
      g.lineTo(x + s * 0.25, y + s * 0.6);
      g.strokePath();
      break;
    case 'cards':
      g.strokeRoundedRect(x - s * 0.75, y - s * 0.5, s * 0.9, s * 1.2, s * 0.12);
      g.fillRoundedRect(x - s * 0.15, y - s * 0.75, s * 0.9, s * 1.2, s * 0.12);
      break;
    case 'calendar':
      g.strokeRoundedRect(x - s * 0.7, y - s * 0.55, s * 1.4, s * 1.25, s * 0.15);
      g.fillRect(x - s * 0.7, y - s * 0.55, s * 1.4, s * 0.35);
      g.fillRect(x - s * 0.45, y - s * 0.8, s * 0.14, s * 0.35);
      g.fillRect(x + s * 0.31, y - s * 0.8, s * 0.14, s * 0.35);
      g.fillCircle(x, y + s * 0.25, s * 0.16);
      break;
    case 'wind':
      g.beginPath();
      g.moveTo(x - s * 0.8, y - s * 0.25);
      g.lineTo(x + s * 0.3, y - s * 0.25);
      g.arc(x + s * 0.3, y - s * 0.5, s * 0.25, Math.PI / 2, -Math.PI * 0.9, true);
      g.strokePath();
      g.beginPath();
      g.moveTo(x - s * 0.8, y + s * 0.15);
      g.lineTo(x + s * 0.45, y + s * 0.15);
      g.arc(x + s * 0.45, y + s * 0.4, s * 0.25, -Math.PI / 2, Math.PI * 0.9, false);
      g.strokePath();
      break;
    case 'trash':
      g.fillRoundedRect(x - s * 0.5, y - s * 0.4, s * 1.0, s * 1.15, s * 0.12);
      g.fillRect(x - s * 0.7, y - s * 0.62, s * 1.4, s * 0.16);
      g.fillRect(x - s * 0.18, y - s * 0.78, s * 0.36, s * 0.16);
      break;
    case 'clock':
      g.strokeCircle(x, y, s * 0.72);
      g.lineBetween(x, y, x, y - s * 0.45);
      g.lineBetween(x, y, x + s * 0.32, y + s * 0.18);
      break;
  }
}
