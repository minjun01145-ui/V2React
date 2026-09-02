import assert from "node:assert/strict";
import { aiTutorAnswerResult } from "../../src/ai-tutor-engine/result.ts";
import { parseAiTutorReply } from "../../src/ai-tutor-engine/validation.ts";
import { adaptLearningSetToAiTutor } from "../../src/learning-sets/aiTutorAdapter.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";

const vocabularySet: LearningSet = {
  id: "words",
  name: "기초 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 1,
  createdAtMs: 0,
  updatedAtMs: 0,
  items: [{ id: "word-1", sourceText: "apple", meaning: "사과" }],
};

const forward = adaptLearningSetToAiTutor(vocabularySet, "source-to-meaning");
assert.deepEqual(forward[0], {
  id: "word-1",
  prompt: "apple",
  referenceAnswer: "사과",
  promptLabel: "이 단어의 뜻을 써 보세요",
  answerLabel: "한국어로 답하기",
});

const reverse = adaptLearningSetToAiTutor(vocabularySet, "meaning-to-source");
assert.equal(reverse[0]?.prompt, "사과");
assert.equal(reverse[0]?.referenceAnswer, "apple");
assert.equal(reverse[0]?.answerLabel, "영어로 답하기");

const correct = parseAiTutorReply({ kind: "correct", isCorrect: true, feedback: "좋아요", hint: null, focus: null, scoreDelta: 10 });
assert.equal(aiTutorAnswerResult(correct).isCorrect, true);
assert.equal(aiTutorAnswerResult(correct).scoreDelta, 10);

const retry = parseAiTutorReply({ kind: "retry", isCorrect: false, feedback: "시제를 확인하세요", hint: "과거형을 떠올려 보세요", focus: "시제", scoreDelta: 99 });
assert.equal(retry.scoreDelta, 0);
assert.equal(retry.hint, "과거형을 떠올려 보세요");

assert.throws(() => parseAiTutorReply({ kind: "chat", feedback: "무관한 답" }), /형식/);
console.log("AI tutor adapter/contract tests passed");
