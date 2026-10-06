import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../../slide-show/types.ts";
import type { PdfWord } from "./textMatching.ts";

/** Rectangle in PDF page units (or slide units for slide boxes). */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SlideImage {
  readonly src: string;
  /** Pixel size of the encoded image. */
  readonly width: number;
  readonly height: number;
}

const SLIDE_RATIO = SLIDE_WIDTH / SLIDE_HEIGHT;
/** Space kept around the text block, as a share of its larger side. */
const CROP_MARGIN = 0.1;
const BOX_FILL = "rgba(255,0,0,0.15)";
const BOX_STROKE = "#5b9bd5";

function union(words: readonly PdfWord[]): Box {
  const x0 = Math.min(...words.map((word) => word.x0));
  const y0 = Math.min(...words.map((word) => word.y0));
  return { x: x0, y: y0, width: Math.max(...words.map((word) => word.x1)) - x0, height: Math.max(...words.map((word) => word.y1)) - y0 };
}

function sameLine(a: PdfWord, b: PdfWord): boolean {
  return Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) < (a.y1 - a.y0) / 2;
}

/**
 * The matched words plus their neighbours on the same text lines, so a crop shows whole lines
 * of the passage even where the set leaves a word out.
 */
export function passageWords(matched: readonly PdfWord[], pageWords: readonly PdfWord[]): PdfWord[] {
  const result = new Set(matched);
  for (const word of matched) {
    const line = pageWords.filter((candidate) => sameLine(candidate, word)).sort((a, b) => a.x0 - b.x0);
    const gap = (word.y1 - word.y0) * 1.5;
    const start = line.indexOf(word);
    for (let index = start + 1; index < line.length && line[index]!.x0 - line[index - 1]!.x1 < gap; index += 1) result.add(line[index]!);
    for (let index = start - 1; index >= 0 && line[index + 1]!.x0 - line[index]!.x1 < gap; index -= 1) result.add(line[index]!);
  }
  return [...result];
}

/**
 * The part of the page that frames the given text with a margin: 16:9 whenever the page allows,
 * otherwise as close as possible without cutting the text (the slide then letterboxes it).
 */
export function cropAround(words: readonly PdfWord[], page: { readonly width: number; readonly height: number }): Box {
  const text = union(words);
  const margin = Math.max(text.width, text.height) * CROP_MARGIN;
  let width = Math.min(page.width, text.width + margin * 2);
  let height = Math.min(page.height, text.height + margin * 2);
  if (width / height > SLIDE_RATIO) height = Math.min(page.height, width / SLIDE_RATIO);
  else width = Math.min(page.width, height * SLIDE_RATIO);
  const centerX = text.x + text.width / 2;
  const centerY = text.y + text.height / 2;
  return {
    x: Math.min(page.width - width, Math.max(0, centerX - width / 2)),
    y: Math.min(page.height - height, Math.max(0, centerY - height / 2)),
    width,
    height,
  };
}

/** One padded box per text line the words cover, in PDF page units. */
export function lineBoxes(words: readonly PdfWord[]): Box[] {
  const lines: PdfWord[][] = [];
  for (const word of words) {
    const line = lines[lines.length - 1];
    const previous = line?.[line.length - 1];
    if (line && previous && word.x0 >= previous.x0 && sameLine(previous, word)) line.push(word);
    else lines.push([word]);
  }
  return lines.map((line) => {
    const box = union(line);
    const padX = box.height * 0.12;
    const padY = box.height * 0.1;
    return { x: box.x - padX, y: box.y - padY, width: box.width + padX * 2, height: box.height + padY * 2 };
  });
}

/** Where the cropped page image sits on the slide: scaled to fit and centred. */
export function imageFrame(crop: Box): Box & { readonly scale: number } {
  const scale = Math.min(SLIDE_WIDTH / crop.width, SLIDE_HEIGHT / crop.height);
  const width = crop.width * scale;
  const height = crop.height * scale;
  return { x: (SLIDE_WIDTH - width) / 2, y: (SLIDE_HEIGHT - height) / 2, width, height, scale };
}

export function toSlideBox(box: Box, crop: Box): Box {
  const frame = imageFrame(crop);
  return { x: frame.x + (box.x - crop.x) * frame.scale, y: frame.y + (box.y - crop.y) * frame.scale, width: box.width * frame.scale, height: box.height * frame.scale };
}

/** Fabric canvas JSON: the page image as a fixed backdrop plus the translucent chunk boxes. */
export function readingSlideCanvas(image: SlideImage, crop: Box, boxes: readonly Box[]): string {
  const frame = imageFrame(crop);
  const backdrop = {
    type: "Image", originX: "left", originY: "top", left: frame.x, top: frame.y, src: image.src,
    width: image.width, height: image.height, scaleX: frame.width / image.width, scaleY: frame.height / image.height,
    selectable: false, evented: false,
  };
  const marks = boxes.map((box) => ({
    type: "Rect", originX: "left", originY: "top", left: box.x, top: box.y, width: box.width, height: box.height,
    fill: BOX_FILL, stroke: BOX_STROKE, strokeWidth: 2, strokeUniform: true,
  }));
  return JSON.stringify({ objects: [backdrop, ...marks], background: "#ffffff" });
}
