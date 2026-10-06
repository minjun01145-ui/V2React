import assert from "node:assert/strict";
import { mock } from "node:test";
import { db } from "../lib/shared/firebase.js";
import { ensureChunkLineUpRoundService } from "../lib/chunk-line-up/service.js";
import {
  buildInitialChunkLineUpBoard,
  chooseChunkLineUpReplacementSource,
  chunkLineUpGroupComplete,
  chunkLineUpSlotAcceptsToken,
  isChunkLineUpElevatorDestinationOpen,
  instantiateChunkLineUpGroup,
  instantiateChunkLineUpReplacement,
  openChunkLineUpTargets,
  placeChunkLineUpCard,
  publicChunkLineUpBoard,
} from "../lib/chunk-line-up/model.js";
import {
  boardChunkLineUpElevatorRide,
  CHUNK_LINE_UP_ELEVATOR_DOOR_MS,
  CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS,
  chunkLineUpElevatorFloorPosition,
  chunkLineUpElevatorTravelMs,
  createChunkLineUpElevatorState,
  resolveChunkLineUpElevatorState,
} from "../lib/chunk-line-up/elevatorModel.js";

const sources = Array.from({ length: 12 }, (_, index) => {
  const slotCount = [3, 4, 5][index % 3];
  return {
    id: `sentence-${index + 1}`,
    prompt: `뜻 ${index + 1}`,
    slots: Array.from({ length: slotCount }, (_unused, slotIndex) => `chunk-${index + 1}-${slotIndex + 1}`),
  };
});
const makePlayers = (count, prefix = "player") => Array.from({ length: count }, (_, index) => ({
  playerId: `${prefix}-${index + 1}`,
  label: `학생 ${index + 1}`,
}));

/** One card per open slot, never two cards for the same slot, attached players hold no card. */
function assertCardInvariant(board, message) {
  const open = new Set(openChunkLineUpTargets(board.groups).map((target) => target.slotId));
  const carrying = Object.values(board.assignments).filter((item) => item.token !== "");
  const held = carrying.map((item) => item.targetSlotId);
  assert.equal(new Set(held).size, held.length, `${message}: two cards point at one slot`);
  for (const slotId of held) assert(open.has(slotId), `${message}: a card points at a closed slot`);
  const waiting = Object.values(board.assignments).filter((item) => item.token === "" && item.attachedGroupId === null);
  if (waiting.length > 0) assert.equal(held.length, open.size, `${message}: a card-less player waits while a slot is free`);
  for (const item of Object.values(board.assignments)) {
    if (item.attachedGroupId) assert.equal(item.token, "", `${message}: attached players hold no card`);
  }
}

// --- Dealing -----------------------------------------------------------------

const players = makePlayers(20);
const initial = buildInitialChunkLineUpBoard(sources, players, "round-20");
const board = initial.board;
assert.equal(board.groups.length, 6, "20 students get six sentences (one per three students, at most six)");
assert.equal(openChunkLineUpTargets(board.groups).length, players.length, "one open slot per student");
assertCardInvariant(board, "initial board");
assert(Object.values(board.assignments).every((item) => item.token !== ""), "every student starts with a card");
for (const group of board.groups) assert(group.slots.some((slot) => !slot.fixed), "no sentence starts complete");

const crowd = buildInitialChunkLineUpBoard(sources.slice(0, 2), makePlayers(12, "crowd"), "crowd").board;
assertCardInvariant(crowd, "more students than slots");
assert(Object.values(crowd.assignments).some((item) => item.token === ""), "extra students wait for a card");

// --- Placing -----------------------------------------------------------------

