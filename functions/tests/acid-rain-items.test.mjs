import assert from "node:assert/strict";
import {
  ACID_RAIN_REWARD_COOLDOWN_MS,
  isAcidRainRewardItemId,
} from "../lib/acid-rain-items/model.js";

assert.equal(isAcidRainRewardItemId("bomb"), true);
assert.equal(isAcidRainRewardItemId("ice"), true);
assert.equal(isAcidRainRewardItemId("ink"), false);
assert.equal(isAcidRainRewardItemId("heart"), false);
assert.equal(ACID_RAIN_REWARD_COOLDOWN_MS, 25_000);

console.log("Acid rain item policy tests passed");
