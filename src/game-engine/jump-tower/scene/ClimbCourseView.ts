import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../phaser-kit/art.ts";
import { bakeSprite } from "../../phaser-kit/BakedLayer.ts";
import { climbPlatform, climbPlatformX, type ClimbCourseSource, type ClimbPlatform, type ClimbPlatformKind, type ClimbPlatformStyle } from "../course.ts";

const PLATFORM_HEIGHT = 16;
const PAD_HEIGHT = 26;
/** Platforms kept alive (with physics) below and above the focus floor. */
const WINDOW_BELOW = 12;
const WINDOW_ABOVE = 18;

const LOOK: Readonly<Record<ClimbPlatformKind, { readonly top: number; readonly side: number }>> = {
  step: { top: 0x8bd17c, side: 0x5a9e4b },
  pad: { top: 0x8bd17c, side: 0x5a9e4b },
  moving: { top: 0x60a5fa, side: 0x2563eb },
  milestone: { top: 0xfbbf24, side: 0xc98a16 },
};

function platformTexture(scene: Phaser.Scene, kind: ClimbPlatformKind, width: number, style?: ClimbPlatformStyle): string {
  const { top, side } = style ?? LOOK[kind];
  const key = style ? `climb-${kind}-${width}-${top}-${side}` : `climb-${kind}-${width}`;
  return bakeSprite(scene, key, width + 4, PLATFORM_HEIGHT + 6, (graphics) => {
    graphics.fillStyle(0x0f172a, 0.14).fillRoundedRect(3, 5, width, PLATFORM_HEIGHT, 7);
    graphics.fillStyle(side, 1).fillRoundedRect(0, 3, width, PLATFORM_HEIGHT - 3, 7);
    graphics.fillStyle(top, 1).fillRoundedRect(0, 0, width, PLATFORM_HEIGHT - 5, 7);
    graphics.fillStyle(0xffffff, 0.4).fillRoundedRect(6, 2, width - 12, 3, 1);
    if (kind === "moving") {
      graphics.fillStyle(0xffffff, 0.9);
      graphics.fillTriangle(8, 7, 14, 3, 14, 11);
      graphics.fillTriangle(width - 8, 7, width - 14, 3, width - 14, 11);
    }
  });
}

function padTexture(scene: Phaser.Scene, squash: number): string {
  return bakeSprite(scene, `climb-pad-${squash}`, 44, PAD_HEIGHT, (graphics) => {
    const spring = 6 * squash;
    graphics.fillStyle(0x64748b, 1).fillRect(6, PAD_HEIGHT - spring - 2, 4, spring + 2).fillRect(34, PAD_HEIGHT - spring - 2, 4, spring + 2);
    graphics.fillStyle(0xef4444, 1).fillRoundedRect(0, PAD_HEIGHT - spring - 10, 44, 10, 5);
    graphics.fillStyle(0xfecaca, 1).fillRoundedRect(5, PAD_HEIGHT - spring - 8, 34, 3, 2);
  });
}

interface LivePlatform {
  readonly platform: ClimbPlatform;
  readonly zone: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Image;
  readonly pad: Phaser.GameObjects.Image | null;
  readonly label: Phaser.GameObjects.Text | null;
}

function oneWay(body: { checkCollision: Phaser.Types.Physics.Arcade.ArcadeBodyCollision }): void {
  body.checkCollision.down = false;
  body.checkCollision.left = false;
  body.checkCollision.right = false;
}

/** The visible stretch of the endless tower: art, one-way bodies, moving platforms and pads. */
export class ClimbCourseView {
  private readonly scene: Phaser.Scene;
  private readonly seed: string;
  private readonly source: ClimbCourseSource | undefined;
  readonly statics: Phaser.Physics.Arcade.StaticGroup;
  readonly movers: Phaser.Physics.Arcade.Group;
  private readonly live = new Map<number, LivePlatform>();
  private highlight: Phaser.GameObjects.Graphics | undefined;
  private highlightedFloor: number | null = null;
  private highlightStartedAt = 0;

