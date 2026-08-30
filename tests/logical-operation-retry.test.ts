import assert from "node:assert/strict";
import {
  beginLogicalOperation,
  completeLogicalOperation,
  LogicalOperationConflictError,
  logicalOperationKey,
  type PendingLogicalOperation,
} from "../src/game-engine/core/logicalOperation.ts";

let sequence = 0;
const createOperationId = () => `operation-${++sequence}`;

function begin<T>(
  pending: PendingLogicalOperation<T> | null,
  logicalKey: string,
  payload: T,
): PendingLogicalOperation<T> {
  return beginLogicalOperation({
    pending,
    logicalKey,
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

const uncertainSubmit = begin(null, logicalOperationKey(["answer", "round-1", "question-2", 1, { optionId: "answer-b" }]), { answer: "answer-b" });
const unrelatedCanonicalProgress = { revision: 99, lastOperationId: "unrelated-operation-b" };
const afterUnrelatedCanonicalOperation = completeLogicalOperation(uncertainSubmit, unrelatedCanonicalProgress.lastOperationId);
assert.equal(afterUnrelatedCanonicalOperation, uncertainSubmit, "unrelated revision/operation은 pending A를 성공으로 확정하면 안 됩니다.");
const retryAfterUnrelatedOperation = begin(afterUnrelatedCanonicalOperation, uncertainSubmit.logicalKey, { answer: "replacement" });
assert.equal(retryAfterUnrelatedOperation.operationId, uncertainSubmit.operationId, "unrelated operation 이후에도 같은 action retry는 A를 유지해야 합니다.");
assert.equal(completeLogicalOperation(uncertainSubmit, uncertainSubmit.operationId), null, "repository duplicate 결과나 exact operation snapshot은 A를 명시적으로 완료할 수 있어야 합니다.");

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
const sequenceBeforeConflict = sequence;
let conflictPayloadCreated = false;
assert.throws(
  () => beginLogicalOperation({
    pending: matchingAttempt,
    logicalKey: differentPairKey,
    createOperationId,
    createPayload: () => {
      conflictPayloadCreated = true;
      return { scoreDelta: 100 };
    },
  }),
  LogicalOperationConflictError,
  "unresolved matching operation이 있으면 다른 pair mutation을 시작하면 안 됩니다.",
);
assert.equal(sequence, sequenceBeforeConflict, "conflict는 B operationId를 생성하면 안 됩니다.");
assert.equal(conflictPayloadCreated, false, "conflict는 B mutation payload도 만들면 안 됩니다.");
const completedMatching = completeLogicalOperation(matchingAttempt, matchingAttempt.operationId);
const differentPairAfterCompletion = begin(completedMatching, differentPairKey, { scoreDelta: 100 });
assert.notEqual(differentPairAfterCompletion.operationId, matchingAttempt.operationId, "A가 명시적으로 완료된 뒤에는 B에 새 operationId를 허용해야 합니다.");

console.log("logical operation retry identity tests passed");
