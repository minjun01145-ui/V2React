import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH, hitTestStroke, inkColor, simplifyStroke, type DrawingPoint, type DrawingStroke } from "./model.ts";
import { drawLine, drawStrokes } from "./render.ts";
import styles from "./DrawingBoard.module.css";

export type DrawingTool = "pen" | "eraser" | "inspect";

interface Props {
  readonly strokes: readonly DrawingStroke[];
  readonly generation: number;
  readonly tool: DrawingTool;
  readonly canDraw: boolean;
  readonly canErase: boolean;
  readonly color: string;
  readonly width: number;
  readonly eraserAuthorId: string | null;
  readonly selectedAuthor: string | null;
  readonly onSelectAuthor: (authorId: string | null) => void;
  readonly onStroke: (points: readonly DrawingPoint[], width: number) => void;
  readonly onErase: (ids: readonly string[]) => Promise<unknown>;
}

const noMarks: ReadonlySet<string> = new Set();

export default function DrawingCanvas({ strokes, generation, tool, canDraw, canErase, color, width, eraserAuthorId, selectedAuthor, onSelectAuthor, onStroke, onErase }: Props) {
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const draft = useRef<{ pointerId: number; points: DrawingPoint[]; color: string; width: number } | null>(null);
  const erasing = useRef<number | null>(null);
  const markedRef = useRef<ReadonlySet<string>>(noMarks);
  const frame = useRef(0);
  const [size, setSize] = useState({ width: BOARD_WIDTH, height: BOARD_HEIGHT, ratio: 1 });
  const [marked, setMarkedState] = useState<ReadonlySet<string>>(noMarks);
  const setMarked = (next: ReadonlySet<string>) => { markedRef.current = next; setMarkedState(next); };

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

  const shown = marked.size ? strokes.filter((stroke) => !marked.has(stroke.id)) : strokes;

  useEffect(() => {
    const context = contextFor(base.current);
    if (context) drawStrokes(context, shown, selectedAuthor);
  }, [shown, selectedAuthor, size]);

  useEffect(() => {
    draft.current = null;
    erasing.current = null;
    window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    contextFor(overlay.current);
  }, [generation, tool, canDraw, canErase]);

  useEffect(() => setMarked(noMarks), [generation]);

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  const preview = () => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      const context = contextFor(overlay.current);
      if (context && draft.current) drawLine(context, draft.current.points, draft.current.color, draft.current.width);
    });
  };
  const pointAt = (event: Pick<PointerEvent, "clientX" | "clientY">): DrawingPoint => {
    const bounds = overlay.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(BOARD_WIDTH, (event.clientX - bounds.left) / bounds.width * BOARD_WIDTH)),
      y: Math.max(0, Math.min(BOARD_HEIGHT, (event.clientY - bounds.top) / bounds.height * BOARD_HEIGHT)),
    };
  };
  const markAt = (point: DrawingPoint) => {
    const own = strokes.filter((stroke) => stroke.authorId === eraserAuthorId && !markedRef.current.has(stroke.id));
    const hit = hitTestStroke(own, point, 10 * BOARD_WIDTH / size.width);
    if (hit) setMarked(new Set([...markedRef.current, hit.id]));
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
    if (event.button !== 0 || draft.current || erasing.current !== null) return;
    const point = pointAt(event);
    if (tool === "inspect") {
      const stroke = hitTestStroke(strokes, point, 8 * BOARD_WIDTH / size.width);
      onSelectAuthor(stroke ? (stroke.authorId === selectedAuthor ? null : stroke.authorId) : null);
      return;
    }
    if (tool === "eraser") {
      if (!canErase || !eraserAuthorId) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      erasing.current = event.pointerId;
      markAt(point);
      return;
    }
    if (!canDraw) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draft.current = { pointerId: event.pointerId, points: [point], color, width };
    preview();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (erasing.current === event.pointerId) { markAt(pointAt(event)); return; }
    append(event);
    if (draft.current) preview();
  };
  const finish = (event: PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    if (erasing.current === event.pointerId) {
      erasing.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const ids = [...markedRef.current];
      if (cancelled || !ids.length) setMarked(noMarks);
      else void onErase(ids).finally(() => setMarked(noMarks));
      return;
    }
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

  // One name tag per author, at the end of their latest stroke.
  const tags = new Map<string, DrawingStroke>();
  if (tool === "inspect") for (const stroke of shown) tags.set(stroke.authorId, stroke);
  const pixelWidth = Math.max(1, Math.round(size.width * size.ratio));
  const pixelHeight = Math.max(1, Math.round(size.height * size.ratio));
  const dataTool = tool === "inspect" ? "inspect" : tool === "eraser" ? (canErase ? "eraser" : "disabled") : canDraw ? "pen" : "disabled";
  return <div ref={surface} className={styles.surface}>
    <canvas ref={base} width={pixelWidth} height={pixelHeight} className={styles.canvas} aria-hidden="true" />
    <canvas ref={overlay} width={pixelWidth} height={pixelHeight} className={`${styles.canvas} ${styles.inputCanvas}`}
      data-tool={dataTool}
      aria-label={tool === "inspect" ? "선을 눌러 작성자 보기" : tool === "eraser" ? "지울 선 문지르기" : "함께 그리는 그림판"}
      onPointerDown={start} onPointerMove={move}
      onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)} />
    {[...tags].map(([authorId, stroke]) => {
      const end = stroke.points.at(-1)!;
      return <div key={authorId} className={styles.authorTag} data-dimmed={selectedAuthor !== null && selectedAuthor !== authorId}
        style={{ left: `${Math.min(85, end.x / BOARD_WIDTH * 100)}%`, top: `${Math.min(92, end.y / BOARD_HEIGHT * 100)}%` }}>
        <span className={styles.colorDot} style={{ background: inkColor(stroke.hue) }} />{stroke.label}
      </div>;
    })}
  </div>;
}
