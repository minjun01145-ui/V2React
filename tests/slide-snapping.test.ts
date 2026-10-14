import assert from "node:assert/strict";
import { computeSnap, snapEdge, type SnapBox } from "../src/slide-canvas/snapping/computeSnap.ts";

const bounds: SnapBox = { left: 0, top: 0, width: 1280, height: 720 };
const threshold = 6;

// A box whose middle already sits on the slide's horizontal centre needs no correction.
const centred = computeSnap({ left: 540, top: 200, width: 200, height: 100 }, [], bounds, threshold);
assert.equal(centred.offsetX, 0, "centre alignment needs no correction when the box is already centred");
assert.ok(centred.lines.some((line) => line.axis === "x" && line.position === 640), "the slide centre line is shown");

const leftOfCentre = computeSnap({ left: 584, top: 200, width: 100, height: 100 }, [], bounds, threshold);
assert.equal(leftOfCentre.offsetX, 6, "a box whose centre is 6 units left of the slide centre is pulled onto it");

// Beyond the threshold nothing happens, so dragging further always breaks away.
const outside = computeSnap({ left: 580, top: 200, width: 100, height: 100 }, [], bounds, threshold);
assert.equal(outside.offsetX, 0, "no snapping outside the threshold");
assert.deepEqual(outside.lines, [], "no guides outside the threshold");

// Slide edges snap too (left edge of the board is 0, the right edge is 1280).
const nearLeftEdge = computeSnap({ left: 4, top: 300, width: 100, height: 100 }, [], bounds, threshold);
assert.equal(nearLeftEdge.offsetX, -4, "the moving box's left edge snaps to the slide edge");
const nearRightEdge = computeSnap({ left: 1176, top: 300, width: 100, height: 100 }, [], bounds, threshold);
assert.equal(nearRightEdge.offsetX, 4, "the moving box's right edge snaps to the slide edge");

// Another object's edges and middle attract, and only the nearest candidate per axis wins.
const other: SnapBox = { left: 400, top: 300, width: 200, height: 100 };
const alignedToOther = computeSnap({ left: 396, top: 500, width: 100, height: 100 }, [other], bounds, threshold);
assert.equal(alignedToOther.offsetX, 4, "a neighbouring object's left edge wins the x axis");
assert.ok(alignedToOther.lines.some((line) => line.axis === "x" && line.position === 400), "the guide is drawn on the other object's edge");
assert.equal(alignedToOther.offsetY, 500 - 500, "the axes are independent");

const middleOfOther = computeSnap({ left: 447, top: 500, width: 100, height: 100 }, [other], bounds, threshold);
assert.equal(middleOfOther.offsetX, 3, "a box centre snaps to the other object's centre");

// Even spacing: two objects in a row at 100 and 300 pull a third to 500.
const row: readonly SnapBox[] = [
  { left: 100, top: 300, width: 100, height: 100 },
  { left: 300, top: 300, width: 100, height: 100 },
];
const even = computeSnap({ left: 496, top: 300, width: 100, height: 100 }, row, bounds, threshold);
assert.equal(even.offsetX, 4, "the third box lands on the even spacing");
assert.equal(even.gaps.length, 1, "even spacing is reported as a gap");
assert.deepEqual(even.gaps[0]?.spans, [[200, 300], [400, 500]], "both gaps are drawn");

const uneven = computeSnap({ left: 600, top: 300, width: 100, height: 100 }, row, bounds, threshold);
assert.equal(uneven.offsetX, 0, "no even-spacing snap when the box is far from the pattern");

// Rotated objects use their outer box, which is what the callers measure.
const rotatedOuterBox: SnapBox = { left: 640, top: 0, width: 160, height: 160 };
const rotated = computeSnap({ left: 636, top: 60, width: 40, height: 40 }, [rotatedOuterBox], bounds, threshold);
assert.ok(rotated.offsetX !== 0, "the outer box of a rotated object still offers alignment");

// A single edge on a single axis is exposed for the resize handles.
const edge = snapEdge({ left: 200, top: 100, width: 196, height: 100 }, 396, [other], bounds, "x", threshold);
assert.equal(edge?.delta, 4, "the dragged right edge is measured against the other object's left edge");
assert.equal(edge?.position, 400, "the guide sits on the line the edge sticks to");
assert.equal(snapEdge({ left: 0, top: 100, width: 200, height: 100 }, 380, [other], bounds, "x", threshold), null, "an edge further than the threshold from every line does not snap");

console.log("slide snapping tests passed");
