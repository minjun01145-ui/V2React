import "../fabricSetup.ts";
import type { Canvas, FabricObject, Transform, TPointerEvent } from "fabric";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../../slide-show/types.ts";
import { computeSnap, snapEdge, type SnapBox, type SnapGap, type SnapLine } from "./computeSnap.ts";

/** Guides appear only inside this many screen pixels, so they feel the same at any zoom. */
const THRESHOLD_PX = 6;
const GUIDE_COLOR = "#FF3EA5";
/** Length of the tick that closes an even-spacing segment, in screen pixels. */
const GAP_TICK_PX = 10;

interface SnapState {
  readonly moving: FabricObject;
  readonly targets: readonly SnapBox[];
  lines: readonly SnapLine[];
  gaps: readonly SnapGap[];
}

const SLIDE_BOUNDS: SnapBox = { left: 0, top: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT };

function boxOf(object: FabricObject): SnapBox {
  const { left, top, width, height } = object.getBoundingRect();
  return { left, top, width, height };
}

/** Objects the moving box aligns to: everything visible except itself and the template's ornaments. */
function alignTargets(canvas: Canvas, moving: FabricObject): readonly SnapBox[] {
  return canvas.getObjects()
    .filter((object) => object.visible !== false && object !== moving && !object.isDescendantOf(moving) && !object.get("data")?.templateDecoration)
    .map(boxOf);
}

