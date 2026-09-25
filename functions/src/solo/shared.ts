import { createHash } from "node:crypto";
import type { DocumentReference } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { requireRegularStudent } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import type { TenantId } from "../shared/tenant.js";
import { isSoloGameId, parseSoloGameConfig, soloGameRules, type SoloGameId } from "./registry.js";
import { emptySoloQuestionProgress, parseSoloQuestionAuthoritativeState, soloLeaderboardScopeId, type SoloQuestionAuthoritativeState } from "./model.js";

export type SoloStudent = Awaited<ReturnType<typeof requireRegularStudent>>;

export function soloRuns(tenantId: TenantId) {
  return db.collection("tenants").doc(tenantId).collection("soloRuns");
}

export function soloRunPointer(tenantId: TenantId, studentAccountId: string) {
  const key = createHash("sha256").update(studentAccountId).digest("hex");
  return db.collection("tenants").doc(tenantId).collection("soloActiveRuns").doc(key);
}

export function leaderboard(tenantId: TenantId, scopeId: string) {
  return db.collection("tenants").doc(tenantId).collection("soloLeaderboards").doc(scopeId);
}

export function authoritativeProgress(runRef: DocumentReference, uid: string) {
  return runRef.collection("authoritativeProgress").doc(uid);
}

export function soloAnswer(runRef: DocumentReference, questionId: string) {
  const questionKey = createHash("sha256").update(questionId).digest("hex");
  return runRef.collection("answers").doc(questionKey);
}

export function soloAttemptAnswer(runRef: DocumentReference, questionId: string, attemptId: string) {
  const attemptKey = createHash("sha256").update(`${questionId}:${attemptId}`).digest("hex");
  return runRef.collection("answers").doc(attemptKey);
}

export function scopeInput(run: Record<string, unknown>): {
  readonly tenantId: string;
  readonly gameId: SoloGameId;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly rulesVersion: string;
} {
  if (!isSoloGameId(run.gameId) || typeof run.tenantId !== "string" || typeof run.setId !== "string"
    || typeof run.setFingerprint !== "string" || typeof run.rulesVersion !== "string" || !isRecord(run.gameConfig)) {
    throw new HttpsError("failed-precondition", "Solo run 설정이 올바르지 않습니다.");
  }
  const gameId = run.gameId;
  const gameConfig = parseSoloGameConfig(gameId, run.setId, run.gameConfig);
  const rules = soloGameRules(gameId);
  if (run.rulesVersion !== rules.rulesVersion) throw new HttpsError("failed-precondition", "Solo run 설정을 확인할 수 없습니다.");
  return { tenantId: run.tenantId, gameId, setId: run.setId, setFingerprint: run.setFingerprint, gameConfig, rulesVersion: run.rulesVersion };
}

export function verifySoloScope(run: Record<string, unknown>): string {
  const input = scopeInput(run);
  const scopeId = soloLeaderboardScopeId({ ...input, configKeys: soloGameRules(input.gameId).leaderboardConfigKeys });
  if (run.leaderboardScopeId !== scopeId) throw new HttpsError("failed-precondition", "Solo leaderboard 범위가 일치하지 않습니다.");
  return scopeId;
}

export function parseSoloRunId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", "Solo run ID가 올바르지 않습니다.");
  return value;
}

export function assertSoloRunIdentity(run: Record<string, unknown>, student: SoloStudent, gameId: string): void {
  if (run.ownerUid !== student.uid || run.tenantId !== student.tenantId || run.gameId !== gameId) {
    throw new HttpsError("permission-denied", "본인 Solo run만 이용할 수 있습니다.");
  }
  if (run.studentAccountId !== student.studentAccountId) throw new HttpsError("permission-denied", "Solo run의 학생 계정 정보가 일치하지 않습니다.");
}

export function emptySoloQuestionState() {
  return {
    progress: emptySoloQuestionProgress(),
    expectedQuestionIndex: 0,
    attemptsByQuestionId: {} as Record<string, number>,
  } as const;
}

export function soloQuestionStateFor(runId: string, student: SoloStudent, gameId: SoloGameId, state: SoloQuestionAuthoritativeState) {
  return {
    tenantId: student.tenantId,
    studentAccountId: student.studentAccountId,
    ownerUid: student.uid,
    runId,
    gameId,
    rulesVersion: soloGameRules(gameId).rulesVersion,
    progress: state,
  } as const;
}

export function validateSoloQuestionState(value: unknown, runId: string, student: SoloStudent, gameId: SoloGameId): SoloQuestionAuthoritativeState | null {
  if (!isRecord(value) || value.runId !== runId || value.ownerUid !== student.uid
    || value.studentAccountId !== student.studentAccountId || value.tenantId !== student.tenantId
    || value.gameId !== gameId || value.rulesVersion !== soloGameRules(gameId).rulesVersion) return null;
  return parseSoloQuestionAuthoritativeState(value.progress);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
