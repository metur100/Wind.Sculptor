import { WORLDS } from '../levels/LevelData';
import type { LevelDefinition, LevelSpawn } from '../levels/LevelDefinition';
import { MATERIAL_IDS, type MaterialId } from '../particles/ParticleMaterial';
import { DAILY_SHAPES, getShape } from '../targets/TargetShapes';
import { hashString, Rng } from '../utils/MathUtils';

/** Local calendar date as YYYY-MM-DD – the daily seed. */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const SPAWN_FOR: Record<MaterialId, LevelSpawn> = {
  sand: { kind: 'pile' },
  leaves: { kind: 'pile' },
  snow: { kind: 'pile' },
  confetti: { kind: 'scatter' },
  fireflies: { kind: 'scatter' },
  bubbles: { kind: 'ceiling' },
};

export type DailyTwist = 'calm' | 'breeze' | 'fans' | 'drift' | 'energy' | 'ponds';

export const TWIST_LABELS: Record<DailyTwist, string> = {
  calm: 'Calm air',
  breeze: 'Crosswind',
  fans: 'Twin fans',
  drift: 'Drifting target',
  energy: 'Limited wind',
  ponds: 'Hungry ponds',
};

/**
 * Builds the daily challenge for a date. The same date always produces the same level on every
 * device (seeded PRNG), with a special shape + material combination and one twist.
 * `variant` produces an alternative level for the same day (bonus daily level).
 */
export function generateDailyLevel(key: string, variant = ''): LevelDefinition & { twist: DailyTwist } {
  const rng = new Rng(hashString(`wind-sculptor:daily:${key}${variant}`));
  const shapeId = rng.pick(DAILY_SHAPES);
  const material = rng.pick(MATERIAL_IDS);
  const world = WORLDS.findIndex((w) => w.material === material);
  const twist = rng.pick<DailyTwist>(['calm', 'breeze', 'fans', 'drift', 'energy', 'ponds']);
  const falls = material !== 'bubbles' && material !== 'fireflies';

  const level: LevelDefinition & { twist: DailyTwist } = {
    id: `daily-${key}${variant ? `-${variant}` : ''}`,
    index: -1,
    world,
    name: getShape(shapeId).name,
    material,
    targets: [{ shape: shapeId, x: 360, y: rng.int(590, 640), size: rng.range(5, 5.6) }],
    grain: 16,
    surplus: 0.5,
    time: 100,
    goals: { one: 0.6, two: 0.73, three: 0.85 },
    parSwipes: 18,
    spawn: SPAWN_FOR[material],
    twist,
    seed: hashString(`seed:${key}${variant}`),
  };

  switch (twist) {
    case 'breeze':
      level.breeze = { x: rng.chance(0.5) ? 70 : -70, y: 0, gust: 0.6 };
      break;
    case 'fans':
      level.fans = [
        { x: 0, y: 880, w: 200, h: 220, fx: 450, fy: falls ? -620 : -200 },
        { x: 520, y: 880, w: 200, h: 220, fx: -450, fy: falls ? -620 : -200 },
      ];
      break;
    case 'drift':
      level.motion = { dx: 50, dy: 0, period: 10 };
      level.time = 110;
      break;
    case 'energy':
      level.energy = { max: 120, regen: 12, costPerPx: 0.03 };
      break;
    case 'ponds':
      level.sinks = falls
        ? [
            { x: 100, y: 1252, rx: 80, ry: 38 },
            { x: 620, y: 1252, rx: 80, ry: 38 },
          ]
        : [
            { x: 60, y: 620, rx: 50, ry: 70 },
            { x: 660, y: 620, rx: 50, ry: 70 },
          ];
      break;
    case 'calm':
      level.time = 90;
      break;
  }
  return level;
}
