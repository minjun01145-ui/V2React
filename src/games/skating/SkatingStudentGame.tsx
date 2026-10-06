import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { LiveEvent } from "../../live-world/client.ts";
import { usePlayerGameProgress } from "../../multiplayer/game-progress/hooks.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import type { RoundParticipant } from "../../multiplayer/round-participants/model.ts";
import { displayLabel, type ActiveGameSession, type Player } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { createSkatingFx } from "./fx.ts";
import { createSkatingInput, useSkatingKeyboard, useSkatingPointer, type SkatingInput } from "./input.ts";
import { buildSkatingCourse, type SkatingCourse } from "./model.ts";
import SkatingStage from "./scene/SkatingStage.tsx";
import { BOOSTER_MS, SPEED_UP_STEP } from "./sim/items.ts";
import { useSkatingLiveWorld } from "./useSkatingLiveWorld.ts";
import { skatingResumeX, useSkatingRunner, type SkatingDetails } from "./useSkatingRunner.ts";
import { useSkatingSet } from "./useSkatingSet.ts";
import { useSkatingSound } from "./useSkatingSound.ts";
import styles from "./Skating.module.css";

export default function SkatingStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useSkatingSet(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  const course = useMemo(
    () => learningSet.set ? buildSkatingCourse(learningSet.set, session.roundId) : null,
    [learningSet.set, session.roundId],
  );

  if (learningSet.loading || participants.loading) return <StatusPanel title="스케이팅 준비 중">학습 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error.message}</StatusPanel>;
  if (!course) return <StatusPanel title="학습 세트 오류" tone="error">스케이팅에 사용할 단어 세트가 없습니다.</StatusPanel>;
  if (participants.error) return <StatusPanel title="참가자 연결 오류" tone="error">{participants.error.message}</StatusPanel>;
  return <SkatingRuntime key={session.roundId} roomId={roomId} session={session} player={player} course={course} participants={participants.value} />;
}

function SkatingRuntime({ roomId, session, player, course, participants }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly course: SkatingCourse;
  readonly participants: readonly RoundParticipant[];
}) {
  const saved = usePlayerGameProgress(roomId, session.roundId, player.id);
  // Freeze the first loaded value: later snapshots are this player's own saves.
  const [initialProgress, setInitialProgress] = useState<GameProgress<SkatingDetails> | null>(null);
  useEffect(() => {
    if (initialProgress || saved.loading || saved.error) return;
    setInitialProgress(normalizeProgress<SkatingDetails>(saved.value, Number.MAX_SAFE_INTEGER));
  }, [initialProgress, saved.loading, saved.error, saved.value]);

  if (!initialProgress) {
    return <StatusPanel title={saved.error ? "기록 연결 오류" : "출발 준비 중"} tone={saved.error ? "error" : "waiting"}>
      {saved.error?.message ?? "이전 진행 기록을 확인하고 있습니다."}
    </StatusPanel>;
  }
  return <SkatingPlayfield roomId={roomId} session={session} player={player} course={course}
    participants={participants} initialProgress={initialProgress} />;
}

