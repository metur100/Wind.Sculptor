import Phaser from 'phaser';

/**
 * Pooled decorative effects (sparkles, splashes, wind wisps). A fixed number of Image objects is
 * created up front and recycled; nothing here affects gameplay.
 */
export class FxPool {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly spin: Float32Array;
  private readonly scaleFrom: Float32Array;
  private readonly scaleTo: Float32Array;
  private readonly alphaFrom: Float32Array;
  private readonly drag: Float32Array;
  private cursor = 0;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    private readonly capacity: number,
  ) {
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.scaleFrom = new Float32Array(capacity);
    this.scaleTo = new Float32Array(capacity);
    this.alphaFrom = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      const image = scene.add.image(0, 0, '__WHITE').setVisible(false);
      this.images.push(image);
      container.add(image);
    }
  }

  spawn(
    texture: string,
    frame: string | number | undefined,
    x: number,
    y: number,
    options: {
      vx?: number;
      vy?: number;
      life?: number;
      scale?: number;
      scaleTo?: number;
      alpha?: number;
      tint?: number;
      spin?: number;
      rotation?: number;
      additive?: boolean;
      drag?: number;
    } = {},
  ): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const image = this.images[i];
    image.setTexture(texture, frame);
    image.setPosition(x, y);
    image.setVisible(true);
    image.setRotation(options.rotation ?? 0);
    image.setBlendMode(options.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (options.tint !== undefined) image.setTint(options.tint);
    else image.clearTint();
    const scale = options.scale ?? 1;
    image.setScale(scale);
    image.setAlpha(options.alpha ?? 1);
    this.life[i] = options.life ?? 0.6;
    this.maxLife[i] = this.life[i];
    this.vx[i] = options.vx ?? 0;
    this.vy[i] = options.vy ?? 0;
    this.spin[i] = options.spin ?? 0;
    this.scaleFrom[i] = scale;
    this.scaleTo[i] = options.scaleTo ?? scale;
    this.alphaFrom[i] = options.alpha ?? 1;
    this.drag[i] = options.drag ?? 1.5;
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      const image = this.images[i];
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        image.setVisible(false);
        continue;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      const damp = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= damp;
      this.vy[i] *= damp;
      image.x += this.vx[i] * dt;
      image.y += this.vy[i] * dt;
      image.rotation += this.spin[i] * dt;
      image.setScale(this.scaleFrom[i] + (this.scaleTo[i] - this.scaleFrom[i]) * t);
      // Fade in quickly, fade out slowly.
      image.setAlpha(this.alphaFrom[i] * Math.min(1, t * 6) * (1 - t * t));
    }
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.life[i] = 0;
      this.images[i].setVisible(false);
    }
  }
}
