import type { FanZone, RectZone, SinkZone } from '../particles/ParticleSystem';
import type { MaterialId } from '../particles/ParticleMaterial';
import type { WindEnergy } from '../particles/WindField';
import type { TargetPlacement } from '../targets/TargetDefinition';
import type { StarGoals } from '../targets/ScoreCalculator';

/**
 * Levels are authored on a 720 × 1280 "stage". The play area starts below the HUD at y = 150;
 * LevelManager re-centres the stage vertically on taller or shorter screens.
 */
export const STAGE_WIDTH = 720;
export const STAGE_HEIGHT = 1280;
export const STAGE_PLAY_TOP = 150;

export type LevelSpawn =
  | { kind: 'pile'; from?: number; to?: number }
  | { kind: 'ceiling'; from?: number; to?: number }
  | { kind: 'cloud'; x: number; y: number; rx: number; ry: number }
  | { kind: 'scatter' };

export interface WorldTheme {
  /** Sky gradient top → bottom. */
  skyTop: number;
  skyBottom: number;
  /** Scenery colours (hills, silhouettes). */
  far: number;
  near: number;
  /** Target silhouette fill and outline. */
  targetFill: number;
  targetLine: number;
  /** UI accent for this world. */
  accent: number;
  /** HUD text colour (CSS) that reads well on the sky. */
  text: string;
  /** Wall / block colours. */
  wall: number;
  wallEdge: number;
  /** Sink (pond / drain) colour. */
  sink: number;
}

export interface WorldDefinition {
  id: number;
  key: string;
  name: string;
  tagline: string;
  material: MaterialId;
  /** Total stars needed (in addition to finishing the previous world) to enter. */
  starsRequired: number;
  scenery: 'desert' | 'park' | 'winter' | 'festival' | 'night' | 'ocean';
  theme: WorldTheme;
}

export interface LevelDefinition {
  /** Stable id used in save data, e.g. "w1-3" or "daily-2026-10-09". */
  id: string;
  /** Campaign index 0..29 (-1 for the daily challenge and tutorial). */
  index: number;
  world: number;
  name: string;
  material: MaterialId;
  /** One or more target zones (multiple = several sculptures at once). */
  targets: TargetPlacement[];
  /** Desired particle spacing in px – smaller means more particles. */
  grain: number;
  /** Extra particles beyond what exactly fills the target (0.3 = 30 % spare). */
  surplus: number;
  /** Seconds. */
  time: number;
  goals: StarGoals;
  /** Swipes a tidy player needs – more costs a little efficiency score. */
  parSwipes: number;
  spawn: LevelSpawn;
  walls?: RectZone[];
  fans?: FanZone[];
  sinks?: SinkZone[];
  breeze?: { x: number; y: number; gust?: number };
  energy?: WindEnergy;
  /** Moving target: offset = (dx, dy) · sin(2π t / period). */
  motion?: { dx: number; dy: number; period: number };
  /** Short tip shown when the level starts (introduces new mechanics). */
  tip?: string;
  seed?: number;
}
