/**
 * A single pooled particle. Instances are allocated once by the ParticleSystem and recycled,
 * so nothing is created or garbage-collected while a level is running.
 */
export class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  angle = 0;
  /** Spin direction (+1 / -1). */
  spinDir = 1;
  /** Index into the material's colour variants. */
  variant = 0;
  /** Random phase (0..1) used for turbulence and flicker so particles do not move in lockstep. */
  phase = 0;
  active = false;
  /** Swallowed by a sink (pond / drain); counts against accuracy. */
  lost = false;
  /** True while the particle is inside the target mask (updated every step). */
  inside = false;
  /** Signed distance to the target edge from the last step (negative = inside). */
  targetDistance = Number.POSITIVE_INFINITY;

  reset(x: number, y: number, variant: number, phase: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = phase * Math.PI * 2;
    this.spinDir = phase > 0.5 ? 1 : -1;
    this.variant = variant;
    this.phase = phase;
    this.active = true;
    this.lost = false;
    this.inside = false;
    this.targetDistance = Number.POSITIVE_INFINITY;
  }
}
