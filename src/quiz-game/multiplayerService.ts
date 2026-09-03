import { deleteField, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { appConfig } from "../config/appConfig.ts";
import { db } from "../firebase/firebaseClient.ts";
import { canStartSession, MULTIPLAYER_COLLECTION, SESSION_STATUS, type SessionStatus } from "../multiplayer/constants.ts";
import { selectActivePlayers } from "../multiplayer/presence.ts";
import { ensureSession, loadPlayers } from "../multiplayer/repository.ts";
import { participantIdentity } from "../multiplayer/round-participants/model.ts";
import { roundParticipantRef } from "../multiplayer/round-participants/repository.ts";
import type { GameSession } from "../multiplayer/types.ts";
import { quizRoundGameConfig } from "./runtimeConfig.ts";
import { advanceQuizGameRound, assertQuizGamePhaseTransition, completeQuizGame, createQuizGameSessionState } from "./stateMachine.ts";
import type { QuizGamePhase, QuizGamePlan, QuizGameSessionState } from "./types.ts";
import { parseQuizGameSessionState, validateQuizGameRounds } from "./validation.ts";

export const QUIZ_GAME_SESSION_FIELD = "quizGame";

const sessionRef = (roomId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): SessionStatus {
  if (value === SESSION_STATUS.PREPARING || value === SESSION_STATUS.PLAYING || value === SESSION_STATUS.FINISHED) return value;
  return SESSION_STATUS.WAITING;
}

export function quizGameSessionState(session: GameSession): QuizGameSessionState | null {
  return parseQuizGameSessionState(session.sessionData[QUIZ_GAME_SESSION_FIELD]);
}

export async function startQuizGame(roomId: string, plan: QuizGamePlan): Promise<void> {
  validateQuizGameRounds(plan.rounds);
  await ensureSession(roomId);
  const now = Date.now();
  const activePlayers = selectActivePlayers(await loadPlayers(roomId), now, appConfig.playerStaleAfterMs);
  const roundId = crypto.randomUUID();
  const quizGame = createQuizGameSessionState(plan, roundId);
  const firstRound = plan.rounds[quizGame.currentRoundIndex];
  if (!firstRound) throw new Error("시작할 퀴즈 라운드가 없습니다.");
  await runTransaction(db, async (tx) => {
    const ref = sessionRef(roomId);
    const currentSession = await tx.get(ref);
    const currentData: unknown = currentSession.exists() ? currentSession.data() : null;
    if (!isRecord(currentData) || !canStartSession(parseStatus(currentData.status))) return;
    tx.set(ref, {
      gameId: firstRound.gameId,
      gameConfig: quizRoundGameConfig(firstRound),
      [QUIZ_GAME_SESSION_FIELD]: quizGame,
      status: SESSION_STATUS.PREPARING,
      roundId,
      expectedPlayerIds: activePlayers.map((player) => player.id),
      startedAt: deleteField(),
      startedAtMs: deleteField(),
      startDelayMs: deleteField(),
      updatedAt: serverTimestamp(),
      updatedAtMs: now,
    }, { merge: true });
    for (const player of activePlayers) {
      tx.set(roundParticipantRef(roomId, roundId, player.id), { ...participantIdentity(player), joinedAt: serverTimestamp(), joinedAtMs: now });
    }
  });
}

export async function setQuizGamePhase(roomId: string, roundId: string, phase: Exclude<QuizGamePhase, "answering" | "complete">): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = sessionRef(roomId);
    const snapshot = await tx.get(ref);
    const data: unknown = snapshot.exists() ? snapshot.data() : null;
    if (!isRecord(data) || parseStatus(data.status) !== SESSION_STATUS.PLAYING || data.roundId !== roundId) return;
    const quizGame = parseQuizGameSessionState(data[QUIZ_GAME_SESSION_FIELD]);
    if (!quizGame) return;
    assertQuizGamePhaseTransition(quizGame.phase, phase);
    tx.update(ref, {
      [QUIZ_GAME_SESSION_FIELD]: { ...quizGame, phase },
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    });
  });
}

export async function advanceQuizGame(roomId: string): Promise<void> {
  const players = await loadPlayers(roomId);
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const ref = sessionRef(roomId);
    const snapshot = await tx.get(ref);
    const data: unknown = snapshot.exists() ? snapshot.data() : null;
    if (!isRecord(data) || parseStatus(data.status) !== SESSION_STATUS.PLAYING) return;
    const currentQuizGame = parseQuizGameSessionState(data[QUIZ_GAME_SESSION_FIELD]);
    if (!currentQuizGame || currentQuizGame.phase !== "leaderboard") return;
    const nextIndex = currentQuizGame.currentRoundIndex + 1;
    const nextRound = currentQuizGame.plan.rounds[nextIndex];
    if (!nextRound) {
      tx.update(ref, { [QUIZ_GAME_SESSION_FIELD]: completeQuizGame(currentQuizGame), updatedAt: serverTimestamp(), updatedAtMs: now });
      return;
    }
    const roundId = crypto.randomUUID();
    const advanced = advanceQuizGameRound(currentQuizGame, roundId);
    const resolvedNextRound = advanced.round;
    const quizGame = advanced.state;
    tx.set(ref, {
      gameId: resolvedNextRound.gameId,
      gameConfig: quizRoundGameConfig(resolvedNextRound),
      [QUIZ_GAME_SESSION_FIELD]: quizGame,
      status: SESSION_STATUS.PREPARING,
      roundId,
      expectedPlayerIds: players.map((player) => player.id),
      startedAt: deleteField(),
      startedAtMs: deleteField(),
      startDelayMs: deleteField(),
      updatedAt: serverTimestamp(),
      updatedAtMs: now,
    }, { merge: true });
    for (const player of players) {
      tx.set(roundParticipantRef(roomId, roundId, player.id), { ...participantIdentity(player), joinedAt: serverTimestamp(), joinedAtMs: now });
    }
  });
}
