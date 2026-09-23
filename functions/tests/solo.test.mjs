import assert from "node:assert/strict";
import {
  fingerprintSimpleQuizSet,
  isBetterSimpleQuizResult,
  isLeaderboardEligible,
  simpleQuizLeaderboardScopeId,
  transitionSoloRunStatus,
} from "../lib/solo/model.js";

const scope = {
  tenantId: "minjun",
  gameId: "simple-quiz",
  setId: "set-a",
  setFingerprint: "a".repeat(64),
  gameConfig: { setId: "set-a", "choice-count": "4", timedGameMode: "3-minutes" },
  rulesVersion: "simple-quiz-v1",
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
assert.equal(isLeaderboardEligible("completed"), true);
assert.equal(isLeaderboardEligible("abandoned"), false);

const first = { score: 220, correctCount: 2, attemptCount: 2, combo: 2, displayLabel: "별빛여우", completedAtMs: 10 };
assert.equal(isBetterSimpleQuizResult(first, null), true);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 200 }, first), false);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 240 }, first), true);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 220, correctCount: 3 }, first), true);
assert.equal(isBetterSimpleQuizResult({ ...first, score: 220, attemptCount: 3 }, first), false);

console.log("solo server model tests passed");
