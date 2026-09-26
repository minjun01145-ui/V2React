import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { tenantLearningSetsCollection } from "../shared/tenantData.js";
import { isRecord } from "../shared/validation.js";
import { parseTenantId, type TenantId } from "../shared/tenant.js";
import {
  applySimpleQuizAnswer,
  emptySimpleQuizAuthoritativeState,
  fingerprintSimpleQuizSet,
  isBetterSimpleQuizResult,
  isLeaderboardEligible,
  matchesSoloStartRequest,
  parseSimpleQuizAuthoritativeState,
  simpleQuizBestRecordId,
  simpleQuizProgressForClient,
  simpleQuizQuestionId,
  simpleQuizQuestionOptions,
  simpleQuizQuestionOrder,
  SIMPLE_QUIZ_RULES_VERSION,
  soloLeaderboardScopeId,
  statusAfterStartingSoloRun,
  transitionSoloRunStatus,
  type SimpleQuizAuthoritativeState,
  type SimpleQuizBestResult,
  type SoloRunStatus,
} from "./model.js";
import { isSoloGameId, parseSoloGameConfig, soloGameRules, type SoloGameId } from "./registry.js";
import { verifySoloLearningSet } from "./games/learningSet.js";
import { submitSoloSentenceAnswer } from "./games/sentenceBuilder.js";
import { requireSoloStudent, type SoloStudent } from "./auth.js";
import {
  assertSoloRunIdentity as assertRunIdentity,
  authoritativeProgress,
  leaderboard,
  parseSoloRunId as parseRunId,
  scopeInput,
  soloAnswer,
  soloRunPointer,
  soloRuns,
  verifySoloScope as verifyScope,
  emptySoloQuestionState,
  validateSoloQuestionState,
} from "./shared.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public" } as const;
const GAME_ID = "simple-quiz" as const;
const BEST_RECORD_VERSION = "solo-authoritative-v1";
const LEGACY_BEST_RECORD_VERSION = "simple-quiz-authoritative-v2";

type SimpleQuizSetItem = { readonly id: string; readonly sourceText: string; readonly meaning: string };
type SoloAnswerInput = {
  readonly runId: string;
  readonly gameId: typeof GAME_ID;
  readonly questionId: string;
  readonly itemId: string;
  readonly currentIndex: number;
  readonly selectedOptionId: string;
  readonly selectedOptionText: string;
} | {
  readonly runId: string;
  readonly gameId: "sentence-builder";
  readonly questionId: string;
  readonly itemId: string;
  readonly currentIndex: number;
  readonly attemptId: string;
  readonly tokenIds: readonly string[];
};

function parseStartInput(value: unknown): {
  readonly startRequestId: string;
  readonly tenantId: TenantId;
  readonly gameId: SoloGameId;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly nickname: string | null;
} {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "Solo 설정이 올바르지 않습니다.");
  const startRequestId = typeof value.startRequestId === "string" ? value.startRequestId : "";
  const tenantId = parseTenantId(value.tenantId);
  const gameId = value.gameId;
  const setId = typeof value.setId === "string" ? value.setId.trim() : "";
  const setFingerprint = typeof value.setFingerprint === "string" ? value.setFingerprint : "";
  const config = value.gameConfig;
  const nickname = value.nickname === null || value.nickname === undefined ? null : typeof value.nickname === "string" ? value.nickname.trim() : "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(startRequestId)
    || !isSoloGameId(gameId) || !/^[A-Za-z0-9_-]{1,128}$/.test(setId) || !/^[a-f0-9]{64}$/.test(setFingerprint)
    || (nickname !== null && (nickname.length < 2 || nickname.length > 12))
    || !isRecord(config)) {
    throw new HttpsError("invalid-argument", "Solo 게임 설정이 올바르지 않습니다.");
  }
  const gameConfig = parseSoloGameConfig(gameId, setId, config);
  return {
    startRequestId,
    tenantId,
    gameId,
    setId,
    setFingerprint,
    gameConfig,
    nickname,
  };
}

