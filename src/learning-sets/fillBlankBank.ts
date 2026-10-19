import type { PreparedBlank } from "../game-engine/question-engine/fill-blank/index.ts";

/*
 * AI-prepared fill-blank material, written by the server (functions/src/fill-blank-bank/) to
 * {set}/content/fillBlanks whenever a reading set is saved: several blanks per sentence, each with more
 * distractors than a game shows.
 */

export interface PreparedSentence {
  /** The sentence the entry was made for; it is ignored once the sentence is edited. */
  readonly sourceText: string;
  readonly blanks: readonly PreparedBlank[];
}

/** Prepared sentences by item id; empty when nothing is prepared yet. */
export type FillBlankBank = ReadonlyMap<string, PreparedSentence>;

function blank(raw: unknown): PreparedBlank | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.answer !== "string" || !Array.isArray(value.distractors)) return null;
  return { answer: value.answer, distractors: value.distractors.filter((word): word is string => typeof word === "string") };
}

export function parseFillBlankBank(raw: unknown): FillBlankBank {
  const bank = new Map<string, PreparedSentence>();
  const sentences = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).sentences : null;
  if (typeof sentences !== "object" || sentences === null) return bank;
  for (const [id, entry] of Object.entries(sentences)) {
    if (typeof entry !== "object" || entry === null) continue;
    const value = entry as Record<string, unknown>;
    const blanks = Array.isArray(value.blanks) ? value.blanks.map(blank).filter((item): item is PreparedBlank => item !== null) : [];
    if (typeof value.sourceText === "string" && blanks.length) bank.set(id, { sourceText: value.sourceText, blanks });
  }
  return bank;
}
