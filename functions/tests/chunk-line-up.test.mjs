import assert from "node:assert/strict";
import {
  buildInitialChunkLineUpBoard,
  chooseChunkLineUpReplacementSource,
  chooseChunkLineUpTarget,
  chunkLineUpGroupComplete,
  chunkLineUpSlotAcceptsToken,
  isChunkLineUpElevatorDestinationOpen,
  instantiateChunkLineUpGroup,
  instantiateChunkLineUpReplacement,
  openChunkLineUpTargets,
  publicChunkLineUpBoard,
} from "../lib/chunk-line-up/model.js";
import {
  boardChunkLineUpElevator,
  CHUNK_LINE_UP_ELEVATOR_DESTINATION_GRACE_MS,
  CHUNK_LINE_UP_ELEVATOR_DOOR_MS,
  CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS,
  chooseChunkLineUpElevatorDestination,
  chunkLineUpElevatorTravelMs,
  createChunkLineUpElevatorState,
  resolveChunkLineUpElevatorState,
} from "../lib/chunk-line-up/elevatorModel.js";

const sources = Array.from({ length: 9 }, (_, index) => {
  const slotCount = [3, 4, 5][index % 3];
  return {
    id: `sentence-${index + 1}`,
    prompt: `뜻 ${index + 1}`,
    slots: Array.from({ length: slotCount }, (_unused, slotIndex) => `chunk-${index + 1}-${slotIndex + 1}`),
  };
});
const players = Array.from({ length: 20 }, (_, index) => ({
  playerId: `player-${index + 1}`,
  label: `학생 ${index + 1}`,
}));

const initial = buildInitialChunkLineUpBoard(sources, players, "round-20");
const board = initial.board;
const allSlots = board.groups.flatMap((group) => group.slots);
const fixedSlots = allSlots.filter((slot) => slot.fixed);
const openTargets = openChunkLineUpTargets(board.groups);
assert.equal(board.groups.length, 5, "a normal class should stay within five visible sentence rows");
assert(openTargets.length <= players.length, "visible targets may be shared instead of adding extra sentence rows");
assert.equal(fixedSlots.length, Math.max(0, allSlots.length - players.length), "only overflow slots should start fixed");
assert.equal(Object.keys(board.assignments).length, players.length);
assert.equal(new Set(Object.values(board.assignments).map((assignment) => assignment.targetSlotId)).size, openTargets.length,
  "initial assignments should spread across all visible targets before sharing them");
for (const group of board.groups) {
  assert(group.slots.some((slot) => !slot.fixed), "every active group should leave at least one playable slot");
}
const activeSourceIds = new Set(board.groups.map((group) => group.sourceId));
const nextSource = initial.orderedSourceGroups[initial.nextSourceIndex % initial.orderedSourceGroups.length];
assert(nextSource);
assert.equal(activeSourceIds.has(nextSource.id), false,
  "replacement rotation must continue through the same shuffled source order used for the initial board");

const shortSources = Array.from({ length: 8 }, (_, index) => ({
  id: `short-${index + 1}`,
  prompt: `짧은 뜻 ${index + 1}`,
  slots: [`short-${index + 1}-1`, `short-${index + 1}-2`],
}));
const largeClass = Array.from({ length: 25 }, (_, index) => ({
  playerId: `large-${index + 1}`,
  label: `대형반 ${index + 1}`,
}));
const compact = buildInitialChunkLineUpBoard(shortSources, largeClass, "compact-25").board;
assert.equal(compact.groups.length, 5, "25 students with short sentences must not create more than five rows");
assert.equal(Object.keys(compact.assignments).length, largeClass.length, "every student still receives a chunk");
const assignmentCounts = new Map();
for (const assignment of Object.values(compact.assignments)) {
  assignmentCounts.set(assignment.targetSlotId, (assignmentCounts.get(assignment.targetSlotId) ?? 0) + 1);
}
const counts = [...assignmentCounts.values()];
assert(Math.max(...counts) - Math.min(...counts) <= 1, "shared initial targets should be distributed evenly");

