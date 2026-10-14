/** Magnet snapping maths for the slide editor. Pure: no Fabric, no DOM, all values in slide units. */
export type SnapAxis = "x" | "y";

/** An axis-aligned box, e.g. an object's outer box or the slide board. */
export interface SnapBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A guide along `axis`: for "x" a vertical line at `position`, drawn from `start` to `end`. */
export interface SnapLine {
  readonly axis: SnapAxis;
  readonly position: number;
  readonly start: number;
  readonly end: number;
}

/** One edge's snap to a line, with the correction that puts the edge on it. */
export interface EdgeSnap extends SnapLine {
  readonly delta: number;
}

/** Equal spacing: gaps along `axis`, drawn side by side at `cross`. */
export interface SnapGap {
  readonly axis: SnapAxis;
  readonly cross: number;
  readonly spans: readonly (readonly [number, number])[];
}

export interface SnapResult {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly lines: readonly SnapLine[];
  readonly gaps: readonly SnapGap[];
}

interface Candidate {
  readonly delta: number;
  readonly line: SnapLine | null;
  readonly gap: SnapGap | null;
}

interface LineSource {
  readonly position: number;
  /** The object the line belongs to; null for a line of the slide board itself. */
  readonly box: SnapBox | null;
}

function otherAxis(axis: SnapAxis): SnapAxis {
  return axis === "x" ? "y" : "x";
}

function span(box: SnapBox, axis: SnapAxis): readonly [number, number] {
  return axis === "x" ? [box.left, box.left + box.width] : [box.top, box.top + box.height];
}

/** The middle of the band two boxes share on `axis`, or null when they do not overlap there. */
function sharedBand(a: SnapBox, b: SnapBox, axis: SnapAxis): number | null {
  const [aStart, aEnd] = span(a, axis);
  const [bStart, bEnd] = span(b, axis);
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return end > start ? (start + end) / 2 : null;
}

function lineSources(targets: readonly SnapBox[], bounds: SnapBox, axis: SnapAxis): readonly LineSource[] {
  const [boardStart, boardEnd] = span(bounds, axis);
  return [
    ...targets.flatMap((box) => {
      const [start, end] = span(box, axis);
      return [{ position: start, box }, { position: (start + end) / 2, box }, { position: end, box }];
    }),
    { position: boardStart, box: null },
    { position: (boardStart + boardEnd) / 2, box: null },
    { position: boardEnd, box: null },
  ];
}

/** The closest line to `position` (one edge of the moving box), or null when every line is too far. */
export function snapEdge(moving: SnapBox, position: number, targets: readonly SnapBox[], bounds: SnapBox, axis: SnapAxis, threshold: number): EdgeSnap | null {
  const across = otherAxis(axis);
  const [movingStart, movingEnd] = span(moving, across);
  let best: EdgeSnap | null = null;
  for (const source of lineSources(targets, bounds, axis)) {
    const delta = source.position - position;
    if (Math.abs(delta) > threshold || (best && Math.abs(best.delta) <= Math.abs(delta))) continue;
    const [sourceStart, sourceEnd] = span(source.box ?? bounds, across);
    best = { axis, position: source.position, start: Math.min(movingStart, sourceStart), end: Math.max(movingEnd, sourceEnd), delta };
  }
  return best;
}

/** The closest alignment among the moving box's own two edges and its middle. */
function alignEdges(moving: SnapBox, targets: readonly SnapBox[], bounds: SnapBox, axis: SnapAxis, threshold: number): Candidate | null {
  const [start, end] = span(moving, axis);
  let best: Candidate | null = null;
  for (const edge of [start, (start + end) / 2, end]) {
    const snap = snapEdge(moving, edge, targets, bounds, axis, threshold);
    if (snap && (!best || Math.abs(snap.delta) < Math.abs(best.delta))) best = { delta: snap.delta, line: snap, gap: null };
  }
  return best;
}

/** The closest place where the moving box keeps the distance two objects in the same row keep. */
function evenSpacing(moving: SnapBox, targets: readonly SnapBox[], axis: SnapAxis, threshold: number): Candidate | null {
  const across = otherAxis(axis);
  const cross = (span(moving, across)[0] + span(moving, across)[1]) / 2;
  const [movingStart, movingEnd] = span(moving, axis);
  let best: Candidate | null = null;
  for (const first of targets) {
    for (const second of targets) {
      if (first === second || sharedBand(moving, first, across) === null || sharedBand(moving, second, across) === null) continue;
      const [firstStart, firstEnd] = span(first, axis);
      const [secondStart, secondEnd] = span(second, axis);
      const gap = secondStart - firstEnd;
      if (gap <= 0) continue;
      const placements: readonly { readonly delta: number; readonly movingGap: readonly [number, number] }[] = [
        { delta: firstStart - gap - movingEnd, movingGap: [firstStart - gap, firstStart] },
        { delta: secondEnd + gap - movingStart, movingGap: [secondEnd, secondEnd + gap] },
      ];
      for (const placement of placements) {
        if (Math.abs(placement.delta) > threshold || (best && Math.abs(best.delta) <= Math.abs(placement.delta))) continue;
        best = { delta: placement.delta, line: null, gap: { axis, cross, spans: [[firstEnd, secondStart], placement.movingGap] } };
      }
    }
  }
  return best;
}

/**
 * Snaps one moving box: how far it still has to move, plus the guides for what it sticks to.
 * At most one candidate per axis, the nearest of the slide lines, the other objects and even spacing.
 */
export function computeSnap(moving: SnapBox, targets: readonly SnapBox[], bounds: SnapBox, threshold: number): SnapResult {
  let offsetX = 0;
  let offsetY = 0;
  const lines: SnapLine[] = [];
  const gaps: SnapGap[] = [];
  for (const axis of ["x", "y"] as const) {
    const candidates = [alignEdges(moving, targets, bounds, axis, threshold), evenSpacing(moving, targets, axis, threshold)];
    const best = candidates.reduce<Candidate | null>((winner, candidate) => !candidate || (winner && Math.abs(winner.delta) <= Math.abs(candidate.delta)) ? winner : candidate, null);
    if (!best) continue;
    if (axis === "x") offsetX = best.delta;
    else offsetY = best.delta;
    if (best.line) lines.push(best.line);
    if (best.gap) gaps.push(best.gap);
  }
  return { offsetX, offsetY, lines, gaps };
}
