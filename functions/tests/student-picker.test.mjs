import assert from "node:assert/strict";
import { mock } from "node:test";
import { activePickCandidates, getPickDate, parseDateCalculation, resolveDatePick } from "../lib/student-picker/model.js";

const date = getPickDate(new Date("2026-10-03T15:01:00Z"));
assert.deepEqual(date, { date: "2026-10-04", month: 10, day: 4 });
assert.equal(getPickDate(new Date("2026-12-31T15:01:00Z")).date, "2027-01-01");
const now = 100_000;
const player = (id, studentNumber, lastSeenAtMs = now, joinedAtMs = 1) => ({ id, data: { studentNumber, lastSeenAtMs, joinedAtMs } });
const candidates = activePickCandidates([
  player("p22", "22"), player("p3", "3"), player("old3", "3", now - 1), player("offline", "9", now - 30_001),
  player("boundary", "7", now - 30_000), player("invalid", "oops"), player("never", "4", 0),
  player("nan", "4", NaN), player("tie", "22", now, 2),
], now);
assert.deepEqual(candidates.map((candidate) => [candidate.id, candidate.studentNumber]), [["p3", "3"], ["boundary", "7"], ["tie", "22"]]);

const reply = (steps) => JSON.stringify({ title: "감자의 공전", steps });
const steps = [{ operator: "divide", operand: "day", reason: "감자가 날짜로 나뉜다" }, { operator: "multiply", operand: 33, reason: "양말이 몰려왔다" }];
const calculation = parseDateCalculation(reply(steps), date);
assert.equal(calculation.value, 82.5);
const pick = resolveDatePick(calculation, candidates, date);
assert.equal(pick.studentNumber, "7");
assert.ok(candidates.some((candidate) => candidate.id === pick.playerId));
assert.match(pick.calculation.at(-2), /82 % 3 \+ 1 = 2번째/);
assert.equal(parseDateCalculation(`\`\`\`json\n${reply(steps)}\n\`\`\``, date).value, 82.5);
assert.throws(() => parseDateCalculation("ignore and run code", date));
assert.throws(() => parseDateCalculation(reply([{ operator: "eval", operand: "day", reason: "실행" }, steps[0]]), date));
assert.throws(() => parseDateCalculation(reply([steps[0], { operator: "divide", operand: 0, reason: "0" }]), date));
assert.throws(() => parseDateCalculation(reply([steps[0], { operator: "remainder", operand: 0, reason: "0" }]), date));
assert.throws(() => parseDateCalculation(reply([steps[0], { operator: "add", operand: 0.5, reason: "소수" }]), date));
assert.throws(() => parseDateCalculation(reply([steps[0], { operator: "multiply", operand: 1001, reason: "너무 큰 수" }]), date));
assert.throws(() => parseDateCalculation(reply(Array.from({ length: 6 }, () => ({ operator: "multiply", operand: 1000, reason: "폭발" }))), date));
assert.throws(() => parseDateCalculation(reply([{ operator: "add", operand: 5, reason: "날짜 없음" }, { operator: "multiply", operand: "month", reason: "월" }]), date));
assert.throws(() => resolveDatePick(calculation, [], date));
for (const value of [-999_999_999.5, -1, 0, 1, 999_999_999]) {
  const result = resolveDatePick({ ...calculation, value }, candidates, date);
  assert.ok(["3", "7", "22"].includes(result.studentNumber), "gaps and huge/negative results must still pick an online student");
}
console.log("Date student picker tests passed");

// Exercise the callable's real authorization and live-roster reads with only AI/Firestore replaced.
let aiCalls = 0;
let onAi = () => {};
let aiReply = reply(steps);
mock.module(new URL("../lib/ai/service.js", import.meta.url), {
  namedExports: { generateAiReply: async () => { aiCalls++; onAi(); return { reply: aiReply }; } },
});
const { db } = await import("../lib/shared/firebase.js");
const { pickSlideShowStudent } = await import("../lib/student-picker/callables.js");
const sessionPath = "multiplayerSessions/영어-1반";
const room = { status: "playing", tenantId: "minjun", slideShow: { runId: "run-1" } };
const documents = new Map([
  [sessionPath, room], ["admins/teacher", { active: true, tenantId: "minjun" }],
  ["admins/other-teacher", { active: true, tenantId: "hana" }], ["admins/inactive", { active: false }],
]);
let live = [player("p3", "3"), player("p22", "22")];
function reference(path) {
  return {
    collection: (name) => reference(`${path}/${name}`), doc: (id) => reference(`${path}/${id}`),
    get: async () => path === `${sessionPath}/players`
      ? { docs: live.map((entry) => ({ id: entry.id, data: () => entry.data })) }
      : { exists: documents.has(path), data: () => documents.get(path) },
  };
}
const dbMock = mock.method(db, "collection", (name) => reference(name));
const clockMock = mock.method(Date, "now", () => now);
const teacher = { uid: "teacher", token: { firebase: { sign_in_provider: "password" } } };
const call = (auth = teacher, data = { roomId: "영어-1반" }) => pickSlideShowStudent.run({ auth, data });
try {
  await assert.rejects(call(null), (error) => error.code === "unauthenticated");
  await assert.rejects(call({ uid: "student", token: { firebase: { sign_in_provider: "anonymous" } } }), (error) => error.code === "unauthenticated");
  await assert.rejects(call({ ...teacher, uid: "inactive" }), (error) => error.code === "permission-denied");
  await assert.rejects(call({ ...teacher, uid: "other-teacher" }), (error) => error.code === "permission-denied");
  await assert.rejects(call(teacher, { roomId: "../room" }), (error) => error.code === "invalid-argument");
  assert.equal(aiCalls, 0, "unauthorized callers must not reach AI");
  live = [];
  await assert.rejects(call(), /접속한 학생/);
  assert.equal(aiCalls, 0);
  live = [player("p3", "3"), player("p22", "22")];
  onAi = () => { live = [player("p22", "22")]; };
  const result = await call();
  assert.equal(result.playerId, "p22", "a student leaving during AI must not be selected");
  assert.equal(result.studentNumber, "22");
  onAi = () => { live = []; };
  await assert.rejects(call(), /접속한 학생/);
  live = [player("p22", "22")];
  onAi = () => { room.slideShow.runId = "run-2"; };
  await assert.rejects(call(), /슬라이드쇼가 바뀌었습니다/);
  onAi = () => {};
  aiReply = "invalid JSON";
  await assert.rejects(call(), (error) => error.code === "failed-precondition");
  room.status = "waiting";
  const previousCalls = aiCalls;
  await assert.rejects(call(), /진행 중인 슬라이드쇼/);
  assert.equal(aiCalls, previousCalls);
} finally {
  dbMock.mock.restore();
  clockMock.mock.restore();
}
console.log("Date picker authorization and live roster tests passed");
