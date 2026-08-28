import assert from "node:assert/strict";
import { applyComboScore } from "../src/game-engine/scoring/combo.ts";

const config = { bonusPerStep: 20, maximumBonus: 100 };
assert.deepEqual(applyComboScore(0, true, 100, config), { combo: 1, scoreDelta: 100, bonusScore: 0 });
assert.deepEqual(applyComboScore(3, true, 100, config), { combo: 4, scoreDelta: 160, bonusScore: 60 });
assert.deepEqual(applyComboScore(9, true, 100, config), { combo: 10, scoreDelta: 200, bonusScore: 100 });
assert.deepEqual(applyComboScore(4, false, 100, config), { combo: 0, scoreDelta: 0, bonusScore: 0 });
assert.deepEqual(applyComboScore(-3, true, 80, config), { combo: 1, scoreDelta: 80, bonusScore: 0 });

console.log("combo scoring tests passed");