function parseAnswerInput(value: unknown): SoloAnswerInput {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "정답 제출이 올바르지 않습니다.");
  const runId = parseRunId(value.runId);
  const questionId = typeof value.questionId === "string" ? value.questionId : "";
  const itemId = typeof value.itemId === "string" ? value.itemId : "";
  const currentIndex = value.currentIndex;
  const selectedOptionId = typeof value.selectedOptionId === "string" ? value.selectedOptionId : "";
  const selectedOptionText = typeof value.selectedOptionText === "string" ? value.selectedOptionText : "";
  const tokenIds = Array.isArray(value.tokenIds) && value.tokenIds.every((id) => typeof id === "string" && id.length <= 512)
    ? value.tokenIds as string[]
    : null;
  const attemptId = typeof value.attemptId === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value.attemptId) ? value.attemptId : "";
  if ((value.gameId !== "simple-quiz" && value.gameId !== "sentence-builder") || !itemId || itemId.length > 256
    || (value.gameId === "simple-quiz" && questionId !== simpleQuizQuestionId(itemId))
    || (value.gameId === "sentence-builder" && questionId !== itemId)
    || typeof currentIndex !== "number" || !Number.isSafeInteger(currentIndex) || currentIndex < 0 || currentIndex > 10000
    || (value.gameId === "simple-quiz" && (!selectedOptionId || selectedOptionId.length > 512 || !selectedOptionText || selectedOptionText.length > 1000))
    || (value.gameId === "sentence-builder" && (!attemptId || !tokenIds || tokenIds.length > 64 || tokenIds.length === 0))) {
    throw new HttpsError("invalid-argument", "정답 제출이 올바르지 않습니다.");
  }
  if (value.gameId === "sentence-builder") {
    if (!attemptId || !tokenIds) throw new HttpsError("invalid-argument", "정답 제출이 올바르지 않습니다.");
    return { runId, gameId: value.gameId, questionId, itemId, currentIndex, attemptId, tokenIds };
  }
  return { runId, gameId: GAME_ID, questionId, itemId, currentIndex, selectedOptionId, selectedOptionText };
}

function parseVerifiedSimpleQuizSet(
  tenantId: TenantId,
  setId: string,
  choiceCount: number,
  expectedFingerprint: string,
  metadata: unknown,
  content: unknown,
): readonly SimpleQuizSetItem[] {
  if (!isRecord(metadata) || metadata.type !== "vocabulary"
    || (metadata.tenantId !== undefined && metadata.tenantId !== tenantId)
    || (tenantId !== "minjun" && metadata.tenantId !== tenantId)
    || !isRecord(content) || !Array.isArray(content.items) || content.items.length < 5) {
    throw new HttpsError("failed-precondition", "선택한 단어 세트를 찾을 수 없거나 심플퀴즈 조건을 충족하지 않습니다.");
  }
  const items: SimpleQuizSetItem[] = [];
  for (const raw of content.items) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.sourceText !== "string" || typeof raw.meaning !== "string"
      || !raw.id.trim() || !raw.sourceText.trim() || !raw.meaning.trim()) {
      throw new HttpsError("failed-precondition", "단어 세트의 문항 형식이 올바르지 않습니다.");
    }
    items.push({ id: raw.id, sourceText: raw.sourceText.trim(), meaning: raw.meaning.trim() });
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new HttpsError("failed-precondition", "단어 세트의 문항 ID가 중복되었습니다.");
  }
  if (new Set(items.map((item) => item.sourceText)).size < choiceCount) {
    throw new HttpsError("failed-precondition", "선택한 단어 세트의 서로 다른 정답 수가 부족합니다.");
  }
  if (fingerprintSimpleQuizSet("vocabulary", items) !== expectedFingerprint) {
    throw new HttpsError("failed-precondition", "학습 세트가 바뀌었습니다. 세트를 다시 선택해 주세요.");
  }
  return items;
}

