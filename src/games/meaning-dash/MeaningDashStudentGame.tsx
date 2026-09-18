import { useCallback, useMemo, useRef } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import type { RoundParticipant } from "../../multiplayer/round-participants/model.ts";
import { displayLabel, type ActiveGameSession, type Player } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { buildMeaningDashCourse, type MeaningDashCourse } from "./model.ts";
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

  if (learningSet.loading || participants.loading) return <StatusPanel title="Meaning Dash 준비 중">학습 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error.message}</StatusPanel>;
  if (!course) return <StatusPanel title="학습 세트 오류" tone="error">Meaning Dash에 사용할 단어 세트가 없습니다.</StatusPanel>;
  return <StudentMeaningDashRuntime roomId={roomId} session={session} player={player} course={course} participantValues={participants.value} />;
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
    { id: player.id, label: displayLabel(player.displayName, player.nickname), x: game.runner.x, y: game.runner.y, self: true },
  ];

  if (!game.ready) return <StatusPanel title="출발 준비 중">이전 진행 기록을 확인하고 있습니다.</StatusPanel>;
  return <div className={styles.shell}>
    <header className={styles.hud}>
      <div><strong>Meaning Dash</strong><span>{game.nextQuestion.prompt}의 뜻이 있는 길로 이동하세요.</span></div>
      <div className={styles.score}><strong>{game.progress.score}</strong><span>점</span></div>
    </header>
    {live.error ? <div className={styles.connectionError}>실시간 연결 오류: {live.error.message}</div> : null}
    {game.saveError ? <div className={styles.connectionError}>기록 저장 오류: {game.saveError.message}</div> : null}
    {game.feedback ? <div className={styles.feedback}>{game.feedback}</div> : null}
    <MeaningDashScene course={course} runners={runners} cameraY={game.runner.y} />
    <div className={styles.controls}>
      <button type="button" onClick={game.moveLeft} aria-label="왼쪽 길로 이동">←</button>
      <span>← → 또는 A D</span>
      <button type="button" onClick={game.moveRight} aria-label="오른쪽 길로 이동">→</button>
    </div>
  </div>;
}
