import assert from "node:assert/strict";
import type { RuntimeLearningSet } from "../../src/learning-sets/types.ts";
import {
  buildMeaningDashCourse,
  meaningDashGateIndexAtY,
  meaningDashGateY,
  meaningDashQuestionForGate,
  meaningDashReward,
  meaningDashSpeed,
  MEANING_DASH_GATE_SPACING,
  MEANING_DASH_LANE_SPEED,
  nearestMeaningDashLane,
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

assert.deepEqual(meaningDashReward(true, 0), { combo: 1, points: 100 });
assert.deepEqual(meaningDashReward(true, 4), { combo: 5, points: 140 });
assert.deepEqual(meaningDashReward(false, 12), { combo: 0, points: 0 }, "mistakes reset the streak without subtracting earned points");
assert.equal(meaningDashReward(true, 100).points, 200, "long streaks have a bounded bonus");
assert.equal(meaningDashSpeed(0), 2.2);
assert.ok(meaningDashSpeed(5) > meaningDashSpeed(0));
assert.ok(MEANING_DASH_GATE_SPACING / meaningDashSpeed(100) >= 2, "boost must leave time to read each question");
assert.ok(2 / MEANING_DASH_LANE_SPEED < .25, "a direct tap can cross both lanes in under a quarter second");
assert.equal(nearestMeaningDashLane(-.51), 0);
assert.equal(nearestMeaningDashLane(0), 1);
assert.equal(nearestMeaningDashLane(.51), 2);
console.log("meaning dash tests passed");
