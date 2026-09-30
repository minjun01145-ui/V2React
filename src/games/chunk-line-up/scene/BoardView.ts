import Phaser from "phaser";
import type { ChunkLineUpBoard, ChunkLineUpSlot } from "../../../multiplayer/chunk-line-up/types.ts";
import {
  CHUNK_LINE_UP_ROW_LEFT,
  CHUNK_LINE_UP_ROW_RIGHT,
  CHUNK_LINE_UP_LANDING_WIDTH,
  CHUNK_LINE_UP_SLOT_HEIGHT,
  CHUNK_LINE_UP_WALK_LEFT,
  CHUNK_LINE_UP_WALK_RIGHT,
  chunkLineUpFloorLabel,
  chunkLineUpLandingRect,
  chunkLineUpSlotRects,
  type ChunkLineUpRect,
} from "../layout.ts";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../../game-engine/phaser-kit/art.ts";

export interface SlotHit {
  readonly groupId: string;
  readonly slot: ChunkLineUpSlot;
  readonly rect: ChunkLineUpRect;
}

export interface BoardChanges {
  readonly filled: readonly ChunkLineUpRect[];
  readonly completedFloors: readonly number[];
}

const PLATFORM_DEPTH = 6;
const PROMPT_HEIGHT = 18;

function compact(value: string, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function structureKey(board: ChunkLineUpBoard): string {
  return board.groups.map((group) => `${group.id}:${group.slots.length}`).join("|");
}

/** Draws sentence floors and owns their one-way physics platforms. */
export class BoardView {
  private readonly scene: Phaser.Scene;
  private readonly platforms: Phaser.Physics.Arcade.StaticGroup;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly focusGraphics: Phaser.GameObjects.Graphics;
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private hits: SlotHit[] = [];
  private structure = "";
  private board: ChunkLineUpBoard | null = null;

  constructor(scene: Phaser.Scene, platforms: Phaser.Physics.Arcade.StaticGroup) {
    this.scene = scene;
    this.platforms = platforms;
    this.graphics = scene.add.graphics().setDepth(PLATFORM_DEPTH);
    this.focusGraphics = scene.add.graphics().setDepth(PLATFORM_DEPTH + 2);
  }

  render(board: ChunkLineUpBoard): BoardChanges {
    const previous = this.board;
    const nextStructure = structureKey(board);
    const rebuildPhysics = nextStructure !== this.structure;
    this.board = board;
    this.structure = nextStructure;
    this.graphics.clear();
    this.nodes.forEach((node) => node.destroy());
    this.nodes = [];
    this.hits = [];
    if (rebuildPhysics) this.platforms.clear(true, true);

    const floorCount = board.groups.length;
    const filled: ChunkLineUpRect[] = [];
    const completedFloors: number[] = [];

    board.groups.forEach((group, floor) => {
      const rects = chunkLineUpSlotRects(group.slots.length, floor, floorCount);
      const before = previous?.groups[floor];
      if (before && before.id !== group.id) completedFloors.push(floor);

      this.drawPrompt(group.prompt, chunkLineUpFloorLabel(floor, floorCount), rects[0]?.y ?? 0);
      group.slots.forEach((slot, index) => {
        const rect = rects[index];
        if (!rect) return;
        this.hits.push({ groupId: group.id, slot, rect });
        this.drawSlot(slot, rect);
        if (before?.id === group.id && slot.filledBy && !before.slots[index]?.filledBy) filled.push(rect);
        if (rebuildPhysics) this.addPlatform(rect.x, rect.y, rect.width);
      });

      for (const id of ["left", "right"] as const) {
        const landing = chunkLineUpLandingRect(id, floor, floorCount);
        this.drawLanding(landing);
        if (rebuildPhysics) this.addPlatform(landing.x, landing.y, landing.width);
      }
    });
    this.platforms.refresh();
    return { filled, completedFloors };
  }

  slotAt(x: number, feetY: number): SlotHit | null {
    const candidates = this.hits.filter((hit) => Math.abs(feetY - hit.rect.y) <= 10
      && x >= hit.rect.x - 4
      && x <= hit.rect.x + hit.rect.width + 4);
    candidates.sort((left, right) =>
      Math.abs(x - (left.rect.x + left.rect.width / 2)) - Math.abs(x - (right.rect.x + right.rect.width / 2)));
    return candidates[0] ?? null;
  }

  /** Pulses the empty slot the local player can confirm right now. */
  drawFocus(hit: SlotHit | null, time: number): void {
    const graphics = this.focusGraphics.clear();
    if (!hit || hit.slot.fixed || hit.slot.filledBy) return;
    const pulse = 0.55 + Math.sin(time / 140) * 0.35;
    const { x, y, width, height } = hit.rect;
    graphics.lineStyle(4, 0xfacc15, pulse).strokeRoundedRect(x - 3, y - 3, width + 6, height + 6, 9);
    graphics.fillStyle(0xfef08a, 0.28 * pulse).fillRoundedRect(x, y, width, height, 7);
  }

  private addPlatform(x: number, y: number, width: number): void {
    const zone = this.scene.add.zone(x + width / 2, y + 6, width, 12);
    this.platforms.add(zone);
    const body = zone.body as Phaser.Physics.Arcade.StaticBody;
    // One-way: land from above, jump up through from below, no side snagging.
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  private drawSlot(slot: ChunkLineUpSlot, rect: ChunkLineUpRect): void {
    const { x, y, width, height } = rect;
    const graphics = this.graphics;
    if (slot.fixed || slot.filledBy) {
      const face = slot.fixed ? 0xf8c44f : 0x4fc98a;
      const lip = slot.fixed ? 0xc98a16 : 0x2c9464;
      graphics.fillStyle(lip, 1).fillRoundedRect(x, y + 3, width, height - 3, 7);
      graphics.fillStyle(face, 1).fillRoundedRect(x, y, width, height - 4, 7);
      graphics.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 5, y + 3, width - 10, 3, 2);
    } else {
      graphics.fillStyle(0xe2e8f0, 0.9).fillRoundedRect(x, y, width, height, 7);
      graphics.lineStyle(2, 0x64748b, 0.8);
      for (let dashX = x + 6; dashX < x + width - 6; dashX += 12) {
        graphics.lineBetween(dashX, y + 1, Math.min(dashX + 6, x + width - 6), y + 1);
        graphics.lineBetween(dashX, y + height - 1, Math.min(dashX + 6, x + width - 6), y + height - 1);
      }
      graphics.lineBetween(x + 1, y + 6, x + 1, y + height - 6);
      graphics.lineBetween(x + width - 1, y + 6, x + width - 1, y + height - 6);
    }

    const label = slot.fixed || slot.filledBy ? slot.text : "?";
    const centerY = slot.filledBy && slot.filledLabel ? y + 9 : y + height / 2 - 1;
    const text = this.scene.add.text(x + width / 2, centerY, label, {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: slot.fixed ? "#5b3a00" : slot.filledBy ? "#063d24" : "#64748b",
      align: "center",
    }).setOrigin(0.5).setDepth(PLATFORM_DEPTH + 1).setResolution(TEXT_RESOLUTION);
    let size = 14;
    while (text.width > width - 10 && size > 10) {
      size -= 1;
      text.setFontSize(size);
    }
    if (text.width > width - 10) text.setText(compact(label, Math.max(3, Math.floor((width - 10) / 7))));
    this.nodes.push(text);

    if (slot.filledBy && slot.filledLabel) {
      const byline = this.scene.add.text(x + width / 2, y + height - 7, compact(slot.filledLabel, Math.max(4, Math.floor(width / 7))), {
        fontFamily: FONT_FAMILY,
        fontSize: "9px",
        fontStyle: "bold",
        color: "#e7fff1",
      }).setOrigin(0.5).setDepth(PLATFORM_DEPTH + 1).setResolution(TEXT_RESOLUTION);
      this.nodes.push(byline);
    }
  }

  /** The meaning sits on the shelf's front edge, directly under its chunk blocks. */
  private drawPrompt(prompt: string, floorLabel: string, rowY: number): void {
    const top = rowY + CHUNK_LINE_UP_SLOT_HEIGHT + 1;
    const width = CHUNK_LINE_UP_ROW_RIGHT - CHUNK_LINE_UP_ROW_LEFT;
    this.graphics.fillStyle(0x1e3a5f, 0.94).fillRoundedRect(CHUNK_LINE_UP_ROW_LEFT, top, width, PROMPT_HEIGHT, 5);
    this.graphics.fillStyle(0xfacc15, 1).fillRoundedRect(CHUNK_LINE_UP_ROW_LEFT + 4, top + 3, 34, PROMPT_HEIGHT - 6, 4);
    const tag = this.scene.add.text(CHUNK_LINE_UP_ROW_LEFT + 21, top + PROMPT_HEIGHT / 2, floorLabel, {
      fontFamily: FONT_FAMILY, fontSize: "11px", fontStyle: "bold", color: "#1e3a5f",
    }).setOrigin(0.5).setDepth(PLATFORM_DEPTH + 1).setResolution(TEXT_RESOLUTION);
    // A big wall sign so players climbing past can tell which floor is which.
    const sign = this.scene.add.text(CHUNK_LINE_UP_WALK_LEFT + CHUNK_LINE_UP_LANDING_WIDTH / 2, rowY - 62, floorLabel, {
      fontFamily: FONT_FAMILY, fontSize: "30px", fontStyle: "900", color: "#1e3a5f",
    }).setOrigin(0.5).setAlpha(0.28).setDepth(-8).setResolution(TEXT_RESOLUTION);
    const signRight = this.scene.add.text(CHUNK_LINE_UP_WALK_RIGHT - CHUNK_LINE_UP_LANDING_WIDTH / 2, rowY - 62, floorLabel, {
      fontFamily: FONT_FAMILY, fontSize: "30px", fontStyle: "900", color: "#1e3a5f",
    }).setOrigin(0.5).setAlpha(0.28).setDepth(-8).setResolution(TEXT_RESOLUTION);
    this.nodes.push(sign, signRight);
    const text = this.scene.add.text(
      CHUNK_LINE_UP_ROW_LEFT + width / 2,
      top + PROMPT_HEIGHT / 2,
      compact(prompt.replaceAll("/", " "), 80),
      { fontFamily: FONT_FAMILY, fontSize: "13px", fontStyle: "bold", color: "#f8fafc" },
    ).setOrigin(0.5).setDepth(PLATFORM_DEPTH + 1).setResolution(TEXT_RESOLUTION);
    this.nodes.push(tag, text);
  }

  private drawLanding(rect: ChunkLineUpRect): void {
    const graphics = this.graphics;
    graphics.fillStyle(0x475569, 1).fillRoundedRect(rect.x, rect.y + 3, rect.width, rect.height, 4);
    graphics.fillStyle(0x94a3b8, 1).fillRoundedRect(rect.x, rect.y, rect.width, rect.height - 3, 4);
    graphics.fillStyle(0xfacc15, 1);
    for (let x = rect.x + 4; x < rect.x + rect.width - 6; x += 12) graphics.fillRect(x, rect.y + 2, 6, 3);
  }
}
