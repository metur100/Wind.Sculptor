/** Small, allocation-free math helpers shared by the simulation and the UI. */

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const inverseLerp = (a: number, b: number, v: number): number => (a === b ? 0 : (v - a) / (b - a));

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Projection of point P onto segment AB.
 * Returns the squared distance and writes the clamped segment parameter into `out[0]`.
 */
export function distSqToSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number, out?: Float64Array | number[],
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq > 0 ? ((px - ax) * abx + (py - ay) * aby) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  if (out) out[0] = t;
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return dx * dx + dy * dy;
}

/** FNV-1a 32-bit string hash – stable across platforms, used for seeds. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32). Same seed → same sequence on every device. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/** Formats seconds as m:ss. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
