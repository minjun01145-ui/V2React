import assert from "node:assert/strict";
import { createAnswerResult } from "../src/game-engine/core/answerResult.ts";
import { shuffled } from "../src/game-engine/core/random.ts";
import { createQuestionDeck } from "../src/game-engine/question-engine/questionDeck.ts";
import { applyAnswerToProgress, createEmptyProgress, moveToNextQuestion } from "../src/game-engine/question-engine/progress.ts";
import { defineGame, minimumSetItemCountForType, type StudentGameModuleProps, type TeacherGameModuleProps } from "../src/game-engine/contracts/gameDefinition.ts";
import { normalizeRoomId } from "../src/multiplayer/roomId.ts";
import { adaptReadingChunksSet } from "../src/games/sentence-builder/readingChunksAdapter.ts";
import { evaluateSentenceSequence } from "../src/games/sentence-builder/evaluator.ts";
import { getGame } from "../src/games/registry.ts";

const set: unknown = {
  id: "test",
  type: "reading-chunks",
  items: [
    { id: "q1", promptKo: "나는 학교에 간다.", chunks: ["I", "go", "to school."] },
    { id: "q2", promptKo: "정말 정말 좋다.", chunks: ["It is", "very", "very", "good."] },
  ],
};

const adapted = adaptReadingChunksSet(set);
assert.equal(adapted.questions.length, 2);
const duplicateQuestion = adapted.questions[1];
assert.ok(duplicateQuestion);
assert.equal(new Set(duplicateQuestion.tokens.map((token) => token.id)).size, 4);

const deckA = createQuestionDeck(adapted.questions, { seed: "round-1" });
const deckB = createQuestionDeck(adapted.questions, { seed: "round-1" });
assert.deepEqual(deckA.map((question) => question.id), deckB.map((question) => question.id));
assert.throws(() => createQuestionDeck([{ id: "dup" }, { id: "dup" }]), /unique/i);

const question = adapted.questions[0];
assert.ok(question);
const correct = evaluateSentenceSequence(question, { tokenIds: question.expectedTokenIds, text: "" });
assert.equal(correct.isCorrect, true);
assert.equal(correct.scoreDelta, 100);
const incorrect = evaluateSentenceSequence(question, { tokenIds: [...question.expectedTokenIds].reverse(), text: "" });
assert.equal(incorrect.isCorrect, false);
assert.equal(incorrect.scoreDelta, 0);

let progress = createEmptyProgress();
progress = applyAnswerToProgress(progress, question, incorrect);
assert.equal(progress.attemptCount, 1);
progress = applyAnswerToProgress(progress, question, correct);
assert.equal(progress.score, 100);
progress = applyAnswerToProgress(progress, question, correct);
assert.equal(progress.score, 100);
progress = moveToNextQuestion(progress, 2);
assert.equal(progress.currentIndex, 1);

const chunksA = shuffled(question.tokens, "player-a").map((token) => token.id);
const chunksA2 = shuffled(question.tokens, "player-a").map((token) => token.id);
assert.deepEqual(chunksA, chunksA2);
assert.equal(normalizeRoomId("  2 반 / A  "), "2-반-A");
assert.equal(normalizeRoomId("///", "fallback"), "fallback");

const game = defineGame({
  id: "test-game",
  title: "Test Game",
  supportedSetTypes: ["reading-chunks", "reading-chunks"],
  loadStudent: async () => ({ default: (_props: StudentGameModuleProps) => null }),
  loadTeacher: async () => ({ default: (_props: TeacherGameModuleProps) => null }),
});
assert.deepEqual(game.supportedSetTypes, ["reading-chunks"]);
assert.equal(game.timing, "timed", "새 게임은 기본적으로 시간제여야 합니다.");
assert.equal(game.minimumSetItemCount, 1);
assert.deepEqual(game.minimumSetItemCountByType, {});
assert.deepEqual(game.settings, []);
const configurableGame = defineGame({
  id: "configurable-game",
  title: "Configurable Game",
  supportedSetTypes: ["vocabulary"],
  settings: [{ kind: "select", key: "level", label: "난이도", defaultValue: "easy", options: [{ value: "easy", label: "쉬움" }, { value: "hard", label: "어려움" }] }],
  loadStudent: async () => ({ default: (_props: StudentGameModuleProps) => null }),
  loadTeacher: async () => ({ default: (_props: TeacherGameModuleProps) => null }),
});
assert.equal(configurableGame.settings[0]?.defaultValue, "easy");
assert.throws(() => defineGame({ ...configurableGame, id: "invalid-setting", settings: [{ ...configurableGame.settings[0]!, defaultValue: "missing" }] }));
const simpleQuiz = getGame("simple-quiz");
assert.equal(simpleQuiz.title, "심플퀴즈");
assert.equal(simpleQuiz.settings[0]?.key, "choice-count");
assert.equal(simpleQuiz.settings[0]?.defaultValue, "4");
const invalidGame = {
  id: "Bad Game",
  title: "x",
  supportedSetTypes: [],
  loadStudent: async () => ({ default: (_props: StudentGameModuleProps) => null }),
  loadTeacher: async () => ({ default: (_props: TeacherGameModuleProps) => null }),
};
assert.throws(() => defineGame(invalidGame));

const typedMinimumGame = defineGame({
  id: "typed-minimum-game",
  title: "Typed Minimum Game",
  supportedSetTypes: ["vocabulary", "reading-chunks"],
  minimumSetItemCountByType: { vocabulary: 4, "reading-chunks": 1 },
  loadStudent: async () => ({ default: (_props: StudentGameModuleProps) => null }),
  loadTeacher: async () => ({ default: (_props: TeacherGameModuleProps) => null }),
});
assert.equal(minimumSetItemCountForType(typedMinimumGame, "vocabulary"), 4);
assert.equal(minimumSetItemCountForType(typedMinimumGame, "reading-chunks"), 1);

const result = createAnswerResult({ isCorrect: true, scoreDelta: 50 });
assert.equal(result.status, "correct");
assert.throws(() => createAnswerResult({ isCorrect: true, scoreDelta: Number.NaN }));
console.log("engine smoke tests passed");
