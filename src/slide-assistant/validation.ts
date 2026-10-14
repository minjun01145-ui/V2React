import type { ArrangeAction, AssistantOperation, TextAlign } from "./types.ts";

/*
 * The AI's reply is untrusted input: the server checks it to protect itself, and the browser
 * checks it again before anything reaches Fabric. Operations whose fields do not fit are dropped
 * and counted, so one bad entry never discards the rest of the reply.
 */

const ID_PATTERN = /^o\d{1,3}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MAX_OPERATIONS = 40;
const MAX_MESSAGE = 1_200;
const MAX_TEXT = 1000;
const MAX_QUERY = 80;
const MAX_SLIDES = 300;
const ALIGNMENTS: readonly TextAlign[] = ["left", "center", "right"];
const ARRANGEMENTS: readonly ArrangeAction[] = ["front", "forward", "backward", "back"];
const SHAPES = new Set(["rect", "circle", "triangle"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bounded(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(max, Math.max(min, value))) : undefined;
}

function requiredBounded(value: unknown, min: number, max: number): number | null {
  return bounded(value, min, max) ?? null;
}

function color(value: unknown): string | null {
  return typeof value === "string" && COLOR_PATTERN.test(value) ? value.toLowerCase() : null;
}

/** Nullable fields keep `null` (meaning "none") apart from "not given". */
function optionalNullableColor(value: Record<string, unknown>, key: string): string | null | undefined | false {
  if (!(key in value)) return undefined;
  if (value[key] === null) return null;
  return color(value[key]) ?? false;
}

function text(value: unknown, max = MAX_TEXT): string | null {
  return typeof value === "string" && value.trim() ? value.slice(0, max) : null;
}

function align(value: unknown): TextAlign | null {
  return ALIGNMENTS.find((candidate) => candidate === value) ?? null;
}

function arrange(value: unknown): ArrangeAction | null {
  return ARRANGEMENTS.find((candidate) => candidate === value) ?? null;
}

function slideNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_SLIDES ? value : null;
}

function slideTarget(value: unknown): number | "all" | null {
  return value === "all" ? "all" : slideNumber(value);
}

function fontFamily(value: unknown, fonts: readonly string[]): string | null {
  return typeof value === "string" && fonts.includes(value) ? value : null;
}

function optionalFontFamily(value: Record<string, unknown>, fonts: readonly string[]): string | undefined | false {
  return !("fontFamily" in value) ? undefined : fontFamily(value.fontFamily, fonts) ?? false;
}

function styleOperation(raw: Record<string, unknown>, fonts: readonly string[]): AssistantOperation | null {
  const fill = "fill" in raw ? color(raw.fill) : undefined;
  const background = optionalNullableColor(raw, "background");
  const fontSize = "fontSize" in raw ? requiredBounded(raw.fontSize, 8, 240) : undefined;
  const textAlign = "textAlign" in raw ? align(raw.textAlign) : undefined;
  const opacity = "opacity" in raw ? requiredBounded(raw.opacity, 0.1, 1) : undefined;
  const family = optionalFontFamily(raw, fonts);
  if (fill === null || background === false || fontSize === null || textAlign === null || opacity === null || family === false) return null;
  const operation: AssistantOperation = {
    op: "style", id: String(raw.id),
    ...(fill === undefined ? {} : { fill }),
    ...(fontSize === undefined ? {} : { fontSize }),
    ...(raw.bold === true ? { bold: true } : {}),
    ...(textAlign === undefined ? {} : { textAlign }),
    ...(family === undefined ? {} : { fontFamily: family }),
    ...(background === undefined ? {} : { background }),
    ...(opacity === undefined ? {} : { opacity }),
  };
  return Object.keys(operation).length > 2 ? operation : null;
}

