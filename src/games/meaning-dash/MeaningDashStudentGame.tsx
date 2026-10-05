import { useCallback, useMemo, useRef } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import type { RoundParticipant } from "../../multiplayer/round-participants/model.ts";
import { displayLabel, type ActiveGameSession, type Player } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { buildMeaningDashCourse, meaningDashGateY, MEANING_DASH_GATE_SPACING, type MeaningDashCourse } from "./model.ts";
import { useDashSound } from "./useDashSound.ts";
import MeaningDashScene, { movementFrameToRunner } from "./MeaningDashScene.tsx";
import { useMeaningDashPlayerLiveWorld } from "./useMeaningDashLiveWorld.ts";
import { useMeaningDashRunner } from "./useMeaningDashRunner.ts";
import { useMeaningDashSet } from "./useMeaningDashSet.ts";
import styles from "./MeaningDash.module.css";

export default function MeaningDashStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useMeaningDashSet(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  const course = useMemo(
    () => learningSet.set ? buildMeaningDashCourse(learningSet.set, session.roundId) : null,
    [learningSet.set, session.roundId],
  );

  if (learningSet.loading || participants.loading) return <StatusPanel title="뜻 달리기 준비 중">학습 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error.message}</StatusPanel>;
  if (!course) return <StatusPanel title="학습 세트 오류" tone="error">뜻 달리기에 사용할 단어 세트가 없습니다.</StatusPanel>;
  if (participants.error) return <StatusPanel title="참가자 연결 오류" tone="error">{participants.error.message}</StatusPanel>;
  return <StudentMeaningDashRuntime key={session.roundId} roomId={roomId} session={session} player={player} course={course} participantValues={participants.value} />;
}

function StudentMeaningDashRuntime({
  roomId,
  session,
  player,
  course,
  participantValues,
}: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly course: MeaningDashCourse;
  readonly participantValues: readonly RoundParticipant[];
}) {
  const livePublishRef = useRef<(state: { x: number; y: number; vx: number; vy: number }) => void>(() => undefined);
  const publish = useCallback((state: { x: number; y: number; vx: number; vy: number }): void => {
    livePublishRef.current(state);
  }, []);
  const game = useMeaningDashRunner({ roomId, session, player, course, publish });
  const sound = useDashSound(game.impact);
  const live = useMeaningDashPlayerLiveWorld({
    roomId,
    roundId: session.roundId,
    playerId: player.id,
    initialState: game.runner,
    enabled: game.ready,
  });
  livePublishRef.current = live.publish;
  const participantById = useMemo(() => new Map(participantValues.map((item) => [item.playerId, item])), [participantValues]);
  const remoteRunners = live.frames.flatMap((frame) => {
    const participant = participantById.get(frame.playerId);
    return participant ? [movementFrameToRunner(frame, displayLabel(participant.displayName, participant.nickname))] : [];
  });
  const runners = [
    ...remoteRunners,
    { id: player.id, label: displayLabel(player.displayName, player.nickname), x: game.runner.x, y: game.runner.y, speed: game.runner.vy, self: true },
  ];

  if (!game.ready) return <StatusPanel title={game.saveError ? "기록 연결 오류" : "출발 준비 중"} tone={game.saveError ? "error" : "waiting"}>{game.saveError?.message ?? "이전 진행 기록을 확인하고 있습니다."}</StatusPanel>;
  const distance = meaningDashGateY(game.progress.currentIndex) - game.runner.y;
  const approach = Math.max(0, Math.min(1, 1 - distance / MEANING_DASH_GATE_SPACING));
  const rank = 1 + remoteRunners.filter(runner => runner.y > game.runner.y).length;
  return <div className={styles.shell}>
    <header className={styles.hud}>
      <div><strong>뜻 달리기</strong><span>{Math.floor(game.runner.y * 10)} m · {rank} / {remoteRunners.length + 1}위</span></div>
      <div className={styles.score}><strong>{game.progress.score.toLocaleString()} <span>점</span></strong></div>
      <button className={styles.sound} type="button" onClick={sound.toggle} aria-pressed={!sound.muted}>{sound.muted ? "소리 꺼짐" : "소리 켜짐"}</button>
    </header>
    <div className={styles.stats}><strong>{game.progress.combo} COMBO{game.progress.combo >= 5 ? " · BOOST" : ""}</strong><span>정답 {game.progress.correctCount} / {game.progress.attemptCount}</span></div>
    <div className={styles.comboMeter} aria-label={`연속 정답 ${game.progress.combo}회`}><i style={{ width: `${Math.min(100, game.progress.combo / 5 * 100)}%` }} /></div>
    {live.error ? <div className={styles.connectionError}>실시간 연결 오류: {live.error.message}</div> : null}
    {game.saveError ? <div className={styles.connectionError}>기록 저장 오류: {game.saveError.message}</div> : null}
    <div className={styles.question}><small>GATE {String(game.progress.currentIndex + 1).padStart(2, "0")}</small><strong>{game.nextQuestion.prompt}</strong><i style={{ width: `${approach * 100}%` }} /></div>
    <div className={styles.stageWrap}>
      <MeaningDashScene course={course} runners={runners} cameraY={game.runner.y} impact={game.impact} combo={game.progress.combo}
        active={game.started && game.countdown === 0} onLane={lane => { sound.unlock(); game.selectLane(lane); }} />
      {game.feedback && game.impact ? <div key={game.impact.gateIndex} role="status" className={`${styles.feedback} ${game.impact.correct ? "" : styles.wrong}`}>
        {game.impact.correct ? `${game.progress.combo >= 5 ? "BOOST!" : "정답!"} +${game.impact.points}` : `${game.impact.prompt} = ${game.impact.answer}`}
      </div> : null}
      {!game.started ? <div className={styles.overlay}><strong>READY TO RUN</strong><button type="button" onClick={() => { sound.unlock(); game.start(); }}>출발!</button></div>
        : (game.countdown ?? 0) > 0 ? <div className={styles.overlay} role="status"><strong>{game.countdown}</strong></div> : null}
    </div>
    <div className={styles.controls} aria-label="정답 차선 선택">
      {game.nextQuestion.choices.map((choice, lane) => <button type="button" key={lane} aria-pressed={game.runner.lane === lane}
        onClick={() => { sound.unlock(); game.selectLane(lane as 0 | 1 | 2); }}><kbd>{lane + 1} {lane === 0 ? "· ← A" : lane === 2 ? "· → D" : "· 가운데"}</kbd><span>{choice}</span></button>)}
    </div>
  </div>;
}
