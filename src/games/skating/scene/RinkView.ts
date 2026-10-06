import Phaser from "phaser";
import { hashString } from "../../../game-engine/core/random.ts";
import { FONT_FAMILY, TEXT_METRICS_SAMPLE, TEXT_RESOLUTION } from "../../../game-engine/phaser-kit/art.ts";
import {
  SKATING_PROMPT_LEAD,
  skatingGateIndexAtX,
  skatingGateX,
  skatingLaneY,
  skatingQuestionForGate,
  type SkatingCourse,
  type SkatingLane,
} from "../model.ts";
import { skatingItemsBetween, type SkatingItem } from "../sim/items.ts";
import { BOARD_HEIGHT, LANE_COLORS, type RinkLayout } from "./rinkLayout.ts";

const MAX_VISIBLE_GATES = 4;
const LANES: readonly SkatingLane[] = [0, 1, 2];
const BOARD_PANEL_COLORS = [0x1d4ed8, 0xdc2626, 0x0f766e, 0x7c3aed] as const;
const CROWD_COLORS = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xc084fc, 0xf472b6, 0xffffff] as const;
/** The crowd scrolls at half speed, which reads as depth. */
const STAND_PARALLAX = 0.5;

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

/** Scales a text down (never up) so it fits a box. */
function fitText(text: Phaser.GameObjects.Text, width: number, height: number): void {
  text.setScale(Math.min(1, width / Math.max(1, text.width), height / Math.max(1, text.height)));
}

/**
 * The rink itself: crowd stand, ice, lane markings, boards, the question
 * painted on the ice, gate signs with the three choices, and the items.
 * Redrawn every frame from the layout.
 */
