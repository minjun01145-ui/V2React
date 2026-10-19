import assert from "node:assert/strict";
import { parseStudentPracticeRequest, practiceDayKey } from "../lib/question-bank/studentPractice.js";

const request = parseStudentPracticeRequest({ setId: "set_1", avoid: ["다음 빈칸에 알맞은 것은?", 3, "가".repeat(500)] });
assert.equal(request.setId, "set_1");
assert.deepEqual(request.avoid.map((entry) => entry.length), [14, 200], "only short text prompts are kept to avoid repeats");
assert.throws(() => parseStudentPracticeRequest({ setId: "../other" }), /학습 세트/, "a student can only name a set id, never send text");
assert.throws(() => parseStudentPracticeRequest({ items: [{ sourceText: "anything" }] }), /학습 세트/);

// The daily allowance resets at midnight in Korea, not UTC.
assert.equal(practiceDayKey(Date.UTC(2026, 9, 19, 14, 59)), "2026-10-19");
assert.equal(practiceDayKey(Date.UTC(2026, 9, 19, 15, 0)), "2026-10-20");

console.log("student exam practice tests passed");
