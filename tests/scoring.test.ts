import { describe, expect, it } from 'vitest';

import {
  calculateScore,
  matchOf,
  measureSculpture,
  starsFor,
  THREE_STAR_TIME,
  type MeasurableParticle,
} from '../src/game/targets/ScoreCalculator';
import { TargetMask } from '../src/game/targets/TargetMask';
import { placementsContain, shapeContains, getShape } from '../src/game/targets/TargetShapes';

const W = 720;
const H = 1280;
const SPACING = 16;

function circleMask(): TargetMask {
  // Circle of radius 46 units × 3 px = 138 px centred at (360, 600).
  const mask = new TargetMask([{ shape: 'circle', x: 360, y: 600, size: 3 }], W, H);
  mask.buildCoverage(SPACING * 1.3);
  return mask;
}

/** Particles on a grid covering the circle completely. */
function fillCircle(mask: TargetMask): MeasurableParticle[] {
  const out: MeasurableParticle[] = [];
  for (let y = 440; y <= 760; y += SPACING) {
    for (let x = 200; x <= 520; x += SPACING) {
      if (mask.contains(x, y)) out.push({ x, y, active: true, lost: false });
    }
  }
  return out;
}

describe('Target shapes and mask', () => {
  it('supports unions and cut-outs', () => {
    const moon = getShape('moon');
    expect(shapeContains(moon, 20, 50)).toBe(true); // lit side
    expect(shapeContains(moon, 70, 38)).toBe(false); // cut away
    const owl = getShape('owl');
    expect(shapeContains(owl, 37, 44)).toBe(false); // eye hole
    expect(shapeContains(owl, 50, 70)).toBe(true);
  });

  it('places, scales and rotates shapes', () => {
    const placement = { shape: 'triangle', x: 360, y: 600, size: 4 };
    expect(placementsContain([placement], 360, 600)).toBe(true);
    expect(placementsContain([placement], 360, 600 - 45 * 4)).toBe(false); // above the apex
    // Near the right base corner: inside normally, outside once turned upside down.
    expect(placementsContain([placement], 360 + 40 * 4, 600 + 35 * 4)).toBe(true);
    expect(placementsContain([{ ...placement, rotation: Math.PI }], 360 + 40 * 4, 600 + 35 * 4)).toBe(false);
  });

  it('builds a signed distance field (negative inside, growing outside)', () => {
    const mask = circleMask();
    expect(mask.signedDistance(360, 600)).toBeLessThan(-100);
    expect(mask.signedDistance(360, 600 - 138 - 50)).toBeGreaterThan(40);
    expect(mask.signedDistance(360, 600 - 138 - 50)).toBeLessThan(60);
    expect(mask.area).toBeGreaterThan(Math.PI * 138 * 138 * 0.95);
    expect(mask.area).toBeLessThan(Math.PI * 138 * 138 * 1.05);
  });

  it('follows moving targets through its offset', () => {
    const mask = circleMask();
    mask.offsetX = 100;
    expect(mask.contains(460, 600)).toBe(true);
    expect(mask.contains(240, 600)).toBe(false);
  });
});

describe('Coverage calculation', () => {
  it('is 0 with no particles in the target and ~1 when it is filled evenly', () => {
    const mask = circleMask();
    const outside = [{ x: 50, y: 1200, active: true, lost: false }];
    expect(measureSculpture(mask, outside, 1, SPACING).coverage).toBe(0);
    const filled = fillCircle(mask);
    const m = measureSculpture(mask, filled, filled.length, SPACING);
    expect(m.coverage).toBeGreaterThan(0.97);
    expect(m.inside).toBe(1);
  });

  it('counts half a target as roughly half covered', () => {
    const mask = circleMask();
    const left = fillCircle(mask).filter((p) => p.x < 360);
    const m = measureSculpture(mask, left, left.length, SPACING);
    expect(m.coverage).toBeGreaterThan(0.4);
    expect(m.coverage).toBeLessThan(0.6);
  });

  it('does not reward piling every particle into one spot', () => {
    const mask = circleMask();
    const pile = Array.from({ length: 300 }, () => ({ x: 360, y: 600, active: true, lost: false }));
    const m = measureSculpture(mask, pile, 300, SPACING);
    expect(m.inside).toBe(1);
    expect(m.coverage).toBeLessThan(0.05);
  });

  it('treats lost particles as outside with the maximum distance', () => {
    const mask = circleMask();
    const particles = [
      { x: 360, y: 600, active: true, lost: false },
      { x: 0, y: 0, active: false, lost: true },
    ];
    const m = measureSculpture(mask, particles, 2, SPACING);
    expect(m.inside).toBe(0.5);
    expect(m.lost).toBe(1);
    expect(m.meanDistance).toBeCloseTo((SPACING * 8) / 2);
  });
});

describe('Accuracy score calculation', () => {
  const base = { coverage: 1, inside: 1, meanDistance: 0, lost: 0, total: 100, spacing: SPACING, timeRemaining: 50, timeLimit: 100, swipes: 10, parSwipes: 10 };

  it('follows the documented weights', () => {
    const perfect = calculateScore({ ...base, timeRemaining: 100 });
    expect(perfect.score).toBe(1000);
    // Coverage 60 %, accuracy 25 %, time 10 % (half left → 50), efficiency 5 %.
    expect(calculateScore(base).score).toBe(950);
    expect(calculateScore({ ...base, coverage: 0.5 }).score).toBe(650);
  });

  it('accuracy mixes inside share and distance of stray particles', () => {
    const r = calculateScore({ ...base, inside: 0.5, meanDistance: SPACING * 4 });
    expect(r.accuracy).toBeCloseTo(0.6 * 0.5 + 0.4 * 0.5);
  });

  it('penalises unnecessary swipes', () => {
    expect(calculateScore({ ...base, swipes: 10 }).efficiency).toBe(1);
    expect(calculateScore({ ...base, swipes: 25 }).efficiency).toBe(0);
    expect(calculateScore({ ...base, swipes: 17 }).efficiency).toBeCloseTo(1 - 7 / 15);
  });

  it('match is 75 % coverage + 25 % inside', () => {
    expect(matchOf({ coverage: 0.8, inside: 0.4 })).toBeCloseTo(0.7);
  });
});

describe('Star thresholds', () => {
  const goals = { one: 0.6, two: 0.73, three: 0.85 };
  it('awards 0–3 stars by match', () => {
    expect(starsFor(0.59, 1, goals)).toBe(0);
    expect(starsFor(0.6, 1, goals)).toBe(1);
    expect(starsFor(0.73, 1, goals)).toBe(2);
    expect(starsFor(0.9, 1, goals)).toBe(3);
  });

  it('requires time left for three stars', () => {
    expect(starsFor(0.9, THREE_STAR_TIME - 0.01, goals)).toBe(2);
    expect(starsFor(0.9, THREE_STAR_TIME, goals)).toBe(3);
  });
});
