import assert from "node:assert/strict";
import { createExamWorksheet } from "../src/learning-worksheets/model.ts";
import { examAnswerText, type BankQuestion } from "../src/question-bank/types.ts";
import { parseExamQuestion } from "../src/question-bank/validation.ts";
import { pageCuts } from "../src/worksheet/pdf.ts";

const choice = { format: "choice", prompt: "다음 문장의 빈칸에 알맞은 것은?", context: "How about ______ badminton together?", choices: ["play", "to play", "playing", "played", "to playing"], correctChoice: 3, explanation: "전치사의 목적어는 동명사." };
const written = { format: "written", prompt: "어법상 어색한 부분을 찾아 고쳐 쓰시오.", context: null, answer: "have → having", explanation: "" };

assert.deepEqual(parseExamQuestion(choice), choice);
assert.deepEqual(parseExamQuestion(written), written);
assert.throws(() => parseExamQuestion({ ...choice, choices: choice.choices.slice(0, 4) }), "five choices are required");
assert.throws(() => parseExamQuestion({ ...choice, choices: ["a", "a", "b", "c", "d"] }), "choices must differ");
assert.throws(() => parseExamQuestion({ ...choice, correctChoice: 6 }));
assert.throws(() => parseExamQuestion({ ...written, answer: "" }));
assert.equal(examAnswerText(parseExamQuestion(choice)), "③");

const bank: BankQuestion[] = [choice, written].map((content, index) => ({ id: `q${index}`, setId: "set", content: parseExamQuestion(content), createdAtMs: index }));
const exam = createExamWorksheet({ name: "1학년 5과 비교급" }, bank);
assert.equal(exam.title, "1학년 5과 - 시험 연습문제");
const questions = exam.sections[0]!.blocks[0]!;
assert(questions.type === "questions");
assert.equal(questions.questions[0]!.type, "choice");
assert.equal(questions.questions[0]!.context, choice.context);
assert.equal(questions.questions[1]!.type, "written");
const answers = exam.sections[1]!;
assert.equal(answers.newPage, true, "answers and explanations start on their own page");
assert.deepEqual(answers.blocks[0], { type: "answers", entries: [{ number: 1, answer: "③", note: choice.explanation }, { number: 2, answer: "have → having" }] });

// PDF pages never cut through a row and honour forced breaks.
const rows = Array.from({ length: 10 }, (_, index) => ({ top: 100 + index * 60, bottom: 150 + index * 60, forceBreak: false }));
const cuts = pageCuts(rows, 50, 700, 250);
for (const cut of cuts.slice(1, -1)) assert(rows.every((row) => cut <= row.top || cut >= row.bottom), `cut ${cut} splits a row`);
for (let index = 1; index < cuts.length; index += 1) assert(cuts[index]! - cuts[index - 1]! <= 250);
assert(pageCuts([...rows.slice(0, 2), { top: 400, bottom: 450, forceBreak: true }], 50, 700, 1000).includes(400), "a new-page section starts a page");

console.log("Question bank format, exam worksheet and PDF pagination tests passed");
