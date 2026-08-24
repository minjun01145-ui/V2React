export { evaluateMultipleChoice } from "./evaluator.ts";
export { buildMultipleChoiceSet } from "./generator.ts";
export { CHOICE_DIRECTION } from "./types.ts";
export type {
  BuildMultipleChoiceSetInput,
  ChoiceCount,
  ChoiceDirection,
  MultipleChoiceAnswer,
  MultipleChoiceEvaluationDetails,
  MultipleChoiceOption,
  MultipleChoicePair,
  MultipleChoiceQuestion,
  MultipleChoiceQuestionSet,
} from "./types.ts";
export { parseChoiceCount, parseChoiceDirection, validateMultipleChoicePairs } from "./validation.ts";
