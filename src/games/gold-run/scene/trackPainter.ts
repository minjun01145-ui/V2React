import type Phaser from "phaser";
import { hashString } from "../../../game-engine/core/random.ts";
import { PALETTE } from "./palette.ts";
import { DRAW_DISTANCE, LANE_WIDTH, NEAR_Z, ROAD_HALF_WIDTH, RUNNER_Z, project, type View } from "./projection.ts";

/* The parts of the world that do not depend on the round: sky, canyon walls, ground, road and roadside props. */

const SEGMENT = 4;
const KERB = 2;
const KERB_WIDTH = 0.45;
const PROP_SPACING = 13;
const PROP_OFFSET = ROAD_HALF_WIDTH + 2.6;

type Graphics = Phaser.GameObjects.Graphics;

function quad(graphics: Graphics, color: number, x0: number, x1: number, zNear: number, zFar: number, view: View, alpha = 1): void {
  const a = project(view, x0, zNear);
  const b = project(view, x1, zNear);
  const c = project(view, x1, zFar);
  const d = project(view, x0, zFar);
  graphics.fillStyle(color, alpha).fillPoints([a, b, c, d], true);
}

/** Sky gradient, sun and two layers of mesas; redrawn only on resize. */
export function paintBackdrop(graphics: Graphics, view: View): void {
  graphics.clear();
  const { width, horizonY } = view;
  graphics.fillGradientStyle(PALETTE.skyTop, PALETTE.skyTop, PALETTE.skyMid, PALETTE.skyMid, 1).fillRect(0, 0, width, horizonY * 0.6);
  graphics.fillGradientStyle(PALETTE.skyMid, PALETTE.skyMid, PALETTE.skyHorizon, PALETTE.skyHorizon, 1).fillRect(0, horizonY * 0.6 - 1, width, horizonY * 0.4 + 2);
  const sunRadius = Math.min(width, horizonY) * 0.16;
  graphics.fillStyle(PALETTE.sun, 0.25).fillCircle(width * 0.68, horizonY - sunRadius * 0.35, sunRadius * 1.6);
  graphics.fillStyle(PALETTE.sun, 1).fillCircle(width * 0.68, horizonY - sunRadius * 0.35, sunRadius);
  for (const [color, heightShare, seed] of [[PALETTE.mesaFar, 0.22, "far"], [PALETTE.mesaNear, 0.13, "near"]] as const) {
    const points: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: horizonY + 1 }];
    const step = width / 9;
    for (let index = 0; index <= 9; index += 1) {
      const rise = horizonY * heightShare * (0.35 + (hashString(`${seed}:${index}`) % 100) / 100 * 0.65);
      // Flat-topped mesas: a slanted wall, a plateau, another slanted wall.
      points.push({ x: index * step - step * 0.18, y: horizonY - rise * 0.15 });
      points.push({ x: index * step + step * 0.05, y: horizonY - rise });
      points.push({ x: index * step + step * 0.55, y: horizonY - rise });
      points.push({ x: index * step + step * 0.8, y: horizonY - rise * 0.15 });
    }
    points.push({ x: width, y: horizonY + 1 });
    graphics.fillStyle(color, 1).fillPoints(points, true);
  }
}

/** Ground, road tiles, lane dashes and kerbs for the runner at `distance` metres. */
export function paintTrack(graphics: Graphics, view: View, distance: number): void {
  graphics.clear();
  graphics.fillStyle(PALETTE.sand, 1).fillRect(0, view.horizonY, view.width, view.height - view.horizonY);
  const nearZ = NEAR_Z;
  const startAt = distance - RUNNER_Z + nearZ;
  const first = Math.floor(startAt / SEGMENT);
  const last = Math.ceil((distance - RUNNER_Z + DRAW_DISTANCE) / SEGMENT);
  const wide = ROAD_HALF_WIDTH * 12;
  for (let segment = last; segment >= first; segment -= 1) {
    const zNear = Math.max(nearZ, segment * SEGMENT - distance + RUNNER_Z);
    const zFar = (segment + 1) * SEGMENT - distance + RUNNER_Z;
    if (zFar <= nearZ) continue;
    if (segment % 4 === 0) {
      quad(graphics, PALETTE.sandDark, -wide, -ROAD_HALF_WIDTH - KERB_WIDTH, zNear, zFar, view);
      quad(graphics, PALETTE.sandDark, ROAD_HALF_WIDTH + KERB_WIDTH, wide, zNear, zFar, view);
    }
    quad(graphics, segment % 2 === 0 ? PALETTE.road : PALETTE.roadAlt, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, zNear, zFar, view);
    if (segment % 2 === 0) {
      for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) quad(graphics, PALETTE.laneLine, x - 0.07, x + 0.07, zNear, zFar, view, 0.85);
    }
    for (let kerb = 0; kerb < SEGMENT / KERB; kerb += 1) {
      const kNear = Math.max(nearZ, zNear + kerb * KERB);
      const kFar = Math.min(zFar, segment * SEGMENT + (kerb + 1) * KERB - distance + RUNNER_Z);
      if (kFar <= kNear) continue;
      const color = (segment * 2 + kerb) % 2 === 0 ? PALETTE.kerbRed : PALETTE.kerbWhite;
      quad(graphics, color, -ROAD_HALF_WIDTH - KERB_WIDTH, -ROAD_HALF_WIDTH, kNear, kFar, view);
      quad(graphics, color, ROAD_HALF_WIDTH, ROAD_HALF_WIDTH + KERB_WIDTH, kNear, kFar, view);
    }
  }
  // Haze at the horizon hides where the road pops into view.
  const haze = Math.max(6, (project(view, 0, DRAW_DISTANCE * 0.55).y - view.horizonY));
  graphics.fillGradientStyle(PALETTE.skyHorizon, PALETTE.skyHorizon, PALETTE.skyHorizon, PALETTE.skyHorizon, 0.9, 0.9, 0, 0).fillRect(0, view.horizonY - 1, view.width, haze);
}

