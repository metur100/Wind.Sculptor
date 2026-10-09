import { AudioManager } from '../audio/AudioManager';
import { GameContext } from '../GameContext';
import { AmbientParticles } from '../gameplay/AmbientParticles';
import { LEVELS } from '../levels/LevelData';
import { getWorld } from '../levels/LevelManager';
import { getMaterial } from '../particles/ParticleMaterial';
import { dateKey, generateDailyLevel, TWIST_LABELS } from '../progression/DailyChallenge';
import { nextPlayableLevel } from '../progression/ProgressionManager';
import { Button } from '../ui/Button';
import { drawIcon } from '../ui/Icons';
import { drawLogo } from '../ui/Logo';
import { addText } from '../ui/Typography';
import { COLORS } from '../utils/Constants';
import { BaseScene } from './BaseScene';

export class MenuScene extends BaseScene {
  private ambient!: AmbientParticles;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.setupScene('Main menu');
    const save = GameContext.save;
    const nextIndex = nextPlayableLevel(save);
    const next = LEVELS[nextIndex];
    const world = getWorld(next.world);

    this.addScenery(world, 0.18);
    this.ambient = new AmbientParticles(this, world.material, 110, { width: this.W, height: this.H });

    const top = this.safeTop;
    const logoY = top + Math.max(170, this.H * 0.15);
    drawLogo(this, this.W / 2, logoY, 0.95);
    addText(this, this.W / 2, logoY + 205, 'Shape the wind. Sculpt the world.', { size: 28, weight: '500', color: world.theme.text });

    const firstTime = !save.tutorialDone;
    const levelLabel = firstTime ? 'Start with a quick tutorial' : `Level ${next.world + 1}-${(nextIndex % 5) + 1} · ${next.name}`;
    const buttonsTop = Math.max(logoY + 300, this.H * 0.46);
    new Button(this, {
      x: this.W / 2,
      y: buttonsTop,
      width: 560,
      height: 130,
      label: firstTime ? 'Play' : 'Continue',
      subLabel: levelLabel,
      icon: 'play',
      fontSize: 44,
      onClick: () => {
        if (firstTime) this.go('Tutorial');
        else this.go('Gameplay', { mode: 'campaign', index: nextIndex });
      },
      focus: this.focus,
    });

    const key = dateKey();
    const daily = generateDailyLevel(key);
    const best = save.daily.best[key];
    const dailySub = best
      ? `Today's best: ${best.score} · ${'★'.repeat(best.stars)}`
      : `${daily.name} · ${getMaterial(daily.material).visual.label} · ${TWIST_LABELS[daily.twist]}`;
    new Button(this, {
      x: this.W / 2,
      y: buttonsTop + 150,
      width: 560,
      height: 108,
      label: 'Daily Challenge',
      subLabel: dailySub,
      icon: 'calendar',
      variant: 'success',
      fontSize: 34,
      onClick: () => this.go('Gameplay', { mode: 'daily', key }),
      focus: this.focus,
    });

    const rowY = buttonsTop + 282;
    new Button(this, {
      x: this.W / 2 - 143,
      y: rowY,
      width: 274,
      height: 100,
      label: 'Levels',
      icon: 'levels',
      variant: 'secondary',
      onClick: () => this.go('WorldSelect'),
      focus: this.focus,
    });
    new Button(this, {
      x: this.W / 2 + 143,
      y: rowY,
      width: 274,
      height: 100,
      label: 'Collection',
      icon: 'cards',
      variant: 'secondary',
      fontSize: 30,
      onClick: () => this.go('Collection'),
      focus: this.focus,
    });
    new Button(this, {
      x: this.W / 2 - 143,
      y: rowY + 122,
      width: 274,
      height: 92,
      label: 'Settings',
      icon: 'gear',
      variant: 'secondary',
      fontSize: 30,
      onClick: () => this.go('Settings'),
      focus: this.focus,
    });
    new Button(this, {
      x: this.W / 2 + 143,
      y: rowY + 122,
      width: 274,
      height: 92,
      label: 'Tutorial',
      icon: 'wind',
      variant: 'secondary',
      fontSize: 30,
      onClick: () => this.go('Tutorial'),
      focus: this.focus,
    });

    // Footer: stars and credit.
    const footerY = this.H - this.safeBottom - 52;
    const stars = this.add.graphics();
    const total = save.totalStars;
    const label = addText(this, 0, footerY, `${total} / ${LEVELS.length * 3}`, { size: 28, weight: '600', color: world.theme.text, origin: [0, 0.5] });
    const width = 40 + label.width;
    label.setX(this.W / 2 - width / 2 + 40);
    drawIcon(stars, 'star', this.W / 2 - width / 2 + 14, footerY, 30, COLORS.star);
    addText(this, this.W / 2, footerY + 38, 'Made by Medin Turkes', { size: 20, weight: '500', color: world.theme.text }).setAlpha(0.75);

    this.focus.onBack = null;
    this.input.once('pointerdown', () => AudioManager.unlock());
  }

  override update(_time: number, delta: number): void {
    this.ambient.update(delta);
  }
}
