import { LEVELS, LEVELS_PER_WORLD, WORLDS } from '../levels/LevelData';
import type { LevelResult } from '../gameplay/LevelSession';
import type { SaveData } from './SaveManager';

/**
 * Unlock rules
 * ------------
 * - Level 1 is always open. Every other level opens when the level before it is completed.
 * - A world opens when the last level of the previous world is completed AND the player has at least
 *   `world.starsRequired` stars in total. (Level 1 of a world is therefore playable exactly when its
 *   world is open.)
 * - Completing a campaign level unlocks its collection card.
 */

export function totalStars(save: SaveData): number {
  let sum = 0;
  for (const level of LEVELS) sum += save.levels[level.id]?.stars ?? 0;
  return sum;
}

export function worldStars(save: SaveData, world: number): number {
  let sum = 0;
  for (const level of LEVELS.slice(world * LEVELS_PER_WORLD, (world + 1) * LEVELS_PER_WORLD)) sum += save.levels[level.id]?.stars ?? 0;
  return sum;
}

export function isCompleted(save: SaveData, levelId: string): boolean {
  return save.levels[levelId]?.completed === true;
}

export function isWorldUnlocked(save: SaveData, world: number): boolean {
  if (world <= 0) return true;
  if (world >= WORLDS.length) return false;
  const lastOfPrevious = LEVELS[world * LEVELS_PER_WORLD - 1];
  return isCompleted(save, lastOfPrevious.id) && totalStars(save) >= WORLDS[world].starsRequired;
}

/** Why a world is still locked – for the world select screen. */
export function worldLockReason(save: SaveData, world: number): string | null {
  if (isWorldUnlocked(save, world)) return null;
  const lastOfPrevious = LEVELS[world * LEVELS_PER_WORLD - 1];
  if (!isCompleted(save, lastOfPrevious.id)) return `Finish ${WORLDS[world - 1].name}`;
  return `Collect ${WORLDS[world].starsRequired} ★ (you have ${totalStars(save)})`;
}

export function isLevelUnlocked(save: SaveData, index: number): boolean {
  if (index < 0 || index >= LEVELS.length) return false;
  const world = Math.floor(index / LEVELS_PER_WORLD);
  if (!isWorldUnlocked(save, world)) return false;
  return index % LEVELS_PER_WORLD === 0 || isCompleted(save, LEVELS[index - 1].id);
}

/** The level the Play button should start: the first unlocked, unfinished level (or the last unlocked one). */
export function nextPlayableLevel(save: SaveData): number {
  let lastUnlocked = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (!isLevelUnlocked(save, i)) continue;
    lastUnlocked = i;
    if (!isCompleted(save, LEVELS[i].id)) return i;
  }
  return lastUnlocked;
}

/** Recomputes the persisted derived fields (stars, unlocked worlds, collection). */
export function refreshDerived(save: SaveData): SaveData {
  const unlockedWorlds = WORLDS.map((w) => w.id).filter((w) => isWorldUnlocked(save, w));
  const collection = LEVELS.filter((l) => isCompleted(save, l.id)).map((l) => l.id);
  return { ...save, totalStars: totalStars(save), unlockedWorlds, collection };
}

export interface RecordOutcome {
  save: SaveData;
  newBest: boolean;
  /** Stars gained compared to the previous best. */
  starsGained: number;
  firstCompletion: boolean;
  /** World ids that became available with this result. */
  worldsUnlocked: number[];
}

/** Applies a campaign level result (immutably). */
export function recordLevelResult(save: SaveData, result: LevelResult, playSeconds: number): RecordOutcome {
  const previous = save.levels[result.levelId] ?? { completed: false, stars: 0, bestScore: 0, plays: 0 };
  const score = result.success ? result.breakdown.score : 0;
  const updated = {
    completed: previous.completed || result.success,
    stars: Math.max(previous.stars, result.stars),
    bestScore: Math.max(previous.bestScore, score),
    plays: previous.plays + 1,
  };
  const before = new Set(WORLDS.map((w) => w.id).filter((w) => isWorldUnlocked(save, w)));
  const next = refreshDerived({
    ...save,
    levels: { ...save.levels, [result.levelId]: updated },
    stats: {
      swipes: save.stats.swipes + result.swipes,
      sculptures: save.stats.sculptures + (result.success ? 1 : 0),
      playSeconds: save.stats.playSeconds + playSeconds,
    },
  });
  return {
    save: next,
    newBest: result.success && score > previous.bestScore,
    starsGained: updated.stars - previous.stars,
    firstCompletion: result.success && !previous.completed,
    worldsUnlocked: next.unlockedWorlds.filter((w) => !before.has(w)),
  };
}

/** Applies a daily challenge result. Consecutive days build a streak. */
export function recordDailyResult(save: SaveData, key: string, result: LevelResult, yesterdayKey: string): SaveData {
  const previous = save.daily.best[key];
  const score = result.success ? result.breakdown.score : 0;
  const best = {
    score: Math.max(previous?.score ?? 0, score),
    stars: Math.max(previous?.stars ?? 0, result.stars),
  };
  let { streak, lastCompleted } = save.daily;
  if (result.success && lastCompleted !== key) {
    streak = lastCompleted === yesterdayKey ? streak + 1 : 1;
    lastCompleted = key;
  }
  // Keep the last 60 days only.
  const entries = Object.entries({ ...save.daily.best, [key]: best })
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 60);
  return {
    ...save,
    daily: { best: Object.fromEntries(entries), streak, lastCompleted },
    stats: { ...save.stats, swipes: save.stats.swipes + result.swipes, sculptures: save.stats.sculptures + (result.success ? 1 : 0) },
  };
}
