import assert from "node:assert/strict";
import { deadlineCountdownSnapshot } from "../src/game-engine/timed-turn/model.ts";

assert.deepEqual(deadlineCountdownSnapshot(15_000, 5_000, 10_000), { durationMs: 5_000, remainingMs: 5_000, progress: 1, expired: false });
assert.equal(deadlineCountdownSnapshot(12_500, 5_000, 10_000).progress, 0.5);
assert.equal(deadlineCountdownSnapshot(17_000, 5_000, 10_000).remainingMs, 5_000);
assert.deepEqual(deadlineCountdownSnapshot(9_000, 5_000, 10_000), { durationMs: 5_000, remainingMs: 0, progress: 0, expired: true });
console.log("timed turn tests passed");
