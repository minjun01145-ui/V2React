import assert from "node:assert/strict";
import {
  WORD_UNO_FAMILY_SLOTS,
  WORD_UNO_HAND_SIZE,
  WORD_UNO_ROUND_MS,
  WORD_UNO_TURN_MS,
  WordUnoRuleError,
  assignmentForGroup,
  buildWordUnoDeck,
  createWordUnoGroupState,
  dedupeExactFamilies,
  drawWordUnoCardState,
  expireWordUnoGroupState,
  expireWordUnoTurnState,
  isPlayableCard,
  playWordUnoCardState,
  waitingAssignment,
  wordUnoGroupSizes,
} from "../lib/word-uno/model.js";

const noRandom = () => 0;

function word(id, familyId, stage, text = `${familyId}-${stage}`, meaning = familyId) {
  return {
    id,
    kind: "word",
    text,
    meaning,
    familyId,
    familyForms: [`${familyId}-1`, `${familyId}-2`, `${familyId}-3`],
    stage,
  };
}

function state(overrides = {}) {
  return {
    groupId: "uno-1",
    groupLabel: "UNO 1",
    memberIds: ["a", "b", "c"],
    memberProfiles: [
      { playerId: "a", nickname: "A" },
      { playerId: "b", nickname: "B" },
      { playerId: "c", nickname: "C" },
    ],
    status: "active",
    generation: 1,
    revision: 5,
    hands: {
      a: [word("a1", "other", 2)],
      b: [word("b1", "b", 2)],
      c: [word("c1", "c", 3)],
    },
    drawPile: [word("draw1", "draw", 3), word("draw2", "draw", 2)],
    discardPile: [word("top", "family", 1)],
    activeStage: 1,
    activeFamilyId: "family",
    currentPlayerId: "a",
    turnDeadlineAtMs: 10_000,
    endsAtMs: 180_000,
    ranks: { a: null, b: null, c: null },
    ...overrides,
  };
}

assert.deepEqual(wordUnoGroupSizes(1), []);
assert.deepEqual(wordUnoGroupSizes(2), []);
assert.deepEqual(wordUnoGroupSizes(3), [3]);
assert.deepEqual(wordUnoGroupSizes(4), [4]);
assert.deepEqual(wordUnoGroupSizes(5), [4]);
assert.deepEqual(wordUnoGroupSizes(6), [3, 3]);
assert.deepEqual(wordUnoGroupSizes(7), [3, 4]);
assert.deepEqual(wordUnoGroupSizes(8), [4, 4]);
assert.deepEqual(wordUnoGroupSizes(9), [3, 3, 3]);
assert.deepEqual(wordUnoGroupSizes(10), [3, 3, 4]);
assert.deepEqual(wordUnoGroupSizes(11), [3, 4, 4]);
assert.deepEqual(wordUnoGroupSizes(14), [3, 3, 4, 4]);

const inputs = [
  { sourceText: "heavy", form2: "heavier", form3: "the heaviest", meaning: "무거운" },
  { sourceText: "heavy", form2: "heavier", form3: "the heaviest", meaning: "무거운" },
  { sourceText: "good", form2: "better", form3: "the best", meaning: "좋은" },
];
const families = dedupeExactFamilies(inputs);
assert.equal(families.length, 2);
assert.deepEqual(families[0]?.forms, ["heavy", "heavier", "the heaviest"]);

const deck = buildWordUnoDeck(families, noRandom);
assert.equal(deck.length, 102);
assert.equal(deck.filter((card) => card.kind === "word").length, 90);
assert.equal(deck.filter((card) => card.kind === "skip").length, 4);
assert.equal(deck.filter((card) => card.kind === "draw-two").length, 4);
assert.equal(deck.filter((card) => card.kind === "wild").length, 4);
assert.equal(new Set(deck.filter((card) => card.kind === "word").map((card) => card.familyId)).size, 2);
assert.equal(deck.filter((card) => card.kind === "word" && card.familyId === families[0]?.familyId).length, 45);
assert.equal(deck.find((card) => card.kind === "word")?.familyForms.length, 3);
assert.equal(WORD_UNO_FAMILY_SLOTS, 30);

