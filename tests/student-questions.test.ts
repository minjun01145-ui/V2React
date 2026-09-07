import assert from "node:assert/strict";
import { adaptLearningSetToAiTutor } from "../src/learning-sets/aiTutorAdapter.ts";
import { parseLearningSet } from "../src/learning-sets/codec.ts";
import { shouldShowStudentQuestionAuthoring } from "../src/student-question-activity/model.ts";
import type { StudentQuestionActivity } from "../src/student-question-activity/types.ts";
import { containsKorean, parseStudentQuestionConfig, validateStudentQuestions } from "../src/student-question-activity/validation.ts";

assert.deepEqual(parseStudentQuestionConfig({ questionCount: 1, englishQuestionsOnly: false }), { questionCount: 1, englishQuestionsOnly: false });
assert.deepEqual(parseStudentQuestionConfig({ questionCount: 5, englishQuestionsOnly: true }), { questionCount: 5, englishQuestionsOnly: true });
assert.throws(() => parseStudentQuestionConfig({ questionCount: 0, englishQuestionsOnly: false }), /1~5/);
assert.throws(() => parseStudentQuestionConfig({ questionCount: 6, englishQuestionsOnly: false }), /1~5/);
assert.equal(containsKorean("When did Kate go home?"), false);
assert.throws(() => validateStudentQuestions([{ question: "Kate는 언제 갔어?", referenceAnswer: "그녀는 집에 갔다." }], { questionCount: 1, englishQuestionsOnly: true }), /한글/);
assert.deepEqual(validateStudentQuestions([{ question: " When did Kate go home? ", referenceAnswer: " 그녀는 집에 갔다. " }], { questionCount: 1, englishQuestionsOnly: true }), [{ question: "When did Kate go home?", referenceAnswer: "그녀는 집에 갔다." }]);
assert.throws(() => validateStudentQuestions([], { questionCount: 1, englishQuestionsOnly: false }), /정확히/);

const activity: StudentQuestionActivity = { kind: "student-question-authoring", runId: "run-1", phase: "active", config: { questionCount: 1, englishQuestionsOnly: false }, expectedPlayerIds: ["student-1"], resultSetId: null };
assert.equal(shouldShowStudentQuestionAuthoring(activity, "student-1", null), true);
assert.equal(shouldShowStudentQuestionAuthoring(activity, "late-student", null), false);
assert.equal(shouldShowStudentQuestionAuthoring(activity, "student-1", { playerId: "student-1", questions: [], submitted: true, submittedAtMs: 1 }), false);

const author = { studentNumber: "10101", displayName: "김민준", nickname: "민준" };
const set = parseLearningSet("student-set", { name: "학생 질문", type: "student-questions", itemCount: 1, createdAtMs: 1, updatedAtMs: 2 }, { items: [{ id: "q1", sourceText: "Why is the sky blue?", meaning: "Because light is scattered.", author }] });
assert.ok(set);
assert.deepEqual(set.items[0]?.author, author);
const questions = adaptLearningSetToAiTutor(set, "meaning-to-source");
assert.equal(questions[0]?.prompt, "Why is the sky blue?");
assert.deepEqual(questions[0]?.author, author);

console.log("student question activity tests passed");
