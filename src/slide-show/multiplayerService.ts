import { publicQuestionSource } from "../slide-question/model.ts";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocFromServer, getDocs, runTransaction, serverTimestamp, setDoc, type DocumentReference, type Transaction, type Unsubscribe } from "firebase/firestore";
import { appConfig } from "../config/appConfig.ts";
import { db } from "../firebase/firebaseClient.ts";
import { canStartSession, MULTIPLAYER_COLLECTION, SESSION_STATUS, type SessionStatus } from "../multiplayer/constants.ts";
import { selectActivePlayers } from "../multiplayer/presence.ts";
import { ensureSession, loadPlayers, subscribeSessionField } from "../multiplayer/repository.ts";
import { participantIdentity } from "../multiplayer/round-participants/model.ts";
import { roundParticipantRef } from "../multiplayer/round-participants/repository.ts";
import type { GameSession, Player } from "../multiplayer/types.ts";
import { parseLobbyGathering } from "../multiplayer/lobbyGathering.ts";
import { slideEngineGameConfig } from "./engineConfig.ts";
import {
  advanceSlideEnginePhase,
  awardShowPoints as addAwards,
  closeSlideEngine,
  createSlideShowSessionState,
  goToSlide,
  startSlideEngine,
} from "./sessionState.ts";
import type { Slide, SlideEnginePhase, SlideShow, SlideShowSessionState } from "./types.ts";
import { parseSlide, parseSlideShowSessionState, validateSlides } from "./validation.ts";
import { adjustTimerSeconds, slideTimerSnapshot } from "./timer.ts";
import type { TimerSkin } from "./timerSkins.ts";

const SLIDE_SHOW_SESSION_FIELD = "slideShow";
/** Session gameId while slides (not an engine) are on screen. */
export const SLIDE_SHOW_GAME_ID = "slide-show";

const sessionRef = (roomId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId);
/** Each run gets its own copy of the slides so students read exactly what was started. */
const runSlidesCollection = (roomId: string, runId: string) => collection(db, MULTIPLAYER_COLLECTION, roomId, "showRuns", runId, "slides");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): SessionStatus {
  if (value === SESSION_STATUS.PREPARING || value === SESSION_STATUS.PLAYING || value === SESSION_STATUS.FINISHED) return value;
  return SESSION_STATUS.WAITING;
}

function assertSessionCanStart(data: unknown): void {
  if (!isRecord(data) || !canStartSession(parseStatus(data.status))) throw new Error("진행 중인 수업을 종료한 뒤 시작해 주세요.");
  if (data.classroomActivity) throw new Error("질문 만들기를 종료한 뒤 시작해 주세요.");
  if (parseLobbyGathering(data.lobbyGathering)?.active) throw new Error("점프타워 집합을 해산한 뒤 시작해 주세요.");
}

export interface SlideShowSessionSnapshot {
  readonly session: GameSession;
  readonly slideShow: SlideShowSessionState | null;
}