const rotationSources = ["s4", "s3", "s5", "s2", "s0", "s1"].map((id) => ({ id, prompt: id, slots: [`${id}-1`, `${id}-2`] }));
const firstRotation = chooseChunkLineUpReplacementSource(
  rotationSources,
  5,
  new Set(["s4", "s3", "s2", "s0"]),
  "s5",
);
assert.equal(firstRotation?.source.id, "s1", "replacement should use the next inactive source in shuffled order");
const secondRotation = chooseChunkLineUpReplacementSource(
  rotationSources,
  firstRotation?.nextSourceIndex ?? 0,
  new Set(["s4", "s1", "s2", "s0"]),
  "s3",
);
assert.equal(secondRotation?.source.id, "s5", "replacement must skip sources still visible and avoid immediately repeating the completed source when possible");
const onlySafeReuse = chooseChunkLineUpReplacementSource(
  rotationSources.slice(0, 5),
  5,
  new Set(["s4", "s5", "s2", "s0"]),
  "s3",
);
assert.equal(onlySafeReuse?.source.id, "s3", "the completed source may be reused when every other source is still visible");

const first = Object.values(board.assignments)[0];
assert(first);
const alternate = chooseChunkLineUpTarget(
  board.groups,
  board.assignments,
  first.playerId,
  first.targetGroupId,
  "avoid-recent",
);
assert(alternate);
if (board.groups.length > 1) assert.notEqual(alternate.groupId, first.targetGroupId, "reassignment should avoid the recent group when possible");

const filled = instantiateChunkLineUpGroup(sources[0], 99);
const completed = {
  ...filled,
  slots: filled.slots.map((slot, index) => index === 0
    ? { ...slot, fixed: true }
    : { ...slot, filledBy: `p-${index}`, filledLabel: `학생 ${index}` }),
};
assert.equal(chunkLineUpGroupComplete(completed), true);
assert.equal(chunkLineUpGroupComplete(filled), false);

const duplicateTokenGroup = instantiateChunkLineUpGroup({
  id: "duplicate-token",
  prompt: "그 고양이와 그 개",
  slots: ["the", "cat", "and", "the", "dog"],
}, 101);
assert.equal(chunkLineUpSlotAcceptsToken(duplicateTokenGroup.slots[0], "the"), true);
assert.equal(chunkLineUpSlotAcceptsToken(duplicateTokenGroup.slots[3], "the"), true,
  "identical chunk text in another open slot must also be a valid placement");
assert.equal(chunkLineUpSlotAcceptsToken(duplicateTokenGroup.slots[1], "the"), false);

const replacement = instantiateChunkLineUpReplacement(sources[2], 100, 17, 20);
assert.equal(openChunkLineUpTargets([replacement]).length, 3,
  "replacement groups should retain fixed overflow slots when only three new open targets are needed");

const publicBoard = publicChunkLineUpBoard(board);
const firstOpenGroupIndex = board.groups.findIndex((group) => group.slots.some((slot) => !slot.fixed && !slot.filledBy));
const firstOpenGroup = board.groups[firstOpenGroupIndex];
assert(firstOpenGroup);
assert.equal(isChunkLineUpElevatorDestinationOpen(board, firstOpenGroupIndex, firstOpenGroup.id), true,
  "an open sentence can be selected as an elevator destination");
assert.equal(isChunkLineUpElevatorDestinationOpen(board, firstOpenGroupIndex, "replaced-sentence"), false,
  "a stale sentence selection must not redirect to a replacement group on the same floor");
const closedDestinationBoard = {
  ...board,
  groups: board.groups.map((group, index) => index === firstOpenGroupIndex
    ? { ...group, slots: group.slots.map((slot) => ({ ...slot, fixed: true })) }
    : group),
};
assert.equal(isChunkLineUpElevatorDestinationOpen(closedDestinationBoard, firstOpenGroupIndex, firstOpenGroup.id), false,
  "a sentence with no open matching slots is no longer a valid destination");
assert.equal(isChunkLineUpElevatorDestinationOpen(board, 99, firstOpenGroup.id), false,
  "a nonexistent sentence floor must not be accepted");
const firstOpen = publicBoard.groups.flatMap((group) => group.slots).find((slot) => !slot.fixed && !slot.filledBy);
assert(firstOpen);
assert.equal(firstOpen.text, "", "student-visible board must hide unresolved slot answers");
const publicAssignment = Object.values(publicBoard.assignments)[0];
assert(publicAssignment);
assert.equal("targetGroupId" in publicAssignment, false, "student-visible assignments must not reveal target group ids");
assert.equal("targetSlotId" in publicAssignment, false, "student-visible assignments must not reveal target slot ids");

