import assert from "node:assert/strict";
import { battleQuestionFromSelection, learningSetTableEntries } from "../src/learning-sets/table/model.ts";

const [entry] = learningSetTableEntries("reading-chunks", [{ id: "one", sourceText: "I / like / dogs.", meaning: "나는 개를 좋아한다." }]);
assert.ok(entry);
assert.equal(entry.source, "I like dogs.");
assert.equal(entry.sourceLabel, "영어 문장");
assert.deepEqual(battleQuestionFromSelection(entry, "source"), { prompt: "나는 개를 좋아한다.", answer: "I like dogs.", direction: "meaning-to-source" });
assert.deepEqual(battleQuestionFromSelection(entry, "meaning"), { prompt: "I like dogs.", answer: "나는 개를 좋아한다.", direction: "source-to-meaning" });
console.log("learning set table tests passed");
