import assert from "node:assert/strict";
import { usesFiniteQuestionSequence } from "../src/game-engine/question-engine/sessionConfig.ts";
import { createCumulativeLeaderboard, createShowLeaderboard } from "../src/features/slide-show-runtime/cumulativeLeaderboard.ts";
import type { RoundProgressRecord } from "../src/multiplayer/game-progress/types.ts";
import type { RoundParticipant } from "../src/multiplayer/round-participants/model.ts";
import { slideEngineGameConfig } from "../src/slide-show/engineConfig.ts";
import { advanceSlideEnginePhase, awardShowPoints, closeSlideEngine, createSlideShowSessionState, goToSlide, startSlideEngine } from "../src/slide-show/sessionState.ts";
import { MAX_SLIDE_CANVAS_BYTES, type Slide, type SlideEngineRound, type SlideShow } from "../src/slide-show/types.ts";
import { parseSlide, parseSlideShowSessionState, validateSlideEngineRound, validateSlideFrame, validateSlides } from "../src/slide-show/validation.ts";

const canvas = JSON.stringify({ objects: [], background: "#ffffff" });
const storedRound: SlideEngineRound = { gameId: "simple-quiz", source: { kind: "stored-set", setId: "set-1" }, durationSeconds: 30, gameConfig: { "choice-count": "4" } };
const engineSlide: Slide = { id: "slide-2", canvas, engine: { frame: { x: 140, y: 90, width: 1000, height: 540 }, round: storedRound } };
const show: SlideShow = { id: "show-1", name: "2단원 수업", slides: [{ id: "slide-1", canvas, engine: null }, engineSlide], createdAtMs: 1, updatedAtMs: 2 };

