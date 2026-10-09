import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles/global.css';

import Phaser from 'phaser';

import { AudioManager } from './game/audio/AudioManager';
import { createGameConfig } from './game/GameConfig';
import { GameContext } from './game/GameContext';
import { installTestHooks } from './game/utils/TestHooks';

GameContext.init();
const game = new Phaser.Game(createGameConfig('game'));

// Stop all sound (and the simulation, via Phaser's own visibility handling) when the page is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) AudioManager.suspend();
  else AudioManager.resume();
});

// Automation hooks for the smoke test – only in dev builds or with ?debug in the URL.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) installTestHooks(game);
