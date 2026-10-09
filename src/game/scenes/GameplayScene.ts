import Phaser from 'phaser';

import { AudioManager } from '../audio/AudioManager';
import { GameContext } from '../GameContext';
import type { LevelResult } from '../gameplay/LevelSession';
import { PlayField } from '../gameplay/PlayField';
import { LEVELS } from '../levels/LevelData';
import type { LevelDefinition } from '../levels/LevelDefinition';
import { getWorld, resolveLevel } from '../levels/LevelManager';
import { dateKey, generateDailyLevel } from '../progression/DailyChallenge';
import { isLevelUnlocked, recordDailyResult, recordLevelResult } from '../progression/ProgressionManager';
import { Button } from '../ui/Button';
import { drawIcon } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ProgressBar } from '../ui/ProgressBar';
import { addText } from '../ui/Typography';
import { COLORS, HUD_BOTTOM, HUD_TOP } from '../utils/Constants';
import { Haptics } from '../utils/Haptics';
import { formatTime } from '../utils/MathUtils';
import { announce, BaseScene } from './BaseScene';
import type { ResultData } from './ResultScene';

type ResultOutcome = Pick<ResultData, 'newBest' | 'firstCompletion' | 'worldsUnlocked' | 'cardUnlocked' | 'streak'>;

export type GameplayData =
  | { mode: 'campaign'; index: number; withHint?: boolean }
  | { mode: 'daily'; key: string; variant?: string; withHint?: boolean };

/** Free hints per attempt (more can come from the optional rewarded-hint integration). */
const FREE_HINTS = 3;

export class GameplayScene extends BaseScene {
  private params!: GameplayData;
  private def!: LevelDefinition;
  private field!: PlayField;
  private hud!: Phaser.GameObjects.Container;
  private timerText!: Phaser.GameObjects.Text;
  private clockIcon!: Phaser.GameObjects.Graphics;
  private matchText!: Phaser.GameObjects.Text;
  private matchBar!: ProgressBar;
  private energyBar: ProgressBar | null = null;
  private finishButton!: Button;
  private hintButton!: Button;
  private hintsLeft = FREE_HINTS;
  private starsReached = 0;
  private ended = false;
  private paused = false;
  private pauseModal: Modal | null = null;
  private lowTimeWarned = false;
  private readonly onBlur = () => this.pause();

  constructor() {
    super('Gameplay');
  }

  init(data: GameplayData): void {
    this.params = data ?? { mode: 'campaign', index: 0 };
  }

