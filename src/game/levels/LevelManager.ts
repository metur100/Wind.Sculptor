import type { SimEnvironment, SpawnArea } from '../particles/ParticleSystem';
import type { TargetPlacement } from '../targets/TargetDefinition';
import { TargetMask } from '../targets/TargetMask';
import { hashString } from '../utils/MathUtils';
import { LEVELS, LEVELS_PER_WORLD, WORLDS } from './LevelData';
import { STAGE_HEIGHT, STAGE_PLAY_TOP, type LevelDefinition, type WorldDefinition } from './LevelDefinition';

/** Packing density of settled particles: a filled area needs area / (FILL_DENSITY · spacing²) particles. */
export const FILL_DENSITY = 0.9;
/** Coverage cells are this many spacings wide. */
export const COVERAGE_CELL_FACTOR = 1.3;
export const MIN_PARTICLES = 60;

export interface Viewport {
  width: number;
  height: number;
  /** Top of the play area (below the HUD and any notch). */
  playTop: number;
  /** Bottom of the play area (above the home indicator). */
  playBottom: number;
}

export interface QualityProfile {
  /** Hard cap on particles for this device. */
  maxParticles: number;
}

export interface ResolvedLevel {
  def: LevelDefinition;
  viewport: Viewport;
  placements: TargetPlacement[];
  mask: TargetMask;
  spacing: number;
  particleCount: number;
  env: SimEnvironment;
  spawn: SpawnArea;
  /** Maps a stage y coordinate to the screen. */
  mapY: (y: number) => number;
  seed: number;
}

export function getWorld(id: number): WorldDefinition {
  return WORLDS[Math.max(0, Math.min(WORLDS.length - 1, id))];
}

export function getLevel(index: number): LevelDefinition | undefined {
  return LEVELS[index];
}

export function getLevelById(id: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelsInWorld(world: number): LevelDefinition[] {
  return LEVELS.slice(world * LEVELS_PER_WORLD, (world + 1) * LEVELS_PER_WORLD);
}

export function nextLevel(index: number): LevelDefinition | undefined {
  return LEVELS[index + 1];
}

/**
 * Places a level on the actual screen. Stage x coordinates are used as-is (the design width is fixed);
 * stage y positions are stretched to the available play height while sizes stay untouched, so shapes
 * never distort and ponds stay at the bottom on tall phones.
 */
export function resolveLevel(def: LevelDefinition, viewport: Viewport, quality: QualityProfile): ResolvedLevel {
  const stagePlay = STAGE_HEIGHT - STAGE_PLAY_TOP;
  const scaleY = (viewport.playBottom - viewport.playTop) / stagePlay;
  const mapY = (y: number) => viewport.playTop + (y - STAGE_PLAY_TOP) * scaleY;

  const placements = def.targets.map((t) => ({ ...t, y: mapY(t.y) }));
  const mask = new TargetMask(placements, viewport.width, viewport.height);

  // Particle count follows the target area so every sculpture can be filled evenly.
  let spacing = def.grain;
  const needed = (s: number) => Math.round((mask.area / (FILL_DENSITY * s * s)) * (1 + def.surplus));
  let particleCount = needed(spacing);
  if (particleCount > quality.maxParticles) {
    spacing = Math.sqrt((mask.area * (1 + def.surplus)) / (FILL_DENSITY * quality.maxParticles));
    particleCount = Math.min(quality.maxParticles, needed(spacing));
  }
  particleCount = Math.max(MIN_PARTICLES, particleCount);
  mask.buildCoverage(spacing * COVERAGE_CELL_FACTOR);

  const env: SimEnvironment = {
    bounds: { left: 0, top: viewport.playTop, right: viewport.width, bottom: viewport.playBottom },
    walls: (def.walls ?? []).map((w) => ({ ...w, y: mapY(w.y) })),
    fans: (def.fans ?? []).map((f) => ({ ...f, y: mapY(f.y) })),
    sinks: (def.sinks ?? []).map((s) => ({ ...s, y: Math.min(mapY(s.y), viewport.playBottom - s.ry * 0.4) })),
    breezeX: def.breeze?.x ?? 0,
    breezeY: def.breeze?.y ?? 0,
    gust: def.breeze?.gust ?? 0,
  };

  const spawn: SpawnArea =
    def.spawn.kind === 'pile' || def.spawn.kind === 'ceiling'
      ? { kind: def.spawn.kind, from: def.spawn.from ?? 0, to: def.spawn.to ?? 1 }
      : def.spawn.kind === 'cloud'
        ? { kind: 'cloud', x: def.spawn.x, y: mapY(def.spawn.y), rx: def.spawn.rx, ry: def.spawn.ry }
        : { kind: 'scatter' };

  return { def, viewport, placements, mask, spacing, particleCount, env, spawn, mapY, seed: def.seed ?? hashString(def.id) };
}

/**
 * Offset of a moving target at time t. Starts at (0, 0); a target moving on both axes follows a
 * gentle figure-eight.
 */
export function targetMotionOffset(def: LevelDefinition, t: number, out: { x: number; y: number }): void {
  if (!def.motion) {
    out.x = 0;
    out.y = 0;
    return;
  }
  const w = (2 * Math.PI * t) / def.motion.period;
  out.x = def.motion.dx * Math.sin(w);
  out.y = def.motion.dy * Math.sin(def.motion.dx ? 2 * w : w);
}