// Slide and engine validation
assert.deepEqual(validateSlides(show.slides), show.slides);
assert.deepEqual(parseSlide("slide-2", { canvas, engine: engineSlide.engine }), engineSlide);
assert.equal(parseSlide("slide-2", { canvas, engine: { frame: engineSlide.engine!.frame } }), null, "a half-written engine must not load as a plain slide");
assert.throws(() => validateSlides([...show.slides, show.slides[0]!]), /중복/);
assert.throws(() => validateSlides([{ id: "big", canvas: JSON.stringify({ objects: [], src: "x".repeat(MAX_SLIDE_CANVAS_BYTES) }), engine: null }]), /용량/);
assert.throws(() => validateSlides([{ id: "broken", canvas: "{", engine: null }]), /형식/);
assert.deepEqual(validateSlideFrame({ x: -50, y: 700, width: 5000, height: 20 }), { x: 0, y: 560, width: 1280, height: 160 }, "engine windows are kept on the slide and above a usable size");
assert.throws(() => validateSlideEngineRound({ ...storedRound, durationSeconds: 5 }), /10~600초/);
assert.throws(() => validateSlideEngineRound({ ...storedRound, source: { kind: "custom", setType: "reading-chunks", items: [{ id: "item-1", sourceText: "No slash", meaning: "조각 없음" }] } }), /\//);
const freeRound: SlideEngineRound = { gameId: "free-response", source: { kind: "free-response", prompt: "오늘 배운 내용을 설명해 보세요." }, durationSeconds: 60, gameConfig: {} };
assert.deepEqual(validateSlideEngineRound(freeRound), freeRound);
assert.throws(() => validateSlideEngineRound({ ...freeRound, source: { kind: "free-response", prompt: " " } }), /질문/);
assert.throws(() => validateSlideEngineRound({ ...freeRound, source: { kind: "stored-set", setId: null } }), /자유 답변/);
assert.throws(() => validateSlideEngineRound({ ...freeRound, gameId: "ai-tutor" }), /자유 답변/);

// Engine round → session gameConfig
assert.deepEqual(slideEngineGameConfig(storedRound, "slide-2"), { setId: "set-1", "choice-count": "4", quizRoundDurationMs: 30_000 });
assert.equal(usesFiniteQuestionSequence(slideEngineGameConfig(storedRound, "slide-2")), false);
assert.deepEqual(slideEngineGameConfig(freeRound, "slide-3"), { freeResponsePrompt: freeRound.source.kind === "free-response" ? freeRound.source.prompt : "", quizRoundDurationMs: 60_000 });
const customConfig = slideEngineGameConfig({ ...storedRound, gameId: "sentence-builder", source: { kind: "custom", setType: "reading-chunks", items: [{ id: "item-1", sourceText: "I go / home.", meaning: "나는 집에 간다." }] } }, "slide-4");
assert.equal(usesFiniteQuestionSequence(customConfig), true);
assert.deepEqual(customConfig.set, { id: "slide-slide-4", name: "슬라이드 문제", type: "reading-chunks", itemCount: 1, items: [{ id: "item-1", sourceText: "I go / home.", meaning: "나는 집에 간다." }] });

// Presentation state
const state = createSlideShowSessionState(show, "run-1");
assert.deepEqual(state, { runId: "run-1", showId: "show-1", name: "2단원 수업", slideIds: ["slide-1", "slide-2"], currentSlideIndex: 0, engine: null, scoredRoundIds: [], awards: {} });
assert.deepEqual(parseSlideShowSessionState(state), state);
assert.throws(() => goToSlide(state, 2), /슬라이드가 없습니다/);
assert.throws(() => startSlideEngine(state, engineSlide, "round-1"), /현재 슬라이드/, "only the slide on screen can start its engine");
const onEngineSlide = goToSlide(state, 1);
const running = startSlideEngine(onEngineSlide, engineSlide, "round-1");
assert.equal(running.engine?.phase, "answering");
assert.deepEqual(running.scoredRoundIds, ["round-1"]);
assert.deepEqual(parseSlideShowSessionState(running), running);
assert.throws(() => goToSlide(running, 0), /문제를 마친 뒤/, "slides cannot change under a running question");
assert.throws(() => advanceSlideEnginePhase(running, "results"), /허용되지 않은/);
const results = advanceSlideEnginePhase(advanceSlideEnginePhase(running, "submissions"), "results");
assert.equal(results.engine?.phase, "results");
assert.deepEqual(closeSlideEngine(results), { ...results, engine: null }, "closing keeps the round in the score history");
assert.equal(closeSlideEngine(running).engine, null, "a question can be abandoned mid-answering");
assert.throws(() => startSlideEngine(running, engineSlide, "round-2"), /이미 진행 중/);

// Teacher awards
const awarded = awardShowPoints(awardShowPoints(state, ["a", "b", "a"], 50), ["a"], -10);
assert.deepEqual(awarded.awards, { a: 40, b: 50 }, "duplicate ids in one award count once");
assert.throws(() => awardShowPoints(state, ["a"], 0), /점수/);
assert.throws(() => awardShowPoints(state, [], 10), /학생/);
assert.equal(parseSlideShowSessionState({ ...state, awards: { a: 1.5 } }), null);
assert.equal(parseSlideShowSessionState({ ...state, currentSlideIndex: 2 }), null);

// Leaderboards
function participant(playerId: string, studentNumber: string, nickname: string | null): RoundParticipant {
  return { id: playerId, playerId, studentNumber, displayName: `이름-${playerId}`, nickname, joinedAtMs: 1 };
}
function progress(playerId: string, score: number, correctCount: number, attemptCount: number): RoundProgressRecord {
  return { id: playerId, playerId, gameId: "simple-quiz", displayName: `저장된 이름-${playerId}`, score, correctCount, attemptCount, currentIndex: correctCount, completedAtMs: null, updatedAtMs: 1, revision: 1 };
}
const cumulative = createCumulativeLeaderboard([
  { participants: [participant("a", "101", "이전 별명"), participant("b", "102", null), participant("c", "103", "달")], progress: [progress("a", 100, 1, 1), progress("b", 200, 2, 2), progress("c", 200, 2, 3)] },
  { participants: [participant("a", "101", "별")], progress: [progress("a", 100, 1, 1)] },
]);
assert.deepEqual(cumulative.map((entry) => [entry.playerId, entry.rank, entry.score]), [["a", 1, 200], ["b", 1, 200], ["c", 3, 200]]);
assert.equal(cumulative[0]?.displayName, "별", "the latest round's nickname is shown");

const showBoard = createShowLeaderboard([
  { participants: [participant("a", "101", null), participant("late", "104", null)], progress: [] },
  { participants: [participant("a", "101", null)], progress: [progress("a", 100, 1, 1)] },
], { late: 150, a: -20 });
assert.deepEqual(showBoard.map((entry) => [entry.playerId, entry.score, entry.rank]), [["late", 150, 1], ["a", 80, 2]], "teacher awards count for students who never answered an engine");
assert.deepEqual(createShowLeaderboard([], {}), []);

console.log("slide show model tests passed");