type PropKind = "cactus" | "rock" | "lamp";
const PROP_KINDS: readonly PropKind[] = ["cactus", "rock", "cactus", "lamp"];

function paintCactus(graphics: Graphics, base: { x: number; y: number; scale: number }): void {
  const s = base.scale;
  const trunk = 0.42 * s;
  graphics.fillStyle(PALETTE.cactusDark, 1).fillRoundedRect(base.x - trunk / 2, base.y - 2.6 * s, trunk, 2.6 * s, trunk / 2);
  graphics.fillStyle(PALETTE.cactus, 1).fillRoundedRect(base.x - trunk / 2, base.y - 2.6 * s, trunk * 0.62, 2.6 * s, trunk / 2);
  graphics.fillStyle(PALETTE.cactusDark, 1)
    .fillRoundedRect(base.x - trunk * 1.6, base.y - 1.9 * s, trunk * 0.7, 0.9 * s, trunk * 0.35)
    .fillRoundedRect(base.x - trunk * 1.6, base.y - 1.3 * s, trunk * 1.3, trunk * 0.55, trunk * 0.27)
    .fillRoundedRect(base.x + trunk * 0.9, base.y - 2.2 * s, trunk * 0.7, 0.8 * s, trunk * 0.35)
    .fillRoundedRect(base.x + trunk * 0.3, base.y - 1.6 * s, trunk * 1.3, trunk * 0.55, trunk * 0.27);
}

function paintRock(graphics: Graphics, base: { x: number; y: number; scale: number }, seed: number): void {
  const s = base.scale * (0.8 + (seed % 5) * 0.1);
  graphics.fillStyle(PALETTE.rockDark, 1).fillPoints([
    { x: base.x - 1.1 * s, y: base.y }, { x: base.x - 0.8 * s, y: base.y - 1.3 * s }, { x: base.x - 0.1 * s, y: base.y - 1.7 * s },
    { x: base.x + 0.8 * s, y: base.y - 1.2 * s }, { x: base.x + 1.2 * s, y: base.y },
  ], true);
  graphics.fillStyle(PALETTE.rock, 1).fillPoints([
    { x: base.x - 0.9 * s, y: base.y }, { x: base.x - 0.65 * s, y: base.y - 1.2 * s }, { x: base.x - 0.1 * s, y: base.y - 1.6 * s },
    { x: base.x + 0.25 * s, y: base.y - 1.1 * s }, { x: base.x + 0.1 * s, y: base.y },
  ], true);
}

function paintLamp(graphics: Graphics, base: { x: number; y: number; scale: number }, glow: number): void {
  const s = base.scale;
  graphics.fillStyle(PALETTE.woodDark, 1).fillRect(base.x - 0.09 * s, base.y - 3.2 * s, 0.18 * s, 3.2 * s);
  graphics.fillStyle(PALETTE.gold, 0.22 + glow * 0.12).fillCircle(base.x, base.y - 3.25 * s, 0.75 * s);
  graphics.fillStyle(PALETTE.goldLight, 1).fillRoundedRect(base.x - 0.22 * s, base.y - 3.55 * s, 0.44 * s, 0.55 * s, 0.1 * s);
}

/** Roadside props, far to near, so nearer ones overlap. `time` flickers the lamps. */
export function paintProps(graphics: Graphics, view: View, distance: number, time: number): void {
  graphics.clear();
  const firstAt = distance - RUNNER_Z + NEAR_Z;
  const first = Math.ceil(firstAt / PROP_SPACING);
  const last = Math.floor((distance - RUNNER_Z + DRAW_DISTANCE) / PROP_SPACING);
  for (let index = last; index >= first; index -= 1) {
    const z = index * PROP_SPACING - distance + RUNNER_Z;
    for (const side of [-1, 1] as const) {
      const seed = hashString(`prop:${index}:${side}`);
      const kind = PROP_KINDS[seed % PROP_KINDS.length]!;
      const base = project(view, side * (PROP_OFFSET + (seed % 3) * 0.8), z);
      if (kind === "cactus") paintCactus(graphics, base);
      else if (kind === "rock") paintRock(graphics, base, seed);
      else paintLamp(graphics, base, Math.sin(time / 180 + index) * 0.5 + 0.5);
    }
  }
}
