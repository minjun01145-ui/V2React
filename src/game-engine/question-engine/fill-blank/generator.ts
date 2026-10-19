import { createSeededRandom, shuffled } from "../../core/random.ts";
import { validateCanonicalQuestionSet } from "../canonicalQuestionSet.ts";
import type { MultipleChoiceOption } from "../multiple-choice/types.ts";
import { blankable, buildVocabulary, pickDistractors, safeDistractor, tokenize, type Token, type Vocabulary } from "./distractors.ts";
import type { BuildFillBlankSetInput, FillBlankQuestion, FillBlankQuestionSet, FillBlankSentence } from "./types.ts";
import type { WordClass } from "./wordClass.ts";

/** Which words make the best blanks: content words test meaning, closed words test grammar. */
const BLANK_PRIORITY: Readonly<Record<WordClass, number>> = {
  verb: 5, noun: 4, adjective: 4, adverb: 3, preposition: 3, number: 2, be: 2, auxiliary: 2, wh: 2, unknown: 2,
  pronoun: 1, possessive: 1, conjunction: 1, determiner: 0,
};

/** Options follow the blank's capitalisation, so the first word of a sentence gives nothing away. */
function cased(word: string, target: Token): string {
  if (word === "i") return "I";
  return target.start === 0 || target.text[0] !== target.text[0]!.toLowerCase() ? word[0]!.toUpperCase() + word.slice(1) : word;
}

interface BlankChoice {
  readonly token: Token;
  readonly distractors: readonly string[];
}

/** A prepared blank: random among the sentence's prepared words, random distractors among the safe ones. */
function preparedChoice(sentence: FillBlankSentence<unknown>, tokens: readonly Token[], vocabulary: Vocabulary, count: number, seed: string): BlankChoice | null {
  const random = createSeededRandom(`${seed}:${sentence.id}:prepared`);
  const usable = (sentence.prepared ?? []).flatMap((blank) => {
    const token = tokens.find((candidate) => candidate.text === blank.answer);
    if (!token) return [];
    const safe = [...new Set(blank.distractors.map((word) => word.trim()))].filter((word) => word && safeDistractor(word, token, vocabulary));
    // Rule-made distractors top up a blank whose prepared ones were filtered out.
    const topUp = safe.length >= count ? [] : pickDistractors(token, tokens, vocabulary, count, `${seed}:${sentence.id}:${token.start}`)
      .filter((word) => !safe.some((kept) => kept.toLowerCase() === word));
    const distractors = [...shuffled(safe, `${seed}:${sentence.id}:${token.start}:prepared`), ...topUp].slice(0, count);
    return distractors.length === count ? [{ token, distractors }] : [];
  });
  return usable.length ? usable[Math.floor(random() * usable.length)]! : null;
}

/** A rule-made blank: the best few words by priority, then a seeded pick among them so rounds differ. */
function ruleChoice(sentence: FillBlankSentence<unknown>, tokens: readonly Token[], vocabulary: Vocabulary, count: number, seed: string): BlankChoice | null {
  const random = createSeededRandom(`${seed}:${sentence.id}:target`);
  const ranked = tokens.filter((token) => blankable(token, vocabulary))
    .map((token) => ({ token, distractors: pickDistractors(token, tokens, vocabulary, count, `${seed}:${sentence.id}:${token.start}`) }))
    .filter((entry) => entry.distractors.length === count)
    .sort((left, right) => BLANK_PRIORITY[right.token.wordClass] - BLANK_PRIORITY[left.token.wordClass]);
  if (!ranked.length) return null;
  const best = BLANK_PRIORITY[ranked[0]!.token.wordClass];
  const top = ranked.filter((entry) => BLANK_PRIORITY[entry.token.wordClass] >= best - 1);
  return top[Math.floor(random() * top.length)]!;
}

function buildQuestion<TSource>(sentence: FillBlankSentence<TSource>, tokens: readonly Token[], vocabulary: Vocabulary, choiceCount: number, seed: string): FillBlankQuestion<TSource> | null {
  const choice = preparedChoice(sentence, tokens, vocabulary, choiceCount - 1, seed) ?? ruleChoice(sentence, tokens, vocabulary, choiceCount - 1, seed);
  if (!choice) return null;
  const { token, distractors } = choice;

  const id = `fill-blank:${sentence.id}`;
  const correctOptionId = `${id}:correct`;
  const options: MultipleChoiceOption[] = [
    { id: correctOptionId, text: token.text },
    ...distractors.map((word, index) => ({ id: `${id}:distractor:${index + 1}`, text: cased(word, token) })),
  ];
  return {
    id,
    kind: "fill-blank",
    before: sentence.text.slice(0, token.start),
    after: sentence.text.slice(token.end),
    meaning: sentence.meaning,
    options: shuffled(options, `${seed}:${sentence.id}:options`),
    correctOptionId,
    answer: token.text,
    wordClass: token.wordClass,
    source: sentence.source,
  };
}

export function buildFillBlankSet<TSource>(input: BuildFillBlankSetInput<TSource>): FillBlankQuestionSet<TSource> {
  const choiceCount = input.choiceCount;
  if (!Number.isInteger(choiceCount) || choiceCount < 2 || choiceCount > 5) throw new Error("빈칸 선택지 수는 2개부터 5개까지 설정할 수 있습니다.");
  const sentences = input.sentences.filter((sentence) => sentence.text.trim());
  const tokens = sentences.map((sentence) => tokenize(sentence.text));
  const vocabulary = buildVocabulary(tokens);
  const seed = String(input.seed ?? `${input.id}:${choiceCount}`);
  let questions = sentences.flatMap((sentence, index) => {
    const question = buildQuestion(sentence, tokens[index]!, vocabulary, choiceCount, seed);
    return question ? [question] : [];
  });
  if (!questions.length) throw new Error("빈칸 문제를 만들 수 있는 문장이 없습니다. 본문 문장을 더 넣어 주세요.");
  if (input.shuffleQuestions ?? true) questions = shuffled(questions, `${seed}:questions`);
  if (input.questionLimit !== undefined) {
    if (!Number.isInteger(input.questionLimit) || input.questionLimit < 1) throw new Error("문제 수 제한은 1 이상의 정수여야 합니다.");
    questions = questions.slice(0, input.questionLimit);
  }
  const canonical = validateCanonicalQuestionSet({ id: input.id, title: input.title, type: "fill-blank" as const, questions });
  return { ...canonical, type: "fill-blank", choiceCount };
}
