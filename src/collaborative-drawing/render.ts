import { inkColor, type DrawingPoint, type DrawingStroke } from "./model.ts";

export function drawLine(context: CanvasRenderingContext2D, points: readonly DrawingPoint[], hue: number, width: number): void {
  const first = points[0];
  if (!first) return;
  context.strokeStyle = inkColor(hue);
  context.fillStyle = inkColor(hue);
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (points.length === 1) {
    context.arc(first.x, first.y, width / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.moveTo(first.x, first.y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }
}

export function drawStrokes(context: CanvasRenderingContext2D, strokes: readonly DrawingStroke[], selectedAuthor: string | null): void {
  for (const stroke of strokes) {
    context.globalAlpha = selectedAuthor && stroke.authorId !== selectedAuthor ? 0.18 : 1;
    drawLine(context, stroke.points, stroke.hue, stroke.width);
  }
  context.globalAlpha = 1;
}
