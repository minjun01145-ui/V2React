import assert from "node:assert/strict";
import { UndoHistory } from "../src/slide-canvas/undoHistory.ts";

const history = new UndoHistory<string>(4);
history.reset("empty");
assert.equal(history.undo(), null, "nothing to undo on a freshly opened slide");

history.push("text");
history.push("text");
history.push("text+shape");
assert.equal(history.undo(), "text", "repeating the same state is not a separate step");
assert.equal(history.undo(), "empty");
assert.equal(history.undo(), null);
assert.equal(history.redo(), "text");

history.push("text moved");
assert.equal(history.redo(), null, "a new edit after undoing drops the redo branch");
assert.equal(history.undo(), "text");

const capped = new UndoHistory<number>(3);
capped.reset(0);
for (const step of [1, 2, 3, 4]) capped.push(step);
assert.equal(capped.undo(), 3);
assert.equal(capped.undo(), 2);
assert.equal(capped.undo(), null, "only the most recent steps are kept");

console.log("slide undo history tests passed");
