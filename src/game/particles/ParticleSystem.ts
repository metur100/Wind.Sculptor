import { Rng } from '../utils/MathUtils';
import type { TargetMask } from '../targets/TargetMask';
import { Particle } from './Particle';
import type { ParticleMaterial } from './ParticleMaterial';
import type { WindField } from './WindField';

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Axis-aligned rectangle (top-left + size) in stage pixels. */
export interface RectZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A fan blows constantly inside its rectangle with acceleration (fx, fy). */
export interface FanZone extends RectZone {
  fx: number;
  fy: number;
}

/** A sink (pond, drain) swallows particles that enter its ellipse. */
export interface SinkZone {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface SimEnvironment {
  bounds: Bounds;
  walls: RectZone[];
  fans: FanZone[];
  sinks: SinkZone[];
  /** Constant ambient wind (px/s²) – "wind direction" challenges. */
  breezeX: number;
  breezeY: number;
  /** 0..1 amount the breeze pulses over time. */
  gust: number;
}

export type SpawnArea =
  | { kind: 'pile'; from: number; to: number }
  | { kind: 'ceiling'; from: number; to: number }
  | { kind: 'cloud'; x: number; y: number; rx: number; ry: number }
  | { kind: 'scatter' };

/**
 * Tuning of how the target "catches" particles. Inside the target particles are slowed down, lose
 * most of their gravity and are gently pushed away from the edge, so a sculpture holds its shape
 * until the player blows it apart again.
 */
export const SIM_TUNING = {
  insideDrag: 3.6,
  insideGravity: 0.03,
  insideTurbulence: 0.25,
  insideWind: 0.75,
  containForce: 1150,
  magnetForce: 420,
  repulsion: 1500,
  /** Repulsion radius in multiples of the particle spacing. */
  repulsionRadius: 1.05,
  edgeZone: 22,
  edgeForce: 900,
};

const SPEED_EPSILON = 1e-6;

/**
 * Custom particle simulation (Phaser's emitter has no notion of wind fields or targets).
 * Particles are pooled: `capacity` Particle objects are created once and reused across levels.
 */
export class ParticleSystem {
  readonly particles: Particle[];
  material!: ParticleMaterial;
  env: SimEnvironment = {
    bounds: { left: 0, top: 0, right: 720, bottom: 1280 },
    walls: [],
    fans: [],
    sinks: [],
    breezeX: 0,
    breezeY: 0,
    gust: 0,
  };
  mask: TargetMask | null = null;
  spacing = 16;
  /** Total particles spawned for the current level (active + lost). */
  total = 0;
  lostCount = 0;
  insideCount = 0;
  /** Average speed of active particles after the last step – drives the rustle sound. */
  averageSpeed = 0;
  /** Called when a sink swallows a particle (for splash effects). */
  onLost: ((x: number, y: number) => void) | null = null;
  /** Multiplier for the target's catching forces (raised briefly by the success animation). */
  holdScale = 1;

  private readonly windOut = new Float64Array(2);
  private readonly maskOut = new Float64Array(3);
  // Spatial hash for neighbour repulsion.
  private gridHead = new Int32Array(0);
  private readonly gridNext: Int32Array;
  private gridCols = 0;
  private gridRows = 0;
  private gridCell = 1;
  private readonly fx: Float32Array;
  private readonly fy: Float32Array;

  constructor(readonly capacity: number) {
    this.particles = Array.from({ length: capacity }, () => new Particle());
    this.gridNext = new Int32Array(capacity);
    this.fx = new Float32Array(capacity);
    this.fy = new Float32Array(capacity);
  }

