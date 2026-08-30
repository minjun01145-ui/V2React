import assert from "node:assert/strict";
import {
  beginLogicalOperation,
  completeLogicalOperation,
  logicalOperationKey,
  reconcileLogicalOperation,
  type PendingLogicalOperation,
} from "../src/game-engine/core/logicalOperation.ts";

let sequence = 0;
const createOperationId = () => `operation-${++sequence}`;

function begin<T>(
  pending: PendingLogicalOperation<T> | null,
  logicalKey: string,
  payload: T,
  baseRevision = 4,
): PendingLogicalOperation<T> {
  return beginLogicalOperation({
    pending,
    logicalKey,
    baseRevision,
    createPayload: () => payload,
    createOperationId,
  });
}

const submitKey = logicalOperationKey(["answer", "round-1", "question-1", 0, { optionId: "answer-a" }]);
const submit = begin(null, submitKey, { answer: "answer-a" });
assert.equal(submit.operationId, "operation-1");

const retryAfterUnknownResult = begin(submit, submitKey, { answer: "must-not-replace-the-original-payload" });
assert.equal(retryAfterUnknownResult, submit, "동일 submit retry는 같은 pending operation을 재사용해야 합니다.");
assert.equal(retryAfterUnknownResult.operationId, "operation-1");
assert.deepEqual(retryAfterUnknownResult.payload, { answer: "answer-a" });

const afterConfirmedSubmit = completeLogicalOperation(submit, submit.operationId);
assert.equal(afterConfirmedSubmit, null);
const newSubmit = begin(afterConfirmedSubmit, submitKey, { answer: "answer-a" });
assert.equal(newSubmit.operationId, "operation-2", "확인된 성공 뒤의 새 사용자 동작은 새 ID여야 합니다.");

const uncertainSubmit = begin(null, logicalOperationKey(["answer", "round-1", "question-2", 1, { optionId: "answer-b" }]), { answer: "answer-b" }, 8);
assert.equal(reconcileLogicalOperation(uncertainSubmit, 8, null), uncertainSubmit);
assert.equal(reconcileLogicalOperation(uncertainSubmit, 9, uncertainSubmit.operationId), null, "remote progress에서 동일 operation이 확인되면 pending을 제거해야 합니다.");

const overwrittenLastOperation = begin(null, logicalOperationKey(["answer", "round-1", "question-3", 2, { optionId: "answer-c" }]), { answer: "answer-c" }, 11);
assert.equal(reconcileLogicalOperation(overwrittenLastOperation, 12, "later-operation"), null, "canonical revision이 앞서가면 불확실한 이전 동작을 다시 mutation하면 안 됩니다.");

const nextKey = logicalOperationKey(["next-question", "round-1", "question-3", 2]);
const nextTransition = begin(null, nextKey, { from: 2, to: 3 });
const nextRetry = begin(nextTransition, nextKey, { from: 2, to: 999 });
assert.equal(nextRetry.operationId, nextTransition.operationId, "nextQuestion retry도 같은 operation ID를 유지해야 합니다.");
assert.deepEqual(nextRetry.payload, { from: 2, to: 3 });

const matchingBoard = ["card-d", "card-a", "card-c", "card-b"].sort();
const matchingKey = logicalOperationKey(["matching-pair", "round-1", matchingBoard, ["card-a", "card-b"].sort()]);
const matchingAttempt = begin(null, matchingKey, { scoreDelta: 100 });
const matchingRetryKey = logicalOperationKey(["matching-pair", "round-1", [...matchingBoard].reverse().sort(), ["card-b", "card-a"].sort()]);
assert.equal(begin(matchingAttempt, matchingRetryKey, { scoreDelta: 200 }).operationId, matchingAttempt.operationId, "matching 동일 pair retry는 ID를 유지해야 합니다.");

const matchingAllKey = logicalOperationKey([
  "matching-all-result",
  "round-1",
  matchingBoard,
  ["card-a", "card-b"].sort(),
  true,
  ["pair-4", "pair-1", "pair-3", "pair-2"].sort(),
]);
const matchingAllAttempt = begin(null, matchingAllKey, { scoreDelta: 500 });
const matchingAllRetry = begin(matchingAllAttempt, matchingAllKey, { scoreDelta: 999 });
assert.equal(matchingAllRetry.operationId, matchingAllAttempt.operationId, "matching-all 동일 board result retry는 ID를 유지해야 합니다.");

const differentPairKey = logicalOperationKey(["matching-pair", "round-1", matchingBoard, ["card-c", "card-d"].sort()]);
assert.notEqual(begin(matchingAttempt, differentPairKey, { scoreDelta: 100 }).operationId, matchingAttempt.operationId, "다른 pair는 새로운 logical operation이어야 합니다.");

console.log("logical operation retry identity tests passed");
