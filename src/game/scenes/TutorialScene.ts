import Phaser from 'phaser';

import { AudioManager } from '../audio/AudioManager';
import { GameContext } from '../GameContext';
import { PlayField } from '../gameplay/PlayField';
import { WORLDS } from '../levels/LevelData';
import type { LevelDefinition } from '../levels/LevelDefinition';
import { resolveLevel } from '../levels/LevelManager';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ProgressBar } from '../ui/ProgressBar';
import { addText } from '../ui/Typography';
import { COLORS, HUD_BOTTOM, HUD_TOP } from '../utils/Constants';
import { Haptics } from '../utils/Haptics';
import { announce, BaseScene } from './BaseScene';

const TUTORIAL_LEVEL: LevelDefinition = {
  id: 'tutorial',
  index: -1,
  world: 0,
  name: 'Tutorial',
  material: 'sand',
  targets: [{ shape: 'blob', x: 360, y: 600, size: 3.2 }],
  grain: 19,
  surplus: 0.6,
  time: 999,
  goals: { one: 0.5, two: 0.65, three: 0.8 },
  parSwipes: 10,
  spawn: { kind: 'pile' },
};

interface Step {
  title: string;
  body: string;
  done: (field: PlayField) => boolean;
}

/** Interactive tutorial: four short steps played on a real (untimed) level. */
export class TutorialScene extends BaseScene {
  private field!: PlayField;
  private steps: Step[] = [];
  private stepIndex = 0;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private progress!: ProgressBar;
  private finishButton!: Button;
  private arrow!: Phaser.GameObjects.Graphics;
  private arrowTime = 0;
  private completed = false;
  private stepCooldown = 0;

  constructor() {
    super('Tutorial');
  }

