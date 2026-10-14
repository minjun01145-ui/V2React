import { MAX_SLIDES, type Slide } from "../slide-show/types.ts";

/**
 * Deck-level edits as pure functions over slide JSON, so the AI helper can fix text or reorder
 * slides without loading each one into the Fabric canvas. The editor applies the result;
 * nothing here touches the canvas or Firestore.
 */

type CanvasObject = Record<string, unknown>;

/** The JSON of an empty slide, shared by new slides and slides the AI adds. */
export function emptySlideCanvas(background = "#ffffff"): string {
  return JSON.stringify({ objects: [], background });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseObjects(canvas: string): { readonly canvas: CanvasObject; readonly objects: unknown[] } {
  const parsed: unknown = JSON.parse(canvas);
  if (!isRecord(parsed) || (parsed.objects !== undefined && !Array.isArray(parsed.objects))) throw new Error("슬라이드 내용 형식이 올바르지 않습니다.");
  return { canvas: parsed, objects: parsed.objects ?? [] };
}

/** Every text box of a slide, in reading order (including the ones nested in groups). */
function eachText(objects: readonly unknown[], visit: (object: CanvasObject) => void): void {
  for (const item of objects) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item.objects)) eachText(item.objects, visit);
    if (typeof item.text === "string") visit(item);
  }
}

/**
 * Where every character of the original text ends up, -1 when a replacement removed it.
 * Character-level style runs are then kept only when they survive the replacement unchanged.
 */
function offsetMap(text: string, from: string, to: string): number[] {
  const map = Array.from({ length: text.length }, () => -1);
  let shift = 0;
  for (let index = 0; index < text.length;) {
    if (text.startsWith(from, index)) {
      shift += to.length - from.length;
      index += from.length;
      continue;
    }
    map[index] = index + shift;
    index += 1;
  }
  return map;
}

function isContiguousRun(map: readonly number[], start: number, end: number): boolean {
  return map[start]! >= 0 && map[end - 1]! >= 0 && map[end - 1]! - map[start]! === end - 1 - start;
}

/** Keeps the formatting runs that still line up after a length-changing replacement. */
function remapStyles(styles: unknown, map: readonly number[]): unknown {
  if (Array.isArray(styles)) {
    return styles.flatMap((run) => {
      if (!isRecord(run) || typeof run.start !== "number" || typeof run.end !== "number") return [run];
      if (!isContiguousRun(map, run.start, run.end)) return [];
      return [{ ...run, start: map[run.start]!, end: map[run.end - 1]! + 1 }];
    });
  }
  if (!isRecord(styles)) return styles;
  return Object.fromEntries(Object.entries(styles).flatMap(([line, characters]) => {
    if (!isRecord(characters)) return [[line, characters]];
    const kept = Object.entries(characters).flatMap(([character, style]) => {
      const index = map[Number(character)];
      return index === undefined || index < 0 ? [] : [[String(index), style]];
    });
    return kept.length ? [[line, Object.fromEntries(kept)]] : [];
  }));
}

function replaceInObject(object: CanvasObject, from: string, to: string, counted: { value: number }): void {
  if (typeof object.text !== "string" || !object.text.includes(from)) return;
  const text = object.text;
  counted.value += text.split(from).length - 1;
  // Newlines move text between style lines, which the run remap cannot follow; drop runs instead.
  const styles = text.includes("\n") || from.includes("\n") || to.includes("\n") ? undefined : object.styles;
  object.text = text.split(from).join(to);
  if (styles === undefined) return;
  const remapped = remapStyles(styles, offsetMap(text, from, to));
  if (remapped === undefined || remapped === null) delete object.styles;
  else object.styles = remapped;
}

/** Replaces every occurrence of `from` in one slide's text boxes; null when nothing matched. */
export function replaceSlideText(slide: Slide, from: string, to: string, limit = 300): { readonly slide: Slide; readonly count: number } | null {
  if (!from || slide.canvas.split(from).length - 1 > limit) return null;
  const { canvas, objects } = parseObjects(slide.canvas);
  const counted = { value: 0 };
  objects.forEach((object) => {
    if (!isRecord(object)) return;
    eachText([object], (text) => replaceInObject(text, from, to, counted));
  });
  if (counted.value === 0) return null;
  return { slide: { ...slide, canvas: JSON.stringify({ ...canvas, objects }) }, count: counted.value };
}

/** Inserts a blank slide after one-based slide number `after`, or at the end when omitted. */
export function insertSlide(slides: readonly Slide[], after: number | undefined, background: string | undefined): readonly Slide[] | null {
  if (slides.length >= MAX_SLIDES) return null;
  const index = after === undefined ? slides.length : Math.min(slides.length, Math.max(0, after));
  return [...slides.slice(0, index), { id: crypto.randomUUID(), canvas: emptySlideCanvas(background), engine: null }, ...slides.slice(index)];
}

/** Copies one-based slide number `slide` right behind it. */
export function duplicateSlideAt(slides: readonly Slide[], slide: number): readonly Slide[] | null {
  const source = slides[slide - 1];
  if (!source || slides.length >= MAX_SLIDES) return null;
  return [...slides.slice(0, slide), { ...source, id: crypto.randomUUID() }, ...slides.slice(slide)];
}

/** Removes one-based slide number `slide`; the last remaining slide stays. */
export function removeSlideAt(slides: readonly Slide[], slide: number): readonly Slide[] | null {
  if (slides.length <= 1 || !slides[slide - 1]) return null;
  return slides.filter((_, index) => index !== slide - 1);
}

/** Moves one-based slide number `from` to one-based position `to`. */
export function moveSlideTo(slides: readonly Slide[], from: number, to: number): readonly Slide[] | null {
  const source = slides[from - 1];
  const target = Math.min(slides.length, Math.max(1, to));
  if (!source || target === from) return null;
  const next = [...slides];
  next.splice(from - 1, 1);
  next.splice(target - 1, 0, source);
  return next;
}

/**
 * The text of one slide, in reading order, for the AI's deck summary. Only text boxes are
 * included; formatting and layout stay in the canvas JSON.
 */
export function slideTexts(canvas: string): readonly string[] {
  try {
    const { objects } = parseObjects(canvas);
    const texts: string[] = [];
    eachText(objects, (object) => {
      if (typeof object.text === "string" && object.text.trim()) texts.push(object.text.trim());
    });
    return texts;
  } catch {
    return [];
  }
}

/** The same slide with another background colour; every other canvas field is kept. */
export function withSlideBackground(slide: Slide, color: string): Slide {
  const { canvas } = parseObjects(slide.canvas);
  return { ...slide, canvas: JSON.stringify({ ...canvas, background: color }) };
}
