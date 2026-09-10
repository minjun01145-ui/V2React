import assert from "node:assert/strict";
import { cooperativeSearchDelayMs, cooperativeTeamSizes } from "../../src/multiplayer/cooperative/model.ts";
import { evaluateSequence } from "../../src/game-engine/sequence/evaluator.ts";

assert.deepEqual(cooperativeTeamSizes(0), []);
assert.deepEqual(cooperativeTeamSizes(4), [2, 2]);
assert.deepEqual(cooperativeTeamSizes(5), [2, 3]);
assert.deepEqual(cooperativeTeamSizes(7), [2, 2, 3]);
assert.equal(cooperativeSearchDelayMs(2), 10_000);
assert.equal(cooperativeSearchDelayMs(3), 0);

const question = {
  id: "sentence-1", kind: "sequence" as const, prompt: "나는 학교에 간다",
  tokens: [{ id: "a", text: "I", order: 0 }, { id: "b", text: "go to school", order: 1 }],
  expectedTokenIds: ["a", "b"], source: { setId: "set", itemIndex: 0 },
};
assert.equal(evaluateSequence(question, { tokenIds: ["a", "b"], text: "I go to school" }).isCorrect, true);
assert.equal(evaluateSequence(question, { tokenIds: ["b", "a"], text: "go to school I" }).isCorrect, false);
console.log("cooperative sentence builder tests passed");
