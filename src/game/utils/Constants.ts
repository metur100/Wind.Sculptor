/** Layout is authored for a 720-unit-wide portrait screen; height adapts to the device (see DeviceUtils). */
export const DESIGN_WIDTH = 720;
export const MIN_DESIGN_HEIGHT = 1180;
export const MAX_DESIGN_HEIGHT = 1560;
export const DEFAULT_DESIGN_HEIGHT = 1280;

/** Fixed simulation step (seconds). The sim runs at 60 Hz regardless of the display rate. */
export const SIM_STEP = 1 / 60;
export const MAX_SIM_STEPS_PER_FRAME = 4;

/** Top/bottom HUD bands (design units, before safe-area insets). */
export const HUD_TOP = 150;
export const HUD_BOTTOM = 124;

export const FONT_FAMILY = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';

export const COLORS = {
  ink: 0x24324a,
  inkText: '#24324a',
  cream: 0xfffaf0,
  creamText: '#fffaf0',
  panel: 0xffffff,
  accent: 0xff8a5b,
  accentDark: 0xd9653a,
  good: 0x3bb273,
  goodText: '#2f9c63',
  warn: 0xf2b134,
  bad: 0xe0565b,
  badText: '#c8464b',
  star: 0xffc83d,
  starEmpty: 0xd6dbe4,
  muted: '#6b7890',
} as const;

export const STORAGE_KEY = 'wind-sculptor/save';
