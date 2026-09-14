import { useDeadlineCountdown } from "./useDeadlineCountdown.ts";
import styles from "./DeadlineCountdownBar.module.css";

export default function DeadlineCountdownBar({ deadlineAtMs, durationMs, label = "남은 시간" }: {
  readonly deadlineAtMs: number;
  readonly durationMs: number;
  readonly label?: string;
}) {
  const countdown = useDeadlineCountdown(deadlineAtMs, durationMs);
  if (!countdown) return null;
  return <div className={styles.countdown} data-urgent={countdown.remainingMs <= 2_000} role="timer" aria-label={`${label} ${Math.ceil(countdown.remainingMs / 1_000)}초`}>
    <div><span>{label}</span><strong>{(countdown.remainingMs / 1_000).toFixed(1)}초</strong></div>
    <div className={styles.track}><i style={{ transform: `scaleX(${countdown.progress})` }} /></div>
  </div>;
}
