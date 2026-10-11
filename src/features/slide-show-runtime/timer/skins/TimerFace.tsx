import { formatTimerSeconds, type TimerSnapshot } from "../../../../slide-show/timer.ts";
import AppleFace from "./AppleFace.tsx";
import GlowFace from "./GlowFace.tsx";
import HourglassFace from "./HourglassFace.tsx";
import type { TimerSkin } from "../../../../slide-show/timerSkins.ts";
import styles from "./TimerFace.module.css";

/** The same read-only timer face is used by the teacher and students. */
export default function TimerFace({ skin, timer }: { readonly skin: TimerSkin; readonly timer: TimerSnapshot }) {
  const props = { remainingSeconds: timer.remainingSeconds, durationSeconds: timer.durationSeconds, finished: timer.finished };
  if (skin === "normal") return <strong className={styles.plain} role="timer" aria-live="off" aria-label={`남은 시간 ${formatTimerSeconds(timer.remainingSeconds)}`}>{formatTimerSeconds(timer.remainingSeconds)}</strong>;
  if (skin === "glow") return <GlowFace {...props} />;
  if (skin === "hourglass") return <HourglassFace {...props} running={timer.running} />;
  return <AppleFace {...props} />;
}
