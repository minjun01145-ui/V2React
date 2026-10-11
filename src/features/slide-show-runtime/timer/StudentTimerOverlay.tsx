import { slideTimerSnapshot } from "../../../slide-show/timer.ts";
import type { SlideShowSessionState } from "../../../slide-show/types.ts";
import TimerFace from "./skins/TimerFace.tsx";
import { useSlideTimerClock } from "./useSlideTimerClock.ts";
import styles from "./StudentTimerOverlay.module.css";

/** Engine deadlines stay in the answer input; only the manually started class timer overlays it. */
export default function StudentTimerOverlay({ show }: { readonly show: SlideShowSessionState }) {
  const clock = useSlideTimerClock(show.timer?.startedAtMs == null ? null : show.timer.startedAtMs + show.timer.remainingSeconds * 1_000);
  const timer = slideTimerSnapshot(show.timer, clock.nowMs);
  if (!timer.running || show.engine?.round.gameId === "slide-question") return null;
  return <div className={styles.overlay} aria-label="수업 타이머">
    <div className={styles.face}><TimerFace skin={show.timerSkin ?? "normal"} timer={timer} /></div>
  </div>;
}
