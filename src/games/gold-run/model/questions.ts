import { createAnswerResult } from "../../../game-engine/core/answerResult.ts";
import type { AnswerResult } from "../../../game-engine/core/types.ts";
import { applyResultToProgress, type GameProgress } from "../../../game-engine/progress/index.ts";
import { CHOICE_DIRECTION } from "../../../game-engine/question-engine/multiple-choice/index.ts";
import type { TrueFalseQuestion } from "../../../game-engine/question-engine/true-false/index.ts";
import { adaptLearningSetToTrueFalse } from "../../../learning-sets/trueFalseAdapter.ts";
import type { LearningSetQuestionSource } from "../../../learning-sets/multipleChoiceTypes.ts";
import type { RuntimeLearningSet } from "../../../learning-sets/types.ts";

/* The OX side of Gold Run: which word pair each gate asks about, and how a gate becomes a saved attempt. */

export type GoldRunQuestion = TrueFalseQuestion<LearningSetQuestionSource>;

/** `null`: the runner hit the wall between the O and X gates. */
export interface GoldRunAnswer {
  readonly value: boolean | null;
}

export interface GoldRunDetails {
  readonly selected: boolean | null;
  readonly isTrue: boolean;
  readonly correctAnswer: string;
  /** Gold picked up since the previous gate. */
  readonly coins: number;
}

export type GoldRunProgress = GameProgress<GoldRunDetails>;

export function buildGoldRunQuestions(set: RuntimeLearningSet, config: Readonly<Record<string, unknown>>, seed: string): readonly GoldRunQuestion[] {
  if (set.type !== "vocabulary") throw new Error("골드런은 단어 세트로 플레이할 수 있습니다.");
  return adaptLearningSetToTrueFalse(set, {
    direction: config.direction === "meaning-to-source" ? CHOICE_DIRECTION.RIGHT_TO_LEFT : CHOICE_DIRECTION.LEFT_TO_RIGHT,
    seed: `${seed}:gold-run`,
  }).questions;
}

/** Questions repeat once the deck runs out. */
export function goldRunQuestionAt(questions: readonly GoldRunQuestion[], index: number): GoldRunQuestion {
  const question = questions[index % questions.length];
  if (!question) throw new Error("사용할 수 있는 문제가 없습니다.");
  return question;
}

/**
 * A passed gate as an attempt. `points` is everything the run earned since the previous gate
 * (distance, gold and the gate itself), so it counts even when the gate was wrong.
 */
export function passGate(progress: GoldRunProgress, question: GoldRunQuestion, answer: GoldRunAnswer, points: number, coins: number): { result: AnswerResult<GoldRunDetails>; progress: GoldRunProgress } {
  const isCorrect = answer.value === question.isTrue;
  const result = createAnswerResult<GoldRunDetails>({ isCorrect, scoreDelta: points,
    details: { selected: answer.value, isTrue: question.isTrue, correctAnswer: question.correctAnswer, coins } });
  const applied = applyResultToProgress(progress, question.id, result);
  return { result, progress: {
    ...applied,
    score: progress.score + points,
    currentIndex: progress.currentIndex + 1,
    combo: isCorrect ? progress.combo + 1 : 0,
    // Repeated questions must keep counting.
    completedItemIds: [],
  } };
}
