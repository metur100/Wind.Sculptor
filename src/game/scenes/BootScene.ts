import { ensureFxTextures } from '../rendering/TextureFactory';
import { BaseScene } from './BaseScene';

/** First scene: prepares the few textures the loading screen itself needs. */
export class BootScene extends BaseScene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.setupScene();
    ensureFxTextures(this);
    this.scene.start('Loading');
  }
}
