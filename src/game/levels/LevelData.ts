import type { LevelDefinition, WorldDefinition } from './LevelDefinition';

export const WORLDS: WorldDefinition[] = [
  {
    id: 0, key: 'sand', name: 'Sand Dunes', tagline: 'Warm grains under a golden sky', material: 'sand', starsRequired: 0, scenery: 'desert',
    theme: {
      skyTop: 0xffd9a0, skyBottom: 0xffb987, far: 0xf2b67a, near: 0xe39a5e, targetFill: 0xfff1d6, targetLine: 0xb8692f,
      accent: 0xf08a3e, text: '#5a3418', wall: 0xc98652, wallEdge: 0x8f5a30, sink: 0x5fb8c9,
    },
  },
  {
    id: 1, key: 'leaves', name: 'Autumn Park', tagline: 'Crunchy leaves on a breezy day', material: 'leaves', starsRequired: 5, scenery: 'park',
    theme: {
      skyTop: 0xffe6c4, skyBottom: 0xf6c3a0, far: 0xd99a6c, near: 0x9c6b4e, targetFill: 0xfff4e4, targetLine: 0x8e4b2a,
      accent: 0xd8572a, text: '#4a2716', wall: 0x8a6048, wallEdge: 0x5c3d2c, sink: 0x6aa6b8,
    },
  },
  {
    id: 2, key: 'snow', name: 'Winter Peaks', tagline: 'Soft flakes in the cold blue', material: 'snow', starsRequired: 12, scenery: 'winter',
    theme: {
      skyTop: 0x9fc4ee, skyBottom: 0xd9e9fa, far: 0xb7cfe8, near: 0xeaf2fb, targetFill: 0x5f86b8, targetLine: 0x2f5a8f,
      accent: 0x3f7fcf, text: '#1d3a5f', wall: 0x8fb6dd, wallEdge: 0x5d88b4, sink: 0x2e6aa8,
    },
  },
  {
    id: 3, key: 'confetti', name: 'Festival', tagline: 'A party of colourful ribbons', material: 'confetti', starsRequired: 20, scenery: 'festival',
    theme: {
      skyTop: 0xffd7ec, skyBottom: 0xd9d4ff, far: 0xf1b6e0, near: 0xb9a8f3, targetFill: 0xffffff, targetLine: 0x8459c9,
      accent: 0xd94f9b, text: '#3f2466', wall: 0xa58bea, wallEdge: 0x6f55b8, sink: 0x4fb3d9,
    },
  },
  {
    id: 4, key: 'fireflies', name: 'Night Forest', tagline: 'Glowing friends in the dark', material: 'fireflies', starsRequired: 28, scenery: 'night',
    theme: {
      skyTop: 0x0f1d3a, skyBottom: 0x24395a, far: 0x1b2d4a, near: 0x101c30, targetFill: 0x6f8fc0, targetLine: 0xc9e27a,
      accent: 0xd9ef6a, text: '#eef6d8', wall: 0x3a4d6b, wallEdge: 0x22324c, sink: 0x0a1222,
    },
  },
  {
    id: 5, key: 'ocean', name: 'Deep Ocean', tagline: 'Bubbles drift up to the light', material: 'bubbles', starsRequired: 36, scenery: 'ocean',
    theme: {
      skyTop: 0x2fa3c4, skyBottom: 0x0f4f7a, far: 0x1d6f93, near: 0x0e3f63, targetFill: 0x9fe8ff, targetLine: 0xe2fbff,
      accent: 0x37d0c0, text: '#eafcff', wall: 0x2a7d8f, wallEdge: 0x15505e, sink: 0x061f33,
    },
  },
];

const goals = (one: number, two: number, three: number) => ({ one, two, three });

