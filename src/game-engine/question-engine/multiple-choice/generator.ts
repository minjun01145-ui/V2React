import { shuffled } from "../../core/random.ts";
import { validateCanonicalQuestionSet } from "../canonicalQuestionSet.ts";
import type {
  BuildMultipleChoiceSetInput,
  ChoiceDirection,
  MultipleChoiceOption,
  MultipleChoicePair,
  MultipleChoiceQuestion,
  MultipleChoiceQuestionSet,
} from "./types.ts";
import { CHOICE_DIRECTION } from "./types.ts";
import { parseChoiceCount, parseChoiceDirection, validateMultipleChoicePairs } from "./validation.ts";

interface DirectedPair<TSource> {
  readonly pair: MultipleChoicePair<TSource>;
  readonly prompt: string;
  readonly answer: string;
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function directed<TSource>(pair: MultipleChoicePair<TSource>, direction: ChoiceDirection): DirectedPair<TSource> {
  return direction === CHOICE_DIRECTION.LEFT_TO_RIGHT
    ? { pair, prompt: pair.left, answer: pair.right }
    : { pair, prompt: pair.right, answer: pair.left };
}

function unambiguousPairs<TSource>(pairs: readonly DirectedPair<TSource>[]): readonly DirectedPair<TSource>[] {
  const answersByPrompt = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const promptKey = normalized(pair.prompt);
    const answers = answersByPrompt.get(promptKey) ?? new Set<string>();
    answers.add(normalized(pair.answer));
    answersByPrompt.set(promptKey, answers);
  }

  const seen = new Set<string>();
  return pairs.filter((pair) => {
    const promptKey = normalized(pair.prompt);
    if ((answersByPrompt.get(promptKey)?.size ?? 0) !== 1) return false;
    const signature = `${promptKey}\u0000${normalized(pair.answer)}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function uniqueAnswerCandidates<TSource>(pairs: readonly DirectedPair<TSource>[], correct: DirectedPair<TSource>): readonly DirectedPair<TSource>[] {
  const correctAnswer = normalized(correct.answer);
  const seen = new Set<string>();
  return pairs.filter((candidate) => {
    const answerKey = normalized(candidate.answer);
    if (candidate.pair.id === correct.pair.id || answerKey === correctAnswer || seen.has(answerKey)) return false;
    seen.add(answerKey);
    return true;
  });
}

function buildQuestion<TSource>(
  candidate: DirectedPair<TSource>,
  pool: readonly DirectedPair<TSource>[],
  direction: ChoiceDirection,
  choiceCount: number,
  seed: unknown,
): MultipleChoiceQuestion<TSource> | null {
  const distractors = shuffled(uniqueAnswerCandidates(pool, candidate), `${String(seed)}:${candidate.pair.id}:distractors`).slice(0, choiceCount - 1);
  if (distractors.length !== choiceCount - 1) return null;

  const questionId = `choice:${direction}:${candidate.pair.id}`;
  const correctOptionId = `${questionId}:correct`;
  const options: MultipleChoiceOption[] = [
    { id: correctOptionId, text: candidate.answer },
    ...distractors.map((distractor, index) => ({ id: `${questionId}:distractor:${index + 1}`, text: distractor.answer })),
  ];
  return {
    id: questionId,
    kind: "multiple-choice",
    prompt: candidate.prompt,
    options: shuffled(options, `${String(seed)}:${candidate.pair.id}:options`),
    correctOptionId,
    direction,
    source: candidate.pair.source,
  };
}

export function buildMultipleChoiceSet<TSource>(input: BuildMultipleChoiceSetInput<TSource>): MultipleChoiceQuestionSet<TSource> {
  const choiceCount = parseChoiceCount(input.choiceCount);
  const direction = parseChoiceDirection(input.direction);
  const pairs = validateMultipleChoicePairs(input.pairs).map((pair) => directed(pair, direction));
  const pool = unambiguousPairs(pairs);
  const seed = input.seed ?? `${input.id}:${direction}:${choiceCount}`;
  let questions = pool.flatMap((pair) => {
    const question = buildQuestion(pair, pool, direction, choiceCount, seed);
    return question ? [question] : [];
  });
  if (questions.length < 1) {
    throw new Error(`${choiceCount}지선다 문제를 만들 수 있는 서로 다른 정답이 부족합니다.`);
  }
  if (input.shuffleQuestions ?? true) questions = shuffled(questions, `${String(seed)}:questions`);
  if (input.questionLimit !== undefined) {
    if (!Number.isInteger(input.questionLimit) || input.questionLimit < 1) throw new Error("문제 수 제한은 1 이상의 정수여야 합니다.");
    questions = questions.slice(0, input.questionLimit);
  }

  const canonical = validateCanonicalQuestionSet({
    id: input.id,
    title: input.title,
    type: "multiple-choice" as const,
    questions,
  });
  return { ...canonical, type: "multiple-choice", choiceCount, direction };
}
