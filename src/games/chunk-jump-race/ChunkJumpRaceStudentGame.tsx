import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createLearningCompletion } from "../../game-engine/effects/model.ts";
import { playCorrectChime } from "../../game-engine/effects/sound.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import ChunkJumpRaceCanvas, { type ChunkJumpRaceController, type ChunkJumpStanding } from "./ChunkJumpRaceCanvas.tsx";
import {
  advanceChunkJumpCursor,
  buildChunkJumpCourse,
  CHUNK_JUMP_RESPAWN_PENALTY,
  chunkJumpChoices,
  chunkJumpStep,
  initialChunkJumpCursor,
  type ChunkJumpCursor,
} from "./model.ts";
import { useChunkJumpRaceSet } from "./useChunkJumpRaceSet.ts";
import styles from "./ChunkJumpRace.module.css";

interface StoredRaceProgress {
  readonly cursor: ChunkJumpCursor;
  readonly distance: number;
}

function raceStorageKey(roundId: string, playerId: string): string {
  return `v2r:chunk-jump-race:${roundId}:${playerId}`;
}

function readRaceProgress(key: string, course: ReturnType<typeof buildChunkJumpCourse>): StoredRaceProgress {
  const fallback = { cursor: initialChunkJumpCursor(), distance: 0 };
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
    const record = value as Record<string, unknown>;
    const cursorValue = record.cursor;
    if (typeof cursorValue !== "object" || cursorValue === null || Array.isArray(cursorValue)) return fallback;
    const cursorRecord = cursorValue as Record<string, unknown>;
    const sentenceIndex = cursorRecord.sentenceIndex;
    const chunkIndex = cursorRecord.chunkIndex;
    const distance = record.distance;
    if (!Number.isInteger(sentenceIndex) || !Number.isInteger(chunkIndex) || !Number.isInteger(distance)) return fallback;
    if ((sentenceIndex as number) < 0 || (sentenceIndex as number) >= course.sentences.length || (distance as number) < 0 || (distance as number) > 100_000) return fallback;
    const sentence = course.sentences[sentenceIndex as number];
    if (!sentence || (chunkIndex as number) < 0 || (chunkIndex as number) >= sentence.chunks.length - 1) return fallback;
    return { cursor: { sentenceIndex: sentenceIndex as number, chunkIndex: chunkIndex as number }, distance: distance as number };
  } catch {
    return fallback;
  }
}

function saveRaceProgress(key: string, progress: StoredRaceProgress): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // A disabled/full sessionStorage should not stop the race itself.
  }
}

export default function ChunkJumpRaceStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useChunkJumpRaceSet(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  const course = useMemo(() => learningSet.set ? buildChunkJumpCourse(learningSet.set) : null, [learningSet.set]);

  if (!session.expectedPlayerIds.includes(player.id)) return <StatusPanel title="다음 게임을 기다려 주세요" tone="waiting">이미 시작된 레이스에는 중간 참가할 수 없습니다.</StatusPanel>;
  if (learningSet.loading || participants.loading) return <StatusPanel title="점프 레이스 준비 중">끊어읽기 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error.message}</StatusPanel>;
  if (!course) return <StatusPanel title="학습 세트 오류" tone="error">점프 레이스에 사용할 끊어읽기 세트가 없습니다.</StatusPanel>;

  const expectedIds = new Set(session.expectedPlayerIds);
  const labels = new Map(participants.value
    .filter((participant) => expectedIds.has(participant.playerId))
    .map((participant) => [participant.playerId, displayLabel(participant.displayName, participant.nickname)] as const));
  labels.set(player.id, displayLabel(player.displayName, player.nickname));
  return <ChunkJumpRaceRuntime roomId={roomId} roundId={session.roundId} session={session} playerId={player.id} label={displayLabel(player.displayName, player.nickname)} labels={labels} course={course} />;
}

