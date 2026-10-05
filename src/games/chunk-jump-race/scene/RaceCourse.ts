import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../../game-engine/phaser-kit/art.ts";
import { bakeSprite } from "../../../game-engine/phaser-kit/BakedLayer.ts";

export const PLATFORM_SPACING = 154;
export const PLATFORM_START_X = 110;
export const PLATFORM_TOP_Y = 304;
export const PLATFORM_WIDTH = 110;

const ISLAND_TOP = 4;
const ISLAND_HEIGHT = 66;

export function worldX(distance: number): number {
  return PLATFORM_START_X + Math.max(0, distance) * PLATFORM_SPACING;
}

type IslandKind = "start" | "normal" | "milestone";

/** Island art is baked once per variant; the grass surface sits ISLAND_TOP px below the sprite top. */
function islandTexture(scene: Phaser.Scene, kind: IslandKind): string {
  return bakeSprite(scene, `race-island-${kind}`, PLATFORM_WIDTH, ISLAND_HEIGHT, (graphics) => {
    const width = PLATFORM_WIDTH;
    const center = width / 2;
    const top = ISLAND_TOP;
    graphics.fillStyle(0x8b6b4a, 1).fillTriangle(6, top + 10, width - 6, top + 10, center + 6, top + 60);
    graphics.fillStyle(0xa98158, 1).fillTriangle(14, top + 10, center, top + 10, center - 4, top + 48);
    graphics.fillStyle(0x6b4f35, 1).fillRoundedRect(2, top + 8, width - 4, 12, 5);
    const grass = kind === "start" ? 0xfbbf24 : kind === "milestone" ? 0x4ade80 : 0x6cc56f;
    graphics.fillStyle(0x3f8f46, 1).fillRoundedRect(0, top + 2, width, 12, 7);
    graphics.fillStyle(grass, 1).fillRoundedRect(0, top - 2, width, 11, 7);
    graphics.fillStyle(0xffffff, 0.35).fillRoundedRect(8, top, width - 16, 3, 2);
    for (let tuft = 10; tuft < width - 8; tuft += 18) {
      graphics.fillStyle(0x3f8f46, 1).fillTriangle(tuft, top + 12, tuft + 4, top + 18, tuft + 8, top + 12);
    }
  });
}

function flagTexture(scene: Phaser.Scene, color: number): string {
  return bakeSprite(scene, `race-flag-${color.toString(16)}`, 30, 48, (graphics) => {
    graphics.fillStyle(0x64748b, 1).fillRect(0, 0, 3, 48);
    graphics.fillStyle(color, 1).fillTriangle(3, 0, 28, 7, 3, 16);
  });
}

interface IslandSlot {
  readonly island: Phaser.GameObjects.Image;
  readonly flag: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  distance: number;
}

/** Floating islands pooled around the visible stretch of the endless course. */
export class RaceCourse {
  private readonly scene: Phaser.Scene;
  private readonly slots: IslandSlot[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  draw(worldLeft: number, visibleWidth: number, time: number): void {
    const first = Math.max(0, Math.floor((worldLeft - PLATFORM_START_X) / PLATFORM_SPACING) - 1);
    const count = Math.ceil(visibleWidth / PLATFORM_SPACING) + 3;
    for (let offset = 0; offset < count; offset += 1) this.place(this.slot(offset), first + offset, time);
    for (let index = count; index < this.slots.length; index += 1) {
      const slot = this.slots[index];
      if (!slot) continue;
      slot.island.setVisible(false);
      slot.flag.setVisible(false);
      slot.label.setVisible(false);
    }
  }

  private place(slot: IslandSlot, distance: number, time: number): void {
    const centerX = worldX(distance);
    const bob = Math.round(Math.sin(time / 900 + distance) * 1.5);
    const milestone = distance > 0 && distance % 5 === 0;
    if (slot.distance !== distance) {
      slot.distance = distance;
      const kind: IslandKind = distance === 0 ? "start" : milestone ? "milestone" : "normal";
      slot.island.setTexture(islandTexture(this.scene, kind));
      slot.flag.setVisible(milestone);
      if (milestone) slot.flag.setTexture(flagTexture(this.scene, distance % 10 === 0 ? 0xef4444 : 0xf97316));
      slot.label.setText(distance === 0 ? "START" : String(distance)).setColor(milestone ? "#fff7ed" : "#f5e6d3");
    }
    slot.island.setPosition(centerX, PLATFORM_TOP_Y - ISLAND_TOP + bob).setVisible(true);
    slot.flag.setPosition(centerX + PLATFORM_WIDTH / 2 - 14, PLATFORM_TOP_Y - 46);
    slot.label.setPosition(centerX, PLATFORM_TOP_Y + 22 + bob).setVisible(true);
  }

  private slot(index: number): IslandSlot {
    let slot = this.slots[index];
    if (!slot) {
      slot = {
        island: this.scene.add.image(0, 0, islandTexture(this.scene, "normal")).setOrigin(0.5, 0).setDepth(2),
        flag: this.scene.add.image(0, 0, flagTexture(this.scene, 0xf97316)).setOrigin(0, 0).setDepth(2).setVisible(false),
        label: this.scene.add.text(0, 0, "", { fontFamily: FONT_FAMILY, fontSize: "11px", fontStyle: "300" })
          .setOrigin(0.5).setDepth(3).setResolution(TEXT_RESOLUTION),
        distance: -1,
      };
      this.slots[index] = slot;
    }
    return slot;
  }
}