const state0 = { board, sourceGroups: initial.orderedSourceGroups, nextSourceIndex: initial.nextSourceIndex, nextGroupSequence: initial.nextGroupSequence };
const [firstId, firstCard] = Object.entries(board.assignments)[0];
const wrongSlot = openChunkLineUpTargets(board.groups).find((target) => target.text !== firstCard.token);
assert.equal(placeChunkLineUpCard(state0, firstId, wrongSlot.groupId, wrongSlot.slotId, "r").kind, "wrong");
const placed = placeChunkLineUpCard(state0, firstId, firstCard.targetGroupId, firstCard.targetSlotId, "r");
assert.equal(placed.kind, "placed");
const placedBoard = placed.state.board;
assert.equal(placedBoard.assignments[firstId].attachedGroupId, firstCard.targetGroupId, "the placer stays on that sentence");
assert.equal(placedBoard.assignments[firstId].token, "", "and holds no new card until it is finished");
for (const [id, card] of Object.entries(board.assignments)) {
  if (id !== firstId) assert.deepEqual(placedBoard.assignments[id], card, "nobody else's card changes when someone places");
}
assert.equal(placeChunkLineUpCard(placed.state, firstId, wrongSlot.groupId, wrongSlot.slotId, "r").kind, "stale",
  "an attached student cannot place again");
assertCardInvariant(placedBoard, "after one placement");

// Play until many sentences complete: the invariant must hold and the game never stalls.
for (const playerCount of [3, 7, 20, 30]) {
  let state = { ...state0, ...(() => {
    const built = buildInitialChunkLineUpBoard(sources, makePlayers(playerCount, `sim${playerCount}`), `sim-${playerCount}`);
    return { board: built.board, sourceGroups: built.orderedSourceGroups, nextSourceIndex: built.nextSourceIndex, nextGroupSequence: built.nextGroupSequence };
  })() };
  let completions = 0;
  for (let move = 0; move < 400; move += 1) {
    const mover = Object.values(state.board.assignments).find((item) => item.token !== "");
    assert(mover, `${playerCount} players: someone must always hold a card (no deadlock)`);
    const result = placeChunkLineUpCard(state, mover.playerId, mover.targetGroupId, mover.targetSlotId, `sim-${move}`);
    assert.equal(result.kind, "placed");
    if (result.completedGroup) {
      completions += 1;
      const builders = Object.values(state.board.assignments)
        .filter((item) => item.attachedGroupId === mover.targetGroupId || item.playerId === mover.playerId);
      for (const builder of builders) {
        assert.equal(result.state.board.assignments[builder.playerId].attachedGroupId, null, "finishing frees every builder");
      }
    }
    state = result.state;
    assertCardInvariant(state.board, `${playerCount} players, move ${move}`);
  }
  assert(completions > 10, `${playerCount} players should finish many sentences`);
}

// --- Sources and replacements ------------------------------------------------

const rotationSources = ["s4", "s3", "s5", "s2", "s0", "s1"].map((id) => ({ id, prompt: id, slots: [`${id}-1`, `${id}-2`] }));
const firstRotation = chooseChunkLineUpReplacementSource(rotationSources, 5, new Set(["s4", "s3", "s2", "s0"]), "s5");
assert.equal(firstRotation?.source.id, "s1", "replacement should use the next inactive source in shuffled order");
const onlySafeReuse = chooseChunkLineUpReplacementSource(rotationSources.slice(0, 5), 5, new Set(["s4", "s5", "s2", "s0"]), "s3");
assert.equal(onlySafeReuse?.source.id, "s3", "the completed source may be reused when every other source is still visible");

assert.equal(openChunkLineUpTargets([instantiateChunkLineUpReplacement(sources[2], 100, 3, "x")]).length, 3,
  "a replacement opens exactly as many slots as players are dealt in");
assert.equal(openChunkLineUpTargets([instantiateChunkLineUpReplacement(sources[0], 101, 9, "x")]).length, 3,
  "but never more than the sentence has");

const filled = instantiateChunkLineUpGroup(sources[0], 99);
assert.equal(chunkLineUpGroupComplete({ ...filled, slots: filled.slots.map((slot) => ({ ...slot, filledBy: "p" })) }), true);
assert.equal(chunkLineUpGroupComplete(filled), false);

const duplicateTokenGroup = instantiateChunkLineUpGroup({ id: "dup", prompt: "그 고양이와 그 개", slots: ["the", "cat", "and", "the", "dog"] }, 102);
assert.equal(chunkLineUpSlotAcceptsToken(duplicateTokenGroup.slots[3], "the"), true,
  "identical chunk text in another open slot must also be a valid placement");
assert.equal(chunkLineUpSlotAcceptsToken(duplicateTokenGroup.slots[1], "the"), false);

// --- Public board ------------------------------------------------------------

