import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../../game-engine/phaser-kit/art.ts";

export const PLATFORM_SPACING = 154;
export const PLATFORM_START_X = 110;
export const PLATFORM_TOP_Y = 304;
export const PLATFORM_WIDTH = 110;

export function worldX(distance: number): number {
  return PLATFORM_START_X + Math.max(0, distance) * PLATFORM_SPACING;
}

/** Floating islands drawn only around the visible stretch of the endless course. */
export class RaceCourse {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(2);
  }

  draw(worldLeft: number, visibleWidth: number, time: number): void {
    const first = Math.max(0, Math.floor((worldLeft - PLATFORM_START_X) / PLATFORM_SPACING) - 1);
    const count = Math.ceil(visibleWidth / PLATFORM_SPACING) + 3;
    this.graphics.clear();
    for (let offset = 0; offset < count; offset += 1) this.drawIsland(first + offset, offset, time);
    for (let index = count; index < this.labels.length; index += 1) this.labels[index]?.setVisible(false);
  }

  private drawIsland(distance: number, slot: number, time: number): void {
    const graphics = this.graphics;
    const centerX = worldX(distance);
    const left = centerX - PLATFORM_WIDTH / 2;
    const top = PLATFORM_TOP_Y;
    const milestone = distance > 0 && distance % 5 === 0;
    const bob = Math.sin(time / 900 + distance) * 1.5;

    // Rocky underside tapering into the mist.
    graphics.fillStyle(0x8b6b4a, 1);
    graphics.fillTriangle(left + 6, top + 10, left + PLATFORM_WIDTH - 6, top + 10, centerX + 6, top + 58 + bob);
    graphics.fillStyle(0xa98158, 1);
    graphics.fillTriangle(left + 14, top + 10, centerX, top + 10, centerX - 4, top + 46 + bob);
    graphics.fillStyle(0x6b4f35, 1).fillRoundedRect(left + 2, top + 8, PLATFORM_WIDTH - 4, 12, 5);

    // Grass cap with a lighter lip.
    const grass = distance === 0 ? 0xfbbf24 : milestone ? 0x4ade80 : 0x6cc56f;
    graphics.fillStyle(0x3f8f46, 1).fillRoundedRect(left, top + 2, PLATFORM_WIDTH, 12, 7);
    graphics.fillStyle(grass, 1).fillRoundedRect(left, top - 2, PLATFORM_WIDTH, 11, 7);
    graphics.fillStyle(0xffffff, 0.35).fillRoundedRect(left + 8, top, PLATFORM_WIDTH - 16, 3, 2);
    for (let tuft = left + 10; tuft < left + PLATFORM_WIDTH - 8; tuft += 18) {
      graphics.fillStyle(0x3f8f46, 1).fillTriangle(tuft, top + 12, tuft + 4, top + 18, tuft + 8, top + 12);
    }

    if (milestone) {
      graphics.fillStyle(0x64748b, 1).fillRect(left + PLATFORM_WIDTH - 14, top - 46, 3, 46);
      const wave = Math.sin(time / 180 + distance) * 3;
      graphics.fillStyle(distance % 10 === 0 ? 0xef4444 : 0xf97316, 1).fillTriangle(
        left + PLATFORM_WIDTH - 11, top - 46,
        left + PLATFORM_WIDTH + 14, top - 39 + wave,
        left + PLATFORM_WIDTH - 11, top - 30,
      );
    }

    const label = this.label(slot);
    label.setText(distance === 0 ? "START" : String(distance))
      .setPosition(centerX, top + 22)
      .setColor(milestone ? "#fff7ed" : "#f5e6d3")
      .setVisible(true);
  }

  private label(slot: number): Phaser.GameObjects.Text {
    let text = this.labels[slot];
    if (!text) {
      text = this.scene.add.text(0, 0, "", {
        fontFamily: FONT_FAMILY,
        fontSize: "11px",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(3).setResolution(TEXT_RESOLUTION);
      this.labels[slot] = text;
    }
    return text;
  }
}
