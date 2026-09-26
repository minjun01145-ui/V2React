import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../../ai/ollamaProvider.js";
import { consumeAiTutorTurn } from "../../ai-tutor/rateLimit.js";
import { resolveAiTutorRoundContext } from "../../ai-tutor/roundContext.js";
import { evaluateAiTutorContext } from "../../ai-tutor/service.js";
import type { AiTutorDirection, AiTutorReply, AiTutorRoundContext, AiTutorTurnInput } from "../../ai-tutor/types.js";
import { AiTutorValidationError, parseAiTutorReply } from "../../ai-tutor/validation.js";
import { db } from "../../shared/firebase.js";
import { tenantLearningSetsCollection } from "../../shared/tenantData.js";
import { isRecord } from "../../shared/validation.js";
import { applySoloQuestionAnswer } from "../model.js";
import type { SoloGameId } from "../registry.js";
import type { SoloQuestionAuthoritativeState } from "../model.js";
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
import { requireSoloStudent } from "../auth.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 120, maxInstances: 6, memory: "256MiB" } as const;

interface SoloAiTutorInput {
  readonly runId: string;
  readonly gameId: "ai-tutor" | "pokemon-catch";
  readonly attemptId: string;
  readonly questionId: string;
  readonly itemId: string;
  readonly currentIndex: number;
  readonly direction: AiTutorDirection | null;
  readonly message: string;
}

function parseInput(value: unknown): SoloAiTutorInput {
  if (!isRecord(value) || (value.gameId !== "ai-tutor" && value.gameId !== "pokemon-catch")) {
    throw new HttpsError("invalid-argument", "Solo AI 문답 요청이 올바르지 않습니다.");
  }
  const runId = typeof value.runId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value.runId) ? value.runId : "";
  const attemptId = typeof value.attemptId === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value.attemptId) ? value.attemptId : "";
  const questionId = typeof value.questionId === "string" ? value.questionId.trim() : "";
  const itemId = typeof value.itemId === "string" ? value.itemId.trim() : "";
  const currentIndex = value.currentIndex;
  const direction = value.direction == null ? null : value.direction === "source-to-meaning" || value.direction === "meaning-to-source" ? value.direction : undefined;
  const message = typeof value.message === "string" ? value.message.normalize("NFKC").trim() : "";
  if (!runId || !attemptId || !/^[\p{L}\p{N}:._-]{1,256}$/u.test(questionId) || !itemId || itemId.length > 256
    || typeof currentIndex !== "number" || !Number.isSafeInteger(currentIndex) || currentIndex < 0 || currentIndex > 10000
    || direction === undefined || (value.gameId === "pokemon-catch" && direction === null)
    || !message || message.length > 1000) {
    throw new HttpsError("invalid-argument", "Solo AI 문답 요청이 올바르지 않습니다.");
  }
  return { runId, gameId: value.gameId, attemptId, questionId, itemId, currentIndex, direction, message };
}

function stateFor(value: unknown, runId: string, student: SoloStudent, gameId: SoloGameId) {
  if (!isRecord(value)) return emptySoloQuestionState();
  const parsed = validateSoloQuestionState(value, runId, student, gameId);
  if (!parsed) throw new HttpsError("failed-precondition", "서버의 Solo 진행 상황을 확인할 수 없습니다.");
  return parsed;
}

function savedResponse(value: unknown, input: SoloAiTutorInput): { readonly reply: AiTutorReply; readonly progress: unknown } {
  if (!isRecord(value) || !isRecord(value.reply) || !isRecord(value.progress)) {
    throw new HttpsError("failed-precondition", "저장된 AI 문답 결과를 확인할 수 없습니다.");
  }
  if (value.questionId !== input.questionId || value.itemId !== input.itemId
    || value.questionIndex !== input.currentIndex || value.attemptId !== input.attemptId) {
    throw new HttpsError("failed-precondition", "저장된 AI 문답 제출이 현재 요청과 일치하지 않습니다.");
  }
  const reply = parseAiTutorReply(JSON.stringify(value.reply));
  return { reply, progress: value.progress };
}

function callableError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof AiTutorValidationError) return new HttpsError("invalid-argument", error.message);
  if (error instanceof AiProviderError) {
    logger.warn("Solo AI tutor provider request failed", { status: error.status, message: error.message });
    return new HttpsError("unavailable", "AI 선생님이 잠시 응답하지 못했습니다. 다시 시도해주세요.");
  }
  logger.error("Solo AI tutor turn failed", { message: error instanceof Error ? error.message : "unknown" });
  return new HttpsError("internal", "AI 문답을 처리하지 못했습니다.");
}

