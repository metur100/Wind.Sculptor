import type { Primitive, TargetPlacement, TargetShape } from './TargetDefinition';

// ---------------------------------------------------------------------------------------------
// Generators for common outlines (all in 100 × 100 shape space)
// ---------------------------------------------------------------------------------------------

/** Star / regular polygon outline. Use inner === outer for a regular polygon. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, points: number, rotation = -Math.PI / 2): number[] {
  const pts: number[] = [];
  const steps = inner === outer ? points : points * 2;
  for (let i = 0; i < steps; i++) {
    const r = inner === outer || i % 2 === 0 ? outer : inner;
    const a = rotation + (i / steps) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

/** Pointed leaf outline along the angle `rot`. */
export function leafPoints(cx: number, cy: number, length: number, width: number, rot: number, steps = 14): number[] {
  const side: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const along = (t - 0.5) * length;
    const half = (width / 2) * Math.pow(Math.sin(Math.PI * t), 0.85);
    side.push([along, half]);
  }
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const pts: number[] = [];
  const push = (a: number, b: number) => pts.push(cx + a * cos - b * sin, cy + a * sin + b * cos);
  for (const [a, b] of side) push(a, b);
  for (let i = side.length - 2; i > 0; i--) push(side[i][0], -side[i][1]);
  return pts;
}