function SkatingPlayfield({ roomId, session, player, course, participants, initialProgress }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly course: SkatingCourse;
  readonly participants: readonly RoundParticipant[];
  readonly initialProgress: GameProgress<SkatingDetails>;
}) {
  const fx = useMemo(createSkatingFx, []);
  const controls = useMemo(createSkatingInput, []);
  const sound = useSkatingSound(fx, player.id);
  const receiveRef = useRef<(event: LiveEvent) => void>(() => undefined);
  const live = useSkatingLiveWorld({
    roomId,
    roundId: session.roundId,
    playerId: player.id,
    initialState: { x: skatingResumeX(initialProgress), y: 0, vx: 0, vy: 0 },
    onEvent: (event) => receiveRef.current(event),
  });
  const game = useSkatingRunner({ roomId, session, player, course, initialProgress, controls, fx, live });
  receiveRef.current = game.receiveEvent;
  const stageRef = useRef<HTMLDivElement>(null);
  const { unlock } = sound;
  const onFirstInput = useCallback(() => unlock(), [unlock]);
  useSkatingKeyboard(controls, onFirstInput);
  useSkatingPointer(stageRef, controls, onFirstInput);
  const labels = useMemo(
    () => new Map(participants.map((item) => [item.playerId, displayLabel(item.displayName, item.nickname)])),
    [participants],
  );
  const selfLabel = displayLabel(player.displayName, player.nickname);
  const { hud, progress, impact } = game;
  const crashed = hud.respawnLeftMs > 0;

  const hold = (key: string, direction: -1 | 1) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      controls.held.set(key, direction);
      unlock();
    },
    onPointerUp: () => controls.held.delete(key),
    onPointerCancel: () => controls.held.delete(key),
    onLostPointerCapture: () => controls.held.delete(key),
  });

  return <div className={styles.shell}>
    <header className={styles.hud}>
      <div><strong>스케이팅</strong><span>{hud.distance} m · {hud.rank} / {hud.racers}위</span></div>
      <div className={styles.score}><strong>{progress.score.toLocaleString()} <span>점</span></strong></div>
      <button className={styles.sound} type="button" onClick={sound.toggle} aria-pressed={!sound.muted}>{sound.muted ? "소리 꺼짐" : "소리 켜짐"}</button>
    </header>
    <div className={styles.stats}>
      <strong>{progress.combo} COMBO</strong>
      <div className={styles.buffs}>
        {hud.speedUps > 0 ? <span className={styles.speedBuff}>속도 +{Math.round(hud.speedUps * SPEED_UP_STEP * 100)}%</span> : null}
        {hud.boostLeftMs > 0 ? <span className={styles.boostBuff}>
          부스터 {Math.ceil(hud.boostLeftMs / 1_000)}초<i style={{ width: `${hud.boostLeftMs / BOOSTER_MS * 100}%` }} />
        </span> : null}
      </div>
      <span>정답 {progress.correctCount} / {progress.attemptCount}</span>
    </div>
    {live.error ? <div className={styles.connectionError}>실시간 연결 오류: {live.error.message}</div> : null}
    {game.saveError ? <div className={styles.connectionError}>기록 저장 오류: {game.saveError.message}</div> : null}
    <div className={styles.stageWrap}>
      <SkatingStage
        ref={stageRef}
        course={course}
        seed={session.roundId}
        fx={fx}
        self={{ id: player.id, label: selfLabel, snapshot: () => game.snapshotRef.current, hasCollected: game.hasCollected }}
        remotes={live.sample}
        label={(id) => labels.get(id)}
      />
      {impact && !impact.correct && crashed ? <div key={impact.gateIndex} role="status" className={`${styles.feedback} ${styles.wrong}`}>
        {impact.prompt} = {impact.answer}
      </div> : null}
      {!game.started ? <div className={styles.overlay}>
        <strong>READY?</strong>
        <button type="button" onClick={() => { unlock(); game.start(); }}>출발!</button>
      </div> : hud.countdown > 0 ? <div className={styles.overlay} role="status"><strong>{hud.countdown}</strong></div>
        : crashed ? <div className={`${styles.overlay} ${styles.crashOverlay}`} role="status"><strong>{Math.ceil(hud.respawnLeftMs / 1_000)}</strong></div>
          : null}
    </div>
    <div className={styles.controls}>
      <button type="button" aria-label="위로" {...hold("button-up", -1)}>▲</button>
      <button type="button" aria-label="아래로" {...hold("button-down", 1)}>▼</button>
      <button type="button" className={styles.punch} onPointerDown={(event) => { event.preventDefault(); controls.punchQueued = true; unlock(); }}>펀치</button>
    </div>
  </div>;
}
