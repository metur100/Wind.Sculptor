import { AudioManager } from '../audio/AudioManager';
import { GameContext } from '../GameContext';
import type { LevelResult } from '../gameplay/LevelSession';
import { WORLDS } from '../levels/LevelData';
import { getLevelById } from '../levels/LevelManager';
import { Button } from '../ui/Button';
import { StarRating } from '../ui/StarRating';
import { addText } from '../ui/Typography';
import { COLORS } from '../utils/Constants';
import { formatTime } from '../utils/MathUtils';
import { announce, BaseScene } from './BaseScene';

export interface ResultData {
  result: LevelResult;
  title: string;
  worldIndex: number;
  canNext: boolean;
  canContinue: boolean;
  /** One-star goal (0..1) – shown on the failure screen. */
  goalOne: number;
  newBest: boolean;
  firstCompletion: boolean;
  worldsUnlocked: number[];
  cardUnlocked: string | null;
  streak: number;
  actions: {
    retry: () => void;
    next: () => void;
    levels: () => void;
    keepSculpting: () => void;
    retryWithHint: () => void;
  };
}

/** Success / failure overlay shown above the (still animating) gameplay scene. */
export class ResultScene extends BaseScene {
  private payload!: ResultData;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.payload = data;
  }

  create(): void {
    const { result } = this.payload;
    this.setupScene();
    this.cameras.main.fadeIn(0);
    if (result.success) this.buildSuccess();
    else this.buildFailure();
  }

  private panel(top: number): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.12);
    g.fillRoundedRect(20, top + 10, this.W - 40, this.H - top - this.safeBottom - 10, 40);
    g.fillStyle(COLORS.panel, 0.97);
    g.fillRoundedRect(20, top, this.W - 40, this.H - top - this.safeBottom - 20, 40);
    // Block taps from reaching the gameplay below.
    this.add.zone(0, 0, this.W, this.H).setOrigin(0).setInteractive();
    this.children.bringToTop(g);
  }

  private buildSuccess(): void {
    const p = this.payload;
    const r = p.result;
    const top = Math.max(this.H * 0.46, this.H - this.safeBottom - 720);
    this.panel(top);
    const reduced = GameContext.reducedMotion;

    addText(this, this.W / 2, top + 58, 'Sculpture complete!', { size: 44, weight: '700' });
    addText(this, this.W / 2, top + 106, p.title, { size: 28, weight: '500', color: COLORS.muted });

    const stars = new StarRating(this, this.W / 2, top + 192, 84, 26);
    stars.setStars(r.stars, !reduced, (i) => AudioManager.starPop(i));
    if (reduced) stars.setStars(r.stars);
    const starWords = ['', 'One star', 'Two stars', 'Three stars'][r.stars];

    // Score counts up.
    const scoreText = addText(this, this.W / 2, top + 290, 'Score 0', { size: 40, weight: '700', color: COLORS.inkText });
    const counter = { value: 0 };
    this.tweens.add({
      targets: counter,
      value: r.breakdown.score,
      duration: reduced ? 0 : 900,
      delay: reduced ? 0 : 400,
      ease: 'Cubic.easeOut',
      onUpdate: () => scoreText.setText(`Score ${Math.round(counter.value)}`),
      onComplete: () => scoreText.setText(`Score ${r.breakdown.score}`),
    });
    if (p.newBest) {
      const badge = addText(this, this.W / 2 + 170, top + 290, 'New best!', { size: 22, weight: '700', color: '#ffffff' });
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.good, 1);
      bg.fillRoundedRect(badge.x - badge.width / 2 - 14, badge.y - 18, badge.width + 28, 36, 18);
      this.children.bringToTop(badge);
    }

    const stats = [
      `Match ${Math.round(r.breakdown.match * 100)}%`,
      `Time left ${formatTime(r.timeLeft)}`,
      `${r.swipes} swipe${r.swipes === 1 ? '' : 's'}`,
    ].join('   ·   ');
    addText(this, this.W / 2, top + 344, stats, { size: 24, weight: '500', color: COLORS.muted });

    const notes: string[] = [];
    if (p.cardUnlocked) notes.push(`New collection card: ${getLevelById(p.cardUnlocked)?.name ?? p.title}`);
    for (const w of p.worldsUnlocked) notes.push(`New world unlocked: ${WORLDS[w].name}!`);
    if (p.streak > 1) notes.push(`Daily streak: ${p.streak} days`);
    if (notes.length) addText(this, this.W / 2, top + 392, notes.join('\n'), { size: 24, weight: '600', color: COLORS.goodText, lineSpacing: 6 });

    const by = this.H - this.safeBottom - 200;
    new Button(this, { x: this.W / 2 - 160, y: by, width: 260, height: 100, label: 'Retry', icon: 'retry', variant: 'secondary', onClick: p.actions.retry, focus: this.focus });
    const next = p.canNext
      ? new Button(this, { x: this.W / 2 + 145, y: by, width: 290, height: 100, label: 'Next', icon: 'next', onClick: p.actions.next, focus: this.focus })
      : new Button(this, {
          x: this.W / 2 + 145,
          y: by,
          width: 290,
          height: 100,
          label: p.worldIndex < 0 || p.result.levelId.startsWith('daily') ? 'Menu' : 'Levels',
          icon: p.result.levelId.startsWith('daily') ? 'home' : 'levels',
          onClick: p.actions.levels,
          focus: this.focus,
        });
    new Button(this, {
      x: this.W / 2,
      y: by + 116,
      width: 420,
      height: 84,
      label: p.result.levelId.startsWith('daily') ? 'Main menu' : 'Level select',
      icon: p.result.levelId.startsWith('daily') ? 'home' : 'levels',
      variant: 'ghost',
      fontSize: 28,
      onClick: p.actions.levels,
      focus: this.focus,
    });
    this.focus.focus(next);
    this.focus.onBack = p.actions.levels;
    announce(`Sculpture complete. ${starWords}. Score ${r.breakdown.score}. ${notes.join('. ')}`);
  }

  private buildFailure(): void {
    const p = this.payload;
    const r = p.result;
    this.add.rectangle(0, 0, this.W, this.H, COLORS.ink, 0.35).setOrigin(0);
    const top = Math.max(this.H * 0.3, this.H - this.safeBottom - 820);
    this.panel(top);
    addText(this, this.W / 2, top + 66, 'Not quite!', { size: 52, weight: '700' });
    addText(this, this.W / 2, top + 128, r.failReason ?? 'The sculpture is not finished yet.', { size: 28, weight: '500', color: COLORS.muted, wrapWidth: this.W - 120 });

    const stars = new StarRating(this, this.W / 2, top + 220, 64, 22);
    stars.setStars(0);
    const needed = Math.round(p.goalOne * 100);
    addText(this, this.W / 2, top + 300, `Match ${Math.round(r.breakdown.match * 100)}%  ·  needed ${needed}% for ★`, { size: 30, weight: '700', color: COLORS.badText });

    let y = top + 400;
    const buttons: Button[] = [];
    if (p.canContinue) {
      buttons.push(
        new Button(this, { x: this.W / 2, y, width: 520, height: 100, label: 'Keep sculpting', subLabel: '+20 seconds', icon: 'clock', onClick: p.actions.keepSculpting, focus: this.focus }),
      );
      y += 120;
    }
    buttons.push(new Button(this, { x: this.W / 2, y, width: 520, height: 96, label: 'Retry', icon: 'retry', variant: p.canContinue ? 'secondary' : 'primary', onClick: p.actions.retry, focus: this.focus }));
    y += 114;
    // Rewarded-hint placement: today the hint is free; MonetizationManager can gate an extra one later.
    buttons.push(new Button(this, { x: this.W / 2, y, width: 520, height: 92, label: 'Retry with a hint', icon: 'hint', variant: 'secondary', fontSize: 30, onClick: p.actions.retryWithHint, focus: this.focus }));
    y += 110;
    buttons.push(
      new Button(this, {
        x: this.W / 2,
        y,
        width: 520,
        height: 84,
        label: p.result.levelId.startsWith('daily') ? 'Main menu' : 'Level select',
        icon: p.result.levelId.startsWith('daily') ? 'home' : 'levels',
        variant: 'ghost',
        fontSize: 28,
        onClick: p.actions.levels,
        focus: this.focus,
      }),
    );
    this.focus.focus(buttons[0]);
    this.focus.onBack = p.actions.levels;
    announce(`Not quite. ${r.failReason ?? ''} Match ${Math.round(r.breakdown.match * 100)} percent.`);
  }
}
