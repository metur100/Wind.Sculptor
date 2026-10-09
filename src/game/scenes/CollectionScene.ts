import Phaser from 'phaser';

import { GameContext } from '../GameContext';
import { LEVELS, LEVELS_PER_WORLD, WORLDS } from '../levels/LevelData';
import type { LevelDefinition } from '../levels/LevelDefinition';
import { getMaterial } from '../particles/ParticleMaterial';
import { createParticleAtlas, type ParticleAtlas } from '../rendering/TextureFactory';
import { silhouetteTexture } from '../rendering/TargetRenderer';
import { TargetMask } from '../targets/TargetMask';
import { Button } from '../ui/Button';
import { fillRoundedGradient } from '../ui/Draw';
import { drawIcon } from '../ui/Icons';
import { StarRating } from '../ui/StarRating';
import { addText } from '../ui/Typography';
import { COLORS } from '../utils/Constants';
import { Rng } from '../utils/MathUtils';
import { announce, BaseScene } from './BaseScene';

const PER_PAGE = 6;

/** Collectible sculpture cards (one per completed campaign level), six per page. */
export class CollectionScene extends BaseScene {
  private page = 0;
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private pageTextures: string[] = [];
  private pageLabel!: Phaser.GameObjects.Text;
  private dots: { image: Phaser.GameObjects.Image; x: number; y: number; phase: number }[] = [];
  private time0 = 0;



  constructor() {
    super('Collection');
  }

  init(data: { page?: number }): void {
    this.page = data?.page ?? 0;
  }

  create(): void {
    this.setupScene('Collection');
    const g = this.add.graphics();
    g.fillGradientStyle(0xf3ecff, 0xf3ecff, 0xe3f3fb, 0xe3f3fb, 1);
    g.fillRect(0, 0, this.W, this.H);
    const top = this.addHeader('Collection', () => this.go('Menu'));
    const owned = GameContext.save.collection.length;
    addText(this, this.W / 2, top + 4, `${owned} / ${LEVELS.length} sculptures collected`, { size: 26, weight: '500', color: COLORS.muted });

    const by = this.H - this.safeBottom - 64;
    new Button(this, { x: 110, y: by, width: 170, height: 88, icon: 'back', label: 'Prev', variant: 'secondary', fontSize: 28, onClick: () => this.showPage(this.page - 1), focus: this.focus });
    new Button(this, { x: this.W - 110, y: by, width: 170, height: 88, label: 'Next', icon: 'next', variant: 'secondary', fontSize: 28, onClick: () => this.showPage(this.page + 1), focus: this.focus });
    this.pageLabel = addText(this, this.W / 2, by, '', { size: 28, weight: '600' });
    this.events.once('shutdown', () => this.clearPage());
    this.showPage(this.page);
  }

  private get pages(): number {
    return Math.ceil(LEVELS.length / PER_PAGE);
  }

  private clearPage(): void {
    for (const obj of this.pageObjects) obj.destroy();
    this.pageObjects = [];
    this.dots = [];
    for (const key of this.pageTextures) if (this.textures.exists(key)) this.textures.remove(key);
    this.pageTextures = [];
  }

  private showPage(page: number): void {
    this.page = Phaser.Math.Wrap(page, 0, this.pages);
    this.clearPage();
    this.pageLabel.setText(`Page ${this.page + 1} / ${this.pages}`);
    const top = this.safeTop + 190;
    const bottom = this.H - this.safeBottom - 130;
    const gap = 20;
    const cardW = (this.W - 48 - gap) / 2;
    const cardH = (bottom - top - gap * 2) / 3;
    const levels = LEVELS.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    levels.forEach((level, i) => {
      const x = 24 + cardW / 2 + (i % 2) * (cardW + gap);
      const y = top + cardH / 2 + Math.floor(i / 2) * (cardH + gap);
      this.buildCard(level, x, y, cardW, cardH);
    });
    const ownedHere = levels.filter((l) => GameContext.save.collection.includes(l.id)).length;
    announce(`Collection page ${this.page + 1} of ${this.pages}. ${ownedHere} of ${levels.length} unlocked.`);
  }

