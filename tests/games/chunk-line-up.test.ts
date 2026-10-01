import assert from "node:assert/strict";
import {
  CHUNK_LINE_UP_GRAVITY,
  CHUNK_LINE_UP_WORLD_WIDTH,
} from "../../src/games/chunk-line-up/model.ts";
import {
  CHUNK_LINE_UP_FLOOR_GAP,
  CHUNK_LINE_UP_JUMP_PAD_VELOCITY,
  CHUNK_LINE_UP_ROW_LEFT,
  CHUNK_LINE_UP_ROW_RIGHT,
  CHUNK_LINE_UP_WALK_LEFT,
  CHUNK_LINE_UP_WALK_RIGHT,
  chunkLineUpFloorAt,
  chunkLineUpFloorLabel,
  chunkLineUpFloorY,
  chunkLineUpGroundY,
  chunkLineUpPropX,
  chunkLineUpProps,
  chunkLineUpShaftX,
  chunkLineUpSlotRects,
  chunkLineUpSpawnState,
  chunkLineUpWorldHeight,
} from "../../src/games/chunk-line-up/layout.ts";
import {
  CHUNK_LINE_UP_ELEVATOR_DOOR_MS,
  CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS,
  chunkLineUpElevatorDoorOpenRatio,
  chunkLineUpElevatorFloorPosition,
  chunkLineUpElevatorTravelMs,
  createChunkLineUpElevatorState,
  predictChunkLineUpElevatorRide,
  resolveChunkLineUpElevatorCar,
} from "../../src/games/chunk-line-up/elevatorModel.ts";
import type { ChunkLineUpElevatorCarState } from "../../src/multiplayer/chunk-line-up/types.ts";
import { choosePunchTarget, encodePunch, punchKnockback } from "../../src/game-engine/platformer-party/punch.ts";
import { ITEMS_PER_SLOT, chunkLineUpItemKind, chunkLineUpItemsAt } from "../../src/games/chunk-line-up/items.ts";
import { BUFF_DURATION_MS } from "../../src/game-engine/platformer-party/buffs.ts";
import { PowerUpTracker } from "../../src/game-engine/platformer-party/PowerUpTracker.ts";

assert.equal(CHUNK_LINE_UP_WORLD_WIDTH, 1_280, "all clients should share one canonical world width");
assert.deepEqual(chunkLineUpProps(4), chunkLineUpProps(4), "every client must build the identical climbing course");

const singleJumpHeight = 550 ** 2 / (2 * CHUNK_LINE_UP_GRAVITY);
const doubleJumpHeight = singleJumpHeight + 520 ** 2 / (2 * CHUNK_LINE_UP_GRAVITY);
assert(CHUNK_LINE_UP_FLOOR_GAP > doubleJumpHeight + 10,
  "a floor must not be reachable by jumping straight up; players climb the props or take the elevator");
assert(CHUNK_LINE_UP_JUMP_PAD_VELOCITY ** 2 / (2 * CHUNK_LINE_UP_GRAVITY) > CHUNK_LINE_UP_FLOOR_GAP,
  "a jump pad should launch a player past the floor above");

for (let floorCount = 1; floorCount <= 5; floorCount += 1) {
  assert.equal(chunkLineUpFloorY(floorCount, floorCount), chunkLineUpGroundY(floorCount), "the last floor index is the lobby ground");
  assert.equal(chunkLineUpFloorLabel(floorCount, floorCount), "1F");
  assert(chunkLineUpWorldHeight(floorCount) > chunkLineUpGroundY(floorCount));
  const props = chunkLineUpProps(floorCount);
  for (const prop of props) {
    const left = prop.x - prop.range;
    const right = prop.x + prop.width + prop.range;
    assert(left >= CHUNK_LINE_UP_ROW_LEFT && right <= CHUNK_LINE_UP_ROW_RIGHT,
      `${prop.id} should stay clear of the elevator landings`);
  }
  for (let floor = 0; floor < floorCount; floor += 1) {
    const slots = chunkLineUpSlotRects(7, floor, floorCount);
    const last = slots.at(-1)!;
    assert(slots[0]!.x >= CHUNK_LINE_UP_WALK_LEFT && last.x + last.width <= CHUNK_LINE_UP_WALK_RIGHT + 0.001,
      "sentence slots should stay inside the walkable area between elevator shafts");
    assert.equal(chunkLineUpFloorAt(chunkLineUpFloorY(floor, floorCount), floorCount), floor);

    // Every floor is climbable from the one below using static steps alone.
    const upperY = chunkLineUpFloorY(floor, floorCount);
    const lowerY = chunkLineUpFloorY(floor + 1, floorCount);
    const surfaces = props.filter((prop) => prop.kind === "step" && prop.y < lowerY && prop.y > upperY).map((prop) => prop.y);
    let reached = [lowerY];
    for (let pass = 0; pass < 6; pass += 1) {
      reached = [...new Set([...reached, ...surfaces.filter((y) => reached.some((from) => from - y > 0 && from - y <= singleJumpHeight - 6))])];
    }
    assert(reached.some((y) => y - upperY <= singleJumpHeight - 6),
      `floor ${floor} of ${floorCount} should be reachable by climbing steps`);
  }
}
assert(chunkLineUpShaftX("left") < CHUNK_LINE_UP_WALK_LEFT && chunkLineUpShaftX("right") > CHUNK_LINE_UP_WALK_RIGHT);
assert.deepEqual(chunkLineUpSpawnState(42, 3), chunkLineUpSpawnState(42, 3),
  "a player's spawn point should not depend on the viewer's screen");
