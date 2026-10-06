import type { LearningSetItem } from "../../learning-sets/types.ts";
import { MAX_SLIDES } from "../../slide-show/types.ts";
import { openPdf, readPageWords, renderPageCrop, type PdfPageSize } from "./pdfPages.ts";
import { cropAround, lineBoxes, passageWords, readingSlideCanvas, toSlideBox } from "./slideLayout.ts";
import { alignSentences, splitChunks, type ChunkPlacement, type PdfWord } from "./textMatching.ts";

export interface ReadingTextSlidesResult {
  /** Fabric canvas JSON per slide, in presentation order. */
  readonly canvases: readonly string[];
  /** Set sentences that could not be found in the PDF. */
  readonly missingSentences: readonly string[];
  /** Whether slides were dropped to stay within the slide limit. */
  readonly truncated: boolean;
}

export type BuildProgress = (message: string) => void;

/**
 * Builds a reading-text (본문) deck: for every textbook page holding the set's sentences, one
 * slide with the zoomed page, then one slide per reading chunk with that chunk boxed.
 */
export async function buildReadingTextSlides(file: File, items: readonly LearningSetItem[], progress: BuildProgress = () => undefined): Promise<ReadingTextSlidesResult> {
  progress("PDF 여는 중…");
  const pdf = await openPdf(file);
  try {
    const words: PdfWord[] = [];
    const sizes = new Map<number, PdfPageSize>();
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      progress(`글자 읽는 중… ${pageNumber}/${pdf.numPages}`);
      const page = await readPageWords(pdf, pageNumber);
      words.push(...page.words);
      sizes.set(pageNumber, page.size);
    }
    if (words.length === 0) throw new Error("이 PDF에서 글자 정보를 찾지 못했습니다.");

    const sentences = items.map((item) => splitChunks(item.sourceText));
    const alignments = alignSentences(words, sentences);
    const missingSentences = items.filter((_, index) => !alignments[index]!.found).map((item) => item.sourceText.replaceAll("/", " ").replace(/\s+/g, " ").trim());
    const chunks = alignments.flatMap((alignment) => alignment.chunks.filter((chunk): chunk is ChunkPlacement => chunk !== null && chunk.words.length > 0));
    if (chunks.length === 0) throw new Error("세트의 문장을 PDF에서 찾지 못했습니다. 세트와 같은 과의 PDF인지 확인해 주세요.");

    // Pages in the order the set reaches them; each keeps the chunks found on it.
    const pages = new Map<number, ChunkPlacement[]>();
    for (const chunk of chunks) pages.set(chunk.page, [...(pages.get(chunk.page) ?? []), chunk]);

    const canvases: string[] = [];
    let index = 0;
    for (const [pageNumber, pageChunks] of pages) {
      index += 1;
      progress(`슬라이드 만드는 중… ${index}/${pages.size}쪽`);
      const matched = pageChunks.flatMap((chunk) => chunk.words);
      const crop = cropAround(passageWords(matched, words.filter((word) => word.page === pageNumber)), sizes.get(pageNumber)!);
      const image = await renderPageCrop(pdf, pageNumber, crop);
      const picture = { src: image.dataUrl, width: image.width, height: image.height };
      canvases.push(readingSlideCanvas(picture, crop, []));
      for (const chunk of pageChunks) canvases.push(readingSlideCanvas(picture, crop, lineBoxes(chunk.words).map((box) => toSlideBox(box, crop))));
    }
    return { canvases: canvases.slice(0, MAX_SLIDES), missingSentences, truncated: canvases.length > MAX_SLIDES };
  } finally {
    void pdf.loadingTask.destroy();
  }
}