function soloRunResponse(runId: string, run: Record<string, unknown>) {
  if ((run.status !== "active" && run.status !== "completed" && run.status !== "abandoned")
    || typeof run.ownerUid !== "string" || typeof run.tenantId !== "string" || typeof run.gameId !== "string"
    || typeof run.setId !== "string" || typeof run.setFingerprint !== "string" || !isRecord(run.gameConfig)
    || typeof run.rulesVersion !== "string" || typeof run.leaderboardScopeId !== "string"
    || typeof run.startedAtMs !== "number" || !Number.isSafeInteger(run.startedAtMs)) {
    throw new HttpsError("failed-precondition", "Solo run을 반환할 수 없습니다.");
  }
  return {
    runId,
    ownerUid: run.ownerUid,
    tenantId: run.tenantId,
    gameId: run.gameId,
    setId: run.setId,
    setFingerprint: run.setFingerprint,
    gameConfig: run.gameConfig,
    rulesVersion: run.rulesVersion,
    leaderboardScopeId: run.leaderboardScopeId,
    status: run.status as SoloRunStatus,
    startedAtMs: run.startedAtMs,
    completedAtMs: typeof run.completedAtMs === "number" ? run.completedAtMs : null,
    finalResult: isRecord(run.finalResult) ? run.finalResult : null,
  } as const;
}

function parseClientResult(value: unknown): SimpleQuizBestResult | null {
  if (!isRecord(value) || typeof value.displayLabel !== "string" || !value.displayLabel.trim()
    || typeof value.completedAtMs !== "number" || !Number.isSafeInteger(value.completedAtMs)) return null;
  const score = safeInteger(value.score);
  const correctCount = safeInteger(value.correctCount);
  const attemptCount = safeInteger(value.attemptCount);
  const combo = safeInteger(value.combo);
  return score !== null && correctCount !== null && attemptCount !== null && combo !== null
    && correctCount <= attemptCount && combo <= correctCount
    ? { score, correctCount, attemptCount, combo, displayLabel: value.displayLabel, completedAtMs: value.completedAtMs }
    : null;
}

function parseStoredBestRecord(value: unknown): SimpleQuizBestResult | null {
  if (!isRecord(value) || (value.scoreSource !== BEST_RECORD_VERSION && value.scoreSource !== LEGACY_BEST_RECORD_VERSION)) return null;
  return parseClientResult(value);
}

function safeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null;
}

function soloStateFor(runId: string, student: SoloStudent, state: SimpleQuizAuthoritativeState | null) {
  return {
    tenantId: student.tenantId,
    studentAccountId: student.studentAccountId,
    ownerUid: student.uid,
    runId,
    gameId: GAME_ID,
    rulesVersion: SIMPLE_QUIZ_RULES_VERSION,
    progress: state ?? emptySimpleQuizAuthoritativeState(),
  } as const;
}

function validateStoredState(value: unknown, runId: string, student: SoloStudent): SimpleQuizAuthoritativeState | null {
  if (!isRecord(value) || value.runId !== runId || value.ownerUid !== student.uid
    || value.studentAccountId !== student.studentAccountId || value.tenantId !== student.tenantId
    || value.gameId !== GAME_ID || value.rulesVersion !== SIMPLE_QUIZ_RULES_VERSION) return null;
  return parseSimpleQuizAuthoritativeState(value.progress);
}

