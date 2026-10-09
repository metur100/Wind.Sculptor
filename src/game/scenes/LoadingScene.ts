import { AmbientParticles } from '../gameplay/AmbientParticles';
import { WORLDS } from '../levels/LevelData';
import { sceneryTexture } from '../rendering/Scenery';
import { drawLogo } from '../ui/Logo';
import { ProgressBar } from '../ui/ProgressBar';
import { addText } from '../ui/Typography';
import { COLORS, FONT_FAMILY } from '../utils/Constants';
import { BaseScene } from './BaseScene';

/**
 * Loading screen: logo, swirling particles and a real progress bar. Work is split into small tasks
 * (font loading, pre-rendering the six world backgrounds) spread over frames so the animation stays smooth.
 */
export class LoadingScene extends BaseScene {
  private ambient!: AmbientParticles;
  private bar!: ProgressBar;
  private tasks: (() => Promise<void> | void)[] = [];
  private done = 0;
  private busy = false;
  private minUntil = 0;

  constructor() {
    super('Loading');
  }

  create(): void {
    this.setupScene('Loading Wind Sculptor');
    const g = this.add.graphics();
    g.fillGradientStyle(0xffe2bd, 0xffe2bd, 0xbfd9f2, 0xbfd9f2, 1);
    g.fillRect(0, 0, this.W, this.H);
    this.ambient = new AmbientParticles(this, 'leaves', 90, { width: this.W, height: this.H }, false);
    drawLogo(this, this.W / 2, this.H * 0.36, 1);
    this.bar = new ProgressBar(this, this.W / 2, this.H * 0.62, { width: 420, height: 22, fill: COLORS.accent, trackAlpha: 0.7 });
    addText(this, this.W / 2, this.H * 0.62 + 50, 'Gathering the wind…', { size: 26, weight: '500', color: COLORS.muted });

    this.tasks = [
      () => this.loadFonts(),
      ...WORLDS.map((world) => () => {
        sceneryTexture(this, world, this.W, this.H, Math.min(this.k, 1.5));
      }),
    ];
    this.done = 0;
    this.minUntil = this.time.now + 900;
  }

  private async loadFonts(): Promise<void> {
    if (!document.fonts) return;
    const weights = ['500', '600', '700'];
    try {
      await Promise.race([
        Promise.all(weights.map((w) => document.fonts.load(`${w} 32px ${FONT_FAMILY}`))),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      /* the fallback font is fine */
    }
  }

  override update(_time: number, delta: number): void {
    this.ambient.update(delta);
    this.bar.tick(delta / 1000);
    if (this.busy) return;
    if (this.done < this.tasks.length) {
      this.busy = true;
      const task = this.tasks[this.done];
      Promise.resolve(task()).finally(() => {
        this.done++;
        this.bar.setValue(this.done / this.tasks.length);
        this.busy = false;
      });
      return;
    }
    if (this.time.now >= this.minUntil) {
      this.busy = true;
      this.bar.setValue(1, true);
      this.go('Menu');
    }
  }
}

