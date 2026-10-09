import type Phaser from 'phaser';

import { GameContext } from '../GameContext';
import { COLORS, FONT_FAMILY } from '../utils/Constants';

export interface TextOptions {
  size?: number;
  color?: string;
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
  origin?: [number, number];
  wrapWidth?: number;
  stroke?: string;
  strokeThickness?: number;
  shadow?: boolean;
  lineSpacing?: number;
}

/** Creates crisp text: rendered at the device render scale so it stays sharp when the camera zooms. */
export function addText(scene: Phaser.Scene, x: number, y: number, text: string, options: TextOptions = {}): Phaser.GameObjects.Text {
  const {
    size = 28,
    color = COLORS.inkText,
    weight = '600',
    align = 'center',
    origin = [0.5, 0.5],
    wrapWidth,
    stroke,
    strokeThickness = 0,
    shadow = false,
    lineSpacing = 2,
  } = options;
  const label = scene.add.text(x, y, text, {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align,
    stroke,
    strokeThickness,
    resolution: GameContext.profile?.renderScale ?? 1,
    wordWrap: wrapWidth ? { width: wrapWidth, useAdvancedWrap: true } : undefined,
    lineSpacing,
  });
  label.setOrigin(origin[0], origin[1]);
  if (shadow) label.setShadow(0, 3, 'rgba(36,50,74,0.25)', 6, false, true);
  return label;
}
