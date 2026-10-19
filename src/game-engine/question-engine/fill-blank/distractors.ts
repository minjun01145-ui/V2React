import { shuffled } from "../../core/random.ts";
import { CLOSED_CLASSES, isFunctionWord, wordClass, wordForm, type WordClass } from "./wordClass.ts";

/** A word as it appears in a sentence, with its neighbours for context. */
export interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly previous: string | null;
  readonly next: string | null;
  readonly wordClass: WordClass;
}

const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;

export function tokenize(sentence: string): Token[] {
  const matches = [...sentence.matchAll(WORD)];
  return matches.map((match, index) => {
    const previous = matches[index - 1]?.[0] ?? null;
    const next = matches[index + 1]?.[0] ?? null;
    return {
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      previous,
      next,
      wordClass: wordClass(match[0], previous, next),
    };
  });
}

/** Every word the set uses, by lower-case spelling, with each class it was seen in. */
export interface Vocabulary {
  readonly classes: ReadonlyMap<string, ReadonlySet<WordClass>>;
  /** "previous next" contexts each word filled, to reject distractors that would also be correct. */
  readonly contexts: ReadonlyMap<string, ReadonlySet<string>>;
  /** Words that only ever appear capitalised mid-sentence (names) are never offered. */
  readonly names: ReadonlySet<string>;
}

const contextKey = (previous: string | null, next: string | null): string => `${previous?.toLowerCase() ?? ""} ${next?.toLowerCase() ?? ""}`;

export function buildVocabulary(sentences: readonly (readonly Token[])[]): Vocabulary {
  const classes = new Map<string, Set<WordClass>>();
  const contexts = new Map<string, Set<string>>();
  const capitalised = new Map<string, boolean>();
  for (const tokens of sentences) {
    for (const token of tokens) {
      const key = token.text.toLowerCase();
      (classes.get(key) ?? classes.set(key, new Set()).get(key)!).add(token.wordClass);
      (contexts.get(key) ?? contexts.set(key, new Set()).get(key)!).add(contextKey(token.previous, token.next));
      // A word never written in lower case is a name ("Tom", "Yuna"), even when it only starts sentences.
      if (!isFunctionWord(key)) capitalised.set(key, (capitalised.get(key) ?? true) && token.text[0] !== token.text[0]!.toLowerCase());
    }
  }
  return { classes, contexts, names: new Set([...capitalised].filter(([, always]) => always).map(([key]) => key)) };
}

/** True when the word can carry a blank: long enough, not a name, and not a lone letter. */
export function blankable(token: Token, vocabulary: Vocabulary): boolean {
  return token.text.length >= 2 && !vocabulary.names.has(token.text.toLowerCase());
}

/**
 * Up to `count` confusable wrong answers for `target`, best first. Same class and same ending score
 * highest; closed classes also draw on their fixed list (in → on, at, to). A word that fills the same
 * gap elsewhere in the set is never offered, since it might be right here too.
 */
export function pickDistractors(target: Token, sentence: readonly Token[], vocabulary: Vocabulary, count: number, seed: unknown): string[] {
  const answer = target.text.toLowerCase();
  const gap = contextKey(target.previous, target.next);
  const inSentence = new Set(sentence.map((token) => token.text.toLowerCase()));
  const closed = (CLOSED_CLASSES as Readonly<Record<string, readonly string[]>>)[target.wordClass] ?? [];
  const candidates = new Set<string>([...vocabulary.classes.keys(), ...closed]);
  const scored: { word: string; score: number }[] = [];
  for (const word of shuffled([...candidates], seed)) {
    if (word === answer || word.length < 2 && word !== "a" || vocabulary.names.has(word) || vocabulary.contexts.get(word)?.has(gap)) continue;
    const classes = vocabulary.classes.get(word);
    let score = 0;
    if (closed.includes(word) || classes?.has(target.wordClass)) score += target.wordClass === "unknown" ? 1 : 4;
    if (wordForm(word) === wordForm(answer)) score += 2;
    if (Math.abs(word.length - answer.length) <= 2) score += 1;
    if (inSentence.has(word)) score -= 3;
    scored.push({ word, score });
  }
  return scored.sort((left, right) => right.score - left.score).slice(0, count).map((entry) => entry.word);
}
