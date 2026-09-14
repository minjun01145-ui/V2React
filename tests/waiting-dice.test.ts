import assert from "node:assert/strict";
import { createDiceResults, diceTotal } from "../src/dice/model.ts";
import { parseWaitingDiceState } from "../src/waiting-dice/model.ts";

assert.deepEqual(createDiceResults(3, () => 0), [1, 1, 1]);
assert.deepEqual(createDiceResults(3, () => 0.999), [6, 6, 6]);
assert.equal(diceTotal([2, 5, 3]), 10);

const valid = {
  requestId: "request-1",
  phase: "result",
  diceCount: 2,
  rollerId: "student-1",
  rollerLabel: "별이",
  results: [2, 6],
  requestedAtMs: 10,
  updatedAtMs: 20,
};
assert.deepEqual(parseWaitingDiceState(valid), valid);
assert.equal(parseWaitingDiceState({ ...valid, results: [0, 7] }), null);
assert.equal(parseWaitingDiceState({ ...valid, diceCount: 3 }), null);
assert.equal(parseWaitingDiceState({ ...valid, phase: "rolling", results: [2, 6] }), null);

console.log("waiting dice tests passed");
