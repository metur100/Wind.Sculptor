import Phaser from 'phaser';

import { AudioManager } from '../audio/AudioManager';
import { GameContext } from '../GameContext';
import type { WorldDefinition } from '../levels/LevelDefinition';
import type { ResolvedLevel } from '../levels/LevelManager';
import { getMaterial, type ParticleMaterial } from '../particles/ParticleMaterial';
import { ParticleSystem } from '../particles/ParticleSystem';
import { WindField } from '../particles/WindField';
import { sceneryTexture } from '../rendering/Scenery';
import { silhouetteTexture, type SilhouetteTexture } from '../rendering/TargetRenderer';
import { createParticleAtlas, ensureFxTextures, FX, type ParticleAtlas } from '../rendering/TextureFactory';
import { MAX_SIM_STEPS_PER_FRAME, SIM_STEP } from '../utils/Constants';
import { Haptics } from '../utils/Haptics';
import { Rng } from '../utils/MathUtils';
import { FxPool } from './FxPool';
import { planSwipe, type SwipePlan } from './HintPlanner';
import { LevelSession } from './LevelSession';

let atlasCounter = 0;

/**
 * Renders and drives one LevelSession inside a Phaser scene: background, target silhouette,
 * obstacles, particles, wind trails, effects and pointer/keyboard wind input.
 * Used by both the gameplay scene and the tutorial.
 */
export class PlayField {
  readonly session: LevelSession;
  readonly system: ParticleSystem;
  readonly wind: WindField;
  readonly material: ParticleMaterial;
  readonly container: Phaser.GameObjects.Container;
  /** When false, pointer input does not create wind (paused, finished, UI open). */
  inputEnabled = true;
  /** Advance the simulation (false while paused). */
  running = true;
  /** Called whenever the player completes a swipe (counts towards efficiency). */
  onSwipe: (() => void) | null = null;