  create(): void {
    this.setupScene('Tutorial. Swipe to create wind.');
    this.stepIndex = 0;
    this.completed = false;
    this.stepCooldown = 0;
    const level = resolveLevel(
      TUTORIAL_LEVEL,
      { width: this.W, height: this.H, playTop: this.safeTop + HUD_TOP, playBottom: this.H - this.safeBottom - HUD_BOTTOM },
      { maxParticles: GameContext.profile.maxParticles },
    );
    this.field = new PlayField(this, level, WORLDS[0]);
    this.field.session.timed = false;
    this.field.session.autoComplete = false;
    this.events.once('shutdown', () => this.field.destroy());

    this.steps = [
      { title: 'Swipe to create wind', body: 'Drag your finger (or mouse) across the screen.', done: (f) => f.wind.swipes >= 2 },
      { title: 'Guide the particles', body: 'Swipe upwards below the sand to lift it into the glowing shape.', done: (f) => f.session.measure.inside >= 0.12 },
      { title: 'Fill the target shape', body: 'Spread the sand until the whole shape is covered.', done: (f) => f.session.match >= TUTORIAL_LEVEL.goals.one },
      { title: 'Complete the sculpture', body: 'Looks great! Press Finish to complete it.', done: () => false },
    ];

    // Instruction card.
    const top = this.safeTop + 18;
    const card = this.add.graphics().setDepth(10);
    card.fillStyle(0xffffff, 0.93);
    card.fillRoundedRect(20, top, this.W - 40, 150, 30);
    this.counter = addText(this, 48, top + 34, '', { size: 22, weight: '700', color: COLORS.muted, origin: [0, 0.5] }).setDepth(11);
    this.title = addText(this, 48, top + 72, '', { size: 34, weight: '700', origin: [0, 0.5] }).setDepth(11);
    this.body = addText(this, 48, top + 116, '', { size: 23, weight: '500', color: COLORS.muted, origin: [0, 0.5], wrapWidth: this.W - 120 }).setDepth(11);
    this.progress = new ProgressBar(this, this.W / 2, top + 150, { width: this.W - 80, height: 10, fill: COLORS.good, trackAlpha: 0 }).setDepth(11);

    new Button(this, {
      x: this.W - 104,
      y: top + 46,
      width: 140,
      height: 80,
      label: 'Skip',
      variant: 'ghost',
      fontSize: 24,
      onClick: () => this.complete(true),
      focus: this.focus,
    }).setDepth(12);
    this.focus.onBack = () => this.complete(true);

    this.finishButton = new Button(this, {
      x: this.W / 2,
      y: this.H - this.safeBottom - 80,
      width: 320,
      height: 100,
      label: 'Finish',
      icon: 'check',
      variant: 'success',
      onClick: () => this.finishSculpture(),
      focus: this.focus,
    }).setDepth(12);
    this.finishButton.setVisible(false);

    this.arrow = this.add.graphics().setDepth(9);
    this.focus.arrowsNavigate = false;
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.on('keydown-UP', () => this.field.keyboardGust(0, -1));
      keyboard.on('keydown-LEFT', () => this.field.keyboardGust(-1, 0));
      keyboard.on('keydown-RIGHT', () => this.field.keyboardGust(1, 0));
      keyboard.on('keydown-DOWN', () => this.field.keyboardGust(0, 1));
      keyboard.on('keydown-F', () => this.finishSculpture());
    }
    this.showStep();
  }

  private showStep(): void {
    const step = this.steps[this.stepIndex];
    this.counter.setText(`Step ${this.stepIndex + 1} of ${this.steps.length}`);
    this.title.setText(step.title);
    this.body.setText(step.body);
    this.progress.setValue(this.stepIndex / this.steps.length);
    if (this.stepIndex === this.steps.length - 1) {
      this.finishButton.setVisible(true).setHighlighted(!GameContext.reducedMotion);
      this.focus.focus(this.finishButton);
    }
    announce(`${step.title}. ${step.body}`);
  }

  override update(_time: number, delta: number): void {
    this.field.update(delta);
    this.progress.tick(delta / 1000);
    this.drawGuide(delta / 1000);
    if (this.completed) return;
    this.stepCooldown -= delta / 1000;
    const step = this.steps[this.stepIndex];
    if (this.stepCooldown <= 0 && step.done(this.field)) {
      this.stepIndex++;
      this.stepCooldown = 0.6;
      AudioManager.starPop(Math.min(2, this.stepIndex - 1));
      Haptics.play('shape');
      this.showStep();
    }
  }

  /** Animated finger + arrow showing the motion for the first two steps. */
  private drawGuide(dt: number): void {
    const g = this.arrow;
    g.clear();
    if (this.stepIndex > 1 || this.completed) return;
    this.arrowTime += dt;
    const x = this.W / 2 + (this.stepIndex === 0 ? -140 : 0);
    const y0 = this.H - this.safeBottom - 120;
    const y1 = this.stepIndex === 0 ? y0 - 120 : this.field.level.mask.bounds.maxY + 30;
    const x1 = this.stepIndex === 0 ? x + 280 : x;
    const t = (this.arrowTime % 1.6) / 1.6;
    const px = x + (x1 - x) * t;
    const py = y0 + (y1 - y0) * t;
    g.lineStyle(8, 0xffffff, 0.6);
    g.lineBetween(x, y0, x1, y1);
    const a = Math.atan2(y1 - y0, x1 - x);
    g.fillStyle(0xffffff, 0.8);
    g.fillTriangle(
      x1 + Math.cos(a) * 18,
      y1 + Math.sin(a) * 18,
      x1 + Math.cos(a + 2.4) * 26,
      y1 + Math.sin(a + 2.4) * 26,
      x1 + Math.cos(a - 2.4) * 26,
      y1 + Math.sin(a - 2.4) * 26,
    );
    g.fillStyle(0x24324a, 0.3);
    g.fillCircle(px, py + 4, 26);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(px, py, 24);
    g.lineStyle(4, 0x24324a, 0.7);
    g.strokeCircle(px, py, 24);
  }

  private finishSculpture(): void {
    if (this.completed || this.stepIndex < this.steps.length - 1) return;
    this.completed = true;
    this.finishButton.setVisible(false);
    this.field.session.finish('finished');
    this.field.celebrate();
    AudioManager.chime();
    Haptics.play('success');
    this.progress.setValue(1);
    this.time.delayedCall(GameContext.reducedMotion ? 300 : 1600, () => this.complete(false));
  }

  private complete(skipped: boolean): void {
    if (!GameContext.save.tutorialDone) GameContext.update({ ...GameContext.save, tutorialDone: true });
    if (skipped) {
      this.go('Menu');
      return;
    }
    new Modal(
      this,
      this.focus,
      {
        title: 'You are a Wind Sculptor!',
        message: 'Fill each shape before the timer ends. More coverage and time left earn more stars.',
        actions: [
          { label: 'Play Level 1', icon: 'play', variant: 'primary', onClick: () => this.go('Gameplay', { mode: 'campaign', index: 0 }) },
          { label: 'Main menu', icon: 'home', onClick: () => this.go('Menu') },
        ],
        onDismiss: () => this.go('Menu'),
      },
      { width: this.W, height: this.H },
    );
  }
}