/** Points along an arc – used for point-cloud targets. */
export function arcPoints(cx: number, cy: number, radius: number, from: number, to: number, count: number, shrink = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const a = from + (to - from) * t;
    const r = radius * (1 - shrink * t);
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function burstPoints(cx: number, cy: number, rays: number, radii: number[]): number[] {
  const pts: number[] = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 - Math.PI / 2;
    for (const r of radii) pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function blade(cx: number, cy: number, angle: number, length: number, width: number): Primitive {
  const d = length / 2 + 4;
  return { kind: 'rect', x: cx + Math.cos(angle) * d, y: cy + Math.sin(angle) * d, w: length, h: width, r: 2, rot: angle };
}

const shape = (id: string, name: string, primitives: Primitive[]): TargetShape => ({ id, name, primitives });

// ---------------------------------------------------------------------------------------------
// Shape library
// ---------------------------------------------------------------------------------------------

const SHAPE_LIST: TargetShape[] = [
  // --- Basic / tutorial ---
  shape('circle', 'Circle', [{ kind: 'circle', x: 50, y: 50, r: 46 }]),
  shape('square', 'Square', [{ kind: 'rect', x: 50, y: 50, w: 80, h: 80, r: 8 }]),
  shape('triangle', 'Triangle', [{ kind: 'poly', pts: [50, 8, 94, 88, 6, 88] }]),
  shape('blob', 'Puff', [
    { kind: 'circle', x: 40, y: 54, r: 30 },
    { kind: 'circle', x: 62, y: 46, r: 28 },
  ]),

  // --- World 1: Sand ---
  shape('dune-sun', 'Desert Sun', [{ kind: 'circle', x: 50, y: 50, r: 46 }]),
  shape('desert-tree', 'Desert Tree', [
    { kind: 'rect', x: 50, y: 78, w: 14, h: 40, r: 4 },
    { kind: 'circle', x: 50, y: 40, r: 24 },
    { kind: 'circle', x: 30, y: 48, r: 17 },
    { kind: 'circle', x: 70, y: 48, r: 17 },
    { kind: 'circle', x: 39, y: 26, r: 16 },
    { kind: 'circle', x: 61, y: 26, r: 16 },
  ]),
  shape('cactus', 'Cactus', [
    { kind: 'capsule', x1: 50, y1: 12, x2: 50, y2: 94, r: 11 },
    { kind: 'capsule', x1: 24, y1: 34, x2: 24, y2: 58, r: 8 },
    { kind: 'capsule', x1: 24, y1: 60, x2: 46, y2: 60, r: 8 },
    { kind: 'capsule', x1: 76, y1: 24, x2: 76, y2: 48, r: 8 },
    { kind: 'capsule', x1: 76, y1: 50, x2: 54, y2: 50, r: 8 },
  ]),
  shape('mountain', 'Twin Peaks', [{ kind: 'poly', pts: [4, 90, 38, 16, 60, 52, 72, 34, 96, 90] }]),
  shape('camel', 'Camel', [
    { kind: 'ellipse', x: 50, y: 50, rx: 27, ry: 15 },
    { kind: 'circle', x: 40, y: 37, r: 11 },
    { kind: 'circle', x: 60, y: 37, r: 11 },
    { kind: 'capsule', x1: 74, y1: 48, x2: 84, y2: 24, r: 6.5 },
    { kind: 'ellipse', x: 88, y: 21, rx: 10, ry: 6.5, rot: 0.15 },
    { kind: 'capsule', x1: 32, y1: 58, x2: 30, y2: 92, r: 5 },
    { kind: 'capsule', x1: 43, y1: 60, x2: 43, y2: 92, r: 5 },
    { kind: 'capsule', x1: 60, y1: 60, x2: 60, y2: 92, r: 5 },
    { kind: 'capsule', x1: 70, y1: 58, x2: 72, y2: 92, r: 5 },
  ]),

  // --- World 2: Leaves ---
  shape('leaf', 'Maple Leaf', [
    { kind: 'poly', pts: leafPoints(50, 46, 92, 50, -Math.PI / 4) },
    { kind: 'capsule', x1: 22, y1: 74, x2: 10, y2: 90, r: 4 },
  ]),
  shape('fox', 'Fox', [
    { kind: 'poly', pts: [28, 30, 72, 30, 50, 60] },
    { kind: 'poly', pts: [28, 31, 26, 6, 45, 27] },
    { kind: 'poly', pts: [72, 31, 74, 6, 55, 27] },
    { kind: 'ellipse', x: 50, y: 74, rx: 20, ry: 22 },
    { kind: 'ellipse', x: 77, y: 84, rx: 19, ry: 9, rot: -0.45 },
  ]),
  shape('autumn-tree', 'Autumn Tree', [
    { kind: 'capsule', x1: 50, y1: 96, x2: 50, y2: 56, r: 7 },
    { kind: 'capsule', x1: 50, y1: 64, x2: 30, y2: 46, r: 4.5 },
    { kind: 'capsule', x1: 50, y1: 60, x2: 70, y2: 44, r: 4.5 },
    { kind: 'circle', x: 50, y: 32, r: 22 },
    { kind: 'circle', x: 28, y: 40, r: 16 },
    { kind: 'circle', x: 72, y: 38, r: 16 },
    { kind: 'circle', x: 38, y: 19, r: 14 },
    { kind: 'circle', x: 62, y: 18, r: 14 },
  ]),
  shape('squirrel', 'Squirrel', [
    { kind: 'ellipse', x: 46, y: 64, rx: 16, ry: 21, rot: 0.2 },
    { kind: 'circle', x: 42, y: 36, r: 12 },
    { kind: 'poly', pts: [35, 28, 37, 13, 46, 26] },
    { kind: 'ellipse', x: 30, y: 40, rx: 6, ry: 4 },
    { kind: 'circle', x: 70, y: 72, r: 14 },
    { kind: 'circle', x: 79, y: 54, r: 13 },
    { kind: 'circle', x: 76, y: 35, r: 11 },
    { kind: 'circle', x: 66, y: 24, r: 8 },
    { kind: 'ellipse', x: 44, y: 88, rx: 16, ry: 5 },
  ]),
  shape('windmill', 'Windmill', [
    { kind: 'poly', pts: [38, 97, 62, 97, 57, 44, 43, 44] },
    { kind: 'poly', pts: [41, 45, 59, 45, 50, 33] },
    { kind: 'circle', x: 50, y: 38, r: 6 },
    blade(50, 38, -Math.PI / 4, 34, 10),
    blade(50, 38, (-3 * Math.PI) / 4, 34, 10),
    blade(50, 38, Math.PI / 4, 30, 10),
    blade(50, 38, (3 * Math.PI) / 4, 30, 10),
  ]),

  // --- World 3: Snow ---
  shape('snowball', 'Snowball', [{ kind: 'circle', x: 50, y: 50, r: 44 }]),
  shape('snowman', 'Snowman', [
    { kind: 'circle', x: 50, y: 78, r: 20 },
    { kind: 'circle', x: 50, y: 47, r: 15 },
    { kind: 'circle', x: 50, y: 23, r: 11 },
    { kind: 'rect', x: 50, y: 10, w: 16, h: 10, r: 2 },
  ]),
  shape('pine', 'Pine Tree', [
    { kind: 'poly', pts: [50, 4, 30, 32, 70, 32] },
    { kind: 'poly', pts: [50, 20, 23, 55, 77, 55] },
    { kind: 'poly', pts: [50, 38, 16, 80, 84, 80] },
    { kind: 'rect', x: 50, y: 88, w: 13, h: 18, r: 2 },
  ]),
  shape('penguin', 'Penguin', [
    { kind: 'ellipse', x: 50, y: 60, rx: 22, ry: 32 },
    { kind: 'circle', x: 50, y: 27, r: 16 },
    { kind: 'poly', pts: [63, 25, 77, 30, 63, 34] },
    { kind: 'ellipse', x: 27, y: 58, rx: 6.5, ry: 18, rot: 0.35 },
    { kind: 'ellipse', x: 73, y: 58, rx: 6.5, ry: 18, rot: -0.35 },
    { kind: 'ellipse', x: 40, y: 92, rx: 10, ry: 5 },
    { kind: 'ellipse', x: 60, y: 92, rx: 10, ry: 5 },
  ]),
  shape('cabin', 'Mountain Cabin', [
    { kind: 'rect', x: 50, y: 70, w: 62, h: 40 },
    { kind: 'poly', pts: [10, 52, 50, 20, 90, 52] },
    { kind: 'rect', x: 71, y: 30, w: 10, h: 22 },
    { kind: 'rect', x: 50, y: 80, w: 14, h: 20, cut: true },
    { kind: 'rect', x: 32, y: 66, w: 11, h: 11, cut: true },
  ]),

  // --- World 4: Confetti ---
  shape('star', 'Star', [{ kind: 'poly', pts: starPoints(50, 54, 48, 21, 5) }]),
  shape('cake', 'Birthday Cake', [
    { kind: 'rect', x: 50, y: 82, w: 74, h: 22, r: 4 },
    { kind: 'rect', x: 50, y: 60, w: 54, h: 22, r: 4 },
    { kind: 'rect', x: 38, y: 42, w: 6, h: 16, r: 2 },
    { kind: 'rect', x: 50, y: 42, w: 6, h: 16, r: 2 },
    { kind: 'rect', x: 62, y: 42, w: 6, h: 16, r: 2 },
    { kind: 'ellipse', x: 38, y: 30, rx: 4.5, ry: 6 },
    { kind: 'ellipse', x: 50, y: 30, rx: 4.5, ry: 6 },
    { kind: 'ellipse', x: 62, y: 30, rx: 4.5, ry: 6 },
  ]),
  shape('balloon', 'Balloon', [
    { kind: 'ellipse', x: 50, y: 38, rx: 30, ry: 35 },
    { kind: 'poly', pts: [45, 72, 55, 72, 50, 79] },
    { kind: 'capsule', x1: 50, y1: 79, x2: 45, y2: 89, r: 3.5 },
    { kind: 'capsule', x1: 45, y1: 89, x2: 51, y2: 98, r: 3.5 },
  ]),
  shape('firework', 'Firework', [
    { kind: 'circle', x: 50, y: 50, r: 9 },
    { kind: 'points', pts: burstPoints(50, 50, 10, [19, 29, 39]), r: 6 },
  ]),
  shape('crown', 'Crown', [
    { kind: 'poly', pts: [12, 80, 12, 36, 31, 58, 50, 24, 69, 58, 88, 36, 88, 80] },
    { kind: 'rect', x: 50, y: 84, w: 78, h: 12, r: 3 },
    { kind: 'circle', x: 12, y: 31, r: 6.5 },
    { kind: 'circle', x: 50, y: 19, r: 7.5 },
    { kind: 'circle', x: 88, y: 31, r: 6.5 },
  ]),

  // --- World 5: Fireflies ---
  shape('moon', 'Crescent Moon', [
    { kind: 'circle', x: 50, y: 50, r: 44 },
    { kind: 'circle', x: 70, y: 38, r: 36, cut: true },
  ]),
  shape('flower', 'Night Flower', [
    ...Array.from({ length: 6 }, (_, i): Primitive => {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      return { kind: 'circle', x: 50 + Math.cos(a) * 15, y: 32 + Math.sin(a) * 15, r: 11 };
    }),
    { kind: 'circle', x: 50, y: 32, r: 10 },
    { kind: 'capsule', x1: 50, y1: 46, x2: 50, y2: 97, r: 4 },
    { kind: 'poly', pts: leafPoints(36, 74, 28, 12, -2.5) },
    { kind: 'poly', pts: leafPoints(64, 84, 28, 12, -0.65) },
  ]),
  shape('owl', 'Owl', [
    { kind: 'ellipse', x: 50, y: 60, rx: 30, ry: 34 },
    { kind: 'poly', pts: [22, 38, 26, 10, 42, 30] },
    { kind: 'poly', pts: [78, 38, 74, 10, 58, 30] },
    { kind: 'circle', x: 37, y: 44, r: 9, cut: true },
    { kind: 'circle', x: 63, y: 44, r: 9, cut: true },
    { kind: 'ellipse', x: 40, y: 95, rx: 8, ry: 4 },
    { kind: 'ellipse', x: 60, y: 95, rx: 8, ry: 4 },
  ]),
  shape('lantern', 'Lantern', [
    { kind: 'rect', x: 50, y: 62, w: 42, h: 46, r: 6 },
    { kind: 'poly', pts: [28, 40, 72, 40, 61, 27, 39, 27] },
    { kind: 'rect', x: 50, y: 88, w: 50, h: 9, r: 3 },
    { kind: 'ring', x: 50, y: 19, r: 12, inner: 6 },
  ]),
  shape('magic-tree', 'Magical Tree', [
    { kind: 'capsule', x1: 50, y1: 97, x2: 50, y2: 58, r: 8 },
    { kind: 'capsule', x1: 50, y1: 68, x2: 28, y2: 40, r: 5 },
    { kind: 'capsule', x1: 50, y1: 63, x2: 73, y2: 36, r: 5 },
    { kind: 'capsule', x1: 50, y1: 60, x2: 50, y2: 30, r: 5 },
    { kind: 'circle', x: 28, y: 33, r: 12 },
    { kind: 'circle', x: 74, y: 29, r: 12 },
    { kind: 'circle', x: 50, y: 21, r: 13 },
    { kind: 'circle', x: 13, y: 58, r: 9 },
    { kind: 'circle', x: 87, y: 55, r: 9 },
  ]),

  // --- World 6: Underwater ---
  shape('fish', 'Fish', [
    { kind: 'ellipse', x: 42, y: 52, rx: 31, ry: 21 },
    { kind: 'poly', pts: [68, 52, 95, 30, 95, 74] },
    { kind: 'poly', pts: [32, 34, 50, 16, 56, 35] },
    { kind: 'circle', x: 24, y: 47, r: 4.5, cut: true },
  ]),
  shape('seahorse', 'Seahorse', [
    { kind: 'ellipse', x: 52, y: 15, rx: 12, ry: 10 },
    { kind: 'capsule', x1: 58, y1: 16, x2: 80, y2: 21, r: 4.5 },
    { kind: 'capsule', x1: 48, y1: 22, x2: 42, y2: 40, r: 10 },
    { kind: 'capsule', x1: 42, y1: 40, x2: 45, y2: 58, r: 13 },
    { kind: 'capsule', x1: 45, y1: 58, x2: 54, y2: 72, r: 10 },
    { kind: 'points', pts: arcPoints(46, 82, 11, -0.4, 4.4, 8, 0.45), r: 6 },
    { kind: 'poly', pts: [30, 40, 18, 46, 30, 56] },
  ]),
  shape('coral', 'Coral', [
    { kind: 'capsule', x1: 50, y1: 97, x2: 50, y2: 72, r: 8 },
    { kind: 'capsule', x1: 50, y1: 78, x2: 29, y2: 56, r: 6 },
    { kind: 'capsule', x1: 29, y1: 56, x2: 20, y2: 30, r: 5.5 },
    { kind: 'capsule', x1: 29, y1: 56, x2: 39, y2: 34, r: 5 },
    { kind: 'capsule', x1: 50, y1: 76, x2: 69, y2: 52, r: 6 },
    { kind: 'capsule', x1: 69, y1: 52, x2: 63, y2: 25, r: 5.5 },
    { kind: 'capsule', x1: 69, y1: 52, x2: 86, y2: 33, r: 5 },
    { kind: 'capsule', x1: 50, y1: 80, x2: 50, y2: 44, r: 5.5 },
    { kind: 'capsule', x1: 50, y1: 44, x2: 47, y2: 15, r: 5 },
  ]),
  shape('submarine', 'Submarine', [
    { kind: 'capsule', x1: 20, y1: 60, x2: 78, y2: 60, r: 17 },
    { kind: 'rect', x: 48, y: 38, w: 24, h: 18, r: 4 },
    { kind: 'capsule', x1: 55, y1: 30, x2: 55, y2: 14, r: 3.5 },
    { kind: 'capsule', x1: 55, y1: 14, x2: 65, y2: 14, r: 3.5 },
    { kind: 'poly', pts: [92, 60, 100, 44, 100, 76] },
    { kind: 'circle', x: 32, y: 60, r: 5.5, cut: true },
    { kind: 'circle', x: 50, y: 60, r: 5.5, cut: true },
    { kind: 'circle', x: 68, y: 60, r: 5.5, cut: true },
  ]),
  shape('whale', 'Whale', [
    { kind: 'ellipse', x: 46, y: 58, rx: 38, ry: 21 },
    { kind: 'capsule', x1: 78, y1: 60, x2: 88, y2: 44, r: 7 },
    { kind: 'poly', pts: [87, 46, 72, 28, 90, 35, 100, 24, 96, 44] },
    { kind: 'poly', pts: [42, 70, 54, 88, 58, 72] },
    { kind: 'points', pts: [22, 30, 18, 22, 26, 22, 14, 15, 30, 15], r: 4.5 },
  ]),

  // --- Daily challenge specials ---
  shape('heart', 'Heart', [
    { kind: 'circle', x: 33, y: 38, r: 19 },
    { kind: 'circle', x: 67, y: 38, r: 19 },
    { kind: 'poly', pts: [15, 44, 85, 44, 50, 90] },
  ]),
  shape('butterfly', 'Butterfly', [
    { kind: 'ellipse', x: 30, y: 36, rx: 21, ry: 16, rot: -0.5 },
    { kind: 'ellipse', x: 70, y: 36, rx: 21, ry: 16, rot: 0.5 },
    { kind: 'ellipse', x: 33, y: 66, rx: 15, ry: 12, rot: 0.5 },
    { kind: 'ellipse', x: 67, y: 66, rx: 15, ry: 12, rot: -0.5 },
    { kind: 'capsule', x1: 50, y1: 26, x2: 50, y2: 80, r: 4.5 },
  ]),
  shape('mushroom', 'Mushroom', [
    { kind: 'ellipse', x: 50, y: 40, rx: 42, ry: 25 },
    { kind: 'rect', x: 50, y: 74, w: 24, h: 38, r: 7 },
    { kind: 'circle', x: 34, y: 32, r: 6, cut: true },
    { kind: 'circle', x: 60, y: 26, r: 7, cut: true },
  ]),
  shape('rocket', 'Rocket', [
    { kind: 'ellipse', x: 50, y: 46, rx: 17, ry: 36 },
    { kind: 'poly', pts: [35, 60, 20, 86, 37, 80] },
    { kind: 'poly', pts: [65, 60, 80, 86, 63, 80] },
    { kind: 'poly', pts: [41, 80, 59, 80, 50, 99] },
    { kind: 'circle', x: 50, y: 38, r: 6.5, cut: true },
  ]),
  shape('lightning', 'Lightning', [{ kind: 'poly', pts: [58, 3, 20, 56, 46, 56, 34, 97, 82, 38, 55, 38, 68, 3] }]),
  shape('note', 'Music Note', [
    { kind: 'ellipse', x: 36, y: 78, rx: 15, ry: 11, rot: -0.4 },
    { kind: 'rect', x: 47, y: 46, w: 7, h: 64 },
    { kind: 'poly', pts: [44, 14, 78, 30, 78, 44, 50, 30] },
  ]),
  shape('letter-w', 'Letter W', [
    { kind: 'poly', pts: [4, 14, 21, 14, 33, 62, 43, 30, 57, 30, 67, 62, 79, 14, 96, 14, 76, 88, 60, 88, 50, 56, 40, 88, 24, 88] },
  ]),
  shape('cat', 'Cat', [
    { kind: 'circle', x: 46, y: 34, r: 16 },
    { kind: 'poly', pts: [32, 28, 32, 8, 46, 21] },
    { kind: 'poly', pts: [60, 28, 60, 8, 46, 21] },
    { kind: 'ellipse', x: 48, y: 70, rx: 21, ry: 23 },
    { kind: 'capsule', x1: 66, y1: 88, x2: 86, y2: 62, r: 5 },
  ]),
  shape('sailboat', 'Sailboat', [
    { kind: 'poly', pts: [8, 72, 92, 72, 77, 92, 23, 92] },
    { kind: 'rect', x: 50, y: 42, w: 5, h: 62 },
    { kind: 'poly', pts: [55, 10, 55, 66, 88, 66] },
    { kind: 'poly', pts: [45, 20, 45, 66, 16, 66] },
  ]),
  shape('cloud', 'Cloud', [
    { kind: 'circle', x: 30, y: 58, r: 17 },
    { kind: 'circle', x: 50, y: 45, r: 23 },
    { kind: 'circle', x: 72, y: 55, r: 18 },
    { kind: 'rect', x: 50, y: 64, w: 60, h: 20, r: 10 },
  ]),
];

export const TARGET_SHAPES: Readonly<Record<string, TargetShape>> = Object.fromEntries(SHAPE_LIST.map((s) => [s.id, s]));

/** Shapes used only by the daily challenge generator. */
export const DAILY_SHAPES = ['heart', 'butterfly', 'mushroom', 'rocket', 'lightning', 'note', 'letter-w', 'cat', 'sailboat', 'cloud'] as const;

export function getShape(id: string): TargetShape {
  const found = TARGET_SHAPES[id];
  if (!found) throw new Error(`Unknown target shape "${id}"`);
  return found;
}

// ---------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------

function pointInPolygon(pts: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq)) : 0;
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return dx * dx + dy * dy;
}

