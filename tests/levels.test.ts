import { describe, expect, it } from 'vitest';

import { LevelSession } from '../src/game/gameplay/LevelSession';
import { LEVELS, LEVELS_PER_WORLD, WORLDS } from '../src/game/levels/LevelData';
import { resolveLevel } from '../src/game/levels/LevelManager';
import { ParticleSystem } from '../src/game/particles/ParticleSystem';
import { WindField } from '../src/game/particles/WindField';
import { generateDailyLevel } from '../src/game/progression/DailyChallenge';
import { TARGET_SHAPES } from '../src/game/targets/TargetShapes';

const viewport = { width: 720, height: 1280, playTop: 150, playBottom: 1156 };

describe('Level data', () => {
  it('has 30 levels in 6 worlds of 5', () => {
    expect(LEVELS).toHaveLength(30);
    expect(WORLDS).toHaveLength(6);
    LEVELS.forEach((level, i) => {
      expect(level.index).toBe(i);
      expect(level.world).toBe(Math.floor(i / LEVELS_PER_WORLD));
      expect(level.material).toBe(WORLDS[level.world].material);
    });
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(30);
  });

  it('uses known shapes and sane goals', () => {
    for (const level of LEVELS) {
      for (const t of level.targets) expect(TARGET_SHAPES[t.shape], `${level.id} ${t.shape}`).toBeDefined();
      expect(level.goals.one).toBeLessThan(level.goals.two);
      expect(level.goals.two).toBeLessThan(level.goals.three);
      expect(level.goals.three).toBeLessThan(1);
    }
  });

  it('every level resolves with a sensible particle count and keeps targets on screen', () => {
    for (const level of LEVELS) {
      const resolved = resolveLevel(level, viewport, { maxParticles: 900 });
      expect(resolved.particleCount, level.id).toBeGreaterThanOrEqual(150);
      expect(resolved.particleCount, level.id).toBeLessThanOrEqual(900);
      const b = resolved.mask.bounds;
      const dx = level.motion?.dx ?? 0;
      expect(b.minX - dx, level.id).toBeGreaterThanOrEqual(0);
      expect(b.maxX + dx, level.id).toBeLessThanOrEqual(720);
      expect(b.minY, level.id).toBeGreaterThan(viewport.playTop);
      expect(b.maxY, level.id).toBeLessThan(viewport.playBottom);
    }
  });

  it('caps particles on weaker devices by spacing them further apart', () => {
    const big = LEVELS[29];
    const full = resolveLevel(big, viewport, { maxParticles: 900 });
    const low = resolveLevel(big, viewport, { maxParticles: 400 });
    expect(low.particleCount).toBeLessThanOrEqual(400);
    expect(low.spacing).toBeGreaterThan(full.spacing);
  });

  it('daily levels are valid', () => {
    for (let d = 1; d <= 28; d++) {
      const level = generateDailyLevel(`2027-02-${String(d).padStart(2, '0')}`);
      const resolved = resolveLevel(level, viewport, { maxParticles: 900 });
      expect(resolved.mask.area).toBeGreaterThan(10000);
    }
  });
});

describe('LevelSession', () => {
  it('starts with nothing in the target and ends with a timeout', () => {
    const resolved = resolveLevel(LEVELS[0], viewport, { maxParticles: 900 });
    const session = new LevelSession(resolved, new ParticleSystem(900), new WindField());
    expect(session.match).toBeLessThan(0.05);
    for (let i = 0; i < LEVELS[0].time * 60 + 5 && session.state === 'playing'; i++) session.step(1 / 60);
    expect(session.state).toBe('done');
    expect(session.result?.reason).toBe('timeout');
    expect(session.result?.success).toBe(false);
    expect(session.result?.failReason).toBeDefined();
  });

  it('allows keeping on sculpting once after a timeout', () => {
    const resolved = resolveLevel(LEVELS[0], viewport, { maxParticles: 900 });
    const session = new LevelSession(resolved, new ParticleSystem(900), new WindField());
    session.elapsed = session.timeLimit;
    session.step(1 / 60);
    expect(session.continueRun()).toBe(true);
    expect(session.state).toBe('playing');
    expect(session.timeLeft).toBeGreaterThan(19);
    session.finish('timeout');
    expect(session.continueRun()).toBe(false);
  });
});
