import assert from "node:assert/strict";
import {
  applySimpleQuizAnswer,
  emptySimpleQuizAuthoritativeState,
  fingerprintSimpleQuizSet,
  isBetterSimpleQuizResult,
  isLeaderboardEligible,
  matchesSoloStartRequest,
  parseSimpleQuizAuthoritativeState,
  simpleQuizBestRecordId,
  simpleQuizQuestionId,
  simpleQuizQuestionOrder,
  simpleQuizLeaderboardScopeId,
  statusAfterStartingSoloRun,
  transitionSoloRunStatus,
} from "../lib/solo/model.js";
import { tenantAccountId } from "../lib/shared/tenant.js";

const scope = {
  tenantId: "minjun",
  gameId: "simple-quiz",
  setId: "set-a",
  setFingerprint: "a".repeat(64),
  gameConfig: { setId: "set-a", "choice-count": "4", timedGameMode: "3-minutes" },
  rulesVersion: "simple-quiz-v2",
};
assert.equal(simpleQuizLeaderboardScopeId(scope), simpleQuizLeaderboardScopeId({ ...scope, gameConfig: { timedGameMode: "3-minutes", "choice-count": "4", setId: "set-a" } }));
assert.notEqual(simpleQuizLeaderboardScopeId(scope), simpleQuizLeaderboardScopeId({ ...scope, tenantId: "hana" }));
assert.notEqual(simpleQuizLeaderboardScopeId(scope), simpleQuizLeaderboardScopeId({ ...scope, setId: "set-b" }));
assert.notEqual(simpleQuizLeaderboardScopeId(scope), simpleQuizLeaderboardScopeId({ ...scope, setFingerprint: "b".repeat(64) }));
assert.notEqual(simpleQuizLeaderboardScopeId(scope), simpleQuizLeaderboardScopeId({ ...scope, gameConfig: { ...scope.gameConfig, "choice-count": "3" } }));
assert.notEqual(simpleQuizLeaderboardScopeId(scope), simpleQuizLeaderboardScopeId({ ...scope, gameConfig: { ...scope.gameConfig, timedGameMode: "5-minutes" } }));

const items = [{ id: "1", sourceText: "word", meaning: "뜻" }];
assert.equal(fingerprintSimpleQuizSet("vocabulary", items), fingerprintSimpleQuizSet("vocabulary", [{ ...items[0], sourceText: " word " }]));
assert.notEqual(fingerprintSimpleQuizSet("vocabulary", items), fingerprintSimpleQuizSet("vocabulary", [{ ...items[0], meaning: "다른 뜻" }]));

assert.equal(transitionSoloRunStatus("active", "completed"), "completed");
assert.equal(transitionSoloRunStatus("active", "abandoned"), "abandoned");
assert.equal(transitionSoloRunStatus("completed", "completed"), "completed", "중복 완료는 멱등이어야 합니다.");
assert.equal(transitionSoloRunStatus("completed", "abandoned"), "completed");
assert.throws(() => transitionSoloRunStatus("abandoned", "completed"));
assert.equal(statusAfterStartingSoloRun("active"), "abandoned");
assert.equal(statusAfterStartingSoloRun("completed"), "completed", "새 run은 완료 기록을 덮지 않아야 합니다.");
assert.equal(statusAfterStartingSoloRun("abandoned"), "abandoned");
assert.equal(isLeaderboardEligible("completed"), true);
assert.equal(isLeaderboardEligible("abandoned"), false);

const minjunAccount = tenantAccountId("minjun", "30101");
const hanaAccount = tenantAccountId("hana", "30101");
assert.equal(minjunAccount, "30101");
assert.equal(hanaAccount, "hana--30101");
const firstSessionRecordId = simpleQuizBestRecordId(minjunAccount);
const secondSession = { uid: "different-anonymous-uid", studentAccountId: tenantAccountId("minjun", "30101") };
const secondSessionRecordId = simpleQuizBestRecordId(secondSession.studentAccountId);
assert.equal(firstSessionRecordId, secondSessionRecordId, "익명 UID가 바뀌어도 stable account key는 같아야 합니다.");
assert.notEqual(firstSessionRecordId, simpleQuizBestRecordId(tenantAccountId("minjun", "30102")), "다른 학생은 별도 기록이어야 합니다.");
assert.notEqual(firstSessionRecordId, simpleQuizBestRecordId(hanaAccount), "같은 학번도 tenant가 다르면 별도 계정이어야 합니다.");
assert.match(firstSessionRecordId, /^[a-f0-9]{64}$/, "public 문서 경로에 학번을 그대로 넣지 않습니다.");
const startIdentity = {
  ownerUid: "uid-a",
  studentAccountId: minjunAccount,
  tenantId: "minjun",
  gameId: "simple-quiz",
  setId: "set-a",
  setFingerprint: "a".repeat(64),
  leaderboardScopeId: simpleQuizLeaderboardScopeId(scope),
  rulesVersion: "simple-quiz-v2",
  gameConfig: { setId: "set-a", "choice-count": "4", timedGameMode: "3-minutes" },
  displayLabel: "별빛여우",
};
assert.equal(matchesSoloStartRequest(startIdentity, startIdentity), true, "같은 request ID와 입력으로 재시도하면 기존 run을 그대로 재사용해야 합니다.");
assert.equal(matchesSoloStartRequest({ ...startIdentity, ownerUid: "uid-b" }, startIdentity), false, "다른 Firebase 세션의 request 재사용은 거부해야 합니다.");
assert.equal(matchesSoloStartRequest({ ...startIdentity, gameConfig: { ...startIdentity.gameConfig, "choice-count": "3" } }, startIdentity), false);

