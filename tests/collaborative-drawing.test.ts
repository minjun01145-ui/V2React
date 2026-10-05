import assert from "node:assert/strict";
import { authorHue, availableSlot, inkColor, strokeColor, BOARD_HEIGHT, BOARD_WIDTH, hitTestStroke, MAX_STROKE_POINTS, MAX_STROKES_PER_AUTHOR, packPoints, parseStroke, simplifyStroke, sortStrokes, strokeId, unpackPoints, type DrawingPoint, type DrawingStroke } from "../src/collaborative-drawing/model.ts";

const line = (slot = 0, overrides: Partial<DrawingStroke> = {}): DrawingStroke => ({
  id: strokeId("alice", slot), authorId: "alice", slot, label: "파란 고래", hue: authorHue("alice"), color: null, width: 6,
  points: [{ x: 100, y: 100 }, { x: 200, y: 100 }], generation: 0, createdAt: 1000, ...overrides,
});
const raw = { by: "alice", s: 0, l: "파란 고래", c: 123, w: 6, p: packPoints(line().points), g: 0, t: 1000 };
assert.equal(parseStroke("alice_0", raw)?.label, "파란 고래");
assert.equal(parseStroke("alice_0", raw)?.color, null, "strokes without k keep the author's own color");
assert.equal(parseStroke("alice_0", { ...raw, k: 3 })?.color, 3);
assert.equal(parseStroke("alice_0", { ...raw, w: 1 })?.width, 1, "thin pens are accepted");
assert.equal(parseStroke("alice_0", { ...raw, w: 2 })?.width, 2);
assert.equal(strokeColor({ hue: 10, color: null }), inkColor(10));
assert.equal(strokeColor({ hue: 10, color: 0 }), "#1f2430");
assert.equal(parseStroke("bob_0", raw), null, "author cannot be attributed to another student's ID");
for (const invalid of [null, [], { ...raw, s: 80 }, { ...raw, s: -1 }, { ...raw, s: 1.5 }, { ...raw, c: 360 }, { ...raw, w: 999 }, { ...raw, k: 10 }, { ...raw, k: -1 }, { ...raw, k: 1.5 }, { ...raw, k: "red" }, { ...raw, l: "x".repeat(41) }, { ...raw, g: NaN }, { ...raw, t: Infinity }, { ...raw, by: "bad/name" }, { ...raw, p: "1,2" }, { ...raw, p: "123456".repeat(193) }]) {
  assert.equal(parseStroke("alice_0", invalid), null, "untrusted data must be bounded and valid");
}

const points: DrawingPoint[] = [{ x: 0, y: 0 }, { x: BOARD_WIDTH, y: BOARD_HEIGHT }, { x: 509.2, y: 204.1 }];
const packed = packPoints(points);
assert.equal(packed.length, points.length * 6);
const unpacked = unpackPoints(packed)!;
for (let index = 0; index < points.length; index++) {
  assert.ok(Math.abs(points[index]!.x - unpacked[index]!.x) <= BOARD_WIDTH / 999 / 2);
  assert.ok(Math.abs(points[index]!.y - unpacked[index]!.y) <= BOARD_HEIGHT / 999 / 2);
}
assert.deepEqual(unpackPoints(packPoints([{ x: -10, y: 900 }])), [{ x: 0, y: BOARD_HEIGHT }]);

const straight = Array.from({ length: 1000 }, (_, x) => ({ x, y: x / 2 }));
assert.deepEqual(simplifyStroke(straight), [straight[0], straight.at(-1)], "straight lines should cost two points rather than pointer-event counts");
const corner = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 100 }];
assert.deepEqual(simplifyStroke(corner), [corner[0], corner[2], corner[4]], "visible corners must survive compression");
const scribble = Array.from({ length: 4000 }, (_, index) => ({ x: index % BOARD_WIDTH, y: index % 2 ? 700 : 50 }));
const simplified = simplifyStroke(scribble);
assert.ok(simplified.length <= MAX_STROKE_POINTS);
assert.deepEqual(simplified[0], scribble[0]);
assert.deepEqual(simplified.at(-1), scribble.at(-1));
assert.ok(packPoints(simplified).length <= 1152);
assert.equal(simplifyStroke([{ x: 1, y: 1 }]).length, 1, "a tap should remain a dot");

const full = Array.from({ length: MAX_STROKES_PER_AUTHOR }, (_, slot) => line(slot));
assert.equal(availableSlot(full, "alice"), null);
assert.equal(availableSlot(full.filter((stroke) => stroke.slot !== 17), "alice"), 17, "undo/clear should free storage for new strokes");
assert.equal(availableSlot(full, "bob"), 0, "one student reaching their limit must not block another");
assert.equal(authorHue("alice"), authorHue("alice"));
assert.notEqual(authorHue("alice"), authorHue("bob"));

const overlapping = [line(), line(1, { authorId: "bob", id: "bob_1", createdAt: 2000 })];
assert.equal(hitTestStroke(overlapping, { x: 150, y: 103 })?.authorId, "bob", "inspect should show only the topmost matching author");
assert.equal(hitTestStroke(overlapping, { x: 150, y: 200 }), null);
assert.equal(hitTestStroke([line(0, { points: [{ x: 20, y: 20 }] })], { x: 22, y: 20 })?.authorId, "alice");
assert.deepEqual(sortStrokes([line(10), line(2)]).map((stroke) => stroke.slot), [2, 10], "batched server timestamps must preserve numerical slot order");
console.log("collaborative drawing compression, limits and author selection tests passed");
