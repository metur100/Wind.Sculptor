import { describe, expect, it } from 'vitest';

import { MATERIALS } from '../src/game/particles/ParticleMaterial';
import { ParticleSystem, type SimEnvironment } from '../src/game/particles/ParticleSystem';
import { WindField } from '../src/game/particles/WindField';

const env = (overrides: Partial<SimEnvironment> = {}): SimEnvironment => ({
  bounds: { left: 0, top: 100, right: 720, bottom: 1200 },
  walls: [],
  fans: [],
  sinks: [],
  breezeX: 0,
  breezeY: 0,
  gust: 0,
  ...overrides,
});

function run(system: ParticleSystem, seconds: number, wind: WindField | null = null, start = 0): void {
  for (let t = 0; t < seconds; t += 1 / 60) system.step(1 / 60, start + t, wind);
}

describe('ParticleSystem – boundaries', () => {
  it('keeps every particle inside the play area, even when blasted at a wall', () => {
    const system = new ParticleSystem(200);
    system.configure(MATERIALS.confetti, env(), 16, null);
    system.spawn({ kind: 'scatter' }, 200, 1);
    for (const p of system.particles) p.vx = 5000;
    run(system, 2);
    for (const p of system.particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(720);
      expect(p.y).toBeGreaterThanOrEqual(100);
      expect(p.y).toBeLessThanOrEqual(1200);
    }
  });

  it('does not let particles stay glued to the side walls', () => {
    const system = new ParticleSystem(1);
    system.configure(MATERIALS.fireflies, env(), 16, null);
    system.spawn({ kind: 'scatter' }, 1, 3);
    const p = system.particles[0];
    p.x = 1;
    p.y = 600;
    run(system, 1.5);
    expect(p.x).toBeGreaterThan(10);
  });

  it('bounces off walls instead of passing through', () => {
    const system = new ParticleSystem(1);
    const wall = { x: 300, y: 500, w: 200, h: 30 };
    system.configure(MATERIALS.sand, env({ walls: [wall] }), 16, null);
    system.spawn({ kind: 'scatter' }, 1, 2);
    const p = system.particles[0];
    p.x = 400;
    p.y = 450;
    p.vx = 0;
    p.vy = 600;
    run(system, 1);
    expect(p.y).toBeLessThan(wall.y);
  });

  it('caps particle speed', () => {
    const system = new ParticleSystem(1);
    system.configure(MATERIALS.leaves, env(), 16, null);
    system.spawn({ kind: 'scatter' }, 1, 2);
    const p = system.particles[0];
    p.x = 360;
    p.y = 600;
    p.vx = 99999;
    system.step(1 / 60, 0, null);
    expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(MATERIALS.leaves.physics.maxSpeed + 1e-6);
  });

  it('lets sinks swallow particles and counts them as lost', () => {
    const system = new ParticleSystem(1);
    system.configure(MATERIALS.sand, env({ sinks: [{ x: 360, y: 1150, rx: 100, ry: 40 }] }), 16, null);
    system.spawn({ kind: 'scatter' }, 1, 2);
    const p = system.particles[0];
    p.x = 360;
    p.y = 1000;
    run(system, 2);
    expect(p.active).toBe(false);
    expect(p.lost).toBe(true);
    expect(system.lostCount).toBe(1);
  });

  it('moves particles with the wind', () => {
    const system = new ParticleSystem(1);
    system.configure(MATERIALS.fireflies, env(), 16, null);
    system.spawn({ kind: 'scatter' }, 1, 2);
    const p = system.particles[0];
    p.x = 200;
    p.y = 600;
    const wind = new WindField();
    wind.addSegment(150, 600, 400, 600, 1400, 0);
    run(system, 0.4, wind);
    expect(p.x).toBeGreaterThan(260);
  });

  it('spawns deterministically for the same seed', () => {
    const a = new ParticleSystem(50);
    const b = new ParticleSystem(50);
    a.configure(MATERIALS.sand, env(), 16, null);
    b.configure(MATERIALS.sand, env(), 16, null);
    a.spawn({ kind: 'pile', from: 0, to: 1 }, 50, 77);
    b.spawn({ kind: 'pile', from: 0, to: 1 }, 50, 77);
    expect(a.particles.map((p) => [p.x, p.y])).toEqual(b.particles.map((p) => [p.x, p.y]));
  });
});
