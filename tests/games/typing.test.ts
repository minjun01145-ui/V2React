import assert from "node:assert/strict";
import { adaptLearningSetToTyping } from "../../src/games/typing/typingAdapter.ts";
import { parseTypingGameOptions } from "../../src/games/typing/config.ts";
import {
  calculateCurrentAccuracy,
  cleanTypingPrompt,
  countTypingStrokes,
  createTypingSpeedTracker,
  getNewValidProgress,
  getTypingComparisonState,
  isTypingAnswerComplete,
  evaluateTypingAnswer,
} from "../../src/games/typing/typingEngine.ts";
import { TYPING_TARGET } from "../../src/games/typing/types.ts";
import { createTypingLeaderboard } from "../../src/games/typing/typingLeaderboard.ts";
import type { RoundLiveMetricRecord } from "../../src/multiplayer/live-metrics/types.ts";
import type { RoundParticipant } from "../../src/multiplayer/round-participants/model.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";

assert.equal(countTypingStrokes("가"), 2);
assert.equal(countTypingStrokes("한"), 3);
assert.equal(countTypingStrokes("과"), 3);
assert.equal(countTypingStrokes("abc XYZ"), 7, "영어와 공백은 문자마다 1타여야 합니다.");
assert.equal(countTypingStrokes("Hi, A!"), 6, "공백과 문장부호도 기본적으로 1타여야 합니다.");
assert.equal(countTypingStrokes("a\nb"), 2, "줄바꿈은 타수에서 제외해야 합니다.");

assert.equal(cleanTypingPrompt(" They make / old neighborhoods / bright. "), "They make old neighborhoods bright.");
assert.equal(isTypingAnswerComplete("Hello", "hello", { ignoreCase: true }), true);
assert.equal(isTypingAnswerComplete("Hello", "hello"), false);
assert.equal(isTypingAnswerComplete("Hello, world!", "Hello world", { ignorePunctuation: true }), true);
assert.equal(isTypingAnswerComplete("Hello, world!", "Helloworld", { ignorePunctuation: true }), false, "공백은 생략할 수 없어야 합니다.");

const normalPrefix = getNewValidProgress("typing", "typ", 0);
assert.equal(normalPrefix.currentPrefixLength, 3);
assert.equal(normalPrefix.newlyValidText, "typ");
assert.equal(normalPrefix.hasError, false);

const typo = getNewValidProgress("typing", "tyx", normalPrefix.maxPrefixLength);
assert.equal(typo.currentPrefixLength, 2);
assert.equal(typo.hasError, true);
assert.equal(typo.newlyValidText, "", "반복 오타는 유효 진행에 포함되지 않아야 합니다.");
const repeatedTypo = getNewValidProgress("typing", "tyxx", typo.maxPrefixLength);
assert.equal(repeatedTypo.newlyValidText, "");
assert.equal(repeatedTypo.maxPrefixLength, normalPrefix.maxPrefixLength);

const corrected = getNewValidProgress("typing", "typi", repeatedTypo.maxPrefixLength);
assert.equal(corrected.hasError, false);
assert.equal(corrected.currentPrefixLength, 4);
assert.equal(corrected.newlyValidText, "i", "오타 수정 뒤 새로 전진한 부분만 유효해야 합니다.");
const progressTracker = createTypingSpeedTracker();
progressTracker.reset(0);
progressTracker.addValidText(normalPrefix.newlyValidText, 100);
progressTracker.addValidText(typo.newlyValidText, 200);
progressTracker.addValidText(repeatedTypo.newlyValidText, 300);
progressTracker.addValidText(corrected.newlyValidText, 400);
assert.equal(progressTracker.getStats(5_000).totalValidStrokes, 4, "반복 오타 타수는 누적 통계에 들어가지 않아야 합니다.");
assert.equal(calculateCurrentAccuracy("typing", "tyx"), 67);
assert.equal(calculateCurrentAccuracy("typing", "typ"), 100, "오타 수정 뒤 정확도가 회복되어야 합니다.");

assert.equal(getTypingComparisonState("a b", "a b").isComplete, true);
assert.equal(getTypingComparisonState("a b", "ab").isComplete, false);
assert.equal(getTypingComparisonState("a b ", "a b").isComplete, false, "완료 판정은 끝 공백도 안정적으로 구분해야 합니다.");
assert.equal(isTypingAnswerComplete("문장입니다.", "문장입니다."), true);
assert.equal(isTypingAnswerComplete("문장입니다.", "문장입니다"), false);
assert.equal(evaluateTypingAnswer(
  { id: "q", prompt: "abc", targetText: "abc", helperText: "", source: { setId: "set", itemIndex: 0 } },
  { inputText: "abc", speed: { currentCpm: 300, averageCpm: 280, bestCpm: 320, totalValidStrokes: 3 } },
).scoreDelta, 0, "타자게임은 문장 완료 점수를 별도로 적립하지 않아야 합니다.");

