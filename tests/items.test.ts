import assert from "node:assert/strict";
import {
  consumeSharedItem,
  gameSupportsSharedItem,
  getSharedItemDefinition,
  grantSharedItem,
  parseSharedItemInventory,
  sharedItemEffectForGame,
  sharedItemQuantity,
  usableSharedItemStacks,
  type SharedGameItemEffects,
} from "../src/items/index.ts";
import {
  BATTLE_SHARED_ITEM_EFFECTS,
  canUseBattleInk,
} from "../src/games/one-on-one-battle/battleSharedItems.ts";
import {
  parseBattleGameConfig,
  resolveBattleQuestionSide,
} from "../src/games/one-on-one-battle/config.ts";
import {
  ACID_RAIN_SHARED_ITEM_EFFECTS,
  acidRainItemEffect,
  acidRainPersistentItemId,
} from "../src/games/typing/acidRainSharedItems.ts";
import { ACID_RAIN_ITEM_KIND } from "../src/games/typing/acidRainEngine.ts";

const parsed = parseSharedItemInventory({
  ink: 2,
  bomb: 1,
  ice: 0,
  unknown: 99,
  __proto__: { polluted: true },
});
assert.deepEqual(parsed, { ink: 2, bomb: 1 });
assert.equal(sharedItemQuantity(parsed, "ink"), 2);
assert.equal(sharedItemQuantity(parsed, "ice"), 0);

const granted = grantSharedItem(parsed, "ink", 3);
assert.deepEqual(granted, { ink: 5, bomb: 1 });
assert.deepEqual(parsed, { ink: 2, bomb: 1 }, "grant must not mutate the previous inventory");

const consumed = consumeSharedItem(granted, "ink", 2);
assert.equal(consumed.consumed, true);
assert.deepEqual(consumed.inventory, { ink: 3, bomb: 1 });

const exhausted = consumeSharedItem({ ice: 1 }, "ice");
assert.equal(exhausted.consumed, true);
assert.deepEqual(exhausted.inventory, {});

const insufficient = consumeSharedItem({ bomb: 1 }, "bomb", 2);
assert.equal(insufficient.consumed, false);
assert.deepEqual(insufficient.inventory, { bomb: 1 });

assert.throws(() => grantSharedItem({}, "ink", 0));
assert.throws(() => consumeSharedItem({}, "ink", -1));

interface BattleEffect {
  readonly kind: "obscure-opponent";
  readonly durationMs: number;
}
interface CardGameEffect {
  readonly kind: "hide-cards";
  readonly count: number;
}

const battleEffects: SharedGameItemEffects<BattleEffect> = {
  ink: { kind: "obscure-opponent", durationMs: 5_000 },
};
const cardGameEffects: SharedGameItemEffects<CardGameEffect> = {
  ink: { kind: "hide-cards", count: 2 },
};

assert.equal(gameSupportsSharedItem(battleEffects, "ink"), true);
assert.equal(gameSupportsSharedItem(battleEffects, "ice"), false);
assert.deepEqual(sharedItemEffectForGame(battleEffects, "ink"), {
  kind: "obscure-opponent",
  durationMs: 5_000,
});
assert.deepEqual(sharedItemEffectForGame(cardGameEffects, "ink"), {
  kind: "hide-cards",
  count: 2,
});
assert.deepEqual(usableSharedItemStacks({ ink: 2, bomb: 3 }, battleEffects), [
  { itemId: "ink", quantity: 2 },
]);

assert.deepEqual(BATTLE_SHARED_ITEM_EFFECTS.ink, { kind: "obscure-opponent" });
assert.equal(canUseBattleInk("choosing", "defender"), true);
assert.equal(canUseBattleInk("answering", "attacker"), true);
assert.equal(canUseBattleInk("choosing", "attacker"), false);
assert.equal(canUseBattleInk("answering", "defender"), false);
assert.equal(canUseBattleInk("grading", "attacker"), false);

assert.deepEqual(parseBattleGameConfig({}), {
  direction: "free",
  answerSeconds: 20,
  answerDurationMs: 20_000,
});
assert.deepEqual(parseBattleGameConfig({
  "battle-direction": "translation-only",
  "battle-answer-seconds": "30",
}), {
  direction: "translation-only",
  answerSeconds: 30,
  answerDurationMs: 30_000,
});
assert.equal(resolveBattleQuestionSide("translation-only", "source"), "meaning");
assert.equal(resolveBattleQuestionSide("composition-only", "meaning"), "source");
assert.equal(resolveBattleQuestionSide("free", "source"), "source");

assert.equal(getSharedItemDefinition("ink").name, "먹물");
assert.equal(getSharedItemDefinition("bomb").emoji, "💣");

assert.equal(acidRainPersistentItemId(ACID_RAIN_ITEM_KIND.BOMB), "bomb");
assert.equal(acidRainPersistentItemId(ACID_RAIN_ITEM_KIND.ICE), "ice");
assert.equal(acidRainPersistentItemId(ACID_RAIN_ITEM_KIND.HEART), null);
assert.equal(acidRainPersistentItemId(ACID_RAIN_ITEM_KIND.CANDY), null);
assert.deepEqual(acidRainItemEffect("bomb"), { kind: "clear-all" });
assert.deepEqual(acidRainItemEffect("ice"), {
  kind: "slow-fall",
  durationMs: 10_000,
  playbackRate: 0.5,
});
assert.deepEqual(ACID_RAIN_SHARED_ITEM_EFFECTS.ice, acidRainItemEffect("ice"));

console.log("shared item core tests passed");
