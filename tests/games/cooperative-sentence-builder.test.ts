import assert from "node:assert/strict";
import { cooperativeSearchDelayMs, cooperativeTeamSizes } from "../../src/multiplayer/cooperative/model.ts";
import { evaluateSequence } from "../../src/game-engine/sequence/evaluator.ts";
import { adaptReadingChunksToSequence } from "../../src/learning-sets/sentenceSequenceAdapter.ts";
import { settingAppliesToSet } from "../../src/game-engine/contracts/gameDefinition.ts";
import { getGame } from "../../src/games/registry.ts";

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
const unitSetting = getGame("cooperative-sentence-builder").settings.find((setting) => setting.key === "sentence-unit");
assert.ok(unitSetting);
assert.equal(settingAppliesToSet(unitSetting, "reading-chunks"), true);
assert.equal(settingAppliesToSet(unitSetting, "vocabulary"), false);
assert.equal(settingAppliesToSet(unitSetting, null), false);
const wordQuestion = adaptReadingChunksToSequence({ id: "set", items: [{ id: "dup", sourceText: "The cat / and the dog.", meaning: "그 고양이와 그 개" }] }, "word").questions[0]!;
assert.deepEqual(wordQuestion.tokens.map((token) => token.text), ["The", "cat", "and", "the", "dog."]);
assert.equal(evaluateSequence(wordQuestion, { tokenIds: ["dup:chunk:3", "dup:chunk:1", "dup:chunk:2", "dup:chunk:0", "dup:chunk:4"], text: "" }).isCorrect, true);
console.log("cooperative sentence builder tests passed");
