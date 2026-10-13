import assert from "node:assert/strict";
import { mock } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/shared/firebase.js";
import { gradeQuestion, normalizeShortAnswer, normalizeAiAnswer, questionScore, validateQuestionSource } from "../lib/slide-question/model.js";

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
assert.equal(normalizeShortAnswer("  HELLO \n WORLD  "), "hello world");
assert.equal(normalizeAiAnswer(" CAFÉ — World! "), "caféworld");
assert.equal((await gradeQuestion({ type: "short-answer", prompt: "단답", doublePoints: false }, { answer: "hello world" }, "helloworld", async () => { throw new Error("AI must not run"); })).correct, false);
assert.equal(questionScore(false, 0, 20_000, true), 0);
assert.equal(questionScore(true, 10_000, 20_000, false), 750);
const scope = { roomId: "question-test", roundId: "round-1" };
const sessionPath = `multiplayerSessions/${scope.roomId}`;
const roundPath = `${sessionPath}/rounds/${scope.roundId}`;
const responsePath = `${roundPath}/questionResponses/student-1`;
const progressPath = `${roundPath}/progress/student-1`;
const now = Date.now();
let clock = now;
mock.method(Date, "now", () => clock);
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
let failResultWrite = false;
let transactionQueue = Promise.resolve();
const txMock = mock.method(db, "runTransaction", (work) => {
  const result = transactionQueue.then(async () => {
    const writes = [];
    const value = await work({
      get: async reference => snapshot(reference.path),
      set: (reference, data) => writes.push([reference.path, data, false]),
      update: (reference, data) => writes.push([reference.path, data, true]),
    });
    if (failResultWrite && writes.some(([path, data]) => path === responsePath && typeof data.correct === "boolean")) {
      failResultWrite = false;
      throw new Error("simulated result-write failure");
    }
    for (const [path, data, merge] of writes) documents.set(path, merge ? { ...documents.get(path), ...data } : data);
    return value;
  });
  transactionQueue = result.catch(() => {});
  return result;
});
let providerCalls = 0;
let providerBarrier = null;
let providerStarted = null;
let providerFails = false;
mock.module(new URL("../lib/ai/service.js", import.meta.url), { namedExports: {
  generateAiReply: async () => {
    providerCalls++;
    providerStarted?.();
    if (providerBarrier) await providerBarrier;
    if (providerFails) throw new Error("provider timeout");
    return { reply: '{"correct":true}' };
  },
} });
const { submitSlideQuestion } = await import("../lib/slide-question/callables.js");
const { gradeSlideQuestionResponse } = await import("../lib/slide-question/triggers.js");
const clearResponse = () => { documents.delete(responsePath); documents.delete(progressPath); };
const eventForResponse = () => ({ params: { ...scope, uid: "student-1" }, data: { data: () => ({ ...documents.get(responsePath) }) } });
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
  await submit("0");
  assert.deepEqual(documents.get(responsePath), response, "completed retries never change answer, time or score");
  clearResponse();
  session.slideShow.engine.phase = "submissions";
  await assert.rejects(submit("0"), /마감/);
  session.slideShow.engine.phase = "answering";
  session.startedAt = Timestamp.fromMillis(now - 30000);
  await assert.rejects(submit("0"), /마감/);
  session.startedAt = Timestamp.fromMillis(now + 30000);
  await assert.rejects(submit("0"), /아직/);
  session.roundId = "new-round";
  await assert.rejects(submit("0"), /현재/);

  session.roundId = scope.roundId;
  session.startedAt = Timestamp.fromMillis(now - 1000);
  failResultWrite = true;
  await assert.rejects(submit("2"), /result-write failure/);
  assert.equal(documents.has(responsePath), false, "deterministic answer and score either commit together or neither commits");
  assert.equal(documents.has(progressPath), false);
  await submit("2");
  assert.equal(documents.get(responsePath).correct, true);
  assert.equal(documents.get(progressPath).score, documents.get(responsePath).score);

  clearResponse();
  const savedShow = session.slideShow;
  savedShow.engine.round.source.question = aiQuestion;
  const keyPath = `${sessionPath}/showRuns/run/questionKeys/slide`;
  documents.set(keyPath, { grading: { answer: "apple" } });
  await submit("aple");
  const pending = { ...documents.get(responsePath) };
  assert.equal(pending.correct, null);
  assert.equal(providerCalls, 0, "AI acceptance does not depend on a live browser or provider call");
  assert.equal(JSON.stringify(pending).includes('"apple"'), false, "the private reference answer never enters student-readable metadata");
  session.status = "waiting";
  session.roundId = "later-round";
  session.slideShow = null;
  clock += 60_000;
  failResultWrite = true;
  const pendingEvent = eventForResponse();
  await assert.rejects(gradeSlideQuestionResponse.run(pendingEvent), /result-write failure/);
  assert.equal(documents.get(responsePath).correct, null);
  assert.equal(documents.get(responsePath).gradingLeaseUntilMs, 0, "result-write failure releases the recovery lease");
  await gradeSlideQuestionResponse.run(pendingEvent);
  const recovered = { ...documents.get(responsePath) };
  assert.equal(recovered.correct, true, "automatic retry grades even after the show and deadline have ended");
  assert.equal(recovered.score, questionScore(true, 1000, 20_000, false));
  assert.equal(recovered.submittedAtMs, pending.submittedAtMs);
  assert.equal(recovered.answer, "aple");
  assert.equal(documents.get(progressPath).score, recovered.score);
  const callsAfterRecovery = providerCalls;
  await gradeSlideQuestionResponse.run(pendingEvent);
  await submit("different");
  assert.equal(providerCalls, callsAfterRecovery, "replayed events and requests cannot regrade a completed answer");
  assert.deepEqual(documents.get(responsePath), recovered);

  session.status = "playing";
  session.roundId = scope.roundId;
  session.slideShow = savedShow;
  session.startedAt = Timestamp.fromMillis(clock - 1000);
  clearResponse();
  await submit("aple");
  let releaseProvider;
  providerBarrier = new Promise(resolve => { releaseProvider = resolve; });
  const started = new Promise(resolve => { providerStarted = resolve; });
  const callsBeforeConcurrent = providerCalls;
  const first = submit("first changed answer");
  await started;
  await submit("second changed answer");
  assert.equal(providerCalls, callsBeforeConcurrent + 1, "concurrent recovery cannot consume another AI turn");
  assert.equal(documents.get(responsePath).answer, "aple");
  releaseProvider();
  await first;
  providerBarrier = null;
  providerStarted = null;
  assert.equal(documents.get(responsePath).correct, true);

  clearResponse();
  await submit("aple");
  const interrupted = documents.get(responsePath);
  interrupted.gradingAttemptId = "interrupted";
  interrupted.gradingLeaseUntilMs = clock + 180_000;
  const interruptedEvent = eventForResponse();
  await assert.rejects(gradeSlideQuestionResponse.run(interruptedEvent), /still pending/);
  clock += 180_001;
  savedShow.engine.phase = "submissions";
  await gradeSlideQuestionResponse.run(interruptedEvent);
  assert.equal(documents.get(responsePath).correct, true, "an interrupted attempt recovers when its lease expires");
  assert.equal(documents.get(responsePath).score, questionScore(true, 1000, 20_000, false));

  clearResponse();
  savedShow.engine.phase = "answering";
  session.startedAt = Timestamp.fromMillis(clock - 1000);
  providerFails = true;
  await submit("other");
  await gradeSlideQuestionResponse.run(eventForResponse());
  assert.equal(documents.get(responsePath).method, "fallback");
  assert.equal(documents.get(responsePath).score, 0, "provider errors still finish with the existing deterministic fallback");
  providerFails = false;
  clearResponse();
  await submit(" APPLE! ");
  assert.equal(documents.get(responsePath).correct, true, "normalized exact AI answers commit deterministically");

  clearResponse();
  savedShow.engine.round.source.question = { type: "ox", prompt: "OX", doublePoints: false };
  documents.set(keyPath, { grading: { answer: "O" } });
  documents.set(responsePath, { playerId: "student-1", displayName: "학생", answer: "O", submittedAtMs: clock, correct: null, method: null, score: 0 });
  savedShow.engine.phase = "submissions";
  await submit("X");
  assert.equal(documents.get(responsePath).answer, "O", "legacy pending answers retain their original answer");
  assert.equal(documents.get(responsePath).correct, true);
} finally { mock.restoreAll(); }
console.log("slide question authorization, atomic scores, automatic recovery, deadlines, leases and single submission tests passed");