  private buildCard(level: LevelDefinition, x: number, y: number, w: number, h: number): void {
    const world = WORLDS[level.world];
    const unlocked = GameContext.save.collection.includes(level.id);
    const record = GameContext.save.levels[level.id];
    const container = this.add.container(x, y);
    this.pageObjects.push(container);
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.14);
    g.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 26);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    const artH = h - 112;
    fillRoundedGradient(g, -w / 2 + 10, -h / 2 + 10, w - 20, artH, 20, world.theme.skyTop, world.theme.skyBottom);
    container.add(g);

    // Preview: the silhouette scaled into the card art area.
    const k = GameContext.profile.renderScale;
    const placement = { shape: level.targets[0].shape, x: 0, y: 0, size: 1 };
    const fit = Math.min((w - 50) / 100, (artH - 26) / 100);
    const key = `card-shape-${level.id}`;
    const sil = silhouetteTexture(this, key, [{ ...placement, size: fit }], unlocked ? world.theme.targetFill : 0x3a4558, unlocked ? world.theme.targetLine : 0x2a3344, k);
    this.pageTextures.push(key);
    const artCy = -h / 2 + 10 + artH / 2;
    const image = this.add.image(sil.x, artCy + sil.y, key).setOrigin(0).setScale(1 / k).setAlpha(unlocked ? 0.55 : 0.85);
    container.add(image);

    if (unlocked) {
      // Animated preview: particles of the level's material drifting inside the sculpture.
      const material = getMaterial(level.material);
      const mask = new TargetMask([{ ...placement, x: 60 * fit, y: 60 * fit, size: fit }], 120 * fit, 120 * fit, 3);
      mask.buildCoverage(Math.max(7, fit * 5.5));
      const pts = mask.coverageCenters();
      const atlasKey = `card-atlas-${level.id}`;
      const atlas: ParticleAtlas = createParticleAtlas(this, material, Math.max(8, fit * 5.5) * material.visual.sizeFactor, k, atlasKey);
      this.pageTextures.push(atlasKey);
      const rng = new Rng(level.index + 1);
      const limit = Math.min(pts.length / 2, 90);
      for (let p = 0; p < limit; p++) {
        const j = Math.floor((p / limit) * (pts.length / 2)) * 2;
        const px = pts[j] - 60 * fit;
        const py = artCy + pts[j + 1] - 60 * fit;
        const frame = atlas.frames[rng.int(0, atlas.frames.length - 1)][rng.int(0, atlas.rotationSteps - 1)];
        const dot = this.add.image(px, py, atlasKey, frame.name).setScale(1 / k);
        if (material.visual.additive) dot.setBlendMode(Phaser.BlendModes.ADD);
        container.add(dot);
        this.dots.push({ image: dot, x: px, y: py, phase: rng.next() * Math.PI * 2 });
      }
    } else {
      const q = this.add.graphics();
      drawIcon(q, 'lock', 0, artCy, 48, 0xffffff, 0.9);
      container.add(q);
    }

    const textTop = -h / 2 + 10 + artH + 14;
    container.add(addText(this, -w / 2 + 18, textTop + 16, unlocked ? level.name : '???', { size: 26, weight: '700', origin: [0, 0.5] }));
    const material = getMaterial(level.material).visual.label;
    container.add(
      addText(this, -w / 2 + 18, textTop + 48, `${material} · ${world.name}`, { size: 19, weight: '500', color: COLORS.muted, origin: [0, 0.5] }),
    );
    if (unlocked) {
      const stars = new StarRating(this, w / 2 - 62, textTop + 18, 22, 6);
      stars.setStars(record?.stars ?? 0);
      container.add(stars);
      container.add(addText(this, -w / 2 + 18, textTop + 78, `Best ${record?.bestScore ?? 0}`, { size: 20, weight: '600', origin: [0, 0.5] }));
    } else {
      const n = `${level.world + 1}-${(level.index % LEVELS_PER_WORLD) + 1}`;
      container.add(addText(this, -w / 2 + 18, textTop + 78, `Complete level ${n}`, { size: 20, weight: '600', color: COLORS.muted, origin: [0, 0.5] }));
    }
  }

  override update(_time: number, delta: number): void {
    if (GameContext.reducedMotion) return;
    this.time0 += delta / 1000;
    const t = this.time0;
    for (const d of this.dots) {
      d.image.x = d.x + Math.sin(t * 1.6 + d.phase) * 2.2;
      d.image.y = d.y + Math.cos(t * 1.3 + d.phase * 1.7) * 2.2;
    }
  }
}