/** Is the shape-space point (x, y) inside a single primitive (ignoring `cut`)? */
export function primitiveContains(p: Primitive, x: number, y: number): boolean {
  switch (p.kind) {
    case 'circle':
      return (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r * p.r;
    case 'ring': {
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
      return d2 <= p.r * p.r && d2 >= p.inner * p.inner;
    }
    case 'ellipse': {
      const rot = p.rot ?? 0;
      const c = Math.cos(-rot);
      const s = Math.sin(-rot);
      const dx = x - p.x;
      const dy = y - p.y;
      const u = dx * c - dy * s;
      const v = dx * s + dy * c;
      return (u * u) / (p.rx * p.rx) + (v * v) / (p.ry * p.ry) <= 1;
    }
    case 'rect': {
      const rot = p.rot ?? 0;
      const c = Math.cos(-rot);
      const s = Math.sin(-rot);
      const dx = x - p.x;
      const dy = y - p.y;
      const u = Math.abs(dx * c - dy * s);
      const v = Math.abs(dx * s + dy * c);
      const hw = p.w / 2;
      const hh = p.h / 2;
      if (u > hw || v > hh) return false;
      const r = Math.min(p.r ?? 0, hw, hh);
      if (r <= 0) return true;
      const cx = u - (hw - r);
      const cy = v - (hh - r);
      return cx <= 0 || cy <= 0 || cx * cx + cy * cy <= r * r;
    }
    case 'poly':
      return pointInPolygon(p.pts, x, y);
    case 'capsule':
      return distSq(x, y, p.x1, p.y1, p.x2, p.y2) <= p.r * p.r;
    case 'points': {
      const r2 = p.r * p.r;
      for (let i = 0; i < p.pts.length; i += 2) {
        if ((x - p.pts[i]) ** 2 + (y - p.pts[i + 1]) ** 2 <= r2) return true;
      }
      return false;
    }
  }
}

/** Union of all additive primitives minus all cut primitives. */
export function shapeContains(target: TargetShape, x: number, y: number): boolean {
  let inside = false;
  for (const p of target.primitives) {
    if (!p.cut && !inside && primitiveContains(p, x, y)) inside = true;
  }
  if (!inside) return false;
  for (const p of target.primitives) {
    if (p.cut && primitiveContains(p, x, y)) return false;
  }
  return true;
}

/** Converts a stage point into the placement's shape space. */
export function stageToShape(placement: TargetPlacement, x: number, y: number, out: number[]): void {
  const dx = (x - placement.x) / placement.size;
  const dy = (y - placement.y) / placement.size;
  const rot = placement.rotation ?? 0;
  let u = dx;
  let v = dy;
  if (rot !== 0) {
    const c = Math.cos(-rot);
    const s = Math.sin(-rot);
    u = dx * c - dy * s;
    v = dx * s + dy * c;
  }
  out[0] = (placement.flip ? -u : u) + 50;
  out[1] = v + 50;
}

const scratch = [0, 0];

/** Is the stage point inside any of the placements? */
export function placementsContain(placements: readonly TargetPlacement[], x: number, y: number): boolean {
  for (const placement of placements) {
    const half = 50 * placement.size * 1.5;
    if (Math.abs(x - placement.x) > half || Math.abs(y - placement.y) > half) continue;
    stageToShape(placement, x, y, scratch);
    if (shapeContains(getShape(placement.shape), scratch[0], scratch[1])) return true;
  }
  return false;
}
