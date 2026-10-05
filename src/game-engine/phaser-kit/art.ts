import Phaser from "phaser";
import { hashString } from "../core/random.ts";
import { bakeSprite } from "./BakedLayer.ts";

export const FONT_FAMILY = "Paperlogy, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
export const TEXT_RESOLUTION = 2;
/** Phaser measures line height from this sample; Hangul must be in it or glyph bottoms get clipped. */
export const TEXT_METRICS_SAMPLE = "|MÉqgy한글뛿";

export const TEXTURE = {
  dot: "kit-dot",
  star: "kit-star",
  cloud: "kit-cloud",
} as const;

const PLAYER_COLORS = [
  0x5b8def, 0xf472b6, 0x34d399, 0xfbbf24, 0xa78bfa,
  0xfb7185, 0x22d3ee, 0xf97316, 0x84cc16, 0xe879f9,
] as const;

export function playerColor(playerId: string): number {
  return PLAYER_COLORS[hashString(playerId) % PLAYER_COLORS.length] ?? PLAYER_COLORS[0];
}

export function shade(color: number, amount: number): number {
  const channel = (shift: number): number => {
    const value = (color >> shift) & 0xff;
    const next = amount >= 0 ? value + (255 - value) * amount : value * (1 + amount);
    return Math.round(Phaser.Math.Clamp(next, 0, 255));
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function ensureSharedTextures(scene: Phaser.Scene): void {
  bakeSprite(scene, TEXTURE.dot, 8, 8, (graphics) => {
    graphics.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  });
  bakeSprite(scene, TEXTURE.star, 18, 18, (graphics) => {
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 === 0 ? 9 : 3.8;
      points.push(new Phaser.Math.Vector2(9 + Math.cos(angle) * radius, 9 + Math.sin(angle) * radius));
    }
    graphics.fillStyle(0xffffff, 1).fillPoints(points, true);
  });
  bakeSprite(scene, TEXTURE.cloud, 180, 70, (graphics) => {
    graphics.fillStyle(0xffffff, 1);
    graphics.fillEllipse(52, 44, 80, 40);
    graphics.fillEllipse(92, 32, 88, 56);
    graphics.fillEllipse(132, 44, 78, 38);
    graphics.fillRoundedRect(20, 40, 140, 26, 13);
  });
}

/** One rounded body texture per player colour; the face is drawn on top so it can look around. */
export function ensureBodyTexture(scene: Phaser.Scene, color: number): string {
  return bakeSprite(scene, `kit-body-${color.toString(16)}`, 40, 44, (graphics) => {
    graphics.fillStyle(shade(color, -0.45), 1).fillRoundedRect(1, 3, 38, 40, 17);
    graphics.fillStyle(color, 1).fillRoundedRect(3, 1, 34, 38, 15);
    graphics.fillStyle(shade(color, 0.35), 1).fillEllipse(20, 30, 20, 12);
    graphics.fillStyle(0xffffff, 0.45).fillEllipse(12, 10, 10, 6);
  });
}