const readingSet: LearningSet = {
  id: "reading-typing",
  name: "끊어읽기 타자",
  type: LEARNING_SET_TYPE.READING_CHUNKS,
  itemCount: 1,
  createdAtMs: 1,
  updatedAtMs: 1,
  items: [{ id: "sentence-1", sourceText: "I go / to school / every day.", meaning: "나는 / 매일 / 학교에 간다." }],
};
const sourceQuestions = adaptLearningSetToTyping(readingSet, TYPING_TARGET.SOURCE);
assert.equal(sourceQuestions.questions[0]?.targetText, "I go to school every day.");
assert.equal(sourceQuestions.questions[0]?.helperText, "나는 매일 학교에 간다.");
const meaningQuestions = adaptLearningSetToTyping(readingSet, TYPING_TARGET.MEANING);
assert.equal(meaningQuestions.questions[0]?.targetText, "나는 매일 학교에 간다.");
assert.equal(meaningQuestions.questions[0]?.helperText, "I go to school every day.");
assert.deepEqual(parseTypingGameOptions({ "typing-target": "meaning", "ignore-case": "yes", "ignore-punctuation": "yes" }), {
  target: "meaning",
  ignoreCase: true,
  ignorePunctuation: true,
});
assert.deepEqual(parseTypingGameOptions({ "typing-target": "bad", "ignore-case": true }), {
  target: "source",
  ignoreCase: false,
  ignorePunctuation: false,
});

const initialTracker = createTypingSpeedTracker({ windowMs: 30_000, minimumSampleMs: 5_000 });
initialTracker.reset(0);
initialTracker.addValidStrokes(10, 100);
assert.equal(initialTracker.getCurrentCpm(1_000), 120, "초기 CPM은 최소 5초 표본으로 계산해야 합니다.");
assert.equal(initialTracker.getAverageCpm(1_000), 120);

const windowTracker = createTypingSpeedTracker({ windowMs: 10_000, minimumSampleMs: 1_000 });
windowTracker.reset(0);
windowTracker.addValidStrokes(10, 1_000);
windowTracker.addValidStrokes(20, 12_000);
assert.equal(windowTracker.getCurrentCpm(12_000), 120, "현재 CPM은 window 안의 최근 입력만 사용해야 합니다.");
assert.equal(windowTracker.getAverageCpm(12_000), 150, "평균 CPM은 전체 유효 타수를 사용해야 합니다.");
assert.equal(windowTracker.getStats(12_000).totalValidStrokes, 30);

const typingParticipants: RoundParticipant[] = [
  { id: "a", playerId: "a", studentNumber: "101", displayName: "가람", nickname: null, joinedAtMs: 1 },
  { id: "b", playerId: "b", studentNumber: "102", displayName: "나래", nickname: "별", joinedAtMs: 1 },
  { id: "c", playerId: "c", studentNumber: "103", displayName: "다온", nickname: null, joinedAtMs: 1 },
];
const typingMetric = (playerId: string, averageCpm: number, currentCpm: number, totalValidStrokes: number): RoundLiveMetricRecord => ({
  id: playerId,
  kind: "typing-cpm",
  gameId: "typing",
  playerId,
  displayName: playerId,
  currentCpm,
  averageCpm,
  bestCpm: Math.max(currentCpm, averageCpm),
  totalValidStrokes,
  sampledAtMs: 1,
  committedAtMs: 1,
});
const typingLeaderboard = createTypingLeaderboard(typingParticipants, [
  typingMetric("a", 310, 280, 90),
  typingMetric("b", 420, 390, 80),
]);
assert.deepEqual(typingLeaderboard.map((entry) => entry.playerId), ["b", "a", "c"], "점수가 아니라 서버 동기화 평균 타수로 정렬해야 합니다.");
assert.deepEqual(typingLeaderboard.map((entry) => entry.averageCpm), [420, 310, 0]);
assert.equal(typingLeaderboard[0]?.displayName, "별");

const equalCpm = createTypingLeaderboard(typingParticipants.slice(0, 2), [
  typingMetric("a", 300, 280, 100),
  typingMetric("b", 300, 290, 120),
]);
assert.deepEqual(equalCpm.map((entry) => entry.playerId), ["b", "a"], "평균 타수가 같으면 누적 유효 타수로 순서를 안정화해야 합니다.");

console.log("typing game tests passed");
