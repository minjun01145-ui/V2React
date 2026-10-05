import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../phaser-kit/art.ts";
import { bakeSprite } from "../phaser-kit/BakedLayer.ts";
import { ITEM_STYLE, type PartyItem, type PartyItemKind } from "./buffs.ts";

const ORB_SIZE = 34;
const PICKUP_RADIUS = 30;

function orbTexture(scene: Phaser.Scene, kind: PartyItemKind): string {
  const { color } = ITEM_STYLE[kind];
  return bakeSprite(scene, `party-orb-${kind}`, ORB_SIZE, ORB_SIZE, (graphics) => {
    const center = ORB_SIZE / 2;
    graphics.fillStyle(color, 0.35).fillCircle(center, center, center);
    graphics.fillStyle(0xffffff, 1).fillCircle(center, center, center - 4);
    graphics.fillStyle(color, 1).fillCircle(center, center, center - 7);
    graphics.fillStyle(0xffffff, 0.55).fillEllipse(center - 4, center - 6, 9, 5);
  });
}

interface Shown {
  readonly item: PartyItem;
  readonly orb: Phaser.GameObjects.Image;
  readonly icon: Phaser.GameObjects.Text;
}

/** Draws the power-up orbs currently on the field and answers pickup queries. */
export class ItemsView {
  private readonly scene: Phaser.Scene;
  private readonly shown = new Map<string, Shown>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(items: readonly PartyItem[], time: number): void {
    const visible = new Set<string>();
    for (const item of items) {
      visible.add(item.id);
      let entry = this.shown.get(item.id);
      if (!entry) {
        entry = {
          item,
          orb: this.scene.add.image(item.x, item.y, orbTexture(this.scene, item.kind)).setDepth(15).setScale(0.2),
          icon: this.scene.add.text(item.x, item.y, ITEM_STYLE[item.kind].icon, {
            fontFamily: FONT_FAMILY,
            fontSize: "15px",
            fontStyle: "300",
            color: "#ffffff",
          }).setOrigin(0.5).setDepth(16).setResolution(TEXT_RESOLUTION),
        };
        this.scene.tweens.add({ targets: entry.orb, scale: 1, duration: 260, ease: "Back.easeOut" });
        this.shown.set(item.id, entry);
      }
      const bob = Math.sin(time / 260 + item.x) * 4;
      entry.orb.setY(item.y + bob).setRotation(Math.sin(time / 500 + item.x) * 0.15);
      entry.icon.setY(item.y + bob);
    }
    for (const [id, entry] of this.shown) {
      if (visible.has(id)) continue;
      entry.orb.destroy();
      entry.icon.destroy();
      this.shown.delete(id);
    }
  }

  itemNear(x: number, centerY: number): PartyItem | null {
    for (const { item } of this.shown.values()) {
      if (Math.hypot(item.x - x, item.y - centerY) <= PICKUP_RADIUS) return item;
    }
    return null;
  }
}
