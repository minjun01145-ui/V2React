import assert from "node:assert/strict";
import { classroomLabel, practiceMonth, rankPracticeRecords } from "../lib/typing-practice/model.js";

assert.equal(classroomLabel("30317"), "3학년 3반");
assert.equal(classroomLabel("31001"), "3학년 10반");
assert.equal(classroomLabel("17"), "학반 미등록");
assert.equal(practiceMonth(Date.parse("2026-09-30T14:59:59Z")), "2026-09");
assert.equal(practiceMonth(Date.parse("2026-09-30T15:00:00Z")), "2026-10");
const entry = (accountId, averageCpm, bestCpm = 500, completedAt = 1) => ({
  accountId, nickname: "별", classroom: "3학년 3반", averageCpm, bestCpm, completedAt,
});
let records = [];
for (let i = 0; i < 12; i++) records = rankPracticeRecords(records, entry(`student-${i}`, i * 10));
assert.equal(records.length, 10);
assert.equal(records[0].averageCpm, 110);
assert.equal(records[9].averageCpm, 20);
records = rankPracticeRecords(records, entry("student-11", 1));
assert.equal(records[0].averageCpm, 110, "A slower completion must not replace a student's best.");
records = rankPracticeRecords(records, entry("student-11", 120));
assert.equal(records.filter((record) => record.accountId === "student-11").length, 1);
assert.equal(records[0].averageCpm, 120);
assert.deepEqual(rankPracticeRecords([entry("a", 100, 200)], entry("b", 100, 300)).map((record) => record.accountId), ["b", "a"]);
assert.deepEqual(rankPracticeRecords([entry("a", 100, 300, 1)], entry("b", 100, 300, 2)).map((record) => record.accountId), ["a", "b"]);
console.log("Typing practice ranking tests passed.");
