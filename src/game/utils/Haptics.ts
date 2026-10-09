/**
 * Vibration feedback. Uses the Vibration API where available (Android browsers / WebViews);
 * silently does nothing elsewhere. A native backend (e.g. @capacitor/haptics) can be plugged in
 * with `setBackend` without touching game code.
 */
export type HapticKind = 'gust' | 'shape' | 'success' | 'failure' | 'tap';

export type HapticBackend = (kind: HapticKind) => void;

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  gust: 14,
  shape: [10, 40, 10],
  success: [20, 60, 30, 60, 50],
  failure: [60, 80, 60],
};

const vibrationBackend: HapticBackend = (kind) => {
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    /* not supported */
  }
};

class HapticsController {
  enabled = true;
  private backend: HapticBackend = vibrationBackend;
  private lastGust = 0;

  setBackend(backend: HapticBackend): void {
    this.backend = backend;
  }

  play(kind: HapticKind): void {
    if (!this.enabled) return;
    if (kind === 'gust') {
      // Throttle gust pulses so a long swipe does not buzz continuously.
      const now = performance.now();
      if (now - this.lastGust < 260) return;
      this.lastGust = now;
    }
    this.backend(kind);
  }
}

export const Haptics = new HapticsController();
