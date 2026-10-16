import type Phaser from "phaser";

export const LOCAL_CHARACTER_YELLOW = 0xffd43b;

/** Shared local-player identity; children inherit the actor's visibility and lifetime. */
export class LocalCharacterHighlight {
  readonly glow: Phaser.GameObjects.Ellipse;
  readonly marker: Phaser.GameObjects.Triangle;
  private tag!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.glow = scene.add.ellipse(0, 0, 50, 13, LOCAL_CHARACTER_YELLOW, 0.3);
    this.marker = scene.add.triangle(0, 0, 0, 0, 18, 0, 9, 14, LOCAL_CHARACTER_YELLOW)
      .setStrokeStyle(1.5, 0x000000);
  }

  apply(container: Phaser.GameObjects.Container, tag: Phaser.GameObjects.Text): void {
    container.addAt(this.glow, 0).add(this.marker).setDepth(26);
    this.styleTag(tag);
  }

  styleTag(tag: Phaser.GameObjects.Text): void {
    this.tag = tag;
    tag.setStyle({ backgroundColor: "#FFD43B", color: "#000000" });
  }

  update(time: number): void {
    const tagTop = this.tag.y - this.tag.displayHeight * this.tag.originY;
    this.marker.setPosition(this.tag.x, tagTop - 4 - this.marker.height / 2 + Math.sin(time / 230) * 4);
  }
}
