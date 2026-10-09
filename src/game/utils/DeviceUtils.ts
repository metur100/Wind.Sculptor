import { DEFAULT_DESIGN_HEIGHT, DESIGN_WIDTH, MAX_DESIGN_HEIGHT, MIN_DESIGN_HEIGHT } from './Constants';
import { clamp } from './MathUtils';

export interface DeviceProfile {
  /** Logical (design) size of the game – width is always 720. */
  width: number;
  height: number;
  /** Render scale: canvas pixels per design unit (device-pixel-ratio aware, capped for performance). */
  renderScale: number;
  /** Safe-area insets (notch / home indicator) in design units. */
  safeTop: number;
  safeBottom: number;
  lowEnd: boolean;
  touch: boolean;
  /** Particle cap for this device. */
  maxParticles: number;
  prefersReducedMotion: boolean;
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

/** Reads `env(safe-area-inset-*)` through a probe element (0 where unsupported). */
function readSafeAreaInsets(): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
  probe.remove();
  return insets;
}

export function detectLowEnd(): boolean {
  const nav = navigator as NavigatorWithMemory;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  return cores <= 4 || memory <= 3;
}

/**
 * Chooses the logical game size for the current window: 720 wide, height following the screen's aspect
 * ratio (clamped so layouts stay sensible). On landscape desktops the game is shown as a centred
 * portrait column at the default 9:16 ratio.
 */
export function createDeviceProfile(): DeviceProfile {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const portrait = vh >= vw;
  const height = portrait ? Math.round(clamp((DESIGN_WIDTH * vh) / vw, MIN_DESIGN_HEIGHT, MAX_DESIGN_HEIGHT)) : DEFAULT_DESIGN_HEIGHT;
  const lowEnd = detectLowEnd();
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // CSS pixels per design unit once the canvas is fitted into the window.
  const cssScale = Math.min(vw / DESIGN_WIDTH, vh / height);
  const dpr = window.devicePixelRatio || 1;
  const maxScale = lowEnd ? 1.5 : 2;
  const renderScale = clamp(Math.round(cssScale * dpr * 4) / 4, 1, maxScale);

  const insets = readSafeAreaInsets();
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  return {
    width: DESIGN_WIDTH,
    height,
    renderScale,
    safeTop: insets.top / cssScale,
    safeBottom: insets.bottom / cssScale,
    lowEnd,
    touch,
    maxParticles: lowEnd ? 520 : 900,
    prefersReducedMotion,
  };
}

/** Simple frame-time monitor: lowers the particle cap when the device cannot keep up. */
export class PerformanceGovernor {
  private samples = 0;
  private total = 0;

  constructor(private readonly profile: DeviceProfile) {}

  record(frameMs: number): void {
    this.samples++;
    this.total += Math.min(frameMs, 100);
    if (this.samples >= 180) {
      const average = this.total / this.samples;
      if (average > 24 && this.profile.maxParticles > 360) {
        this.profile.maxParticles = Math.max(360, Math.round(this.profile.maxParticles * 0.8));
        this.profile.lowEnd = true;
      }
      this.samples = 0;
      this.total = 0;
    }
  }
}
