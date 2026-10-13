import assert from "node:assert/strict";
import { newQuestion, parseQuestion, publicQuestionSource, validateQuestionSource } from "../src/slide-question/model.ts";
import type { PublicQuestion, QuestionSource } from "../src/slide-question/model.ts";
import { validateSlideEngineRound, parseSlide, validateSlides } from "../src/slide-show/validation.ts";
import { slideEngineGameConfig } from "../src/slide-show/engineConfig.ts";
import { createSlideShowSessionState, startSlideEngine } from "../src/slide-show/sessionState.ts";
import type { Slide, SlideEngineRound, SlideShow } from "../src/slide-show/types.ts";

const question: PublicQuestion = { type: "multiple-choice", prompt: "맞는 답은?", doublePoints: false, options: ["첫째", "둘째", "셋째"] };
const source: QuestionSource = { kind: "slide-question", question, grading: { correctOptions: [0, 2] } };
assert.deepEqual(validateQuestionSource(source), source);
for (const options of [["하나"], Array(6).fill("답")]) assert.equal(parseQuestion({ ...question, options }), null);
assert.throws(() => validateQuestionSource({ ...source, grading: { correctOptions: [] } }), /정답/);
assert.throws(() => validateQuestionSource({ ...source, grading: { correctOptions: [3] } }), /정답/);
assert.throws(() => validateQuestionSource(publicQuestionSource(source)), /정답/);
assert.deepEqual(validateQuestionSource(publicQuestionSource(source), false), publicQuestionSource(source));
const round: SlideEngineRound = { gameId: "slide-question", source, durationSeconds: 20, gameConfig: {} };
for (const seconds of [5, 20, 300]) assert.equal(validateSlideEngineRound({ ...round, durationSeconds: seconds }).durationSeconds, seconds);
for (const seconds of [4, 301, 5.5]) assert.throws(() => validateSlideEngineRound({ ...round, durationSeconds: seconds }), /5~300/);
assert.throws(() => validateSlideEngineRound({ ...round, source: publicQuestionSource(source) }), /정답/);
const slide: Slide = { id: "slide-1", canvas: '{"objects":[]}', engine: { frame: { x: 140, y: 90, width: 1000, height: 540 }, round } };
for (const type of ["multiple-choice", "ox", "short-answer", "ai-short-answer"] as const) {
  const draft = newQuestion(type);
  const valid = type === "multiple-choice" ? source : { ...draft, question: { ...draft.question, prompt: "문제" }, grading: { answer: type === "ox" ? "O" : "apple" } };
  const item = { ...slide, engine: { ...slide.engine!, round: { ...round, source: valid } } };
  assert.deepEqual(parseSlide(item.id, validateSlides([item])[0]), item, `${type}: save/load round trip`);
}
const show: SlideShow = { id: "show", name: "슬라이드 수업", slides: [slide], createdAtMs: 1, updatedAtMs: 1 };
const active = startSlideEngine(createSlideShowSessionState(show, "run"), slide, "round");
assert.equal("grading" in active.engine!.round.source, false, "student-readable session must not contain answers");
assert.equal(JSON.stringify(slideEngineGameConfig(round, slide.id)).includes("correctOptions"), false);
assert.equal(JSON.stringify(publicQuestionSource(source)).includes("correctOptions"), false);
console.log("slide question settings, validation, save/load and answer secrecy passed");