  /** Prepares the system for a level. Deactivates all particles. */
  configure(material: ParticleMaterial, env: SimEnvironment, spacing: number, mask: TargetMask | null): void {
    this.material = material;
    this.env = env;
    this.spacing = spacing;
    this.mask = mask;
    this.total = 0;
    this.lostCount = 0;
    this.insideCount = 0;
    this.holdScale = 1;
    for (const p of this.particles) p.active = false;
    this.gridCell = spacing * SIM_TUNING.repulsionRadius;
    const { left, top, right, bottom } = env.bounds;
    this.gridCols = Math.max(1, Math.ceil((right - left) / this.gridCell) + 1);
    this.gridRows = Math.max(1, Math.ceil((bottom - top) / this.gridCell) + 1);
    if (this.gridHead.length < this.gridCols * this.gridRows) this.gridHead = new Int32Array(this.gridCols * this.gridRows);
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  /** Spawns `count` particles (clamped to capacity) in the given area. Deterministic for a given seed. */
  spawn(area: SpawnArea, count: number, seed: number): number {
    const rng = new Rng(seed);
    const n = Math.min(count, this.capacity);
    const { left, top, right, bottom } = this.env.bounds;
    const variants = this.material.visual.colors.length;
    const pad = this.spacing * 0.6;
    const perRow = Math.max(1, Math.floor((right - left - pad * 2) / (this.spacing * 0.95)));
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (attempt >= 30) {
          // The requested area is crowded by walls / ponds / the target: use any free spot nearby.
          x = rng.range(left + pad, right - pad);
          y =
            area.kind === 'pile'
              ? rng.range((top + bottom) / 2, bottom - pad)
              : area.kind === 'ceiling'
                ? rng.range(top + pad, (top + bottom) / 2)
                : rng.range(top + pad, bottom - pad);
        } else if (area.kind === 'pile' || area.kind === 'ceiling') {
          const width = (right - left - pad * 2) * (area.to - area.from);
          const row = Math.floor(i / Math.max(1, Math.round(perRow * (area.to - area.from))));
          x = left + pad + (right - left - pad * 2) * area.from + rng.next() * width;
          const depth = (row + rng.next()) * this.spacing * 0.95 + pad;
          y = area.kind === 'pile' ? bottom - depth : top + depth;
        } else if (area.kind === 'cloud') {
          const a = rng.next() * Math.PI * 2;
          const r = Math.sqrt(rng.next());
          x = area.x + Math.cos(a) * area.rx * r;
          y = area.y + Math.sin(a) * area.ry * r;
        } else {
          x = rng.range(left + pad, right - pad);
          y = rng.range(top + pad, bottom - pad);
        }
        x = Math.min(Math.max(x, left + pad), right - pad);
        y = Math.min(Math.max(y, top + pad), bottom - pad);
        if (this.isFreeSpawnPoint(x, y)) break;
      }
      this.particles[i].reset(x, y, Math.floor(rng.next() * variants), rng.next());
    }
    this.total = n;
    return n;
  }

  private isFreeSpawnPoint(x: number, y: number): boolean {
    if (this.mask && this.mask.signedDistance(x, y) < this.spacing * 2) return false;
    for (const w of this.env.walls) if (x > w.x - 4 && x < w.x + w.w + 4 && y > w.y - 4 && y < w.y + w.h + 4) return false;
    for (const s of this.env.sinks) if (((x - s.x) / (s.rx + 30)) ** 2 + ((y - s.y) / (s.ry + 30)) ** 2 < 1) return false;
    return true;
  }

