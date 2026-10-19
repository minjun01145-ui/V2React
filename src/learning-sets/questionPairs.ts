import type { MultipleChoicePair } from "../game-engine/question-engine/multiple-choice/types.ts";
import { LEARNING_SET_QUESTION_SCOPE, type LearningSetQuestionScope, type LearningSetQuestionSource } from "./multipleChoiceTypes.ts";
import { LEARNING_SET_TYPE, type RuntimeLearningSet } from "./types.ts";

/** "I / have / a dog." → "I have a dog." */
export function withoutChunkMarkers(value: string): string {
  return value.split("/").map((chunk) => chunk.trim()).filter(Boolean).join(" ");
}

function entryPairs(set: RuntimeLearningSet): MultipleChoicePair<LearningSetQuestionSource>[] {
  const reading = set.type === LEARNING_SET_TYPE.READING_CHUNKS;
  return set.items.map((item, itemIndex) => ({
    id: item.id,
    left: reading ? withoutChunkMarkers(item.sourceText) : item.sourceText,
    right: reading ? withoutChunkMarkers(item.meaning) : item.meaning,
    source: { setId: set.id, itemId: item.id, itemIndex, scope: LEARNING_SET_QUESTION_SCOPE.ENTRY, chunkIndex: null },
  }));
}

function chunkPairs(set: RuntimeLearningSet): MultipleChoicePair<LearningSetQuestionSource>[] {
  if (set.type !== LEARNING_SET_TYPE.READING_CHUNKS) throw new Error("덩어리 단위 문제는 끊어읽기 세트에서만 만들 수 있습니다.");
  return set.items.flatMap((item, itemIndex) => {
    const sourceChunks = item.sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean);
    const meaningChunks = item.meaning.split("/").map((chunk) => chunk.trim()).filter(Boolean);
    if (sourceChunks.length !== meaningChunks.length) {
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

/** English–meaning pairs of a set: whole entries, or each reading chunk on its own. */
export function learningSetPairs(set: RuntimeLearningSet, scope: LearningSetQuestionScope = LEARNING_SET_QUESTION_SCOPE.ENTRY): MultipleChoicePair<LearningSetQuestionSource>[] {
  return scope === LEARNING_SET_QUESTION_SCOPE.CHUNK ? chunkPairs(set) : entryPairs(set);
}
