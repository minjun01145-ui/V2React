import { useEffect, useRef, useState, type PointerEvent } from "react";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../../../../slide-show/types.ts";
import { INK_COLOR, INK_WIDTH, traceInkStroke, type InkStroke } from "./model.ts";
import styles from "./SlideInkLayer.module.css";

/**
 * Lets the teacher write on the current slide with a finger, pen or mouse. The marks live only
 * in this component: they are not saved or sent to students, and remounting (a new slide) clears them.
 */
export default function SlideInkLayer({ scale }: { readonly scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<InkStroke[]>([]);
  const drawing = useRef<{ readonly pointerId: number; readonly stroke: InkStroke } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const prepare = (): CanvasRenderingContext2D | null => {
    const context = canvasRef.current?.getContext("2d") ?? null;
    if (!context) return null;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
    context.strokeStyle = INK_COLOR;
    context.lineWidth = INK_WIDTH;
    context.lineCap = "round";
    context.lineJoin = "round";
    return context;
  };

  const redraw = (): void => {
    const canvas = canvasRef.current;
    const context = prepare();
    if (!canvas || !context) return;
    context.clearRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    for (const stroke of strokes.current) traceInkStroke(context, stroke);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(SLIDE_WIDTH * scale * ratio));
    canvas.height = Math.max(1, Math.round(SLIDE_HEIGHT * scale * ratio));
    redraw();
    // redraw reads the latest scale through prepare(); only a scale change resizes the bitmap.
  }, [scale]);

  const toSlide = (event: PointerEvent<HTMLCanvasElement> | globalThis.PointerEvent, rect: DOMRect) => ({
    x: (event.clientX - rect.left) * SLIDE_WIDTH / rect.width,
    y: (event.clientY - rect.top) * SLIDE_HEIGHT / rect.height,
  });

  const start = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (drawing.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke: InkStroke = [toSlide(event, event.currentTarget.getBoundingClientRect())];
    strokes.current.push(stroke);
    drawing.current = { pointerId: event.pointerId, stroke };
    const context = prepare();
    if (context) traceInkStroke(context, stroke);
    setHasInk(true);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = drawing.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const previous = current.stroke[current.stroke.length - 1]!;
    const added = event.nativeEvent.getCoalescedEvents?.().map((item) => toSlide(item, rect)) ?? [];
    current.stroke.push(...(added.length > 0 ? added : [toSlide(event, rect)]));
    const context = prepare();
    if (context) traceInkStroke(context, [previous, ...current.stroke.slice(-Math.max(1, added.length))]);
  };

  const end = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (drawing.current?.pointerId === event.pointerId) drawing.current = null;
  };

  const clear = (): void => {
    strokes.current = [];
    drawing.current = null;
    redraw();
    setHasInk(false);
  };

  return <div className={styles.layer}>
    <canvas ref={canvasRef} className={styles.canvas} aria-label="슬라이드 필기" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
    {hasInk ? <button type="button" className={styles.clear} onClick={clear}>필기 지우기</button> : null}
  </div>;
}
