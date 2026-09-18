import assert from "node:assert/strict";
import type { RuntimeLearningSet } from "../../src/learning-sets/types.ts";
import {
  buildMeaningDashCourse,
  meaningDashGateIndexAtY,
  meaningDashGateY,
  meaningDashQuestionForGate,
} from "../../src/games/meaning-dash/model.ts";

const set: RuntimeLearningSet = {
  id: "meaning-dash-test",
  name: "Meaning Dash test",
  type: "vocabulary",
  itemCount: 4,
  items: [
    { id: "a", sourceText: "expensive", meaning: "비싼" },
    { id: "b", sourceText: "quiet", meaning: "조용한" },
    { id: "c", sourceText: "dangerous", meaning: "위험한" },
    { id: "d", sourceText: "friendly", meaning: "친절한" },
  ],
};

const first = buildMeaningDashCourse(set, "round-1");
const second = buildMeaningDashCourse(set, "round-1");
assert.deepEqual(second, first, "the same round seed must create the same gates for every client");
assert.equal(first.questions.length, set.items.length);

for (const question of first.questions) {
  assert.equal(question.choices.length, 3);
  assert.ok(question.correctLane >= 0 && question.correctLane <= 2);
  assert.ok(question.choices[question.correctLane]?.length);
}

assert.equal(meaningDashGateIndexAtY(meaningDashGateY(0) - 0.01), -1);
assert.equal(meaningDashGateIndexAtY(meaningDashGateY(0)), 0);
assert.equal(meaningDashGateIndexAtY(meaningDashGateY(3)), 3);
assert.equal(meaningDashQuestionForGate(first, first.questions.length).id, first.questions[0]?.id);

console.log("meaning dash tests passed");
