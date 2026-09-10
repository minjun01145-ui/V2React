import assert from "node:assert/strict";
import { teamSizes } from "../lib/cooperative-sentence/model.js";

assert.deepEqual(teamSizes(2), [2]);
assert.deepEqual(teamSizes(3), [3]);
assert.deepEqual(teamSizes(5), [2, 3]);
assert.deepEqual(teamSizes(9), [2, 2, 2, 3]);
assert.equal(teamSizes(9).reduce((sum, size) => sum + size, 0), 9);
console.log("cooperative sentence server model tests passed");
