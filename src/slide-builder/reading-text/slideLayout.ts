import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../../slide-show/types.ts";
import { SLIDE_FONT_FAMILY } from "../../slide-canvas/fonts.ts";
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

/** Body text size on the slide (slide px per em), about what the teacher's own 본문 slides use. */
const TARGET_EM = 40;
/** Height of a PDF word box in em; must match how pdfPages measures words. */
const WORD_BOX_EM = 1.15;
/** Share of the slide width kept free on each side of the longest line. */
const SIDE_MARGIN = 0.04;
/** Meaning caption: white on black, just above or below the chunk box. */
const CAPTION_FONT_SIZE = 30;
const CAPTION_GAP = 6;
const CAPTION_MARGIN = 8;
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

export interface PageSize {
  readonly width: number;
  readonly height: number;
}

/** One zoomed 16:9 view of a page and the chunks (indexes into the page's chunk list) shown on it. */
export interface PageView {
  readonly crop: Box;
  readonly chunks: readonly number[];
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Zooms into the passage like a hand-made 본문 slide: body text at about TARGET_EM slide pixels
 * (less only when a full line would not fit across the slide). The view stays put while the
 * chunks advance and slides down the passage only when the next chunk falls outside it.
 */
export function planPageViews(chunks: readonly (readonly PdfWord[])[], passage: readonly PdfWord[], page: PageSize): PageView[] {
  const em = median(passage.map((word) => (word.y1 - word.y0) / WORD_BOX_EM));
  const block = union(passage);
  const scale = Math.max(SLIDE_WIDTH / page.width, SLIDE_HEIGHT / page.height,
    Math.min(TARGET_EM / em, SLIDE_WIDTH * (1 - 2 * SIDE_MARGIN) / block.width));
  const width = SLIDE_WIDTH / scale;
  const height = SLIDE_HEIGHT / scale;
  const lead = em * 1.6;
  const pad = em * 0.8;
  const passageFits = block.height + lead * 2 <= height;
  const baseX = block.width <= width ? block.x + block.width / 2 - width / 2 : block.x - em;

  const views: { crop: Box; chunks: number[] }[] = [];
  chunks.forEach((words, index) => {
    const box = union(words);
    const current = views[views.length - 1];
    if (current && box.x - pad >= current.crop.x && box.y - pad >= current.crop.y
      && box.x + box.width + pad <= current.crop.x + width && box.y + box.height + pad <= current.crop.y + height) {
      current.chunks.push(index);
      return;
    }
    let y = passageFits ? block.y + block.height / 2 - height / 2 : views.length === 0 ? block.y - lead : box.y - lead;
    // Do not scroll past the end of the passage, and always keep the chunk itself in view.
    if (!passageFits) y = Math.min(y, block.y + block.height + lead - height);
    y = Math.min(Math.max(y, box.y + box.height + pad - height), box.y - pad);
    const x = Math.min(Math.max(baseX, box.x + box.width + pad - width), box.x - pad);
    views.push({ crop: { x: clamp(x, 0, page.width - width), y: clamp(y, 0, page.height - height), width, height }, chunks: [index] });
  });
  return views;
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

export interface CaptionPlacement extends Box {
  readonly fontSize: number;
}

/** Rough rendered width: Hangul and other wide glyphs take about an em, Latin about half. */
function estimatedTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((sum, char) => sum + (char.charCodeAt(0) >= 0x1100 ? 1 : 0.58), 0) * fontSize;
}

/**
 * Where a chunk's meaning goes on the slide (slide units): under the chunk's last line when it
 * fits, otherwise above its first line, kept inside the slide.
 */
export function captionPlacement(boxes: readonly Box[], text: string): CaptionPlacement {
  const fontSize = CAPTION_FONT_SIZE;
  const maxWidth = SLIDE_WIDTH - CAPTION_MARGIN * 2;
  const natural = estimatedTextWidth(text, fontSize) + fontSize;
  const width = Math.min(maxWidth, Math.max(fontSize * 3, natural));
  const height = Math.ceil(natural / width) * fontSize * 1.2;
  const first = boxes[0]!;
  const last = boxes[boxes.length - 1]!;
  const below = last.y + last.height + CAPTION_GAP;
  const y = below + height <= SLIDE_HEIGHT - CAPTION_MARGIN ? below : Math.max(CAPTION_MARGIN, first.y - CAPTION_GAP - height);
  const x = Math.min(SLIDE_WIDTH - CAPTION_MARGIN - width, Math.max(CAPTION_MARGIN, first.x));
  return { x, y, width, height, fontSize };
}

/**
 * Fabric canvas JSON: the page image as a fixed backdrop plus the translucent chunk boxes and,
 * when given, the chunk's meaning as an ordinary (editable) text box.
 */
export function readingSlideCanvas(image: SlideImage, crop: Box, boxes: readonly Box[], meaning: string | null = null): string {
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
  const caption = meaning && boxes.length > 0 ? (() => {
    const place = captionPlacement(boxes, meaning);
    return [{
      type: "Textbox", originX: "left", originY: "top", left: place.x, top: place.y, width: place.width, text: meaning,
      fontSize: place.fontSize, fontWeight: 400, fontFamily: SLIDE_FONT_FAMILY, fill: "#ffffff", backgroundColor: "#000000",
      textAlign: "center", splitByGrapheme: true,
    }];
  })() : [];
  return JSON.stringify({ objects: [backdrop, ...marks, ...caption], background: "#ffffff" });
}
