import type Phaser from 'phaser';

/** Anything that can receive keyboard focus. */
export interface Focusable {
  readonly focusable: boolean;
  setFocused(focused: boolean): void;
  activate(): void;
  /** Screen position, used for arrow-key navigation. */
  readonly x: number;
  readonly y: number;
}

/**
 * Keyboard navigation for canvas UI: Tab / Shift+Tab and the arrow keys move focus, Enter or Space
 * activates, Escape goes back. Modals push a layer so focus stays inside them.
 */
export class FocusManager {
  private layers: Focusable[][] = [[]];
  private index = -1;
  /** Called on Escape / Backspace when no modal is open. */
  onBack: (() => void) | null = null;
  /** When false, arrow keys are left to the scene (gameplay uses them for wind). */
  arrowsNavigate = true;
  private readonly keyHandler: (event: KeyboardEvent) => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.keyHandler = (event) => this.onKey(event);
    scene.input.keyboard?.on('keydown', this.keyHandler);
    scene.events.once('shutdown', () => this.destroy());
  }

  private get items(): Focusable[] {
    return this.layers[this.layers.length - 1];
  }

  add(item: Focusable): void {
    this.items.push(item);
  }

  remove(item: Focusable): void {
    for (const layer of this.layers) {
      const i = layer.indexOf(item);
      if (i >= 0) layer.splice(i, 1);
    }
  }

  pushLayer(onBack?: () => void): void {
    this.blur();
    this.layers.push([]);
    this.layerBack.push(onBack ?? null);
  }

  popLayer(): void {
    if (this.layers.length <= 1) return;
    this.blur();
    this.layers.pop();
    this.layerBack.pop();
  }

  private layerBack: ((() => void) | null)[] = [null];

  get hasModal(): boolean {
    return this.layers.length > 1;
  }

  focus(item: Focusable): void {
    const i = this.items.indexOf(item);
    if (i < 0) return;
    this.blur();
    this.index = i;
    item.setFocused(true);
  }

  blur(): void {
    const current = this.items[this.index];
    if (current) current.setFocused(false);
    this.index = -1;
  }

  private move(delta: number): void {
    const items = this.items.filter((i) => i.focusable);
    if (items.length === 0) return;
    const current = this.items[this.index];
    let pos = current ? items.indexOf(current) : -1;
    pos = pos < 0 ? (delta > 0 ? 0 : items.length - 1) : (pos + delta + items.length) % items.length;
    this.focus(items[pos]);
  }

  /** Spatial navigation: nearest focusable in the arrow's direction. */
  private moveSpatial(dx: number, dy: number): void {
    const current = this.items[this.index];
    if (!current) {
      this.move(1);
      return;
    }
    let best: Focusable | null = null;
    let bestScore = Infinity;
    for (const item of this.items) {
      if (item === current || !item.focusable) continue;
      const vx = item.x - current.x;
      const vy = item.y - current.y;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }
    if (best) this.focus(best);
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.scene.scene.isActive()) return;
    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        this.move(event.shiftKey ? -1 : 1);
        break;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'ArrowRight':
        if (!this.arrowsNavigate && !this.hasModal) return;
        event.preventDefault();
        this.moveSpatial(
          event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0,
          event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0,
        );
        break;
      case 'Enter':
      case ' ': {
        const current = this.items[this.index];
        if (current?.focusable) {
          event.preventDefault();
          current.activate();
        }
        break;
      }
      case 'Escape':
      case 'Backspace': {
        const back = this.hasModal ? this.layerBack[this.layerBack.length - 1] : this.onBack;
        if (back) {
          event.preventDefault();
          back();
        }
        break;
      }
    }
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.layers = [[]];
    this.layerBack = [null];
  }
}
