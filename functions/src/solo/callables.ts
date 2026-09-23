import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireRegularStudent } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import { tenantLearningSetsCollection } from "../shared/tenantData.js";
import { isRecord } from "../shared/validation.js";
import { parseTenantId, type TenantId } from "../shared/tenant.js";
import {
  fingerprintSimpleQuizSet,
  isBetterSimpleQuizResult,
  isLeaderboardEligible,
  parseSimpleQuizProgress,
  SIMPLE_QUIZ_LEADERBOARD_CONFIG_KEYS,
  SIMPLE_QUIZ_RULES_VERSION,
  simpleQuizLeaderboardScopeId,
  transitionSoloRunStatus,
  type SimpleQuizBestResult,
} from "./model.js";

const options = { region: "asia-northeast3", enforceAppCheck: false } as const;
const GAME_ID = "simple-quiz";
const CHOICE_COUNTS = new Set(["2", "3", "4", "5"]);
const TIMED_MODES = new Set(["unlimited", "3-minutes", "5-minutes"]);

function soloRuns(tenantId: TenantId) {
  return db.collection("tenants").doc(tenantId).collection("soloRuns");
}

function leaderboard(tenantId: TenantId, scopeId: string) {
  return db.collection("tenants").doc(tenantId).collection("soloLeaderboards").doc(scopeId);
}

function parseStartInput(value: unknown): {
  readonly tenantId: TenantId;
  readonly gameId: typeof GAME_ID;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly nickname: string | null;
} {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "Solo 설정이 올바르지 않습니다.");
  const tenantId = parseTenantId(value.tenantId);
  const gameId = value.gameId;
  const setId = typeof value.setId === "string" ? value.setId.trim() : "";
  const setFingerprint = typeof value.setFingerprint === "string" ? value.setFingerprint : "";
  const config = value.gameConfig;
  const nickname = value.nickname === null || value.nickname === undefined ? null : typeof value.nickname === "string" ? value.nickname.trim() : "";
  if (gameId !== GAME_ID || !/^[A-Za-z0-9_-]{1,128}$/.test(setId) || !/^[a-f0-9]{64}$/.test(setFingerprint)
    || (nickname !== null && (nickname.length < 2 || nickname.length > 12))
    || !isRecord(config) || config.setId !== setId
    || typeof config["choice-count"] !== "string" || !CHOICE_COUNTS.has(config["choice-count"])
    || typeof config.timedGameMode !== "string" || !TIMED_MODES.has(config.timedGameMode)
    || Object.keys(config).some((key) => !["setId", "choice-count", "timedGameMode"].includes(key))) {
    throw new HttpsError("invalid-argument", "Solo 게임 설정이 올바르지 않습니다.");
  }
  return {
    tenantId,
    gameId,
    setId,
    setFingerprint,
    gameConfig: { setId, "choice-count": config["choice-count"], timedGameMode: config.timedGameMode },
    nickname,
  };
}

async function verifySimpleQuizSet(tenantId: TenantId, setId: string, choiceCount: number, expectedFingerprint: string): Promise<void> {
  const setRef = tenantLearningSetsCollection(tenantId).doc(setId);
  const [metadata, content] = await Promise.all([setRef.get(), setRef.collection("content").doc("main").get()]);
  const meta: unknown = metadata.exists ? metadata.data() : null;
  const data: unknown = content.exists ? content.data() : null;
  if (!isRecord(meta) || meta.type !== "vocabulary"
    || (meta.tenantId !== undefined && meta.tenantId !== tenantId)
    || (tenantId !== "minjun" && meta.tenantId !== tenantId)
    || !isRecord(data) || !Array.isArray(data.items) || data.items.length < 5) {
    throw new HttpsError("failed-precondition", "선택한 단어 세트를 찾을 수 없거나 심플퀴즈 조건을 충족하지 않습니다.");
  }
  const items: { id: string; sourceText: string; meaning: string }[] = [];
  for (const raw of data.items) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.sourceText !== "string" || typeof raw.meaning !== "string"
      || !raw.id.trim() || !raw.sourceText.trim() || !raw.meaning.trim()) {
      throw new HttpsError("failed-precondition", "단어 세트의 문항 형식이 올바르지 않습니다.");
    }
    items.push({ id: raw.id, sourceText: raw.sourceText.trim(), meaning: raw.meaning.trim() });
  }
  if (new Set(items.map((item) => item.sourceText)).size < choiceCount) {
    throw new HttpsError("failed-precondition", "선택한 단어 세트의 서로 다른 정답 수가 부족합니다.");
  }
  if (fingerprintSimpleQuizSet("vocabulary", items) !== expectedFingerprint) {
    throw new HttpsError("failed-precondition", "학습 세트가 바뀌었습니다. 세트를 다시 선택해 주세요.");
  }
}