  /** Advances the simulation by `dt` seconds. `time` is the level clock (for wind decay and turbulence). */
  step(dt: number, time: number, wind: WindField | null): void {
    const { physics } = this.material;
    const { bounds, walls, fans, sinks } = this.env;
    const T = SIM_TUNING;
    const particles = this.particles;
    const n = particles.length;
    const spacing = this.spacing;
    const radius = spacing * 0.35;
    const containMargin = spacing * 0.7;
    const magnetRange = spacing * 1.3;
    const hold = this.holdScale;
    const dragOutside = Math.exp(-physics.drag * dt);
    const dragInside = Math.exp(-physics.drag * T.insideDrag * hold * dt);
    const gustFactor = 1 + this.env.gust * Math.sin(time * 0.9) * 0.6;
    const breezeX = this.env.breezeX * gustFactor;
    const breezeY = this.env.breezeY * gustFactor;
    const fq = physics.turbulenceFreq;
    const mask = this.mask;
    const windOut = this.windOut;
    const maskOut = this.maskOut;

    this.computeRepulsion();

    let inside = 0;
    let speedSum = 0;
    let activeCount = 0;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      if (!p.active) continue;
      activeCount++;
      let ax = this.fx[i];
      let ay = this.fy[i];

      // Target: catching forces.
      let isInside = false;
      if (mask) {
        mask.sample(p.x, p.y, maskOut);
        const sd = maskOut[0];
        p.targetDistance = sd;
        if (sd < 0) {
          isInside = true;
          if (sd > -containMargin) {
            const push = T.containForce * hold * (1 + sd / containMargin);
            ax -= maskOut[1] * push;
            ay -= maskOut[2] * push;
          }
        } else if (sd < magnetRange) {
          const pull = T.magnetForce * hold * (1 - sd / magnetRange);
          ax -= maskOut[1] * pull;
          ay -= maskOut[2] * pull;
        }
      }
      p.inside = isInside;
      if (isInside) inside++;

      // Gravity / buoyancy, breeze and smooth turbulence.
      const g = isInside ? physics.gravity * T.insideGravity : physics.gravity;
      const turb = physics.turbulence * (isInside ? T.insideTurbulence : 1);
      const ph = p.phase * 6.283;
      ax += turb * Math.sin(time * fq * 2.1 + ph * 3.0 + p.y * 0.013);
      ay += g + turb * Math.cos(time * fq * 1.7 + ph * 2.0 + p.x * 0.011);
      const breezeScale = isInside ? 0.35 : 1;
      ax += breezeX * breezeScale;
      ay += breezeY * breezeScale;

      // Player wind.
      if (wind) {
        const mag = wind.sample(p.x, p.y, time, windOut);
        if (mag > 0) {
          const k = physics.windResponse * (isInside ? T.insideWind : 1);
          ax += windOut[0] * k;
          ay += windOut[1] * k;
        }
      }

      // Fans.
      for (let f = 0; f < fans.length; f++) {
        const fan = fans[f];
        if (p.x < fan.x || p.x > fan.x + fan.w || p.y < fan.y || p.y > fan.y + fan.h) continue;
        const wobble = 0.75 + 0.25 * Math.sin(time * 4 + p.phase * 6.283);
        ax += fan.fx * wobble;
        ay += fan.fy * wobble;
      }

      // Soft cushions near the screen edges so particles never stay glued to them.
      const ez = T.edgeZone;
      const dl = p.x - bounds.left;
      const dr = bounds.right - p.x;
      const dtp = p.y - bounds.top;
      const db = bounds.bottom - p.y;
      if (dl < ez) ax += T.edgeForce * (1 - dl / ez);
      if (dr < ez) ax -= T.edgeForce * (1 - dr / ez);
      if (dtp < ez) ay += T.edgeForce * (1 - dtp / ez);
      if (db < ez) ay -= T.edgeForce * 0.6 * (1 - db / ez);

      // Integrate.
      const drag = isInside ? dragInside : dragOutside;
      let vx = (p.vx + ax * dt) * drag;
      let vy = (p.vy + ay * dt) * drag;
      const speed2 = vx * vx + vy * vy;
      const max = physics.maxSpeed;
      if (speed2 > max * max) {
        const s = max / Math.sqrt(speed2);
        vx *= s;
        vy *= s;
      }
      let x = p.x + vx * dt;
      let y = p.y + vy * dt;

      // Walls (axis-aligned blocks).
      for (let w = 0; w < walls.length; w++) {
        const wall = walls[w];
        const l = wall.x - radius;
        const r = wall.x + wall.w + radius;
        const t = wall.y - radius;
        const b = wall.y + wall.h + radius;
        if (x <= l || x >= r || y <= t || y >= b) continue;
        // Push out through the nearest side.
        const pl = x - l;
        const pr = r - x;
        const pt = y - t;
        const pb = b - y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) {
          x = l;
          vx = -Math.abs(vx) * physics.bounce;
        } else if (m === pr) {
          x = r;
          vx = Math.abs(vx) * physics.bounce;
        } else if (m === pt) {
          y = t;
          vy = -Math.abs(vy) * physics.bounce;
        } else {
          y = b;
          vy = Math.abs(vy) * physics.bounce;
        }
      }

