import { isRecord } from "../shared/validation.js";

/*
 * Prepared fill-blank material for a reading set, stored next to its text (content/fillBlanks). Each
 * sentence keeps several blankable words, each with more distractors than any game shows, so games can
 * pick a different blank and option mix every round. The client mirror is src/learning-sets/fillBlankBank.ts.
 */

export const FILL_BLANK_BANK_DOC = "fillBlanks";
export const BLANKS_PER_SENTENCE = 3;
export const DISTRACTORS_PER_BLANK = 6;
/** Fewer than this many usable distractors and a blank is dropped. */
const MIN_DISTRACTORS = 4;

export interface PreparedBlank {
  readonly answer: string;
  readonly distractors: readonly string[];
}

export interface PreparedSentence {
  /** The sentence this entry was made for; a changed sentence is regenerated. */
  readonly sourceText: string;
  readonly blanks: readonly PreparedBlank[];
}

export interface BankSentenceInput {
  readonly id: string;
  readonly sourceText: string;
  readonly meaning: string;
}

export const sentenceText = (sourceText: string): string => sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean).join(" ");
const words = (sentence: string): string[] => sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? [];

/** Keeps only blanks whose answer really is a word of the sentence and whose distractors are usable. */
export function parsePreparedBlanks(raw: unknown, sentence: string): PreparedBlank[] {
  if (!Array.isArray(raw)) return [];
  const sentenceWords = new Set(words(sentence));
  const lowerWords = new Set([...sentenceWords].map((word) => word.toLowerCase()));
  const seenAnswers = new Set<string>();
  return raw.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.answer !== "string" || !Array.isArray(entry.distractors)) return [];
    const answer = entry.answer.trim();
    if (!sentenceWords.has(answer) || seenAnswers.has(answer.toLowerCase())) return [];
    const distractors = [...new Set(entry.distractors
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => /^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(value) && value.toLowerCase() !== answer.toLowerCase() && !lowerWords.has(value.toLowerCase())))]
      .slice(0, DISTRACTORS_PER_BLANK + 2);
    if (distractors.length < MIN_DISTRACTORS) return [];
    seenAnswers.add(answer.toLowerCase());
    return [{ answer, distractors }];
  }).slice(0, BLANKS_PER_SENTENCE + 1);
}

/** The AI reply for one batch: {"sentences":[{"id":"…","blanks":[{"answer","distractors":[…]}]}]}. */
export function parseBankReply(raw: unknown, inputs: readonly BankSentenceInput[]): Map<string, PreparedBlank[]> {
  const result = new Map<string, PreparedBlank[]>();
  if (!isRecord(raw) || !Array.isArray(raw.sentences)) return result;
  const byId = new Map(inputs.map((input) => [input.id, input]));
  for (const entry of raw.sentences) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    const input = byId.get(entry.id);
    if (!input) continue;
    const blanks = parsePreparedBlanks(entry.blanks, sentenceText(input.sourceText));
    if (blanks.length) result.set(input.id, blanks);
  }
  return result;
}

/** Previously prepared sentences, by item id; anything malformed is dropped and regenerated. */
export function parseStoredBank(raw: unknown): Map<string, PreparedSentence> {
  const result = new Map<string, PreparedSentence>();
  if (!isRecord(raw) || !isRecord(raw.sentences)) return result;
  for (const [id, entry] of Object.entries(raw.sentences)) {
    if (!isRecord(entry) || typeof entry.sourceText !== "string") continue;
    const blanks = parsePreparedBlanks(entry.blanks, sentenceText(entry.sourceText));
    if (blanks.length) result.set(id, { sourceText: entry.sourceText, blanks });
  }
  return result;
}