const publicBoard = publicChunkLineUpBoard(placedBoard);
const firstOpen = publicBoard.groups.flatMap((group) => group.slots).find((slot) => !slot.fixed && !slot.filledBy);
assert.equal(firstOpen.text, "", "student-visible board must hide unresolved slot answers");
const publicAssignment = publicBoard.assignments[firstId];
assert.equal("targetSlotId" in publicAssignment, false, "student-visible assignments must not reveal target slots");
assert.equal(publicAssignment.attachedGroupId, firstCard.targetGroupId, "students can see they are attached");
const openFloor = board.groups.findIndex((group) => group.slots.some((slot) => !slot.fixed && !slot.filledBy));
assert.equal(isChunkLineUpElevatorDestinationOpen(board, openFloor, board.groups[openFloor].id), true);
assert.equal(isChunkLineUpElevatorDestinationOpen(board, openFloor, "replaced-sentence"), false);

// --- Elevators ---------------------------------------------------------------

const T = 10_000;
const LOBBY = 5;
const travel = (from, to) => CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS + CHUNK_LINE_UP_ELEVATOR_DOOR_MS
  + chunkLineUpElevatorTravelMs(from, to) + CHUNK_LINE_UP_ELEVATOR_DOOR_MS;

// Boarding at the lobby: in at once, off at the destination, then the car idles there.
let lift = boardChunkLineUpElevatorRide(createChunkLineUpElevatorState(LOBBY, T), "left", "a", LOBBY, 2, LOBBY, T + 100);
assert.equal(lift.accepted, true);
assert.equal(lift.state.left.seats[0].boarded, true, "a car open at the caller's floor takes them in immediately");
let at = resolveChunkLineUpElevatorState(lift.state, T + 100 + travel(LOBBY, 2) + 1);
assert.equal(at.left.floor, 2);
assert.equal(at.left.seats.length, 0, "the rider gets off at their floor");
const idleLater = resolveChunkLineUpElevatorState(lift.state, T + 60_000);
assert.equal(idleLater.left.phase, "open");
assert.equal(idleLater.left.floor, 2, "an empty car waits where it is with the doors open");

// Calling from an upper floor: the car comes, picks up, then delivers.
lift = boardChunkLineUpElevatorRide(createChunkLineUpElevatorState(LOBBY, T), "right", "caller", 3, 0, LOBBY, T + 100);
assert.equal(lift.state.right.seats[0].boarded, false, "the caller waits at their floor");
at = resolveChunkLineUpElevatorState(lift.state, T + 100 + travel(LOBBY, 3) + 1);
assert.equal(at.right.floor, 3);
assert.equal(at.right.seats[0].boarded, true, "the car picks the caller up at their floor");
at = resolveChunkLineUpElevatorState(lift.state, T + 100 + travel(LOBBY, 3) + travel(3, 0) + 1);
assert.equal(at.right.floor, 0);
assert.equal(at.right.seats.length, 0, "and drops them at the destination");

// Capacity and double booking.
let full = createChunkLineUpElevatorState(LOBBY, T);
for (const [id, destination] of [["x", 1], ["y", 3], ["z", 2]]) {
  full = boardChunkLineUpElevatorRide(full, "left", id, LOBBY, destination, LOBBY, T + 100).state;
}
assert.equal(boardChunkLineUpElevatorRide(full, "left", "w", LOBBY, 0, LOBBY, T + 120).accepted, false, "three riders at most");
assert.equal(boardChunkLineUpElevatorRide(full, "right", "x", LOBBY, 0, LOBBY, T + 120).accepted, false, "one booking per player");
assert.equal(boardChunkLineUpElevatorRide(full, "left", "x", LOBBY, 1, LOBBY, T + 120).accepted, true, "replaying a booking is idempotent");

// Sweep order: from the lobby going up it stops at 3, then 2, then 1 (nearest first in one direction).
const stopsVisited = [];
let previousFloor = LOBBY;
for (let time = T + 100; time < T + 30_000; time += 50) {
  const car = resolveChunkLineUpElevatorState(full, time).left;
  if (car.phase === "open" && car.floor !== previousFloor) {
    stopsVisited.push(car.floor);
    previousFloor = car.floor;
  }
}
assert.deepEqual(stopsVisited, [3, 2, 1], "riders are dropped off in sweep order");

