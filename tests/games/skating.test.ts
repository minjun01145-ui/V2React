import assert from "node:assert/strict";
import type { RuntimeLearningSet } from "../../src/learning-sets/types.ts";
import {
  buildSkatingCourse,
  nearestSkatingLane,
  skatingGateIndexAtX,
  skatingGateX,
  skatingQuestionForGate,
  skatingReward,
  SKATING_FIRST_GATE_X,
  SKATING_GATE_SPACING,
  SKATING_PROMPT_LEAD,
} from "../../src/games/skating/model.ts";
import {
  applySkatingItem,
  BOOSTER_MS,
  MAX_SPEED_UPS,
  NO_BUFFS,
  skatingForwardSpeed,
  skatingItemAfterGate,
  skatingItemsBetween,
} from "../../src/games/skating/sim/items.ts";
import { SKATING_BASE_SPEED, SKATING_WALL_Y, stepLateral } from "../../src/games/skating/sim/physics.ts";
import { chooseSkatingPunchTarget, skatingPunchShove } from "../../src/games/skating/sim/punch.ts";
import { SKATING_RESPAWN_MS, SkaterSimulation, type SkaterEvent } from "../../src/games/skating/sim/SkaterSimulation.ts";

const set: RuntimeLearningSet = {
  id: "skating-test",
  name: "Skating test",
  type: "vocabulary",
  itemCount: 4,
  items: [
    { id: "a", sourceText: "expensive", meaning: "비싼" },
    { id: "b", sourceText: "quiet", meaning: "조용한" },
    { id: "c", sourceText: "dangerous", meaning: "위험한" },
    { id: "d", sourceText: "friendly", meaning: "친절한" },
  ],
};

// Course: every client builds the same gates from the round seed.
const course = buildSkatingCourse(set, "round-1");
assert.deepEqual(buildSkatingCourse(set, "round-1"), course);
assert.equal(course.questions.length, set.items.length);
for (const question of course.questions) {
  assert.equal(question.choices.length, 3);
  assert.ok(question.choices[question.correctLane]?.length);
}
assert.equal(skatingGateIndexAtX(skatingGateX(0) - 0.01), -1);
assert.equal(skatingGateIndexAtX(skatingGateX(3)), 3);
assert.equal(skatingQuestionForGate(course, course.questions.length).id, course.questions[0]?.id);
assert.equal(nearestSkatingLane(-0.51), 0);
assert.equal(nearestSkatingLane(0), 1);
assert.equal(nearestSkatingLane(0.51), 2);

assert.deepEqual(skatingReward(true, 0), { combo: 1, points: 100 });
assert.deepEqual(skatingReward(false, 12), { combo: 0, points: 0 }, "mistakes reset the streak without subtracting points");
assert.equal(skatingReward(true, 100).points, 200, "long streaks have a bounded bonus");

// Ice: steering is slippery, so a released skater keeps sliding and the boards bounce.
let lateral = { y: 0, vy: 0 };
let crossedLaneAt = Infinity;
for (let step = 1; step <= 60; step += 1) {
  lateral = stepLateral(lateral, 1, 1 / 60);
  if (lateral.y >= 1 && crossedLaneAt === Infinity) crossedLaneAt = step / 60;
}
assert.ok(crossedLaneAt < 0.8, "holding a direction reaches the next lane in under a second");
const gliding = { y: -1, vy: 2.5 };
const released = stepLateral(gliding, 0, 0.3);
assert.ok(released.y > gliding.y + 0.4 && released.vy > 1.2, "letting go keeps sliding on the ice");
const bounced = stepLateral({ y: SKATING_WALL_Y - 0.01, vy: 3 }, 1, 1 / 30);
assert.equal(bounced.y, SKATING_WALL_Y);
assert.ok(bounced.vy < 0 && bounced.bumped, "the boards bounce the skater back");

// Items: same layout for everyone, and the two kinds do what they promise.
assert.deepEqual(skatingItemAfterGate("round-1", 4), skatingItemAfterGate("round-1", 4));
assert.equal(skatingItemAfterGate("round-1", -1), null);
const laidOut = Array.from({ length: 200 }, (_, gate) => skatingItemAfterGate("round-1", gate)).filter((item) => item !== null);
assert.ok(laidOut.some((item) => item.kind === "booster") && laidOut.some((item) => item.kind === "speed-up"));
for (const item of laidOut) {
  assert.ok(item.x > skatingGateX(item.id) && item.x < skatingGateX(item.id + 1) - SKATING_PROMPT_LEAD - 1,
    "items sit between a gate and the next painted question, never on top of it");
}
assert.deepEqual(skatingItemsBetween("round-1", 0, skatingGateX(200)).map((item) => item.id), laidOut.map((item) => item.id));