  constructor(scene: Phaser.Scene, seed: string, source?: ClimbCourseSource) {
    this.scene = scene;
    this.seed = seed;
    this.source = source;
    this.statics = scene.physics.add.staticGroup();
    this.movers = scene.physics.add.group({ allowGravity: false, immovable: true });
  }

  /** Keeps platforms around `focusFloor` alive and steers the moving ones by the shared clock. */
  update(focusFloor: number, nowMs: number, answerFloor: number | null = null): void {
    this.highlightFloor(answerFloor);
    const low = Math.max(this.source ? 0 : 1, focusFloor - WINDOW_BELOW);
    const high = focusFloor + WINDOW_ABOVE;
    for (const [index, entry] of this.live) {
      const floor = entry.platform.floor ?? index;
      if (floor >= low && floor <= high) continue;
      this.remove(entry);
      this.live.delete(index);
    }
    for (let index = low; index <= high; index += 1) {
      const platforms = this.source?.platformsAt(index) ?? [climbPlatform(this.seed, index)];
      for (const platform of platforms) {
        if (!this.live.has(platform.index)) this.live.set(platform.index, this.create(platform, nowMs));
      }
    }
    for (const entry of this.live.values()) {
      if (entry.platform.kind !== "moving") continue;
      // Direct control derives collision velocity from the actual displacement.
      // Render-frame feedback can oscillate against Arcade's fixed physics steps.
      const target = climbPlatformX(entry.platform, nowMs) + entry.platform.width / 2;
      entry.zone.setX(target);
      entry.art.setX(target);
    }
    this.drawHighlight();
  }

  /** Every candidate receives the same glow; the effect never identifies the correct answer. */
  highlightFloor(floor: number | null, restart = false): void {
    if (floor === this.highlightedFloor && !restart) return;
    this.highlightedFloor = floor;
    this.highlightStartedAt = this.scene.time.now;
    if (floor !== null && !this.highlight) this.highlight = this.scene.add.graphics().setDepth(7);
    this.drawHighlight();
  }

  private drawHighlight(): void {
    const graphics = this.highlight;
    if (!graphics) return;
    graphics.clear();
    if (this.highlightedFloor === null) return;
    const elapsed = this.scene.time.now - this.highlightStartedAt;
    const pulse = (Math.sin(elapsed / 180) + 1) / 2;
    const intro = Math.max(0, 1 - elapsed / 700);
    for (const entry of this.live.values()) {
      if (entry.platform.floor !== this.highlightedFloor) continue;
      const { platform, art, label } = entry;
      const left = art.x - platform.width / 2;
      const height = Math.max(PLATFORM_HEIGHT, 20 + (label?.displayHeight ?? 0));
      graphics.fillStyle(0xfff3a3, 0.06 + pulse * 0.07 + intro * 0.12)
        .fillRoundedRect(left - 7, platform.y - 6, platform.width + 14, height + 12, 10);
      graphics.lineStyle(3, 0xfbbf24, 0.55 + pulse * 0.35)
        .strokeRoundedRect(left - 7, platform.y - 6, platform.width + 14, height + 12, 10);
      graphics.lineStyle(1, 0xffffff, 0.6 + pulse * 0.35)
        .strokeRoundedRect(left - 4, platform.y - 3, platform.width + 8, height + 6, 8);
      for (let star = 0; star < 3; star += 1) {
        const twinkle = (Math.sin(elapsed / 140 + star * 2.1) + 1) / 2;
        const x = left + platform.width * star / 2;
        const y = platform.y - 12 - twinkle * 5;
        const size = 2 + twinkle * 4 + intro * 2;
        graphics.fillStyle(0xffffff, 0.4 + twinkle * 0.6);
        graphics.fillTriangle(x - size, y, x, y - size * 1.5, x + size, y);
        graphics.fillTriangle(x - size, y, x, y + size * 1.5, x + size, y);
      }
    }
  }

