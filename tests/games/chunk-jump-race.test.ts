import assert from "node:assert/strict";
import {
  advanceChunkJumpCursor,
  buildChunkJumpCourse,
  chunkJumpChoices,
  chunkJumpShowsMeaning,
  chunkJumpStep,
  initialChunkJumpCursor,
} from "../../src/games/chunk-jump-race/model.ts";
import { crowdSlots, orderCrowd } from "../../src/games/chunk-jump-race/crowdLayout.ts";
import type { RuntimeLearningSet } from "../../src/learning-sets/types.ts";

const set: RuntimeLearningSet = {
  id: "reading-1",
  name: "본문",
  type: "reading-chunks",
  itemCount: 2,
  items: [
    { id: "a", sourceText: "I went to the library / to borrow some books / after school.", meaning: "나는 도서관에 갔다 / 책을 빌리기 위해 / 방과 후에." },
    { id: "b", sourceText: "She called me / when she arrived.", meaning: "그녀는 나에게 전화했다 / 도착했을 때." },
  ],
};

const course = buildChunkJumpCourse(set);
let cursor = initialChunkJumpCursor();
assert.equal(chunkJumpStep(course, cursor).answer, "to borrow some books");
cursor = advanceChunkJumpCursor(course, cursor);
assert.deepEqual(chunkJumpStep(course, cursor).currentChunks, ["I went to the library", "to borrow some books"]);
assert.equal(chunkJumpStep(course, cursor).answer, "after school.");
cursor = advanceChunkJumpCursor(course, cursor);
assert.equal(chunkJumpStep(course, cursor).answer, "when she arrived.");
cursor = advanceChunkJumpCursor(course, cursor);
assert.equal(chunkJumpStep(course, cursor).answer, "to borrow some books");

const choicesA = chunkJumpChoices(course, initialChunkJumpCursor(), "round:student-a");
const choicesB = chunkJumpChoices(course, initialChunkJumpCursor(), "round:student-b");
assert.equal(choicesA.length, 3);
assert(choicesA.includes("to borrow some books"));
assert(choicesB.includes("to borrow some books"));
assert.equal(new Set(choicesA).size, choicesA.length);

// Crowded islands: every nickname gets its own tag slot and the local player stays easy to find.
for (let count = 1; count <= 30; count += 1) {
  const slots = crowdSlots(count);
  assert.equal(slots.length, count);
  assert.equal(new Set(slots.map((slot) => `${slot.tagX}:${slot.tagY}`)).size, count,
    `${count} runners on one island must not share a name tag position`);
  assert(slots.every((slot) => Math.abs(slot.bodyX) <= 44), "bodies stay on the island");
  const withSelf = crowdSlots(count, true);
  assert.equal(new Set(withSelf.map((slot) => `${slot.tagX}:${slot.tagY}`)).size, count);
  assert(withSelf.slice(1).every((slot) => slot.tagY <= withSelf[0]!.tagY - 27 || count === 1),
    "other tags stack above the larger local-player tag instead of overlapping it");
}
assert.deepEqual(orderCrowd(["c", "me", "a"], "me"), ["me", "a", "c"],
  "the local player takes the first tag slot; others keep a stable order");

// The meaning is shown only when the teacher turns the lobby option on.
assert.equal(chunkJumpShowsMeaning(null), false);
assert.equal(chunkJumpShowsMeaning({}), false, "off by default");
assert.equal(chunkJumpShowsMeaning({ "chunk-jump-meaning": "off" }), false);
assert.equal(chunkJumpShowsMeaning({ "chunk-jump-meaning": "on" }), true);

console.log("chunk jump race model test passed");
