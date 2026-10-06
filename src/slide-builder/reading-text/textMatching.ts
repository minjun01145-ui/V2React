/**
 * Finds where each reading-chunk of a learning set sits in a textbook PDF by matching the
 * set's words against the words of the PDF text layer. Pure, so it can be tested without a PDF.
 */

/** A word of the PDF text layer, in PDF page units with the origin at the top-left. */
export interface PdfWord {
  readonly text: string;
  readonly page: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Where one chunk of a sentence was found: the matched words on a single page. */
export interface ChunkPlacement {
  readonly text: string;
  readonly page: number;
  readonly words: readonly PdfWord[];
}

export interface SentenceAlignment {
  /** One entry per chunk; null when none of the chunk's words were found. */
  readonly chunks: readonly (ChunkPlacement | null)[];
  readonly found: boolean;
}

/** Words a set token may skip over in the PDF (line numbers, footnote marks, …). */
const LOOKAHEAD = 4;
/** First tokens tried as an anchor, so a typo in the first word does not lose the sentence. */
const ANCHOR_TOKENS = 3;

export function normalizeToken(value: string): string {
  return value.toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");
}

export function splitChunks(sourceText: string): string[] {
  return sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean);
}

interface Token {
  readonly value: string;
  readonly chunk: number;
}

function tokensOf(chunks: readonly string[]): Token[] {
  return chunks.flatMap((chunk, index) => chunk.split(/\s+/).map(normalizeToken).filter(Boolean).map((value) => ({ value, chunk: index })));
}

/** Next word of a sentence: on the same page and on the same or a neighbouring line. */
function follows(previous: PdfWord, next: PdfWord): boolean {
  const lineHeight = previous.y1 - previous.y0;
  return next.page === previous.page && Math.abs((next.y0 + next.y1) / 2 - (previous.y0 + previous.y1) / 2) <= lineHeight * 3;
}

/** Greedy in-order match of tokens[from..] starting at word index `start`; returns word index per token or -1. */
function matchFrom(words: readonly PdfWord[], normalized: readonly string[], tokens: readonly Token[], from: number, start: number): { readonly hits: number[]; readonly score: number } {
  const hits = tokens.map(() => -1);
  let position = start;
  let previous: PdfWord | null = null;
  let score = 0;
  for (let index = from; index < tokens.length; index += 1) {
    const limit = Math.min(normalized.length, position + LOOKAHEAD + 1);
    for (let candidate = position; candidate < limit; candidate += 1) {
      if (normalized[candidate] === tokens[index]!.value && (!previous || follows(previous, words[candidate]!))) {
        previous = words[candidate]!;
        hits[index] = candidate;
        position = candidate + 1;
        score += 1;
        break;
      }
    }
  }
  return { hits, score };
}

/**
 * Aligns each sentence (a list of chunks) to the PDF words. Sentences are searched across the
 * whole document, preferring the earliest match after the previous sentence so the reading
 * order of the set follows the textbook.
 */
export function alignSentences(words: readonly PdfWord[], sentences: readonly (readonly string[])[]): SentenceAlignment[] {
  const normalized = words.map((word) => normalizeToken(word.text));
  const positions = new Map<string, number[]>();
  normalized.forEach((value, index) => {
    if (!value) return;
    const list = positions.get(value);
    if (list) list.push(index);
    else positions.set(value, [index]);
  });

  let cursor = 0;
  return sentences.map((chunks) => {
    const tokens = tokensOf(chunks);
    let best: { readonly hits: number[]; readonly score: number; readonly start: number } | null = null;
    for (let anchor = 0; anchor < Math.min(ANCHOR_TOKENS, tokens.length); anchor += 1) {
      for (const start of positions.get(tokens[anchor]!.value) ?? []) {
        const result = matchFrom(words, normalized, tokens, anchor, start);
        const better = !best || result.score > best.score
          || (result.score === best.score && (start >= cursor) && (best.start < cursor || start < best.start));
        if (better) best = { ...result, start };
      }
    }
    const required = Math.max(2, Math.ceil(tokens.length * 0.6));
    if (!best || best.score < Math.min(required, tokens.length)) return { chunks: chunks.map(() => null), found: false };
    cursor = Math.max(cursor, ...best.hits) + 1;

    const hits = best.hits;
    return {
      found: true,
      chunks: chunks.map((text, chunkIndex) => {
        const matched = tokens.flatMap((token, index) => token.chunk === chunkIndex && hits[index]! >= 0 ? [words[hits[index]!]!] : []);
        const page = matched[0]?.page;
        if (page === undefined) return null;
        return { text, page, words: matched.filter((word) => word.page === page) };
      }),
    };
  });
}
