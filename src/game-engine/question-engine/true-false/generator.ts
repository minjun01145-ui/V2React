import { createSeededRandom, shuffled } from "../../core/random.ts";
import { validateCanonicalQuestionSet } from "../canonicalQuestionSet.ts";
import { CHOICE_DIRECTION } from "../multiple-choice/types.ts";
import { parseChoiceDirection, validateMultipleChoicePairs } from "../multiple-choice/validation.ts";
import { answerKey } from "../text.ts";
import type { BuildTrueFalseSetInput, TrueFalseQuestion, TrueFalseQuestionSet } from "./types.ts";

export function buildTrueFalseSet<TSource>(input: BuildTrueFalseSetInput<TSource>): TrueFalseQuestionSet<TSource> {
  const direction = parseChoiceDirection(input.direction);
  const trueRatio = input.trueRatio ?? 0.5;
  if (!Number.isFinite(trueRatio) || trueRatio < 0 || trueRatio > 1) throw new Error("O 문제 비율은 0부터 1까지입니다.");
  const seed = input.seed ?? `${input.id}:${direction}`;
  const pairs = validateMultipleChoicePairs(input.pairs).map((pair) => direction === CHOICE_DIRECTION.LEFT_TO_RIGHT
    ? { pair, prompt: pair.left, answer: pair.right }
    : { pair, prompt: pair.right, answer: pair.left });

  // Every answer a prompt accepts: a synonym of the same prompt must never be shown as a wrong (X) statement.
  const accepted = new Map<string, Set<string>>();
  for (const { prompt, answer } of pairs) {
    const answers = accepted.get(answerKey(prompt)) ?? new Set<string>();
    answers.add(answerKey(answer));
    accepted.set(answerKey(prompt), answers);
  }

  let questions = pairs.map(({ pair, prompt, answer }): TrueFalseQuestion<TSource> => {
    const random = createSeededRandom(`${String(seed)}:${pair.id}`);
    const ownAnswers = accepted.get(answerKey(prompt))!;
    const wrong = shuffled(pairs.filter((other) => !ownAnswers.has(answerKey(other.answer))), `${String(seed)}:${pair.id}:wrong`)[0];
    const isTrue = !wrong || random() < trueRatio;
    return {
      id: `true-false:${direction}:${pair.id}`,
      kind: "true-false",
      prompt,
      statement: isTrue ? answer : wrong.answer,
      isTrue,
      correctAnswer: answer,
      direction,
      source: pair.source,
    };
  });
  if (input.shuffleQuestions ?? true) questions = shuffled(questions, `${String(seed)}:questions`);
  if (input.questionLimit !== undefined) {
    if (!Number.isInteger(input.questionLimit) || input.questionLimit < 1) throw new Error("문제 수 제한은 1 이상의 정수여야 합니다.");
    questions = questions.slice(0, input.questionLimit);
  }
  const canonical = validateCanonicalQuestionSet({ id: input.id, title: input.title, type: "true-false" as const, questions });
  return { ...canonical, type: "true-false", direction };
}
