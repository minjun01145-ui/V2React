import Phaser from "phaser";
import { hashString } from "../../../game-engine/core/random.ts";
import { FONT_FAMILY, TEXT_METRICS_SAMPLE, TEXT_RESOLUTION } from "../../../game-engine/phaser-kit/art.ts";
import { skatingGateIndexAtX, skatingGateX, skatingLaneY, skatingQuestionForGate, type SkatingCourse, type SkatingLane } from "../model.ts";
import { skatingItemsBetween, type SkatingItem } from "../sim/items.ts";
import { BOARD_HEIGHT, LANE_COLORS, type RinkLayout } from "./rinkLayout.ts";

const MAX_VISIBLE_GATES = 6;
const LANES: readonly SkatingLane[] = [0, 1, 2];
const BOARD_PANEL_COLORS = [0x1d4ed8, 0xdc2626, 0x0f766e, 0x7c3aed] as const;

export interface GateSign {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const textSettings = new WeakMap<Phaser.GameObjects.Text, string>();

/** Re-styling a Phaser text redraws its texture, so only touch it when something changed. */
function syncText(text: Phaser.GameObjects.Text, content: string, fontSize: number, wrapWidth: number): void {
  const key = `${fontSize}|${Math.round(wrapWidth)}|${content}`;
  if (textSettings.get(text) === key) return;
  textSettings.set(text, key);
  text.setScale(1).setFontSize(fontSize).setWordWrapWidth(Math.round(wrapWidth), true).setText(content);
}

/**
 * The rink itself: ice, lane markings, boards, gate signs with the three
 * choices, and the items lying on the ice. Redrawn every frame from the layout.
 */
export class RinkView {
  private readonly ice: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly choiceTexts: Phaser.GameObjects.Text[][] = [];
  private readonly promptTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.ice = scene.add.graphics().setDepth(0);
    this.marks = scene.add.graphics().setDepth(4);
    const style = { fontFamily: FONT_FAMILY, fontStyle: "500", align: "center", resolution: TEXT_RESOLUTION, testString: TEXT_METRICS_SAMPLE };
    for (let gate = 0; gate < MAX_VISIBLE_GATES; gate += 1) {
      this.choiceTexts.push(LANES.map(() => scene.add.text(0, 0, "", { ...style, color: "#0f172a" }).setOrigin(0.5).setDepth(6)));
      this.promptTexts.push(scene.add.text(0, 0, "", { ...style, fontStyle: "300", color: "#f8fafc", backgroundColor: "#e11d48", padding: { x: 6, y: 2 } })
        .setOrigin(0.5).setDepth(7));
    }
  }

  /** Sign rectangle for one lane of a gate; also where the correct-answer burst starts. */
  static sign(layout: RinkLayout, gateIndex: number, lane: SkatingLane): GateSign {
    const width = Math.min(layout.pixelsPerUnit * 2.4, 200, layout.width * 0.3);
    const height = layout.laneHeight * 0.64;
    return { x: layout.screenX(skatingGateX(gateIndex)), y: layout.screenY(skatingLaneY(lane)), width, height };
  }

  draw(input: {
    readonly layout: RinkLayout;
    readonly course: SkatingCourse;
    readonly seed: string;
    readonly time: number;
    /** Gates at or behind this x are already answered and hidden. */
    readonly hideGatesBefore: number;
    readonly hideItem: (item: SkatingItem) => boolean;
    readonly showPrompts: boolean;
    readonly boosting: boolean;
  }): void {
    const { layout, time } = input;
    this.drawIce(layout, input.boosting);
    this.drawItems(layout, input.seed, time, input.hideItem);
    this.drawGates(layout, input.course, input.hideGatesBefore, input.showPrompts);
  }

  private drawIce(layout: RinkLayout, boosting: boolean): void {
    const { width, height, laneHeight, pixelsPerUnit } = layout;
    const g = this.ice.clear();
    g.fillStyle(boosting ? 0xfff4e6 : 0xeef8ff).fillRect(0, 0, width, height);
    for (const lane of LANES) {
      const top = BOARD_HEIGHT + lane * laneHeight;
      g.fillStyle(lane % 2 ? 0xe2f1fd : 0xf2f9ff, 1).fillRect(0, top, width, laneHeight);
      g.fillStyle(LANE_COLORS[lane], 0.06).fillRect(0, top, width, laneHeight);
    }
    // Lane dividers: dashes pinned to world x so they slide past at skating speed.
    const dash = 1.2, gap = 0.8;
    const firstDash = Math.floor(layout.left / (dash + gap)) * (dash + gap);
    for (const divider of [-0.5, 0.5]) {
      const y = layout.screenY(divider);
      g.fillStyle(0x93c5fd, 0.75);
      for (let x = firstDash; x < layout.right; x += dash + gap) {
        g.fillRect(layout.screenX(x), y - 1.5, dash * pixelsPerUnit, 3);
      }
    }
    // Frosty sparkles scattered over the ice, fixed in the world.
    const cell = 1.5;
    for (let column = Math.floor(layout.left / cell); column * cell < layout.right; column += 1) {
      const hash = hashString(`ice:${column}`);
      for (let index = 0; index < 3; index += 1) {
        const x = layout.screenX((column + ((hash >>> (index * 5)) % 32) / 32) * cell);
        const y = BOARD_HEIGHT + ((hash >>> (index * 7 + 3)) % 97) / 97 * laneHeight * 3;
        g.fillStyle(0xffffff, 0.9).fillCircle(x, y, 1 + (index % 2));
      }
    }
    // Rink boards with sponsor-style panels scrolling with the ice.
    for (const top of [0, height - BOARD_HEIGHT]) {
      g.fillStyle(0x1e293b).fillRect(0, top, width, BOARD_HEIGHT);
      const panel = 3;
      for (let index = Math.floor(layout.left / panel); index * panel < layout.right; index += 1) {
        const color = BOARD_PANEL_COLORS[Math.abs(index) % BOARD_PANEL_COLORS.length]!;
        g.fillStyle(color, 0.9).fillRoundedRect(layout.screenX(index * panel) + 4, top + 5, panel * pixelsPerUnit - 8, BOARD_HEIGHT - 10, 4);
      }
      g.fillStyle(0xffffff, 0.85).fillRect(0, top === 0 ? BOARD_HEIGHT - 3 : top, width, 3);
    }
  }

