import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH, hitTestStroke, inkColor, simplifyStroke, type DrawingPoint, type DrawingStroke } from "./model.ts";
import { drawLine, drawStrokes } from "./render.ts";
import styles from "./DrawingBoard.module.css";

interface Props {
  readonly strokes: readonly DrawingStroke[];
  readonly generation: number;
  readonly canDraw: boolean;
  readonly inspecting: boolean;
  readonly hue: number;
  readonly width: number;
  readonly selectedAuthor: string | null;
  readonly onStroke: (points: readonly DrawingPoint[], width: number) => void;
}

export default function DrawingCanvas({ strokes, generation, canDraw, inspecting, hue, width, selectedAuthor, onStroke }: Props) {
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const draft = useRef<{ pointerId: number; points: DrawingPoint[]; hue: number; width: number } | null>(null);
  const frame = useRef(0);
  const [size, setSize] = useState({ width: BOARD_WIDTH, height: BOARD_HEIGHT, ratio: 1 });
  const [selected, setSelected] = useState<{ stroke: DrawingStroke; point: DrawingPoint } | null>(null);

  useEffect(() => {
    const element = surface.current!;
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      setSize({ width: bounds.width, height: bounds.height, ratio: Math.min(window.devicePixelRatio || 1, 2) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const contextFor = (canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null => {
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.setTransform(canvas.width / BOARD_WIDTH, 0, 0, canvas.height / BOARD_HEIGHT, 0, 0);
    context.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    return context;
  };

  useEffect(() => {
    const context = contextFor(base.current);
    if (context) drawStrokes(context, strokes, selectedAuthor);
  }, [strokes, selectedAuthor, size]);

  useEffect(() => {
    draft.current = null;
    setSelected(null);
    window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    contextFor(overlay.current);
  }, [generation, inspecting, canDraw]);

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  const preview = () => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      const context = contextFor(overlay.current);
      if (context && draft.current) drawLine(context, draft.current.points, draft.current.hue, draft.current.width);
    });
  };
  const pointAt = (event: Pick<PointerEvent, "clientX" | "clientY">): DrawingPoint => {
    const bounds = overlay.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(BOARD_WIDTH, (event.clientX - bounds.left) / bounds.width * BOARD_WIDTH)),
      y: Math.max(0, Math.min(BOARD_HEIGHT, (event.clientY - bounds.top) / bounds.height * BOARD_HEIGHT)),
    };
  };
  const append = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = draft.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const point = pointAt(event);
    const last = current.points.at(-1)!;
    if (Math.hypot(point.x - last.x, point.y - last.y) < 1.5) return;
    if (current.points.length >= 4096) current.points = [...simplifyStroke(current.points)];
    current.points.push(point);
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || draft.current) return;
    const point = pointAt(event);
    if (inspecting) {
      const stroke = hitTestStroke(strokes, point, 8 * BOARD_WIDTH / size.width);
      setSelected(stroke ? { stroke, point } : null);
      return;
    }
    if (!canDraw) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draft.current = { pointerId: event.pointerId, points: [point], hue, width };
    preview();
  };
  const finish = (event: PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const current = draft.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!cancelled) append(event);
    draft.current = null;
    window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    contextFor(overlay.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled) onStroke(current.points, current.width);
  };

  const pixelWidth = Math.max(1, Math.round(size.width * size.ratio));
  const pixelHeight = Math.max(1, Math.round(size.height * size.ratio));
  const selectedStillExists = selected && strokes.some((stroke) => stroke.id === selected.stroke.id && stroke.generation === selected.stroke.generation);
  return <div ref={surface} className={styles.surface}>
    <canvas ref={base} width={pixelWidth} height={pixelHeight} className={styles.canvas} aria-hidden="true" />
    <canvas ref={overlay} width={pixelWidth} height={pixelHeight} className={`${styles.canvas} ${styles.inputCanvas}`}
      data-tool={inspecting ? "inspect" : canDraw ? "pen" : "disabled"}
      aria-label={inspecting ? "선을 눌러 작성자 보기" : "함께 그리는 그림판"}
      onPointerDown={start} onPointerMove={(event) => { append(event); if (draft.current) preview(); }}
      onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)} />
    {selectedStillExists ? <div className={styles.authorLabel} style={{ left: `${Math.min(80, selected.point.x / BOARD_WIDTH * 100)}%`, top: `${Math.min(90, selected.point.y / BOARD_HEIGHT * 100)}%` }}>
      <span className={styles.colorDot} style={{ background: inkColor(selected.stroke.hue) }} />{selected.stroke.label}
    </div> : null}
  </div>;
}
