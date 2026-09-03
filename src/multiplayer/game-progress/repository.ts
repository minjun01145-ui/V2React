import { collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp, type DocumentData, type Unsubscribe } from "firebase/firestore";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import { createEmptyProgress, normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import { db } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import type { Player } from "../types.ts";
import { mergeProgressTransition, progressOperationId, type ProgressMutationResult } from "./mutation.ts";
import type { RoundAttemptRecord, RoundProgressRecord } from "./types.ts";

export interface GameProgressItem {
  readonly id: string;
  readonly prompt?: string;
}

export interface GameAttemptSubmission<TItem extends GameProgressItem, TAnswer, TDetails> {
  readonly attemptId: string;
  readonly item: TItem;
  readonly answer: TAnswer;
  readonly result: AnswerResult<TDetails>;
  readonly previousProgress: GameProgress<TDetails>;
  readonly progress: GameProgress<TDetails>;
}

export interface GameProgressTransition<TDetails> {
  readonly operationId: string;
  readonly previousProgress: GameProgress<TDetails>;
  readonly progress: GameProgress<TDetails>;
}

const answersRef = (roomId: string, roundId: string) => collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "answers");
const progressRef = (roomId: string, roundId: string, playerId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "progress", playerId);
const progressOperationRef = (roomId: string, roundId: string, playerId: string, operationId: string) => doc(
  db,
  MULTIPLAYER_COLLECTION,
  roomId,
  "rounds",
  roundId,
  "operations",
  playerId,
  "items",
  operationId,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStoredProgress<TDetails>(progress: GameProgress<TDetails>): Record<string, unknown> {
  const { completedItemIds, lastResult, ...fields } = progress;
  const storedLastResult = lastResult ? (() => {
    const { itemId, ...result } = lastResult;
    return { ...result, questionId: itemId };
  })() : null;
  return {
    ...fields,
    completedQuestionIds: completedItemIds,
    lastResult: storedLastResult,
  };
}

function fromStoredProgress(data: unknown): unknown {
  const raw: unknown = data;
  if (!isRecord(raw)) return null;
  const lastResult = isRecord(raw.lastResult) && typeof raw.lastResult.questionId === "string"
    ? { ...raw.lastResult, itemId: raw.lastResult.questionId }
    : raw.lastResult;
  return {
    ...raw,
    completedItemIds: raw.completedQuestionIds,
    lastResult,
  };
}

function normalizedStoredProgress<TDetails>(data: unknown): GameProgress<TDetails> {
  return normalizeProgress<TDetails>(fromStoredProgress(data), Number.MAX_SAFE_INTEGER);
}

function assertOperationId(operationId: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(operationId)) throw new Error("operationId가 올바르지 않습니다.");
}

function parseRoundAttempt(id: string, data: DocumentData): RoundAttemptRecord | null {
  const raw: unknown = data;
  if (!isRecord(raw)) return null;
  const attemptId = text(raw.attemptId);
  const playerId = text(raw.playerId);
  const itemId = text(raw.questionId);
  if (!attemptId || !playerId || !itemId || typeof raw.isCorrect !== "boolean") return null;
  return {
    id,
    attemptId,
    gameId: text(raw.gameId),
    playerId,
    displayName: text(raw.displayName),
    itemId,
    prompt: typeof raw.prompt === "string" ? raw.prompt : null,
    isCorrect: raw.isCorrect,
    scoreDelta: finiteNumber(raw.scoreDelta),
    totalScore: finiteNumber(raw.totalScore),
    attemptCount: finiteNumber(raw.attemptCount),
    createdAtMs: finiteNumber(raw.createdAtMs),
  };
}

function parseRoundProgress(id: string, data: DocumentData): RoundProgressRecord | null {
  const raw: unknown = data;
  if (!isRecord(raw)) return null;
  const playerId = text(raw.playerId);
  if (!playerId) return null;
  return {
    id,
    gameId: text(raw.gameId),
    playerId,
    displayName: text(raw.displayName),
    currentIndex: finiteNumber(raw.currentIndex),
    score: finiteNumber(raw.score),
    correctCount: finiteNumber(raw.correctCount),
    attemptCount: finiteNumber(raw.attemptCount),
    completedAtMs: typeof raw.completedAtMs === "number" && Number.isFinite(raw.completedAtMs) ? raw.completedAtMs : null,
    updatedAtMs: finiteNumber(raw.updatedAtMs),
    revision: finiteNumber(raw.revision),
  };
}

