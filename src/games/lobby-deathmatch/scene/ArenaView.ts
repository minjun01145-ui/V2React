import type Phaser from "phaser";
import { createSeededRandom } from "../../../game-engine/core/random.ts";
import { TEXTURE } from "../../../game-engine/phaser-kit/art.ts";
import { BakedLayer, bakeSprite } from "../../../game-engine/phaser-kit/BakedLayer.ts";
import type { ArenaMap } from "../maps/types.ts";

/** All scenery is selected by theme data, never by map identity. */
export function createArenaView(scene: Phaser.Scene, map: ArenaMap): void {
  const { width, ceilingY, floorY, theme } = map;
  const top = ceilingY - 140;
  const height = floorY - top + 200;
  const random = createSeededRandom(`arena-art:${map.id}`);
  new BakedLayer(scene, `arena-${map.id}`, -10).draw({ x: -200, y: top, width: width + 400, height }, (g) => {
    g.fillStyle(theme.background).fillRect(-200, top, width + 400, height);
    for (let band = 0; band < 8; band += 1) {
      g.fillStyle(theme.ambient, 0.04 + band * 0.025).fillRect(0, floorY - 400 + band * 50, width, 50);
    }
    if (theme.backdrop === "cave") {
      for (let x = 0; x < width; x += 130) {
        const rockHeight = 50 + random() * 130;
        g.fillStyle(0x0b0a16, 0.8).fillTriangle(x, floorY, x + 65, floorY - rockHeight, x + 130, floorY);
        g.fillStyle(theme.ceiling, 0.9).fillTriangle(x, ceilingY, x + 40, ceilingY + 35 + random() * 55, x + 80, ceilingY);
      }
    } else if (theme.backdrop === "ocean") {
      for (let x = 70; x < width; x += 340) {
        g.fillStyle(0x8beaff, 0.055).fillTriangle(x, ceilingY, x - 100, floorY, x + 240, floorY);
      }
      for (let x = 20; x < width; x += 100) {
        const weedHeight = 35 + random() * 65;
        g.lineStyle(7, theme.floor, 0.9).lineBetween(x, floorY, x + 12, floorY - weedHeight);
        g.lineStyle(4, theme.edge, 0.3).lineBetween(x + 6, floorY - weedHeight / 2, x - 12, floorY - weedHeight * 0.8);
        g.fillStyle(0x38b3b0, 0.7).fillEllipse(x + 35, floorY + 4, 55, 18);
      }
    } else {
      for (let star = 0; star < 230; star += 1) {
        const x = random() * width;
        const y = ceilingY + random() * (floorY - ceilingY);
        g.fillStyle(star % 4 === 0 ? theme.edge : 0xffffff, 0.3 + random() * 0.65).fillCircle(x, y, 0.6 + random() * 1.3);
      }
      g.fillStyle(theme.ambient, 0.14).fillEllipse(width * 0.5, -280, 1_100, 360);
    }
    // The band ends exactly at the physical ceiling's underside.
    g.fillStyle(theme.ceiling).fillRect(-20, top, width + 40, ceilingY - top);
    g.fillStyle(theme.edge, 0.8).fillRect(0, ceilingY - 4, width, 4);
    for (let x = 20; x < width; x += 70) g.fillStyle(theme.edge, 0.25).fillRect(x, ceilingY - 17, 28, 3);
    if (map.safeFloor) {
      g.fillStyle(theme.floor).fillRect(0, floorY, width, 200);
      g.fillStyle(theme.edge, 0.7).fillRect(0, floorY, width, 4);
    }
    g.fillStyle(theme.ceiling).fillRect(-20, ceilingY, 20, floorY - ceilingY).fillRect(width, ceilingY, 20, floorY - ceilingY);
  });

  const bubbles = theme.particles === "bubbles";
  const texture = bubbles ? bakeSprite(scene, "dm-bubble", 18, 18, (g) => {
    g.lineStyle(1.5, 0xb6f5ff, 0.8).strokeCircle(9, 9, 6);
    g.fillStyle(0xffffff, 0.8).fillCircle(7, 6, 1.5);
  }) : TEXTURE.dot;
  scene.add.particles(0, 0, texture, {
    x: { min: 0, max: width }, y: floorY - 8,
    speedY: bubbles ? { min: -110, max: -45 } : { min: -80, max: -25 },
    speedX: { min: -12, max: 12 }, lifespan: bubbles ? 8_000 : 2_000,
    scale: bubbles ? { start: 0.4, end: 1 } : { start: 0.8, end: 0 },
    alpha: { start: 0.65, end: 0 },
    tint: bubbles ? 0xffffff : theme.edge,
    frequency: theme.particles === "stardust" ? 180 : 65,
  }).setDepth(-1);
}
