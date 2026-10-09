import Phaser from 'phaser';

import { GameContext } from '../GameContext';
import type { WorldDefinition } from '../levels/LevelDefinition';
import { sceneryTexture } from '../rendering/Scenery';
import { Button } from '../ui/Button';
import { FocusManager } from '../ui/FocusManager';
import { addText } from '../ui/Typography';
import { COLORS } from '../utils/Constants';

/** Announces text to screen readers through an aria-live region in index.html. */
export function announce(text: string): void {
  const region = document.getElementById('sr-status');
  if (region) region.textContent = text;
}

/**
 * Common scene setup. The game is laid out in design units (720 wide); the main camera is zoomed by
 * the device render scale so everything is drawn at full device resolution.
 */
export abstract class BaseScene extends Phaser.Scene {
  W = 720;
  H = 1280;
  /** Render scale (canvas pixels per design unit). */
  k = 1;
  safeTop = 0;
  safeBottom = 0;
  focus!: FocusManager;
  private leaving = false;

  protected setupScene(title?: string): void {
    const profile = GameContext.profile;
    this.W = profile.width;
    this.H = profile.height;
    this.k = profile.renderScale;
    this.safeTop = profile.safeTop;
    this.safeBottom = profile.safeBottom;
    this.leaving = false;
    const cam = this.cameras.main;
    cam.setZoom(this.k);
    cam.centerOn(this.W / 2, this.H / 2);
    this.focus = new FocusManager(this);
    if (!GameContext.reducedMotion) cam.fadeIn(220, 255, 250, 240);
    if (title) announce(title);
    (window as unknown as { __wsScene?: string }).__wsScene = this.scene.key;
  }

  /** Fade out and switch scene. */
  go(key: string, data?: object): void {
    if (this.leaving) return;
    this.leaving = true;
    const start = () => this.scene.start(key, data);
    if (GameContext.reducedMotion) {
      start();
      return;
    }
    this.cameras.main.fadeOut(160, 255, 250, 240);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, start);
  }

  protected addScenery(world: WorldDefinition, dim = 0): Phaser.GameObjects.Image {
    const key = sceneryTexture(this, world, this.W, this.H, Math.min(this.k, 1.5));
    const image = this.add.image(0, 0, key).setOrigin(0).setDisplaySize(this.W, this.H);
    if (dim > 0) this.add.rectangle(0, 0, this.W, this.H, 0xffffff, dim).setOrigin(0);
    return image;
  }

  /** Back button + centred title along the top safe edge. Returns the y below the header. */
  protected addHeader(title: string, onBack: () => void, color: string = COLORS.inkText): number {
    const y = this.safeTop + 70;
    new Button(this, { x: 66, y, width: 96, height: 84, icon: 'back', variant: 'secondary', onClick: onBack, focus: this.focus });
    addText(this, this.W / 2, y, title, { size: 46, weight: '700', color });
    this.focus.onBack = onBack;
    return y + 70;
  }

  /** Visible, named, clickable widgets of this scene – used by the automated smoke test. */
  listButtons(): NamedWidget[] {
    const found: NamedWidget[] = [];
    const visit = (list: Phaser.GameObjects.GameObject[]) => {
      for (const obj of list) {
        const widget = obj as Partial<NamedWidget>;
        if (typeof widget.accessibleName === 'string' && widget.visible && obj.input?.enabled) found.push(obj as NamedWidget);
        if (obj instanceof Phaser.GameObjects.Container) visit(obj.list);
      }
    };
    visit(this.children.list);
    return found;
  }
}

/** Any clickable container with a readable name (buttons, cards, tiles, toggles). */
export interface NamedWidget extends Phaser.GameObjects.Container {
  accessibleName: string;
}
