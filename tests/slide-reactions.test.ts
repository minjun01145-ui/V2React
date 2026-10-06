import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSlideReactionIndex, newReactions, parseStoredReaction, SLIDE_REACTIONS } from "../src/slide-reactions/model.ts";

assert.deepEqual(SLIDE_REACTIONS.map((item) => item.emoji), ["❤️", "❓", "❗", "😄", "😐", "😢"]);
assert.equal(isSlideReactionIndex(5), true);
assert.equal(isSlideReactionIndex(6), false);
assert.equal(isSlideReactionIndex(1.5), false);

assert.deepEqual(parseStoredReaction("a", { e: 0, t: 100 }), { playerId: "a", reaction: 0, sentAtMs: 100 });
assert.equal(parseStoredReaction("a", { e: 9, t: 100 }), null, "unknown emoji indexes are ignored");
assert.equal(parseStoredReaction("a", "heart"), null);

const first = [{ playerId: "a", reaction: 0, sentAtMs: 100 }, { playerId: "b", reaction: 3, sentAtMs: 90 }];
assert.deepEqual(newReactions(null, first), [], "reactions sent before the teacher opened the slide are not replayed");
const seen = new Map(first.map((item) => [item.playerId, item.sentAtMs]));
const second = [{ playerId: "a", reaction: 1, sentAtMs: 250 }, { playerId: "b", reaction: 3, sentAtMs: 90 }, { playerId: "c", reaction: 5, sentAtMs: 260 }];
assert.deepEqual(newReactions(seen, second).map((item) => [item.playerId, item.reaction]), [["a", 1], ["c", 5]], "only fresh reactions float up");

// The rules accept exactly the reaction indexes the app sends.
const rules = readFileSync(new URL("../security/realtime-database.rules.json", import.meta.url), "utf8");
assert.match(rules, new RegExp(`newData\\.val\\(\\) < ${SLIDE_REACTIONS.length} &&`));

console.log("slide reaction tests passed");