function scopeInput(run: Record<string, unknown>): {
  readonly tenantId: string;
  readonly gameId: string;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly rulesVersion: string;
} {
  if (run.gameId !== GAME_ID || typeof run.tenantId !== "string" || typeof run.setId !== "string"
    || typeof run.setFingerprint !== "string" || typeof run.rulesVersion !== "string" || !isRecord(run.gameConfig)) {
    throw new HttpsError("failed-precondition", "Solo run 설정이 올바르지 않습니다.");
  }
  const config = run.gameConfig;
  if (config.setId !== run.setId || typeof config["choice-count"] !== "string" || !CHOICE_COUNTS.has(config["choice-count"])
    || typeof config.timedGameMode !== "string" || !TIMED_MODES.has(config.timedGameMode)
    || run.rulesVersion !== SIMPLE_QUIZ_RULES_VERSION) {
    throw new HttpsError("failed-precondition", "Solo run 설정을 확인할 수 없습니다.");
  }
  return {
    tenantId: run.tenantId,
    gameId: GAME_ID,
    setId: run.setId,
    setFingerprint: run.setFingerprint,
    gameConfig: { setId: run.setId, "choice-count": config["choice-count"], timedGameMode: config.timedGameMode },
    rulesVersion: run.rulesVersion,
  };
}

function verifyScope(run: Record<string, unknown>): string {
  const scopeId = simpleQuizLeaderboardScopeId(scopeInput(run));
  if (run.leaderboardScopeId !== scopeId) throw new HttpsError("failed-precondition", "Solo leaderboard 범위가 일치하지 않습니다.");
  return scopeId;
}

function parseRunId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", "Solo run ID가 올바르지 않습니다.");
  return value;
}

export const startSoloRun = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  const input = parseStartInput(request.data);
  if (input.tenantId !== student.tenantId) throw new HttpsError("permission-denied", "다른 테넌트의 Solo 데이터에 접근할 수 없습니다.");
  const choiceCount = Number(input.gameConfig["choice-count"]);
  await verifySimpleQuizSet(student.tenantId, input.setId, choiceCount, input.setFingerprint);

  const startedAtMs = Date.now();
  const scope = {
    tenantId: student.tenantId,
    gameId: GAME_ID,
    setId: input.setId,
    setFingerprint: input.setFingerprint,
    gameConfig: input.gameConfig,
    rulesVersion: SIMPLE_QUIZ_RULES_VERSION,
  };
  const leaderboardScopeId = simpleQuizLeaderboardScopeId(scope);
  const runs = soloRuns(student.tenantId);
  const runRef = runs.doc();
  const existing = await runs.where("status", "==", "active").get();
  const batch = db.batch();
  for (const active of existing.docs.filter((snapshot) => snapshot.get("ownerUid") === student.uid)) {
    batch.update(active.ref, { status: "abandoned", abandonedAt: FieldValue.serverTimestamp(), abandonedAtMs: startedAtMs, updatedAt: FieldValue.serverTimestamp() });
  }
  batch.create(runRef, {
    ownerUid: student.uid,
    tenantId: student.tenantId,
    gameId: GAME_ID,
    setId: input.setId,
    setFingerprint: input.setFingerprint,
    gameConfig: input.gameConfig,
    rulesVersion: SIMPLE_QUIZ_RULES_VERSION,
    leaderboardScopeId,
    status: "active",
    startedAt: FieldValue.serverTimestamp(),
    startedAtMs,
    completedAt: null,
    completedAtMs: null,
    finalResult: null,
    displayName: student.displayName,
    displayLabel: input.nickname || student.displayName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return {
    runId: runRef.id,
    ownerUid: student.uid,
    tenantId: student.tenantId,
    gameId: GAME_ID,
    setId: input.setId,
    setFingerprint: input.setFingerprint,
    gameConfig: input.gameConfig,
    rulesVersion: SIMPLE_QUIZ_RULES_VERSION,
    leaderboardScopeId,
    status: "active",
    startedAtMs,
    completedAtMs: null,
    finalResult: null,
  } as const;
});

