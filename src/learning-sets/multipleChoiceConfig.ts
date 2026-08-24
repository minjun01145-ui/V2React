import { parseChoiceCount, parseChoiceDirection } from "../game-engine/question-engine/multiple-choice/validation.ts";
import { LEARNING_SET_QUESTION_SCOPE, type LearningSetMultipleChoiceOptions, type LearningSetQuestionScope } from "./multipleChoiceTypes.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScope(value: unknown): LearningSetQuestionScope {
  if (value === undefined || value === LEARNING_SET_QUESTION_SCOPE.ENTRY) return LEARNING_SET_QUESTION_SCOPE.ENTRY;
  if (value === LEARNING_SET_QUESTION_SCOPE.CHUNK) return LEARNING_SET_QUESTION_SCOPE.CHUNK;
  throw new Error("객관식 문제 범위는 전체 항목 또는 덩어리여야 합니다.");
}

export function parseLearningSetMultipleChoiceOptions(value: unknown): LearningSetMultipleChoiceOptions {
  if (!isRecord(value)) throw new Error("객관식 게임 설정을 확인해 주세요.");
  const questionLimit = value.questionLimit === undefined ? undefined : Number(value.questionLimit);
  if (questionLimit !== undefined && (!Number.isInteger(questionLimit) || questionLimit < 1 || questionLimit > 500)) {
    throw new Error("객관식 문제 수는 1개부터 500개까지 설정할 수 있습니다.");
  }
  const seed = typeof value.seed === "string" || typeof value.seed === "number" ? value.seed : undefined;
  return {
    choiceCount: parseChoiceCount(value.choiceCount),
    direction: parseChoiceDirection(value.direction),
    scope: parseScope(value.scope),
    ...(seed === undefined ? {} : { seed }),
    ...(questionLimit === undefined ? {} : { questionLimit }),
    ...(typeof value.shuffleQuestions === "boolean" ? { shuffleQuestions: value.shuffleQuestions } : {}),
  };
}
