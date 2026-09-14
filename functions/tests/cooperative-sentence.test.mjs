import assert from "node:assert/strict";
import { hardModeDeadline, isHardModeTurnExpired, partnerDisplayName, teamSizes } from "../lib/cooperative-sentence/model.js";

assert.deepEqual(teamSizes(2), [2]);
assert.deepEqual(teamSizes(3), [3]);
assert.deepEqual(teamSizes(5), [2, 3]);
assert.deepEqual(teamSizes(9), [2, 2, 2, 3]);
assert.equal(teamSizes(9).reduce((sum, size) => sum + size, 0), 9);
assert.equal(partnerDisplayName("별빛", "홍길동"), "별빛");
assert.equal(partnerDisplayName(null, "홍길동"), "홍길동");
assert.equal(hardModeDeadline(true, 10_000), 15_000);
assert.equal(hardModeDeadline(false, 10_000), null);
assert.equal(isHardModeTurnExpired(true, 15_000, 14_999), false);
assert.equal(isHardModeTurnExpired(true, 15_000, 15_000), true);
assert.equal(isHardModeTurnExpired(false, 15_000, 20_000), false);
console.log("cooperative sentence server model tests passed");
