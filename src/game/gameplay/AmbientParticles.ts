import Phaser from 'phaser';

import { GameContext } from '../GameContext';
import { getMaterial, type MaterialId } from '../particles/ParticleMaterial';
import { ParticleSystem } from '../particles/ParticleSystem';
import { WindField } from '../particles/WindField';
import { createParticleAtlas, type ParticleAtlas } from '../rendering/TextureFactory';
import { SIM_STEP } from '../utils/Constants';
import { Rng } from '../utils/MathUtils';

let counter = 0;

/**
 * Decorative particles for menus: drift around, get occasional automatic gusts and react to the
 * player's swipes on empty background – a little taste of the game on every screen.
 */
export class AmbientParticles {
  private readonly system: ParticleSystem;
  private readonly wind = new WindField({ strength: 3000 });
  private readonly blitter: Phaser.GameObjects.Blitter;
  private readonly bobs: Phaser.GameObjects.Bob[] = [];
  private readonly atlas: ParticleAtlas;
  private readonly rng = new Rng(99);
  private readonly scale: number;
  private time = 0;
  private accumulator = 0;
  private nextGust = 1.2;
  private stroking = false;
  private readonly handlers: [string, (...args: never[]) => void][] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    material: MaterialId,
    count: number,
    bounds: { width: number; height: number },
    interactive = true,
  ) {
    const def = getMaterial(material);
    this.scale = GameContext.profile.renderScale;
    const n = GameContext.profile.lowEnd ? Math.round(count * 0.6) : count;
    this.system = new ParticleSystem(n);
    this.system.configure(
      // Lighter gravity so particles hang in the air instead of piling up behind the buttons.
      { ...def, physics: { ...def.physics, gravity: def.physics.gravity * 0.25 } },
      { bounds: { left: 0, top: 0, right: bounds.width, bottom: bounds.height }, walls: [], fans: [], sinks: [], breezeX: 0, breezeY: 0, gust: 0 },
      22,
      null,
    );
    this.system.spawn({ kind: 'scatter' }, n, 42);
    this.atlas = createParticleAtlas(scene, def, 22 * def.visual.sizeFactor * 0.8, this.scale, `ambient-${material}-${counter++}`);
    this.blitter = scene.add.blitter(0, 0, this.atlas.key).setScale(1 / this.scale).setAlpha(0.85);
    if (def.visual.additive) this.blitter.setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < n; i++) this.bobs.push(this.blitter.create(0, 0, this.atlas.frames[0][0]));

    if (interactive) {
      const on = (event: string, handler: (...args: never[]) => void) => {
        scene.input.on(event, handler);
        this.handlers.push([event, handler]);
      };
      const point = (p: Phaser.Input.Pointer) => scene.cameras.main.getWorldPoint(p.x, p.y);
      on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length) return;
        const w = point(p);
        this.stroking = true;
        this.wind.beginStroke(w.x, w.y, this.time);
      });
      on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!this.stroking) return;
        const w = point(p);
        this.wind.moveStroke(w.x, w.y, this.time);
      });
      on('pointerup', () => {
        this.stroking = false;
        this.wind.endStroke();
      });
    }
    scene.events.once('shutdown', () => this.destroy());
  }

  get gameObject(): Phaser.GameObjects.Blitter {
    return this.blitter;
  }

  update(deltaMs: number): void {
    const reduced = GameContext.reducedMotion;
    const dt = Math.min(deltaMs / 1000, 0.1) * (reduced ? 0.35 : 1);
    this.accumulator += dt;
    while (this.accumulator >= SIM_STEP) {
      this.accumulator -= SIM_STEP;
      this.time += SIM_STEP;
      this.system.step(SIM_STEP, this.time, this.wind);
    }
    this.nextGust -= dt;
    if (this.nextGust <= 0 && !reduced) {
      this.nextGust = this.rng.range(2.2, 4);
      const { right, bottom } = this.system.env.bounds;
      const y = this.rng.range(bottom * 0.2, bottom * 0.9);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const x0 = dir > 0 ? -40 : right + 40;
      for (let i = 0; i < 10; i++) {
        const xa = x0 + dir * i * 80;
        const lift = Math.sin(i * 0.6) * 40;
        this.wind.addSegment(xa, y + lift, xa + dir * 80, y + Math.sin((i + 1) * 0.6) * 40, 700, this.time + i * 0.05);
      }
    }
    const k = this.scale;
    const half = this.atlas.cell / 2;
    const steps = this.atlas.rotationSteps;
    this.system.particles.forEach((p, i) => {
      const bob = this.bobs[i];
      if (!bob) return;
      bob.x = p.x * k - half;
      bob.y = p.y * k - half;
      let s = steps > 1 ? Math.floor((p.angle / (Math.PI * 2)) * steps) % steps : 0;
      if (s < 0) s += steps;
      bob.setFrame(this.atlas.frames[p.variant][s]);
    });
  }

  destroy(): void {
    for (const [event, handler] of this.handlers) this.scene.input.off(event, handler);
    this.handlers.length = 0;
    if (this.blitter.active) this.blitter.destroy();
    if (this.scene.textures.exists(this.atlas.key)) this.scene.textures.remove(this.atlas.key);
  }
}
