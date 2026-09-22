import assert from "node:assert/strict";
import {
  CHUNK_LINE_UP_WORLD_HEIGHT,
  CHUNK_LINE_UP_WORLD_WIDTH,
  chunkLineUpElevatorProgress,
} from "../../src/games/chunk-line-up/model.ts";

assert.equal(CHUNK_LINE_UP_WORLD_WIDTH, 1_040, "all clients should share one canonical world width");
assert.equal(CHUNK_LINE_UP_WORLD_HEIGHT, 604, "all clients should share one canonical world height");

const epoch = 10_000;
assert.deepEqual(chunkLineUpElevatorProgress(epoch + 500, epoch), { progress: 0, boarding: true, cycle: 0 });
assert.deepEqual(chunkLineUpElevatorProgress(epoch + 1_500, epoch), { progress: 0, boarding: false, cycle: 0 });
assert.equal(chunkLineUpElevatorProgress(epoch + 3_000, epoch).boarding, false);
assert(Math.abs(chunkLineUpElevatorProgress(epoch + 3_000, epoch).progress - 0.5) < 0.001);
assert.equal(chunkLineUpElevatorProgress(epoch + 4_500, epoch).progress, 1);
assert(Math.abs(chunkLineUpElevatorProgress(epoch + 6_200, epoch).progress - 0.5) < 0.001);
assert.equal(chunkLineUpElevatorProgress(epoch + 7_500, epoch).cycle, 1);

console.log("chunk line-up viewport and elevator tests passed");