  private drawItems(layout: RinkLayout, seed: string, time: number, hideItem: (item: SkatingItem) => boolean): void {
    const g = this.marks.clear();
    for (const item of skatingItemsBetween(seed, layout.left - 1, layout.right + 1)) {
      if (hideItem(item)) continue;
      const x = layout.screenX(item.x), y = layout.screenY(skatingLaneY(item.lane));
      const radius = Math.max(12, layout.laneHeight * 0.2) * (1 + Math.sin(time / 160 + item.id) * 0.08);
      const booster = item.kind === "booster";
      const color = booster ? 0xf97316 : 0x22c55e;
      g.fillStyle(color, 0.22).fillCircle(x, y, radius * 1.7);
      g.fillStyle(color, 1).fillCircle(x, y, radius);
      g.lineStyle(3, 0xffffff, 0.95).strokeCircle(x, y, radius);
      if (booster) {
        // Lightning bolt.
        const s = radius / 12;
        g.fillStyle(0xfff7cc, 1).fillPoints([
          new Phaser.Math.Vector2(x + 2 * s, y - 9 * s), new Phaser.Math.Vector2(x - 5 * s, y + 1 * s),
          new Phaser.Math.Vector2(x - 0.5 * s, y + 1 * s), new Phaser.Math.Vector2(x - 2 * s, y + 9 * s),
          new Phaser.Math.Vector2(x + 5 * s, y - 1.5 * s), new Phaser.Math.Vector2(x + 0.5 * s, y - 1.5 * s),
        ], true);
      } else {
        // Double chevron pointing forward.
        const s = radius / 12;
        g.lineStyle(3.2 * s, 0xffffff, 1);
        for (const offset of [-3.5, 3.5]) {
          g.beginPath();
          g.moveTo(x + (offset - 3) * s, y - 6 * s);
          g.lineTo(x + (offset + 3) * s, y);
          g.lineTo(x + (offset - 3) * s, y + 6 * s);
          g.strokePath();
        }
      }
    }
  }

  private drawGates(layout: RinkLayout, course: SkatingCourse, hideBefore: number, showPrompts: boolean): void {
    const g = this.marks;
    const firstGate = Math.max(0, skatingGateIndexAtX(Math.max(layout.left - 2, hideBefore)));
    const fontSize = Math.round(Math.max(13, Math.min(24, layout.laneHeight * 0.22)));
    for (let slot = 0; slot < MAX_VISIBLE_GATES; slot += 1) {
      const gateIndex = firstGate + slot;
      const gateX = skatingGateX(gateIndex);
      const visible = gateX > hideBefore && gateX < layout.right + 2;
      const texts = this.choiceTexts[slot]!;
      const prompt = this.promptTexts[slot]!;
      prompt.setVisible(visible && showPrompts);
      texts.forEach((text) => text.setVisible(visible));
      if (!visible) continue;
      const question = skatingQuestionForGate(course, gateIndex);
      const x = layout.screenX(gateX);
      // Posts on both boards and a faint finish-line across the ice.
      g.fillStyle(0xffffff, 0.55).fillRect(x - 2, BOARD_HEIGHT, 4, layout.height - BOARD_HEIGHT * 2);
      g.fillStyle(0xe11d48).fillRoundedRect(x - 5, 2, 10, BOARD_HEIGHT + 6, 3).fillRoundedRect(x - 5, layout.height - BOARD_HEIGHT - 8, 10, BOARD_HEIGHT + 6, 3);
      for (const lane of LANES) {
        const sign = RinkView.sign(layout, gateIndex, lane);
        g.fillStyle(0x0f172a, 0.12).fillRoundedRect(sign.x - sign.width / 2 + 3, sign.y - sign.height / 2 + 4, sign.width, sign.height, 12);
        g.fillStyle(0xffffff, 0.96).fillRoundedRect(sign.x - sign.width / 2, sign.y - sign.height / 2, sign.width, sign.height, 12);
        g.lineStyle(4, LANE_COLORS[lane], 1).strokeRoundedRect(sign.x - sign.width / 2, sign.y - sign.height / 2, sign.width, sign.height, 12);
        const text = texts[lane]!;
        syncText(text, question.choices[lane], fontSize, sign.width - 14);
        const fit = Math.min(1, (sign.height - 8) / Math.max(1, text.height), (sign.width - 10) / Math.max(1, text.width));
        text.setScale(fit).setPosition(sign.x, sign.y);
      }
      if (showPrompts) {
        syncText(prompt, question.prompt, 13, layout.width * 0.4);
        prompt.setPosition(x, BOARD_HEIGHT / 2);
      }
    }
  }
}