const manyFamilies = dedupeExactFamilies(Array.from({ length: 31 }, (_unused, index) => ({
  sourceText: `f${index}-1`, form2: `f${index}-2`, form3: `f${index}-3`, meaning: `m${index}`,
})));
const cappedDeck = buildWordUnoDeck(manyFamilies, noRandom);
assert.equal(new Set(cappedDeck.filter((card) => card.kind === "word").map((card) => card.familyId)).size, 30);

const created = createWordUnoGroupState({
  groupId: "uno-1",
  groupLabel: "UNO 1",
  memberIds: ["a", "b", "c", "d"],
  memberProfiles: ["a", "b", "c", "d"].map((playerId) => ({ playerId, nickname: playerId.toUpperCase() })),
  families,
  endsAtMs: 180_000,
  now: 1_000,
  random: noRandom,
});
assert.equal(Object.values(created.hands).every((hand) => hand.length === WORD_UNO_HAND_SIZE), true);
assert.equal(created.drawPile.length, 102 - (4 * WORD_UNO_HAND_SIZE) - 1);
assert.equal(created.discardPile.length, 1);
assert.equal(created.discardPile[0]?.kind, "word");
assert.equal(created.activeStage, created.discardPile[0]?.stage);
assert.equal(created.activeFamilyId, created.discardPile[0]?.familyId);
assert.equal(created.currentPlayerId, "a");
assert.equal(created.turnDeadlineAtMs, 1_000 + WORD_UNO_TURN_MS);
assert.equal(WORD_UNO_ROUND_MS, 180_000);

assert.equal(isPlayableCard(word("same-stage", "x", 1), 1, "family"), true);
assert.equal(isPlayableCard(word("same-family", "family", 3), 1, "family"), true);
assert.equal(isPlayableCard(word("wrong", "x", 2), 1, "family"), false);
assert.equal(isPlayableCard({ id: "skip", kind: "skip" }, 1, "family"), true);
assert.equal(isPlayableCard({ id: "draw-two", kind: "draw-two" }, 1, "family"), true);
assert.equal(isPlayableCard({ id: "wild", kind: "wild" }, 1, "family"), true);

const wrong = state();
const wrongBefore = JSON.stringify(wrong);
assert.throws(() => playWordUnoCardState(wrong, "a", "a1", undefined, 5_000, noRandom), WordUnoRuleError);
assert.equal(JSON.stringify(wrong), wrongBefore, "rejected card must not mutate hand or turn");

const drawForbidden = state({ hands: { a: [{ id: "skip", kind: "skip" }], b: [], c: [] } });
assert.throws(() => drawWordUnoCardState(drawForbidden, "a", 5_000, noRandom), /낼 수 있는 카드/);

const manualDraw = drawWordUnoCardState(state(), "a", 5_000, noRandom).state;
assert.equal(manualDraw.hands.a.length, 2);
assert.equal(manualDraw.currentPlayerId, "b");
assert.equal(manualDraw.revision, 6);

const timeoutBase = state({ hands: { a: [word("playable", "family", 3)], b: [], c: [] } });
const timeout = expireWordUnoTurnState(timeoutBase, 10_000, noRandom).state;
assert.equal(timeout.hands.a.length, 2, "timeout draws even when a playable card exists");
assert.equal(timeout.currentPlayerId, "b");

const skipBase = state({
  hands: { a: [{ id: "skip:1", kind: "skip" }, word("a2", "x", 2)], b: [word("b1", "b", 1)], c: [word("c1", "c", 1)] },
});
const skipped = playWordUnoCardState(skipBase, "a", "skip:1", undefined, 5_000, noRandom).state;
assert.equal(skipped.currentPlayerId, "c");
assert.equal(skipped.activeStage, 1);
assert.equal(skipped.activeFamilyId, "family");

const plusTwoBase = state({
  hands: { a: [{ id: "draw-two:1", kind: "draw-two" }, word("a2", "x", 2)], b: [word("b1", "b", 1)], c: [word("c1", "c", 1)] },
});
const plusTwo = playWordUnoCardState(plusTwoBase, "a", "draw-two:1", undefined, 5_000, noRandom).state;
assert.equal(plusTwo.hands.b.length, 3);
assert.equal(plusTwo.currentPlayerId, "c");
assert.equal(plusTwo.activeStage, 1);
assert.equal(plusTwo.activeFamilyId, "family");

