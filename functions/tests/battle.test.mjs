import assert from "node:assert/strict";
import { battleGroupSizes, displayName, nextBattleIndices, questionText } from "../lib/battle/model.js";

assert.deepEqual(battleGroupSizes(2), [2]);
assert.deepEqual(battleGroupSizes(3), [3]);
assert.deepEqual(battleGroupSizes(7), [2, 2, 3]);
assert.deepEqual(nextBattleIndices(2, 1), { attackerIndex: 1, defenderIndex: 0 });
assert.deepEqual(nextBattleIndices(3, 1), { attackerIndex: 1, defenderIndex: 2 });
assert.equal(displayName("별", "본명"), "별");
assert.equal(displayName(null, "본명"), "본명");
const item = { id: "dog", source: "dog", meaning: "강아지" };
assert.deepEqual(questionText(item, "source"), { prompt: "강아지", expectedAnswer: "dog" });
assert.deepEqual(questionText(item, "meaning"), { prompt: "dog", expectedAnswer: "강아지" });
console.log("battle server model tests passed");
