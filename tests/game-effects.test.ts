import assert from "node:assert/strict";
import { createScoreCelebration, GAME_EFFECT_LEVEL, gameEffectLevel } from "../src/game-engine/effects/model.ts";

assert.equal(gameEffectLevel(1), GAME_EFFECT_LEVEL.STANDARD);
assert.equal(gameEffectLevel(2), GAME_EFFECT_LEVEL.COMBO);
assert.equal(gameEffectLevel(4), GAME_EFFECT_LEVEL.SUPER);
assert.equal(gameEffectLevel(6), GAME_EFFECT_LEVEL.MAX);

assert.deepEqual(createScoreCelebration({ scoreDelta: 100, combo: 1 }), {
  kind: "score-celebration",
  tone: "success",
  headline: "정답!",
  metric: "+100점",
  detail: null,
  combo: 1,
  bonusScore: 0,
  level: GAME_EFFECT_LEVEL.STANDARD,
  durationMs: 780,
});

const comboEffect = createScoreCelebration({ scoreDelta: 160, combo: 4 });
assert.equal(comboEffect.headline, "4 SUPER COMBO!");
assert.equal(comboEffect.detail, "콤보 보너스 +60점");
assert.equal(comboEffect.level, GAME_EFFECT_LEVEL.SUPER);

const maxEffect = createScoreCelebration({ scoreDelta: 200, combo: 12 });
assert.equal(maxEffect.headline, "12 MAX COMBO!");
assert.equal(maxEffect.bonusScore, 100);
assert.equal(maxEffect.level, GAME_EFFECT_LEVEL.MAX);

console.log("game effect engine tests passed");
