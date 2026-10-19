import { buildFillBlankSet, type FillBlankQuestionSet } from "../game-engine/question-engine/fill-blank/index.ts";
import { LEARNING_SET_QUESTION_SCOPE, type LearningSetQuestionSource } from "./multipleChoiceTypes.ts";
import { withoutChunkMarkers } from "./questionPairs.ts";
import { LEARNING_SET_TYPE, type RuntimeLearningSet } from "./types.ts";

export interface LearningSetFillBlankOptions {
  /** Options per question including the answer, 2–5. */
  readonly choiceCount: number;
  readonly seed?: string | number;
  readonly questionLimit?: number;
}

/** One blank per sentence of a reading set; distractors come from the set's own words. */
export function adaptLearningSetToFillBlank(set: RuntimeLearningSet, options: LearningSetFillBlankOptions): FillBlankQuestionSet<LearningSetQuestionSource> {
  if (set.type !== LEARNING_SET_TYPE.READING_CHUNKS) throw new Error("빈칸 채우기는 끊어읽기 세트에서만 만들 수 있습니다.");
  return buildFillBlankSet({
    id: `${set.id}:fill-blank:${options.choiceCount}`,
    title: set.name,
    sentences: set.items.map((item, itemIndex) => ({
      id: item.id,
      text: withoutChunkMarkers(item.sourceText),
      meaning: withoutChunkMarkers(item.meaning),
      source: { setId: set.id, itemId: item.id, itemIndex, scope: LEARNING_SET_QUESTION_SCOPE.ENTRY, chunkIndex: null },
    })),
    choiceCount: options.choiceCount,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.questionLimit === undefined ? {} : { questionLimit: options.questionLimit }),
  });
}
