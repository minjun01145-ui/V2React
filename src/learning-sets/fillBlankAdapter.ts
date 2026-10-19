import { buildFillBlankSet, type FillBlankQuestionSet } from "../game-engine/question-engine/fill-blank/index.ts";
import type { FillBlankBank } from "./fillBlankBank.ts";
import { LEARNING_SET_QUESTION_SCOPE, type LearningSetQuestionSource } from "./multipleChoiceTypes.ts";
import { withoutChunkMarkers } from "./questionPairs.ts";
import { LEARNING_SET_TYPE, type RuntimeLearningSet } from "./types.ts";

export interface LearningSetFillBlankOptions {
  /** Options per question including the answer, 2–5. */
  readonly choiceCount: number;
  /** AI-prepared blanks (loadFillBlankBank in fillBlankBankRepository.ts); sentences without an up-to-date entry use rule-made blanks. */
  readonly bank?: FillBlankBank;
  readonly seed?: string | number;
  readonly questionLimit?: number;
}

/** One blank per sentence of a reading set; a new seed gives a different blank and option mix. */
export function adaptLearningSetToFillBlank(set: RuntimeLearningSet, options: LearningSetFillBlankOptions): FillBlankQuestionSet<LearningSetQuestionSource> {
  if (set.type !== LEARNING_SET_TYPE.READING_CHUNKS) throw new Error("빈칸 채우기는 끊어읽기 세트에서만 만들 수 있습니다.");
  return buildFillBlankSet({
    id: `${set.id}:fill-blank:${options.choiceCount}`,
    title: set.name,
    sentences: set.items.map((item, itemIndex) => {
      const prepared = options.bank?.get(item.id);
      return {
        id: item.id,
        text: withoutChunkMarkers(item.sourceText),
        meaning: withoutChunkMarkers(item.meaning),
        ...(prepared && prepared.sourceText === item.sourceText ? { prepared: prepared.blanks } : {}),
        source: { setId: set.id, itemId: item.id, itemIndex, scope: LEARNING_SET_QUESTION_SCOPE.ENTRY, chunkIndex: null },
      };
    }),
    choiceCount: options.choiceCount,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.questionLimit === undefined ? {} : { questionLimit: options.questionLimit }),
  });
}
