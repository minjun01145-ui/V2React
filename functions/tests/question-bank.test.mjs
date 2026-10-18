import assert from "node:assert/strict";
import { mock } from "node:test";
import { parseExamGenerationInput, parseExamQuestions } from "../lib/question-bank/model.js";

const input = { name: "1학년 5과", items: [{ sourceText: "How about playing badminton?", meaning: "배드민턴 치는 게 어때?" }], count: 5, avoid: ["이미 낸 문제"] };
const choice = { format: "choice", prompt: "빈칸에 알맞은 것은?", context: "How about ______ badminton?", choices: ["play", "to play", "playing", "played", "plays"], answer: 3, explanation: "동명사" };
const written = { format: "written", prompt: "고쳐 쓰시오.", context: null, answer: "have → having", explanation: "" };

assert.deepEqual(parseExamGenerationInput(input), input);
assert.throws(() => parseExamGenerationInput({ ...input, count: 50 }), "batch size is bounded");
assert.throws(() => parseExamGenerationInput({ ...input, items: [] }));
const parsed = parseExamQuestions({ questions: [choice, written, { ...choice, choices: ["a", "b"] }] });
assert.equal(parsed.length, 2, "broken questions are dropped, valid ones kept");
assert.equal(parsed[0].correctChoice, 3, "the AI's 1-based answer becomes correctChoice");
assert.throws(() => parseExamQuestions({ questions: [{ ...choice, answer: 9 }] }), /다시/);

let aiOptions;
let reply = JSON.stringify({ questions: [choice, written, choice, written, choice, written] });
mock.module(new URL("../lib/ai/service.js", import.meta.url), { namedExports: { generateAiReply: async (_messages, options) => { aiOptions = options; return { reply, latencyMs: 10, promptTokenCount: 700, outputTokenCount: 3000 }; } } });
const { generateExamQuestionDraft } = await import("../lib/question-bank/service.js");
const result = await generateExamQuestionDraft(input);
assert.equal(result.questions.length, 5, "never more than requested");
assert.equal(aiOptions.slot, "ai2");
assert.deepEqual(result.usage, { promptTokens: 700, outputTokens: 3000 });
reply = "not json";
await assert.rejects(generateExamQuestionDraft(input), /JSON/);
console.log("Exam question server tests passed: input bounds, AI response validation, AI2 and usage");
