import { shuffled } from "../../game-engine/core/random.ts";
import { adaptReadingChunksToSequence } from "../../learning-sets/sentenceSequenceAdapter.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";

export const CHUNK_JUMP_CHANNEL_ID = "chunk-jump-race";
export const CHUNK_JUMP_RESPAWN_PENALTY = 5;

export interface ChunkJumpSentence {
  readonly id: string;
  readonly meaning: string;
  readonly chunks: readonly string[];
}

export interface ChunkJumpCourse {
  readonly sentences: readonly ChunkJumpSentence[];
  readonly chunkPool: readonly string[];
}

export interface ChunkJumpCursor {
  readonly sentenceIndex: number;
  readonly chunkIndex: number;
}

export interface ChunkJumpStep {
  readonly sentence: ChunkJumpSentence;
  readonly currentChunks: readonly string[];
  readonly answer: string;
}

export function buildChunkJumpCourse(set: RuntimeLearningSet): ChunkJumpCourse {
  const canonical = adaptReadingChunksToSequence(set);
  const sentences = canonical.questions.map((question) => ({
    id: question.id,
    meaning: question.prompt,
    chunks: question.tokens.map((token) => token.text),
  }));
  if (sentences.length === 0) throw new Error("점프 레이스에 사용할 끊어읽기 문장이 없습니다.");
  const chunkPool = [...new Set(sentences.flatMap((sentence) => sentence.chunks))];
  return { sentences, chunkPool };
}

export function initialChunkJumpCursor(): ChunkJumpCursor {
  return { sentenceIndex: 0, chunkIndex: 0 };
}

export function chunkJumpStep(course: ChunkJumpCourse, cursor: ChunkJumpCursor): ChunkJumpStep {
  const sentence = course.sentences[cursor.sentenceIndex % course.sentences.length];
  if (!sentence) throw new Error("점프 레이스 문장을 찾을 수 없습니다.");
  const chunkIndex = Math.min(Math.max(cursor.chunkIndex, 0), sentence.chunks.length - 2);
  const answer = sentence.chunks[chunkIndex + 1];
  if (!answer) throw new Error("다음 끊어읽기 조각을 찾을 수 없습니다.");
  return {
    sentence,
    currentChunks: sentence.chunks.slice(0, chunkIndex + 1),
    answer,
  };
}

export function advanceChunkJumpCursor(course: ChunkJumpCourse, cursor: ChunkJumpCursor): ChunkJumpCursor {
  const sentence = course.sentences[cursor.sentenceIndex % course.sentences.length];
  if (!sentence) return initialChunkJumpCursor();
  if (cursor.chunkIndex + 1 < sentence.chunks.length - 1) {
    return { sentenceIndex: cursor.sentenceIndex % course.sentences.length, chunkIndex: cursor.chunkIndex + 1 };
  }
  return {
    sentenceIndex: (cursor.sentenceIndex + 1) % course.sentences.length,
    chunkIndex: 0,
  };
}

export function chunkJumpChoices(
  course: ChunkJumpCourse,
  cursor: ChunkJumpCursor,
  seed: string,
  targetCount = 3,
): readonly string[] {
  const { answer } = chunkJumpStep(course, cursor);
  const distractors = shuffled(course.chunkPool.filter((chunk) => chunk !== answer), `${seed}:distractors`)
    .slice(0, Math.max(1, targetCount - 1));
  return shuffled([answer, ...distractors], `${seed}:positions`);
}
