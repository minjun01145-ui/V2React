import { getDocument, GlobalWorkerOptions, Util, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { encodeSlideImage, type EncodedImage } from "../../slide-canvas/imageFile.ts";
import type { Box } from "./slideLayout.ts";
import type { PdfWord } from "./textMatching.ts";

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PDF_BYTES = 300 * 1024 * 1024;
/** Rendered page crops are a little larger than the slide so text stays crisp on a projector. */
const IMAGE_MAX_WIDTH = 1600;
const IMAGE_MAX_HEIGHT = 900;

export interface PdfPageSize {
  readonly width: number;
  readonly height: number;
}

export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("PDF 파일만 사용할 수 있습니다.");
  if (file.size > MAX_PDF_BYTES) throw new Error("300MB 이하의 PDF만 사용할 수 있습니다.");
  try {
    return await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new Error("PDF 파일을 열지 못했습니다.");
  }
}

interface TextRun {
  readonly str: string;
  readonly transform: readonly number[];
  readonly width: number;
  readonly hasEOL?: boolean;
}

function isTextRun(item: unknown): item is TextRun {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

/**
 * Splits the page's text runs into words with page coordinates (top-left origin). A run only
 * reports its total width, so word positions inside it are apportioned by measured glyph widths.
 */
export async function readPageWords(pdf: PDFDocumentProxy, pageNumber: number): Promise<{ readonly words: PdfWord[]; readonly size: PdfPageSize }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("PDF 글자를 처리하지 못했습니다.");
  const words: PdfWord[] = [];
  let previous: { word: PdfWord; endsWithSpace: boolean } | null = null;

  for (const item of content.items) {
    if (!isTextRun(item) || !item.str.trim()) {
      if (isTextRun(item) && previous) previous.endsWithSpace = true;
      continue;
    }
    const [a, b, c, d, x, baseline] = Util.transform(viewport.transform, item.transform as number[]) as number[];
    // Rotated or vertical text never belongs to a reading passage.
    if (Math.abs(b!) > 0.01 || Math.abs(c!) > 0.01 || a! <= 0) continue;
    const size = Math.abs(d!);
    measure.font = `${size}px sans-serif`;
    const measured = measure.measureText(item.str).width;
    const ratio = measured > 0 ? item.width * viewport.scale / measured : 0;
    const top = baseline! - size * 0.9;
    const bottom = baseline! + size * 0.25;

    for (const match of item.str.matchAll(/\S+/g)) {
      const offset = measure.measureText(item.str.slice(0, match.index)).width * ratio;
      const x0 = x! + offset;
      const x1 = x0 + measure.measureText(match[0]).width * ratio;
      const joinsPrevious = match.index === 0 && previous && !previous.endsWithSpace && previous.word.page === pageNumber
        && Math.abs(previous.word.y1 - bottom) < size * 0.3 && x0 - previous.word.x1 < size * 0.15 && x0 >= previous.word.x0;
      if (joinsPrevious && previous) {
        // A word split across two runs (kerning, colour change) is merged back together.
        const merged: PdfWord = { ...previous.word, text: previous.word.text + match[0], x1, y0: Math.min(previous.word.y0, top), y1: Math.max(previous.word.y1, bottom) };
        words[words.length - 1] = merged;
        previous.word = merged;
      } else {
        const word: PdfWord = { text: match[0], page: pageNumber, x0, y0: top, x1, y1: bottom };
        words.push(word);
        previous = { word, endsWithSpace: false };
      }
    }
    if (previous) previous.endsWithSpace = /\s$/.test(item.str) || item.hasEOL === true;
  }
  page.cleanup();
  return { words, size: { width: viewport.width, height: viewport.height } };
}

/** Renders part of a page (in page units) to an encoded slide image. */
export async function renderPageCrop(pdf: PDFDocumentProxy, pageNumber: number, crop: Box): Promise<EncodedImage> {
  const page = await pdf.getPage(pageNumber);
  const scale = Math.min(IMAGE_MAX_WIDTH / crop.width, IMAGE_MAX_HEIGHT / crop.height);
  const viewport = page.getViewport({ scale, offsetX: -crop.x * scale, offsetY: -crop.y * scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  try {
    // The print intent renders in one pass; the display intent waits on animation frames,
    // which stall while the tab is in the background.
    await page.render({ canvas, viewport, intent: "print" }).promise;
    return await encodeSlideImage(canvas, IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT);
  } finally {
    page.cleanup();
  }
}
