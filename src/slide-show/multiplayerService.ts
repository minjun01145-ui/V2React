import { collection, deleteField, doc, getDocs, runTransaction, serverTimestamp, setDoc, type Transaction, type Unsubscribe } from "firebase/firestore";
import { appConfig } from "../config/appConfig.ts";
import { db } from "../firebase/firebaseClient.ts";
import { canStartSession, MULTIPLAYER_COLLECTION, SESSION_STATUS, type SessionStatus } from "../multiplayer/constants.ts";
import { selectActivePlayers } from "../multiplayer/presence.ts";
import { ensureSession, loadPlayers, subscribeSessionField } from "../multiplayer/repository.ts";
import { participantIdentity } from "../multiplayer/round-participants/model.ts";
import { roundParticipantRef } from "../multiplayer/round-participants/repository.ts";
import type { GameSession, Player } from "../multiplayer/types.ts";
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
    if (!isRecord(currentData) || !canStartSession(parseStatus(currentData.status)) || currentData.classroomActivity) return;
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
  const runId = crypto.randomUUID();
  const slidesCollection = runSlidesCollection(roomId, runId);
  await Promise.all(slides.map((slide) => setDoc(doc(slidesCollection, slide.id), { canvas: slide.canvas, engine: slide.engine })));
  const activePlayers = await loadActivePlayers(roomId);
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const ref = sessionRef(roomId);
    const currentSession = await tx.get(ref);
    const currentData: unknown = currentSession.exists() ? currentSession.data() : null;
    if (!isRecord(currentData) || !canStartSession(parseStatus(currentData.status)) || currentData.classroomActivity) return;
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
  });
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
