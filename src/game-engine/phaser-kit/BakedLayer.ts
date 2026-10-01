import Phaser from "phaser";

export interface BakeBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * In WebGL, Phaser re-tessellates every Graphics shape on every frame, even if
 * nothing changed. Static art is therefore drawn once with the Graphics API
 * and baked into a texture shown by a single Image — much cheaper on weak
 * devices such as classroom Chromebooks.
 *
 * Gradient fills are WebGL-only and do not survive baking; keep those live.
 */
export class BakedLayer {
  private readonly scene: Phaser.Scene;
  private readonly key: string;
  private readonly depth: number;
  private image: Phaser.GameObjects.Image | null = null;
  private version = 0;

  constructor(scene: Phaser.Scene, key: string, depth: number) {
    this.scene = scene;
    this.key = key;
    this.depth = depth;
  }

  draw(bounds: BakeBounds, paint: (graphics: Phaser.GameObjects.Graphics) => void): void {
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.translateCanvas(-bounds.x, -bounds.y);
    paint(graphics);
    // A fresh key per bake avoids swapping a texture that is still bound this frame.
    const previousKey = this.textureKey();
    this.version += 1;
    graphics.generateTexture(this.textureKey(), Math.max(1, Math.ceil(bounds.width)), Math.max(1, Math.ceil(bounds.height)));
    graphics.destroy();
    if (this.image) this.image.setTexture(this.textureKey()).setPosition(bounds.x, bounds.y);
    else this.image = this.scene.add.image(bounds.x, bounds.y, this.textureKey()).setOrigin(0, 0).setDepth(this.depth);
    if (this.scene.textures.exists(previousKey)) this.scene.textures.remove(previousKey);
  }

  private textureKey(): string {
    return `${this.key}#${this.version}`;
  }
}

/** Bakes a small reusable sprite (drawn from 0,0) once per key. */
export function bakeSprite(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  paint: (graphics: Phaser.GameObjects.Graphics) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  paint(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
  return key;
}