/** All 30 campaign levels. Difficulty rises through grain size, obstacles, motion, energy and multiple targets. */
export const LEVELS: LevelDefinition[] = [
  // ------------------------------------------------------------------ World 1: Sand
  {
    id: 'w1-1', index: 0, world: 0, name: 'Circle', material: 'sand', targets: [{ shape: 'dune-sun', x: 360, y: 560, size: 2.7 }],
    grain: 18, surplus: 0.45, time: 90, goals: goals(0.55, 0.68, 0.8), parSwipes: 10, spawn: { kind: 'pile' },
    tip: 'Swipe upwards below the sand to lift it into the circle.',
  },
  {
    id: 'w1-2', index: 1, world: 0, name: 'Tree', material: 'sand', targets: [{ shape: 'desert-tree', x: 360, y: 570, size: 4.2 }],
    grain: 18, surplus: 0.4, time: 95, goals: goals(0.56, 0.69, 0.81), parSwipes: 14, spawn: { kind: 'pile' },
  },
  {
    id: 'w1-3', index: 2, world: 0, name: 'Cactus', material: 'sand', targets: [{ shape: 'cactus', x: 360, y: 580, size: 4.4 }],
    grain: 17, surplus: 0.4, time: 95, goals: goals(0.57, 0.7, 0.82), parSwipes: 16, spawn: { kind: 'pile' },
    tip: 'Slow swipes give gentle wind, fast swipes give strong gusts.',
  },
  {
    id: 'w1-4', index: 3, world: 0, name: 'Mountain', material: 'sand', targets: [{ shape: 'mountain', x: 360, y: 640, size: 5.4 }],
    grain: 17, surplus: 0.35, time: 95, goals: goals(0.58, 0.71, 0.83), parSwipes: 16, spawn: { kind: 'pile' },
  },
  {
    id: 'w1-5', index: 4, world: 0, name: 'Camel', material: 'sand', targets: [{ shape: 'camel', x: 360, y: 600, size: 5.6 }],
    grain: 16, surplus: 0.35, time: 100, goals: goals(0.58, 0.71, 0.83), parSwipes: 18, spawn: { kind: 'pile' },
    breeze: { x: 40, y: 0, gust: 0.4 },
  },

  // ------------------------------------------------------------------ World 2: Leaves
  {
    id: 'w2-1', index: 5, world: 1, name: 'Leaf', material: 'leaves', targets: [{ shape: 'leaf', x: 360, y: 580, size: 4.8 }],
    grain: 18, surplus: 0.4, time: 90, goals: goals(0.58, 0.71, 0.83), parSwipes: 14, spawn: { kind: 'pile', from: 0.3, to: 1 },
    breeze: { x: 75, y: 0, gust: 0.5 }, tip: 'A steady breeze blows to the right – use it or fight it.',
  },
  {
    id: 'w2-2', index: 6, world: 1, name: 'Fox', material: 'leaves', targets: [{ shape: 'fox', x: 380, y: 580, size: 5 }],
    grain: 17, surplus: 0.4, time: 95, goals: goals(0.58, 0.71, 0.83), parSwipes: 16, spawn: { kind: 'pile' },
    fans: [{ x: 0, y: 860, w: 230, h: 260, fx: 520, fy: -620 }], tip: 'Fans blow all the time. Ride their stream!',
  },
  {
    id: 'w2-3', index: 7, world: 1, name: 'Tree', material: 'leaves', targets: [{ shape: 'autumn-tree', x: 360, y: 540, size: 5.2 }],
    grain: 17, surplus: 0.4, time: 100, goals: goals(0.59, 0.72, 0.84), parSwipes: 18, spawn: { kind: 'pile' },
    walls: [{ x: 170, y: 960, w: 380, h: 28 }], tip: 'Walls block the leaves. Blow them around the bench.',
  },
  {
    id: 'w2-4', index: 8, world: 1, name: 'Squirrel', material: 'leaves', targets: [{ shape: 'squirrel', x: 350, y: 580, size: 5.4 }],
    grain: 16, surplus: 0.4, time: 100, goals: goals(0.59, 0.72, 0.84), parSwipes: 18, spawn: { kind: 'pile' },
    breeze: { x: -80, y: 0, gust: 0.5 }, fans: [{ x: 520, y: 880, w: 200, h: 240, fx: -380, fy: -600 }],
  },
  {
    id: 'w2-5', index: 9, world: 1, name: 'Windmill', material: 'leaves', targets: [{ shape: 'windmill', x: 360, y: 560, size: 5.8 }],
    grain: 16, surplus: 0.4, time: 105, goals: goals(0.6, 0.73, 0.85), parSwipes: 20, spawn: { kind: 'pile' },
    breeze: { x: 70, y: 0, gust: 0.7 },
    fans: [
      { x: 0, y: 900, w: 200, h: 220, fx: 450, fy: -650 },
      { x: 520, y: 900, w: 200, h: 220, fx: -450, fy: -650 },
    ],
  },

  // ------------------------------------------------------------------ World 3: Snow
  {
    id: 'w3-1', index: 10, world: 2, name: 'Snowball', material: 'snow', targets: [{ shape: 'snowball', x: 360, y: 640, size: 3 }],
    grain: 17, surplus: 0.6, time: 95, goals: goals(0.6, 0.73, 0.85), parSwipes: 12, spawn: { kind: 'pile' },
    sinks: [{ x: 360, y: 1252, rx: 105, ry: 40 }], tip: 'Snow that lands in the icy pond melts away. Blow carefully!',
  },
  {
    id: 'w3-2', index: 11, world: 2, name: 'Snowman', material: 'snow', targets: [{ shape: 'snowman', x: 360, y: 640, size: 5.2 }],
    grain: 17, surplus: 0.45, time: 100, goals: goals(0.6, 0.73, 0.85), parSwipes: 16, spawn: { kind: 'pile' },
    walls: [
      { x: 70, y: 420, w: 150, h: 30 },
      { x: 500, y: 420, w: 150, h: 30 },
    ],
    sinks: [{ x: 120, y: 1250, rx: 110, ry: 40 }],
  },
  {
    id: 'w3-3', index: 12, world: 2, name: 'Pine Tree', material: 'snow', targets: [{ shape: 'pine', x: 360, y: 610, size: 5.6 }],
    grain: 16, surplus: 0.45, time: 100, goals: goals(0.6, 0.73, 0.85), parSwipes: 16, spawn: { kind: 'pile' },
    energy: { max: 100, regen: 10, costPerPx: 0.035 }, tip: 'Your wind is limited now. Watch the energy meter.',
  },
  {
    id: 'w3-4', index: 13, world: 2, name: 'Penguin', material: 'snow', targets: [{ shape: 'penguin', x: 360, y: 620, size: 5.6 }],
    grain: 16, surplus: 0.5, time: 105, goals: goals(0.61, 0.74, 0.86), parSwipes: 18, spawn: { kind: 'pile' },
    sinks: [
      { x: 100, y: 1252, rx: 85, ry: 38 },
      { x: 620, y: 1252, rx: 85, ry: 38 },
    ],
  },
  {
    id: 'w3-5', index: 14, world: 2, name: 'Mountain Cabin', material: 'snow', targets: [{ shape: 'cabin', x: 360, y: 640, size: 6 }],
    grain: 16, surplus: 0.45, time: 110, goals: goals(0.61, 0.74, 0.86), parSwipes: 20, spawn: { kind: 'pile' },
    energy: { max: 120, regen: 14, costPerPx: 0.03 },
    sinks: [{ x: 360, y: 1255, rx: 95, ry: 38 }],
  },

  // ------------------------------------------------------------------ World 4: Confetti
  {
    id: 'w4-1', index: 15, world: 3, name: 'Star', material: 'confetti', targets: [{ shape: 'star', x: 360, y: 600, size: 4.8 }],
    grain: 17, surplus: 0.55, time: 100, goals: goals(0.6, 0.73, 0.85), parSwipes: 16, spawn: { kind: 'pile' },
    motion: { dx: 60, dy: 0, period: 9 }, tip: 'This target drifts. Keep your sculpture together!',
  },
  {
    id: 'w4-2', index: 16, world: 3, name: 'Cake', material: 'confetti', targets: [{ shape: 'cake', x: 360, y: 640, size: 5.6 }],
    grain: 16, surplus: 0.45, time: 105, goals: goals(0.61, 0.74, 0.86), parSwipes: 18, spawn: { kind: 'scatter' },
    walls: [
      { x: 40, y: 340, w: 170, h: 26 },
      { x: 510, y: 340, w: 170, h: 26 },
    ],
  },
  {
    id: 'w4-3', index: 17, world: 3, name: 'Balloon', material: 'confetti', targets: [{ shape: 'balloon', x: 360, y: 600, size: 5 }],
    grain: 16, surplus: 0.45, time: 100, goals: goals(0.61, 0.74, 0.86), parSwipes: 16, spawn: { kind: 'pile' },
    motion: { dx: 40, dy: 45, period: 8 },
  },
  {
    id: 'w4-4', index: 18, world: 3, name: 'Firework', material: 'confetti',
    targets: [
      { shape: 'firework', x: 240, y: 470, size: 3.6 },
      { shape: 'firework', x: 500, y: 790, size: 3 },
    ],
    grain: 15, surplus: 0.45, time: 110, goals: goals(0.6, 0.73, 0.85), parSwipes: 22, spawn: { kind: 'scatter' },
    tip: 'Two fireworks at once – share the confetti between them.',
  },
  {
    id: 'w4-5', index: 19, world: 3, name: 'Crown', material: 'confetti', targets: [{ shape: 'crown', x: 360, y: 600, size: 6 }],
    grain: 15, surplus: 0.45, time: 110, goals: goals(0.62, 0.75, 0.87), parSwipes: 20, spawn: { kind: 'pile' },
    motion: { dx: 30, dy: 0, period: 6 },
    fans: [
      { x: 0, y: 340, w: 180, h: 220, fx: 500, fy: 120 },
      { x: 540, y: 980, w: 180, h: 220, fx: -500, fy: -200 },
    ],
  },

  // ------------------------------------------------------------------ World 5: Fireflies
  {
    id: 'w5-1', index: 20, world: 4, name: 'Moon', material: 'fireflies', targets: [{ shape: 'moon', x: 360, y: 600, size: 5 }],
    grain: 17, surplus: 0.5, time: 95, goals: goals(0.6, 0.73, 0.85), parSwipes: 16, spawn: { kind: 'scatter' },
    energy: { max: 110, regen: 12, costPerPx: 0.03 }, tip: 'Fireflies wander. Herd them gently into the moon.',
  },
  {
    id: 'w5-2', index: 21, world: 4, name: 'Flower', material: 'fireflies', targets: [{ shape: 'flower', x: 360, y: 610, size: 6 }],
    grain: 16, surplus: 0.5, time: 105, goals: goals(0.61, 0.74, 0.86), parSwipes: 18, spawn: { kind: 'scatter' },
    walls: [
      { x: 60, y: 1000, w: 180, h: 26 },
      { x: 480, y: 1000, w: 180, h: 26 },
    ],
  },
  {
    id: 'w5-3', index: 22, world: 4, name: 'Owl', material: 'fireflies', targets: [{ shape: 'owl', x: 360, y: 600, size: 5.8 }],
    grain: 15, surplus: 0.5, time: 105, goals: goals(0.61, 0.74, 0.86), parSwipes: 18, spawn: { kind: 'scatter' },
    motion: { dx: 60, dy: 0, period: 9 },
  },
  {
    id: 'w5-4', index: 23, world: 4, name: 'Lantern', material: 'fireflies', targets: [{ shape: 'lantern', x: 360, y: 600, size: 6 }],
    grain: 15, surplus: 0.5, time: 110, goals: goals(0.62, 0.75, 0.87), parSwipes: 20, spawn: { kind: 'scatter' },
    walls: [{ x: 300, y: 980, w: 120, h: 26 }],
    sinks: [
      { x: 90, y: 1200, rx: 80, ry: 50 },
      { x: 630, y: 1200, rx: 80, ry: 50 },
    ],
  },
  {
    id: 'w5-5', index: 24, world: 4, name: 'Magical Tree', material: 'fireflies', targets: [{ shape: 'magic-tree', x: 360, y: 600, size: 6.6 }],
    grain: 15, surplus: 0.5, time: 115, goals: goals(0.62, 0.75, 0.87), parSwipes: 22, spawn: { kind: 'scatter' },
    energy: { max: 120, regen: 12, costPerPx: 0.03 }, breeze: { x: 50, y: 0, gust: 0.8 },
  },

  // ------------------------------------------------------------------ World 6: Underwater
  {
    id: 'w6-1', index: 25, world: 5, name: 'Fish', material: 'bubbles', targets: [{ shape: 'fish', x: 360, y: 640, size: 5.4 }],
    grain: 16, surplus: 0.5, time: 100, goals: goals(0.61, 0.74, 0.86), parSwipes: 18, spawn: { kind: 'ceiling' },
    motion: { dx: 70, dy: 0, period: 9 }, breeze: { x: 60, y: 0, gust: 0.6 }, tip: 'Bubbles float up – push them down into the fish.',
  },
  {
    id: 'w6-2', index: 26, world: 5, name: 'Seahorse', material: 'bubbles', targets: [{ shape: 'seahorse', x: 340, y: 660, size: 6.4 }],
    grain: 15, surplus: 0.5, time: 105, goals: goals(0.61, 0.74, 0.86), parSwipes: 20, spawn: { kind: 'ceiling' },
  },
  {
    id: 'w6-3', index: 27, world: 5, name: 'Coral', material: 'bubbles', targets: [{ shape: 'coral', x: 360, y: 700, size: 6.6 }],
    grain: 15, surplus: 0.55, time: 110, goals: goals(0.62, 0.75, 0.87), parSwipes: 20, spawn: { kind: 'ceiling' },
    sinks: [
      { x: 60, y: 560, rx: 50, ry: 70 },
      { x: 660, y: 560, rx: 50, ry: 70 },
    ],
    tip: 'Drains on the sides swallow bubbles. Stay in the middle!',
  },
  {
    id: 'w6-4', index: 28, world: 5, name: 'Submarine', material: 'bubbles', targets: [{ shape: 'submarine', x: 350, y: 660, size: 6.4 }],
    grain: 15, surplus: 0.5, time: 110, goals: goals(0.62, 0.75, 0.87), parSwipes: 20, spawn: { kind: 'ceiling' },
    motion: { dx: 0, dy: 50, period: 8 },
    walls: [{ x: 290, y: 360, w: 150, h: 26 }],
  },
  {
    id: 'w6-5', index: 29, world: 5, name: 'Whale', material: 'bubbles', targets: [{ shape: 'whale', x: 360, y: 680, size: 6.8 }],
    grain: 15, surplus: 0.55, time: 120, goals: goals(0.62, 0.75, 0.87), parSwipes: 24, spawn: { kind: 'ceiling' },
    energy: { max: 130, regen: 13, costPerPx: 0.028 }, breeze: { x: -50, y: 0, gust: 0.8 },
    sinks: [{ x: 360, y: 1240, rx: 200, ry: 50 }],
  },
];

export const LEVELS_PER_WORLD = 5;
