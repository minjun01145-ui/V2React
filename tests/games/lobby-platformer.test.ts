import assert from "node:assert/strict";
import { movementAction } from "../../src/game-engine/input/movementKeys.ts";
import { createJumpState, takeJump } from "../../src/game-engine/platformer/movement.ts";
import {
  CLIMB_GRAVITY,
  CLIMB_MAX_SHIFT,
  CLIMB_STEP,
  CLIMB_WORLD_WIDTH,
  climbFloorAt,
  climbItemKindOf,
  climbItemsAt,
  climbPlatform,
} from "../../src/games/lobby-platformer/course.ts";

assert.equal(movementAction("ArrowLeft", "ArrowLeft"), "left");
assert.equal(movementAction("KeyD", "ㅇ"), "right", "physical key codes should work with a Korean IME");
assert.equal(movementAction("Space", " "), "jump");

const jump = createJumpState();
assert.equal(takeJump(jump, true, true, 1_000), -550, "ground jump should be available");
assert.equal(takeJump(jump, false, true, 1_080), -520, "one air jump should be available");
assert.equal(takeJump(jump, false, true, 1_160), null, "a third jump must be rejected");

const walkedOffEdge = createJumpState();
takeJump(walkedOffEdge, true, false, 2_000);
assert.equal(takeJump(walkedOffEdge, false, true, 2_150), -520, "walking off a platform should leave only the air jump");
assert.equal(takeJump(walkedOffEdge, false, true, 2_220), null);

assert.equal(takeJump(jump, true, false, 2_000), null, "landing should reset jumps without bouncing automatically");
assert.equal(takeJump(jump, true, true, 2_010), -550, "landing should restore both jumps");
const coyote = createJumpState();
takeJump(coyote, true, false, 3_000);
assert.equal(takeJump(coyote, false, true, 3_090), -550, "a slightly late edge jump should still be a ground jump");
assert.equal(takeJump(coyote, false, true, 3_200), -520);
assert.equal(takeJump(coyote, false, true, 3_300), null);
assert.equal(takeJump(coyote, true, false, 3_350), -550, "a jump pressed just before landing should be buffered");

// Endless climb: every platform is reachable from the one below and identical for everyone in the room.
assert(CLIMB_STEP < 550 ** 2 / (2 * CLIMB_GRAVITY) - 6, "one plain jump must clear a floor");
assert.deepEqual(climbPlatform("room-a", 57), climbPlatform("room-a", 57), "the course is deterministic per room");
assert.notDeepEqual(climbPlatform("room-a", 57), climbPlatform("room-b", 57), "different rooms climb different towers");
for (let index = 1; index <= 400; index += 1) {
  const below = climbPlatform("room-a", index - 1);
  const platform = climbPlatform("room-a", index);
  assert(platform.x - platform.range >= 0 && platform.x + platform.width + platform.range <= CLIMB_WORLD_WIDTH,
    `platform ${index} stays inside the walls`);
  if (index > 1) {
    const shift = Math.abs(platform.x + platform.width / 2 - (below.x + below.width / 2));
    assert(shift <= CLIMB_MAX_SHIFT + 1, `platform ${index} is within one hop of the one below`);
  }
  assert.equal(climbFloorAt(platform.y), index, "the height counter reads the platform's floor number");
}
assert.equal(climbPlatform("room-a", 30).kind, "milestone", "every 10th floor is a milestone");

const climbItems = climbItemsAt("room-a", 1_790_000_000_000, 40);
assert(climbItems.length > 0 && new Set(climbItems.map((item) => item.id)).size === climbItems.length);
for (const item of climbItems) assert.equal(climbItemKindOf("room-a", item.id), item.kind);
assert.notDeepEqual(
  climbItemsAt("room-a", 1_790_000_000_000, 40).map((item) => item.id),
  climbItemsAt("room-a", 1_790_000_000_000 + 25_000, 40).map((item) => item.id),
  "items respawn with new ids each window so they can be picked again",
);

console.log("lobby platformer tests passed");

const climbKinds = new Set<string>();
for (let window = 0; window < 40; window += 1) {
  for (const item of climbItemsAt("room-a", window * 25_000, 40)) climbKinds.add(item.kind);
}
assert(climbKinds.has("dash") && climbKinds.has("star"), "the lobby tower drops the dash and star items too");
