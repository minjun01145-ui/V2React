import assert from "node:assert/strict";
import { movementAction } from "../../src/game-engine/input/movementKeys.ts";
import { createJumpState, createPlatformerInput, takeJump } from "../../src/game-engine/platformer/movement.ts";
import {
  CLIMB_GRAVITY,
  CLIMB_MAX_SHIFT,
  CLIMB_STEP,
  CLIMB_WORLD_WIDTH,
  climbFloorAt,
  climbRaceFinished,
  climbItemKindOf,
  climbItemsAt,
  climbPlatform,
  climbPlatformX,
} from "../../src/games/lobby-platformer/course.ts";
import { CLIMB_MAPS, climbMapForSeed } from "../../src/game-engine/jump-tower/maps/index.ts";
import { crumbleClaimId, crumbleClaimIndex, crumblePhase, CRUMBLE_WARNING_MS, CRUMBLE_HIDDEN_MS } from "../../src/game-engine/jump-tower/platforms/crumbling.ts";
import { steerOnIce, ICE_ACCELERATION, ICE_DRAG } from "../../src/game-engine/jump-tower/platforms/slippery.ts";

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

assert.equal(CLIMB_MAPS.length, 3);
assert.deepEqual(climbMapForSeed("session-7"), climbMapForSeed("session-7"), "gathering, free play and late join select the same session map");
const selectedMaps = new Set(Array.from({ length: 30 }, (_, index) => climbMapForSeed(`session-${index}`).id));
assert.equal(selectedMaps.size, 3, "all three themes are selected without teacher configuration");
for (const map of CLIMB_MAPS) {
  const platforms = Array.from({ length: 100 }, (_, index) => climbPlatform("session", index + 1, map));
  assert(platforms.some((platform) => platform.kind === map.platforms.special), `${map.id} includes its platform mechanic`);
  for (const [offset, platform] of platforms.entries()) {
    assert(platform.x - platform.range >= 0 && platform.x + platform.width + platform.range <= CLIMB_WORLD_WIDTH);
    const below = offset === 0 ? climbPlatform("session", 0, map) : platforms[offset - 1]!;
    assert(Math.abs(platform.x + platform.width / 2 - below.x - below.width / 2) <= map.platforms.maxShift + 1);
  }
}

const moving = Array.from({ length: 20 }, (_, index) => climbPlatform("session", index + 1, CLIMB_MAPS[0])).find((platform) => platform.kind === "moving")!;
assert.equal(climbPlatformX(moving, 5000), climbPlatformX({ ...moving }, 5000), "moving platforms depend on shared time, not page start");
assert.notEqual(climbPlatformX(moving, 5000), climbPlatformX(moving, 5500));

// Picker race finish: the climb ends at the goal floor, while the lobby tower stays endless.
assert.equal(climbRaceFinished(99, 100), false);
assert.equal(climbRaceFinished(100, 100), true, "reaching the goal floor finishes the race");
assert.equal(climbRaceFinished(0, undefined), false, "a tower without a goal never finishes");
assert.equal(climbRaceFinished(400, undefined), false, "the lobby climb keeps going past any floor");
const touchTime = 1_790_000_000_000;
assert.equal(crumbleClaimId(4, touchTime), crumbleClaimId(4, touchTime + 100), "concurrent touches share one transactional claim");
assert.equal(crumbleClaimIndex(crumbleClaimId(4, touchTime)), 4);
assert.equal(crumbleClaimIndex("c4-10"), null, "power-up claims cannot collapse a platform");
assert.equal(crumblePhase(touchTime, touchTime + 100), "warning");
assert.equal(crumblePhase(touchTime, touchTime + CRUMBLE_WARNING_MS), "hidden", "a late join uses the persisted server timestamp");
assert.equal(crumblePhase(touchTime, touchTime + CRUMBLE_WARNING_MS + CRUMBLE_HIDDEN_MS), "solid");

const iceInput = createPlatformerInput();
let acceleration = 0;
let drag = 0;
const iceBody = {
  setAccelerationX(value: number) { acceleration = value; return this; },
  setDragX(value: number) { drag = value; return this; },
} as Parameters<typeof steerOnIce>[0];
iceInput.held.set("right", "right");
steerOnIce(iceBody, iceInput, 1);
assert.equal(acceleration, ICE_ACCELERATION);
assert(ICE_ACCELERATION < 1700 && ICE_DRAG < 700, "ice accelerates and slows more gently than both normal surfaces and air");
iceInput.held.clear();
steerOnIce(iceBody, iceInput, 1);
assert.equal(acceleration, 0);
assert.equal(drag, ICE_DRAG, "releasing movement preserves the slippery glide");
