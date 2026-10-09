import type Phaser from 'phaser';

import { GameContext } from '../GameContext';
import { COLORS } from '../utils/Constants';
import { addText } from './Typography';

/** "Wind Sculptor" wordmark with three swirling wind strokes. */
export function drawLogo(scene: Phaser.Scene, x: number, y: number, scale: number): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const swirl = scene.add.graphics();
  const strokes: [number, number, number, number][] = [
    [-250, -118, 190, 0xff8a5b],
    [-210, -88, 150, 0x3ec7e0],
    [-170, -58, 110, 0xffc83d],
  ];
  strokes.forEach(([sx, sy, len, color]) => {
    swirl.lineStyle(10, color, 0.95);
    swirl.beginPath();
    swirl.moveTo(sx, sy);
    swirl.lineTo(sx + len, sy);
    swirl.arc(sx + len, sy - 26, 26, Math.PI / 2, -Math.PI * 0.9, true);
    swirl.strokePath();
  });
  container.add(swirl);
  const title = addText(scene, 0, 0, 'Wind', { size: 104, weight: '700', color: COLORS.inkText, shadow: true });
  const title2 = addText(scene, 0, 96, 'Sculptor', { size: 104, weight: '700', color: '#ff7a45', shadow: true });
  container.add([title, title2]);
  container.setScale(scale);
  if (!GameContext.reducedMotion) {
    scene.tweens.add({ targets: swirl, x: 14, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return container;
}
