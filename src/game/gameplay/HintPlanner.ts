import { getMaterial } from '../particles/ParticleMaterial';
import type { Rng } from '../utils/MathUtils';
import type { LevelSession } from './LevelSession';

export interface SwipePlan {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Suggested swipe speed (px/s). */
  speed: number;
}

/**
 * Suggests a useful swipe: find an unfilled part of the target, find the nearest group of particles
 * that are not part of the sculpture yet, and blow that group towards the gap.
 * Used for the hint arrow and by the headless level verifier.
 */
export function planSwipe(session: LevelSession, rng: Rng): SwipePlan | null {
  const { mask } = session.level;
  const particles = session.system.particles;
  const material = getMaterial(session.level.def.material);
  const cell = mask.coverageCell;

  // Unfilled target cells (from the latest measurement).
  const gaps: number[] = [];
  for (let r = 0; r < mask.coverageRows; r++) {
    for (let c = 0; c < mask.coverageCols; c++) {
      const k = r * mask.coverageCols + c;
      if (mask.coverageTarget[k] && mask.coverageStamp[k] !== mask.coverageStampId) {
        gaps.push((c + 0.5) * cell + mask.offsetX, (r + 0.5) * cell + mask.offsetY);
      }
    }
  }
  if (gaps.length === 0) return null;

  // Free particles (outside the target); fall back to all particles when everything is inside.
  const free: number[] = [];
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active || p.inside) continue;
    free.push(i);
    sx += p.x;
    sy += p.y;
  }
  const pool = free.length >= 4 ? free : particles.map((p, i) => (p.active ? i : -1)).filter((i) => i >= 0);
  if (pool.length === 0) return null;
  const cxAll = free.length ? sx / free.length : mask.centroidX + mask.offsetX;
  const cyAll = free.length ? sy / free.length : mask.centroidY + mask.offsetY;

  // Gap closest to the free particles (sampled to stay cheap).
  let gx = gaps[0];
  let gy = gaps[1];
  let best = Infinity;
  for (let s = 0; s < 16; s++) {
    const k = rng.int(0, gaps.length / 2 - 1) * 2;
    const d = (gaps[k] - cxAll) ** 2 + (gaps[k + 1] - cyAll) ** 2;
    if (d < best) {
      best = d;
      gx = gaps[k];
      gy = gaps[k + 1];
    }
  }

  // Free particle closest to that gap, then the centre of its neighbourhood.
  let pick = pool[0];
  best = Infinity;
  const samples = Math.min(pool.length, 40);
  for (let s = 0; s < samples; s++) {
    const i = pool[rng.int(0, pool.length - 1)];
    const p = particles[i];
    const d = (p.x - gx) ** 2 + (p.y - gy) ** 2;
    if (d < best) {
      best = d;
      pick = i;
    }
  }
  const anchor = particles[pick];
  let n = 0;
  let ax = 0;
  let ay = 0;
  for (const i of pool) {
    const p = particles[i];
    if ((p.x - anchor.x) ** 2 + (p.y - anchor.y) ** 2 < 90 * 90) {
      ax += p.x;
      ay += p.y;
      n++;
    }
  }
  ax /= n;
  ay /= n;

  // A wall in the way? Blow the group around its nearer end first.
  const blocking = session.level.env.walls.find((w) => segmentHitsRect(ax, ay, gx, gy, w.x - 20, w.y - 20, w.w + 40, w.h + 40));
  if (blocking) {
    const leftEnd = blocking.x - 70;
    const rightEnd = blocking.x + blocking.w + 70;
    gx = Math.abs(ax - leftEnd) < Math.abs(ax - rightEnd) && leftEnd > session.level.env.bounds.left + 20 ? leftEnd : rightEnd;
    if (gx > session.level.env.bounds.right - 20) gx = leftEnd;
    gy = ay < blocking.y ? blocking.y + blocking.h + 60 : blocking.y - 60;
  }

  // Aim a little above the gap for falling materials (below it for rising bubbles).
  const aimY = gy - material.physics.gravity * 0.3;
  let dx = gx - ax;
  let dy = aimY - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;
  dx /= dist;
  dy /= dist;
  const length = Math.min(dist * 0.85 + 60, 440);
  const { bounds } = session.level.env;
  const clampX = (x: number) => Math.min(bounds.right - 4, Math.max(bounds.left + 4, x));
  const clampY = (y: number) => Math.min(bounds.bottom - 4, Math.max(bounds.top + 4, y));
  return {
    x1: clampX(ax - dx * 70),
    y1: clampY(ay - dy * 70),
    x2: clampX(ax + dx * length),
    y2: clampY(ay + dy * length),
    speed: dist > 260 ? 1150 : 700,
  };
}

/** Does segment A→B cross the rectangle (x, y, w, h)? (Liang–Barsky clipping.) */
function segmentHitsRect(ax: number, ay: number, bx: number, by: number, x: number, y: number, w: number, h: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, ax - x],
    [dx, x + w - ax],
    [-dy, ay - y],
    [dy, y + h - ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}
