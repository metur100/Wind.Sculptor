import Phaser from 'phaser';

import { AudioManager } from '../audio/AudioManager';
import { GameContext } from '../GameContext';
import { LEVELS, LEVELS_PER_WORLD, WORLDS } from '../levels/LevelData';
import type { LevelDefinition } from '../levels/LevelDefinition';
import { isLevelUnlocked, isWorldUnlocked, nextPlayableLevel, worldLockReason, worldStars } from '../progression/ProgressionManager';
import type { Focusable } from '../ui/FocusManager';
import { drawIcon, starPoints } from '../ui/Icons';
import { addText } from '../ui/Typography';
import { COLORS } from '../utils/Constants';
import { Haptics } from '../utils/Haptics';
import { announce, BaseScene } from './BaseScene';

/** One level button: number, three mini stars (filled / hollow) or a lock. */
class LevelTile extends Phaser.GameObjects.Container implements Focusable {
  private readonly ring: Phaser.GameObjects.Graphics;
  readonly accessibleName: string;

  constructor(
    scene: LevelSelectScene,
    x: number,
    y: number,
    private readonly size: number,
    readonly level: LevelDefinition,
    readonly unlocked: boolean,
    stars: number,
    current: boolean,
    accent: number,
    private readonly onPick: () => void,
  ) {
    super(scene, x, y);
    const s = size;
    this.accessibleName = `Level ${level.world + 1}-${(level.index % LEVELS_PER_WORLD) + 1}`;
    const g = scene.add.graphics();
    const fill = !unlocked ? 0xd8dee8 : current ? accent : 0xffffff;
    g.fillStyle(COLORS.ink, 0.16);
    g.fillRoundedRect(-s / 2, -s / 2 + 6, s, s, 24);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, 24);
    if (current) {
      g.lineStyle(4, 0xffffff, 1);
      g.strokeRoundedRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10, 20);
    }
    this.add(g);
    if (unlocked) {
      this.add(addText(scene, 0, -12, String((level.index % LEVELS_PER_WORLD) + 1), { size: 40, weight: '700', color: current ? '#ffffff' : COLORS.inkText }));
      const sg = scene.add.graphics();
      for (let i = 0; i < 3; i++) {
        const pts = starPoints((i - 1) * 24, s / 2 - 24, 10);
        if (i < stars) {
          sg.fillStyle(COLORS.star, 1);
          sg.fillPoints(pts, true);
          sg.lineStyle(2, 0x9a6a10, 1);
          sg.strokePoints(pts, true, true);
        } else {
          sg.lineStyle(2, current ? 0xffffff : 0x9aa6ba, 1);
          sg.strokePoints(pts, true, true);
        }
      }
      this.add(sg);
    } else {
      const lock = scene.add.graphics();
      drawIcon(lock, 'lock', 0, 0, 40, 0x8793a8);
      this.add(lock);
    }
    this.ring = scene.add.graphics();
    this.add(this.ring);
    this.setSize(s, s);
    this.setInteractive(new Phaser.Geom.Rectangle(-s / 2, -s / 2, s, s), Phaser.Geom.Rectangle.Contains);
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
    this.ring.strokeRoundedRect(-this.size / 2 - 8, -this.size / 2 - 8, this.size + 16, this.size + 16, 30);
  }

  activate(): void {
    AudioManager.unlock();
    Haptics.play('tap');
    if (!this.unlocked) {
      AudioManager.toggle(false);
      announce(`Level ${this.level.name} is locked. Finish the previous level first.`);
      this.scene.tweens.add({ targets: this, angle: 6, duration: 60, yoyo: true, repeat: 2 });
      return;
    }
    AudioManager.button();
    this.onPick();
  }
}

/** All 30 levels, one row per world, with stars, locks and the next level highlighted. */
export class LevelSelectScene extends BaseScene {
  private focusWorld = 0;

  constructor() {
    super('LevelSelect');
  }

  init(data: { world?: number }): void {
    this.focusWorld = data?.world ?? -1;
  }

  create(): void {
    this.setupScene('Level select');
    const save = GameContext.save;
    const g = this.add.graphics();
    g.fillGradientStyle(0xfff4e4, 0xfff4e4, 0xe3eefb, 0xe3eefb, 1);
    g.fillRect(0, 0, this.W, this.H);
    const top = this.addHeader('Levels', () => this.go('WorldSelect'));
    const next = nextPlayableLevel(save);
    if (this.focusWorld < 0) this.focusWorld = Math.floor(next / LEVELS_PER_WORLD);

    const areaTop = top + 6;
    const areaBottom = this.H - this.safeBottom - 16;
    const rowH = (areaBottom - areaTop) / WORLDS.length;
    const tile = Math.min(112, rowH - 58);
    const gap = (this.W - 48 - tile * LEVELS_PER_WORLD) / (LEVELS_PER_WORLD - 1);
    let focusTarget: LevelTile | null = null;

    WORLDS.forEach((world, w) => {
      const y0 = areaTop + w * rowH;
      const open = isWorldUnlocked(save, w);
      const band = this.add.graphics();
      band.fillStyle(world.theme.skyTop, w === this.focusWorld ? 0.75 : 0.4);
      band.fillRoundedRect(12, y0 + 4, this.W - 24, rowH - 8, 26);
      addText(this, 30, y0 + 28, `${w + 1}. ${world.name}`, { size: 26, weight: '700', origin: [0, 0.5] });
      const icons = this.add.graphics();
      if (open) {
        drawIcon(icons, 'star', this.W - 150, y0 + 28, 24, COLORS.star);
        addText(this, this.W - 132, y0 + 28, `${worldStars(save, w)} / 15`, { size: 24, weight: '600', color: COLORS.muted, origin: [0, 0.5] });
      } else {
        drawIcon(icons, 'lock', this.W - 40, y0 + 28, 26, 0x6b7890);
        addText(this, this.W - 62, y0 + 28, worldLockReason(save, w) ?? '', { size: 20, weight: '600', color: COLORS.muted, origin: [1, 0.5] });
      }
      for (let i = 0; i < LEVELS_PER_WORLD; i++) {
        const index = w * LEVELS_PER_WORLD + i;
        const level = LEVELS[index];
        const record = save.levels[level.id];
        const tileObj = new LevelTile(
          this,
          24 + tile / 2 + i * (tile + gap),
          y0 + 52 + tile / 2,
          tile,
          level,
          isLevelUnlocked(save, index),
          record?.stars ?? 0,
          index === next && !record?.completed,
          world.theme.accent,
          () => this.go('Gameplay', { mode: 'campaign', index }),
        );
        if (w === this.focusWorld && (focusTarget === null || index === next)) focusTarget = tileObj;
      }
    });
    if (focusTarget && this.input.keyboard) {
      // Keyboard users start on the most relevant level.
      const target = focusTarget;
      this.input.keyboard.once('keydown', () => {
        if (!this.focus.hasModal) this.focus.focus(target);
      });
    }
  }
}
