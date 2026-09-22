import assert from "node:assert/strict";
import {
  CHUNK_LINE_UP_WORLD_HEIGHT,
  CHUNK_LINE_UP_WORLD_WIDTH,
} from "../../src/games/chunk-line-up/model.ts";
import {
  CHUNK_LINE_UP_ELEVATOR_DOOR_MS,
  CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS,
  chunkLineUpElevatorDoorOpenRatio,
  chunkLineUpElevatorFloorPosition,
  chunkLineUpElevatorTravelMs,
  resolveChunkLineUpElevatorCar,
} from "../../src/games/chunk-line-up/elevatorModel.ts";
import type { ChunkLineUpElevatorCarState } from "../../src/multiplayer/chunk-line-up/types.ts";

assert.equal(CHUNK_LINE_UP_WORLD_WIDTH, 1_040, "all clients should share one canonical world width");
assert.equal(CHUNK_LINE_UP_WORLD_HEIGHT, 604, "all clients should share one canonical world height");

const epoch = 10_000;
const car: ChunkLineUpElevatorCarState = {
  id: "left",
  phase: "open",
  floor: 5,
  targetFloor: null,
  phaseStartedAtMs: epoch,
  seats: [{ playerId: "p1", destinationFloor: 1 }],
  queue: [1],
};
assert.equal(resolveChunkLineUpElevatorCar(car, epoch + 500, 5).phase, "open");
const movingAt = epoch + CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS + CHUNK_LINE_UP_ELEVATOR_DOOR_MS;
const moving = resolveChunkLineUpElevatorCar(car, movingAt + 1, 5);
assert.equal(moving.phase, "moving");
assert.equal(chunkLineUpElevatorDoorOpenRatio(moving, movingAt + 1), 0);
const travel = chunkLineUpElevatorTravelMs(5, 1);
const halfway = resolveChunkLineUpElevatorCar(car, movingAt + travel / 2, 5);
assert(Math.abs(chunkLineUpElevatorFloorPosition(halfway, movingAt + travel / 2) - 3) < 0.01,
  "client should interpolate the cabin between stable sentence floors");
const opening = resolveChunkLineUpElevatorCar(car, movingAt + travel + 1, 5);
assert.equal(opening.phase, "opening");
assert(chunkLineUpElevatorDoorOpenRatio(opening, movingAt + travel + CHUNK_LINE_UP_ELEVATOR_DOOR_MS / 2) > 0.45);

console.log("chunk line-up viewport and elevator tests passed");
