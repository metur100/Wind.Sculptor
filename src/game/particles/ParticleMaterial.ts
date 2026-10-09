/** Physical and visual description of every particle material. Pure data – no engine imports. */

export type MaterialId = 'sand' | 'leaves' | 'snow' | 'confetti' | 'fireflies' | 'bubbles';

export type ParticleShape = 'grain' | 'leaf' | 'flake' | 'ribbon' | 'glow' | 'bubble';
export type TrailStyle = 'dust' | 'streak' | 'gust' | 'ribbon' | 'glow' | 'current';

export interface MaterialPhysics {
  /** Downward acceleration (px/s²). Negative values make particles rise (buoyancy). */
  gravity: number;
  /** Exponential velocity damping per second. */
  drag: number;
  maxSpeed: number;
  /** Strength (px/s²) and frequency of the smooth per-particle wobble. */
  turbulence: number;
  turbulenceFreq: number;
  /** Multiplier for wind forces (light materials react more). */
  windResponse: number;
  /** Fraction of velocity kept when bouncing off walls. */
  bounce: number;
  /** Base spin (rad/s) and extra spin per px/s of speed. */
  spin: number;
  spinPerSpeed: number;
}

export interface MaterialVisual {
  label: string;
  shape: ParticleShape;
  /** Each colour is a visual variant of the particle. */
  colors: number[];
  /** Particle drawing size relative to the level's particle spacing. */
  sizeFactor: number;
  /** Number of rotation frames baked into the texture (1 = round particles). */
  rotationFrames: number;
  additive: boolean;
  flicker: boolean;
  trail: { style: TrailStyle; colors: number[]; width: number; alpha: number };
}

export interface ParticleMaterial {
  id: MaterialId;
  physics: MaterialPhysics;
  visual: MaterialVisual;
}

export const MATERIALS: Record<MaterialId, ParticleMaterial> = {
  sand: {
    id: 'sand',
    physics: { gravity: 240, drag: 2.0, maxSpeed: 860, turbulence: 14, turbulenceFreq: 1.1, windResponse: 1, bounce: 0.25, spin: 0, spinPerSpeed: 0 },
    visual: {
      label: 'Sand', shape: 'grain', colors: [0xe9b872, 0xd99a4e, 0xf3d29a, 0xc98a45], sizeFactor: 0.95, rotationFrames: 1,
      additive: false, flicker: false, trail: { style: 'dust', colors: [0xfff4e0], width: 30, alpha: 0.6 },
    },
  },
  leaves: {
    id: 'leaves',
    physics: { gravity: 95, drag: 2.6, maxSpeed: 820, turbulence: 55, turbulenceFreq: 1.6, windResponse: 1.12, bounce: 0.3, spin: 1.4, spinPerSpeed: 0.006 },
    visual: {
      label: 'Leaves', shape: 'leaf', colors: [0xe2622e, 0xf0a030, 0xc8401f, 0xd98a2b, 0xa8572a], sizeFactor: 1.25, rotationFrames: 12,
      additive: false, flicker: false, trail: { style: 'streak', colors: [0xfff3df], width: 5, alpha: 0.55 },
    },
  },
  snow: {
    id: 'snow',
    physics: { gravity: 60, drag: 2.2, maxSpeed: 780, turbulence: 34, turbulenceFreq: 1.2, windResponse: 1.1, bounce: 0.2, spin: 0.6, spinPerSpeed: 0.002 },
    visual: {
      label: 'Snow', shape: 'flake', colors: [0xffffff, 0xeef6ff, 0xdcecff], sizeFactor: 1.05, rotationFrames: 6,
      additive: false, flicker: false, trail: { style: 'gust', colors: [0xffffff], width: 34, alpha: 0.5 },
    },
  },
  confetti: {
    id: 'confetti',
    physics: { gravity: 85, drag: 2.5, maxSpeed: 820, turbulence: 46, turbulenceFreq: 2.0, windResponse: 1.1, bounce: 0.35, spin: 3.2, spinPerSpeed: 0.008 },
    visual: {
      label: 'Confetti', shape: 'ribbon', colors: [0xff5d8f, 0xffc83d, 0x3ec7e0, 0x7a6cf0, 0x5fd38d, 0xff8a3d], sizeFactor: 1.1, rotationFrames: 12,
      additive: false, flicker: false, trail: { style: 'ribbon', colors: [0xff5d8f, 0xffc83d, 0x3ec7e0, 0x7a6cf0], width: 7, alpha: 0.75 },
    },
  },
  fireflies: {
    id: 'fireflies',
    physics: { gravity: 0, drag: 3.2, maxSpeed: 720, turbulence: 85, turbulenceFreq: 0.9, windResponse: 1, bounce: 0.5, spin: 0, spinPerSpeed: 0 },
    visual: {
      label: 'Fireflies', shape: 'glow', colors: [0xfff27a, 0xd8ff7a, 0xffe08a], sizeFactor: 1.6, rotationFrames: 1,
      additive: true, flicker: true, trail: { style: 'glow', colors: [0xf8ff9c], width: 10, alpha: 0.6 },
    },
  },
  bubbles: {
    id: 'bubbles',
    physics: { gravity: -105, drag: 3.0, maxSpeed: 740, turbulence: 40, turbulenceFreq: 1.4, windResponse: 1, bounce: 0.45, spin: 0, spinPerSpeed: 0 },
    visual: {
      label: 'Bubbles', shape: 'bubble', colors: [0xbff3ff, 0x9fe6ff, 0xd8fbff], sizeFactor: 1.15, rotationFrames: 1,
      additive: false, flicker: false, trail: { style: 'current', colors: [0xc8f6ff], width: 18, alpha: 0.5 },
    },
  },
};

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

export function getMaterial(id: MaterialId): ParticleMaterial {
  return MATERIALS[id];
}
