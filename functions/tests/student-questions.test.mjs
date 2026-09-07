import assert from "node:assert/strict";
import { shouldFinalizeStudentQuestionRun, studentQuestionResultSetId } from "../lib/student-questions/model.js";
import { parseConfig, parseHelpInput, parseHelpReply, parseQuestions } from "../lib/student-questions/validation.js";
import { buildAiTutorMessages } from "../lib/ai-tutor/prompt.js";

const config = parseConfig({ questionCount: 2, englishQuestionsOnly: true });
assert.equal(config.questionCount, 2);
assert.throws(() => parseConfig({ questionCount: 0, englishQuestionsOnly: true }), /설정/);
assert.throws(() => parseQuestions([{ question: "질문", referenceAnswer: "한글 답 허용" }, { question: "Why?", referenceAnswer: "답" }], config), /한글/);
assert.equal(parseQuestions([{ question: "Why?", referenceAnswer: "한글 답 허용" }, { question: "When?", referenceAnswer: "어제" }], config).length, 2);
assert.equal(shouldFinalizeStudentQuestionRun(["a", "b"], ["a"], false), false);
assert.equal(shouldFinalizeStudentQuestionRun(["a", "b"], ["a", "b"], false), true);
assert.equal(shouldFinalizeStudentQuestionRun(["a", "b"], ["a"], true), true);
assert.equal(studentQuestionResultSetId("room", "run"), studentQuestionResultSetId("room", "run"));
assert.equal(parseHelpInput({ roomId: "room", runId: "run", message: "어순이 어려워요", interactionCount: 1, helpLevel: 1 }).helpLevel, 1);
assert.deepEqual(parseHelpReply('{"hint":"did를 떠올려 보세요","helpLevel":4}', 2), { hint: "did를 떠올려 보세요", helpLevel: 2 });
const studentQuestionPrompt = buildAiTutorMessages({ setType: "student-questions", direction: "source-to-meaning", item: { id: "q", sourceText: "Why?", meaning: "Because.", author: { studentNumber: "1", displayName: "학생", nickname: null } } }, { roomId: "room", roundId: "round", itemId: "q", message: "help", attemptNumber: 1, previousFeedback: null, direction: null });
assert.match(studentQuestionPrompt[0]?.content ?? "", /시도 5회 전/);

console.log("student question server tests passed");
