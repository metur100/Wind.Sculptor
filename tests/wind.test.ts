import { describe, expect, it } from 'vitest';

import { DEFAULT_WIND, SWIPE_COUNT_MIN_LENGTH, WindField } from '../src/game/particles/WindField';

const out = new Float64Array(2);

/** A straight horizontal swipe along y = 500 from x = 100 to x = 500 at 1000 px/s. */
function swipe(wind: WindField, startTime = 0): void {
  wind.beginStroke(100, 500, startTime);
  for (let i = 1; i <= 20; i++) wind.moveStroke(100 + i * 20, 500, startTime + i * 0.02);
  wind.endStroke();
}

describe('WindField – force calculation', () => {
  it('blows in the direction of the swipe', () => {
    const wind = new WindField();
    swipe(wind);
    const magnitude = wind.sample(300, 500, 0.41, out);
    expect(magnitude).toBeGreaterThan(0);
    expect(out[0]).toBeGreaterThan(0);
    expect(Math.abs(out[1])).toBeLessThan(1e-6);
  });

  it('is stronger for faster swipes', () => {
    const slow = new WindField();
    slow.addSegment(100, 500, 140, 500, 300, 0);
    const fast = new WindField();
    fast.addSegment(100, 500, 140, 500, 1500, 0);
    expect(fast.sample(120, 500, 0.05, out)).toBeGreaterThan(slow.sample(120, 500, 0.05, out));
  });

  it('decays over time and disappears after its life', () => {
    const wind = new WindField();
    wind.addSegment(100, 500, 200, 500, 1000, 0);
    const early = wind.sample(150, 500, 0.01, out);
    const late = wind.sample(150, 500, DEFAULT_WIND.life * 0.8, out);
    expect(late).toBeLessThan(early);
    expect(wind.sample(150, 500, DEFAULT_WIND.life + 0.01, out)).toBe(0);
  });

  it('does not depend on how finely the swipe was sampled', () => {
    const coarse = new WindField();
    coarse.addSegment(100, 500, 200, 500, 1000, 0);
    const fine = new WindField();
    for (let x = 100; x < 200; x += 10) fine.addSegment(x, 500, x + 10, 500, 1000, 0);
    const a = coarse.sample(150, 530, 0.05, out);
    const b = fine.sample(150, 530, 0.05, out);
    expect(Math.abs(a - b) / a).toBeLessThan(0.15);
  });

  it('pulls particles beside the swipe towards its line (channel)', () => {
    const wind = new WindField();
    wind.addSegment(100, 500, 300, 500, 1000, 0);
    wind.sample(200, 560, 0.02, out);
    expect(out[1]).toBeLessThan(0); // particle below the line is pulled up towards it
  });

  it('produces no wind when disabled', () => {
    const wind = new WindField();
    swipe(wind);
    wind.enabled = false;
    expect(wind.sample(300, 500, 0.4, out)).toBe(0);
  });

  it('counts only real swipes', () => {
    const wind = new WindField();
    wind.beginStroke(0, 0, 0);
    wind.moveStroke(SWIPE_COUNT_MIN_LENGTH / 2, 0, 0.05);
    expect(wind.endStroke()).toBe(false);
    swipe(wind, 1);
    expect(wind.swipes).toBe(1);
  });

  it('spends and regenerates limited energy', () => {
    const wind = new WindField();
    wind.setEnergy({ max: 10, regen: 5, costPerPx: 0.05 });
    swipe(wind); // 400 px → 20 energy wanted, only 10 available
    expect(wind.energy).toBe(0);
    wind.update(1);
    expect(wind.energy).toBe(5);
    expect(wind.energyRatio).toBe(0.5);
  });
});

describe('WindField – falloff by distance', () => {
  it('weakens with distance from the swipe and is zero beyond the radius', () => {
    const wind = new WindField();
    wind.addSegment(100, 500, 300, 500, 1000, 0);
    const samples = [0, 30, 60, 90].map((d) => wind.sample(200, 500 + d, 0.02, out));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThan(samples[i - 1]);
    expect(wind.sample(200, 500 + DEFAULT_WIND.radius + 1, 0.02, out)).toBe(0);
    expect(wind.sample(200, 500 - DEFAULT_WIND.radius - 1, 0.02, out)).toBe(0);
  });

  it('follows the documented quadratic falloff', () => {
    const wind = new WindField({ channel: 0 });
    // A single short piece, so the nearest distance is the same along its whole length.
    wind.addSegment(195, 500, 205, 500, 1000, 0);
    const near = wind.sample(200, 500, 0, out);
    const half = wind.sample(200, 500 + DEFAULT_WIND.radius / 2, 0, out);
    expect(half / near).toBeCloseTo(0.25, 5);
  });
});
