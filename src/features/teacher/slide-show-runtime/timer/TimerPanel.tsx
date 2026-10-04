import Button from "../../../../shared/ui/Button.tsx";
import { MAX_TIMER_SECONDS } from "./model.ts";
import type { CountdownTimer } from "./useCountdownTimer.ts";
import styles from "./TimerPanel.module.css";

export default function TimerPanel({ timer }: { readonly timer: CountdownTimer }) {
  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const adjustDisabled = timer.running;
  return <section className={styles.panel} aria-label="타이머">
    <h2>타이머</h2>
    <div className={styles.time} aria-label="남은 시간" role="timer" aria-live="off">
      <div className={styles.unit}>
        <Button variant="ghost" aria-label="분 늘리기" disabled={adjustDisabled || timer.remainingSeconds > MAX_TIMER_SECONDS - 60} onClick={() => timer.adjust(60)}>▲</Button>
        <strong>{String(minutes).padStart(2, "0")}</strong><span>분</span>
        <Button variant="ghost" aria-label="분 줄이기" disabled={adjustDisabled || timer.remainingSeconds === 0} onClick={() => timer.adjust(-60)}>▼</Button>
      </div>
      <b className={styles.colon}>:</b>
      <div className={styles.unit}>
        <Button variant="ghost" aria-label="초 늘리기" disabled={adjustDisabled || timer.remainingSeconds === MAX_TIMER_SECONDS} onClick={() => timer.adjust(1)}>▲</Button>
        <strong>{String(seconds).padStart(2, "0")}</strong><span>초</span>
        <Button variant="ghost" aria-label="초 줄이기" disabled={adjustDisabled || timer.remainingSeconds === 0} onClick={() => timer.adjust(-1)}>▼</Button>
      </div>
    </div>
    <div className={styles.actions}>
      <Button variant="ghost" disabled={adjustDisabled || timer.remainingSeconds === 0} onClick={() => timer.adjust(-30)}>−30초</Button>
      <Button variant="ghost" disabled={adjustDisabled || timer.remainingSeconds > MAX_TIMER_SECONDS - 30} onClick={() => timer.adjust(30)}>+30초</Button>
    </div>
    <div className={styles.actions}>
      {timer.running ? <Button onClick={timer.pause}>일시정지</Button> : <Button onClick={timer.start} disabled={timer.remainingSeconds === 0}>{timer.remainingSeconds === 0 ? "시간 설정" : "시작"}</Button>}
      <Button variant="ghost" onClick={timer.reset}>초기화</Button>
    </div>
    {timer.finished ? <strong className={styles.finished} role="status">시간 종료</strong> : null}
  </section>;
}
