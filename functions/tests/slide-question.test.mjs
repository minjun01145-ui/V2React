import assert from "node:assert/strict";
import { mock } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/shared/firebase.js";
import { submitSlideQuestion } from "../lib/slide-question/callables.js";
import { gradeQuestion, normalizeAiAnswer, questionScore, validateQuestionSource } from "../lib/slide-question/model.js";

const question = { type: "multiple-choice", prompt: "고르세요", options: ["A", "B", "C"], doublePoints: true };
assert.throws(() => validateQuestionSource({ kind: "slide-question", question, grading: { correctOptions: [] } }), /정답/);
assert.equal(normalizeAiAnswer(" CAFÉ ! "), "café");
let aiCalls = 0;
const aiQuestion = { type: "ai-short-answer", prompt: "뜻", doublePoints: false };
assert.deepEqual(await gradeQuestion(aiQuestion, { answer: "Café" }, " CAFÉ! ", async () => { aiCalls++; return false; }), { correct: true, method: "deterministic" });
assert.equal(aiCalls, 0);
assert.deepEqual(await gradeQuestion(aiQuestion, { answer: "apple" }, "other", async () => { throw new Error("timeout"); }), { correct: false, method: "fallback" });
assert.deepEqual(await gradeQuestion({ type: "ox", prompt: "OX", doublePoints: false }, { answer: "O" }, "X", async () => { throw new Error("AI must not run"); }), { correct: false, method: "deterministic" });
assert.deepEqual(await gradeQuestion({ type: "short-answer", prompt: "단답", doublePoints: false }, { answer: "Hello World" }, " hello   WORLD ", async () => { throw new Error("AI must not run"); }), { correct: true, method: "deterministic" });
assert.equal(questionScore(true, 10000, 20000, true), 1500);
const scope = { roomId: "question-test", roundId: "round-1" };
const sessionPath = `multiplayerSessions/${scope.roomId}`;
const roundPath = `${sessionPath}/rounds/${scope.roundId}`;
const responsePath = `${roundPath}/questionResponses/student-1`;
const progressPath = `${roundPath}/progress/student-1`;
const now = Date.now();
const session = { status: "playing", gameId: "slide-question", roundId: scope.roundId, startedAt: Timestamp.fromMillis(now - 1000), slideShow: { runId: "run", engine: { roundId: scope.roundId, slideId: "slide", phase: "answering", round: { gameId: "slide-question", durationSeconds: 20, source: { kind: "slide-question", question } } } } };
const documents = new Map([
  [sessionPath, session],
  [`${sessionPath}/players/student-1`, { playerId: "student-1", studentNumber: "1", displayName: "학생" }],
  [`${roundPath}/participants/student-1`, { playerId: "student-1", studentNumber: "1", displayName: "학생" }],
  [`${sessionPath}/showRuns/run/questionKeys/slide`, { grading: { correctOptions: [0, 2] } }],
]);
function snapshot(path) { return { exists: documents.has(path), data: () => documents.get(path) }; }
function ref(path) { return { path, collection: (name) => ref(`${path}/${name}`), doc: (id) => ref(`${path}/${id}`), get: async () => snapshot(path) }; }
const collectionMock = mock.method(db, "collection", (name) => ref(name));
const txMock = mock.method(db, "runTransaction", async (work) => {
  const writes = [];
  const result = await work({ get: async (reference) => snapshot(reference.path), set: (reference, value) => writes.push([reference.path, value]) });
  for (const [path, value] of writes) documents.set(path, value);
  return result;
});
const batchMock = mock.method(db, "batch", () => {
  const writes = [];
  return { update: (reference, value) => writes.push([reference.path, value]), commit: async () => { for (const [path, value] of writes) documents.set(path, { ...documents.get(path), ...value }); } };
});
const auth = { uid: "student-1", token: { firebase: { sign_in_provider: "anonymous" } } };
const submit = (answer, requestAuth = auth, extras = {}) => submitSlideQuestion.run({ auth: requestAuth, data: { ...scope, answer, ...extras } });
try {
  await assert.rejects(submit("0", null), /학생 인증/);
  await assert.rejects(submit("0", { ...auth, uid: "outsider" }), /참가자/);
  await assert.rejects(submit("5"), /선택한/);
  await assert.rejects(submit("a".repeat(1001)), /1000/);
  session.slideShow.engine.round.source.kind = "custom";
  await assert.rejects(submit("0"), /현재/);
  session.slideShow.engine.round.source.kind = "slide-question";
  session.slideShow.engine.round.gameId = "free-response";
  await assert.rejects(submit("0"), /현재/);
  session.slideShow.engine.round.gameId = "slide-question";
  assert.deepEqual(await submit("2", auth, { score: 999999, correct: true, submittedAtMs: 0, playerId: "victim" }), { submitted: true });
  const response = documents.get(responsePath);
  assert.equal(response.correct, true, "one of multiple checked correct options is accepted");
  assert.equal(response.method, "deterministic");
  assert.ok(response.submittedAtMs >= now, "server receipt time ignores client timestamps");
  assert.ok(response.score > 1000 && response.score <= 2000, "double points are server calculated");
  assert.equal(documents.get(progressPath).score, response.score);
  assert.equal(documents.has(`${roundPath}/questionResponses/victim`), false);
  assert.equal("grading" in response, false);
  await submit("1");
  assert.equal(documents.get(responsePath).answer, "2", "a student gets exactly one submission");
  session.slideShow.engine.phase = "submissions";
  await assert.rejects(submit("0"), /마감/);
  session.slideShow.engine.phase = "answering";
  session.startedAt = Timestamp.fromMillis(now - 30000);
  await assert.rejects(submit("0"), /마감/);
  session.startedAt = Timestamp.fromMillis(now + 30000);
  await assert.rejects(submit("0"), /아직/);
  session.roundId = "new-round";
  await assert.rejects(submit("0"), /현재/);
} finally { collectionMock.mock.restore(); txMock.mock.restore(); batchMock.mock.restore(); }
console.log("slide question callable authorization, server score/time, single submission and deadline tests passed");
