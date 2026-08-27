import { useMemo } from "react";
import { useRoundProgress } from "../question-engine/multiplayer/hooks.ts";
import { usePlayers } from "../../multiplayer/hooks.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { createLeaderboard } from "./leaderboard.ts";
import { TimedGameStatus } from "./TimedGameStatus.tsx";
import { useTimedGameClock } from "./useTimedGameClock.ts";
import styles from "./Leaderboard.module.css";

export default function LiveLeaderboard({ roomId, session, title }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly title: string;
}) {
  const players = usePlayers(roomId);
  const progress = useRoundProgress(roomId, session.roundId);
  const clock = useTimedGameClock(session);
  const entries = useMemo(
    () => createLeaderboard(players.activePlayers, progress.value),
    [players.activePlayers, progress.value],
  );
  const error = players.error ?? progress.error;
  if (error) return <StatusPanel title="리더보드 연결 오류" tone="error">{error.message}</StatusPanel>;

  return <section className={styles.board} aria-label={`${title} 실시간 순위`}>
    <header className={styles.header}>
      <div><span>{clock.expired ? "FINAL RANKING" : "LIVE RANKING"}</span><h2>{title}</h2><p>{clock.expired ? "게임이 종료되었습니다. 최종 순위입니다." : "점수가 저장되는 즉시 순위가 바뀝니다."}</p></div>
      <TimedGameStatus session={session} />
    </header>
    <div className={styles.columnLabels}><span>순위 · 학생</span><span>정답 / 시도</span><span>점수</span></div>
    <div className={styles.rows} aria-live="polite">
      {entries.length === 0 ? <p className={styles.empty}>접속한 학생을 기다리고 있습니다.</p> : entries.map((entry) => <div className={styles.row} data-rank={entry.rank <= 3 ? entry.rank : "other"} key={entry.playerId}>
        <b className={styles.rank}>{entry.rank}</b>
        <div className={styles.student}><strong>{entry.displayName}</strong><small>{entry.studentNumber}</small></div>
        <div className={styles.accuracy}><strong>{entry.correctCount}</strong><small>/ {entry.attemptCount}</small></div>
        <strong className={styles.score}>{entry.score.toLocaleString("ko-KR")}<small>점</small></strong>
      </div>)}
    </div>
  </section>;
}
