import assert from "node:assert/strict";
import { createEmptyProgress, type GameProgress } from "../src/game-engine/progress/index.ts";
import {
  mergeProgressTransition,
  progressOperationId,
  reconcileProgressSnapshot,
} from "../src/multiplayer/game-progress/mutation.ts";

interface MutationStore {
  readonly progressByScope: Map<string, GameProgress>;
  readonly operations: Set<string>;
}

function commit(
  store: MutationStore,
  scope: { readonly roomId: string; readonly roundId: string; readonly playerId: string },
  operationId: string,
  previous: GameProgress,
  next: GameProgress,
): GameProgress {
  const scopeKey = `${scope.roomId}/${scope.roundId}/${progressOperationId(scope.playerId, operationId)}`;
  const progressKey = `${scope.roomId}/${scope.roundId}/${scope.playerId}`;
  const current = store.progressByScope.get(progressKey) ?? createEmptyProgress();
  if (store.operations.has(scopeKey)) return current;
  const committed = mergeProgressTransition(current, previous, next);
  store.operations.add(scopeKey);
  store.progressByScope.set(progressKey, committed);
  return committed;
}

function withScore(progress: GameProgress, scoreDelta: number): GameProgress {
  return {
    ...progress,
    score: progress.score + scoreDelta,
    correctCount: progress.correctCount + 1,
    attemptCount: progress.attemptCount + 1,
  };
}

const scope = { roomId: "room-1", roundId: "round-1", playerId: "student-1" };
const store: MutationStore = { progressByScope: new Map(), operations: new Set() };
const empty = createEmptyProgress();
const firstAttempt = withScore(empty, 100);

assert.equal(commit(store, scope, "attempt-a", empty, firstAttempt).score, 100);
assert.equal(commit(store, scope, "attempt-a", empty, firstAttempt).score, 100, "동일 attemptId는 한 번만 반영되어야 합니다.");

const ackLossStore: MutationStore = { progressByScope: new Map(), operations: new Set() };
commit(ackLossStore, scope, "ack-loss", empty, firstAttempt);
const retryAfterLostAck = commit(ackLossStore, scope, "ack-loss", empty, firstAttempt);
assert.equal(retryAfterLostAck.score, 100, "commit 성공 후 ACK가 유실되어 retry해도 점수가 중복되면 안 됩니다.");

const concurrentStore: MutationStore = { progressByScope: new Map(), operations: new Set() };
const score300 = { ...empty, score: 300, correctCount: 3, attemptCount: 3 };
concurrentStore.progressByScope.set(`${scope.roomId}/${scope.roundId}/${scope.playerId}`, score300);
const staleNext = withScore(score300, 100);
commit(concurrentStore, scope, "tab-a", score300, staleNext);
const concurrentResult = commit(concurrentStore, scope, "tab-b", score300, staleNext);
assert.equal(concurrentResult.score, 500, "두 stale writer의 delta가 모두 직렬 적용되어야 합니다.");
assert.equal(concurrentResult.correctCount, 5);
assert.equal(concurrentResult.attemptCount, 5);

const otherPlayer = { ...scope, playerId: "student-2" };
assert.notEqual(progressOperationId(scope.playerId, "shared-attempt"), progressOperationId(otherPlayer.playerId, "shared-attempt"));
assert.equal(commit(store, scope, "shared-attempt", empty, firstAttempt).score, 200);
assert.equal(commit(store, otherPlayer, "shared-attempt", empty, firstAttempt).score, 100, "다른 학생의 같은 attemptId는 독립적이어야 합니다.");

const otherRound = { ...scope, roundId: "round-2" };
assert.equal(commit(store, otherRound, "attempt-a", empty, firstAttempt).score, 100, "다른 round의 같은 attemptId는 독립적이어야 합니다.");

const cached = { score: 100, revision: 2, updatedAtMs: 20 };
const server = { score: 300, revision: 3, updatedAtMs: 30 };
assert.equal(reconcileProgressSnapshot(cached, server), server, "newer server revision이 cached progress를 교체해야 합니다.");
assert.equal(reconcileProgressSnapshot(server, cached), server, "늦게 도착한 stale revision이 최신 progress를 덮으면 안 됩니다.");

console.log("multiplayer progress idempotency and reconciliation tests passed");
