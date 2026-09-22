import type { ChunkLineUpBoard } from "../../multiplayer/chunk-line-up/types.ts";

export const CHUNK_LINE_UP_CHANNEL_ID = "chunk-line-up";
export const CHUNK_LINE_UP_WORLD_WIDTH = 1_040;
export const CHUNK_LINE_UP_WORLD_HEIGHT = 604;

export function chunkLineUpRanking(board: ChunkLineUpBoard) {
  return Object.values(board.assignments)
    .map((assignment) => ({ playerId: assignment.playerId, label: assignment.label, score: assignment.score }))
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "ko-KR"));
}
