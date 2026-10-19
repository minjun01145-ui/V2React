import type Phaser from "phaser";
import { PALETTE } from "./palette.ts";
import { LANE_WIDTH, ROAD_HALF_WIDTH, laneX, project, type View } from "./projection.ts";

/* Track objects drawn in perspective: gold bars, hurdles and the O/X answer gate. */

type Graphics = Phaser.GameObjects.Graphics;

const BAR_LENGTH = 0.8;
const BAR_HEIGHT = 0.3;
const COIN_LIFT = 0.55;
export const HURDLE_HEIGHT = 0.95;
export const GATE_HEIGHT = 3.2;

/** A gold bar hovering over its lane; `spin` (radians) turns it so a row twinkles in sequence. */
export function paintGoldBar(graphics: Graphics, view: View, lane: number, z: number, height: number, spin: number): void {
  const centre = project(view, laneX(lane), z, COIN_LIFT + height + Math.sin(spin * 0.7) * 0.06);
  const ground = project(view, laneX(lane), z);
  const s = centre.scale;
  const turn = Math.abs(Math.cos(spin)) * 0.65 + 0.35;
  const width = BAR_LENGTH * s * turn;
  const tall = BAR_HEIGHT * s;
  const inset = width * 0.18;
  graphics.fillStyle(PALETTE.shadow, 0.25).fillEllipse(ground.x, ground.y, width * 0.9, tall * 0.5);
  // Front face, then the lighter top face and a glint.
  graphics.fillStyle(PALETTE.goldDark, 1).fillRect(centre.x - width / 2, centre.y - tall / 2, width, tall);
  graphics.fillStyle(PALETTE.gold, 1).fillPoints([
    { x: centre.x - width / 2, y: centre.y - tall / 2 }, { x: centre.x + width / 2, y: centre.y - tall / 2 },
    { x: centre.x + width / 2 - inset, y: centre.y - tall * 1.15 }, { x: centre.x - width / 2 + inset, y: centre.y - tall * 1.15 },
  ], true);
  graphics.fillStyle(PALETTE.goldLight, 0.9).fillRect(centre.x - width * 0.3, centre.y - tall * 0.95, width * 0.22, tall * 0.18);
}

/** A striped hurdle across one lane: low enough to jump. */
export function paintHurdle(graphics: Graphics, view: View, lane: number, z: number): void {
  const half = LANE_WIDTH * 0.43;
  const left = project(view, laneX(lane) - half, z);
  const right = project(view, laneX(lane) + half, z);
  const top = project(view, laneX(lane), z, HURDLE_HEIGHT);
  const s = left.scale;
  const legWidth = 0.14 * s;
  const boardTop = top.y;
  const boardHeight = 0.42 * s;
  graphics.fillStyle(PALETTE.shadow, 0.3).fillEllipse((left.x + right.x) / 2, left.y, right.x - left.x, 0.25 * s);
  graphics.fillStyle(PALETTE.woodDark, 1)
    .fillRect(left.x + legWidth, boardTop, legWidth, left.y - boardTop)
    .fillRect(right.x - legWidth * 2, boardTop, legWidth, left.y - boardTop);
  graphics.fillStyle(PALETTE.kerbWhite, 1).fillRect(left.x, boardTop, right.x - left.x, boardHeight);
  const stripe = (right.x - left.x) / 6;
  graphics.fillStyle(PALETTE.hazard, 1);
  for (let index = 0; index < 6; index += 2) {
    graphics.fillPoints([
      { x: left.x + index * stripe, y: boardTop + boardHeight }, { x: left.x + (index + 1) * stripe, y: boardTop + boardHeight },
      { x: left.x + (index + 1.6) * stripe, y: boardTop }, { x: left.x + (index + 0.6) * stripe, y: boardTop },
    ], true);
  }
  graphics.lineStyle(Math.max(1, 0.05 * s), PALETTE.woodDark, 1).strokeRect(left.x, boardTop, right.x - left.x, boardHeight);
}

function panel(view: View, lane: number, z: number): { x: number; y: number; width: number; height: number; scale: number } {
  const half = LANE_WIDTH * 0.46;
  const bottom = project(view, laneX(lane) - half, z);
  const topRight = project(view, laneX(lane) + half, z, GATE_HEIGHT);
  return { x: bottom.x, y: topRight.y, width: topRight.x - bottom.x, height: bottom.y - topRight.y, scale: bottom.scale };
}

/**
 * The answer gate: an O arch over the left lane, an X arch over the right one and a wall in the
 * middle. `pulse` (0–1) breathes the arch glow.
 */
export function paintGate(graphics: Graphics, view: View, z: number, pulse: number): void {
  const left = panel(view, -1, z);
  const middle = panel(view, 0, z);
  const right = panel(view, 1, z);
  const s = left.scale;
  const glow = 0.25 + pulse * 0.2;
  // Translucent arches: tinted fill, bright frame, big symbol.
  for (const [box, color, symbol] of [[left, PALETTE.gateO, "O"], [right, PALETTE.gateX, "X"]] as const) {
    graphics.fillStyle(color, glow).fillRoundedRect(box.x, box.y, box.width, box.height, { tl: box.width / 2, tr: box.width / 2, bl: 0, br: 0 });
    graphics.lineStyle(Math.max(2, 0.16 * s), color, 1).strokeRoundedRect(box.x, box.y, box.width, box.height, { tl: box.width / 2, tr: box.width / 2, bl: 0, br: 0 });
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height * 0.42;
    const r = box.width * 0.24;
    graphics.lineStyle(Math.max(3, 0.26 * s), 0xffffff, 0.95);
    if (symbol === "O") graphics.strokeCircle(cx, cy, r);
    else graphics.lineBetween(cx - r, cy - r, cx + r, cy + r).lineBetween(cx + r, cy - r, cx - r, cy + r);
  }
  // Stone wall with a bevel; running into it counts as a wrong answer.
  graphics.fillStyle(PALETTE.stoneDark, 1).fillRect(middle.x, middle.y, middle.width, middle.height);
  graphics.fillStyle(PALETTE.stone, 1).fillRect(middle.x + middle.width * 0.06, middle.y + middle.height * 0.04, middle.width * 0.88, middle.height * 0.96);
  const brick = middle.height / 6;
  graphics.lineStyle(Math.max(1, 0.05 * s), PALETTE.stoneDark, 1);
  for (let row = 1; row < 6; row += 1) {
    const y = middle.y + row * brick;
    graphics.lineBetween(middle.x, y, middle.x + middle.width, y);
    const offset = row % 2 === 0 ? 0.5 : 0.25;
    for (let column = offset; column < 1; column += 0.5) {
      const x = middle.x + middle.width * column;
      graphics.lineBetween(x, y - brick, x, y);
    }
  }
  // Gold crossbeam over all three lanes.
  const beamLeft = project(view, -ROAD_HALF_WIDTH, z, GATE_HEIGHT + 0.45);
  const beamRight = project(view, ROAD_HALF_WIDTH, z, GATE_HEIGHT);
  graphics.fillStyle(PALETTE.goldDark, 1).fillRect(beamLeft.x, beamLeft.y, beamRight.x - beamLeft.x, beamRight.y - beamLeft.y);
  graphics.fillStyle(PALETTE.gold, 1).fillRect(beamLeft.x, beamLeft.y, beamRight.x - beamLeft.x, (beamRight.y - beamLeft.y) * 0.55);
}
