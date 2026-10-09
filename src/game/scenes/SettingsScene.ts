import Phaser from 'phaser';

import { AudioManager } from '../audio/AudioManager';
import { GameContext } from '../GameContext';
import type { Settings } from '../progression/SaveManager';
import { Button } from '../ui/Button';
import type { Focusable } from '../ui/FocusManager';
import { drawIcon, type IconName } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { addText } from '../ui/Typography';
import { COLORS } from '../utils/Constants';
import { Haptics } from '../utils/Haptics';
import { announce, BaseScene } from './BaseScene';

/** Settings row with an ON/OFF switch. State is shown by text and knob position, not by colour alone. */
class ToggleRow extends Phaser.GameObjects.Container implements Focusable {
  private readonly switchGraphics: Phaser.GameObjects.Graphics;
  private readonly stateText: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Graphics;
  readonly accessibleName: string;

  constructor(
    scene: SettingsScene,
    x: number,
    y: number,
    private readonly boxW: number,
    icon: IconName,
    label: string,
    description: string,
    private readonly key: keyof Settings,
  ) {
    super(scene, x, y);
    const w = boxW;
    this.accessibleName = label;
    const h = 112;
    const g = scene.add.graphics();
    g.fillStyle(COLORS.ink, 0.12);
    g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 28);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    drawIcon(g, icon, -w / 2 + 52, 0, 40, COLORS.ink);
    this.add(g);
    this.add(addText(scene, -w / 2 + 96, -16, label, { size: 30, weight: '700', origin: [0, 0.5] }));
    this.add(addText(scene, -w / 2 + 96, 20, description, { size: 20, weight: '500', color: COLORS.muted, origin: [0, 0.5] }));
    this.switchGraphics = scene.add.graphics();
    this.stateText = addText(scene, w / 2 - 70, 0, '', { size: 22, weight: '700' });
    this.ring = scene.add.graphics();
    this.add([this.switchGraphics, this.stateText, this.ring]);
    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerup', () => this.activate());
    this.draw();
    scene.add.existing(this);
    scene.focus.add(this);
  }

  private get value(): boolean {
    return GameContext.settings[this.key];
  }

  private draw(): void {
    const on = this.value;
    const g = this.switchGraphics;
    const cx = this.boxW / 2 - 70;
    g.clear();
    g.fillStyle(on ? COLORS.good : 0xc3cad6, 1);
    g.fillRoundedRect(cx - 52, -24, 104, 48, 24);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(on ? cx + 28 : cx - 28, 0, 19);
    this.stateText.setText(on ? 'ON' : 'OFF');
    this.stateText.setX(on ? cx - 16 : cx + 18);
    this.stateText.setColor(on ? '#ffffff' : COLORS.inkText);
  }

  get focusable(): boolean {
    return true;
  }

  setFocused(focused: boolean): void {
    this.ring.clear();
    if (!focused) return;
    this.ring.lineStyle(6, COLORS.ink, 0.9);
    this.ring.strokeRoundedRect(-this.boxW / 2 - 8, -64, this.boxW + 16, 128, 34);
  }

  activate(): void {
    AudioManager.unlock();
    const next = !this.value;
    GameContext.updateSettings({ [this.key]: next });
    AudioManager.toggle(next);
    if (this.key === 'vibration' && next) Haptics.play('shape');
    this.draw();
    announce(`${this.accessibleName} ${next ? 'on' : 'off'}`);
  }
}

export class SettingsScene extends BaseScene {
  constructor() {
    super('Settings');
  }

  create(): void {
    this.setupScene('Settings');
    const g = this.add.graphics();
    g.fillGradientStyle(0xfff4e4, 0xfff4e4, 0xe3eefb, 0xe3eefb, 1);
    g.fillRect(0, 0, this.W, this.H);
    const top = this.addHeader('Settings', () => this.go('Menu'));
    const w = this.W - 60;
    let y = top + 60;
    const rows: [IconName, string, string, keyof Settings][] = [
      ['sound', 'Sound', 'Wind, chimes and effects', 'sound'],
      ['music', 'Music', 'Calm background music', 'music'],
      ['vibrate', 'Vibration', 'Haptic feedback on supported phones', 'vibration'],
      ['motion', 'Reduced motion', 'Fewer animations and effects', 'reducedMotion'],
    ];
    for (const [icon, label, description, key] of rows) {
      new ToggleRow(this, this.W / 2, y, w, icon, label, description, key);
      y += 132;
    }

    y += 20;
    new Button(this, {
      x: this.W / 2,
      y,
      width: w,
      height: 96,
      label: 'Replay tutorial',
      icon: 'wind',
      variant: 'secondary',
      fontSize: 30,
      onClick: () => this.go('Tutorial'),
      focus: this.focus,
    });
    y += 120;
    new Button(this, {
      x: this.W / 2,
      y,
      width: w,
      height: 96,
      label: 'Reset progress',
      icon: 'trash',
      variant: 'danger',
      fontSize: 30,
      onClick: () => this.confirmReset(),
      focus: this.focus,
    });

    const s = GameContext.save.stats;
    const minutes = Math.round(s.playSeconds / 60);
    addText(this, this.W / 2, this.H - this.safeBottom - 92, `${s.sculptures} ${s.sculptures === 1 ? "sculpture" : "sculptures"} · ${s.swipes} swipes · ${minutes} min played`, {
      size: 22,
      weight: '500',
      color: COLORS.muted,
    });
    addText(this, this.W / 2, this.H - this.safeBottom - 52, 'Wind Sculptor 1.0 · Made by Medin Turkes', { size: 22, weight: '500', color: COLORS.muted });
  }

  private confirmReset(): void {
    const modal: Modal = new Modal(
      this,
      this.focus,
      {
        title: 'Reset all progress?',
        message: 'Stars, scores, unlocked worlds, collection cards and daily results will be deleted. Settings are kept. This cannot be undone.',
        actions: [
          {
            label: 'Yes, reset everything',
            icon: 'trash',
            variant: 'danger',
            onClick: () => {
              GameContext.resetProgress();
              modal.close();
              announce('Progress reset');
              this.go('Menu');
            },
          },
          { label: 'Cancel', icon: 'cross', variant: 'secondary', onClick: () => modal.close() },
        ],
      },
      { width: this.W, height: this.H },
    );
  }
}
