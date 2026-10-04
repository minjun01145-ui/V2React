import assert from "node:assert/strict";
import { createLadder, pickStudentIndex, traceLadder } from "../src/student-picker/model.ts";

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
console.log("Student picker and ladder tests passed");