/** Validates one operation against the same limits the server used; null when it does not fit. */
export function parseAssistantOperation(raw: unknown, fonts: readonly string[]): AssistantOperation | null {
  if (!isRecord(raw) || typeof raw.op !== "string") return null;
  switch (raw.op) {
    case "move": {
      const left = requiredBounded(raw.left, -1280, 2560);
      const top = requiredBounded(raw.top, -720, 1440);
      if (left === null || top === null || !ID_PATTERN.test(String(raw.id))) return null;
      return { op: "move", id: String(raw.id), left, top };
    }
    case "resize": {
      const width = requiredBounded(raw.width, 10, 2560);
      if (width === null || !ID_PATTERN.test(String(raw.id))) return null;
      const height = raw.height === undefined ? undefined : requiredBounded(raw.height, 10, 1440);
      if (height === null) return null;
      return { op: "resize", id: String(raw.id), width, ...(height === undefined ? {} : { height }) };
    }
    case "style": {
      if (!ID_PATTERN.test(String(raw.id))) return null;
      return styleOperation(raw, fonts);
    }
    case "arrange": {
      const action = arrange(raw.action);
      if (!action || !ID_PATTERN.test(String(raw.id))) return null;
      return { op: "arrange", id: String(raw.id), action };
    }
    case "setText": {
      const value = text(raw.text);
      if (!value || !ID_PATTERN.test(String(raw.id))) return null;
      return { op: "setText", id: String(raw.id), text: value };
    }
    case "delete":
      return ID_PATTERN.test(String(raw.id)) ? { op: "delete", id: String(raw.id) } : null;
    case "addText": {
      const value = text(raw.text);
      const left = requiredBounded(raw.left, -1280, 2560);
      const top = requiredBounded(raw.top, -720, 1440);
      const width = requiredBounded(raw.width ?? 600, 20, 2560);
      const fill = "fill" in raw ? color(raw.fill) : undefined;
      const background = optionalNullableColor(raw, "background");
      const fontSize = "fontSize" in raw ? requiredBounded(raw.fontSize, 8, 240) : undefined;
      const textAlign = "textAlign" in raw ? align(raw.textAlign) : undefined;
      const family = optionalFontFamily(raw, fonts);
      if (!value || left === null || top === null || width === null || fill === null || background === false
        || fontSize === null || textAlign === null || family === false) return null;
      return {
        op: "addText", text: value, left, top, width,
        ...(fontSize === undefined ? {} : { fontSize }),
        ...(fill === undefined ? {} : { fill }),
        ...(raw.bold === true ? { bold: true } : {}),
        ...(textAlign === undefined ? {} : { textAlign }),
        ...(family === undefined ? {} : { fontFamily: family }),
        ...(background === undefined ? {} : { background }),
      };
    }
    case "addShape": {
      const left = requiredBounded(raw.left, -1280, 2560);
      const top = requiredBounded(raw.top, -720, 1440);
      const width = requiredBounded(raw.width, 10, 2560);
      const height = requiredBounded(raw.height, 10, 1440);
      const fill = "fill" in raw ? color(raw.fill) : undefined;
      if (!SHAPES.has(String(raw.shape)) || left === null || top === null || width === null || height === null || fill === null) return null;
      return { op: "addShape", shape: String(raw.shape) as "rect" | "circle" | "triangle", left, top, width, height, ...(fill === undefined ? {} : { fill }) };
    }
    case "addImage": {
      const query = text(raw.query, MAX_QUERY);
      const left = raw.left === undefined ? undefined : requiredBounded(raw.left, -1280, 2560);
      const top = raw.top === undefined ? undefined : requiredBounded(raw.top, -720, 1440);
      const width = raw.width === undefined ? undefined : requiredBounded(raw.width, 20, 2560);
      if (!query || left === null || top === null || width === null) return null;
      return { op: "addImage", query: query.trim(), ...(left === undefined ? {} : { left }), ...(top === undefined ? {} : { top }), ...(width === undefined ? {} : { width }) };
    }
    case "background": {
      const value = color(raw.color);
      if (!value) return null;
      if (!("slide" in raw)) return { op: "background", color: value };
      const slide = slideTarget(raw.slide);
      return slide === null ? null : { op: "background", color: value, slide };
    }
    case "replaceText": {
      const from = text(raw.from, 200);
      const to = typeof raw.to === "string" ? raw.to.slice(0, 200) : null;
      const slides = slideTarget(raw.slides);
      if (!from || to === null || slides === null) return null;
      return { op: "replaceText", from, to, slides };
    }
    case "addSlide": {
      const after = raw.after === undefined ? undefined : slideNumber(raw.after);
      const background = "background" in raw ? color(raw.background) : undefined;
      if (after === null || background === null) return null;
      return { op: "addSlide", ...(after === undefined ? {} : { after }), ...(background === undefined ? {} : { background }) };
    }
    case "duplicateSlide": {
      const slide = slideNumber(raw.slide);
      return slide === null ? null : { op: "duplicateSlide", slide };
    }
    case "deleteSlide": {
      const slide = slideNumber(raw.slide);
      return slide === null ? null : { op: "deleteSlide", slide };
    }
    case "moveSlide": {
      const from = slideNumber(raw.from);
      const to = slideNumber(raw.to);
      return from === null || to === null ? null : { op: "moveSlide", from, to };
    }
    default: return null;
  }
}

export interface ParsedAssistantReply {
  readonly message: string;
  readonly operations: readonly AssistantOperation[];
  /** Operations the browser refused; the panel tells the teacher instead of failing the whole reply. */
  readonly dropped: number;
}

/** Checks the shape of the server's reply and every operation before the editor applies them. */
export function parseAssistantReply(value: unknown, fonts: readonly string[]): ParsedAssistantReply {
  if (!isRecord(value) || !Array.isArray(value.operations) || value.operations.length > MAX_OPERATIONS) throw new Error("AI 응답을 확인하지 못했습니다.");
  const operations = value.operations.flatMap((raw) => {
    const operation = parseAssistantOperation(raw, fonts);
    return operation ? [operation] : [];
  });
  return {
    message: typeof value.message === "string" ? value.message.trim().slice(0, MAX_MESSAGE) : "",
    operations,
    dropped: value.operations.length - operations.length,
  };
}
