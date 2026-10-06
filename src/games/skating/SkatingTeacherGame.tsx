import { useCallback, useMemo } from "react";
import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { createLeaderboard } from "../../game-engine/timed-game/leaderboard.ts";
import type { LiveEvent } from "../../live-world/client.ts";
import { useRoundProgress } from "../../multiplayer/game-progress/hooks.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { createSkatingFx } from "./fx.ts";
import { buildSkatingCourse } from "./model.ts";
import SkatingStage from "./scene/SkatingStage.tsx";
import { CRASH_EVENT, PUNCH_EVENT } from "./sim/punch.ts";
import { useSkatingLiveWorld } from "./useSkatingLiveWorld.ts";
import { useSkatingSet } from "./useSkatingSet.ts";
import styles from "./Skating.module.css";

export default function SkatingTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const learningSet = useSkatingSet(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  const progress = useRoundProgress(roomId, session.roundId);
  const fx = useMemo(createSkatingFx, []);
  // The broadcast shows crashes and punches too, so the class sees the action.
  const onEvent = useCallback((event: LiveEvent): void => {
    if (event.kind === CRASH_EVENT) fx.emit({ type: "crash", playerId: event.playerId });
    else if (event.kind === PUNCH_EVENT) {
      fx.emit({ type: "punch", attackerId: event.playerId, targetId: event.target || null, direction: event.value < 0 ? -1 : 1 });
    }
  }, [fx]);
  const live = useSkatingLiveWorld({ roomId, roundId: session.roundId, playerId: null, onEvent });
  const course = useMemo(
    () => learningSet.set ? buildSkatingCourse(learningSet.set, session.roundId) : null,
    [learningSet.set, session.roundId],
  );
  const labels = useMemo(
    () => new Map(participants.value.map((item) => [item.playerId, displayLabel(item.displayName, item.nickname)])),
    [participants.value],
  );
  const ranking = useMemo(() => createLeaderboard(participants.value, progress.value), [participants.value, progress.value]);

  if (learningSet.loading || participants.loading) return <StatusPanel title="스케이팅 중계 준비 중">학습 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error.message}</StatusPanel>;
  const rankingError = participants.error ?? progress.error;
  if (rankingError) return <StatusPanel title="순위 연결 오류" tone="error">{rankingError.message}</StatusPanel>;
  if (!course) return <StatusPanel title="학습 세트 오류" tone="error">스케이팅에 사용할 단어 세트가 없습니다.</StatusPanel>;
  return <div className={styles.teacherShell}>
    <div className={styles.teacherMain}>
      <header className={styles.hud}>
        <div><strong>스케이팅 · 실시간 중계</strong><span>참가 {participants.value.length}명</span></div>
      </header>
      {live.error ? <div className={styles.connectionError}>실시간 중계 오류: {live.error.message}</div> : null}
      <SkatingStage course={course} seed={session.roundId} fx={fx} self={null} remotes={live.sample} label={(id) => labels.get(id)} />
    </div>
    <aside className={styles.ranking}>
      <h3>점수</h3>
      {ranking.length === 0 ? <p>참가자를 기다리고 있습니다.</p> : ranking.map((item) => <div className={styles.rankRow} key={item.playerId}>
        <strong>{item.rank}</strong><span>{item.displayName}</span><b>{item.score}</b>
      </div>)}
    </aside>
  </div>;
}
