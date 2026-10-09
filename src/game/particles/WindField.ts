import { clamp, distSqToSegment } from '../utils/MathUtils';

/**
 * Wind created by the player's swipes.
 *
 * Every pointer move adds a short segment (A→B) to a ring buffer. A segment blows along its own
 * direction for `life` seconds. The force a particle receives from one segment is
 *
 *   strength · speedFactor · falloff(d) · decay(age) · min(segmentLength / radius, 1.5)
 *
 * - falloff(d)  = (1 − d/radius)²  → zero at `radius`, strongest on the swipe line
 * - decay(age)  = (1 − age/life)^1.5
 * - speedFactor = clamp(swipeSpeed / referenceSpeed, minSpeedFactor, maxSpeedFactor)
 * - the segmentLength/radius weight makes the result independent of how often the browser
 *   reports pointer moves: a swipe deposits the same total wind however it is sampled.
 *
 * A small inward "channel" component pulls particles towards the swipe line, so a swipe
 * gathers particles and carries them along – predictable enough for skill-based play.
 */
export interface WindConfig {
  radius: number;
  strength: number;
  life: number;
  referenceSpeed: number;
  minSpeedFactor: number;
  maxSpeedFactor: number;
  /** Fraction of the force turned into the inward channel component. */
  channel: number;
  /** Minimum movement (px) before a new segment is recorded. */
  minSegment: number;
}

export const DEFAULT_WIND: WindConfig = {
  radius: 115,
  strength: 4200,
  life: 0.42,
  referenceSpeed: 950,
  minSpeedFactor: 0.2,
  maxSpeedFactor: 1.7,
  channel: 0.22,
  minSegment: 6,
};

export interface WindEnergy {
  max: number;
  /** Energy regained per second while not swiping. */
  regen: number;
  /** Energy spent per px of swipe. */
  costPerPx: number;
}

const CAPACITY = 192;
/** Longest stored segment (px). */
const MAX_PIECE = 24;
/** A stroke must travel this far to count as a swipe for the efficiency score. */
export const SWIPE_COUNT_MIN_LENGTH = 50;

export class WindField {
  readonly config: WindConfig;
  // Ring buffer of segments (struct-of-arrays, no per-frame allocation).
  private readonly ax = new Float32Array(CAPACITY);
  private readonly ay = new Float32Array(CAPACITY);
  private readonly bx = new Float32Array(CAPACITY);
  private readonly by = new Float32Array(CAPACITY);
  private readonly dx = new Float32Array(CAPACITY);
  private readonly dy = new Float32Array(CAPACITY);
  private readonly len = new Float32Array(CAPACITY);
  private readonly speedFactor = new Float32Array(CAPACITY);
  private readonly born = new Float64Array(CAPACITY);
  private cursor = 0;
  private count = 0;
  private readonly tmp = new Float64Array(1);

  private stroking = false;
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private strokeLength = 0;
  private smoothedSpeed = 0;

  /** Number of completed swipes (strokes longer than SWIPE_COUNT_MIN_LENGTH). */
  swipes = 0;
  /** Strongest swipe speed since it was last reset – used for haptics and audio. */
  peakSpeed = 0;
  energy = Number.POSITIVE_INFINITY;
  energyConfig: WindEnergy | null = null;
  /** When false no new wind is created and existing wind stops acting (pause / level end). */
  enabled = true;

  constructor(config: Partial<WindConfig> = {}) {
    this.config = { ...DEFAULT_WIND, ...config };
  }

  setEnergy(config: WindEnergy | null): void {
    this.energyConfig = config;
    this.energy = config ? config.max : Number.POSITIVE_INFINITY;
  }

  get energyRatio(): number {
    return this.energyConfig ? clamp(this.energy / this.energyConfig.max, 0, 1) : 1;
  }

  get isStroking(): boolean {
    return this.stroking;
  }

  get currentSpeed(): number {
    return this.stroking ? this.smoothedSpeed : 0;
  }

  beginStroke(x: number, y: number, time: number): void {
    this.stroking = true;
    this.lastX = x;
    this.lastY = y;
    this.lastT = time;
    this.strokeLength = 0;
    this.smoothedSpeed = 0;
  }

  /** Adds the movement since the last point as a wind segment. Returns the smoothed speed (px/s). */
  moveStroke(x: number, y: number, time: number): number {
    if (!this.stroking) {
      this.beginStroke(x, y, time);
      return 0;
    }
    const mx = x - this.lastX;
    const my = y - this.lastY;
    const length = Math.hypot(mx, my);
    if (length < this.config.minSegment) return this.smoothedSpeed;
    const dt = Math.max(time - this.lastT, 1 / 240);
    const instant = length / dt;
    this.smoothedSpeed = this.smoothedSpeed === 0 ? instant : this.smoothedSpeed * 0.55 + instant * 0.45;
    this.strokeLength += length;

    let power = 1;
    if (this.energyConfig && this.enabled) {
      const cost = length * this.energyConfig.costPerPx;
      if (this.energy <= 0) power = 0;
      else if (this.energy < cost) power = this.energy / cost;
      this.energy = Math.max(0, this.energy - cost);
    }
    if (this.enabled && power > 0) {
      this.addSegment(this.lastX, this.lastY, x, y, this.smoothedSpeed, time, power);
      this.peakSpeed = Math.max(this.peakSpeed, this.smoothedSpeed);
    }
    this.lastX = x;
    this.lastY = y;
    this.lastT = time;
    return this.smoothedSpeed;
  }

