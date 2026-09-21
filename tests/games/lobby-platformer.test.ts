import assert from "node:assert/strict";
import { movementAction } from "../../src/game-engine/input/movementKeys.ts";
import { createJumpState, takeJump } from "../../src/games/lobby-platformer/movement.ts";

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

console.log("lobby platformer tests passed");
