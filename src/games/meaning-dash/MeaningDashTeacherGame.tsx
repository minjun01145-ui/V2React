import { useMemo } from "react";
import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useRoundProgress } from "../../multiplayer/game-progress/hooks.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { buildMeaningDashCourse } from "./model.ts";
import MeaningDashScene, { movementFrameToRunner } from "./MeaningDashScene.tsx";
import { useMeaningDashObserverLiveWorld } from "./useMeaningDashLiveWorld.ts";
import { useMeaningDashSet } from "./useMeaningDashSet.ts";
import styles from "./MeaningDash.module.css";

export default function MeaningDashTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const learningSet = useMeaningDashSet(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  const live = useMeaningDashObserverLiveWorld(roomId, session.roundId);
  const progress = useRoundProgress(roomId, session.roundId);
  const course = useMemo(
    () => learningSet.set ? buildMeaningDashCourse(learningSet.set, session.roundId) : null,
    [learningSet.set, session.roundId],
  );
  const participantById = useMemo(() => new Map(participants.value.map((item) => [item.playerId, item])), [participants.value]);
  const runners = live.frames.flatMap((frame) => {
    const participant = participantById.get(frame.playerId);
    return participant ? [movementFrameToRunner(frame, displayLabel(participant.displayName, participant.nickname))] : [];
  });
  const runnerYs = runners.map((runner) => runner.y);
  const minRunnerY = runnerYs.length > 0 ? Math.min(...runnerYs) : 0;
  const maxRunnerY = runnerYs.length > 0 ? Math.max(...runnerYs) : 0;
  const runnerSpread = Math.max(maxRunnerY - minRunnerY, 1);
  const cameraY = minRunnerY;
  const pixelsPerWorldUnit = Math.min(54, 320 / runnerSpread);
  const ranking = [...progress.value].sort((left, right) => right.score - left.score || right.correctCount - left.correctCount);

  if (learningSet.loading || participants.loading) return <StatusPanel title="Meaning Dash 중계 준비 중">학습 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error.message}</StatusPanel>;
  if (!course) return <StatusPanel title="학습 세트 오류" tone="error">Meaning Dash에 사용할 단어 세트가 없습니다.</StatusPanel>;
  return <div className={styles.teacherShell}>
    <div className={styles.teacherMain}>
      <header className={styles.hud}>
        <div><strong>Meaning Dash (테스트) · 실시간 중계</strong><span>{runners.length}/{participants.value.length}명 위치 수신</span></div>
      </header>
      {live.error ? <div className={styles.connectionError}>실시간 중계 오류: {live.error.message}</div> : null}
      <MeaningDashScene course={course} runners={runners} cameraY={cameraY} pixelsPerWorldUnit={pixelsPerWorldUnit} />
    </div>
    <aside className={styles.ranking}>
      <h3>점수</h3>
      {ranking.length === 0 ? <p>아직 통과 기록이 없습니다.</p> : ranking.map((item, index) => <div className={styles.rankRow} key={item.playerId}>
        <strong>{index + 1}</strong><span>{item.displayName}</span><b>{item.score}</b>
      </div>)}
    </aside>
  </div>;
}
