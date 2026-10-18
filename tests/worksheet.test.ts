import assert from "node:assert/strict";
import {
  createPracticeWorksheet,
  createReadingWorksheet,
  createRecitationWorksheet,
  lessonLabel,
  parseMeaningsResult,
  parsePracticeResult,
  PRACTICE_LABELS,
  type PracticeKind,
} from "../src/learning-worksheets/model.ts";
import { worksheetFitScale } from "../src/worksheet/fit.ts";
import { parseWorksheetDocument } from "../src/worksheet/validation.ts";

const set = { id: "reading", name: "3학년 5과 Paint a Better Tomorrow", type: "reading-chunks" as const, itemCount: 2, items: [
  { id: "a", sourceText: "We / paint walls.", meaning: "우리는 / 벽에 그림을 그린다." },
  { id: "b", sourceText: "We / are proud.", meaning: "" },
] };
const snapshot = structuredClone(set);

assert.equal(lessonLabel("3학년 5과 Paint a Better Tomorrow"), "3학년 5과");
assert.equal(lessonLabel("1 학년  5 과 비교급"), "1학년 5과");
assert.equal(lessonLabel("Paint a Better Tomorrow"), "Paint a Better Tomorrow", "sets without a grade and lesson keep their name");

const reading = createReadingWorksheet(set, [{ id: "a", meaning: "기존 뜻을 덮어쓰지 않음" }, { id: "b", meaning: "우리는 / 자랑스럽다." }]);
assert.equal(reading.title, "3학년 5과 - 본문 학습지");
assert.equal(reading.fitPages, 2);
assert.equal(reading.sections.length, 1, "the reading worksheet is only the text and its meaning");
assert.equal(reading.sections[0]!.title, undefined);
const table = reading.sections[0]!.blocks[0]!;
assert(table.type === "sentences" && table.blank === undefined);
assert.deepEqual(table.rows.map((row) => row.meaning), [set.items[0]!.meaning, "우리는 / 자랑스럽다."]);
assert.deepEqual(set, snapshot, "generators never mutate the set");

const recitation = createRecitationWorksheet(set, [{ id: "b", meaning: "우리는 / 자랑스럽다." }]);
assert.deepEqual(recitation.sections.map((section) => section.blocks[0]!.type === "sentences" && section.blocks[0]!.blank), ["meaning", "english"]);
assert.equal(recitation.sections[1]!.newPage, true);

const sections = (Object.keys(PRACTICE_LABELS) as PracticeKind[]).map((kind) => ({ kind, items: [{ prompt: kind === "fill-blank" || kind === "vocabulary" ? "We {{blank}} walls." : "문항", answer: "paint" }] }));
const parsed = parsePracticeResult({ mode: "practice", sections, usage: { promptTokens: 1200, outputTokens: 5400 } });
assert.deepEqual(parsed.usage, { promptTokens: 1200, outputTokens: 5400 });
const practice = createPracticeWorksheet(set, parsed.sections);
assert.equal(practice.title, "3학년 5과 - 연습문제 학습지");
const answers = practice.sections.at(-1)!;
assert.equal(answers.title, "정답");
assert.equal(answers.newPage, true, "answers are printed on their own page");
const correction = practice.sections[4]!.blocks[0]!;
assert(correction.type === "questions" && correction.questions[0]!.type === "line", "a correction gets a short answer line, not writing lines");
assert.throws(() => parsePracticeResult({ mode: "practice", sections: [] }));
assert.deepEqual(parseMeaningsResult({ mode: "meanings", meanings: [{ id: "b", meaning: "뜻" }], usage: null }, ["b"]), { meanings: [{ id: "b", meaning: "뜻" }], usage: null });
assert.throws(() => parseMeaningsResult({ mode: "meanings", meanings: [{ id: "a", meaning: "다른 문장" }] }, ["b"]));

// Saved worksheets round-trip through Firestore and come back renderable.
assert.deepEqual(parseWorksheetDocument(JSON.parse(JSON.stringify(practice))), practice);
assert.throws(() => parseWorksheetDocument({ title: "x", footer: "y", sections: [{ blocks: [{ type: "script" }] }] }));

// A long text shrinks to stay within two pages; a short one keeps full size.
assert.equal(worksheetFitScale(reading), 1);
const longSet = { ...set, items: Array.from({ length: 40 }, (_, index) => ({ id: `s${index}`, sourceText: "Some students / painted the old walls / of the village / with bright colors.", meaning: "몇몇 학생들은 / 마을의 오래된 벽을 / 밝은 색으로 칠했다." })) };
const scale = worksheetFitScale(createReadingWorksheet(longSet));
assert(scale < 1 && scale >= 0.62, `long texts shrink (${scale})`);

console.log("Worksheet generators, saved format and page fit tests passed");
