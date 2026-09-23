import assert from "node:assert/strict";
import { SESSION_STATUS } from "../src/multiplayer/constants.ts";
import { applyComboScore } from "../src/game-engine/scoring/combo.ts";
import { applyResultToProgress, createEmptyProgress } from "../src/game-engine/progress/index.ts";
import { moveToNextQuestion } from "../src/game-engine/question-engine/progress.ts";
import { getGame, listGames } from "../src/games/registry.ts";
import { evaluateSimpleQuizAnswer, SIMPLE_QUIZ_COMBO_SCORING } from "../src/games/simple-quiz/model.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../src/learning-sets/types.ts";
import { canEnterSolo } from "../src/features/student/solo/model.ts";
import { canonicalizeLeaderboardScope, normalizeSoloGameConfig, sha256Hex } from "../src/solo/domain/config.ts";
import { fingerprintLearningSet } from "../src/solo/domain/learningSetFingerprint.ts";
import { soloRunProgressPath } from "../src/solo/domain/path.ts";
import { canonicalizeSimpleQuizLeaderboardScope, fingerprintSimpleQuizSet, simpleQuizLeaderboardScopeId } from "../functions/src/solo/model.ts";

const supportedSoloGames = listGames().filter((game) => game.solo.supported);
assert.deepEqual(supportedSoloGames.map((game) => game.id), ["simple-quiz"]);
assert.equal(getGame("word-uno").solo.supported, false);
assert.equal(getGame("ai-tutor").solo.supported, false);
assert.equal(getGame("placeholder").solo.supported, false);

const game = getGame("simple-quiz");
const defaultConfig = normalizeSoloGameConfig(game, { setId: "set-a" });
const explicitDefaults = normalizeSoloGameConfig(game, { setId: "set-a", "choice-count": "4", timedGameMode: "3-minutes" });
assert.deepEqual(defaultConfig, explicitDefaults, "생략한 기본 설정과 명시한 기본 설정은 같은 정규 config여야 합니다.");

const baseScope = {
  tenantId: "minjun",
  gameId: "simple-quiz",
  setId: "set-a",
  setFingerprint: "a".repeat(64),
  gameConfig: defaultConfig,
  rulesVersion: "simple-quiz-v1",
};
const reorderedConfig = { timedGameMode: "3-minutes", "choice-count": "4", setId: "set-a" };
assert.equal(
  canonicalizeLeaderboardScope(baseScope, game.solo.supported ? game.solo.leaderboardConfigKeys : []),
  canonicalizeLeaderboardScope({ ...baseScope, gameConfig: reorderedConfig }, game.solo.supported ? game.solo.leaderboardConfigKeys : []),
  "config key 순서는 scope를 바꾸지 않아야 합니다.",
);
const clientCanonicalScope = canonicalizeLeaderboardScope(baseScope, ["choice-count", "timedGameMode"]);
assert.equal(clientCanonicalScope, canonicalizeSimpleQuizLeaderboardScope(baseScope), "브라우저와 Functions가 같은 scope 문자열을 계산해야 합니다.");
assert.equal(await sha256Hex(clientCanonicalScope), simpleQuizLeaderboardScopeId(baseScope));
const canonical = canonicalizeLeaderboardScope(baseScope, ["choice-count", "timedGameMode"]);
assert.notEqual(canonical, canonicalizeLeaderboardScope({ ...baseScope, gameConfig: { ...defaultConfig, "choice-count": "3" } }, ["choice-count", "timedGameMode"]));
assert.notEqual(canonical, canonicalizeLeaderboardScope({ ...baseScope, gameConfig: { ...defaultConfig, timedGameMode: "5-minutes" } }, ["choice-count", "timedGameMode"]));
assert.notEqual(canonical, canonicalizeLeaderboardScope({ ...baseScope, setId: "set-b" }, ["choice-count", "timedGameMode"]));
assert.notEqual(canonical, canonicalizeLeaderboardScope({ ...baseScope, setFingerprint: "b".repeat(64) }, ["choice-count", "timedGameMode"]));
assert.notEqual(canonical, canonicalizeLeaderboardScope({ ...baseScope, tenantId: "hana" }, ["choice-count", "timedGameMode"]));

const sourceSet: LearningSet = {
  id: "set-a",
  name: "테스트 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 5,
  createdAtMs: 1,
  updatedAtMs: 1,
  items: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}`, sourceText: `word-${index}`, meaning: `뜻-${index}` })),
};
const originalFingerprint = await fingerprintLearningSet(sourceSet);
assert.equal(originalFingerprint, fingerprintSimpleQuizSet(sourceSet.type, sourceSet.items));
assert.equal(originalFingerprint, await fingerprintLearningSet({ ...sourceSet, name: "이름 변경" }), "표시 이름 변경은 gameplay revision을 바꾸지 않습니다.");
assert.notEqual(originalFingerprint, await fingerprintLearningSet({ ...sourceSet, items: sourceSet.items.map((item, index) => index === 0 ? { ...item, meaning: "바뀐 뜻" } : item) }));

assert.notEqual(soloRunProgressPath("minjun", "run-a", "uid-a"), soloRunProgressPath("hana", "run-a", "uid-a"));
assert.match(soloRunProgressPath("minjun", "run-a", "uid-a"), /^tenants\/minjun\/soloRuns\//);
assert.equal(soloRunProgressPath("minjun", "run-a", "uid-a").includes("multiplayerSessions"), false);
assert.throws(() => soloRunProgressPath("minjun", "bad/run", "uid-a"));

assert.equal(canEnterSolo(SESSION_STATUS.WAITING, false), true);
assert.equal(canEnterSolo(SESSION_STATUS.PREPARING, false), false);
assert.equal(canEnterSolo(SESSION_STATUS.PLAYING, false), false);
assert.equal(canEnterSolo(SESSION_STATUS.WAITING, true), false);

const quiz = game.presentQuizQuestion?.({ sourceText: "word", meaning: "뜻" }, {}) ?? { prompt: "", answer: "" };
assert.equal(quiz.prompt, "뜻");
const question = {
  id: "q1",
  kind: "multiple-choice" as const,
  prompt: "뜻",
  options: [{ id: "right", text: "word" }, { id: "wrong", text: "other" }],
  correctOptionId: "right",
  direction: "right-to-left" as const,
  source: { setId: "set-a", itemId: "item-1", itemIndex: 0, scope: "entry" as const, chunkIndex: null },
};
const correct = evaluateSimpleQuizAnswer(question, { optionId: "right" });
const firstCombo = applyComboScore(0, correct.isCorrect, correct.scoreDelta, SIMPLE_QUIZ_COMBO_SCORING);
let progress = applyResultToProgress({ ...createEmptyProgress(), combo: firstCombo.combo }, question.id, { ...correct, scoreDelta: firstCombo.scoreDelta });
assert.deepEqual([progress.score, progress.correctCount, progress.combo], [100, 1, 1]);
progress = moveToNextQuestion(progress, 2);
const second = evaluateSimpleQuizAnswer({ ...question, id: "q2" }, { optionId: "right" });
const secondCombo = applyComboScore(progress.combo, second.isCorrect, second.scoreDelta, SIMPLE_QUIZ_COMBO_SCORING);
progress = applyResultToProgress({ ...progress, combo: secondCombo.combo }, "q2", { ...second, scoreDelta: secondCombo.scoreDelta });
assert.deepEqual([progress.score, progress.correctCount, progress.combo], [220, 2, 2]);

console.log("solo contracts passed");
