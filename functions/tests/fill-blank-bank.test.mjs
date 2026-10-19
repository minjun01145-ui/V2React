import assert from "node:assert/strict";
import { mock } from "node:test";
import { parseBankReply, parsePreparedBlanks, parseStoredBank } from "../lib/fill-blank-bank/model.js";

const sentence = "I have a dog.";
const blanks = parsePreparedBlanks([
  { answer: "have", distractors: ["has", "had", "keep", "keeps", "having", "have", "a", "dog"] },
  { answer: "cat", distractors: ["a", "b", "c", "d", "e"] },
  { answer: "dog", distractors: ["cat", "bird"] },
], sentence);
assert.equal(blanks.length, 1, "answers must be words of the sentence and keep at least four distractors");
assert.deepEqual(blanks[0].distractors, ["has", "had", "keep", "keeps", "having"], "the answer and words already in the sentence are not distractors");

const inputs = [{ id: "s1", sourceText: "I / have / a dog.", meaning: "나는 / 가지고 있다 / 개를." }];
assert.equal(parseBankReply({ sentences: [{ id: "s1", blanks: [{ answer: "have", distractors: ["has", "had", "keep", "keeps"] }] }, { id: "other", blanks: [] }] }, inputs).size, 1);
assert.equal(parseStoredBank({ sentences: { s1: { sourceText: "I / have / a dog.", blanks } } }).get("s1").blanks.length, 1);

let calls = 0;
mock.module(new URL("../lib/ai/service.js", import.meta.url), { namedExports: { generateAiReply: async (messages, options) => {
  calls += 1;
  assert.equal(options.slot, "ai2");
  const batch = JSON.parse(messages[1].content);
  return { reply: JSON.stringify({ sentences: batch.map((entry) => ({ id: entry.id, blanks: [{ answer: entry.sentence.split(" ")[1], distractors: ["one", "two", "three", "four", "five", "six"] }] })) }) };
} } });
const { prepareFillBlanks } = await import("../lib/fill-blank-bank/service.js");
const many = Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, sourceText: `We / like${"abcdefghijklmnopqrst"[index]} / apples.`, meaning: "" }));
const first = await prepareFillBlanks(many, new Map());
assert.equal(Object.keys(first).length, 20);
assert.equal(calls, 2, "sentences go to the AI in batches");
calls = 0;
const edited = many.map((input, index) => index === 3 ? { ...input, sourceText: "We / love / pears." } : input);
const second = await prepareFillBlanks(edited, parseStoredBank({ sentences: first }));
assert.equal(calls, 1, "only changed sentences are regenerated");
assert.equal(second.s3.sourceText, "We / love / pears.");
assert.deepEqual(second.s0, first.s0, "unchanged sentences keep their blanks");
console.log("Fill-blank bank tests passed: validation, batching and reuse of unchanged sentences");
