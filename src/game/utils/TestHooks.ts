import type Phaser from 'phaser';

import { GameContext } from '../GameContext';
import type { PlayField } from '../gameplay/PlayField';
import type { BaseScene } from '../scenes/BaseScene';

interface ButtonInfo {
  label: string;
  /** Page (CSS pixel) coordinates of the button centre. */
  x: number;
  y: number;
  scene: string;
}

/**
 * Small automation API used by scripts/smoke.mjs (Playwright). It only reads state and reports
 * where buttons are – the test still clicks and swipes with real pointer events.
 */
export function installTestHooks(game: Phaser.Game): void {
  const canvasRect = () => game.canvas.getBoundingClientRect();
  const hooks = {
    game,
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    buttons: (): ButtonInfo[] => {
      const rect = canvasRect();
      const scale = rect.width / GameContext.profile.width;
      const out: ButtonInfo[] = [];
      for (const scene of game.scene.getScenes(true) as BaseScene[]) {
        if (typeof scene.listButtons !== 'function') continue;
        const cam = scene.cameras.main;
        for (const button of scene.listButtons()) {
          const m = button.getWorldTransformMatrix();
          // World → design screen coordinates through the (possibly zoomed) camera.
          const zoom = cam.zoom / GameContext.profile.renderScale;
          const sx = (m.tx - cam.midPoint.x) * zoom + GameContext.profile.width / 2;
          const sy = (m.ty - cam.midPoint.y) * zoom + GameContext.profile.height / 2;
          out.push({ label: button.accessibleName, x: rect.left + sx * scale, y: rect.top + sy * scale, scene: scene.scene.key });
        }
      }
      return out;
    },
    /** Design coordinates → page coordinates. */
    toPage: (x: number, y: number) => {
      const rect = canvasRect();
      const scale = rect.width / GameContext.profile.width;
      return { x: rect.left + x * scale, y: rect.top + y * scale };
    },
    gameplay: () => {
      const field = (game.scene.getScene('Gameplay') as unknown as { field?: PlayField }).field;
      if (!field || !game.scene.isActive('Gameplay')) return null;
      return {
        levelId: field.level.def.id,
        swipes: field.wind.swipes,
        match: field.session.match,
        state: field.session.state,
        timeLeft: field.session.timeLeft,
        elapsed: field.session.elapsed,
        bounds: field.level.mask.bounds,
      };
    },
    /** Jump straight to a scene (used to load every level in turn). */
    start: (key: string, data?: object) => {
      for (const scene of game.scene.getScenes(true)) if (scene.scene.key !== key) scene.scene.stop();
      game.scene.start(key, data);
    },
    particles: () => {
      const scene = game.scene.getScene('Gameplay') as unknown as { field?: { system: { activeCount: number; total: number } } };
      return scene.field ? { active: scene.field.system.activeCount, total: scene.field.system.total } : null;
    },
    save: () => GameContext.save,
    profile: () => GameContext.profile,
  };
  (window as unknown as { __WS__: typeof hooks }).__WS__ = hooks;
}