async function loadContext(student: SoloStudent, input: SoloAiTutorInput): Promise<{
  readonly run: Record<string, unknown>;
  readonly scopeId: string;
  readonly context: AiTutorRoundContext | null;
  readonly state: SoloQuestionAuthoritativeState;
  readonly duplicate?: { readonly reply: AiTutorReply; readonly progress: unknown };
}> {
  const runRef = soloRuns(student.tenantId).doc(input.runId);
  const attemptRef = soloAttemptAnswer(runRef, input.questionId, input.attemptId);
  const [runSnapshot, activeSnapshot, progressSnapshot, attemptSnapshot] = await Promise.all([
    runRef.get(),
    soloRunPointer(student.tenantId, student.studentAccountId).get(),
    authoritativeProgress(runRef, student.uid).get(),
    attemptRef.get(),
  ]);
  const run: unknown = runSnapshot.exists ? runSnapshot.data() : null;
  if (!isRecord(run)) throw new HttpsError("permission-denied", "본인 Solo run만 이용할 수 있습니다.");
  assertSoloRunIdentity(run, student, input.gameId);
  const scopeId = verifySoloScope(run);
  if (run.status !== "active" || activeSnapshot.data()?.runId !== input.runId) {
    throw new HttpsError("failed-precondition", "진행 중인 Solo run만 AI 문답을 이용할 수 있습니다.");
  }
  if (typeof run.setId !== "string" || typeof run.setFingerprint !== "string") {
    throw new HttpsError("failed-precondition", "Solo 학습 세트를 확인할 수 없습니다.");
  }
  const state = progressSnapshot.exists
    ? stateFor(progressSnapshot.data(), input.runId, student, input.gameId)
    : emptySoloQuestionState();
  if (attemptSnapshot.exists) {
    return { run, scopeId, context: null, state, duplicate: savedResponse(attemptSnapshot.data(), input) };
  }
  if (input.currentIndex !== state.expectedQuestionIndex) {
    throw new HttpsError("failed-precondition", "현재 Solo 문항 순서가 일치하지 않습니다.");
  }

  const setRef = tenantLearningSetsCollection(student.tenantId).doc(run.setId);
  const [metadataSnapshot, contentSnapshot] = await Promise.all([
    setRef.get(),
    setRef.collection("content").doc("main").get(),
  ]);
  const learningSet = verifySoloLearningSet({
    gameId: input.gameId,
    tenantId: student.tenantId,
    setId: run.setId,
    setFingerprint: run.setFingerprint,
    metadata: metadataSnapshot.exists ? metadataSnapshot.data() : null,
    content: contentSnapshot.exists ? contentSnapshot.data() : null,
  });
  if (input.gameId === "ai-tutor") {
    const expectedItem = learningSet.items[input.currentIndex];
    if (!expectedItem || expectedItem.id !== input.itemId || input.questionId !== input.itemId) {
      throw new HttpsError("invalid-argument", "현재 AI 문답 문항이 학습 세트와 일치하지 않습니다.");
    }
  } else if (!learningSet.items.some((item) => item.id === input.itemId) || input.questionId === input.itemId) {
    throw new HttpsError("invalid-argument", "현재 포켓몬 문답 문항이 학습 세트와 일치하지 않습니다.");
  }
  const config = isRecord(run.gameConfig) ? run.gameConfig : null;
  const context = resolveAiTutorRoundContext({
    setType: learningSet.type,
    items: learningSet.items,
    itemId: input.itemId,
    gameId: input.gameId,
    configuredDirection: config?.direction,
    requestedDirection: input.gameId === "pokemon-catch" ? input.direction : null,
  });
  if (input.gameId === "ai-tutor" && context.setType !== "student-questions" && input.direction && context.direction !== input.direction) {
    throw new HttpsError("invalid-argument", "AI 문답 방향이 게임 설정과 일치하지 않습니다.");
  }
  return { run, scopeId, context, state };
}