export class RinkView {
  private readonly ice: Phaser.GameObjects.Graphics;
  private readonly paint: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly choiceTexts: Phaser.GameObjects.Text[][] = [];
  private readonly promptTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.ice = scene.add.graphics().setDepth(0);
    this.paint = scene.add.graphics().setDepth(1);
    this.marks = scene.add.graphics().setDepth(4);
    const style = { fontFamily: FONT_FAMILY, align: "center", resolution: TEXT_RESOLUTION, testString: TEXT_METRICS_SAMPLE };
    for (let slot = 0; slot < MAX_VISIBLE_GATES; slot += 1) {
      this.choiceTexts.push(LANES.map(() => scene.add.text(0, 0, "", { ...style, fontStyle: "500", color: "#0f172a" })
        .setOrigin(0.5).setDepth(6)));
      this.promptTexts.push(scene.add.text(0, 0, "", { ...style, fontStyle: "700", color: "#1e3a8a", stroke: "#ffffff", strokeThickness: 8 })
        .setOrigin(0.5).setDepth(2));
    }
  }

  /** Sign rectangle for one lane of a gate; also where the correct-answer burst starts. */
  static sign(layout: RinkLayout, gateIndex: number, lane: SkatingLane): GateSign {
    const width = Math.min(layout.pixelsPerUnit * 2.6, 210, layout.width * 0.3);
    const height = layout.laneHeight * 0.66;
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
    readonly boosting: boolean;
  }): void {
    const { layout, time } = input;
    this.paint.clear();
    this.drawIce(layout, time, input.boosting);
    this.drawItems(layout, input.seed, time, input.hideItem);
    this.drawGates(layout, input.course, input.hideGatesBefore);
  }

  private drawIce(layout: RinkLayout, time: number, boosting: boolean): void {
    const { width, height, laneHeight, pixelsPerUnit, iceTop, iceBottom, standHeight } = layout;
    const g = this.ice.clear();
    g.fillStyle(boosting ? 0xfff1e0 : 0xeef8ff).fillRect(0, iceTop, width, iceBottom - iceTop);
    for (const lane of LANES) {
      const top = iceTop + lane * laneHeight;
      g.fillStyle(lane % 2 ? 0xe2f1fd : 0xf4faff, 1).fillRect(0, top, width, laneHeight);
      g.fillStyle(LANE_COLORS[lane], 0.07).fillRect(0, top, width, laneHeight);
    }
    // Lane dividers: dashes pinned to world x so they rush past at skating speed.
    const dash = 1.1, gap = 0.9;
    for (const divider of [-0.5, 0.5]) {
      const y = layout.screenY(divider);
      g.fillStyle(0x93c5fd, 0.8);
      for (let x = Math.floor(layout.left / (dash + gap)) * (dash + gap); x < layout.right; x += dash + gap) {
        g.fillRect(layout.screenX(x), y - 2, dash * pixelsPerUnit, 4);
      }
    }
    // Frost sparkles fixed in the world.
    const cell = 1.2;
    for (let column = Math.floor(layout.left / cell); column * cell < layout.right; column += 1) {
      const hash = hashString(`ice:${column}`);
      for (let index = 0; index < 3; index += 1) {
        const x = layout.screenX((column + ((hash >>> (index * 5)) % 32) / 32) * cell);
        const y = iceTop + ((hash >>> (index * 7 + 3)) % 97) / 97 * (iceBottom - iceTop);
        g.fillStyle(0xffffff, 0.95).fillCircle(x, y, 1.2 + (index % 2));
      }
    }
    // Crowd stand: rows of bobbing heads, scrolling slower than the ice.
    g.fillStyle(0x1e1b4b).fillRect(0, 0, width, standHeight);
    const spacing = 14;
    const scrolled = layout.left * pixelsPerUnit * STAND_PARALLAX;
    const firstColumn = Math.floor(scrolled / spacing);
    const offset = scrolled - firstColumn * spacing;
    for (let row = 0; row < 3; row += 1) {
      const rowY = standHeight * (0.3 + row * 0.28);
      for (let column = 0; column * spacing - offset < width + spacing; column += 1) {
        const hash = hashString(`crowd:${row}:${firstColumn + column}`);
        const bob = Math.max(0, Math.sin(time / 140 + (hash % 13))) * 3;
        const x = column * spacing - offset + (row % 2) * 7;
        g.fillStyle(CROWD_COLORS[hash % CROWD_COLORS.length]!, 0.9).fillCircle(x, rowY - bob, 4.5);
      }
    }
    // Boards with sponsor-style panels scrolling with the ice.
    for (const top of [standHeight, height - BOARD_HEIGHT]) {
      g.fillStyle(0x0f172a).fillRect(0, top, width, BOARD_HEIGHT);
      const panel = 3;
      for (let index = Math.floor(layout.left / panel); index * panel < layout.right; index += 1) {
        const color = BOARD_PANEL_COLORS[Math.abs(index) % BOARD_PANEL_COLORS.length]!;
        g.fillStyle(color, 0.95).fillRect(layout.screenX(index * panel) + 3, top + 3, panel * pixelsPerUnit - 6, BOARD_HEIGHT - 6);
      }
    }
  }

  private drawItems(layout: RinkLayout, seed: string, time: number, hideItem: (item: SkatingItem) => boolean): void {
    const g = this.marks.clear();
    for (const item of skatingItemsBetween(seed, layout.left - 1, layout.right + 1)) {
      if (hideItem(item)) continue;
      const x = layout.screenX(item.x);
      const groundY = layout.screenY(skatingLaneY(item.lane));
      const y = groundY - 6 - Math.sin(time / 220 + item.id) * 5;
      const radius = Math.max(14, layout.laneHeight * 0.24);
      const booster = item.kind === "booster";
      const color = booster ? 0xf97316 : 0x22c55e;
      const pulse = 1 + Math.sin(time / 120 + item.id) * 0.15;
      g.fillStyle(0x0f172a, 0.15).fillEllipse(x, groundY + radius * 0.8, radius * 1.6, radius * 0.5);
      g.fillStyle(color, 0.25).fillCircle(x, y, radius * 1.7 * pulse);
      g.fillStyle(color, 1).fillCircle(x, y, radius);
      g.lineStyle(3, 0xffffff, 0.95).strokeCircle(x, y, radius);
      const s = radius / 12;
      if (booster) {
        g.fillStyle(0xfff7cc, 1).fillPoints([
          new Phaser.Math.Vector2(x + 2 * s, y - 9 * s), new Phaser.Math.Vector2(x - 5 * s, y + 1 * s),
          new Phaser.Math.Vector2(x - 0.5 * s, y + 1 * s), new Phaser.Math.Vector2(x - 2 * s, y + 9 * s),
          new Phaser.Math.Vector2(x + 5 * s, y - 1.5 * s), new Phaser.Math.Vector2(x + 0.5 * s, y - 1.5 * s),
        ], true);
      } else {
        g.lineStyle(3.2 * s, 0xffffff, 1);
        for (const shift of [-3.5, 3.5]) {
          g.beginPath();
          g.moveTo(x + (shift - 3) * s, y - 6 * s);
          g.lineTo(x + (shift + 3) * s, y);
          g.lineTo(x + (shift - 3) * s, y + 6 * s);
          g.strokePath();
        }
      }
    }
  }

  private drawGates(layout: RinkLayout, course: SkatingCourse, hideBefore: number): void {
    const g = this.marks;
    const paint = this.paint;
    const firstGate = Math.max(0, skatingGateIndexAtX(Math.max(layout.left - 2, hideBefore)));
    const choiceSize = Math.round(Math.max(14, Math.min(26, layout.laneHeight * 0.24)));
    const promptSize = Math.round(Math.max(22, Math.min(54, layout.laneHeight * 0.5)));
    const centreY = layout.screenY(0);
    for (let slot = 0; slot < MAX_VISIBLE_GATES; slot += 1) {
      const gateIndex = firstGate + slot;
      const gateX = skatingGateX(gateIndex);
      const visible = gateX > hideBefore && gateX - SKATING_PROMPT_LEAD < layout.right + 4;
      const texts = this.choiceTexts[slot]!;
      const prompt = this.promptTexts[slot]!;
      prompt.setVisible(visible);
      texts.forEach((text) => text.setVisible(visible));
      if (!visible) continue;
      const question = skatingQuestionForGate(course, gateIndex);

      // The question, painted across the ice before the gate.
      const promptX = layout.screenX(gateX - SKATING_PROMPT_LEAD);
      const plateWidth = layout.pixelsPerUnit * 6.5;
      const plateHeight = layout.laneHeight * 1.5;
      paint.fillStyle(0xffffff, 0.7).fillRoundedRect(promptX - plateWidth / 2, centreY - plateHeight / 2, plateWidth, plateHeight, 22);
      paint.lineStyle(4, 0x1e3a8a, 0.25).strokeRoundedRect(promptX - plateWidth / 2, centreY - plateHeight / 2, plateWidth, plateHeight, 22);
      // Arrows painted on the ice lead from the question to the gate.
      const arrowX = layout.screenX(gateX - SKATING_PROMPT_LEAD / 2 + 0.6);
      for (const lane of LANES) {
        const arrowY = layout.screenY(skatingLaneY(lane));
        paint.fillStyle(LANE_COLORS[lane], 0.35).fillTriangle(arrowX - 12, arrowY - 12, arrowX + 12, arrowY, arrowX - 12, arrowY + 12);
      }
      syncText(prompt, question.prompt, promptSize, plateWidth - 24);
      prompt.setPosition(promptX, centreY);
      fitText(prompt, plateWidth - 20, plateHeight - 12);

      // Gate posts, a line across the ice, and one sign per lane.
      const x = layout.screenX(gateX);
      g.fillStyle(0xffffff, 0.6).fillRect(x - 2, layout.iceTop, 4, layout.iceBottom - layout.iceTop);
      g.fillStyle(0xe11d48)
        .fillRoundedRect(x - 5, layout.iceTop - BOARD_HEIGHT - 6, 10, BOARD_HEIGHT + 10, 3)
        .fillRoundedRect(x - 5, layout.iceBottom - 4, 10, BOARD_HEIGHT + 4, 3);
      for (const lane of LANES) {
        const sign = RinkView.sign(layout, gateIndex, lane);
        const left = sign.x - sign.width / 2, top = sign.y - sign.height / 2;
        g.fillStyle(0x0f172a, 0.14).fillRoundedRect(left + 3, top + 5, sign.width, sign.height, 12);
        g.fillStyle(0xffffff, 0.97).fillRoundedRect(left, top, sign.width, sign.height, 12);
        g.lineStyle(5, LANE_COLORS[lane], 1).strokeRoundedRect(left, top, sign.width, sign.height, 12);
        const text = texts[lane]!;
        syncText(text, question.choices[lane], choiceSize, sign.width - 16);
        text.setPosition(sign.x, sign.y);
        fitText(text, sign.width - 12, sign.height - 8);
      }
    }
  }
}
