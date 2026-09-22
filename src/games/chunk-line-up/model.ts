import type { ChunkLineUpBoard } from "../../multiplayer/chunk-line-up/types.ts";

export const CHUNK_LINE_UP_CHANNEL_ID = "chunk-line-up";
export const CHUNK_LINE_UP_WORLD_WIDTH = 1_040;
export const CHUNK_LINE_UP_WORLD_HEIGHT = 604;
const ELEVATOR_BOTTOM_WAIT_MS = 1_800;
const ELEVATOR_BOARDING_CLOSE_MS = 1_400;
const ELEVATOR_TRAVEL_MS = 2_400;
const ELEVATOR_TOP_WAIT_MS = 800;
const ELEVATOR_CYCLE_MS = ELEVATOR_BOTTOM_WAIT_MS + ELEVATOR_TRAVEL_MS + ELEVATOR_TOP_WAIT_MS + ELEVATOR_TRAVEL_MS;

export function chunkLineUpElevatorProgress(nowMs: number, epochMs: number): {
  readonly progress: number;
  readonly boarding: boolean;
  readonly cycle: number;
} {
  const relative = nowMs - epochMs;
  const cycle = Math.floor(relative / ELEVATOR_CYCLE_MS);
  const elapsed = ((relative % ELEVATOR_CYCLE_MS) + ELEVATOR_CYCLE_MS) % ELEVATOR_CYCLE_MS;
  if (elapsed < ELEVATOR_BOTTOM_WAIT_MS) {
    return { progress: 0, boarding: elapsed < ELEVATOR_BOARDING_CLOSE_MS, cycle };
  }
  const upEnd = ELEVATOR_BOTTOM_WAIT_MS + ELEVATOR_TRAVEL_MS;
  if (elapsed < upEnd) return { progress: (elapsed - ELEVATOR_BOTTOM_WAIT_MS) / ELEVATOR_TRAVEL_MS, boarding: false, cycle };
  const topEnd = upEnd + ELEVATOR_TOP_WAIT_MS;
  if (elapsed < topEnd) return { progress: 1, boarding: false, cycle };
  return { progress: 1 - (elapsed - topEnd) / ELEVATOR_TRAVEL_MS, boarding: false, cycle };
}

export function chunkLineUpRanking(board: ChunkLineUpBoard) {
  return Object.values(board.assignments)
    .map((assignment) => ({ playerId: assignment.playerId, label: assignment.label, score: assignment.score }))
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "ko-KR"));
}
