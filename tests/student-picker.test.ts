import assert from "node:assert/strict";
import { createLadder, pickStudentIndex, traceLadder } from "../src/student-picker/model.ts";
import { jumpRaceScope, parseJumpRace, rankJumpRace } from "../src/student-picker/jump-race/model.ts";

assert.equal(pickStudentIndex(0), -1);
assert.equal(pickStudentIndex(22, () => 0), 0);
assert.equal(pickStudentIndex(22, () => 0.99999), 21);
assert.deepEqual(traceLadder(createLadder(0)), []);
assert.equal(traceLadder(createLadder(1)).at(-1)?.column, 0);

const known = { count: 4, start: 0, rows: [[0, 2], [1], [2], [0]] };
assert.equal(traceLadder(known).at(-1)?.column, 3);
assert.deepEqual(traceLadder(known).slice(0, 3), [{ column: 0, level: 0 }, { column: 0, level: 1 }, { column: 1, level: 1 }]);

let seed = 351;
const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
for (const count of [1, 2, 5, 22, 40]) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const ladder = createLadder(count, random);
    for (const row of ladder.rows) {
      assert.ok(row.every((column) => column >= 0 && column < count - 1));
      assert.ok(row.every((column, index) => index === 0 || column - row[index - 1]! >= 2), "bridges must not meet on the same row");
    }
    const destinations = Array.from({ length: count }, (_, start) => traceLadder({ ...ladder, start }).at(-1)!.column);
    assert.deepEqual([...destinations].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index), "every student has exactly one ladder start");
    const path = traceLadder(ladder);
    assert.ok(path.every((point) => point.column >= 0 && point.column < count));
    assert.equal(path.at(-1)?.level, ladder.rows.length + 1);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      assert.ok(a.column === b.column || (a.level === b.level && Math.abs(a.column - b.column) === 1));
    }
  }
}
// Jump-tower race line-up
const racers = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
const lineUp = rankJumpRace(racers, [
  { playerId: "a", floor: 100, reachedAtMs: 5_000 },
  { playerId: "b", floor: 100, reachedAtMs: 3_000 },
  { playerId: "c", floor: 64, reachedAtMs: 4_000 },
  { playerId: "d", floor: 64, reachedAtMs: 2_000 },
], 100);
assert.deepEqual(lineUp.map((standing) => [standing.rank, standing.player.id, standing.finished]),
  [[1, "b", true], [2, "a", true], [3, "d", false], [4, "c", false], [5, "e", false]],
  "finishers by arrival time, then everyone else by height (earlier first on a tie), students without a record last");
assert.equal(rankJumpRace([{ id: "a" }], [{ playerId: "a", floor: 140, reachedAtMs: 1 }], 100)[0]!.floor, 100, "a record above the goal counts as the goal");
assert.deepEqual(jumpRaceScope("room", { raceId: "r1" }), { roomId: "room", roundId: "jump-race-r1", channelId: "race" });
assert.deepEqual(parseJumpRace({ raceId: "r1", showRunId: "run-1", goalFloor: 100, startedAtMs: 1 }), { raceId: "r1", showRunId: "run-1", goalFloor: 100, startedAtMs: 1 });
assert.equal(parseJumpRace({ raceId: "r1", showRunId: "run-1", goalFloor: 0, startedAtMs: 1 }), null);
assert.equal(parseJumpRace(null), null);
console.log("Student picker and ladder tests passed");
