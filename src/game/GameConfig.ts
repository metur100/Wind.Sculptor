import Phaser from 'phaser';

import { GameContext } from './GameContext';
import { BootScene } from './scenes/BootScene';
import { CollectionScene } from './scenes/CollectionScene';
import { GameplayScene } from './scenes/GameplayScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { LoadingScene } from './scenes/LoadingScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TutorialScene } from './scenes/TutorialScene';
import { WorldSelectScene } from './scenes/WorldSelectScene';

/**
 * Phaser configuration. The canvas is (design size × render scale) pixels and is fitted into the
 * window with FIT scaling; every scene zooms its camera by the render scale (see BaseScene).
 */
export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  const { width, height, renderScale, lowEnd } = GameContext.profile;
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#fff6ea',
    width: Math.round(width * renderScale),
    height: Math.round(height * renderScale),
    scale: {
      mode: Phaser.Scale.FIT,
      // global.css centres the canvas with flexbox.
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: lowEnd ? 'low-power' : 'high-performance',
    },
    // All audio is synthesised by AudioManager.
    audio: { noAudio: true },
    input: { activePointers: 2, keyboard: true },
    fps: { target: 60, smoothStep: true },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, LoadingScene, MenuScene, TutorialScene, WorldSelectScene, LevelSelectScene, GameplayScene, ResultScene, CollectionScene, SettingsScene],
  };
}
