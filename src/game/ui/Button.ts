import Phaser from 'phaser';

import { AudioManager } from '../audio/AudioManager';
import { COLORS } from '../utils/Constants';
import { Haptics } from '../utils/Haptics';
import type { Focusable, FocusManager } from './FocusManager';
import { drawIcon, type IconName } from './Icons';
import { addText } from './Typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export interface ButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  fontSize?: number;
  /** Secondary line under the label. */
  subLabel?: string;
  onClick: () => void;
  focus?: FocusManager;
  disabled?: boolean;
  /** Corner radius (defaults to a pill for short buttons). */
  radius?: number;
}

const STYLES: Record<ButtonVariant, { fill: number; shadow: number; text: string; icon: number; border?: number }> = {
  primary: { fill: COLORS.accent, shadow: COLORS.accentDark, text: '#ffffff', icon: 0xffffff },
  success: { fill: 0x3bb273, shadow: 0x2a8a57, text: '#ffffff', icon: 0xffffff },
  secondary: { fill: 0xffffff, shadow: 0xc9d2e0, text: COLORS.inkText, icon: COLORS.ink },
  ghost: { fill: 0xffffff, shadow: 0xffffff, text: COLORS.inkText, icon: COLORS.ink, border: 0xd5dcea },
  danger: { fill: COLORS.bad, shadow: 0xa83a3f, text: '#ffffff', icon: 0xffffff },
};

/** Large, touch-friendly button with press animation, sound, haptics and keyboard focus. */
export class Button extends Phaser.GameObjects.Container implements Focusable {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly label?: Phaser.GameObjects.Text;
  private readonly subLabel?: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Graphics;
  private pressed = false;
  private disabled: boolean;
  private highlighted = false;
  private variant: ButtonVariant;
  readonly options: ButtonOptions;
  /** Text read by the screen-reader announcer and used by automated tests. */
  readonly accessibleName: string;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    super(scene, options.x, options.y);
    this.options = options;
    this.variant = options.variant ?? 'primary';
    this.disabled = options.disabled ?? false;
    this.accessibleName = options.label ?? options.icon ?? 'button';
    const { width, height } = options;

    this.bg = scene.add.graphics();
    this.ring = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();
    this.add([this.ring, this.bg, this.iconGraphics]);

    const style = STYLES[this.variant];
    const fontSize = options.fontSize ?? Math.round(Math.min(34, height * 0.36));
    if (options.label) {
      this.label = addText(scene, 0, 0, options.label, { size: fontSize, color: style.text, weight: '600' });
      this.add(this.label);
      if (options.subLabel) {
        this.subLabel = addText(scene, 0, 0, options.subLabel, { size: Math.round(fontSize * 0.55), color: style.text, weight: '500' });
        this.subLabel.setAlpha(0.85);
        this.add(this.subLabel);
      }
    }

    this.setSize(width, height);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerdown', () => {
      if (this.disabled) return;
      this.pressed = true;
      this.redraw();
    });
    this.on('pointerout', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.redraw();
    });
    this.on('pointerup', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.redraw();
      this.activate();
    });

    this.redraw();
    scene.add.existing(this);
    options.focus?.add(this);
    this.once('destroy', () => options.focus?.remove(this));
  }

  get focusable(): boolean {
    return !this.disabled && this.visible && this.active;
  }

  activate(): void {
    if (this.disabled) return;
    AudioManager.unlock();
    AudioManager.button();
    Haptics.play('tap');
    this.options.onClick();
  }

  setFocused(focused: boolean): void {
    this.ring.clear();
    if (!focused) return;
    const { width, height } = this.options;
    const r = this.radius + 8;
    // A thick dark ring plus a white inner ring: visible on light and dark backgrounds.
    this.ring.lineStyle(6, COLORS.ink, 0.9);
    this.ring.strokeRoundedRect(-width / 2 - 9, -height / 2 - 9, width + 18, height + 18, r);
    this.ring.lineStyle(3, 0xffffff, 1);
    this.ring.strokeRoundedRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10, r - 3);
  }

  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    this.redraw();
    return this;
  }

  /** Pulsing emphasis (e.g. the Finish button once the goal is reached). */
  setHighlighted(on: boolean): this {
    if (on === this.highlighted) return this;
    this.highlighted = on;
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);
    if (on) this.scene.tweens.add({ targets: this, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return this;
  }

  setVariant(variant: ButtonVariant): this {
    this.variant = variant;
    const style = STYLES[variant];
    this.label?.setColor(style.text);
    this.subLabel?.setColor(style.text);
    this.redraw();
    return this;
  }

  setLabel(text: string): this {
    this.label?.setText(text);
    this.redraw();
    return this;
  }

  setSubLabel(text: string): this {
    this.subLabel?.setText(text);
    this.redraw();
    return this;
  }

  private get radius(): number {
    return this.options.radius ?? Math.min(this.options.height / 2, 30);
  }

  private redraw(): void {
    const { width, height, icon } = this.options;
    const style = STYLES[this.variant];
    const r = this.radius;
    const depth = this.pressed ? 2 : 7;
    const g = this.bg;
    g.clear();
    const alpha = this.disabled ? 0.55 : 1;
    if (this.variant !== 'ghost') {
      g.fillStyle(style.shadow, alpha);
      g.fillRoundedRect(-width / 2, -height / 2 + depth, width, height, r);
    }
    const top = -height / 2 + (this.pressed ? 5 : 0);
    g.fillStyle(style.fill, this.variant === 'ghost' ? 0.85 * alpha : alpha);
    g.fillRoundedRect(-width / 2, top, width, height, r);
    if (style.border) {
      g.lineStyle(3, style.border, alpha);
      g.strokeRoundedRect(-width / 2, top, width, height, r);
    }
    // Soft top highlight.
    g.fillStyle(0xffffff, this.variant === 'secondary' || this.variant === 'ghost' ? 0 : 0.16 * alpha);
    g.fillRoundedRect(-width / 2 + 6, top + 4, width - 12, height * 0.38, Math.max(4, r - 6));

    // Icon + label are centred together as one group.
    const offsetY = this.pressed ? 5 : 0;
    const iconSize = icon ? Math.min(height * 0.44, 40) : 0;
    const gap = icon && this.label ? 14 : 0;
    const textWidth = Math.max(this.label?.width ?? 0, this.subLabel?.width ?? 0);
    const left = -(iconSize + gap + textWidth) / 2;
    if (this.label) {
      const textX = left + iconSize + gap + textWidth / 2;
      this.label.setPosition(textX, (this.subLabel ? -this.label.height * 0.3 : -2) + offsetY);
      this.subLabel?.setPosition(textX, this.label.height * 0.42 + offsetY);
      this.label.setAlpha(this.disabled ? 0.7 : 1);
    }
    this.iconGraphics.clear();
    if (icon) drawIcon(this.iconGraphics, icon, left + iconSize / 2, offsetY - 1, iconSize, style.icon, this.disabled ? 0.6 : 1);
  }
}