export const finishSoloRun = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  if (!isRecord(request.data)) throw new HttpsError("invalid-argument", "결과 요청이 올바르지 않습니다.");
  const runId = parseRunId(request.data.runId);
  const gameId = request.data.gameId;
  if (gameId !== GAME_ID) throw new HttpsError("invalid-argument", "지원하지 않는 Solo 게임입니다.");
  const runRef = soloRuns(student.tenantId).doc(runId);
  const initial = await runRef.get();
  const initialData: unknown = initial.exists ? initial.data() : null;
  if (!isRecord(initialData) || initialData.ownerUid !== student.uid || initialData.tenantId !== student.tenantId || initialData.gameId !== gameId) {
    throw new HttpsError("permission-denied", "본인 Solo run만 완료할 수 있습니다.");
  }
  const scopeId = verifyScope(initialData);
  const boardRef = leaderboard(student.tenantId, scopeId);
  const bestRef = boardRef.collection("records").doc(student.uid);
  const resultRef = runRef.collection("results").doc(student.uid);
  const progressRef = runRef.collection("progress").doc(student.uid);
  const completedAtMs = Date.now();
  const response = await db.runTransaction(async (tx) => {
    const [runSnapshot, progressSnapshot, resultSnapshot, bestSnapshot, scopeSnapshot] = await Promise.all([
      tx.get(runRef), tx.get(progressRef), tx.get(resultRef), tx.get(bestRef), tx.get(boardRef),
    ]);
    const rawRun: unknown = runSnapshot.exists ? runSnapshot.data() : null;
    if (!isRecord(rawRun) || rawRun.ownerUid !== student.uid || rawRun.tenantId !== student.tenantId || rawRun.gameId !== gameId) {
      throw new HttpsError("permission-denied", "본인 Solo run만 완료할 수 있습니다.");
    }
    if (verifyScope(rawRun) !== scopeId) throw new HttpsError("failed-precondition", "Solo leaderboard 범위가 바뀌었습니다.");
    if (rawRun.status === "completed") {
      transitionSoloRunStatus("completed", "completed");
      if (!resultSnapshot.exists || !bestSnapshot.exists) throw new HttpsError("failed-precondition", "저장된 Solo 결과를 찾을 수 없습니다.");
      return { result: resultSnapshot.data(), best: bestSnapshot.data() };
    }
    if (rawRun.status !== "active") throw new HttpsError("failed-precondition", "종료된 Solo run은 완료할 수 없습니다.");
    if (!isLeaderboardEligible(transitionSoloRunStatus("active", "completed"))) throw new HttpsError("internal", "완료된 Solo run만 순위에 등록할 수 있습니다.");
    const progress = progressSnapshot.exists
      ? parseSimpleQuizProgress(progressSnapshot.data())
      : { score: 0, correctCount: 0, attemptCount: 0, combo: 0 };
    if (!progress) throw new HttpsError("failed-precondition", "저장된 Solo 진행 상황을 확인할 수 없습니다.");
    const displayLabel = typeof rawRun.displayLabel === "string" && rawRun.displayLabel.trim() ? rawRun.displayLabel.trim() : student.displayName;
    const result: SimpleQuizBestResult = { ...progress, displayLabel, completedAtMs };
    const currentBestRaw: unknown = bestSnapshot.exists ? bestSnapshot.data() : null;
    const currentBest = isRecord(currentBestRaw) ? parseBestRecord(currentBestRaw) : null;
    const nextBest = isBetterSimpleQuizResult(result, currentBest) ? result : currentBest;
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
    if (nextBest === result) {
      tx.set(bestRef, {
        ...result,
        gameId,
        setId: rawRun.setId,
        setFingerprint: rawRun.setFingerprint,
        gameConfig: rawRun.gameConfig,
        rulesVersion: rawRun.rulesVersion,
        scopeId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return { result, best: nextBest };
  });
  const topSnapshot = await boardRef.collection("records").get();
  const leaderboardRecords = topSnapshot.docs
    .map((snapshot) => parseBestRecord(snapshot.data()))
    .filter((record): record is SimpleQuizBestResult => record !== null)
    .sort(compareSimpleQuizRanks)
    .slice(0, 10)
    .map((record, index) => ({ ...record, rank: index + 1 }));
  const result = parseBestRecord(response.result);
  const best = parseBestRecord(response.best);
  if (!result || !best) throw new HttpsError("internal", "Solo 결과를 표시할 수 없습니다.");
  return { result, best, leaderboard: leaderboardRecords } as const;
});

export const abandonSoloRun = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  if (!isRecord(request.data)) throw new HttpsError("invalid-argument", "Solo 종료 요청이 올바르지 않습니다.");
  const runRef = soloRuns(student.tenantId).doc(parseRunId(request.data.runId));
  const status = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(runRef);
    const raw: unknown = snapshot.exists ? snapshot.data() : null;
    if (!isRecord(raw) || raw.ownerUid !== student.uid || raw.tenantId !== student.tenantId) {
      throw new HttpsError("permission-denied", "본인 Solo run만 종료할 수 있습니다.");
    }
    if (raw.status === "active") {
      const status = transitionSoloRunStatus("active", "abandoned");
      tx.update(runRef, { status, abandonedAt: FieldValue.serverTimestamp(), abandonedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() });
      return status;
    }
    if (raw.status === "completed" || raw.status === "abandoned") return transitionSoloRunStatus(raw.status, "abandoned");
    throw new HttpsError("failed-precondition", "Solo run 상태가 올바르지 않습니다.");
  });
  return { status } as const;
});

function parseBestRecord(value: unknown): SimpleQuizBestResult | null {
  if (!isRecord(value) || typeof value.displayLabel !== "string" || !value.displayLabel.trim()
    || typeof value.completedAtMs !== "number" || !Number.isSafeInteger(value.completedAtMs)) return null;
  const progress = parseSimpleQuizProgress(value);
  return progress ? { ...progress, displayLabel: value.displayLabel, completedAtMs: value.completedAtMs } : null;
}

function compareSimpleQuizRanks(left: SimpleQuizBestResult, right: SimpleQuizBestResult): number {
  return right.score - left.score || right.correctCount - left.correctCount || left.attemptCount - right.attemptCount || left.completedAtMs - right.completedAtMs;
}
