import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { tenantLearningSetsCollection } from "../../shared/tenantData.js";
import { isRecord } from "../../shared/validation.js";
import { db } from "../../shared/firebase.js";
import { applySoloQuestionAnswer } from "../model.js";
import {
  assertSoloRunIdentity,
  authoritativeProgress,
  emptySoloQuestionState,
  soloAttemptAnswer,
  soloQuestionStateFor,
  soloRunPointer,
  soloRuns,
  validateSoloQuestionState,
  verifySoloScope,
  type SoloStudent,
} from "../shared.js";
import { verifySoloLearningSet } from "./learningSet.js";

export interface SoloSentenceAnswerInput {
  readonly runId: string;
  readonly gameId: "sentence-builder";
  readonly questionId: string;
  readonly itemId: string;
  readonly currentIndex: number;
  readonly attemptId: string;
  readonly tokenIds: readonly string[];
}

export async function submitSoloSentenceAnswer(student: SoloStudent, input: SoloSentenceAnswerInput) {
  const runRef = soloRuns(student.tenantId).doc(input.runId);
  const initialSnapshot = await runRef.get();
  const initial: unknown = initialSnapshot.exists ? initialSnapshot.data() : null;
  if (!isRecord(initial)) throw new HttpsError("permission-denied", "본인 Solo run만 이용할 수 있습니다.");
  assertSoloRunIdentity(initial, student, input.gameId);
  const scopeId = verifySoloScope(initial);
  const setId = typeof initial.setId === "string" ? initial.setId : "";
  if (!setId) throw new HttpsError("failed-precondition", "Solo 학습 세트를 확인할 수 없습니다.");

  const setRef = tenantLearningSetsCollection(student.tenantId).doc(setId);
  const contentRef = setRef.collection("content").doc("main");
  const activeRef = soloRunPointer(student.tenantId, student.studentAccountId);
  const progressRef = authoritativeProgress(runRef, student.uid);
  const answerRef = soloAttemptAnswer(runRef, input.questionId, input.attemptId);
  const completedAtMs = Date.now();

  return db.runTransaction(async (tx) => {
    const [runSnapshot, pointerSnapshot, progressSnapshot, answerSnapshot, metadataSnapshot, contentSnapshot] = await Promise.all([
      tx.get(runRef), tx.get(activeRef), tx.get(progressRef), tx.get(answerRef), tx.get(setRef), tx.get(contentRef),
    ]);
    const rawRun: unknown = runSnapshot.exists ? runSnapshot.data() : null;
    if (!isRecord(rawRun)) throw new HttpsError("permission-denied", "본인 Solo run만 이용할 수 있습니다.");
    assertSoloRunIdentity(rawRun, student, input.gameId);
    if (verifySoloScope(rawRun) !== scopeId) throw new HttpsError("failed-precondition", "Solo leaderboard 범위가 바뀌었습니다.");
    if (rawRun.status !== "active" || pointerSnapshot.data()?.runId !== input.runId) {
      throw new HttpsError("failed-precondition", "진행 중인 Solo run만 정답을 제출할 수 있습니다.");
    }
    if (answerSnapshot.exists) {
      const saved: unknown = answerSnapshot.data();
      if (!isRecord(saved) || saved.questionId !== input.questionId || saved.itemId !== input.itemId
        || saved.questionIndex !== input.currentIndex || !isRecord(saved.progress)) {
        throw new HttpsError("failed-precondition", "저장된 정답 제출을 확인할 수 없습니다.");
      }
      return saved.progress;
    }

    const state = progressSnapshot.exists
      ? validateSoloQuestionState(progressSnapshot.data(), input.runId, student, input.gameId)
      : emptySoloQuestionState();
    if (!state) throw new HttpsError("failed-precondition", "서버의 Solo 진행 상황을 확인할 수 없습니다.");
    const setFingerprint = typeof rawRun.setFingerprint === "string" ? rawRun.setFingerprint : "";
    if (!setFingerprint) throw new HttpsError("failed-precondition", "Solo 학습 세트 지문을 확인할 수 없습니다.");
    const learningSet = verifySoloLearningSet({
      gameId: input.gameId,
      tenantId: student.tenantId,
      setId,
      setFingerprint,
      metadata: metadataSnapshot.exists ? metadataSnapshot.data() : null,
      content: contentSnapshot.exists ? contentSnapshot.data() : null,
    });

    if (input.currentIndex !== state.expectedQuestionIndex || input.currentIndex >= learningSet.items.length) {
      throw new HttpsError("failed-precondition", "현재 Solo 문항 순서가 일치하지 않습니다.");
    }
    const item = learningSet.items[input.currentIndex];
    if (!item || item.id !== input.itemId || item.id !== input.questionId) {
      throw new HttpsError("invalid-argument", "선택한 문장 만들기 문항을 확인할 수 없습니다.");
    }
    const chunks = item.sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean);
    const expectedTokenIds = chunks.map((_, index) => `${item.id}:chunk:${index}`);
    if (input.tokenIds.length !== expectedTokenIds.length || new Set(input.tokenIds).size !== expectedTokenIds.length
      || input.tokenIds.some((tokenId) => !expectedTokenIds.includes(tokenId))) {
      throw new HttpsError("invalid-argument", "문장 조각 제출이 현재 문항과 일치하지 않습니다.");
    }
    const isCorrect = input.tokenIds.every((tokenId, index) => tokenId === expectedTokenIds[index]);
    const nextState = applySoloQuestionAnswer(state, {
      currentIndex: input.currentIndex,
      questionId: input.questionId,
      isCorrect,
      baseScore: 100,
      comboBonusPerStep: 20,
      comboMaximumBonus: 100,
      feedback: isCorrect ? "정답입니다! 다음 문제로 이동하세요." : "순서가 맞지 않습니다. 다시 배열해보세요.",
      details: { selectedCount: input.tokenIds.length, expectedCount: expectedTokenIds.length },
    });
    const answerResult = nextState.progress.lastResult;
    if (!answerResult) throw new HttpsError("internal", "정답 결과를 계산하지 못했습니다.");
    tx.create(answerRef, {
      questionId: input.questionId,
      itemId: input.itemId,
      questionIndex: input.currentIndex,
      attemptId: input.attemptId,
      result: answerResult,
      progress: nextState.progress,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: completedAtMs,
    });
    tx.set(progressRef, {
      ...soloQuestionStateFor(input.runId, student, input.gameId, nextState),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: completedAtMs,
    });
    return nextState.progress;
  });
}