  private readonly scale: number;
  private readonly atlas: ParticleAtlas;
  private readonly blitter: Phaser.GameObjects.Blitter;
  private readonly bobs: Phaser.GameObjects.Bob[] = [];
  private readonly silhouette: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly silhouetteInfo: SilhouetteTexture;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly fanGraphics: Phaser.GameObjects.Graphics;
  private readonly hintGraphics: Phaser.GameObjects.Graphics;
  private readonly fx: FxPool;
  private readonly rng = new Rng(1234);
  private accumulator = 0;
  private lastStepAt = performance.now();
  private renderTime = 0;
  private celebrating = false;
  private celebrateTime = 0;
  private hint: { plan: SwipePlan; age: number } | null = null;
  private activePointerId: number | null = null;
  private wispTimer = 0;
  private readonly newestSegment = { found: false, ax: 0, ay: 0, bx: 0, by: 0 };
  private readonly handlers: [string, (...args: never[]) => void][] = [];
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly level: ResolvedLevel,
    readonly world: WorldDefinition,
    options: { capacity?: number } = {},
  ) {
    const profile = GameContext.profile;
    this.scale = profile.renderScale;
    this.material = getMaterial(level.def.material);
    this.system = new ParticleSystem(Math.max(level.particleCount, options.capacity ?? 0));
    this.wind = new WindField();
    this.session = new LevelSession(level, this.system, this.wind);
    this.system.onLost = (x, y) => this.onParticleLost(x, y);
    ensureFxTextures(scene);

    const { width, height } = level.viewport;
    this.container = scene.add.container(0, 0);

    // Background.
    const bgKey = sceneryTexture(scene, world, width, height, Math.min(this.scale, 1.5));
    const bg = scene.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(width, height);
    this.container.add(bg);

    // Target silhouette (plus an additive copy used for the success glow).
    this.silhouetteInfo = silhouetteTexture(scene, `target-${level.def.id}`, level.placements, world.theme.targetFill, world.theme.targetLine, this.scale);
    const sx = this.silhouetteInfo.x;
    const sy = this.silhouetteInfo.y;
    this.silhouette = scene.add.image(sx, sy, this.silhouetteInfo.key).setOrigin(0).setScale(1 / this.scale).setAlpha(0.42);
    this.glow = scene.add
      .image(sx, sy, this.silhouetteInfo.key)
      .setOrigin(0)
      .setScale(1 / this.scale)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff3c0);
    this.container.add([this.silhouette, this.glow]);

    // Obstacles.
    const obstacles = scene.add.graphics();
    this.drawObstacles(obstacles);
    this.container.add(obstacles);
    this.fanGraphics = scene.add.graphics();
    this.container.add(this.fanGraphics);

    // Wind trail below the particles, hint arrow on top.
    this.trail = scene.add.graphics();
    if (this.material.visual.additive) this.trail.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.trail);

    // Particles.
    const diameter = level.spacing * this.material.visual.sizeFactor;
    this.atlas = createParticleAtlas(scene, this.material, diameter, this.scale, `particles-${level.def.material}-${atlasCounter++}`);
    // Phaser's Blitter ignores its own scale when rendering, so a scaled container maps the
    // render-scale atlas (and bob positions in render-scale pixels) back to design units.
    this.blitter = scene.make.blitter({ x: 0, y: 0, key: this.atlas.key }, false);
    if (this.material.visual.additive) this.blitter.setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < this.system.capacity; i++) {
      const bob = this.blitter.create(0, 0, this.atlas.frames[0][0]);
      bob.setVisible(false);
      this.bobs.push(bob);
    }
    this.container.add(scene.add.container(0, 0, [this.blitter]).setScale(1 / this.scale));

    this.fx = new FxPool(scene, this.container, profile.lowEnd ? 90 : 160);
    this.hintGraphics = scene.add.graphics();
    this.container.add(this.hintGraphics);

    this.bindInput();
    AudioManager.startAmbience(level.def.material);
    this.render(0);
  }

  // ------------------------------------------------------------------ input

  private on(event: string, handler: (...args: never[]) => void): void {
    this.scene.input.on(event, handler);
    this.handlers.push([event, handler]);
  }

  private windClock(): number {
    // Sub-step accurate time so swipe speeds are measured precisely between simulation steps.
    return this.session.elapsed + Math.min(0.05, (performance.now() - this.lastStepAt) / 1000);
  }

  private toWorld(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private bindInput(): void {
    this.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      AudioManager.unlock();
      if (!this.inputEnabled || over.length > 0 || this.activePointerId !== null) return;
      this.activePointerId = pointer.id;
      const p = this.toWorld(pointer);
      this.wind.beginStroke(p.x, p.y, this.windClock());
      this.hint = null;
    });
    this.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.activePointerId || !this.inputEnabled) return;
      const p = this.toWorld(pointer);
      const speed = this.wind.moveStroke(p.x, p.y, this.windClock());
      if (speed > 1600) Haptics.play('gust');
    });
    const end = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.activePointerId) return;
      this.activePointerId = null;
      const peak = this.wind.peakSpeed;
      this.wind.peakSpeed = 0;
      if (this.wind.endStroke()) {
        if (peak > 1500) AudioManager.gust(Math.min(1, peak / 2600));
        this.onSwipe?.();
      }
    };
    this.on('pointerup', end);
    this.on('pointerupoutside', end);
    this.on('gameout', () => {
      if (this.activePointerId !== null) {
        this.activePointerId = null;
        this.wind.endStroke();
      }
    });
  }

  /** Keyboard gust (arrow keys / WASD) from the centre of the loose particles. */
  keyboardGust(dx: number, dy: number): void {
    if (!this.inputEnabled) return;
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (const p of this.system.particles) {
      if (!p.active || p.inside) continue;
      cx += p.x;
      cy += p.y;
      n++;
    }
    if (n === 0) {
      cx = this.level.viewport.width / 2;
      cy = (this.level.env.bounds.top + this.level.env.bounds.bottom) / 2;
    } else {
      cx /= n;
      cy /= n;
    }
    const length = 300;
    const time = this.windClock();
    const sx = cx - dx * 90;
    const sy = cy - dy * 90;
    this.wind.beginStroke(sx, sy, time);
    for (let i = 1; i <= 8; i++) {
      const k = i / 8;
      this.wind.moveStroke(sx + dx * length * k, sy + dy * length * k, time + k * 0.25);
    }
    this.wind.endStroke();
    this.onSwipe?.();
  }

  showHint(): boolean {
    this.session.remeasure();
    const plan = planSwipe(this.session, this.rng);
    if (!plan) return false;
    this.hint = { plan, age: 0 };
    return true;
  }

  // ------------------------------------------------------------------ loop

  update(deltaMs: number): void {
    if (this.destroyed) return;
    const dt = Math.min(deltaMs / 1000, 0.1);
    if (this.running) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= SIM_STEP && steps < MAX_SIM_STEPS_PER_FRAME) {
        this.session.step(SIM_STEP);
        this.accumulator -= SIM_STEP;
        steps++;
      }
      if (steps === MAX_SIM_STEPS_PER_FRAME) this.accumulator = 0;
      if (steps > 0) this.lastStepAt = performance.now();
      GameContext.governor.record(deltaMs);
    }
    this.render(this.running ? dt : 0);
    const swipe = this.wind.isStroking ? Math.min(1, this.wind.currentSpeed / 1800) : 0;
    AudioManager.setWind(this.running ? swipe : 0, this.running ? Math.min(1, this.system.averageSpeed / 260) : 0);
  }

  private render(dt: number): void {
    this.renderTime += dt;
    const t = this.renderTime;
    const reduced = GameContext.reducedMotion;
    const k = this.scale;
    const half = this.atlas.cell / 2;
    const steps = this.atlas.rotationSteps;
    const flicker = this.material.visual.flicker;
    const breathe = this.celebrating && !reduced;
    const particles = this.system.particles;
    for (let i = 0; i < this.bobs.length; i++) {
      const p = particles[i];
      const bob = this.bobs[i];
      if (!p.active) {
        if (bob.visible) bob.setVisible(false);
        continue;
      }
      if (!bob.visible) bob.setVisible(true);
      let y = p.y;
      if (breathe && p.inside) y += Math.sin(t * 3 + p.x * 0.03) * 2.2;
      bob.x = p.x * k - half;
      bob.y = y * k - half;
      if (steps > 1) {
        let s = Math.floor((p.angle / (Math.PI * 2)) * steps) % steps;
        if (s < 0) s += steps;
        bob.setFrame(this.atlas.frames[p.variant][s]);
      } else {
        bob.setFrame(this.atlas.frames[p.variant][0]);
      }
      if (flicker) {
        const base = p.inside ? 0.8 : 0.55;
        bob.setAlpha(base + (1 - base) * Math.sin(t * 2.6 + p.phase * 40));
      }
    }

    // Moving target follows the mask offset.
    const offset = this.session.targetOffset;
    this.silhouette.setPosition(this.silhouetteInfo.x + offset.x, this.silhouetteInfo.y + offset.y);
    this.glow.setPosition(this.silhouette.x, this.silhouette.y);
    if (!this.celebrating) this.silhouette.setAlpha(0.36 + this.session.match * 0.2);
    else {
      this.celebrateTime += dt;
      const pulse = reduced ? 0.35 : 0.25 + 0.25 * Math.sin(this.celebrateTime * 4);
      this.glow.setAlpha(Math.min(1, this.celebrateTime * 2) * pulse);
      this.spawnCelebrationSparkles(dt);
    }

    this.drawTrail();
    this.drawFans();
    this.drawHint(dt);
    this.spawnWisps(dt);
    this.fx.update(dt);
  }

  // ------------------------------------------------------------------ drawing

  private drawObstacles(g: Phaser.GameObjects.Graphics): void {
    const theme = this.world.theme;
    for (const w of this.level.env.walls) {
      g.fillStyle(0x000000, 0.15);
      g.fillRoundedRect(w.x, w.y + 6, w.w, w.h, Math.min(12, w.h / 2));
      g.fillStyle(theme.wall, 1);
      g.fillRoundedRect(w.x, w.y, w.w, w.h, Math.min(12, w.h / 2));
      g.lineStyle(3, theme.wallEdge, 1);
      g.strokeRoundedRect(w.x, w.y, w.w, w.h, Math.min(12, w.h / 2));
      // Diagonal hatching marks walls as solid (not only by colour).
      g.lineStyle(2, theme.wallEdge, 0.45);
      for (let x = w.x + 12; x < w.x + w.w - 4; x += 18) g.lineBetween(x, w.y + w.h - 4, Math.min(x + 10, w.x + w.w - 4), w.y + 4);
    }
    for (const s of this.level.env.sinks) {
      g.fillStyle(theme.sink, 0.85);
      g.fillEllipse(s.x, s.y, s.rx * 2, s.ry * 2);
      g.lineStyle(4, 0xffffff, 0.45);
      g.strokeEllipse(s.x, s.y, s.rx * 2, s.ry * 2);
      g.lineStyle(2, 0xffffff, 0.3);
      g.strokeEllipse(s.x, s.y, s.rx * 1.3, s.ry * 1.2);
      // Downward chevrons: "particles fall in here".
      g.lineStyle(3, 0xffffff, 0.6);
      for (const ox of [-0.35, 0, 0.35]) {
        const cx = s.x + ox * s.rx;
        g.lineBetween(cx - 8, s.y - 6, cx, s.y + 2);
        g.lineBetween(cx, s.y + 2, cx + 8, s.y - 6);
      }
    }
  }

  private drawFans(): void {
    const g = this.fanGraphics;
    g.clear();
    const fans = this.level.env.fans;
    if (fans.length === 0) return;
    const t = this.renderTime;
    for (const fan of fans) {
      const len = Math.hypot(fan.fx, fan.fy) || 1;
      const dx = fan.fx / len;
      const dy = fan.fy / len;
      g.fillStyle(0xffffff, 0.1);
      g.fillRoundedRect(fan.x, fan.y, fan.w, fan.h, 24);
      g.lineStyle(2, 0xffffff, 0.35);
      g.strokeRoundedRect(fan.x, fan.y, fan.w, fan.h, 24);
      // Moving stream lines show direction.
      g.lineStyle(3, 0xffffff, 0.55);
      for (let i = 0; i < 6; i++) {
        const phase = (t * 0.9 + i / 6) % 1;
        const ox = fan.x + fan.w * ((i * 0.37 + 0.15) % 1);
        const oy = fan.y + fan.h * ((i * 0.61 + 0.2) % 1);
        const travel = (phase - 0.5) * Math.min(fan.w, fan.h) * 0.8;
        const x = Phaser.Math.Clamp(ox + dx * travel, fan.x + 8, fan.x + fan.w - 8);
        const y = Phaser.Math.Clamp(oy + dy * travel, fan.y + 8, fan.y + fan.h - 8);
        g.lineBetween(x - dx * 18, y - dy * 18, x + dx * 18, y + dy * 18);
        g.lineBetween(x + dx * 18, y + dy * 18, x + dx * 10 - dy * 7, y + dy * 10 + dx * 7);
        g.lineBetween(x + dx * 18, y + dy * 18, x + dx * 10 + dy * 7, y + dy * 10 - dx * 7);
      }
      // Fan hub with spinning blades at the source side.
      const hx = fan.x + fan.w / 2 - dx * fan.w * 0.38;
      const hy = fan.y + fan.h / 2 - dy * fan.h * 0.38;
      g.fillStyle(0xffffff, 0.75);
      for (let b = 0; b < 3; b++) {
        const a = t * 9 + (b * Math.PI * 2) / 3;
        g.fillEllipse(hx + Math.cos(a) * 14, hy + Math.sin(a) * 14, 26, 11);
      }
      g.fillStyle(0x24324a, 0.6);
      g.fillCircle(hx, hy, 6);
    }
  }

  private drawTrail(): void {
    const g = this.trail;
    g.clear();
    const { style, colors, width, alpha } = this.material.visual.trail;
    const reduced = GameContext.reducedMotion;
    let index = 0;
    this.wind.forEachSegment(this.session.elapsed, (ax, ay, bx, by, life, speed) => {
      const w = width * (0.45 + 0.55 * Math.min(1, speed)) * (0.4 + 0.6 * life);
      const a = alpha * life;
      const color = colors[index++ % colors.length];
      if (style === 'gust' || style === 'dust' || style === 'current') {
        // Soft, wide passes.
        g.lineStyle(w * 1.6, color, a * 0.35);
        g.lineBetween(ax, ay, bx, by);
        g.fillStyle(color, a * 0.35);
        g.fillCircle(bx, by, w * 0.8);
        g.lineStyle(w * 0.6, color, a * 0.6);
        g.lineBetween(ax, ay, bx, by);
      } else if (style === 'glow') {
        g.lineStyle(w * 2.2, color, a * 0.25);
        g.lineBetween(ax, ay, bx, by);
        g.lineStyle(w * 0.7, 0xffffff, a * 0.8);
        g.lineBetween(ax, ay, bx, by);
      } else {
        g.lineStyle(w, color, a);
        g.lineBetween(ax, ay, bx, by);
        g.fillStyle(color, a);
        g.fillCircle(bx, by, w / 2);
      }
      if (!reduced && style === 'dust') {
        // Curl the dust at the end of the stroke.
        const nx = -(by - ay);
        const ny = bx - ax;
        g.lineStyle(2, color, a * 0.6);
        g.lineBetween(bx, by, bx + nx * 0.3, by + ny * 0.3);
      }
    });
  }

  private spawnWisps(dt: number): void {
    if (!this.wind.isStroking || GameContext.reducedMotion) return;
    this.wispTimer -= dt;
    if (this.wispTimer > 0) return;
    this.wispTimer = GameContext.profile.lowEnd ? 0.07 : 0.035;
    // Newest segment of the current stroke.
    const seg = this.newestSegment;
    seg.found = false;
    this.wind.forEachSegment(this.session.elapsed, (sax, say, sbx, sby, life) => {
      if (life > 0.9) {
        seg.found = true;
        seg.ax = sax;
        seg.ay = say;
        seg.bx = sbx;
        seg.by = sby;
      }
    });
    if (!seg.found) return;
    const { ax, ay, bx, by } = seg;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const vx = (dx / len) * 260;
    const vy = (dy / len) * 260;
    const x = bx + this.rng.range(-20, 20);
    const y = by + this.rng.range(-20, 20);
    const { style, colors } = this.material.visual.trail;
    switch (style) {
      case 'streak': {
        const frame = this.atlas.frames[this.rng.int(0, this.atlas.frames.length - 1)][this.rng.int(0, this.atlas.rotationSteps - 1)];
        this.fx.spawn(this.atlas.key, frame.name, x, y, { vx, vy, life: 0.7, scale: 0.8 / this.scale, spin: this.rng.range(-8, 8), alpha: 0.9 });
        break;
      }
      case 'ribbon':
        this.fx.spawn(FX.spark, undefined, x, y, { vx, vy, life: 0.5, scale: 0.22, scaleTo: 0.05, tint: this.rng.pick(colors), spin: 6 });
        break;
      case 'glow':
        this.fx.spawn(FX.soft, undefined, x, y, { vx: vx * 0.5, vy: vy * 0.5, life: 0.8, scale: 0.4, scaleTo: 0.1, tint: colors[0], additive: true });
        break;
      case 'current':
        this.fx.spawn(FX.ring, undefined, x, y, { vx, vy: vy - 60, life: 0.8, scale: 0.12, scaleTo: 0.2, alpha: 0.7 });
        break;
      default:
        this.fx.spawn(FX.soft, undefined, x, y, { vx, vy, life: 0.6, scale: 0.5, scaleTo: 1.1, tint: colors[0], alpha: 0.45 });
    }
  }

  private drawHint(dt: number): void {
    const g = this.hintGraphics;
    g.clear();
    if (!this.hint) return;
    this.hint.age += dt;
    const { plan, age } = this.hint;
    if (age > 3.2) {
      this.hint = null;
      return;
    }
    const fade = Math.min(1, age * 4) * Math.min(1, (3.2 - age) * 2);
    const { x1, y1, x2, y2 } = plan;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Dashed path.
    g.lineStyle(8, 0xffffff, 0.85 * fade);
    for (let d = 0; d < len - 30; d += 34) {
      g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * Math.min(d + 20, len - 30), y1 + uy * Math.min(d + 20, len - 30));
    }
    g.fillStyle(0xffffff, 0.95 * fade);
    g.fillTriangle(x2, y2, x2 - ux * 36 - uy * 22, y2 - uy * 36 + ux * 22, x2 - ux * 36 + uy * 22, y2 - uy * 36 - ux * 22);
    // A "finger" dot travelling along the path.
    const travel = ((age * 0.9) % 1) * len;
    g.fillStyle(0x24324a, 0.35 * fade);
    g.fillCircle(x1 + ux * travel, y1 + uy * travel + 4, 22);
    g.fillStyle(0xffffff, fade);
    g.fillCircle(x1 + ux * travel, y1 + uy * travel, 20);
    g.lineStyle(4, 0x24324a, 0.7 * fade);
    g.strokeCircle(x1 + ux * travel, y1 + uy * travel, 20);
  }

  private onParticleLost(x: number, y: number): void {
    AudioManager.splash();
    if (GameContext.reducedMotion) return;
    for (let i = 0; i < 3; i++) {
      this.fx.spawn(FX.dot, undefined, x, y, {
        vx: this.rng.range(-80, 80),
        vy: this.rng.range(-220, -120),
        life: 0.5,
        scale: 0.6,
        scaleTo: 0.2,
        tint: 0xd6f4ff,
        drag: 0.5,
      });
    }
    this.fx.spawn(FX.ring, undefined, x, y, { life: 0.5, scale: 0.2, scaleTo: 0.9, alpha: 0.7 });
  }

  // ------------------------------------------------------------------ celebration

  /** Success animation: particles lock into the sculpture, which glows and sparkles. */
  celebrate(): void {
    this.celebrating = true;
    this.celebrateTime = 0;
    this.inputEnabled = false;
    this.hint = null;
    this.system.holdScale = 3;
    this.scene.tweens.add({ targets: this.silhouette, alpha: 0.6, duration: 600 });
  }

  private spawnCelebrationSparkles(dt: number): void {
    if (this.celebrateTime > 2.4 || GameContext.reducedMotion) return;
    const count = Math.round(dt * (GameContext.profile.lowEnd ? 40 : 80));
    const particles = this.system.particles;
    for (let n = 0; n < count; n++) {
      const p = particles[this.rng.int(0, particles.length - 1)];
      if (!p.active || !p.inside) continue;
      this.fx.spawn(FX.spark, undefined, p.x, p.y, {
        vy: -30,
        life: 0.7,
        scale: this.rng.range(0.25, 0.45),
        scaleTo: 0,
        spin: 3,
        tint: this.rng.pick([0xffffff, 0xfff1a8, 0xffd36b]),
        additive: true,
      });
    }
  }

  /** Bounds of the target (with motion offset) for framing the result camera. */
  targetBounds(): Phaser.Geom.Rectangle {
    const { minX, minY, maxX, maxY } = this.level.mask.bounds;
    const o = this.session.targetOffset;
    return new Phaser.Geom.Rectangle(minX + o.x, minY + o.y, maxX - minX, maxY - minY);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const [event, handler] of this.handlers) this.scene.input.off(event, handler);
    AudioManager.stopAmbience();
    this.container.destroy(true);
    // Per-level textures would otherwise accumulate across levels.
    for (const key of [this.atlas.key, this.silhouetteInfo.key]) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }
}
