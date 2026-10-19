/*
 * A small rule-based guess at an English word's role, good enough to pick distractors of the same kind
 * (a verb for a verb, a preposition for a preposition) without an AI. Closed word classes come from
 * lists; open ones from suffixes and the word in front of the blank.
 */

export type WordClass =
  | "pronoun" | "possessive" | "determiner" | "preposition" | "conjunction" | "be" | "auxiliary" | "wh" | "number" | "adverb"
  | "verb" | "noun" | "adjective" | "unknown";

/** Grammatical endings worth matching, so a past-tense blank gets past-tense distractors. */
export type WordForm = "ing" | "ed" | "s" | "ly" | "er" | "est" | "base";

/** Closed classes: each list doubles as a ready-made set of confusable alternatives. */
export const CLOSED_CLASSES: Readonly<Record<Exclude<WordClass, "verb" | "noun" | "adjective" | "unknown" | "adverb">, readonly string[]>> = {
  pronoun: ["i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them"],
  possessive: ["my", "your", "his", "her", "its", "our", "their"],
  determiner: ["a", "an", "the", "this", "that", "these", "those", "some", "any", "every", "each", "many", "much", "few", "little", "all", "no"],
  preposition: ["in", "on", "at", "to", "for", "from", "with", "about", "of", "by", "into", "over", "under", "after", "before", "during", "around", "near", "behind", "between"],
  conjunction: ["and", "but", "or", "so", "because", "when", "if", "while", "than", "until", "though"],
  be: ["am", "is", "are", "was", "were", "be", "been", "being"],
  auxiliary: ["can", "could", "will", "would", "should", "must", "may", "might", "do", "does", "did", "have", "has", "had"],
  wh: ["what", "who", "where", "when", "why", "how", "which", "whose"],
  number: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "first", "second", "third", "last"],
};

/** Words with a fixed role (articles, prepositions, be…); used to tell names from capitalised sentence starts. */
export function isFunctionWord(word: string): boolean {
  return LOOKUP.has(word.toLowerCase());
}

const COMMON_ADVERBS = ["very", "too", "also", "always", "often", "never", "sometimes", "usually", "just", "still", "already", "again", "here", "there", "now", "then", "soon", "well", "really", "even"];

const SUBJECTS = new Set(["i", "you", "he", "she", "it", "we", "they"]);
const ARTICLE_LIKE = new Set([...CLOSED_CLASSES.determiner, ...CLOSED_CLASSES.possessive]);
const BE_LIKE = new Set(CLOSED_CLASSES.be);

const LOOKUP = new Map<string, WordClass>();
for (const [kind, words] of Object.entries(CLOSED_CLASSES) as [WordClass, readonly string[]][]) {
  for (const word of words) if (!LOOKUP.has(word)) LOOKUP.set(word, kind);
}
for (const word of COMMON_ADVERBS) if (!LOOKUP.has(word)) LOOKUP.set(word, "adverb");

export function wordForm(word: string): WordForm {
  const lower = word.toLowerCase();
  if (lower.length > 4 && lower.endsWith("ing")) return "ing";
  if (lower.length > 3 && lower.endsWith("ed")) return "ed";
  if (lower.length > 3 && lower.endsWith("ly")) return "ly";
  if (lower.length > 4 && lower.endsWith("est")) return "est";
  if (lower.length > 3 && lower.endsWith("er")) return "er";
  if (lower.length > 3 && lower.endsWith("s") && !lower.endsWith("ss")) return "s";
  return "base";
}

/** "have/has/had" and "do/does/did" are main verbs unless a participle, "not" or a subject follows. */
const DUAL_VERBS = new Set(["have", "has", "had", "do", "does", "did"]);
function dualVerbClass(next: string | null): WordClass {
  if (next === null) return "verb";
  return next === "not" || next === "been" || SUBJECTS.has(next) || wordForm(next) === "ed" || next.endsWith("en") ? "auxiliary" : "verb";
}

/** Guesses the class of `word` from its spelling and the words around it (null at the edges). */
export function wordClass(word: string, previous: string | null, next: string | null = null): WordClass {
  const lower = word.toLowerCase();
  if (DUAL_VERBS.has(lower)) return dualVerbClass(next?.toLowerCase() ?? null);
  const known = LOOKUP.get(lower);
  if (known) return known;
  const before = previous?.toLowerCase() ?? null;
  if (before === "to" || (before !== null && LOOKUP.get(before) === "auxiliary" && !DUAL_VERBS.has(before))) return "verb";
  if (before !== null && SUBJECTS.has(before)) return "verb";
  // Comparatives and superlatives: "bigger than", "the tallest".
  if (next?.toLowerCase() === "than" || (wordForm(lower) === "est" && before !== null && ARTICLE_LIKE.has(before))) return "adjective";
  // "the old walls": a content word between an article and another content word describes it.
  if (before !== null && ARTICLE_LIKE.has(before) && next !== null && !LOOKUP.has(next.toLowerCase())) return "adjective";
  if (/(tion|sion|ment|ness|ity|ship|ance|ence|hood)s?$/.test(lower)) return "noun";
  if (/(ful|ous|ive|able|ible|less|ish|ical|ic|al|y)$/.test(lower) && lower.length > 3 && before !== null && (BE_LIKE.has(before) || ARTICLE_LIKE.has(before))) return "adjective";
  if (lower.endsWith("ly") && lower.length > 3) return "adverb";
  if (before !== null && ARTICLE_LIKE.has(before)) return "noun";
  if (before !== null && BE_LIKE.has(before)) return wordForm(lower) === "ing" || wordForm(lower) === "ed" ? "verb" : "adjective";
  if (wordForm(lower) === "ed" || wordForm(lower) === "ing") return "verb";
  return "unknown";
}