const orderedItems = [
  { id: "a", sourceText: "apple", meaning: "사과" },
  { id: "b", sourceText: "book", meaning: "책" },
  { id: "c", sourceText: "chair", meaning: "의자" },
  { id: "d", sourceText: "cloud", meaning: "구름" },
  { id: "e", sourceText: "dream", meaning: "꿈" },
];
const orderedQuestions = simpleQuizQuestionOrder(orderedItems, "run-order", "set-order", 4);
assert.equal(orderedQuestions.length, orderedItems.length);
assert.ok(orderedQuestions.every((questionId) => orderedItems.some((item) => questionId === simpleQuizQuestionId(item.id))));

let authoritative = emptySimpleQuizAuthoritativeState();
for (const [index, questionId] of orderedQuestions.slice(0, 2).entries()) {
  const correctOptionId = `${questionId}:correct`;
  authoritative = applySimpleQuizAnswer(authoritative, questionId, correctOptionId, correctOptionId);
  assert.equal(authoritative.attemptCount, index + 1);
}
assert.deepEqual(
  [authoritative.score, authoritative.correctCount, authoritative.attemptCount, authoritative.combo],
  [220, 2, 2, 2],
  "Simple Quiz 서버 점수는 기존 100점 + 콤보 보너스와 일치해야 합니다.",
);
authoritative = applySimpleQuizAnswer(authoritative, orderedQuestions[2], `${orderedQuestions[2]}:distractor:1`, `${orderedQuestions[2]}:correct`);
assert.deepEqual([authoritative.score, authoritative.correctCount, authoritative.attemptCount, authoritative.combo], [220, 2, 3, 0],
  "오답 제출은 점수를 더하지 않고 현재 콤보를 초기화해야 합니다.");
authoritative = applySimpleQuizAnswer(authoritative, orderedQuestions[3], `${orderedQuestions[3]}:correct`, `${orderedQuestions[3]}:correct`);
assert.deepEqual([authoritative.score, authoritative.correctCount, authoritative.attemptCount, authoritative.combo], [320, 3, 4, 1]);
assert.ok(parseSimpleQuizAuthoritativeState(authoritative));
assert.equal(parseSimpleQuizAuthoritativeState({ score: 999999999, correctCount: 0, attemptCount: 0, combo: 0 }), null,
  "client progress aggregate는 server authoritative state로 파싱할 수 없어야 합니다.");
assert.equal(parseSimpleQuizAuthoritativeState({ score: 999999999, correctCount: 10000, attemptCount: 10000, combo: 10000 }), null,
  "범위 안의 가짜 count와 함께 저장된 큰 client score도 승인되지 않아야 합니다.");
assert.equal(parseSimpleQuizAuthoritativeState({
  score: 999999999,
  correctCount: 2,
  attemptCount: 2,
  combo: 2,
  answeredQuestionIds: ["q1", "q2"],
  completedQuestionIds: ["q1", "q2"],
  lastResult: null,
}), null, "그럴듯한 문항 수와 목록을 붙여도 불가능한 score는 server state로 승인되지 않아야 합니다.");
assert.throws(() => applySimpleQuizAnswer(authoritative, orderedQuestions[1], `${orderedQuestions[1]}:correct`, `${orderedQuestions[1]}:correct`),
  /한 번만 제출/);

const first = { score: 220, correctCount: 2, attemptCount: 2, combo: 2, displayLabel: "별빛여우", completedAtMs: 10 };
assert.equal(isBetterSimpleQuizResult(first, null), true);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 200 }, first), false);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 240 }, first), true);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 220, correctCount: 3 }, first), true);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 220, attemptCount: 3 }, first), false);

console.log("solo server model tests passed");