  platformAt(leftX: number, rightX: number, feetY: number): ClimbPlatform | null {
    for (const entry of this.live.values()) {
      const body = entry.zone.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(feetY - body.top) <= 4 && rightX > body.left && leftX < body.right) return entry.platform;
    }
    return null;
  }

  /** Horizontal speed of the moving platform under these feet (0 when not on one). */
  carrySpeedAt(centerX: number, feetY: number): number {
    for (const entry of this.live.values()) {
      if (entry.platform.kind !== "moving") continue;
      const body = entry.zone.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(feetY - body.top) <= 3 && centerX >= body.left - 4 && centerX <= body.right + 4) return body.velocity.x;
    }
    return 0;
  }

  /** The jump pad under these feet, if any (returns its platform index). */
  padAt(centerX: number, feetY: number): number | null {
    for (const entry of this.live.values()) {
      const { platform, pad } = entry;
      if (!pad || Math.abs(feetY - platform.y) > 4) continue;
      if (Math.abs(centerX - (platform.x + platform.width / 2)) <= 28) return platform.index;
    }
    return null;
  }

  bouncePad(index: number): void {
    const pad = this.live.get(index)?.pad;
    if (!pad) return;
    pad.setTexture(padTexture(this.scene, 2));
    this.scene.time.delayedCall(140, () => { if (pad.active) pad.setTexture(padTexture(this.scene, 1)); });
  }

  private create(platform: ClimbPlatform, nowMs: number): LivePlatform {
    const centreX = climbPlatformX(platform, nowMs) + platform.width / 2;
    const zone = this.scene.add.zone(centreX, platform.y + 6, platform.width, 12);
    if (platform.kind === "moving") {
      this.movers.add(zone);
      (zone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true).setDirectControl(true);
    } else {
      this.statics.add(zone);
    }
    oneWay(zone.body as Phaser.Physics.Arcade.Body);
    zone.setData("climbPlatform", platform);
    const art = this.scene.add.image(centreX, platform.y, platformTexture(this.scene, platform.kind, platform.width, platform.style))
      .setOrigin(0.5, 0)
      .setDepth(5);
    const pad = platform.kind === "pad"
      ? this.scene.add.image(centreX, platform.y, padTexture(this.scene, 1)).setOrigin(0.5, 1).setDepth(7)
      : null;
    const label = platform.label !== undefined
      ? this.scene.add.text(centreX, platform.y + 20, platform.label, {
        fontFamily: FONT_FAMILY, fontSize: "13px", fontStyle: "300", color: platform.style?.labelColor ?? "#1e3a5f",
        backgroundColor: platform.style?.labelBackground ?? "#ffffff", padding: { x: 6, y: 4 }, align: "center",
        wordWrap: { width: platform.width - 12, useAdvancedWrap: true },
      }).setOrigin(0.5, 0).setDepth(6).setResolution(TEXT_RESOLUTION)
      : platform.kind === "milestone"
      ? this.scene.add.text(centreX, platform.y + 8, `${platform.index}층`, {
        fontFamily: FONT_FAMILY,
        fontSize: "11px",
        fontStyle: "300",
        color: "#5b3a00",
      }).setOrigin(0.5, 0.5).setDepth(6).setResolution(TEXT_RESOLUTION)
      : null;
    if (platform.label !== undefined && label && label.height > 58) label.setScale(58 / label.height);
    return { platform, zone, art, pad, label };
  }

  private remove(entry: LivePlatform): void {
    if (entry.platform.kind === "moving") this.movers.remove(entry.zone, true, true);
    else this.statics.remove(entry.zone, true, true);
    entry.art.destroy();
    entry.pad?.destroy();
    entry.label?.destroy();
  }
}
