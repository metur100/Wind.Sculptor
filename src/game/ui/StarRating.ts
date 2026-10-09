import Phaser from 'phaser';

import { COLORS } from '../utils/Constants';
import { starPoints } from './Icons';

/**
 * Three stars. Earned stars are filled gold with a dark outline; missing stars are hollow outlines –
 * the difference is visible through shape, not colour alone.
 */
export class StarRating extends Phaser.GameObjects.Container {
  private readonly stars: Phaser.GameObjects.Graphics[] = [];
  private value = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly size: number,
    gap = size * 0.25,
    private readonly emptyColor: number = COLORS.starEmpty,
  ) {
    super(scene, x, y);
    for (let i = 0; i < 3; i++) {
      const g = scene.add.graphics();
      g.x = (i - 1) * (size + gap);
      // The middle star sits a little higher when large.
      if (size >= 40) g.y = i === 1 ? -size * 0.18 : 0;
      this.stars.push(g);
      this.add(g);
    }
    this.draw();
    scene.add.existing(this);
  }

  get rating(): number {
    return this.value;
  }

  private drawStar(g: Phaser.GameObjects.Graphics, filled: boolean): void {
    const s = this.size / 2;
    g.clear();
    if (filled) {
      g.fillStyle(0xd99a1e, 1);
      g.fillPoints(starPoints(0, 3, s), true);
      g.fillStyle(COLORS.star, 1);
      g.fillPoints(starPoints(0, 0, s), true);
      g.fillStyle(0xffffff, 0.35);
      g.fillPoints(starPoints(-s * 0.12, -s * 0.15, s * 0.42), true);
    } else {
      g.fillStyle(this.emptyColor, 0.35);
      g.fillPoints(starPoints(0, 0, s), true);
      g.lineStyle(Math.max(2, s * 0.12), this.emptyColor, 1);
      g.strokePoints(starPoints(0, 0, s * 0.94), true, true);
    }
  }

  private draw(): void {
    this.stars.forEach((g, i) => this.drawStar(g, i < this.value));
  }

  /** Sets the number of stars; `animate` pops newly earned stars in one after another. */
  setStars(count: number, animate = false, onStar?: (index: number) => void): this {
    const previous = this.value;
    this.value = Phaser.Math.Clamp(count, 0, 3);
    if (!animate) {
      this.draw();
      return this;
    }
    this.stars.forEach((g, i) => this.drawStar(g, i < previous));
    for (let i = previous; i < this.value; i++) {
      const g = this.stars[i];
      this.scene.time.delayedCall(250 + (i - previous) * 380, () => {
        this.drawStar(g, true);
        g.setScale(0.2);
        this.scene.tweens.add({ targets: g, scale: 1, duration: 420, ease: 'Back.easeOut' });
        onStar?.(i);
      });
    }
    return this;
  }
}
