/** Teacher-only pen marks over the projected slide. Kept in slide units so they survive resizes. */
export interface InkPoint {
  readonly x: number;
  readonly y: number;
}

export type InkStroke = InkPoint[];

export const INK_COLOR = "#ff3b5c";
export const INK_WIDTH = 6;

export function traceInkStroke(context: CanvasRenderingContext2D, stroke: readonly InkPoint[]): void {
  const [first, ...rest] = stroke;
  if (!first) return;
  context.beginPath();
  context.moveTo(first.x, first.y);
  // A single tap still leaves a dot thanks to the round line cap.
  for (const point of rest.length > 0 ? rest : [first]) context.lineTo(point.x, point.y);
  context.stroke();
}
