import Button from "../../../../shared/ui/Button.tsx";
import SegmentedControl from "../../../../shared/ui/SegmentedControl.tsx";
import { formatTimerSeconds, MAX_TIMER_SECONDS } from "./model.ts";
import TimerFace from "./skins/TimerFace.tsx";
import { TIMER_SKINS, type TimerSkin } from "./skins/skins.ts";
import type { CountdownTimer } from "./useCountdownTimer.ts";
import styles from "./TimerPanel.module.css";

function DigitEditor({ timer }: { readonly timer: CountdownTimer }) {
  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const adjustDisabled = timer.running;
  return <div className={styles.time} aria-label="남은 시간" role="timer" aria-live="off">
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
  </div>;
}

export default function TimerPanel({ timer, skin, onSkinChange }: {
  readonly timer: CountdownTimer;
  readonly skin: TimerSkin;
  readonly onSkinChange: (skin: TimerSkin) => void;
}) {
  // Skinned timers are set before starting; once started only the face shows (the hourglass hides the time).
  const idle = !timer.running && timer.remainingSeconds === timer.durationSeconds;
  const editable = skin === "normal" || idle;
  return <section className={styles.panel} aria-label="타이머">
    <h2>타이머</h2>
    <SegmentedControl options={TIMER_SKINS} value={skin} onChange={onSkinChange} ariaLabel="타이머 모양" size="sm" />
    {skin === "normal" ? <DigitEditor timer={timer} /> : <TimerFace skin={skin} timer={timer} />}
    {skin !== "normal" && idle ? <div className={styles.actions}>
      <Button variant="ghost" disabled={timer.remainingSeconds < 60} onClick={() => timer.adjust(-60)}>−1분</Button>
      <strong className={styles.setTime}>{formatTimerSeconds(timer.remainingSeconds)}</strong>
      <Button variant="ghost" disabled={timer.remainingSeconds > MAX_TIMER_SECONDS - 60} onClick={() => timer.adjust(60)}>+1분</Button>
    </div> : null}
    {editable ? <div className={styles.actions}>
      <Button variant="ghost" disabled={timer.running || timer.remainingSeconds === 0} onClick={() => timer.adjust(-30)}>−30초</Button>
      <Button variant="ghost" disabled={timer.running || timer.remainingSeconds > MAX_TIMER_SECONDS - 30} onClick={() => timer.adjust(30)}>+30초</Button>
    </div> : null}
    <div className={styles.actions}>
      {timer.running ? <Button onClick={timer.pause}>일시정지</Button> : <Button onClick={timer.start} disabled={timer.remainingSeconds === 0}>{timer.remainingSeconds === 0 ? "시간 설정" : "시작"}</Button>}
      <Button variant="ghost" onClick={timer.reset}>초기화</Button>
    </div>
    {timer.finished ? <strong className={styles.finished} role="status">시간 종료</strong> : null}
  </section>;
}
