import Phaser from "phaser";

/**
 * RESIZE mode follows the parent element. While layouts settle, or when a
 * parent is briefly collapsed, that size can hit 0 and WebGL throws
 * "Framebuffer status: Incomplete Attachment". A minimum size prevents it.
 */
export function resizeScaleConfig(): Phaser.Types.Core.ScaleConfig {
  return { mode: Phaser.Scale.RESIZE, min: { width: 64, height: 64 } };
}