async function commitProgressMutation<TDetails>(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
  readonly operationId: string;
  readonly kind: "attempt" | "progress";
  readonly previousProgress: GameProgress<TDetails>;
  readonly progress: GameProgress<TDetails>;
  readonly attempt?: {
    readonly item: GameProgressItem;
    readonly answer: unknown;
    readonly result: AnswerResult<TDetails>;
  };
}): Promise<ProgressMutationResult<TDetails>> {
  const { roomId, roundId, gameId, player, operationId, kind, previousProgress, progress, attempt } = input;
  assertOperationId(operationId);
  if (!player.id) throw new Error("playerId가 필요합니다.");
  const operationRef = progressOperationRef(roomId, roundId, player.id, operationId);
  const playerProgressRef = progressRef(roomId, roundId, player.id);

  return runTransaction(db, async (tx) => {
    const operationSnapshot = await tx.get(operationRef);
    const progressSnapshot = await tx.get(playerProgressRef);
    const currentProgress = progressSnapshot.exists()
      ? normalizedStoredProgress<TDetails>(progressSnapshot.data())
      : createEmptyProgress<TDetails>();
    const currentRevision = progressSnapshot.exists() ? finiteNumber(progressSnapshot.data().revision) : 0;

    if (operationSnapshot.exists()) {
      const rawOperation: unknown = operationSnapshot.data();
      if (!isRecord(rawOperation)
        || rawOperation.playerId !== player.id
        || rawOperation.gameId !== gameId
        || rawOperation.kind !== kind
        || rawOperation.itemId !== (attempt?.item.id ?? null)) {
        throw new Error("operationId가 다른 progress mutation에 이미 사용되었습니다.");
      }
      return { progress: currentProgress, revision: currentRevision, duplicate: true };
    }

    const committedProgress = mergeProgressTransition(currentProgress, previousProgress, progress);
    const revision = currentRevision + 1;
    const now = Date.now();
    tx.set(operationRef, {
      operationId,
      kind,
      gameId,
      playerId: player.id,
      itemId: attempt?.item.id ?? null,
      revision,
      createdAt: serverTimestamp(),
      createdAtMs: now,
    });
    if (attempt) {
      tx.set(doc(answersRef(roomId, roundId), progressOperationId(player.id, operationId)), {
        attemptId: operationId,
        gameId,
        playerId: player.id,
        displayName: player.displayName,
        questionId: attempt.item.id,
        prompt: attempt.item.prompt ?? null,
        answer: attempt.answer,
        isCorrect: attempt.result.isCorrect,
        scoreDelta: committedProgress.score - currentProgress.score,
        totalScore: committedProgress.score,
        attemptCount: committedProgress.attemptCount,
        createdAt: serverTimestamp(),
        createdAtMs: now,
      });
    }
    tx.set(playerProgressRef, {
      gameId,
      playerId: player.id,
      displayName: player.displayName,
      ...toStoredProgress(committedProgress),
      revision,
      lastOperationId: operationId,
      updatedAt: serverTimestamp(),
      updatedAtMs: now,
    }, { merge: true });
    return { progress: committedProgress, revision, duplicate: false };
  });
}

export async function persistGameAttempt<TItem extends GameProgressItem, TAnswer, TDetails>(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
} & GameAttemptSubmission<TItem, TAnswer, TDetails>): Promise<ProgressMutationResult<TDetails>> {
  const { roomId, roundId, gameId, player, attemptId, item, answer, result, previousProgress, progress } = input;
  return commitProgressMutation({
    roomId,
    roundId,
    gameId,
    player,
    operationId: attemptId,
    kind: "attempt",
    previousProgress,
    progress,
    attempt: { item, answer, result },
  });
}

export async function persistGameProgress<TDetails>(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
} & GameProgressTransition<TDetails>): Promise<ProgressMutationResult<TDetails>> {
  return commitProgressMutation({
    ...input,
    kind: "progress",
  });
}

export function subscribePlayerProgress(roomId: string, roundId: string, playerId: string, onValue: (value: unknown) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(progressRef(roomId, roundId, playerId), (snapshot) => {
    onValue(snapshot.exists() ? fromStoredProgress(snapshot.data()) : null);
  }, onError);
}

export function subscribeRoundAttempts(roomId: string, roundId: string, onValue: (value: RoundAttemptRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(answersRef(roomId, roundId), (snapshot) => {
    const attempts = snapshot.docs.map((answerDoc) => parseRoundAttempt(answerDoc.id, answerDoc.data()))
      .filter((answer): answer is RoundAttemptRecord => answer !== null)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    onValue(attempts);
  }, onError);
}

export function subscribeRoundProgress(roomId: string, roundId: string, onValue: (value: RoundProgressRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "progress"), (snapshot) => {
    onValue(snapshot.docs.map((progressDoc) => parseRoundProgress(progressDoc.id, progressDoc.data()))
      .filter((item): item is RoundProgressRecord => item !== null));
  }, onError);
}

export async function loadRoundProgress(roomId: string, roundId: string): Promise<readonly RoundProgressRecord[]> {
  const snapshot = await getDocs(collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "progress"));
  return snapshot.docs.map((progressDoc) => parseRoundProgress(progressDoc.id, progressDoc.data()))
    .filter((item): item is RoundProgressRecord => item !== null);
}
