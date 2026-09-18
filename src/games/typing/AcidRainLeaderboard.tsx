import { useMemo } from "react";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import styles from "../../game-engine/timed-game/Leaderboard.module.css";
import { useRoundLiveMetrics } from "../../multiplayer/live-metrics/hooks.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { createAcidRainLeaderboard } from "./acidRainLeaderboard.ts";

export default function AcidRainLeaderboard({ roomId, session, title }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly title: string;
}) {
  const participants = useRoundParticipants(roomId, session.roundId);
  const metrics = useRoundLiveMetrics(roomId, session.roundId);
  const entries = useMemo(
    () => createAcidRainLeaderboard(participants.value, metrics.value),
    [metrics.value, participants.value],
  );
  const error = participants.error ?? metrics.error;
  if (error) return <StatusPanel title="산성비 순위표 연결 오류" tone="error">{error.message}</StatusPanel>;

  return <section className={styles.board} aria-label={`${title} 실시간 스테이지 순위`}>
    <header className={styles.header}>
      <div><h2>{title}</h2></div>
      <TimedGameStatus session={session} />
    </header>
    <div className={styles.columnLabels}><span>순위 · 학생</span><span>평균 타수</span><span>현재 스테이지</span></div>
    <div className={styles.rows} aria-live="polite">
      {entries.length === 0 ? <p className={styles.empty}>접속한 학생을 기다리고 있습니다.</p> : entries.map((entry) => <div className={styles.row} data-rank={entry.rank <= 3 ? entry.rank : "other"} key={entry.playerId}>
        <b className={styles.rank}>{entry.rank}</b>
        <div className={styles.student}><strong>{entry.displayName}</strong><small>{entry.studentNumber}</small></div>
        <div className={styles.accuracy}><strong>{entry.averageCpm.toLocaleString("ko-KR")}</strong><small> CPM</small></div>
        <strong className={styles.score}>{entry.currentStage || "-"}<small>{entry.currentStage ? "단계" : "대기"}</small></strong>
      </div>)}
    </div>
  </section>;
}