function ChunkJumpRaceRuntime({ roomId, roundId, session, playerId, label, labels, course }: {
  readonly roomId: string;
  readonly roundId: string;
  readonly session: StudentGameModuleProps["session"];
  readonly playerId: string;
  readonly label: string;
  readonly labels: ReadonlyMap<string, string>;
  readonly course: ReturnType<typeof buildChunkJumpCourse>;
}) {
  const controllerRef = useRef<ChunkJumpRaceController | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const choiceEffectTimerRef = useRef<number | null>(null);
  const completedSentenceRef = useRef<{ readonly text: string; readonly meaning: string } | null>(null);
  const storageKey = raceStorageKey(roundId, playerId);
  const [initialProgress] = useState<StoredRaceProgress>(() => readRaceProgress(storageKey, course));
  const [progress, setProgress] = useState<StoredRaceProgress>(initialProgress);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ readonly kind: "death" } | null>(null);
  const [correctChoice, setCorrectChoice] = useState<string | null>(null);
  const [standings, setStandings] = useState<readonly ChunkJumpStanding[]>([]);
  const effects = useGameEffectEngine();
  const clock = useTimedGameClock(session);
  const { cursor, distance } = progress;
  const step = chunkJumpStep(course, cursor);
  const choices = useMemo(
    () => chunkJumpChoices(course, cursor, `${roundId}:${playerId}:${distance}:${cursor.sentenceIndex}:${cursor.chunkIndex}`),
    [course, cursor, distance, playerId, roundId],
  );
  const ownRank = Math.max(1, standings.findIndex((standing) => standing.playerId === playerId) + 1);
  const expired = clock.expired;

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    if (choiceEffectTimerRef.current !== null) window.clearTimeout(choiceEffectTimerRef.current);
  }, []);

  const clearFeedbackTimer = (): void => {
    if (feedbackTimerRef.current === null) return;
    window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
  };

  const choose = (choice: string): void => {
    if (busy || expired) return;
    if (choice === step.answer) {
      if (controllerRef.current?.jumpForward()) {
        const completesSentence = cursor.chunkIndex + 1 >= step.sentence.chunks.length - 1;
        completedSentenceRef.current = completesSentence
          ? { text: step.sentence.chunks.join(" / "), meaning: step.sentence.meaning }
          : null;
        if (choiceEffectTimerRef.current !== null) window.clearTimeout(choiceEffectTimerRef.current);
        setCorrectChoice(choice);
        choiceEffectTimerRef.current = window.setTimeout(() => {
          setCorrectChoice(null);
          choiceEffectTimerRef.current = null;
        }, 360);
        playCorrectChime();
        setBusy(true);
      }
      return;
    }
    const targetDistance = Math.max(0, distance - CHUNK_JUMP_RESPAWN_PENALTY);
    if (controllerRef.current?.fallBack(targetDistance)) {
      completedSentenceRef.current = null;
      if (choiceEffectTimerRef.current !== null) {
        window.clearTimeout(choiceEffectTimerRef.current);
        choiceEffectTimerRef.current = null;
      }
      setCorrectChoice(null);
      clearFeedbackTimer();
      setFeedback({ kind: "death" });
      setBusy(true);
    }
  };

  return <div className={styles.studentShell}>
    <GameEffectLayer effect={effects.activeEffect} />
    <ChunkJumpRaceCanvas
      ref={controllerRef}
      role="student"
      roomId={roomId}
      roundId={roundId}
      playerId={playerId}
      label={label}
      initialDistance={initialProgress.distance}
      labels={labels}
      onStandings={setStandings}
      onSettled={(kind, nextDistance) => {
        setProgress((current) => {
          const next = {
            cursor: kind === "correct" ? advanceChunkJumpCursor(course, current.cursor) : current.cursor,
            distance: nextDistance,
          };
          saveRaceProgress(storageKey, next);
          return next;
        });
        if (kind === "correct" && completedSentenceRef.current) {
          const completedSentence = completedSentenceRef.current;
          completedSentenceRef.current = null;
          clearFeedbackTimer();
          setFeedback(null);
          const completionEffect = createLearningCompletion(completedSentence);
          effects.play(completionEffect);
          feedbackTimerRef.current = window.setTimeout(() => {
            setBusy(false);
            feedbackTimerRef.current = null;
          }, completionEffect.durationMs);
          return;
        }
        completedSentenceRef.current = null;
        setFeedback(null);
        setBusy(false);
      }}
    />
    <div className={styles.studentHud}>
      <span><small>거리</small><b>{distance}</b></span>
      <span><small>순위</small><b>{ownRank}위</b></span>
      <TimedGameStatus session={session} compact />
    </div>
    <div className={styles.skyQuestion} aria-label="다음 끊어읽기 조각 선택">
      <strong className={styles.skyPrompt}>{step.currentChunks.join(" / ")}</strong>
      <div className={styles.skyChoices}>
        {choices.map((choice) => <button
          type="button"
          className={choice === correctChoice ? styles.correctChoice : undefined}
          onClick={() => choose(choice)}
          disabled={busy || expired}
          key={choice}
        >{choice}</button>)}
      </div>
      {expired ? <span className={styles.skyHint}>시간 종료</span> : null}
    </div>
    {feedback?.kind === "death" ? <div className={`${styles.raceFeedback} ${styles.deathFeedback}`} role="status">
      <strong>죽었습니다!</strong>
      <span>{CHUNK_JUMP_RESPAWN_PENALTY}칸 아래에서 리스폰됩니다.</span>
    </div> : null}
  </div>;
}
