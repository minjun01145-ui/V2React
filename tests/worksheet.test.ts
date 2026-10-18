import assert from "node:assert/strict";
import { createReadingWorksheet, createPracticeWorksheet, parsePracticeResult, parseMeaningsResult, PRACTICE_LABELS } from "../src/learning-worksheets/model.ts";
import type { PracticeKind } from "../src/learning-worksheets/model.ts";
const set = { id: "reading", name: "Paint a Better Tomorrow", type: "reading-chunks" as const, itemCount: 2, items: [{ id: "a", sourceText: "We / paint walls.", meaning: "우리는 / 벽에 그림을 그린다." }, { id: "b", sourceText: "We / are proud.", meaning: "" }] };
const snapshot = structuredClone(set);
const document = createReadingWorksheet(set, [{ id: "a", meaning: "기존 뜻을 덮어쓰지 않음" }, { id: "b", meaning: "우리는 / 자랑스럽다." }]);
assert.equal(document.subtitle, set.name);
const reference = document.sections[0]!.blocks[0]!;
const writing = document.sections[1]!.blocks[0]!;
assert.equal(reference.type, "sentences"); assert.equal(writing.type, "sentences");
if (reference.type === "sentences" && writing.type === "sentences") {
  assert.equal(reference.rows[0]!.english, "We / paint walls.");
  assert.equal(reference.rows[0]!.meaning, set.items[0]!.meaning);
  assert.equal(reference.rows[1]!.meaning, "우리는 / 자랑스럽다.");
  assert.deepEqual(writing.rows, reference.rows); assert.equal(writing.writing, true);
}
assert.equal(document.sections[1]!.newPage, true); assert.deepEqual(set, snapshot);
const sections = (Object.keys(PRACTICE_LABELS) as PracticeKind[]).map(kind => ({ kind, items: [{ prompt: kind === "fill-blank" || kind === "vocabulary" ? "We {{blank}} walls." : "문항", answer: "paint" }] }));
const parsed = parsePracticeResult({ mode: "practice", sections, latencyMs: 42 });
const practice = createPracticeWorksheet(set.name, parsed.sections);
assert.equal(practice.sections.length, 6);
const answers = practice.sections.at(-1)!;
assert.equal(answers.title, "정답"); assert.equal(answers.newPage, true);
assert.deepEqual(answers.blocks, [{ type: "answers", entries: sections.map((_, index) => ({ number: index + 1, answer: "paint" })) }]);
assert.throws(() => parsePracticeResult({ mode: "practice", sections: [], latencyMs: 0 }));
assert.throws(() => parsePracticeResult({ mode: "practice", sections, latencyMs: NaN }));
assert.deepEqual(parseMeaningsResult({ mode: "meanings", meanings: [{ id: "b", meaning: "뜻" }] }, ["b"]), [{ id: "b", meaning: "뜻" }]);
assert.throws(() => parseMeaningsResult({ mode: "meanings", meanings: [{ id: "a", meaning: "다른 문장" }] }, ["b"]));
console.log("Worksheet pure generator and response boundary tests passed");
