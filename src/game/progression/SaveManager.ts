import { STORAGE_KEY } from '../utils/Constants';

/**
 * Versioned local save data.
 *
 * Every save carries a `version`. On load, older versions are migrated step by step (see MIGRATIONS)
 * and then every field is sanitised, so a damaged or hand-edited save can never crash the game –
 * unknown or broken fields simply fall back to defaults. Saves from a newer game version are read as
 * far as possible but never overwritten with less data.
 */
export const SAVE_VERSION = 2;

export interface LevelRecord {
  completed: boolean;
  stars: number;
  bestScore: number;
  plays: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  reducedMotion: boolean;
}

export interface DailyRecord {
  score: number;
  stars: number;
}

export interface SaveData {
  version: number;
  tutorialDone: boolean;
  levels: Record<string, LevelRecord>;
  /** Derived but persisted for quick reads and analytics. Recomputed on every load. */
  totalStars: number;
  unlockedWorlds: number[];
  /** Collection card ids (= campaign level ids) the player has unlocked. */
  collection: string[];
  settings: Settings;
  daily: {
    best: Record<string, DailyRecord>;
    streak: number;
    lastCompleted: string | null;
  };
  stats: { swipes: number; sculptures: number; playSeconds: number };
  /** Monetisation entitlements (see MonetizationManager). */
  entitlements: { removeAds: boolean; particlePacks: string[]; bonusDaily: boolean };
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, music: true, vibration: true, reducedMotion: false };

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    tutorialDone: false,
    levels: {},
    totalStars: 0,
    unlockedWorlds: [0],
    collection: [],
    settings: { ...DEFAULT_SETTINGS },
    daily: { best: {}, streak: 0, lastCompleted: null },
    stats: { swipes: 0, sculptures: 0, playSeconds: 0 },
    entitlements: { removeAds: false, particlePacks: [], bonusDaily: false },
  };
}

type RawSave = Record<string, unknown>;

/**
 * Version 1 (first prototype) stored stars and best scores in two flat maps and only a sound flag:
 *   { version: 1, stars: { "w1-1": 2 }, best: { "w1-1": 640 }, sound: true, tutorial: true }
 */
const MIGRATIONS: Record<number, (raw: RawSave) => RawSave> = {
  1: (raw) => {
    const stars = isRecord(raw.stars) ? raw.stars : {};
    const best = isRecord(raw.best) ? raw.best : {};
    const levels: Record<string, LevelRecord> = {};
    for (const id of new Set([...Object.keys(stars), ...Object.keys(best)])) {
      const s = num(stars[id], 0);
      levels[id] = { completed: s > 0, stars: s, bestScore: num(best[id], 0), plays: s > 0 ? 1 : 0 };
    }
    return {
      version: 2,
      tutorialDone: raw.tutorial === true,
      levels,
      settings: { ...DEFAULT_SETTINGS, sound: raw.sound !== false },
    };
  },
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Turns any parsed JSON into a valid SaveData (migrating old versions first). */
export function migrateAndSanitize(input: unknown): SaveData {
  const base = createDefaultSave();
  if (!isRecord(input)) return base;
  let raw: RawSave = input;
  let version = num(raw.version, 1);
  while (version < SAVE_VERSION && MIGRATIONS[version]) {
    raw = MIGRATIONS[version](raw);
    version = num(raw.version, version + 1);
  }

  const levels: Record<string, LevelRecord> = {};
  if (isRecord(raw.levels)) {
    for (const [id, value] of Object.entries(raw.levels)) {
      if (!isRecord(value) || id.length > 64) continue;
      const stars = Math.round(num(value.stars, 0, 0, 3));
      levels[id] = {
        completed: bool(value.completed, stars > 0),
        stars,
        bestScore: Math.round(num(value.bestScore, 0, 0, 1000)),
        plays: Math.round(num(value.plays, 0, 0, 1e7)),
      };
    }
  }
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const daily = isRecord(raw.daily) ? raw.daily : {};
  const dailyBest: Record<string, DailyRecord> = {};
  if (isRecord(daily.best)) {
    for (const [key, value] of Object.entries(daily.best)) {
      if (!/^\d{4}-\d{2}-\d{2}/.test(key) || !isRecord(value)) continue;
      dailyBest[key] = { score: Math.round(num(value.score, 0, 0, 1000)), stars: Math.round(num(value.stars, 0, 0, 3)) };
    }
  }
  const stats = isRecord(raw.stats) ? raw.stats : {};
  const ent = isRecord(raw.entitlements) ? raw.entitlements : {};
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : []);

  return {
    version: Math.max(SAVE_VERSION, version),
    tutorialDone: bool(raw.tutorialDone, false),
    levels,
    totalStars: 0,
    unlockedWorlds: Array.isArray(raw.unlockedWorlds)
      ? [...new Set(raw.unlockedWorlds.filter((w): w is number => Number.isInteger(w) && w >= 0 && w < 64))]
      : [0],
    collection: strings(raw.collection),
    settings: {
      sound: bool(settings.sound, DEFAULT_SETTINGS.sound),
      music: bool(settings.music, DEFAULT_SETTINGS.music),
      vibration: bool(settings.vibration, DEFAULT_SETTINGS.vibration),
      reducedMotion: bool(settings.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    },
    daily: {
      best: dailyBest,
      streak: Math.round(num(daily.streak, 0, 0, 100000)),
      lastCompleted: typeof daily.lastCompleted === 'string' ? daily.lastCompleted : null,
    },
    stats: {
      swipes: Math.round(num(stats.swipes, 0, 0)),
      sculptures: Math.round(num(stats.sculptures, 0, 0)),
      playSeconds: num(stats.playSeconds, 0, 0),
    },
    entitlements: {
      removeAds: bool(ent.removeAds, false),
      particlePacks: strings(ent.particlePacks),
      bonusDaily: bool(ent.bonusDaily, false),
    },
  };
}

/** In-memory storage – used in tests and when localStorage is unavailable (private mode, sandboxed iframes). */
export class MemoryStorage implements StorageAdapter {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export function browserStorage(): StorageAdapter {
  try {
    const probe = '__ws_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}

export class SaveManager {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly key = STORAGE_KEY,
  ) {}

  load(): SaveData {
    let text: string | null;
    try {
      text = this.storage.getItem(this.key);
    } catch {
      return createDefaultSave();
    }
    if (!text) return createDefaultSave();
    try {
      return migrateAndSanitize(JSON.parse(text));
    } catch {
      // Corrupted JSON: keep a copy for support and start fresh.
      try {
        this.storage.setItem(`${this.key}.corrupt`, text);
      } catch {
        /* storage full – nothing else to do */
      }
      return createDefaultSave();
    }
  }

  save(data: SaveData): boolean {
    try {
      this.storage.setItem(this.key, JSON.stringify({ ...data, version: Math.max(SAVE_VERSION, data.version) }));
      return true;
    } catch {
      return false;
    }
  }

  reset(): SaveData {
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* ignore */
    }
    return createDefaultSave();
  }
}
