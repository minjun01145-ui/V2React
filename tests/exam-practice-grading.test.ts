import assert from "node:assert/strict";
import { isAnswered, isCorrectResponse, normalizeWrittenAnswer } from "../src/question-bank/grading.ts";
import type { ExamQuestionContent } from "../src/question-bank/types.ts";

const choice: ExamQuestionContent = { format: "choice", prompt: "빈칸에 알맞은 것은?", context: null, explanation: "", choices: ["a", "b", "c", "d", "e"], correctChoice: 3 };
const written: ExamQuestionContent = { format: "written", prompt: "배열하여 쓰시오.", context: null, explanation: "", answer: "I’m going to get up early." };

assert.equal(isCorrectResponse(choice, { format: "choice", choice: 3 }), true);
assert.equal(isCorrectResponse(choice, { format: "choice", choice: 2 }), false);
assert.equal(isCorrectResponse(written, { format: "written", text: "  i'm going to  get up early " }), true, "case, spacing, curly quotes and end punctuation do not matter");
assert.equal(isCorrectResponse(written, { format: "written", text: "I'm going to get up late." }), false);
assert.equal(isCorrectResponse(written, { format: "choice", choice: 1 }), false, "a response of the wrong kind is never right");
assert.equal(normalizeWrittenAnswer("Hello!!"), "hello");

assert.equal(isAnswered(undefined), false);
assert.equal(isAnswered({ format: "written", text: "   " }), false, "a blank answer cannot be graded");
assert.equal(isAnswered({ format: "choice", choice: 1 }), true);

console.log("exam practice grading tests passed");
