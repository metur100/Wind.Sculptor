import { targetMotionOffset, type ResolvedLevel } from '../levels/LevelManager';
import { getMaterial } from '../particles/ParticleMaterial';
import type { ParticleSystem } from '../particles/ParticleSystem';
import type { WindField } from '../particles/WindField';
import {
  calculateScore,
  matchOf,
  measureSculpture,
  starsFor,
  type ScoreBreakdown,
  type SculptureMeasure,
} from '../targets/ScoreCalculator';

export type FinishReason = 'perfect' | 'finished' | 'timeout';
export type SessionState = 'playing' | 'done';

export interface LevelResult {
  levelId: string;
  success: boolean;
  stars: 0 | 1 | 2 | 3;
  reason: FinishReason;
  breakdown: ScoreBreakdown;
  measure: SculptureMeasure;
  timeLeft: number;
  timeLimit: number;
  swipes: number;
  /** Human readable explanation shown on the failure screen. */
  failReason?: string;
}

/** Seconds of "perfect" match needed before the level completes on its own. */
export const PERFECT_HOLD = 1.2;
/** Seconds between live measurements. */
const MEASURE_INTERVAL = 0.15;
/** Extra seconds granted by "Keep sculpting" after a timeout. */
export const CONTINUE_SECONDS = 20;

/**
 * Engine-independent level rules: timer, live match, auto-complete, finishing and scoring.
 * The Phaser scenes, the tutorial and the headless level verifier all drive the same session.
 */
export class LevelSession {
  state: SessionState = 'playing';
  elapsed = 0;
  timeLimit: number;
  match = 0;
  measure: SculptureMeasure = { coverage: 0, inside: 0, meanDistance: 0, lost: 0, total: 0 };
  result: LevelResult | null = null;
  continuesUsed = 0;
  /** Set to false for the tutorial (no clock). */
  timed = true;
  /** Complete automatically once the three-star match is held (off in the tutorial). */
  autoComplete = true;
  private perfectHold = 0;
  private measureTimer = 0;
  private readonly motion = { x: 0, y: 0 };

  constructor(
    readonly level: ResolvedLevel,
    readonly system: ParticleSystem,
    readonly wind: WindField,
  ) {
    this.timeLimit = level.def.time;
    system.configure(getMaterial(level.def.material), level.env, level.spacing, level.mask);
    system.spawn(level.spawn, level.particleCount, level.seed);
    wind.clear();
    wind.swipes = 0;
    wind.enabled = true;
    wind.setEnergy(level.def.energy ?? null);
    this.remeasure();
  }

  get timeLeft(): number {
    return Math.max(0, this.timeLimit - this.elapsed);
  }

  get goals() {
    return this.level.def.goals;
  }

  /** Current motion offset of a moving target. */
  get targetOffset(): Readonly<{ x: number; y: number }> {
    return this.motion;
  }

  /** One fixed simulation step. */
  step(dt: number): void {
    if (this.state === 'playing') {
      this.elapsed += dt;
      this.wind.update(dt);
    }
    targetMotionOffset(this.level.def, this.elapsed, this.motion);
    this.level.mask.offsetX = this.motion.x;
    this.level.mask.offsetY = this.motion.y;
    this.system.step(dt, this.elapsed, this.state === 'playing' ? this.wind : null);
    if (this.state !== 'playing') return;

    this.measureTimer += dt;
    if (this.measureTimer >= MEASURE_INTERVAL) {
      this.measureTimer = 0;
      this.remeasure();
      if (this.autoComplete && this.match >= this.goals.three) {
        this.perfectHold += MEASURE_INTERVAL;
        if (this.perfectHold >= PERFECT_HOLD) this.finish('perfect');
      } else {
        this.perfectHold = 0;
      }
    }
    if (this.timed && this.state === 'playing' && this.elapsed >= this.timeLimit) this.finish('timeout');
  }

  remeasure(): void {
    this.measure = measureSculpture(this.level.mask, this.system.particles, this.system.total, this.level.spacing);
    this.match = matchOf(this.measure);
  }

  /** Has the sculpture reached the one-star goal? */
  get canSucceed(): boolean {
    return this.match >= this.goals.one;
  }

  finish(reason: FinishReason): LevelResult {
    if (this.result && this.state === 'done') return this.result;
    this.remeasure();
    this.state = 'done';
    this.wind.endStroke();
    this.wind.enabled = false;
    const timeLeft = this.timed ? this.timeLeft : this.timeLimit;
    const breakdown = calculateScore({
      ...this.measure,
      spacing: this.level.spacing,
      timeRemaining: timeLeft,
      timeLimit: this.timeLimit,
      swipes: this.wind.swipes,
      parSwipes: this.level.def.parSwipes,
    });
    const stars = starsFor(breakdown.match, timeLeft / this.timeLimit, this.goals);
    const success = stars > 0;
    let failReason: string | undefined;
    if (!success) {
      const lostShare = this.measure.total ? this.measure.lost / this.measure.total : 0;
      if (lostShare > 0.3) failReason = 'Too many particles slipped away.';
      else if (reason === 'timeout') failReason = 'Time ran out before the sculpture took shape.';
      else failReason = 'The shape is not filled enough yet.';
    }
    this.result = {
      levelId: this.level.def.id,
      success,
      stars,
      reason,
      breakdown,
      measure: this.measure,
      timeLeft,
      timeLimit: this.timeLimit,
      swipes: this.wind.swipes,
      failReason,
    };
    return this.result;
  }

  /** After a timeout: keep sculpting with some extra time (once per attempt). */
  continueRun(): boolean {
    if (this.continuesUsed > 0 || !this.result || this.result.success) return false;
    this.continuesUsed++;
    this.timeLimit = this.elapsed + CONTINUE_SECONDS;
    this.state = 'playing';
    this.result = null;
    this.perfectHold = 0;
    this.wind.enabled = true;
    return true;
  }
}