export function subscribeSlideShowSession(
  roomId: string,
  onValue: (value: SlideShowSessionSnapshot | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return subscribeSessionField(roomId, SLIDE_SHOW_SESSION_FIELD, parseSlideShowSessionState, (value) => {
    onValue(value ? { session: value.session, slideShow: value.field } : null);
  }, onError);
}

async function loadActivePlayers(roomId: string): Promise<readonly Player[]> {
  return selectActivePlayers(await loadPlayers(roomId), Date.now(), appConfig.playerStaleAfterMs);
}

function addParticipants(tx: Transaction, roomId: string, roundId: string, players: readonly Player[], now: number): void {
  for (const player of players) {
    tx.set(roundParticipantRef(roomId, roundId, player.id), { ...participantIdentity(player), joinedAt: serverTimestamp(), joinedAtMs: now });
  }
}

interface RegularGameSessionOptions {
  readonly gameId: string;
  readonly gameConfig?: Readonly<Record<string, unknown>>;
}

export async function startRegularGameSession(roomId: string, options: RegularGameSessionOptions): Promise<void> {
  await ensureSession(roomId);
  const now = Date.now();
  const activePlayers = await loadActivePlayers(roomId);
  const roundId = crypto.randomUUID();
  const nextSession: Record<string, unknown> = {
    gameId: options.gameId,
    status: SESSION_STATUS.PREPARING,
    roundId,
    expectedPlayerIds: activePlayers.map((player) => player.id),
    startedAt: deleteField(),
    startedAtMs: deleteField(),
    startDelayMs: deleteField(),
    [SLIDE_SHOW_SESSION_FIELD]: deleteField(),
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  };
  if (options.gameConfig !== undefined) nextSession.gameConfig = options.gameConfig;
  await runTransaction(db, async (tx) => {
    const ref = sessionRef(roomId);
    const currentSession = await tx.get(ref);
    const currentData: unknown = currentSession.exists() ? currentSession.data() : null;
    assertSessionCanStart(currentData);
    tx.update(ref, nextSession);
    addParticipants(tx, roomId, roundId, activePlayers, now);
  });
}

export async function resetSlideAwareSession(roomId: string): Promise<void> {
  await ensureSession(roomId);
  await setDoc(sessionRef(roomId), {
    status: SESSION_STATUS.WAITING,
    roundId: null,
    startedAt: deleteField(),
    startedAtMs: deleteField(),
    startDelayMs: deleteField(),
    gameConfig: deleteField(),
    expectedPlayerIds: [],
    [SLIDE_SHOW_SESSION_FIELD]: deleteField(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true });
}

/** Slides are shown immediately, so the show itself skips the readiness handshake. */
export async function startSlideShow(roomId: string, show: SlideShow): Promise<void> {
  const slides = validateSlides(show.slides);
  await ensureSession(roomId);
  const ref = sessionRef(roomId);
  const session = await getDoc(ref);
  assertSessionCanStart(session.exists() ? session.data() : null);
  const runId = crypto.randomUUID();
  const slidesCollection = runSlidesCollection(roomId, runId);
  const activationRef = doc(slidesCollection, slides[0]!.id);
  const writes = slides.flatMap<{ ref: DocumentReference; data: Record<string, unknown> }>((slide) => {
    const source = slide.engine?.round.source;
    if (source?.kind === "slide-question") return [
      { ref: doc(db, MULTIPLAYER_COLLECTION, roomId, "showRuns", runId, "questionKeys", slide.id), data: { grading: source.grading } },
      { ref: doc(slidesCollection, slide.id), data: { canvas: slide.canvas, engine: { ...slide.engine, round: { ...slide.engine!.round, source: publicQuestionSource(source) } } } },
    ];
    return [{ ref: doc(slidesCollection, slide.id), data: { canvas: slide.canvas, engine: slide.engine } }];
  });
  try {
    // Finish every upload before activation or cleanup: one failed upload must not leave
    // other in-flight uploads recreating documents after they have been deleted.
    const uploaded = await Promise.allSettled(writes.map((write) => setDoc(write.ref, write.data)));
    const failed = uploaded.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    const activePlayers = await loadActivePlayers(roomId);
    const now = Date.now();
    await runTransaction(db, async (tx) => {
      const currentSession = await tx.get(ref);
      assertSessionCanStart(currentSession.exists() ? currentSession.data() : null);
      tx.update(ref, {
        gameId: SLIDE_SHOW_GAME_ID,
        gameConfig: deleteField(),
        [SLIDE_SHOW_SESSION_FIELD]: createSlideShowSessionState({ ...show, slides }, runId),
        status: SESSION_STATUS.PLAYING,
        roundId: runId,
        expectedPlayerIds: activePlayers.map((player) => player.id),
        startedAt: serverTimestamp(),
        startedAtMs: now,
        startDelayMs: deleteField(),
        updatedAt: serverTimestamp(),
        updatedAtMs: now,
      });
      addParticipants(tx, roomId, runId, activePlayers, now);
      // This receipt commits with the session. It disambiguates a lost commit response.
      tx.update(activationRef, { activated: true });
    });
  } catch (error) {
    try {
      const receipt = await getDocFromServer(activationRef);
      if (receipt.exists() && receipt.data().activated === true) return;
    } catch {
      // Do not delete a possibly active show's slides when the server cannot confirm it.
      console.warn("슬라이드 실행 여부를 확인하지 못해 준비 데이터를 보존했습니다.", runId);
      throw error;
    }
    // Each attempt owns a fresh runId, so cleanup never touches a different class/run.
    const cleaned = await Promise.allSettled(writes.map((write) => deleteDoc(write.ref)));
    if (cleaned.some((result) => result.status === "rejected")) console.warn("시작하지 못한 슬라이드 실행 데이터를 정리하지 못했습니다.", runId);
    throw error;
  }
}

export async function loadShowRunSlides(roomId: string, runId: string): Promise<ReadonlyMap<string, Slide>> {
  const snapshot = await getDocs(runSlidesCollection(roomId, runId));
  return new Map(snapshot.docs.flatMap((item) => {
    const slide = parseSlide(item.id, item.data());
    return slide ? [[slide.id, slide] as const] : [];
  }));
}

async function updateShowState(
  roomId: string,
  update: (state: SlideShowSessionState, tx: Transaction) => Promise<Record<string, unknown>> | Record<string, unknown>,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = sessionRef(roomId);
    const snapshot = await tx.get(ref);
    const data: unknown = snapshot.exists() ? snapshot.data() : null;
    const status = isRecord(data) ? parseStatus(data.status) : SESSION_STATUS.WAITING;
    const state = isRecord(data) ? parseSlideShowSessionState(data[SLIDE_SHOW_SESSION_FIELD]) : null;
    if (!state || (status !== SESSION_STATUS.PLAYING && status !== SESSION_STATUS.PREPARING)) throw new Error("진행 중인 슬라이드쇼가 없습니다.");
    const patch = await update(state, tx);
    // Other show transitions must retain the raw Firestore timestamp, not its parsed millisecond value.
    if (isRecord(patch[SLIDE_SHOW_SESSION_FIELD]) && isRecord(data) && isRecord(data[SLIDE_SHOW_SESSION_FIELD])) {
      const rawShow = data[SLIDE_SHOW_SESSION_FIELD] as Record<string, unknown>;
      patch[SLIDE_SHOW_SESSION_FIELD] = { ...patch[SLIDE_SHOW_SESSION_FIELD], timer: rawShow.timer ?? null };
    }
    tx.update(ref, { ...patch, updatedAt: serverTimestamp(), updatedAtMs: Date.now() });
  });
}