const boosted = applySkatingItem(NO_BUFFS, "booster", 1_000);
assert.equal(boosted.boostUntilMs, 1_000 + BOOSTER_MS);
assert.ok(skatingForwardSpeed(boosted, 1_000) > SKATING_BASE_SPEED * 1.5, "the booster is much faster");
assert.equal(skatingForwardSpeed(boosted, 1_000 + BOOSTER_MS), SKATING_BASE_SPEED, "the booster wears off");
const sped = applySkatingItem(NO_BUFFS, "speed-up", 0);
assert.ok(Math.abs(skatingForwardSpeed(sped, 0) - SKATING_BASE_SPEED * 1.1) < 1e-9, "a speed-up is a permanent +10%");
let stacked = NO_BUFFS;
for (let index = 0; index < 20; index += 1) stacked = applySkatingItem(stacked, "speed-up", 0);
assert.equal(stacked.speedUps, MAX_SPEED_UPS);
const fastest = skatingForwardSpeed(applySkatingItem(stacked, "booster", 0), 0);
assert.ok(SKATING_GATE_SPACING / fastest >= 1.5, "even at top speed there is time to read each gate");
assert.ok(SKATING_GATE_SPACING / SKATING_BASE_SPEED >= 4.5, "at base speed students get several seconds per question");
assert.ok(SKATING_FIRST_GATE_X / SKATING_BASE_SPEED >= 6, "a run-up before the first question");

// Simulation: gates report the lane, a crash waits three seconds, items are collected once.
function run(simulation: SkaterSimulation, fromMs: number, seconds: number, steer: -1 | 0 | 1 = 0): SkaterEvent[] {
  const events: SkaterEvent[] = [];
  for (let step = 0; step < seconds * 60; step += 1) events.push(...simulation.step(fromMs + step * 1000 / 60, 1 / 60, steer, false));
  return events;
}
const simulation = new SkaterSimulation("no-items-here", 0);
const toFirstGate = run(simulation, 0, skatingGateX(0) / SKATING_BASE_SPEED + 0.1);
assert.deepEqual(toFirstGate.filter((event) => event.type === "gate"), [{ type: "gate", gateIndex: 0, lane: 1 }]);
const crashedAt = 10_000;
simulation.crash(crashedAt);
const stoppedX = simulation.snapshot(crashedAt).x;
assert.deepEqual(simulation.step(crashedAt + SKATING_RESPAWN_MS - 1, 1 / 60, 1, false), []);
assert.equal(simulation.snapshot(crashedAt + SKATING_RESPAWN_MS - 1).x, stoppedX, "a crashed skater does not move");
const back = simulation.step(crashedAt + SKATING_RESPAWN_MS, 1 / 60, 0, false);
assert.equal(back[0]?.type, "respawn");
assert.equal(simulation.snapshot(crashedAt + SKATING_RESPAWN_MS).y, 0, "respawn is in the centre lane");

const centreItem = laidOut.find((candidate) => candidate.lane === 1)!;
const collector = new SkaterSimulation("round-1", centreItem.x - 0.5);
const pickups = run(collector, 0, 1);
assert.deepEqual(pickups.filter((event) => event.type === "item").map((event) => event.type === "item" && event.item.id), [centreItem.id],
  "gliding over an item in your lane picks it up once");
assert.ok(collector.hasCollected(centreItem.id));

// Punches shove the nearest skater sideways, away from the attacker.
const hit = chooseSkatingPunchTarget({ x: 10, y: 0 }, [
  { playerId: "far", x: 14, y: 0 },
  { playerId: "below", x: 10.2, y: 0.6 },
  { playerId: "above", x: 9.6, y: -0.9 },
]);
assert.equal(hit?.target.playerId, "below");
assert.equal(hit?.direction, 1);
assert.equal(chooseSkatingPunchTarget({ x: 0, y: 0 }, [{ playerId: "far", x: 5, y: 0 }]), null);
assert.ok(skatingPunchShove(-1) < 0 && skatingPunchShove(1) > 0);

console.log("skating tests passed");
