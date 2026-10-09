import Phaser from 'phaser';

import { COLORS } from '../utils/Constants';
import { Button, type ButtonVariant } from './Button';
import type { FocusManager } from './FocusManager';
import type { IconName } from './Icons';
import { addText } from './Typography';

export interface ModalAction {
  label: string;
  icon?: IconName;
  variant?: ButtonVariant;
  onClick: () => void;
}

export interface ModalOptions {
  title: string;
  message?: string;
  actions: ModalAction[];
  /** Called on Escape / tapping outside. Defaults to closing. */
  onDismiss?: () => void;
  width?: number;
}

/**
 * Centred dialog over a dimmed backdrop. Blocks input to everything below it and keeps keyboard focus
 * inside until closed.
 */
export class Modal extends Phaser.GameObjects.Container {
  private closed = false;

  constructor(
    scene: Phaser.Scene,
    private readonly focus: FocusManager | null,
    options: ModalOptions,
    screen: { width: number; height: number },
  ) {
    super(scene, 0, 0);
    const width = options.width ?? Math.min(600, screen.width - 60);
    const dismiss = options.onDismiss ?? (() => this.close());

    const dim = scene.add.rectangle(0, 0, screen.width, screen.height, COLORS.ink, 0.55).setOrigin(0);
    dim.setInteractive();
    dim.on('pointerup', () => dismiss());
    this.add(dim);

    focus?.pushLayer(dismiss);

    const title = addText(scene, 0, 0, options.title, { size: 40, weight: '700', wrapWidth: width - 60 });
    const message = options.message
      ? addText(scene, 0, 0, options.message, { size: 26, weight: '500', color: COLORS.muted, wrapWidth: width - 70, lineSpacing: 6 })
      : null;
    const buttonHeight = 88;
    const gap = 18;
    const contentHeight = title.height + (message ? message.height + 22 : 0) + options.actions.length * (buttonHeight + gap) + 40;
    const height = contentHeight + 50;

    const panel = scene.add.container(screen.width / 2, screen.height / 2);
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.12);
    bg.fillRoundedRect(-width / 2, -height / 2 + 10, width, height, 34);
    bg.fillStyle(COLORS.panel, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 34);
    // Swallow taps on the panel so they do not reach the backdrop.
    const blocker = scene.add.zone(0, 0, width, height).setInteractive();
    panel.add([blocker, bg]);

    let y = -height / 2 + 45 + title.height / 2;
    title.setPosition(0, y);
    panel.add(title);
    y += title.height / 2 + 22;
    if (message) {
      message.setPosition(0, y + message.height / 2);
      panel.add(message);
      y += message.height + 30;
    } else {
      y += 10;
    }
    options.actions.forEach((action) => {
      const button = new Button(scene, {
        x: 0,
        y: y + buttonHeight / 2,
        width: width - 80,
        height: buttonHeight,
        label: action.label,
        icon: action.icon,
        variant: action.variant ?? 'secondary',
        focus: focus ?? undefined,
        onClick: () => {
          if (this.closed) return;
          action.onClick();
        },
      });
      panel.add(button);
      y += buttonHeight + gap;
    });
    this.add(panel);

    this.setDepth(1000);
    scene.add.existing(this);
    panel.setScale(0.9);
    panel.setAlpha(0);
    scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.focus?.popLayer();
    this.destroy();
  }
}