  create(): void {
    const data = this.params;
    if (data.mode === 'campaign') {
      const index = Phaser.Math.Clamp(data.index, 0, LEVELS.length - 1);
      this.def = LEVELS[index];
    } else {
      this.def = generateDailyLevel(data.key, data.variant);
    }
    const title = data.mode === 'daily' ? `Daily · ${this.def.name}` : `${this.def.world + 1}-${(this.def.index % 5) + 1} · ${this.def.name}`;
    this.setupScene(`${title}. Swipe to blow the particles into the shape.`);
    this.ended = false;
    this.paused = false;
    this.pauseModal = null;
    this.starsReached = 0;
    this.hintsLeft = FREE_HINTS;
    this.lowTimeWarned = false;
    this.energyBar = null;

    const world = getWorld(this.def.world);
    const level = resolveLevel(
      this.def,
      { width: this.W, height: this.H, playTop: this.safeTop + HUD_TOP, playBottom: this.H - this.safeBottom - HUD_BOTTOM },
      { maxParticles: GameContext.profile.maxParticles },
    );
    this.field = new PlayField(this, level, world);
    this.buildHud(title, world.theme.text);
    this.bindKeys();

    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onBlur);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onBlur);
      this.field.destroy();
      this.tweens.killAll();
    });

    if (this.def.tip) this.toast(this.def.tip, 5200);
    else this.toast(`Fill the shape · ★ at ${Math.round(this.def.goals.one * 100)}%`, 3200);
    if (data.withHint) this.time.delayedCall(900, () => this.useHint(true));
  }

  // ------------------------------------------------------------------ HUD

  private buildHud(title: string, textColor: string): void {
    const top = this.safeTop;
    this.hud = this.add.container(0, 0).setDepth(10);

    // Soft band behind the HUD for legibility on every background.
    const band = this.add.graphics();
    band.fillStyle(0xffffff, 0.55);
    band.fillRoundedRect(130, top + 10, this.W - 260, 92, 28);
    this.hud.add(band);

    const pause = new Button(this, { x: 64, y: top + 58, width: 96, height: 88, icon: 'pause', variant: 'secondary', onClick: () => this.pause(), focus: this.focus });
    this.hud.add(pause);

    this.hud.add(addText(this, this.W / 2 - 60, top + 36, title, { size: 24, weight: '600', color: COLORS.inkText, origin: [0.5, 0.5] }));
    this.clockIcon = this.add.graphics();
    this.hud.add(this.clockIcon);
    this.timerText = addText(this, this.W / 2 - 50, top + 76, formatTime(this.def.time), { size: 38, weight: '700', origin: [0, 0.5] });
    this.hud.add(this.timerText);
    this.drawClock(COLORS.ink);

    this.matchText = addText(this, this.W - 168, top + 56, 'Match\n0%', { size: 26, weight: '700', align: 'right', origin: [1, 0.5], lineSpacing: -4 });
    this.hud.add(this.matchText);

    const goals = this.def.goals;
    this.matchBar = new ProgressBar(this, this.W / 2, top + 128, {
      width: this.W - 80,
      height: 16,
      fill: COLORS.accent,
      trackAlpha: 0.7,
      markers: [goals.one, goals.two, goals.three],
    });
    this.hud.add(this.matchBar);

    const bottom = this.H - this.safeBottom;
    this.hintButton = new Button(this, {
      x: 96,
      y: bottom - 66,
      width: 160,
      height: 92,
      label: `Hint ${this.hintsLeft}`,
      icon: 'hint',
      variant: 'secondary',
      fontSize: 28,
      onClick: () => this.useHint(false),
      focus: this.focus,
    });
    this.finishButton = new Button(this, {
      x: this.W - 120,
      y: bottom - 66,
      width: 210,
      height: 92,
      label: 'Finish',
      icon: 'check',
      variant: 'secondary',
      fontSize: 30,
      onClick: () => this.finish(),
      focus: this.focus,
    });
    this.hud.add([this.hintButton, this.finishButton]);

    if (this.def.energy) {
      const energyIcon = this.add.graphics();
      drawIcon(energyIcon, 'wind', this.W / 2 - 128, bottom - 66, 34, COLORS.ink);
      this.energyBar = new ProgressBar(this, this.W / 2 + 18, bottom - 66, { width: 200, height: 20, fill: 0x3ec7e0, trackAlpha: 0.75 });
      this.energyBar.setValue(1, true);
      const energyLabel = addText(this, this.W / 2 + 18, bottom - 36, 'Wind energy', { size: 18, weight: '600', color: textColor });
      this.hud.add([energyIcon, this.energyBar, energyLabel]);
    }
  }

  private drawClock(color: number): void {
    this.clockIcon.clear();
    drawIcon(this.clockIcon, 'clock', this.W / 2 - 74, this.safeTop + 76, 32, color);
  }

  private toast(text: string, duration: number): void {
    const y = this.safeTop + HUD_TOP + 50;
    const label = addText(this, this.W / 2, y, text, { size: 26, weight: '600', color: COLORS.inkText, wrapWidth: this.W - 140 });
    const pill = this.add.graphics();
    pill.fillStyle(0xffffff, 0.92);
    pill.fillRoundedRect(this.W / 2 - label.width / 2 - 26, y - label.height / 2 - 14, label.width + 52, label.height + 28, 26);
    const toast = this.add.container(0, 0, [pill, label]).setDepth(20).setAlpha(0);
    this.tweens.add({ targets: toast, alpha: 1, duration: 250 });
    this.tweens.add({ targets: toast, alpha: 0, delay: duration, duration: 400, onComplete: () => toast.destroy() });
    announce(text);
  }

  private bindKeys(): void {
    this.focus.arrowsNavigate = false;
    this.focus.onBack = () => this.pause();
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const gust = (dx: number, dy: number) => () => {
      if (!this.paused && !this.ended) this.field.keyboardGust(dx, dy);
    };
    keyboard.on('keydown-LEFT', gust(-1, 0));
    keyboard.on('keydown-A', gust(-1, 0));
    keyboard.on('keydown-RIGHT', gust(1, 0));
    keyboard.on('keydown-D', gust(1, 0));
    keyboard.on('keydown-UP', gust(0, -1));
    keyboard.on('keydown-W', gust(0, -1));
    keyboard.on('keydown-DOWN', gust(0, 1));
    keyboard.on('keydown-S', gust(0, 1));
    keyboard.on('keydown-P', () => (this.paused ? this.resume() : this.pause()));
    keyboard.on('keydown-H', () => this.useHint(false));
    keyboard.on('keydown-F', () => this.finish());
    keyboard.on('keydown-R', () => {
      if (!this.ended && !this.paused) this.restartLevel();
    });
  }

  // ------------------------------------------------------------------ loop

  override update(_time: number, delta: number): void {
    this.field.update(delta);
    const session = this.field.session;
    const dt = delta / 1000;
    this.matchBar.tick(dt);
    this.energyBar?.tick(dt);
    if (this.ended) return;

    const left = session.timeLeft;
    this.timerText.setText(formatTime(left));
    const low = left <= 10;
    this.timerText.setColor(low ? COLORS.badText : COLORS.inkText);
    if (low && !this.lowTimeWarned) {
      this.lowTimeWarned = true;
      this.drawClock(COLORS.bad);
      announce('Ten seconds left');
      if (!GameContext.reducedMotion) this.tweens.add({ targets: this.timerText, scale: 1.15, duration: 300, yoyo: true, repeat: 5 });
    }

    const match = session.match;
    this.matchText.setText(`Match\n${Math.round(match * 100)}%`);
    this.matchBar.setValue(match);
    const goals = session.goals;
    const reached = match >= goals.three ? 3 : match >= goals.two ? 2 : match >= goals.one ? 1 : 0;
    if (reached > this.starsReached) {
      for (let s = this.starsReached; s < reached; s++) AudioManager.starPop(s);
      this.starsReached = reached;
      Haptics.play('shape');
      announce(`${reached} star${reached > 1 ? 's' : ''} reached`);
    } else if (reached < this.starsReached) {
      this.starsReached = reached;
    }
    const ready = session.canSucceed;
    this.finishButton.setVariant(ready ? 'success' : 'secondary').setHighlighted(ready && !GameContext.reducedMotion);
    this.matchBar.setFillColor(ready ? COLORS.good : COLORS.accent);
    this.energyBar?.setValue(this.field.wind.energyRatio);

    if (session.state === 'done' && session.result) this.handleEnd(session.result);
  }

  // ------------------------------------------------------------------ actions

  private useHint(free: boolean): void {
    if (this.ended || this.paused) return;
    if (!free) {
      if (this.hintsLeft <= 0) {
        this.toast('No hints left for this attempt', 1800);
        return;
      }
      this.hintsLeft--;
      this.hintButton.setLabel(`Hint ${this.hintsLeft}`);
      if (this.hintsLeft === 0) this.hintButton.setDisabled(true);
    }
    if (!this.field.showHint()) this.toast('The shape is complete – press Finish!', 2000);
  }

  private finish(): void {
    if (this.ended || this.paused) return;
    this.field.session.finish('finished');
  }

  pause(): void {
    if (this.paused || this.ended || !this.scene.isActive()) return;
    this.paused = true;
    this.field.running = false;
    this.field.inputEnabled = false;
    this.field.wind.endStroke();
    AudioManager.setWind(0, 0);
    this.pauseModal = new Modal(
      this,
      this.focus,
      {
        title: 'Paused',
        message: `${this.def.name} · ${formatTime(this.field.session.timeLeft)} left`,
        actions: [
          { label: 'Resume', icon: 'play', variant: 'primary', onClick: () => this.resume() },
          { label: 'Restart', icon: 'retry', onClick: () => this.restartLevel() },
          { label: 'Level select', icon: 'levels', onClick: () => this.leaveTo('LevelSelect', { world: this.def.world }) },
          { label: 'Main menu', icon: 'home', onClick: () => this.leaveTo('Menu') },
        ],
        onDismiss: () => this.resume(),
      },
      { width: this.W, height: this.H },
    );
    announce('Game paused');
  }

  resume(): void {
    if (!this.paused) return;
    this.pauseModal?.close();
    this.pauseModal = null;
    this.paused = false;
    this.field.running = true;
    this.field.inputEnabled = true;
    announce('Resumed');
  }

  private restartLevel(): void {
    this.scene.stop('Result');
    this.scene.restart(this.params);
  }

  private leaveTo(key: string, data?: object): void {
    this.scene.stop('Result');
    this.go(key, data);
  }

  // ------------------------------------------------------------------ end of level

  private handleEnd(result: LevelResult): void {
    if (this.ended) return;
    this.ended = true;
    this.field.inputEnabled = false;
    this.finishButton.setHighlighted(false);
    const outcome = this.recordResult(result);
    const reduced = GameContext.reducedMotion;

    if (result.success) {
      this.field.celebrate();
      AudioManager.chime();
      Haptics.play('success');
      announce(`Sculpture complete! ${result.stars} stars, score ${result.breakdown.score}.`);
      this.tweens.add({ targets: this.hud, alpha: 0, duration: 400, delay: 300 });
      this.time.delayedCall(reduced ? 600 : 1700, () => {
        this.frameSculpture(reduced ? 0 : 700);
        this.showResult(result, outcome);
      });
    } else {
      AudioManager.failure();
      Haptics.play('failure');
      announce(`Level failed. ${result.failReason ?? ''}`);
      this.time.delayedCall(700, () => {
        this.hud.setAlpha(0.25);
        this.showResult(result, outcome);
      });
    }
  }

  private recordResult(result: LevelResult): ResultOutcome {
    const seconds = this.field.session.elapsed;
    if (this.params.mode === 'daily') {
      const previous = GameContext.save.daily.best[this.params.key];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      GameContext.update(recordDailyResult(GameContext.save, this.params.key, result, dateKey(yesterday)));
      return {
        newBest: result.success && result.breakdown.score > (previous?.score ?? 0),
        firstCompletion: false,
        worldsUnlocked: [],
        cardUnlocked: null,
        streak: GameContext.save.daily.streak,
      };
    }
    const out = recordLevelResult(GameContext.save, result, seconds);
    GameContext.update(out.save);
    return {
      newBest: out.newBest,
      firstCompletion: out.firstCompletion,
      worldsUnlocked: out.worldsUnlocked,
      cardUnlocked: out.firstCompletion ? this.def.id : null,
      streak: 0,
    };
  }

  /** Zooms the camera so the finished sculpture sits in the upper part of the screen. */
  private frameSculpture(duration: number): void {
    const bounds = this.field.targetBounds();
    const cam = this.cameras.main;
    const z = Math.min(1, (this.H * 0.36) / (bounds.height + 60), (this.W - 60) / (bounds.width + 60));
    const cy = bounds.centerY + (this.H * 0.5 - (this.safeTop + this.H * 0.23)) / z;
    if (duration <= 0) {
      cam.setZoom(this.k * z);
      cam.centerOn(this.W / 2 + (bounds.centerX - this.W / 2), cy);
      return;
    }
    cam.zoomTo(this.k * z, duration, 'Sine.easeInOut');
    cam.pan(bounds.centerX, cy, duration, 'Sine.easeInOut');
  }

  private resetCamera(): void {
    const cam = this.cameras.main;
    cam.setZoom(this.k);
    cam.centerOn(this.W / 2, this.H / 2);
  }

  private showResult(result: LevelResult, outcome: ResultOutcome): void {
    const data = this.params;
    const index = data.mode === 'campaign' ? data.index : -1;
    const canNext = data.mode === 'campaign' && index + 1 < LEVELS.length && isLevelUnlocked(GameContext.save, index + 1);
    const payload: ResultData = {
      ...outcome,
      result,
      title: data.mode === 'daily' ? `Daily · ${this.def.name}` : this.def.name,
      worldIndex: this.def.world,
      canNext,
      canContinue: !result.success && result.reason === 'timeout' && this.field.session.continuesUsed === 0,
      goalOne: this.def.goals.one,
      actions: {
        retry: () => this.restartLevel(),
        next: () => {
          if (data.mode === 'campaign') {
            this.scene.stop('Result');
            this.scene.restart({ mode: 'campaign', index: index + 1 });
          }
        },
        levels: () => this.leaveTo(data.mode === 'daily' ? 'Menu' : 'LevelSelect', { world: this.def.world }),
        keepSculpting: () => {
          this.scene.stop('Result');
          if (this.field.session.continueRun()) {
            this.ended = false;
            this.lowTimeWarned = false;
            this.drawClock(COLORS.ink);
            this.hud.setAlpha(1);
            this.resetCamera();
            this.field.inputEnabled = true;
            announce('Twenty more seconds. Keep sculpting!');
          }
        },
        retryWithHint: () => {
          this.scene.stop('Result');
          this.scene.restart({ ...data, withHint: true });
        },
      },
    };
    this.scene.launch('Result', payload);
  }
}
