import { evaluateMultipleChoice, type MultipleChoiceAnswer, type MultipleChoiceQuestion } from "../../game-engine/question-engine/multiple-choice/index.ts";
import type { LearningSetQuestionSource } from "../../learning-sets/multipleChoiceTypes.ts";

export const SIMPLE_QUIZ_COMBO_SCORING = Object.freeze({ bonusPerStep: 20, maximumBonus: 100 });

export function evaluateSimpleQuizAnswer(
  question: MultipleChoiceQuestion<LearningSetQuestionSource>,
  answer: MultipleChoiceAnswer,
) {
  return evaluateMultipleChoice(question, answer, 100);
}
