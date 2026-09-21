import assert from "node:assert/strict";
import {
  advanceChunkJumpCursor,
  buildChunkJumpCourse,
  chunkJumpChoices,
  chunkJumpStep,
  initialChunkJumpCursor,
} from "../../src/games/chunk-jump-race/model.ts";
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

console.log("chunk jump race model test passed");
