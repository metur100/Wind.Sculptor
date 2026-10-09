import Phaser from 'phaser';

import { COLORS } from '../utils/Constants';
import { starPoints } from './Icons';

export interface ProgressBarOptions {
  width: number;
  height: number;
  fill: number;
  track?: number;
  trackAlpha?: number;
  /** Threshold markers (0..1) drawn as small stars above the bar – used for the star goals. */
  markers?: number[];
}

/** Rounded progress bar with smooth animation and optional star markers. */
export class ProgressBar extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly markerGraphics: Phaser.GameObjects.Graphics;
  private target = 0;
  private shown = 0;
  private fillColor: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: ProgressBarOptions,
  ) {
    super(scene, x, y);
    this.fillColor = options.fill;
    this.track = scene.add.graphics();
    this.bar = scene.add.graphics();
    this.markerGraphics = scene.add.graphics();
    this.add([this.track, this.bar, this.markerGraphics]);
    const { width, height } = options;
    this.track.fillStyle(options.track ?? 0xffffff, options.trackAlpha ?? 0.55);
    this.track.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    this.drawMarkers();
    this.redraw();
    scene.add.existing(this);
  }

  /** Sets the value (0..1). Without `immediate` the bar eases towards it in `tick`. */
  setValue(value: number, immediate = false): this {
    this.target = Phaser.Math.Clamp(value, 0, 1);
    if (immediate) {
      this.shown = this.target;
      this.redraw();
    }
    return this;
  }

  setFillColor(color: number): this {
    this.fillColor = color;
    this.redraw();
    return this;
  }

  tick(dt: number): void {
    if (Math.abs(this.shown - this.target) < 0.001) return;
    this.shown += (this.target - this.shown) * Math.min(1, dt * 8);
    this.redraw();
    this.drawMarkers();
  }

  private redraw(): void {
    const { width, height } = this.options;
    const g = this.bar;
    g.clear();
    const w = Math.max(0, width * this.shown);
    if (w <= 0) return;
    const r = Math.min(height / 2, w / 2);
    g.fillStyle(this.fillColor, 1);
    g.fillRoundedRect(-width / 2, -height / 2, w, height, r);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(-width / 2 + 3, -height / 2 + 2, Math.max(0, w - 6), height * 0.35, Math.min(r, height * 0.17));
  }

  private drawMarkers(): void {
    const { width, height, markers } = this.options;
    const g = this.markerGraphics;
    g.clear();
    if (!markers) return;
    markers.forEach((m) => {
      const x = -width / 2 + width * m;
      const reached = this.shown >= m;
      g.lineStyle(3, COLORS.ink, 0.55);
      g.lineBetween(x, -height / 2, x, height / 2);
      const pts = starPoints(x, -height / 2 - 14, 11);
      if (reached) {
        g.fillStyle(COLORS.star, 1);
        g.fillPoints(pts, true);
        g.lineStyle(2, 0x9a6a10, 1);
        g.strokePoints(pts, true, true);
      } else {
        g.fillStyle(0xffffff, 0.85);
        g.fillPoints(pts, true);
        g.lineStyle(2, COLORS.ink, 0.6);
        g.strokePoints(pts, true, true);
      }
    });
  }
}