export const startSoloRun = onCall(options, async (request) => {
  const student = await requireSoloStudent(request);
  const input = parseStartInput(request.data);
  if (input.tenantId !== student.tenantId) throw new HttpsError("permission-denied", "다른 테넌트의 Solo 데이터에 접근할 수 없습니다.");

  const gameRules = soloGameRules(input.gameId);
  const choiceCount = input.gameId === GAME_ID ? Number(input.gameConfig["choice-count"]) : 4;
  const startedAtMs = Date.now();
  const scope = {
    tenantId: student.tenantId,
    gameId: input.gameId,
    setId: input.setId,
    setFingerprint: input.setFingerprint,
    gameConfig: input.gameConfig,
    rulesVersion: gameRules.rulesVersion,
  };
  const leaderboardScopeId = soloLeaderboardScopeId({ ...scope, configKeys: gameRules.leaderboardConfigKeys });
  const runs = soloRuns(student.tenantId);
  const runRef = runs.doc(input.startRequestId);
  const activeRef = soloRunPointer(student.tenantId, student.studentAccountId);
  const setRef = tenantLearningSetsCollection(student.tenantId).doc(input.setId);
  const contentRef = setRef.collection("content").doc("main");

  return db.runTransaction(async (tx) => {
    const [requestedRun, activePointer, metadata, content] = await Promise.all([
      tx.get(runRef), tx.get(activeRef), tx.get(setRef), tx.get(contentRef),
    ]);
    const pointer = activePointer.data();
    const activeRunId = isRecord(pointer) && typeof pointer.runId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(pointer.runId)
      ? pointer.runId
      : null;
    const previousRunRef = activeRunId && activeRunId !== input.startRequestId ? runs.doc(activeRunId) : null;
    const previousRun = previousRunRef ? await tx.get(previousRunRef) : null;

    if (requestedRun.exists) {
      const existing: unknown = requestedRun.data();
      if (!isRecord(existing) || !matchesSoloStartRequest(existing, {
        ownerUid: student.uid,
        studentAccountId: student.studentAccountId,
        tenantId: student.tenantId,
        gameId: input.gameId,
        setId: input.setId,
        setFingerprint: input.setFingerprint,
        leaderboardScopeId,
        rulesVersion: gameRules.rulesVersion,
        gameConfig: input.gameConfig,
        displayLabel: input.nickname || student.displayName,
      })) {
        throw new HttpsError("already-exists", "Solo 시작 요청 ID가 이미 사용되었습니다.");
      }
      return soloRunResponse(runRef.id, existing);
    }

    const setInput = {
      tenantId: student.tenantId,
      gameId: input.gameId,
      setId: input.setId,
      setFingerprint: input.setFingerprint,
      metadata: metadata.exists ? metadata.data() : null,
      content: content.exists ? content.data() : null,
    } as const;
    if (input.gameId === GAME_ID) {
      parseVerifiedSimpleQuizSet(student.tenantId, input.setId, choiceCount, input.setFingerprint, setInput.metadata, setInput.content);
    } else {
      verifySoloLearningSet(setInput);
    }

    const previousData: unknown = previousRun?.exists ? previousRun.data() : null;
    if (previousRunRef && isRecord(previousData)) {
      if (previousData.studentAccountId !== student.studentAccountId) {
        throw new HttpsError("failed-precondition", "현재 학생의 Solo run 연결이 올바르지 않습니다.");
      }
      if (previousData.status === "active") {
        const status = statusAfterStartingSoloRun(previousData.status);
        tx.update(previousRunRef, {
          status,
          abandonedAt: FieldValue.serverTimestamp(),
          abandonedAtMs: startedAtMs,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    const run = {
      ownerUid: student.uid,
      studentAccountId: student.studentAccountId,
      tenantId: student.tenantId,
      gameId: input.gameId,
      setId: input.setId,
      setFingerprint: input.setFingerprint,
      gameConfig: input.gameConfig,
      rulesVersion: gameRules.rulesVersion,
      leaderboardScopeId,
      status: "active" as const,
      startedAt: FieldValue.serverTimestamp(),
      startedAtMs,
      completedAt: null,
      completedAtMs: null,
      finalResult: null,
      displayName: student.displayName,
      displayLabel: input.nickname || student.displayName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.create(runRef, run);
    const pointerValue = { runId: runRef.id, updatedAt: FieldValue.serverTimestamp() };
    if (activePointer.exists) tx.set(activeRef, pointerValue);
    else tx.create(activeRef, pointerValue);
    return soloRunResponse(runRef.id, { ...run, startedAtMs });
  });
});

export const submitSoloAnswer = onCall(options, async (request) => {
  const student = await requireSoloStudent(request);
  const input = parseAnswerInput(request.data);
  if (input.gameId === "sentence-builder") return submitSoloSentenceAnswer(student, input);
  if (input.gameId !== GAME_ID) throw new HttpsError("invalid-argument", "지원하지 않는 Solo 게임입니다.");
  const runRef = soloRuns(student.tenantId).doc(input.runId);
  const initial = await runRef.get();
  const initialData: unknown = initial.exists ? initial.data() : null;
  if (!isRecord(initialData)) throw new HttpsError("permission-denied", "본인 Solo run만 이용할 수 있습니다.");
  assertRunIdentity(initialData, student, input.gameId);
  const scopeId = verifyScope(initialData);
  const setId = typeof initialData.setId === "string" ? initialData.setId : "";
  const setFingerprint = typeof initialData.setFingerprint === "string" ? initialData.setFingerprint : "";
  if (!setId || !setFingerprint) throw new HttpsError("failed-precondition", "Solo run 학습 세트를 확인할 수 없습니다.");
  const setRef = tenantLearningSetsCollection(student.tenantId).doc(setId);
  const contentRef = setRef.collection("content").doc("main");
  const activeRef = soloRunPointer(student.tenantId, student.studentAccountId);
  const progressRef = authoritativeProgress(runRef, student.uid);
  const answerRef = soloAnswer(runRef, input.questionId);
  const completedAtMs = Date.now();

  const response = await db.runTransaction(async (tx) => {
    const [runSnapshot, pointerSnapshot, progressSnapshot, answerSnapshot, metadata, content] = await Promise.all([
      tx.get(runRef), tx.get(activeRef), tx.get(progressRef), tx.get(answerRef), tx.get(setRef), tx.get(contentRef),
    ]);
    const rawRun: unknown = runSnapshot.exists ? runSnapshot.data() : null;
    if (!isRecord(rawRun)) throw new HttpsError("permission-denied", "본인 Solo run만 이용할 수 있습니다.");
    assertRunIdentity(rawRun, student, input.gameId);
    if (verifyScope(rawRun) !== scopeId) throw new HttpsError("failed-precondition", "Solo leaderboard 범위가 바뀌었습니다.");
    if (rawRun.status !== "active") throw new HttpsError("failed-precondition", "진행 중인 Solo run만 정답을 제출할 수 있습니다.");
    if (pointerSnapshot.data()?.runId !== input.runId) {
      throw new HttpsError("failed-precondition", "이 Solo run은 더 이상 활성 상태가 아닙니다.");
    }

    const rawState: unknown = progressSnapshot.exists ? progressSnapshot.data() : null;
    const state = progressSnapshot.exists ? validateStoredState(rawState, input.runId, student) : emptySimpleQuizAuthoritativeState();
    if (!state) throw new HttpsError("failed-precondition", "서버의 Solo 진행 상황을 확인할 수 없습니다.");

    if (answerSnapshot.exists) {
      const saved: unknown = answerSnapshot.data();
      if (!isRecord(saved) || saved.questionId !== input.questionId || saved.questionIndex !== input.currentIndex
        || !isRecord(saved.result) || typeof saved.result.isCorrect !== "boolean"
        || typeof saved.result.scoreDelta !== "number" || !isRecord(saved.result.details)
        || typeof saved.result.details.selectedOptionId !== "string" || typeof saved.result.details.correctOptionId !== "string") {
        throw new HttpsError("failed-precondition", "저장된 정답 제출을 확인할 수 없습니다.");
      }
      return {
        state,
        lastResult: {
          itemId: input.questionId,
          status: saved.result.isCorrect ? "correct" as const : "incorrect" as const,
          isCorrect: saved.result.isCorrect,
          scoreDelta: saved.result.scoreDelta,
          feedback: null,
          details: {
            selectedOptionId: saved.result.details.selectedOptionId,
            correctOptionId: saved.result.details.correctOptionId,
          },
        },
      };
    }

    const scope = scopeInput(rawRun);
    const choiceCount = Number(scope.gameConfig["choice-count"]);
    const items = parseVerifiedSimpleQuizSet(
      student.tenantId,
      setId,
      choiceCount,
      setFingerprint,
      metadata.exists ? metadata.data() : null,
      content.exists ? content.data() : null,
    );
    const questionOrder = simpleQuizQuestionOrder(items, input.runId, setId, choiceCount);
    if (input.currentIndex >= questionOrder.length || questionOrder[input.currentIndex] !== input.questionId
      || state.attemptCount !== input.currentIndex) {
      throw new HttpsError("failed-precondition", "현재 Solo 문항 순서가 일치하지 않습니다.");
    }
    const itemId = input.questionId.slice("choice:right-to-left:".length);
    if (itemId !== input.itemId || !items.some((item) => item.id === itemId)) {
      throw new HttpsError("invalid-argument", "선택한 Solo 문항을 확인할 수 없습니다.");
    }
    const options = simpleQuizQuestionOptions(items, input.runId, setId, choiceCount, itemId);
    const selectedOption = options.find((option) => option.id === input.selectedOptionId);
    if (!selectedOption || selectedOption.text !== input.selectedOptionText) {
      throw new HttpsError("invalid-argument", "선택한 보기가 현재 문항과 일치하지 않습니다.");
    }
    const correctOptionId = `${input.questionId}:correct`;
    const nextState = applySimpleQuizAnswer(state, input.questionId, input.selectedOptionId, correctOptionId);
    const answerResult = nextState.lastResult;
    if (!answerResult) throw new HttpsError("internal", "정답 결과를 계산하지 못했습니다.");
    tx.create(answerRef, {
      questionId: input.questionId,
      questionIndex: input.currentIndex,
      selectedOptionId: input.selectedOptionId,
      result: answerResult,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: completedAtMs,
    });
    tx.set(progressRef, {
      ...soloStateFor(input.runId, student, nextState),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: completedAtMs,
    });
    return { state: nextState, lastResult: answerResult };
  });

  return simpleQuizProgressForClient({ ...response.state, lastResult: response.lastResult }, input.currentIndex);
});

export const finishSoloRun = onCall(options, async (request) => {
  const student = await requireSoloStudent(request);
  if (!isRecord(request.data)) throw new HttpsError("invalid-argument", "결과 요청이 올바르지 않습니다.");
  const runId = parseRunId(request.data.runId);
  const gameId = request.data.gameId;
  if (!isSoloGameId(gameId)) throw new HttpsError("invalid-argument", "지원하지 않는 Solo 게임입니다.");
  const runRef = soloRuns(student.tenantId).doc(runId);
  const initial = await runRef.get();
  const initialData: unknown = initial.exists ? initial.data() : null;
  if (!isRecord(initialData)) throw new HttpsError("permission-denied", "본인 Solo run만 완료할 수 있습니다.");
  assertRunIdentity(initialData, student, gameId);
  const scopeId = verifyScope(initialData);
  const boardRef = leaderboard(student.tenantId, scopeId);
  const bestRef = boardRef.collection("records").doc(simpleQuizBestRecordId(student.studentAccountId));
  const resultRef = runRef.collection("results").doc(student.uid);
  const progressRef = authoritativeProgress(runRef, student.uid);
  const activeRef = soloRunPointer(student.tenantId, student.studentAccountId);
  const completedAtMs = Date.now();
  const response = await db.runTransaction(async (tx) => {
    const [runSnapshot, progressSnapshot, resultSnapshot, bestSnapshot, scopeSnapshot, activeSnapshot] = await Promise.all([
      tx.get(runRef), tx.get(progressRef), tx.get(resultRef), tx.get(bestRef), tx.get(boardRef), tx.get(activeRef),
    ]);
    const rawRun: unknown = runSnapshot.exists ? runSnapshot.data() : null;
    if (!isRecord(rawRun)) throw new HttpsError("permission-denied", "본인 Solo run만 완료할 수 있습니다.");
    assertRunIdentity(rawRun, student, gameId);
    if (verifyScope(rawRun) !== scopeId) throw new HttpsError("failed-precondition", "Solo leaderboard 범위가 바뀌었습니다.");
    if (rawRun.status === "completed") {
      transitionSoloRunStatus("completed", "completed");
      if (!resultSnapshot.exists) throw new HttpsError("failed-precondition", "저장된 Solo 결과를 찾을 수 없습니다.");
      const result = parseClientResult(resultSnapshot.data());
      if (!result) throw new HttpsError("failed-precondition", "저장된 Solo 결과가 올바르지 않습니다.");
      const best = student.isTestStudent ? result : parseStoredBestRecord(bestSnapshot.data()) ?? result;
      return { result, best };
    }
    if (rawRun.status !== "active") throw new HttpsError("failed-precondition", "종료된 Solo run은 완료할 수 없습니다.");
    if (!isLeaderboardEligible(transitionSoloRunStatus("active", "completed"))) throw new HttpsError("internal", "완료된 Solo run만 순위에 등록할 수 있습니다.");
    if (activeSnapshot.data()?.runId !== runId) {
      throw new HttpsError("failed-precondition", "이 Solo run은 더 이상 활성 상태가 아닙니다.");
    }

    const rawState: unknown = progressSnapshot.exists ? progressSnapshot.data() : null;
    const metrics = gameId === GAME_ID
      ? (progressSnapshot.exists ? validateStoredState(rawState, runId, student) : emptySimpleQuizAuthoritativeState())
      : (progressSnapshot.exists
        ? validateSoloQuestionState(rawState, runId, student, gameId)?.progress
        : emptySoloQuestionState().progress);
    if (!metrics) throw new HttpsError("failed-precondition", "서버의 Solo 진행 상황을 확인할 수 없습니다.");
    const displayLabel = typeof rawRun.displayLabel === "string" && rawRun.displayLabel.trim() ? rawRun.displayLabel.trim() : student.displayName;
    const result: SimpleQuizBestResult = {
      score: metrics.score,
      correctCount: metrics.correctCount,
      attemptCount: metrics.attemptCount,
      combo: metrics.combo,
      displayLabel,
      completedAtMs,
    };
    const currentBest = student.isTestStudent ? null : parseStoredBestRecord(bestSnapshot.data());
    const nextBest = student.isTestStudent || isBetterSimpleQuizResult(result, currentBest) ? result : currentBest;
    if (!nextBest) throw new HttpsError("internal", "Solo 최고 기록을 계산하지 못했습니다.");

    tx.update(runRef, {
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      completedAtMs,
      finalResult: result,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(resultRef, { ...result, runId, gameId, setId: rawRun.setId, setFingerprint: rawRun.setFingerprint, rulesVersion: rawRun.rulesVersion, gameConfig: rawRun.gameConfig });
    if (!scopeSnapshot.exists) tx.create(boardRef, { ...scopeInput(rawRun), scopeId, createdAt: FieldValue.serverTimestamp() });
    if (!student.isTestStudent && nextBest === result) {
      tx.set(bestRef, {
        ...result,
        gameId,
        setId: rawRun.setId,
        setFingerprint: rawRun.setFingerprint,
        gameConfig: rawRun.gameConfig,
        rulesVersion: rawRun.rulesVersion,
        scopeId,
        scoreSource: BEST_RECORD_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.delete(activeRef);
    return { result, best: nextBest };
  });
  const topSnapshot = await boardRef.collection("records").get();
  const leaderboardRecords = topSnapshot.docs
    .map((snapshot) => parseStoredBestRecord(snapshot.data()))
    .filter((record): record is SimpleQuizBestResult => record !== null)
    .sort(compareSimpleQuizRanks)
    .slice(0, 10)
    .map((record, index) => ({ ...record, rank: index + 1 }));
  return { ...response, leaderboard: leaderboardRecords } as const;
});

export const abandonSoloRun = onCall(options, async (request) => {
  const student = await requireSoloStudent(request);
  if (!isRecord(request.data)) throw new HttpsError("invalid-argument", "Solo 종료 요청이 올바르지 않습니다.");
  const runId = parseRunId(request.data.runId);
  const runRef = soloRuns(student.tenantId).doc(runId);
  const activeRef = soloRunPointer(student.tenantId, student.studentAccountId);
  const status = await db.runTransaction(async (tx) => {
    const [snapshot, activeSnapshot] = await Promise.all([tx.get(runRef), tx.get(activeRef)]);
    const raw: unknown = snapshot.exists ? snapshot.data() : null;
    if (!isRecord(raw)) throw new HttpsError("permission-denied", "본인 Solo run만 종료할 수 있습니다.");
    if (!isSoloGameId(raw.gameId)) throw new HttpsError("failed-precondition", "Solo run 게임을 확인할 수 없습니다.");
    assertRunIdentity(raw, student, raw.gameId);
    verifyScope(raw);
    if (raw.status === "active") {
      const nextStatus = transitionSoloRunStatus("active", "abandoned");
      tx.update(runRef, { status: nextStatus, abandonedAt: FieldValue.serverTimestamp(), abandonedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() });
      if (activeSnapshot.data()?.runId === runId) tx.delete(activeRef);
      return nextStatus;
    }
    if (raw.status === "completed" || raw.status === "abandoned") {
      const nextStatus = transitionSoloRunStatus(raw.status, "abandoned");
      if (activeSnapshot.data()?.runId === runId) tx.delete(activeRef);
      return nextStatus;
    }
    throw new HttpsError("failed-precondition", "Solo run 상태가 올바르지 않습니다.");
  });
  return { status } as const;
});

function compareSimpleQuizRanks(left: SimpleQuizBestResult, right: SimpleQuizBestResult): number {
  return right.score - left.score || right.correctCount - left.correctCount || left.attemptCount - right.attemptCount || left.completedAtMs - right.completedAtMs;
}
