import { collection, doc, onSnapshot, serverTimestamp, setDoc, writeBatch, type DocumentData, type Unsubscribe } from "firebase/firestore";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import type { GameProgress } from "../../game-engine/progress/index.ts";
import { db } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import type { Player } from "../types.ts";
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
  readonly progress: GameProgress<TDetails>;
}

const answersRef = (roomId: string, roundId: string) => collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "answers");
const progressRef = (roomId: string, roundId: string, playerId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "progress", playerId);

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

function fromStoredProgress(data: DocumentData): unknown {
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
  };
}

export async function persistGameAttempt<TItem extends GameProgressItem, TAnswer, TDetails>(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
} & GameAttemptSubmission<TItem, TAnswer, TDetails>): Promise<void> {
  const { roomId, roundId, gameId, player, attemptId, item, answer, result, progress } = input;
  if (!attemptId || !player.id) throw new Error("attemptId and playerId are required.");
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(doc(answersRef(roomId, roundId), attemptId), {
    attemptId,
    gameId,
    playerId: player.id,
    displayName: player.displayName,
    questionId: item.id,
    prompt: item.prompt ?? null,
    answer,
    isCorrect: result.isCorrect,
    scoreDelta: result.scoreDelta,
    totalScore: progress.score,
    attemptCount: progress.attemptCount,
    createdAt: serverTimestamp(),
    createdAtMs: now,
  });
  batch.set(progressRef(roomId, roundId, player.id), {
    gameId,
    playerId: player.id,
    displayName: player.displayName,
    ...toStoredProgress(progress),
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  }, { merge: true });
  await batch.commit();
}

export async function savePlayerProgress<TDetails>(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
  readonly progress: GameProgress<TDetails>;
}): Promise<void> {
  await setDoc(progressRef(input.roomId, input.roundId, input.player.id), {
    gameId: input.gameId,
    playerId: input.player.id,
    displayName: input.player.displayName,
    ...toStoredProgress(input.progress),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true });
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
