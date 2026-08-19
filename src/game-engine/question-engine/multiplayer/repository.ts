import { collection, doc, onSnapshot, serverTimestamp, setDoc, writeBatch, type DocumentData, type Unsubscribe } from "firebase/firestore";
import { db } from "../../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../../../multiplayer/constants.ts";
import type { Player } from "../../../multiplayer/types.ts";
import type { AnswerSubmission, BaseQuestion, GameProgress } from "../types.ts";
import type { RoundAnswerRecord, RoundProgressRecord } from "./types.ts";

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

function parseRoundAnswer(id: string, data: DocumentData): RoundAnswerRecord | null {
  const raw: unknown = data;
  if (!isRecord(raw)) return null;
  const attemptId = text(raw.attemptId);
  const playerId = text(raw.playerId);
  const questionId = text(raw.questionId);
  if (!attemptId || !playerId || !questionId || typeof raw.isCorrect !== "boolean") return null;
  return {
    id,
    attemptId,
    gameId: text(raw.gameId),
    playerId,
    displayName: text(raw.displayName),
    questionId,
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

export async function persistAnswerAttempt<TQuestion extends BaseQuestion, TAnswer, TDetails>(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
} & AnswerSubmission<TQuestion, TAnswer, TDetails>): Promise<void> {
  const { roomId, roundId, gameId, player, attemptId, question, answer, result, progress } = input;
  if (!attemptId || !player.id) throw new Error("attemptId and playerId are required.");
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(doc(answersRef(roomId, roundId), attemptId), {
    attemptId,
    gameId,
    playerId: player.id,
    displayName: player.displayName,
    questionId: question.id,
    prompt: question.prompt ?? null,
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
    ...progress,
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
    ...input.progress,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true });
}

export function subscribePlayerProgress(
  roomId: string,
  roundId: string,
  playerId: string,
  onValue: (value: unknown) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(progressRef(roomId, roundId, playerId), (snapshot) => {
    const value: unknown = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    onValue(value);
  }, onError);
}

export function subscribeRoundAnswers(
  roomId: string,
  roundId: string,
  onValue: (value: RoundAnswerRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(answersRef(roomId, roundId), (snapshot) => {
    const answers = snapshot.docs
      .map((answerDoc) => parseRoundAnswer(answerDoc.id, answerDoc.data()))
      .filter((answer): answer is RoundAnswerRecord => answer !== null)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    onValue(answers);
  }, onError);
}

export function subscribeRoundProgress(
  roomId: string,
  roundId: string,
  onValue: (value: RoundProgressRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "progress"), (snapshot) => {
    const progress = snapshot.docs
      .map((progressDoc) => parseRoundProgress(progressDoc.id, progressDoc.data()))
      .filter((item): item is RoundProgressRecord => item !== null);
    onValue(progress);
  }, onError);
}