const wildBase = state({ hands: { a: [{ id: "wild:1", kind: "wild" }, word("a2", "x", 2)], b: [], c: [] } });
assert.throws(() => playWordUnoCardState(wildBase, "a", "wild:1", undefined, 5_000, noRandom), /WILD/);
const wild = playWordUnoCardState(wildBase, "a", "wild:1", 3, 5_000, noRandom).state;
assert.equal(wild.activeStage, 3);
assert.equal(wild.activeFamilyId, "family", "wild preserves the last normal family criterion");
assert.equal(wild.currentPlayerId, "b");

const lastActionBase = state({
  hands: { a: [{ id: "draw-two:1", kind: "draw-two" }], b: [word("b1", "b", 1)], c: [word("c1", "c", 1)] },
});
const lastAction = playWordUnoCardState(lastActionBase, "a", "draw-two:1", undefined, 5_000, noRandom).state;
assert.equal(lastAction.ranks.a, 1);
assert.equal(lastAction.hands.b.length, 3, "last action card still applies +2");
assert.equal(lastAction.currentPlayerId, "c", "last action card still skips the +2 target");

const oneLeftBase = state({
  hands: { a: [word("finish", "family", 2)], b: [word("b1", "b", 1)], c: [] },
  ranks: { a: null, b: null, c: 1 },
});
const oneLeft = playWordUnoCardState(oneLeftBase, "a", "finish", undefined, 5_000, noRandom).state;
assert.equal(oneLeft.status, "completed");
assert.equal(oneLeft.ranks.a, 2);
assert.equal(oneLeft.ranks.b, 3);
assert.equal(oneLeft.currentPlayerId, null);

const reshuffleBase = state({
  drawPile: [],
  discardPile: [word("old1", "old", 2), word("old2", "old", 3), word("top", "family", 1)],
});
const reshuffled = drawWordUnoCardState(reshuffleBase, "a", 5_000, noRandom).state;
assert.equal(reshuffled.discardPile.length, 1);
assert.equal(reshuffled.discardPile[0]?.id, "top");
assert.equal(reshuffled.hands.a.length, 2);
assert.equal(reshuffled.drawPile.length, 1);

const tied = expireWordUnoGroupState(state({
  memberIds: ["a", "b", "c", "d"],
  memberProfiles: ["a", "b", "c", "d"].map((playerId) => ({ playerId, nickname: playerId.toUpperCase() })),
  hands: {
    a: [],
    b: [word("b1", "b", 1), word("b2", "b", 2)],
    c: [word("c1", "c", 1), word("c2", "c", 2)],
    d: [word("d1", "d", 1), word("d2", "d", 2), word("d3", "d", 3), word("d4", "d", 1), word("d5", "d", 2)],
  },
  ranks: { a: 1, b: null, c: null, d: null },
}));
assert.equal(tied.status, "completed");
assert.equal(tied.ranks.a, 1);
assert.equal(tied.ranks.b, 2);
assert.equal(tied.ranks.c, 2);
assert.equal(tied.ranks.d, 4);

const assignment = assignmentForGroup(created, "a");
assert.equal(assignment.hand.length, WORD_UNO_HAND_SIZE);
assert.equal(assignment.members.length, 4);
assert.equal(assignment.members.every((member) => typeof member.handCount === "number" && !("hand" in member)), true);
assert.equal(assignment.topCard?.kind, "word");
assert.equal(assignment.topCard?.familyForms.length, 3);
assert.deepEqual(assignment.activeFamilyForms, assignment.topCard?.familyForms);
assert.deepEqual(waitingAssignment("late", 180_000), {
  playerId: "late", groupId: null, groupLabel: null, status: "waiting", generation: 0, revision: 0,
  hand: [], members: [], topCard: null, activeStage: null, activeFamilyId: null, activeFamilyForms: null, currentPlayerId: null,
  turnDeadlineAtMs: null, endsAtMs: 180_000, rank: null,
});

const specialTopAssignment = assignmentForGroup(playWordUnoCardState(skipBase, "a", "skip:1", undefined, 5_000, noRandom).state, "a");
assert.deepEqual(specialTopAssignment.activeFamilyForms, ["family-1", "family-2", "family-3"], "special top keeps the visible last-normal family");

console.log("Word UNO server model tests passed");
