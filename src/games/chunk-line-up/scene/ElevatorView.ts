import Phaser from "phaser";
import type {
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorState,
} from "../../../multiplayer/chunk-line-up/types.ts";
import {
  CHUNK_LINE_UP_ELEVATOR_CAPACITY,
  chunkLineUpElevatorDoorOpenRatio,
  chunkLineUpElevatorFloorPosition,
} from "../elevatorModel.ts";
import {
  CHUNK_LINE_UP_FLOOR_GAP,
  CHUNK_LINE_UP_SHAFT_WIDTH,
  chunkLineUpFloorY,
  chunkLineUpGroundY,
  chunkLineUpShaftX,
} from "../layout.ts";
import { FONT_FAMILY, TEXT_RESOLUTION } from "./art.ts";

export const ELEVATOR_CABIN_WIDTH = 76;
const CABIN_HEIGHT = 58;

function shaftTop(floorCount: number): number {
  return chunkLineUpFloorY(0, floorCount) - CHUNK_LINE_UP_FLOOR_GAP * 0.45;
}

/** Pure rendering of the two server-driven elevator cars. */
export class ElevatorView {
  private readonly shafts: Phaser.GameObjects.Graphics;
  private readonly cars: Phaser.GameObjects.Graphics;
  private readonly labels: Record<ChunkLineUpElevatorId, Phaser.GameObjects.Text>;

  constructor(scene: Phaser.Scene) {
    this.shafts = scene.add.graphics().setDepth(-5);
    this.cars = scene.add.graphics().setDepth(4);
    const label = (): Phaser.GameObjects.Text => scene.add.text(0, 0, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#f8fafc",
      backgroundColor: "rgba(15,23,42,.82)",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(5).setResolution(TEXT_RESOLUTION).setVisible(false);
    this.labels = { left: label(), right: label() };
  }

  drawShafts(floorCount: number): void {
    const graphics = this.shafts.clear();
    const top = shaftTop(floorCount);
    const groundY = chunkLineUpGroundY(floorCount);
    for (const id of ["left", "right"] as const) {
      const x = chunkLineUpShaftX(id) - CHUNK_LINE_UP_SHAFT_WIDTH / 2;
      graphics.fillStyle(0x1e3a4c, 1).fillRoundedRect(x, top, CHUNK_LINE_UP_SHAFT_WIDTH, groundY - top + 6, 10);
      graphics.fillStyle(0x2d5670, 1).fillRect(x + 8, top + 8, CHUNK_LINE_UP_SHAFT_WIDTH - 16, groundY - top - 8);
      graphics.fillStyle(0x3f7391, 0.55).fillRect(x + 12, top + 8, 6, groundY - top - 8);
      graphics.fillStyle(0x0f2533, 1)
        .fillRect(x + 10, top + 8, 3, groundY - top - 8)
        .fillRect(x + CHUNK_LINE_UP_SHAFT_WIDTH - 13, top + 8, 3, groundY - top - 8);
      graphics.fillStyle(0xfacc15, 1).fillRoundedRect(x + 14, top - 10, CHUNK_LINE_UP_SHAFT_WIDTH - 28, 14, 5);
    }
  }

  draw(state: ChunkLineUpElevatorState | null, floorCount: number, nowMs: number): void {
    this.cars.clear();
    if (!state || floorCount < 1) {
      this.labels.left.setVisible(false);
      this.labels.right.setVisible(false);
      return;
    }
    this.drawCar("left", state.left, floorCount, nowMs);
    this.drawCar("right", state.right, floorCount, nowMs);
  }

  private drawCar(id: ChunkLineUpElevatorId, car: ChunkLineUpElevatorCarState, floorCount: number, nowMs: number): void {
    const graphics = this.cars;
    const centerX = chunkLineUpShaftX(id);
    const floorY = chunkLineUpFloorY(chunkLineUpElevatorFloorPosition(car, nowMs), floorCount);
    const top = floorY - CABIN_HEIGHT;
    const left = centerX - ELEVATOR_CABIN_WIDTH / 2;
    const top0 = shaftTop(floorCount);

    // Cable.
    graphics.lineStyle(2, 0x0b1a24, 0.9).lineBetween(centerX, top0 + 4, centerX, top);

    // Arrival lamps on each landing.
    for (let floor = 0; floor <= floorCount; floor += 1) {
      const lampY = chunkLineUpFloorY(floor, floorCount) - CABIN_HEIGHT - 6;
      const lit = car.phase === "open" && car.floor === floor;
      const lampX = id === "left" ? left + ELEVATOR_CABIN_WIDTH + 12 : left - 12;
      graphics.fillStyle(lit ? 0x4ade80 : 0x64748b, lit ? 1 : 0.7).fillCircle(lampX, lampY, 4);
    }

    // Cabin frame and interior.
    graphics.fillStyle(0x0f172a, 0.25).fillRoundedRect(left + 3, top + 4, ELEVATOR_CABIN_WIDTH, CABIN_HEIGHT, 7);
    graphics.fillStyle(0xcbd5e1, 1).fillRoundedRect(left, top, ELEVATOR_CABIN_WIDTH, CABIN_HEIGHT, 7);
    graphics.fillStyle(0xfff7d6, 1).fillRect(left + 5, top + 6, ELEVATOR_CABIN_WIDTH - 10, CABIN_HEIGHT - 10);
    graphics.fillStyle(0xfde68a, 1).fillRect(left + 18, top + 7, ELEVATOR_CABIN_WIDTH - 36, 3);

    // Doors slide open from the middle.
    const openRatio = chunkLineUpElevatorDoorOpenRatio(car, nowMs);
    const half = (ELEVATOR_CABIN_WIDTH - 10) / 2;
    const panel = half * (1 - openRatio);
    if (panel > 0.5) {
      graphics.fillStyle(0x8aa4b8, 1)
        .fillRect(left + 5, top + 6, panel, CABIN_HEIGHT - 10)
        .fillRect(left + ELEVATOR_CABIN_WIDTH - 5 - panel, top + 6, panel, CABIN_HEIGHT - 10);
      graphics.fillStyle(0xb7c9d6, 1)
        .fillRect(left + 8, top + 9, Math.max(0, panel - 6), 4)
        .fillRect(left + ELEVATOR_CABIN_WIDTH - 5 - panel + 3, top + 9, Math.max(0, panel - 6), 4);
    }
    graphics.fillStyle(0x475569, 1).fillRect(left, floorY - 4, ELEVATOR_CABIN_WIDTH, 5);
    graphics.lineStyle(2, 0x334155, 1).strokeRoundedRect(left, top, ELEVATOR_CABIN_WIDTH, CABIN_HEIGHT, 7);

    const moving = car.phase === "moving" && car.targetFloor !== null;
    const arrow = moving ? (car.targetFloor! < car.floor ? "▲ " : "▼ ") : "";
    this.labels[id]
      .setText(`${arrow}${car.seats.length}/${CHUNK_LINE_UP_ELEVATOR_CAPACITY}`)
      .setPosition(centerX, top - 12)
      .setVisible(true);
  }
}
