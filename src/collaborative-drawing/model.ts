export const BOARD_WIDTH = 1200;
export const BOARD_HEIGHT = 750;
export const MAX_STROKES_PER_AUTHOR = 80;
export const MAX_STROKE_POINTS = 192;
export const MAX_PENDING_STROKES = 8;
export const DRAWING_BATCH_MS = 800;
export const BRUSH_WIDTHS = [1, 2, 3, 6, 10] as const;
export const INK_COLORS = [
  { value: "#1f2430", label: "검정" }, { value: "#e5484d", label: "빨강" }, { value: "#f76b15", label: "주황" },
  { value: "#f5b400", label: "노랑" }, { value: "#30a46c", label: "초록" }, { value: "#0ea5e9", label: "하늘" },
  { value: "#2563eb", label: "파랑" }, { value: "#7c3aed", label: "보라" }, { value: "#e93d82", label: "분홍" },
  { value: "#8d5a3b", label: "갈색" },
] as const;

export interface DrawingScope {
  readonly roomId: string;
  readonly boardId: string;
}

export interface DrawingAuthor {
  readonly id: string;
  readonly label: string;
}

export interface DrawingPoint {
  readonly x: number;
  readonly y: number;
}

export interface DrawingStroke {
  readonly id: string;
  readonly authorId: string;
  readonly slot: number;
  readonly label: string;
  readonly hue: number;
  /** Index into INK_COLORS; null draws in the author's own hue. */
  readonly color: number | null;
  readonly width: number;
  readonly points: readonly DrawingPoint[];
  readonly generation: number;
  readonly createdAt: number;
}

export function authorHue(id: string): number {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % 360;
}

export function inkColor(hue: number): string {
  return `hsl(${hue} 72% 42%)`;
}

export function strokeColor(stroke: Pick<DrawingStroke, "hue" | "color">): string {
  return stroke.color === null ? inkColor(stroke.hue) : INK_COLORS[stroke.color]!.value;
}

export function strokeId(authorId: string, slot: number): string {
  return `${authorId}_${slot}`;
}

export function availableSlot(strokes: readonly DrawingStroke[], authorId: string): number | null {
  const occupied = new Set(strokes.filter((stroke) => stroke.authorId === authorId).map((stroke) => stroke.slot));
  for (let slot = 0; slot < MAX_STROKES_PER_AUTHOR; slot++) if (!occupied.has(slot)) return slot;
  return null;
}

export function pointSegmentDistance(point: DrawingPoint, start: DrawingPoint, end: DrawingPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
}

// Iterative Ramer–Douglas–Peucker keeps corners without storing pointer events.
// Long strokes are simplified more until they fit one bounded record.
export function simplifyStroke(points: readonly DrawingPoint[]): readonly DrawingPoint[] {
  if (points.length <= 2) return points;
  let tolerance = 1.2;
  for (;;) {
    const keep = new Set([0, points.length - 1]);
    const segments: [number, number][] = [[0, points.length - 1]];
    while (segments.length) {
      const [first, last] = segments.pop()!;
      let farthest = -1;
      let distance = tolerance;
      for (let index = first + 1; index < last; index++) {
        const candidate = pointSegmentDistance(points[index]!, points[first]!, points[last]!);
        if (candidate > distance) { distance = candidate; farthest = index; }
      }
      if (farthest !== -1) {
        keep.add(farthest);
        segments.push([first, farthest], [farthest, last]);
      }
    }
    const simplified = [...keep].sort((a, b) => a - b).map((index) => points[index]!);
    if (simplified.length <= MAX_STROKE_POINTS) return simplified;
    tolerance *= 1.5;
  }
}

// Six digits per point, independent of the screen size; no JSON point objects.
export function packPoints(points: readonly DrawingPoint[]): string {
  return points.map((point) => [point.x / BOARD_WIDTH, point.y / BOARD_HEIGHT]
    .map((coordinate) => String(Math.round(Math.max(0, Math.min(1, coordinate)) * 999)).padStart(3, "0")).join("")).join("");
}

export function unpackPoints(value: unknown): readonly DrawingPoint[] | null {
  if (typeof value !== "string" || !/^(?:[0-9]{6}){1,192}$/.test(value)) return null;
  const points: DrawingPoint[] = [];
  for (let index = 0; index < value.length; index += 6) {
    points.push({ x: Number(value.slice(index, index + 3)) / 999 * BOARD_WIDTH, y: Number(value.slice(index + 3, index + 6)) / 999 * BOARD_HEIGHT });
  }
  return points;
}

export function parseStroke(id: string, value: unknown): DrawingStroke | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const { by, s, l, c, k, w, g, t } = raw;
  const points = unpackPoints(raw.p);
  if (typeof by !== "string" || !by || by.length > 128 || /[.#$\/[\]]/.test(by)
    || typeof s !== "number" || !Number.isInteger(s) || s < 0 || s >= MAX_STROKES_PER_AUTHOR || id !== strokeId(by, s)
    || typeof l !== "string" || !l.trim() || l.length > 40
    || typeof c !== "number" || !Number.isInteger(c) || c < 0 || c >= 360
    || (k !== undefined && (typeof k !== "number" || !Number.isInteger(k) || k < 0 || k >= INK_COLORS.length))
    || typeof w !== "number" || !(BRUSH_WIDTHS as readonly number[]).includes(w)
    || typeof g !== "number" || !Number.isSafeInteger(g) || g < 0
    || typeof t !== "number" || !Number.isSafeInteger(t) || t <= 0 || !points) return null;
  return { id, authorId: by, slot: s, label: l, hue: c, color: k === undefined ? null : k as number, width: w, points, generation: g, createdAt: t };
}

export function sortStrokes(strokes: readonly DrawingStroke[]): DrawingStroke[] {
  return [...strokes].sort((a, b) => a.createdAt - b.createdAt || a.authorId.localeCompare(b.authorId) || a.slot - b.slot);
}

export function hitTestStroke(strokes: readonly DrawingStroke[], point: DrawingPoint, tolerance = 8): DrawingStroke | null {
  for (let index = strokes.length - 1; index >= 0; index--) {
    const stroke = strokes[index]!;
    const radius = tolerance + stroke.width / 2;
    if (stroke.points.length === 1 && Math.hypot(point.x - stroke.points[0]!.x, point.y - stroke.points[0]!.y) <= radius) return stroke;
    for (let segment = 1; segment < stroke.points.length; segment++) {
      if (pointSegmentDistance(point, stroke.points[segment - 1]!, stroke.points[segment]!) <= radius) return stroke;
    }
  }
  return null;
}