const elevatorStart = 10_000;
let elevators = createChunkLineUpElevatorState(5, elevatorStart);
assert.equal(elevators.left.floor, 5);
assert.equal(elevators.right.floor, 5);
assert.equal(elevators.left.phase, "open");
for (const playerId of ["p1", "p2", "p3"]) {
  const boarded = boardChunkLineUpElevator(elevators, "left", playerId, 5, elevatorStart + 100);
  assert.equal(boarded.accepted, true);
  elevators = boarded.state;
}
assert.equal(boardChunkLineUpElevator(elevators, "left", "p4", 5, elevatorStart + 120).accepted, false,
  "a shaft must enforce capacity three");
assert.equal(boardChunkLineUpElevator(elevators, "right", "p1", 5, elevatorStart + 120).accepted, false,
  "a player cannot occupy both elevator shafts");

let selected = chooseChunkLineUpElevatorDestination(elevators, "left", "p1", 0, 5, elevatorStart + 200);
assert.equal(selected.accepted, true);
elevators = selected.state;
selected = chooseChunkLineUpElevatorDestination(elevators, "left", "p2", 2, 5, elevatorStart + 210);
elevators = selected.state;
selected = chooseChunkLineUpElevatorDestination(elevators, "left", "p3", 1, 5, elevatorStart + 220);
elevators = selected.state;
assert.deepEqual(elevators.left.queue, [0, 2, 1], "destinations should be visited one stop at a time in selection order");
assert.equal(chooseChunkLineUpElevatorDestination(elevators, "left", "p1", 0, 5, elevatorStart + 230).accepted, true,
  "replaying the same destination should be idempotent");
assert.equal(chooseChunkLineUpElevatorDestination(elevators, "left", "p1", 4, 5, elevatorStart + 230).accepted, false,
  "a rider must not change an already selected destination");

const firstArrivalOpenAt = elevatorStart + 220
  + CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS
  + CHUNK_LINE_UP_ELEVATOR_DOOR_MS
  + chunkLineUpElevatorTravelMs(5, 0)
  + CHUNK_LINE_UP_ELEVATOR_DOOR_MS;
let resolvedElevators = resolveChunkLineUpElevatorState(elevators, firstArrivalOpenAt + 1);
assert.equal(resolvedElevators.left.phase, "open");
assert.equal(resolvedElevators.left.floor, 0);
assert.deepEqual(resolvedElevators.left.seats.map((seat) => seat.playerId).sort(), ["p2", "p3"],
  "the rider for the current stop should leave after the doors finish opening");
assert.deepEqual(resolvedElevators.left.queue, [2, 1]);
const intermediateBoard = boardChunkLineUpElevator(resolvedElevators, "left", "p4", 0, firstArrivalOpenAt + 50);
assert.equal(intermediateBoard.accepted, true, "a free seat can be taken while doors are open at an intermediate stop");
const stillOpenForNewRider = resolveChunkLineUpElevatorState(
  intermediateBoard.state,
  firstArrivalOpenAt + 50 + CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS + 100,
);
assert.equal(stillOpenForNewRider.left.phase, "open",
  "a newly boarded rider must get destination-selection grace even when through-riders already have queued stops");

const idleWithRider = boardChunkLineUpElevator(createChunkLineUpElevatorState(5, 30_000), "right", "idle", 5, 30_100);
assert.equal(idleWithRider.accepted, true);
const expiredIdle = resolveChunkLineUpElevatorState(idleWithRider.state, 30_100 + CHUNK_LINE_UP_ELEVATOR_DESTINATION_GRACE_MS + 1);
assert.equal(expiredIdle.right.seats.length, 0, "a rider who never chooses a destination must not deadlock the shaft");

const upperEmpty = {
  ...createChunkLineUpElevatorState(5, 50_000),
  left: {
    ...createChunkLineUpElevatorState(5, 50_000).left,
    floor: 1,
    phaseStartedAtMs: 50_000,
  },
};
const returning = resolveChunkLineUpElevatorState(
  upperEmpty,
  50_000 + CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS + CHUNK_LINE_UP_ELEVATOR_DOOR_MS + 1,
);
assert.equal(returning.left.phase, "moving");
assert.equal(returning.left.targetFloor, 5, "an empty car away from the lobby should automatically return to the lobby");

console.log("chunk line-up model tests passed");
