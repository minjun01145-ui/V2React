import assert from "node:assert/strict";
import { createEmptyProgress } from "../../src/game-engine/progress/index.ts";
import { buildGoldRunQuestions, goldRunQuestionAt, passGate, type GoldRunProgress } from "../../src/games/gold-run/model/questions.ts";
import { createRun, JUMP_SECONDS, MAX_LIVES, SCORE, stepRun, type RunState } from "../../src/games/gold-run/model/run.ts";
import { LANES, nextGate, O_LANE, trackBlock, trackObjects, X_LANE, type Lane } from "../../src/games/gold-run/model/track.ts";
import { getGame } from "../../src/games/registry.ts";
import type { LearningSet } from "../../src/learning-sets/types.ts";

const seed = "round-1";

// The course is the same for everyone in a round, and always passable.
assert.deepEqual(trackObjects(seed, 0, 500), trackObjects(seed, 0, 500));
assert.notDeepEqual(trackObjects(seed, 0, 500), trackObjects("round-2", 0, 500));
for (let block = 0; block < 200; block += 1) {
  const barriers = trackBlock(seed, block).filter((object) => object.kind === "barrier");
  assert(new Set(barriers.map((object) => object.lane)).size < LANES.length, `block ${block} leaves a free lane`);
}
const gates = trackObjects(seed, 0, 2_000).filter((object) => object.kind === "gate");
assert.deepEqual(gates.map((gate) => gate.kind === "gate" && gate.question), gates.map((_, index) => index), "gates ask questions in order");
for (const gate of gates) {
  assert.equal(nextGate(seed, gate.at - 0.5).id, gate.id);
  assert.equal(nextGate(seed, gate.at).id, gate.id);
  assert(trackObjects(seed, gate.at - 10, gate.at).every((object) => object.kind !== "barrier"), "no hurdle right before a gate");
}

/** Runs until the runner passes `until` metres, steering into `lane` and jumping on request. */
function runTo(state: RunState, until: number, lane: (state: RunState) => Lane, isTrue: (question: number) => boolean, jump = (_: RunState) => false) {
  const events = [];
  let current = state;
  while (current.distance < until) {
    const step = stepRun(current, { lane: lane(current), jump: jump(current) }, 1 / 60, seed, isTrue);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

// A dodging runner: stays in a free lane, jumping any hurdle ahead in its lane.
const firstGate = gates[0]!;
const dodge = (state: RunState): Lane => {
  const ahead = trackObjects(seed, state.distance, state.distance + 4).filter((object) => object.kind === "barrier");
  return LANES.find((lane) => !ahead.some((object) => object.kind === "barrier" && object.lane === lane)) ?? 0;
};
const towardGate = (choice: Lane) => (state: RunState): Lane => state.distance > firstGate.at - 8 ? choice : dodge(state);

const right = runTo(createRun(), firstGate.at + 1, towardGate(O_LANE), () => true);
const gate = right.events.find((event) => event.kind === "gate");
assert.deepEqual(gate, { kind: "gate", question: 0, correct: true, chose: "O" });
assert.equal(right.state.lives, MAX_LIVES, "dodging every hurdle keeps all hearts");
assert(right.state.score >= SCORE.correct + Math.floor(firstGate.at), "distance and the gate both score");

const wrong = runTo(createRun(), firstGate.at + 1, towardGate(X_LANE), () => true);
assert.deepEqual(wrong.events.find((event) => event.kind === "gate"), { kind: "gate", question: 0, correct: false, chose: "X" });
assert.equal(wrong.state.lives, MAX_LIVES - 1, "a wrong gate costs a heart");
assert.equal(wrong.state.streak, 0);
const wall = runTo(createRun(), firstGate.at + 1, towardGate(0), () => true);
assert.deepEqual(wall.events.find((event) => event.kind === "gate"), { kind: "gate", question: 0, correct: false, chose: null }, "the middle wall is never right");

// Hurdles: running into one costs a heart, jumping it does not.
const hurdle = trackObjects(seed, 0, 2_000).find((object) => object.kind === "barrier")!;
const hurdleLane = (): Lane => hurdle.kind === "barrier" ? hurdle.lane : 0;
const hit = runTo(createRun(), hurdle.at + 1, hurdleLane, () => true);
assert(hit.events.some((event) => event.kind === "hit"));
const jumped = runTo(createRun(), hurdle.at + 1, hurdleLane, () => true, (state) => hurdle.at - state.distance < state.speed * JUMP_SECONDS / 2 && hurdle.at > state.distance);
assert(!jumped.events.some((event) => event.kind === "hit"), "a timed jump clears the hurdle");

// Losing every heart knocks the runner down; it gets up with full hearts and keeps its score.
let down: RunState = { ...createRun(), lives: 1, score: 500 };
while (down.lives > 0) down = stepRun(down, { lane: hurdleLane(), jump: false }, 1 / 60, seed, () => true).state;
const scoreWhenDown = down.score;
const stillDown = stepRun(down, { lane: 0, jump: false }, 1, seed, () => true).state;
assert.equal(stillDown.distance, down.distance, "a downed runner stays put");
const up = stepRun(stillDown, { lane: 0, jump: false }, 1.1, seed, () => true);
assert(up.events.some((event) => event.kind === "up"));
assert.equal(up.state.lives, MAX_LIVES);
assert(up.state.score >= scoreWhenDown);

// Saved attempts: every gate counts its points, right or wrong, and the deck repeats.
const set: LearningSet = { id: "words", name: "단어", type: "vocabulary", itemCount: 3, createdAtMs: 1, updatedAtMs: 1,
  items: [{ id: "a", sourceText: "apple", meaning: "사과" }, { id: "b", sourceText: "banana", meaning: "바나나" }, { id: "c", sourceText: "cherry", meaning: "체리" }] };
const questions = buildGoldRunQuestions(set, {}, seed);
assert.deepEqual(questions, buildGoldRunQuestions(set, {}, seed), "the same round asks the same questions");
assert.equal(questions[0]!.prompt, set.items.find((item) => item.id === questions[0]!.source.itemId)!.sourceText);
assert.equal(buildGoldRunQuestions(set, { direction: "meaning-to-source" }, seed)[0]!.direction, "right-to-left");
let progress: GoldRunProgress = createEmptyProgress();
for (let index = 0; index < questions.length * 2; index += 1) {
  const question = goldRunQuestionAt(questions, index);
  progress = passGate(progress, question, { value: index % 2 === 0 ? question.isTrue : !question.isTrue }, 150, 3).progress;
}
assert.equal(progress.score, 150 * questions.length * 2);
assert.equal(progress.correctCount, questions.length);
assert.equal(progress.currentIndex, questions.length * 2);
assert.equal(passGate(createEmptyProgress(), questions[0]!, { value: null }, 40, 0).result.isCorrect, false);
assert.throws(() => buildGoldRunQuestions({ ...set, type: "reading-chunks" }, {}, seed));
assert.equal(getGame("gold-run").title, "골드런");

console.log("Gold Run tests passed: fair track, gates, hurdles, hearts and saved attempts");
