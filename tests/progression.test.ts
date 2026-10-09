import { describe, expect, it } from 'vitest';

import type { LevelResult } from '../src/game/gameplay/LevelSession';
import { LEVELS, WORLDS } from '../src/game/levels/LevelData';
import { dateKey, generateDailyLevel } from '../src/game/progression/DailyChallenge';
import {
  isLevelUnlocked,
  isWorldUnlocked,
  nextPlayableLevel,
  recordDailyResult,
  recordLevelResult,
  totalStars,
} from '../src/game/progression/ProgressionManager';
import { createDefaultSave, MemoryStorage, migrateAndSanitize, SAVE_VERSION, SaveManager, type SaveData } from '../src/game/progression/SaveManager';

function result(levelId: string, stars: 0 | 1 | 2 | 3, score = 700): LevelResult {
  return {
    levelId,
    success: stars > 0,
    stars,
    reason: 'finished',
    breakdown: { coverage: 0.8, accuracy: 0.8, time: 0.5, efficiency: 1, match: 0.8, score },
    measure: { coverage: 0.8, inside: 0.8, meanDistance: 0, lost: 0, total: 100 },
    timeLeft: 30,
    timeLimit: 90,
    swipes: 12,
  };
}

function complete(save: SaveData, count: number, stars: 1 | 2 | 3 = 1): SaveData {
  let s = save;
  for (let i = 0; i < count; i++) s = recordLevelResult(s, result(LEVELS[i].id, stars), 30).save;
  return s;
}

describe('Save and load', () => {
  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage, 'test');
    const save = complete(createDefaultSave(), 3, 2);
    manager.save({ ...save, settings: { ...save.settings, music: false } });
    const loaded = manager.load();
    expect(loaded.levels['w1-2']).toEqual({ completed: true, stars: 2, bestScore: 700, plays: 1 });
    expect(loaded.settings.music).toBe(false);
    expect(loaded.version).toBe(SAVE_VERSION);
  });

  it('starts fresh when nothing is stored', () => {
    expect(new SaveManager(new MemoryStorage()).load()).toEqual(createDefaultSave());
  });

  it('survives corrupted JSON and keeps a backup copy', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', '{not json');
    const loaded = new SaveManager(storage, 'k').load();
    expect(loaded).toEqual(createDefaultSave());
    expect(storage.getItem('k.corrupt')).toBe('{not json');
  });

  it('sanitises invalid fields instead of crashing', () => {
    const loaded = migrateAndSanitize({
      version: 2,
      levels: { 'w1-1': { stars: 99, bestScore: -5, completed: 'yes' }, bad: 'x' },
      settings: { sound: 'loud', music: false },
      daily: { best: { '2026-10-09': { score: 5000, stars: 2 }, nonsense: { score: 1 } }, streak: -3 },
    });
    expect(loaded.levels['w1-1']).toEqual({ completed: true, stars: 3, bestScore: 0, plays: 0 });
    expect(loaded.levels.bad).toBeUndefined();
    expect(loaded.settings.sound).toBe(true);
    expect(loaded.settings.music).toBe(false);
    expect(loaded.daily.best['2026-10-09']).toEqual({ score: 1000, stars: 2 });
    expect(loaded.daily.best.nonsense).toBeUndefined();
    expect(loaded.daily.streak).toBe(0);
  });

  it('migrates version 1 saves', () => {
    const loaded = migrateAndSanitize({ version: 1, stars: { 'w1-1': 2 }, best: { 'w1-1': 640 }, sound: false, tutorial: true });
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.tutorialDone).toBe(true);
    expect(loaded.settings.sound).toBe(false);
    expect(loaded.levels['w1-1']).toEqual({ completed: true, stars: 2, bestScore: 640, plays: 1 });
  });

  it('keeps the best result when replaying worse', () => {
    let save = recordLevelResult(createDefaultSave(), result('w1-1', 3, 900), 10).save;
    const outcome = recordLevelResult(save, result('w1-1', 1, 400), 10);
    save = outcome.save;
    expect(save.levels['w1-1']).toMatchObject({ stars: 3, bestScore: 900, plays: 2 });
    expect(outcome.newBest).toBe(false);
  });
});

describe('Level unlock rules', () => {
  it('only the first level is open on a fresh save', () => {
    const save = createDefaultSave();
    expect(isLevelUnlocked(save, 0)).toBe(true);
    expect(isLevelUnlocked(save, 1)).toBe(false);
    expect(nextPlayableLevel(save)).toBe(0);
  });

  it('completing a level opens the next one and unlocks its card', () => {
    const outcome = recordLevelResult(createDefaultSave(), result('w1-1', 1), 20);
    expect(isLevelUnlocked(outcome.save, 1)).toBe(true);
    expect(outcome.firstCompletion).toBe(true);
    expect(outcome.save.collection).toContain('w1-1');
    expect(nextPlayableLevel(outcome.save)).toBe(1);
  });

  it('a failed attempt unlocks nothing', () => {
    const save = recordLevelResult(createDefaultSave(), result('w1-1', 0, 0), 20).save;
    expect(isLevelUnlocked(save, 1)).toBe(false);
    expect(save.collection).toEqual([]);
  });

  it('a world needs the previous world finished and enough stars', () => {
    let save = complete(createDefaultSave(), 5, 1); // 5 stars
    expect(isWorldUnlocked(save, 1)).toBe(WORLDS[1].starsRequired <= 5);
    save = complete(save, 10, 1); // world 2 finished with 10 stars
    expect(totalStars(save)).toBe(10);
    expect(isWorldUnlocked(save, 2)).toBe(false); // needs 12
    expect(isLevelUnlocked(save, 10)).toBe(false);
    save = complete(save, 10, 2); // replay for 20 stars
    expect(isWorldUnlocked(save, 2)).toBe(true);
    expect(isLevelUnlocked(save, 10)).toBe(true);
    expect(save.unlockedWorlds).toEqual([0, 1, 2]);
  });

  it('reports newly unlocked worlds', () => {
    const save = complete(createDefaultSave(), 4, 2);
    const outcome = recordLevelResult(save, result(LEVELS[4].id, 2), 10);
    expect(outcome.worldsUnlocked).toEqual([1]);
  });
});

describe('Daily challenge', () => {
  it('is deterministic for a date', () => {
    expect(generateDailyLevel('2026-10-09')).toEqual(generateDailyLevel('2026-10-09'));
  });

  it('changes from day to day', () => {
    const days = Array.from({ length: 14 }, (_, i) => generateDailyLevel(`2026-11-${String(i + 1).padStart(2, '0')}`));
    const combos = new Set(days.map((d) => `${d.targets[0].shape}/${d.material}/${d.twist}`));
    expect(combos.size).toBeGreaterThan(8);
  });

  it('uses local calendar dates as keys', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('stores the best daily score and builds a streak on consecutive days', () => {
    let save = createDefaultSave();
    save = recordDailyResult(save, '2026-10-08', result('daily-2026-10-08', 2, 600), '2026-10-07');
    save = recordDailyResult(save, '2026-10-09', result('daily-2026-10-09', 1, 500), '2026-10-08');
    save = recordDailyResult(save, '2026-10-09', result('daily-2026-10-09', 3, 800), '2026-10-08');
    expect(save.daily.best['2026-10-09']).toEqual({ score: 800, stars: 3 });
    expect(save.daily.streak).toBe(2);
    save = recordDailyResult(save, '2026-10-12', result('daily-2026-10-12', 1, 300), '2026-10-11');
    expect(save.daily.streak).toBe(1);
  });
});
