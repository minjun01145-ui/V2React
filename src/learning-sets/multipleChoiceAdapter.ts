import {
  buildMultipleChoiceSet,
  CHOICE_DIRECTION,
  type MultipleChoicePair,
  type MultipleChoiceQuestionSet,
} from "../game-engine/question-engine/multiple-choice/index.ts";
import {
  LEARNING_SET_QUESTION_SCOPE,
  type LearningSetMultipleChoiceOptions,
  type LearningSetQuestionSource,
} from "./multipleChoiceTypes.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "./types.ts";

function withoutChunkMarkers(value: string): string {
  return value.split("/").map((chunk) => chunk.trim()).filter(Boolean).join(" ");
}

function entryPairs(set: LearningSet): readonly MultipleChoicePair<LearningSetQuestionSource>[] {
  return set.items.map((item, itemIndex) => ({
    id: item.id,
    left: set.type === LEARNING_SET_TYPE.READING_CHUNKS ? withoutChunkMarkers(item.sourceText) : item.sourceText,
    right: set.type === LEARNING_SET_TYPE.READING_CHUNKS ? withoutChunkMarkers(item.meaning) : item.meaning,
    source: { setId: set.id, itemId: item.id, itemIndex, scope: LEARNING_SET_QUESTION_SCOPE.ENTRY, chunkIndex: null },
  }));
}

function chunkPairs(set: LearningSet): readonly MultipleChoicePair<LearningSetQuestionSource>[] {
  if (set.type !== LEARNING_SET_TYPE.READING_CHUNKS) throw new Error("덩어리 객관식은 끊어읽기 세트에서만 만들 수 있습니다.");
  return set.items.flatMap((item, itemIndex) => {
    const sourceChunks = item.sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean);
    const meaningChunks = item.meaning.split("/").map((chunk) => chunk.trim()).filter(Boolean);
    if (sourceChunks.length < 2 || sourceChunks.length !== meaningChunks.length) {
      throw new Error(`${itemIndex + 1}번째 문항은 영어와 뜻의 덩어리 수가 같아야 합니다.`);
    }
    return sourceChunks.map((sourceChunk, chunkIndex) => ({
      id: `${item.id}:chunk:${chunkIndex}`,
      left: sourceChunk,
      right: meaningChunks[chunkIndex] ?? "",
      source: { setId: set.id, itemId: item.id, itemIndex, scope: LEARNING_SET_QUESTION_SCOPE.CHUNK, chunkIndex },
    }));
  });
}

export function adaptLearningSetToMultipleChoice(
  set: LearningSet,
  options: LearningSetMultipleChoiceOptions,
): MultipleChoiceQuestionSet<LearningSetQuestionSource> {
  const scope = options.scope ?? LEARNING_SET_QUESTION_SCOPE.ENTRY;
  const pairs = scope === LEARNING_SET_QUESTION_SCOPE.CHUNK ? chunkPairs(set) : entryPairs(set);
  return buildMultipleChoiceSet({
    id: `${set.id}:multiple-choice:${scope}:${options.direction}:${options.choiceCount}`,
    title: set.name,
    pairs,
    choiceCount: options.choiceCount,
    direction: options.direction,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.questionLimit === undefined ? {} : { questionLimit: options.questionLimit }),
    ...(options.shuffleQuestions === undefined ? {} : { shuffleQuestions: options.shuffleQuestions }),
  });
}

export { CHOICE_DIRECTION };
export { LEARNING_SET_QUESTION_SCOPE } from "./multipleChoiceTypes.ts";
export type { LearningSetMultipleChoiceOptions, LearningSetQuestionSource, LearningSetQuestionScope } from "./multipleChoiceTypes.ts";