export function goToShowSlide(roomId: string, index: number): Promise<void> {
  return updateShowState(roomId, (state) => ({ [SLIDE_SHOW_SESSION_FIELD]: goToSlide(state, index) }));
}

/** Starts the current slide's engine as a fresh round so the normal readiness flow and scoring apply. */
export async function startShowSlideEngine(roomId: string): Promise<void> {
  const activePlayers = await loadActivePlayers(roomId);
  await updateShowState(roomId, async (state, tx) => {
    const slideId = state.slideIds[state.currentSlideIndex] ?? "";
    const slideSnapshot = await tx.get(doc(runSlidesCollection(roomId, state.runId), slideId));
    const slide = slideSnapshot.exists() ? parseSlide(slideSnapshot.id, slideSnapshot.data()) : null;
    if (!slide?.engine) throw new Error("이 슬라이드에는 문제 엔진이 없습니다.");
    const roundId = crypto.randomUUID();
    const now = Date.now();
    addParticipants(tx, roomId, roundId, activePlayers, now);
    return {
      gameId: slide.engine.round.gameId,
      gameConfig: slideEngineGameConfig(slide.engine.round, slide.id),
      [SLIDE_SHOW_SESSION_FIELD]: startSlideEngine(state, slide, roundId),
      status: SESSION_STATUS.PREPARING,
      roundId,
      expectedPlayerIds: activePlayers.map((player) => player.id),
      startedAt: deleteField(),
      startedAtMs: deleteField(),
      startDelayMs: deleteField(),
    };
  });
}

export function setShowEnginePhase(roomId: string, phase: Exclude<SlideEnginePhase, "answering">): Promise<void> {
  return updateShowState(roomId, (state) => ({ [SLIDE_SHOW_SESSION_FIELD]: advanceSlideEnginePhase(state, phase) }));
}

/** Back to the slide. A still-preparing engine is abandoned and the show resumes as playing. */
export function closeShowEngine(roomId: string): Promise<void> {
  return updateShowState(roomId, (state) => ({
    [SLIDE_SHOW_SESSION_FIELD]: closeSlideEngine(state),
    gameId: SLIDE_SHOW_GAME_ID,
    status: SESSION_STATUS.PLAYING,
  }));
}

export function awardShowPoints(roomId: string, playerIds: readonly string[], points: number): Promise<void> {
  return updateShowState(roomId, (state) => ({ [SLIDE_SHOW_SESSION_FIELD]: addAwards(state, playerIds, points) }));
}

export function changeShowTimer(roomId: string, runId: string, command: "start" | "pause" | "reset" | number, nowMs: number, skin: TimerSkin): Promise<void> {
  return updateShowState(roomId, (state) => {
    if (state.runId !== runId) throw new Error("슬라이드쇼가 변경되었습니다.");
    const timer = slideTimerSnapshot(state.timer, nowMs);
    if (command === "start") {
      if (timer.running || timer.remainingSeconds === 0) return {};
      return { "slideShow.timerSkin": skin, "slideShow.timer": { durationSeconds: timer.durationSeconds, remainingSeconds: timer.remainingSeconds, startedAt: serverTimestamp() } };
    }
    if (typeof command === "number" && timer.running) return {};
    const remainingSeconds = typeof command === "number" ? adjustTimerSeconds(timer.remainingSeconds, command)
      : command === "reset" ? timer.durationSeconds : timer.remainingSeconds;
    return { "slideShow.timer": {
      durationSeconds: typeof command === "number" ? remainingSeconds : timer.durationSeconds,
      remainingSeconds, startedAt: null,
    } };
  });
}

export function setShowTimerSkin(roomId: string, runId: string, skin: TimerSkin): Promise<void> {
  return updateShowState(roomId, (state) => {
    if (state.runId !== runId) throw new Error("슬라이드쇼가 변경되었습니다.");
    return { "slideShow.timerSkin": skin };
  });
}