      // Screen bounds.
      if (x < bounds.left + radius) {
        x = bounds.left + radius;
        vx = Math.abs(vx) * physics.bounce;
      } else if (x > bounds.right - radius) {
        x = bounds.right - radius;
        vx = -Math.abs(vx) * physics.bounce;
      }
      if (y < bounds.top + radius) {
        y = bounds.top + radius;
        vy = Math.abs(vy) * physics.bounce;
      } else if (y > bounds.bottom - radius) {
        y = bounds.bottom - radius;
        vy = -Math.abs(vy) * physics.bounce;
      }

      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      const speed = Math.sqrt(vx * vx + vy * vy);
      speedSum += speed;
      p.angle += (physics.spin + speed * physics.spinPerSpeed) * p.spinDir * dt;

      // Sinks.
      for (let s = 0; s < sinks.length; s++) {
        const sink = sinks[s];
        const nx = (x - sink.x) / sink.rx;
        const ny = (y - sink.y) / sink.ry;
        if (nx * nx + ny * ny < 1) {
          p.active = false;
          p.lost = true;
          this.lostCount++;
          if (isInside) inside--;
          if (this.onLost) this.onLost(x, y);
          break;
        }
      }
    }
    this.insideCount = inside;
    this.averageSpeed = activeCount ? speedSum / activeCount : 0;
  }

  /** Soft neighbour repulsion through a spatial hash. Results land in fx/fy. */
  private computeRepulsion(): void {
    const { left, top } = this.env.bounds;
    const cell = this.gridCell;
    const cols = this.gridCols;
    const rows = this.gridRows;
    const head = this.gridHead;
    const next = this.gridNext;
    const particles = this.particles;
    const n = particles.length;
    const fx = this.fx;
    const fy = this.fy;
    head.fill(-1, 0, cols * rows);
    for (let i = 0; i < n; i++) {
      fx[i] = 0;
      fy[i] = 0;
      const p = particles[i];
      if (!p.active) continue;
      const c = Math.min(cols - 1, Math.max(0, Math.floor((p.x - left) / cell)));
      const r = Math.min(rows - 1, Math.max(0, Math.floor((p.y - top) / cell)));
      const k = r * cols + c;
      next[i] = head[k];
      head[k] = i;
    }
    const R = cell;
    const R2 = R * R;
    const K = SIM_TUNING.repulsion;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      if (!p.active) continue;
      const c = Math.min(cols - 1, Math.max(0, Math.floor((p.x - left) / cell)));
      const r = Math.min(rows - 1, Math.max(0, Math.floor((p.y - top) / cell)));
      for (let oy = 0; oy <= 1; oy++) {
        const rr = r + oy;
        if (rr >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          // Visit each neighbouring cell pair once: same row only to the right (and self), next row fully.
          if (oy === 0 && ox < 0) continue;
          const cc = c + ox;
          if (cc < 0 || cc >= cols) continue;
          let j = head[rr * cols + cc];
          while (j !== -1) {
            if (oy === 0 && ox === 0 && j <= i) {
              j = next[j];
              continue;
            }
            const q = particles[j];
            let dx = p.x - q.x;
            let dy = p.y - q.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < R2) {
              if (d2 < SPEED_EPSILON) {
                // Identical positions: separate deterministically.
                dx = ((i * 7919) % 13) - 6 || 1;
                dy = ((j * 104729) % 11) - 5 || 1;
                d2 = dx * dx + dy * dy;
              }
              const d = Math.sqrt(d2);
              const f = (K * (1 - Math.min(d, R) / R)) / d;
              fx[i] += dx * f;
              fy[i] += dy * f;
              fx[j] -= dx * f;
              fy[j] -= dy * f;
            }
            j = next[j];
          }
        }
      }
    }
  }
}