function snappingDisabled(event: TPointerEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

/** The edge the handle drags: "left"/"right"/"top"/"bottom", or null for a handle that keeps the ratio. */
function movingEdge(action: string, corner: string): "left" | "right" | "top" | "bottom" | null {
  if (action === "scale") return null;
  const x = corner === "ml" || corner === "tl" || corner === "bl" ? "left" : corner === "mr" || corner === "tr" || corner === "br" ? "right" : null;
  const y = corner === "mt" || corner === "tl" || corner === "tr" ? "top" : corner === "mb" || corner === "bl" || corner === "br" ? "bottom" : null;
  if (action === "scaleY") return y;
  return x;
}

/**
 * Moves the dragged edge onto a line without moving the opposite edge: the anchor of the handle stays
 * where it is and only the box length along the axis changes.
 */
function applyResizeSnap(moving: FabricObject, transform: Transform, edge: "left" | "right" | "top" | "bottom", delta: number): void {
  const box = moving.getBoundingRect();
  const axis = edge === "left" || edge === "right" ? "x" : "y";
  const anchor = moving.getPositionByOrigin(transform.originX, transform.originY);
  const currentEdge = axis === "x" ? (edge === "left" ? box.left : box.left + box.width) : (edge === "top" ? box.top : box.top + box.height);
  const desiredLength = Math.abs(currentEdge + delta - (axis === "x" ? anchor.x : anchor.y));
  const strokeWidth = moving.strokeUniform ? moving.strokeWidth : 0;
  const base = (axis === "x" ? moving.width : moving.height) + (moving.strokeUniform ? 0 : moving.strokeWidth);
  const size = Math.max((desiredLength - strokeWidth) / (base * (axis === "x" ? moving.scaleX : moving.scaleY)), 0.001);
  // Text boxes resize their box, other objects their scale; both keep the text and the stroke crisp.
  if (transform.action === "resizing") moving.set({ width: base * size });
  else moving.set(axis === "x" ? { scaleX: moving.scaleX * size } : { scaleY: moving.scaleY * size });
  moving.setCoords();
  moving.setPositionByOrigin(anchor, transform.originX, transform.originY);
  moving.setCoords();
}

/**
 * Magnetic alignment while dragging or resizing objects, with the guide lines drawn over the slide.
 * Returns the disposer that removes the listeners again.
 */
export function attachSnapping(canvas: Canvas): () => void {
  let state: SnapState | null = null;

  const threshold = (): number => THRESHOLD_PX / canvas.getZoom();
  const clear = (): void => {
    if (!state) return;
    state = null;
    // The guides are an overlay of the current frame, so repaint now: a deferred render may not
    // arrive (a hidden or occluded window produces no animation frame) and would leave them behind.
    canvas.renderAll();
  };

  const start = ({ e, transform }: { readonly e: TPointerEvent; readonly transform: Transform }): void => {
    state = null;
    if (snappingDisabled(e)) return;
    state = { moving: transform.target, targets: alignTargets(canvas, transform.target), lines: [], gaps: [] };
  };

  const snapMove = ({ e, transform }: { readonly e: TPointerEvent; readonly transform: Transform }): void => {
    if (!state || state.moving !== transform.target) return;
    if (snappingDisabled(e)) { clear(); return; }
    // Fabric set left/top just before firing this event; measure the box they produce, not the previous one.
    transform.target.setCoords();
    const moving = boxOf(transform.target);
    const result = computeSnap(moving, state.targets, SLIDE_BOUNDS, threshold());
    transform.target.set({ left: transform.target.left + result.offsetX, top: transform.target.top + result.offsetY });
    transform.target.setCoords();
    state.lines = result.lines;
    state.gaps = result.gaps;
  };

  const snapResize = ({ e, transform }: { readonly e: TPointerEvent; readonly transform: Transform }): void => {
    if (!state || state.moving !== transform.target) return;
    state.lines = [];
    state.gaps = [];
    const edge = movingEdge(transform.action ?? "", transform.corner);
    // A rotated or mirrored object has no box edge that a scale change can move straight along.
    if (!edge || (transform.target.angle ?? 0) % 360 !== 0 || transform.target.flipX || transform.target.flipY || snappingDisabled(e)) return;
    transform.target.setCoords();
    const box = transform.target.getBoundingRect();
    const axis = edge === "left" || edge === "right" ? "x" : "y";
    const position = axis === "x" ? (edge === "left" ? box.left : box.left + box.width) : (edge === "top" ? box.top : box.top + box.height);
    const snap = snapEdge(box, position, state.targets, SLIDE_BOUNDS, axis, threshold());
    if (!snap) return;
    applyResizeSnap(transform.target, transform, edge, snap.delta);
    state.lines = [snap];
  };

  const draw = ({ ctx }: { readonly ctx: CanvasRenderingContext2D }): void => {
    // Only the slide itself: the upper canvas (and any export render) must stay free of guides.
    if (!state || ctx !== canvas.getContext()) return;
    const zoom = canvas.getZoom();
    const [a, b, c, d, e, f] = canvas.viewportTransform;
    ctx.save();
    ctx.transform(a, b, c, d, e, f);
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1 / zoom;
    for (const line of state.lines) {
      ctx.beginPath();
      if (line.axis === "x") { ctx.moveTo(line.position, line.start); ctx.lineTo(line.position, line.end); }
      else { ctx.moveTo(line.start, line.position); ctx.lineTo(line.end, line.position); }
      ctx.stroke();
    }
    const tick = GAP_TICK_PX / zoom;
    for (const gap of state.gaps) {
      for (const [from, to] of gap.spans) {
        ctx.beginPath();
        if (gap.axis === "x") {
          ctx.moveTo(from, gap.cross);
          ctx.lineTo(to, gap.cross);
          ctx.moveTo(from, gap.cross - tick / 2); ctx.lineTo(from, gap.cross + tick / 2);
          ctx.moveTo(to, gap.cross - tick / 2); ctx.lineTo(to, gap.cross + tick / 2);
        } else {
          ctx.moveTo(gap.cross, from);
          ctx.lineTo(gap.cross, to);
          ctx.moveTo(gap.cross - tick / 2, from); ctx.lineTo(gap.cross + tick / 2, from);
          ctx.moveTo(gap.cross - tick / 2, to); ctx.lineTo(gap.cross + tick / 2, to);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const disposers = [
    canvas.on("before:transform", start),
    canvas.on("object:moving", snapMove),
    canvas.on("object:scaling", snapResize),
    canvas.on("object:resizing", snapResize),
    canvas.on("object:modified", clear),
    canvas.on("mouse:up", clear),
    canvas.on("after:render", draw),
  ];
  return () => {
    state = null;
    for (const dispose of disposers) dispose();
  };
}
