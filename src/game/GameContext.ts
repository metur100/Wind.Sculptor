import { AudioManager } from './audio/AudioManager';
import { refreshDerived } from './progression/ProgressionManager';
import { browserStorage, SaveManager, type SaveData, type Settings } from './progression/SaveManager';
import { createDeviceProfile, PerformanceGovernor, type DeviceProfile } from './utils/DeviceUtils';
import { Haptics } from './utils/Haptics';

/**
 * Shared, engine-independent game state: device profile, save data and settings.
 * Scenes read `GameContext.save` and write through `update()`, which persists immediately.
 */
class GameContextImpl {
  profile!: DeviceProfile;
  governor!: PerformanceGovernor;
  private manager!: SaveManager;
  private data!: SaveData;

  init(): void {
    this.profile = createDeviceProfile();
    this.governor = new PerformanceGovernor(this.profile);
    this.manager = new SaveManager(browserStorage());
    this.data = refreshDerived(this.manager.load());
    if (this.profile.prefersReducedMotion && !this.data.tutorialDone && this.data.stats.sculptures === 0) {
      // First launch on a device that asks for less motion: start with reduced motion on.
      this.data = { ...this.data, settings: { ...this.data.settings, reducedMotion: true } };
    }
    this.applySettings();
    this.manager.save(this.data);
  }

  get save(): SaveData {
    return this.data;
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get reducedMotion(): boolean {
    return this.data.settings.reducedMotion;
  }

  update(next: SaveData): void {
    this.data = refreshDerived(next);
    this.manager.save(this.data);
  }

  updateSettings(patch: Partial<Settings>): void {
    this.update({ ...this.data, settings: { ...this.data.settings, ...patch } });
    this.applySettings();
  }

  resetProgress(): void {
    const settings = this.data.settings;
    const fresh = this.manager.reset();
    // Settings are preferences, not progress – keep them.
    this.update({ ...fresh, settings });
  }

  private applySettings(): void {
    AudioManager.setSound(this.data.settings.sound);
    AudioManager.setMusic(this.data.settings.music);
    Haptics.enabled = this.data.settings.vibration;
  }
}

export const GameContext = new GameContextImpl();
