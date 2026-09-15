import assert from "node:assert/strict";
import { mock } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/shared/firebase.js";
import { submitFreeResponse, awardFreeResponsePoints } from "../lib/free-response/callables.js";
import { parseSubmissionInput, parseAwardInput, parseFreeResponseRound } from "../lib/free-response/validation.js";
import { assertSubmissionOpen } from "../lib/free-response/model.js";

const scope = { roomId: "영어-1반", roundId: "round-1" };
assert.equal(parseSubmissionInput({ ...scope, answer: "  자유 의견\n두 번째 줄  ", score: 999 }).answer, "자유 의견\n두 번째 줄");
assert.throws(() => parseSubmissionInput({ ...scope, answer: " " }), /답안/);
assert.throws(() => parseSubmissionInput({ ...scope, answer: "a".repeat(2001) }), /2000/);
assert.throws(() => parseAwardInput({ ...scope, playerId: "../student" }), /ID/);
assert.throws(() => parseSubmissionInput({ ...scope, roomId: "../room", answer: "test" }), /ID/);

const now = Date.now();
const session = {
  status: "playing", gameId: "free-response", roundId: scope.roundId,
  startedAt: Timestamp.fromMillis(now - 1000), startedAtMs: now - 1000,
  quizGame: {
    phase: "answering", currentRoundIndex: 0,
    plan: { rounds: [{ gameId: "free-response", durationSeconds: 30, source: { kind: "free-response", prompt: "오늘 배운 내용은?" } }] },
  },
};
const round = parseFreeResponseRound(session, scope.roundId);
assert.equal(round.startedAtMs, now - 1000);
assert.equal(parseFreeResponseRound({ ...session, startDelayMs: 2000 }, scope.roundId).startedAtMs, now + 1000);
assert.equal(parseFreeResponseRound({ ...session, startedAt: null, startDelayMs: 2000 }, scope.roundId).startedAtMs, now - 1000);
assert.throws(() => assertSubmissionOpen(round, round.startedAtMs - 1), /아직/);
assert.throws(() => assertSubmissionOpen(round, round.startedAtMs + round.durationMs), /마감/);
assert.throws(() => parseFreeResponseRound({ ...session, startedAt: null, startedAtMs: null }, scope.roundId), /아직/);
assert.throws(() => parseFreeResponseRound(session, "other-round"), /현재/);

const sessionPath = `multiplayerSessions/${scope.roomId}`;
const roundPath = `${sessionPath}/rounds/${scope.roundId}`;
const responsePath = `${roundPath}/freeResponses/student-1`;
const progressPath = `${roundPath}/progress/student-1`;
const participantPath = `${roundPath}/participants/student-1`;
const documents = new Map([
  [sessionPath, session], [participantPath, { playerId: "student-1", studentNumber: "1", displayName: "학생 1" }],
  ["admins/teacher-1", { active: true }], ["admins/inactive-teacher", { active: false }],
]);
function snapshot(path) { return { exists: documents.has(path), data: () => documents.get(path) }; }
function reference(path) {
  return { path, collection: (name) => reference(`${path}/${name}`), doc: (id) => reference(`${path}/${id}`), get: async () => snapshot(path) };
}
const collectionMock = mock.method(db, "collection", (name) => reference(name));
const transactionMock = mock.method(db, "runTransaction", async (work) => {
  const writes = [];
  const result = await work({
    get: async (ref) => snapshot(ref.path),
    set: (ref, data) => writes.push([ref.path, data]),
    update: (ref, data) => writes.push([ref.path, { ...documents.get(ref.path), ...data }]),
  });
  for (const [path, data] of writes) documents.set(path, data);
  return result;
});
const studentAuth = { uid: "student-1", token: { firebase: { sign_in_provider: "anonymous" } } };
const teacherAuth = { uid: "teacher-1", token: { firebase: { sign_in_provider: "password" } } };
const submit = (answer, auth = studentAuth, extra = {}) => submitFreeResponse.run({ auth, data: { ...scope, answer, ...extra } });
const award = (auth = teacherAuth, extra = {}) => awardFreeResponsePoints.run({ auth, data: { ...scope, playerId: "student-1", ...extra } });
try {
  await assert.rejects(submit("의견", null), /학생 인증/);
  await assert.rejects(award(studentAuth), /관리자 로그인/);
  await assert.rejects(award({ ...teacherAuth, uid: "inactive-teacher" }), /관리자 권한/);
  await assert.rejects(award({ ...teacherAuth, uid: "unknown-teacher" }), /관리자 권한/);
  await assert.rejects(submit("의견", { ...studentAuth, uid: "outsider" }), /참가자/);
  await assert.rejects(award(), /마감 후/);

  await submit("정해진 정답 없는 의견\n두 번째 줄", studentAuth, { playerId: "victim", score: 999 });
  assert.equal(documents.get(responsePath).answer, "정해진 정답 없는 의견\n두 번째 줄");
  assert.equal(documents.get(responsePath).score, 0);
  assert.equal(documents.get(progressPath).score, 0);
  assert.equal(documents.get(progressPath).attemptCount, 1);
  assert.equal(documents.has(`${roundPath}/freeResponses/victim`), false);
  const submittedAt = documents.get(responsePath).submittedAtMs;
  await submit("수정된 답안");
  assert.equal(documents.get(responsePath).answer, "수정된 답안");
  assert.equal(documents.get(responsePath).submittedAtMs, submittedAt);
  assert.equal(documents.get(progressPath).attemptCount, 1);
  assert.equal(documents.get(progressPath).revision, 2);

  session.startedAt = Timestamp.fromMillis(now - 60000);
  await assert.rejects(submit("시간 초과"), /마감/);
  session.startedAt = Timestamp.fromMillis(now - 1000);
  session.quizGame.phase = "submissions";
  await assert.rejects(submit("마감 후 수정"), /마감/);
  await assert.rejects(award(teacherAuth, { playerId: "not-submitted" }), /제출된 답안/);
  await award(teacherAuth, { score: 999 });
  assert.equal(documents.get(responsePath).score, 100);
  assert.equal(documents.get(responsePath).awardedBy, teacherAuth.uid);
  assert.equal(documents.get(progressPath).score, 100);
  assert.equal(documents.get(progressPath).correctCount, 1);
  assert.equal(documents.get(progressPath).attemptCount, 1);
  assert.equal(documents.get(progressPath).revision, 3);
  await Promise.all([award(), award()]);
  assert.equal(documents.get(progressPath).score, 100);
  assert.equal(documents.get(progressPath).revision, 3);
  assert.equal(documents.get(responsePath).answer, "수정된 답안");

  session.quizGame.phase = "leaderboard";
  await assert.rejects(award(), /마감 후 현황판/);
  session.roundId = "round-2";
  await assert.rejects(submit("이전 라운드"), /현재/);
  await assert.rejects(award(), /현재/);
} finally {
  collectionMock.mock.restore();
  transactionMock.mock.restore();
}
console.log("free response submission, authorization, closing and manual score tests passed");
