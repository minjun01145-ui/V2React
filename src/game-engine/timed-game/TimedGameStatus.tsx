import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { formatClock } from "./clock.ts";
import { useTimedGameClock } from "./useTimedGameClock.ts";
import styles from "./TimedGame.module.css";

export function TimedGameStatus({ session, compact = false }: { readonly session: ActiveGameSession; readonly compact?: boolean }) {
  const clock = useTimedGameClock(session);
  return <div className={styles.clock} data-expired={clock.expired} data-compact={compact} role="timer" aria-label={clock.remainingMs === null ? "무제한 모드" : `남은 시간 ${formatClock(clock.remainingMs)}`}>
    <span>{clock.expired ? "TIME OVER" : clock.remainingMs === null ? "무제한" : "남은 시간"}</span>
    <strong>{formatClock(clock.remainingMs)}</strong>
    {clock.progress !== null ? <div className={styles.clockTrack}><i style={{ width: `${Math.max(0, 100 - clock.progress * 100)}%` }} /></div> : null}
  </div>;
}

export function TimedGameOver({ score, correctCount }: { readonly score: number; readonly correctCount: number }) {
  return <section className={styles.gameOver}>
    <span>TIME OVER</span>
    <h1>게임 종료!</h1>
    <strong>{score}점</strong>
    <p>정답 {correctCount}개 · 선생님 화면에서 최종 순위를 확인하세요.</p>
  </section>;
}
