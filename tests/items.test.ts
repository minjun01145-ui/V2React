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

assert.equal(getSharedItemDefinition("ink").name, "먹물");
assert.equal(getSharedItemDefinition("bomb").emoji, "💣");

console.log("shared item core tests passed");
