import { clamp01 } from '../utils/MathUtils';
import type { TargetMask } from './TargetMask';

/**
 * Scoring
 * =======
 *
 * Measurements (all 0..1 unless noted):
 * - coverage      share of the target's coverage cells that contain at least one particle
 *                 (a cell counts when a particle lies within 0.75 · cell of its centre)
 * - inside        share of ALL particles (including lost ones) that sit inside the target
 * - meanDistance  average distance (px) of particles outside the target to its edge; lost particles
 *                 count with the maximum penalty distance
 *
 * Live "Match" shown in the HUD and used for winning / stars:
 *   match = 0.75 · coverage + 0.25 · inside
 *
 * Final score (0..1000):
 *   accuracy   = 0.6 · inside + 0.4 · (1 − min(meanDistance / (8 · spacing), 1))
 *   time       = timeRemaining / timeLimit
 *   efficiency = 1 − min(unnecessarySwipes / (1.5 · parSwipes), 1), unnecessary = max(0, swipes − parSwipes)
 *   score      = round(1000 · (0.60 · coverage + 0.25 · accuracy + 0.10 · time + 0.05 · efficiency))
 *
 * Stars:
 *   ★     match ≥ goal.one      (the level is complete)
 *   ★★    match ≥ goal.two
 *   ★★★   match ≥ goal.three and at least THREE_STAR_TIME of the time left
 */

export const SCORE_WEIGHTS = { coverage: 0.6, accuracy: 0.25, time: 0.1, efficiency: 0.05 } as const;
export const MATCH_WEIGHTS = { coverage: 0.75, inside: 0.25 } as const;
/** Fraction of the time limit that must remain for three stars. */
export const THREE_STAR_TIME = 0.2;
/** Distance (in particle spacings) at which an outside particle stops contributing to accuracy. */
export const DISTANCE_PENALTY_SPACINGS = 8;

export interface StarGoals {
  one: number;
  two: number;
  three: number;
}

export interface SculptureMeasure {
  coverage: number;
  inside: number;
  meanDistance: number;
  lost: number;
  total: number;
}

export interface ScoreInput extends SculptureMeasure {
  spacing: number;
  timeRemaining: number;
  timeLimit: number;
  swipes: number;
  parSwipes: number;
}

export interface ScoreBreakdown {
  coverage: number;
  accuracy: number;
  time: number;
  efficiency: number;
  match: number;
  /** 0..1000 */
  score: number;
}

/** Anything with a position that can be active or lost – the pooled Particle satisfies this. */
export interface MeasurableParticle {
  x: number;
  y: number;
  active: boolean;
  lost: boolean;
}

/**
 * Measures how well the particles form the target. `particles` may contain inactive pool entries;
 * `total` is the number of particles the level started with.
 */
export function measureSculpture(
  mask: TargetMask,
  particles: readonly MeasurableParticle[],
  total: number,
  spacing: number,
): SculptureMeasure {
  const cell = mask.coverageCell;
  if (cell <= 0) throw new Error('measureSculpture: call mask.buildCoverage() first');
  const cols = mask.coverageCols;
  const rows = mask.coverageRows;
  const stamp = mask.coverageStamp;
  // A fresh stamp marks the cells covered in this measurement, so the array never needs clearing.
  const id = nextStamp(mask);
  const reach2 = (cell * 0.75) ** 2;
  const maxDistance = spacing * DISTANCE_PENALTY_SPACINGS;
  let covered = 0;
  let inside = 0;
  let lost = 0;
  let distanceSum = 0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.lost) {
      lost++;
      distanceSum += maxDistance;
      continue;
    }
    if (!p.active) continue;
    const sd = mask.signedDistance(p.x, p.y);
    if (sd < 0) inside++;
    else distanceSum += Math.min(sd, maxDistance);

    const lx = p.x - mask.offsetX;
    const ly = p.y - mask.offsetY;
    const cx = Math.floor(lx / cell);
    const cy = Math.floor(ly / cell);
    for (let oy = -1; oy <= 1; oy++) {
      const r = cy + oy;
      if (r < 0 || r >= rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const c = cx + ox;
        if (c < 0 || c >= cols) continue;
        const k = r * cols + c;
        if (!mask.coverageTarget[k] || stamp[k] === id) continue;
        const dx = (c + 0.5) * cell - lx;
        const dy = (r + 0.5) * cell - ly;
        if (dx * dx + dy * dy <= reach2) {
          stamp[k] = id;
          covered++;
        }
      }
    }
  }

  const count = Math.max(total, 1);
  return {
    coverage: mask.coverageTargetCount ? covered / mask.coverageTargetCount : 0,
    inside: inside / count,
    meanDistance: distanceSum / count,
    lost,
    total,
  };
}

function nextStamp(mask: TargetMask): number {
  let id = mask.coverageStampId + 1;
  if (id >= 0xffffffff) {
    mask.coverageStamp.fill(0);
    id = 1;
  }
  mask.coverageStampId = id;
  return id;
}

/** The live percentage shown in the HUD and used to decide success. */
export function matchOf(measure: Pick<SculptureMeasure, 'coverage' | 'inside'>): number {
  return clamp01(MATCH_WEIGHTS.coverage * measure.coverage + MATCH_WEIGHTS.inside * measure.inside);
}

export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const distanceScore = 1 - clamp01(input.meanDistance / (input.spacing * DISTANCE_PENALTY_SPACINGS));
  const accuracy = clamp01(0.6 * input.inside + 0.4 * distanceScore);
  const time = input.timeLimit > 0 ? clamp01(input.timeRemaining / input.timeLimit) : 0;
  const par = Math.max(1, input.parSwipes);
  const unnecessary = Math.max(0, input.swipes - par);
  const efficiency = 1 - clamp01(unnecessary / (1.5 * par));
  const coverage = clamp01(input.coverage);
  const weighted =
    SCORE_WEIGHTS.coverage * coverage + SCORE_WEIGHTS.accuracy * accuracy + SCORE_WEIGHTS.time * time + SCORE_WEIGHTS.efficiency * efficiency;
  return { coverage, accuracy, time, efficiency, match: matchOf(input), score: Math.round(1000 * weighted) };
}

/** 0–3 stars. See the table at the top of this file. */
export function starsFor(match: number, timeRatio: number, goals: StarGoals): 0 | 1 | 2 | 3 {
  if (match < goals.one) return 0;
  if (match >= goals.three && timeRatio >= THREE_STAR_TIME) return 3;
  if (match >= goals.two) return 2;
  return 1;
}
