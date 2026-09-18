import assert from "node:assert/strict";
import {
  consumeStoredSharedItem,
  grantStoredSharedItem,
  isSharedItemId,
  parseStoredSharedItemInventory,
} from "../lib/items/model.js";

assert.equal(isSharedItemId("ink"), true);
assert.equal(isSharedItemId("unknown"), false);

const parsed = parseStoredSharedItemInventory({
  ink: 2,
  bomb: -1,
  ice: 3,
  unknown: 100,
});
assert.deepEqual(parsed, { ink: 2, bomb: 0, ice: 3 });

const granted = grantStoredSharedItem(parsed, "bomb");
assert.deepEqual(granted, { ink: 2, bomb: 1, ice: 3 });
assert.deepEqual(parsed, { ink: 2, bomb: 0, ice: 3 }, "grant must not mutate the previous inventory");

const consumed = consumeStoredSharedItem(granted, "ice");
assert.equal(consumed.consumed, true);
assert.deepEqual(consumed.inventory, { ink: 2, bomb: 1, ice: 2 });

const empty = consumeStoredSharedItem({ ink: 0, bomb: 0, ice: 0 }, "bomb");
assert.equal(empty.consumed, false);
assert.deepEqual(empty.inventory, { ink: 0, bomb: 0, ice: 0 });

console.log("Functions shared item tests passed");