export const submitSoloAiTutorTurn = onCall(options, async (request) => {
  try {
    const student = await requireSoloStudent(request);
    const input = parseInput(request.data);
    const loaded = await loadContext(student, input);
    if (loaded.duplicate) return loaded.duplicate;
    const { run, context, scopeId, state: initialState } = loaded;
    if (!context) throw new HttpsError("internal", "AI 문답 문맥을 준비하지 못했습니다.");
    const runRef = soloRuns(student.tenantId).doc(input.runId);
    const stateRef = authoritativeProgress(runRef, student.uid);
    const attemptRef = soloAttemptAnswer(runRef, input.questionId, input.attemptId);
    const previous = initialState.progress.lastResult?.itemId === input.questionId
      ? initialState.progress.lastResult.feedback
      : null;
    const attemptNumber = Math.min((initialState.attemptsByQuestionId[input.questionId] ?? 0) + 1, 20);
    const turn: AiTutorTurnInput = {
      roomId: input.runId,
      roundId: input.runId,
      itemId: input.itemId,
      message: input.message,
      attemptNumber,
      previousFeedback: previous,
      direction: input.direction,
    };
    await consumeAiTutorTurn(student.uid);
    const reply = await evaluateAiTutorContext(context, turn);

    const setRef = tenantLearningSetsCollection(student.tenantId).doc(typeof run.setId === "string" ? run.setId : "");
    const contentRef = setRef.collection("content").doc("main");
    const activeRef = soloRunPointer(student.tenantId, student.studentAccountId);
    const completedAtMs = Date.now();
    return await db.runTransaction(async (tx) => {
      const [runSnapshot, activeSnapshot, stateSnapshot, attemptSnapshot, metadataSnapshot, contentSnapshot] = await Promise.all([
        tx.get(runRef), tx.get(activeRef), tx.get(stateRef), tx.get(attemptRef), tx.get(setRef), tx.get(contentRef),
      ]);
      const rawRun: unknown = runSnapshot.exists ? runSnapshot.data() : null;
      if (!isRecord(rawRun)) throw new HttpsError("permission-denied", "본인 Solo run만 이용할 수 있습니다.");
      assertSoloRunIdentity(rawRun, student, input.gameId);
      if (verifySoloScope(rawRun) !== scopeId) throw new HttpsError("failed-precondition", "Solo leaderboard 범위가 바뀌었습니다.");
      if (rawRun.status !== "active" || activeSnapshot.data()?.runId !== input.runId) {
        throw new HttpsError("failed-precondition", "진행 중인 Solo run만 AI 문답을 이용할 수 있습니다.");
      }
      if (attemptSnapshot.exists) return savedResponse(attemptSnapshot.data(), input);

      const state = stateSnapshot.exists
        ? stateFor(stateSnapshot.data(), input.runId, student, input.gameId)
        : emptySoloQuestionState();
      if (state.expectedQuestionIndex !== input.currentIndex
        || (state.attemptsByQuestionId[input.questionId] ?? 0) !== (initialState.attemptsByQuestionId[input.questionId] ?? 0)) {
        throw new HttpsError("aborted", "문답 진행 상황이 바뀌었습니다. 현재 답변을 다시 제출해 주세요.");
      }
      if (typeof rawRun.setId !== "string" || typeof rawRun.setFingerprint !== "string") {
        throw new HttpsError("failed-precondition", "Solo 학습 세트를 확인할 수 없습니다.");
      }
      verifySoloLearningSet({
        gameId: input.gameId,
        tenantId: student.tenantId,
        setId: rawRun.setId,
        setFingerprint: rawRun.setFingerprint,
        metadata: metadataSnapshot.exists ? metadataSnapshot.data() : null,
        content: contentSnapshot.exists ? contentSnapshot.data() : null,
      });

      const nextState = reply.kind === "help" || reply.kind === "off-topic"
        ? state
        : applySoloQuestionAnswer(state, {
            currentIndex: input.currentIndex,
            questionId: input.questionId,
            isCorrect: reply.isCorrect,
            baseScore: reply.scoreDelta,
            trackCombo: false,
            feedback: reply.feedback,
            details: { kind: reply.kind, focus: reply.focus, hint: reply.hint },
          });
      const progress = nextState.progress;
      tx.create(attemptRef, {
        questionId: input.questionId,
        itemId: input.itemId,
        questionIndex: input.currentIndex,
        attemptId: input.attemptId,
        reply,
        progress,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: completedAtMs,
      });
      if (nextState !== state) {
        tx.set(stateRef, {
          ...soloQuestionStateFor(input.runId, student, input.gameId, nextState),
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtMs: completedAtMs,
        });
      }
      return { reply, progress };
    });
  } catch (error: unknown) {
    throw callableError(error);
  }
});