// A car about to pass a caller's floor stops for them on the way.
let passing = boardChunkLineUpElevatorRide(createChunkLineUpElevatorState(LOBBY, T), "left", "rider", LOBBY, 0, LOBBY, T).state;
const departAt = T + CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS + CHUNK_LINE_UP_ELEVATOR_DOOR_MS;
const midway = departAt + 200;
assert(chunkLineUpElevatorFloorPosition(resolveChunkLineUpElevatorState(passing, midway).left, midway) > 4);
passing = boardChunkLineUpElevatorRide(passing, "left", "hitchhiker", 2, 0, LOBBY, midway).state;
const continued = resolveChunkLineUpElevatorState(passing, midway + 1);
assert.equal(continued.left.targetFloor, 2, "it retargets to the caller's floor");
assert(Math.abs(chunkLineUpElevatorFloorPosition(continued.left, midway + 1)
  - chunkLineUpElevatorFloorPosition(resolveChunkLineUpElevatorState({ ...passing, left: { ...passing.left } }, midway).left, midway)) < 0.05,
  "without jumping");
const later = resolveChunkLineUpElevatorState(passing, midway + 20_000).left;
assert.equal(later.floor, 0);
assert.equal(later.seats.length, 0, "both riders reach floor 0");

// The service builds and persists slots using the round's shared unit option.
const documents = new Map();
const reference = (path) => ({ path, collection: (name) => reference(`${path}/${name}`), doc: (id) => reference(`${path}/${id}`), get: async () => snapshot(path) });
const snapshot = (path) => ({ exists: documents.has(path), data: () => documents.get(path) });
mock.method(db, "collection", (name) => reference(name));
mock.method(db, "runTransaction", async (callback) => {
  const writes = [];
  const result = await callback({
    get: async (ref) => { assert.equal(writes.length, 0); return snapshot(ref.path); },
    set: (ref, data) => writes.push([ref.path, data]),
  });
  for (const [path, data] of writes) documents.set(path, data);
  return result;
});
const roundPath = "multiplayerSessions/room/rounds/round";
try {
  for (const unit of [undefined, "chunk", "word", "invalid"]) {
    documents.clear();
    const playerIds = ["alice", "bob", "carol", "dave", "eve"];
    documents.set("multiplayerSessions/room", { status: "playing", gameId: "chunk-line-up", roundId: "round", startedAtMs: Date.now(), expectedPlayerIds: playerIds, gameConfig: { setId: "set", "sentence-unit": unit } });
    documents.set("learningSets/set", { type: "reading-chunks" });
    documents.set("learningSets/set/content/main", { items: [
      { id: "unsplit", sourceText: "Skip this sentence.", meaning: "제외" },
      { id: "sentence", sourceText: "the cat / and the dog.", meaning: "그 고양이와 그 개" },
    ] });
    for (const playerId of playerIds) documents.set(`${roundPath}/participants/${playerId}`, { displayName: playerId });
    await ensureChunkLineUpRoundService({ roomId: "room", roundId: "round" });
    const state = documents.get(`${roundPath}/chunkLineUpState/main`);
    const expectedSlots = unit === "word" ? ["the", "cat", "and", "the", "dog."] : ["the cat", "and the dog."];
    assert.deepEqual(state.sourceGroups, [{ id: "sentence", prompt: "그 고양이와 그 개", slots: expectedSlots }]);
    assert.deepEqual(state.board.groups[0].slots.map((slot) => slot.text), expectedSlots);
    assertCardInvariant(state.board, `service ${unit ?? "default"}`);
    if (unit === "word") {
      const card = Object.values(state.board.assignments).find((assignment) => assignment.token === "the");
      const group = state.board.groups[0];
      const otherSlot = group.slots.find((slot) => slot.text === "the" && slot.id !== card.targetSlotId);
      assert.equal(placeChunkLineUpCard(state, card.playerId, group.id, otherSlot.id, "word-swap").kind, "placed");
    }
    await ensureChunkLineUpRoundService({ roomId: "room", roundId: "round" });
    assert.equal(documents.get(`${roundPath}/chunkLineUpState/main`), state, "initialization is idempotent");
  }
} finally {
  mock.restoreAll();
}
console.log("chunk line-up model/service tests passed");