  /** Ends the current stroke. Returns true when it counted as a swipe. */
  endStroke(): boolean {
    const counted = this.stroking && this.enabled && this.strokeLength >= SWIPE_COUNT_MIN_LENGTH;
    if (counted) this.swipes++;
    this.stroking = false;
    return counted;
  }

  /** Adds a segment directly (keyboard gusts, tutorial, tests). */
  addSegment(ax: number, ay: number, bx: number, by: number, speed: number, time: number, power = 1): void {
    const length = Math.hypot(bx - ax, by - ay);
    if (length <= 0) return;
    // Long segments are split so the falloff is integrated along the swipe instead of using a
    // single nearest distance for the whole length.
    if (length > MAX_PIECE) {
      const pieces = Math.ceil(length / MAX_PIECE);
      for (let p = 0; p < pieces; p++) {
        const t0 = p / pieces;
        const t1 = (p + 1) / pieces;
        this.addSegment(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, speed, time, power);
      }
      return;
    }
    const i = this.cursor;
    this.ax[i] = ax;
    this.ay[i] = ay;
    this.bx[i] = bx;
    this.by[i] = by;
    this.dx[i] = (bx - ax) / length;
    this.dy[i] = (by - ay) / length;
    this.len[i] = length;
    const { referenceSpeed, minSpeedFactor, maxSpeedFactor } = this.config;
    this.speedFactor[i] = clamp(speed / referenceSpeed, minSpeedFactor, maxSpeedFactor) * power;
    this.born[i] = time;
    this.cursor = (i + 1) % CAPACITY;
    this.count = Math.min(this.count + 1, CAPACITY);
  }

  update(dt: number): void {
    if (this.energyConfig && !this.stroking) {
      this.energy = Math.min(this.energyConfig.max, this.energy + this.energyConfig.regen * dt);
    }
  }

  clear(): void {
    this.count = 0;
    this.cursor = 0;
    this.stroking = false;
  }

  /** Number of segments still blowing at `time`. */
  activeSegments(time: number): number {
    let n = 0;
    for (let k = 0; k < this.count; k++) if (time - this.born[k] < this.config.life) n++;
    return n;
  }

  /**
   * Wind acceleration at (px, py). Writes into out[0], out[1] and returns the magnitude.
   * `out` is caller-owned so the hot loop never allocates.
   */
  sample(px: number, py: number, time: number, out: Float64Array | number[]): number {
    out[0] = 0;
    out[1] = 0;
    if (!this.enabled) return 0;
    const { radius, strength, life, channel } = this.config;
    const r2 = radius * radius;
    for (let k = 0; k < this.count; k++) {
      const age = time - this.born[k];
      if (age >= life || age < 0) continue;
      const ax = this.ax[k];
      const ay = this.ay[k];
      const bx = this.bx[k];
      const by = this.by[k];
      // Cheap bounding-box rejection before the exact segment distance.
      if (px < (ax < bx ? ax : bx) - radius || px > (ax > bx ? ax : bx) + radius) continue;
      if (py < (ay < by ? ay : by) - radius || py > (ay > by ? ay : by) + radius) continue;
      const d2 = distSqToSegment(px, py, ax, ay, bx, by, this.tmp);
      if (d2 >= r2) continue;
      const d = Math.sqrt(d2);
      const near = 1 - d / radius;
      const decay = Math.pow(1 - age / life, 1.5);
      const weight = Math.min(this.len[k] / radius, 1.5);
      const magnitude = strength * this.speedFactor[k] * near * near * decay * weight;
      out[0] += this.dx[k] * magnitude;
      out[1] += this.dy[k] * magnitude;
      if (d > 1) {
        // Channel: pull towards the closest point on the swipe line.
        const t = this.tmp[0];
        const cx = ax + (bx - ax) * t;
        const cy = ay + (by - ay) * t;
        const pull = magnitude * channel * (d / radius);
        out[0] += ((cx - px) / d) * pull;
        out[1] += ((cy - py) / d) * pull;
      }
    }
    return Math.hypot(out[0], out[1]);
  }

  /** Iterates live segments for rendering the wind trail. */
  forEachSegment(
    time: number,
    fn: (ax: number, ay: number, bx: number, by: number, life01: number, speed01: number) => void,
  ): void {
    const { life, maxSpeedFactor } = this.config;
    for (let k = 0; k < this.count; k++) {
      const age = time - this.born[k];
      if (age >= life || age < 0) continue;
      fn(this.ax[k], this.ay[k], this.bx[k], this.by[k], 1 - age / life, this.speedFactor[k] / maxSpeedFactor);
    }
  }
}
