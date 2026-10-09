import Phaser from 'phaser';

import { GameContext } from '../GameContext';
import { WORLDS } from '../levels/LevelData';
import type { WorldDefinition } from '../levels/LevelDefinition';
import { getMaterial } from '../particles/ParticleMaterial';
import { isWorldUnlocked, worldLockReason, worldStars } from '../progression/ProgressionManager';
import { createParticleAtlas } from '../rendering/TextureFactory';
import type { Focusable } from '../ui/FocusManager';
import { fillRoundedGradient } from '../ui/Draw';
import { drawIcon } from '../ui/Icons';
import { addText } from '../ui/Typography';
import { COLORS } from '../utils/Constants';
import { Rng } from '../utils/MathUtils';
import { AudioManager } from '../audio/AudioManager';
import { Haptics } from '../utils/Haptics';
import { announce, BaseScene } from './BaseScene';

/** A world card: themed preview with drifting particles of its material, stars and lock state. */
class WorldCard extends Phaser.GameObjects.Container implements Focusable {
  private readonly ring: Phaser.GameObjects.Graphics;
  readonly accessibleName: string;

  constructor(
    scene: WorldSelectScene,
    x: number,
    y: number,
    private readonly boxW: number,
    private readonly boxH: number,
    readonly world: WorldDefinition,
    readonly unlocked: boolean,
    private readonly onPick: () => void,
  ) {
    super(scene, x, y);
    const w = boxW;
    const h = boxH;
    this.accessibleName = world.name;
    const t = world.theme;
    const g = scene.add.graphics();
    g.fillStyle(COLORS.ink, 0.15);
    g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 30);
    fillRoundedGradient(g, -w / 2, -h / 2, w, h, 30, t.skyTop, t.skyBottom);
    this.add(g);

    // Material preview: a few drifting particles of this world's material.
    const material = getMaterial(world.material);
    const atlas = createParticleAtlas(scene, material, 22 * material.visual.sizeFactor, GameContext.profile.renderScale, `card-${world.key}`);
    const rng = new Rng(world.id + 5);
    for (let i = 0; i < 14; i++) {
      const frame = atlas.frames[i % atlas.frames.length][rng.int(0, atlas.rotationSteps - 1)];
      const px = rng.range(-w / 2 + 30, w / 2 - 30);
      const py = rng.range(-h / 2 + 30, h / 2 - 110);
      const image = scene.add.image(px, py, atlas.key, frame.name).setScale(1 / GameContext.profile.renderScale);
      if (material.visual.additive) image.setBlendMode(Phaser.BlendModes.ADD);
      this.add(image);
      if (!GameContext.reducedMotion && unlocked) {
        scene.tweens.add({
          targets: image,
          x: px + rng.range(-16, 16),
          y: py + rng.range(-12, 12),
          angle: rng.range(-60, 60),
          duration: rng.range(1600, 2600),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    const label = scene.add.graphics();
    label.fillStyle(0xffffff, 0.92);
    label.fillRoundedRect(-w / 2 + 12, h / 2 - 104, w - 24, 92, 22);
    this.add(label);
    this.add(addText(scene, -w / 2 + 30, h / 2 - 78, `${world.id + 1}. ${world.name}`, { size: 27, weight: '700', origin: [0, 0.5] }));
    const stars = worldStars(GameContext.save, world.id);
    const icons = scene.add.graphics();
    drawIcon(icons, 'star', -w / 2 + 44, h / 2 - 38, 26, COLORS.star);
    this.add(icons);
    this.add(addText(scene, -w / 2 + 64, h / 2 - 38, `${stars} / 15  ·  ${material.visual.label}`, { size: 22, weight: '600', color: COLORS.muted, origin: [0, 0.5] }));

    if (!unlocked) {
      const lock = scene.add.graphics();
      lock.fillStyle(COLORS.ink, 0.55);
      lock.fillRoundedRect(-w / 2, -h / 2, w, h - 110, { tl: 30, tr: 30, bl: 0, br: 0 });
      drawIcon(lock, 'lock', 0, -h / 2 + 70, 56, 0xffffff);
      this.add(lock);
      const reason = worldLockReason(GameContext.save, world.id) ?? 'Locked';
      this.add(addText(scene, 0, -h / 2 + 140, `Locked\n${reason}`, { size: 22, weight: '600', color: '#ffffff', wrapWidth: w - 40, lineSpacing: 4 }));
    }

    this.ring = scene.add.graphics();
    this.add(this.ring);
    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerup', () => this.activate());
    scene.add.existing(this);
    scene.focus.add(this);
  }

  get focusable(): boolean {
    return true;
  }

  setFocused(focused: boolean): void {
    this.ring.clear();
    if (!focused) return;
    this.ring.lineStyle(6, COLORS.ink, 0.9);
    this.ring.strokeRoundedRect(-this.boxW / 2 - 8, -this.boxH / 2 - 8, this.boxW + 16, this.boxH + 16, 36);
  }

  activate(): void {
    AudioManager.unlock();
    if (!this.unlocked) {
      AudioManager.toggle(false);
      Haptics.play('tap');
      announce(`${this.world.name} is locked. ${worldLockReason(GameContext.save, this.world.id) ?? ''}`);
      this.scene.tweens.add({ targets: this, x: this.x + 10, duration: 50, yoyo: true, repeat: 3 });
      return;
    }
    AudioManager.button();
    Haptics.play('tap');
    this.onPick();
  }
}

export class WorldSelectScene extends BaseScene {
  constructor() {
    super('WorldSelect');
  }

  create(): void {
    this.setupScene('World select');
    const g = this.add.graphics();
    g.fillGradientStyle(0xfff4e4, 0xfff4e4, 0xe3eefb, 0xe3eefb, 1);
    g.fillRect(0, 0, this.W, this.H);
    const top = this.addHeader('Worlds', () => this.go('Menu'));
    const total = GameContext.save.totalStars;
    addText(this, this.W / 2, top + 6, `${total} ${total === 1 ? "star" : "stars"} collected`, { size: 26, weight: '500', color: COLORS.muted });

    const cols = 2;
    const gap = 22;
    const cardW = (this.W - 48 - gap) / cols;
    const areaTop = top + 44;
    const areaBottom = this.H - this.safeBottom - 24;
    const cardH = Math.min(340, (areaBottom - areaTop - gap * 2) / 3);
    WORLDS.forEach((world, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = 24 + cardW / 2 + c * (cardW + gap);
      const y = areaTop + cardH / 2 + r * (cardH + gap);
      new WorldCard(this, x, y, cardW, cardH, world, isWorldUnlocked(GameContext.save, world.id), () => this.go('LevelSelect', { world: world.id }));
    });
  }
}
