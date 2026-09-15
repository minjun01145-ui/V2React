import assert from "node:assert/strict";
import { freeResponseRows, parseFreeResponse, validateFreeResponseAnswer } from "../src/free-response/model.ts";

assert.equal(validateFreeResponseAnswer("  내 생각\n두 번째 줄  "), "내 생각\n두 번째 줄");
assert.throws(() => validateFreeResponseAnswer("  "), /답안/);
assert.throws(() => validateFreeResponseAnswer("가".repeat(2001)), /2000/);
assert.equal(validateFreeResponseAnswer("가".repeat(2000)).length, 2000);

const response = { playerId: "p1", answer: "정답이 없는 자유로운 의견\n두 번째 줄", score: 0, submittedAtMs: 1, updatedAtMs: 2 };
assert.deepEqual(parseFreeResponse("p1", response), response);
assert.equal(parseFreeResponse("p2", response), null);
assert.equal(parseFreeResponse("p1", { ...response, score: 200 }), null);
assert.equal(parseFreeResponse("p1", { ...response, answer: "" }), null);
assert.equal(parseFreeResponse("p1", { ...response, submittedAtMs: NaN }), null);
assert.equal(parseFreeResponse("p1", { ...response, updatedAtMs: Infinity }), null);
assert.equal(parseFreeResponse("p1", null), null);
assert.equal(parseFreeResponse("p1", { ...response, score: 100 })?.score, 100);

const participants = [
  { playerId: "p1", studentNumber: "1", displayName: "학생 1", nickname: "별" },
  { playerId: "p2", studentNumber: "2", displayName: "학생 2", nickname: null },
];
const parsed = parseFreeResponse("p1", response)!;
assert.deepEqual(freeResponseRows(participants, [parsed, { ...parsed, playerId: "not-in-round" }]), [
  { ...participants[0], response: parsed }, { ...participants[1], response: null },
]);
assert.deepEqual(freeResponseRows([], []), []);
console.log("free response validation and presentation model tests passed");
