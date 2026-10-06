// Mirrors src/game-engine/sequence/words.ts; keep both in sync.
import { isRecord } from "./validation.js";

/**
 * Word-level view of sentence text, shared by games that build sentences one
 * word at a time. Punctuation stays attached to its word ("student.").
 */
export function splitSentenceWords(text: string): string[] {
  return text.normalize("NFKC").split(/\s+/).filter(Boolean);
}

/** Words of a chunked sentence, in order ("I am", "a student." → I, am, a, student.). */
export function chunksToWords(chunks: readonly string[]): string[] {
  return chunks.flatMap(splitSentenceWords);
}

/**
 * Comparison key for a word or chunk: case, spacing and surrounding
 * punctuation are ignored, so "I am" from another sentence still equals "I am".
 */
export function sentenceTextKey(text: string): string {
  const spaced = text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return spaced.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || spaced;
}

export type SentenceUnit = "chunk" | "word";
export const SENTENCE_UNIT_KEY = "sentence-unit";

export function readSentenceUnit(config: unknown): SentenceUnit {
  return isRecord(config) && config[SENTENCE_UNIT_KEY] === "word" ? "word" : "chunk";
}

export function sentenceUnits(chunks: readonly string[], unit: SentenceUnit): string[] {
  return unit === "word" ? chunksToWords(chunks) : [...chunks];
}
