import { useId } from "react";
import { formatTimerSeconds } from "../model.ts";
import { elapsedFraction } from "./skins.ts";
import styles from "./GlowFace.module.css";

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Neon cyberpunk timer: glowing digits inside a ring that drains as time passes. */
export default function GlowFace({ remainingSeconds, durationSeconds, finished }: {
  readonly remainingSeconds: number;
  readonly durationSeconds: number;
  readonly finished: boolean;
}) {
  const left = 1 - elapsedFraction(remainingSeconds, durationSeconds);
  const urgent = remainingSeconds <= 10 && durationSeconds > 0;
  const gradientId = useId();
  return <div className={styles.face} data-urgent={urgent} data-finished={finished} role="timer" aria-label={`남은 시간 ${formatTimerSeconds(remainingSeconds)}`}>
    <svg className={styles.ring} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#ff2bd6" />
        </linearGradient>
      </defs>
      <circle className={styles.track} cx="100" cy="100" r={RADIUS} />
      <circle className={styles.progress} cx="100" cy="100" r={RADIUS} stroke={`url(#${gradientId})`}
        strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - left)} />
    </svg>
    <strong className={styles.digits}>{formatTimerSeconds(remainingSeconds)}</strong>
  </div>;
}