const movingProp = chunkLineUpProps(4).find((prop) => prop.kind === "moving")!;
assert.equal(chunkLineUpPropX(movingProp, 123_456), chunkLineUpPropX(movingProp, 123_456),
  "moving platforms follow the shared server clock");

const epoch = 10_000;
const optimisticRide = predictChunkLineUpElevatorRide(
  createChunkLineUpElevatorState(5, epoch),
  "left",
  "p1",
  5,
  1,
  5,
  epoch + 100,
);
assert.equal(optimisticRide?.left.seats[0]?.destinationFloor, 1,
  "a selected destination should start the local elevator ride without waiting for the server round trip");
assert.equal(resolveChunkLineUpElevatorCar(optimisticRide!.left, epoch + 5_000, 5).phase, "open",
  "a predicted ride must not depart before the server confirms it (a slow reply would re-seat the player after arrival)");
assert.equal(predictChunkLineUpElevatorRide(
  createChunkLineUpElevatorState(5, epoch),
  "left",
  "p1",
  5,
  5,
  5,
  epoch + 100,
), null, "the lobby floor itself is not a valid sentence destination");
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

// Punch: hits the closest player in front on the same level, never someone behind or a floor away.
const attacker = { x: 500, y: 300, facing: 1 };
assert.equal(choosePunchTarget(attacker, [
  { playerId: "behind", x: 470, y: 300 },
  { playerId: "far", x: 600, y: 300 },
  { playerId: "upstairs", x: 530, y: 70 },
  { playerId: "near", x: 540, y: 305 },
  { playerId: "nearer", x: 520, y: 300 },
])?.playerId, "nearer");
assert.equal(choosePunchTarget({ ...attacker, facing: -1 }, [{ playerId: "front", x: 540, y: 300 }]), null);
assert(Math.sign(punchKnockback(encodePunch(-1, false)).vx) === -1, "knockback pushes in the punch direction");
assert(Math.abs(punchKnockback(encodePunch(1, true)).vx) > Math.abs(punchKnockback(encodePunch(1, false)).vx),
  "the punch item makes knockback stronger");

// Items: every client derives the same spawns; claims hide them and grant 30s buffs.
const itemNow = 1_790_000_000_000;
const items = chunkLineUpItemsAt("round-1", 4, itemNow);
assert.deepEqual(items, chunkLineUpItemsAt("round-1", 4, itemNow), "item spawns are deterministic across clients");
assert(items.length >= ITEMS_PER_SLOT && new Set(items.map((item) => item.id)).size === items.length);
assert(items.every((item) => item.spawnAtMs <= itemNow && itemNow < item.expiresAtMs));
for (const item of items) assert.equal(chunkLineUpItemKind("round-1", 4, item.id), item.kind);
const firstItem = items[0]!;
const powerUps = new PowerUpTracker({
  itemsAt: (nowMs) => chunkLineUpItemsAt("round-1", 4, nowMs),
  kindOf: (id) => chunkLineUpItemKind("round-1", 4, id),
});
assert(powerUps.beginClaim(firstItem.id) && !powerUps.beginClaim(firstItem.id), "a pickup is only attempted once");
powerUps.addClaim({ id: firstItem.id, by: "p1", atMs: itemNow });
assert(!powerUps.available(itemNow).some((item) => item.id === firstItem.id), "claimed items disappear for everyone");
assert.equal(powerUps.buffs("p1", itemNow + 1_000).has(firstItem.kind), true);
assert.equal(powerUps.buffs("p2", itemNow + 1_000).size, 0, "only the picker gets the buff");
assert.equal(powerUps.buffs("p1", itemNow + BUFF_DURATION_MS + 1).size, 0, "buffs last 30 seconds");

console.log("chunk line-up viewport and elevator tests passed");
