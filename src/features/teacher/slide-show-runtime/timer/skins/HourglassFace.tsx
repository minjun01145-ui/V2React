import { useId } from "react";
import { elapsedFraction } from "./skins.ts";
import styles from "./HourglassFace.module.css";

// Glass outline: a top bulb narrowing to the neck at y=100 and a mirrored bottom bulb.
const TOP_BULB = "M24 22 H96 C96 62 66 78 62 100 H58 C54 78 24 62 24 22 Z";
const BOTTOM_BULB = "M58 100 H62 C66 122 96 138 96 178 H24 C24 138 54 122 58 100 Z";

/** Sand drains from the top bulb into the bottom one; no digits are shown on purpose. */
export default function HourglassFace({ remainingSeconds, durationSeconds, running, finished }: {
  readonly remainingSeconds: number;
  readonly durationSeconds: number;
  readonly running: boolean;
  readonly finished: boolean;
}) {
  const elapsed = elapsedFraction(remainingSeconds, durationSeconds);
  const flowing = running && elapsed < 1;
  const id = useId();
  return <div className={styles.face} data-finished={finished} role="img" aria-label={finished ? "모래시계: 시간 종료" : "모래시계"}>
    <svg viewBox="0 0 120 200" className={styles.glass}>
      <defs>
        <clipPath id={`${id}-top`}><path d={TOP_BULB} /></clipPath>
        <clipPath id={`${id}-bottom`}><path d={BOTTOM_BULB} /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-top)`}>
        <rect className={styles.sand} x="20" y="30" width="80" height="70" style={{ transform: `scaleY(${1 - elapsed})` }} />
      </g>
      <g clipPath={`url(#${id}-bottom)`}>
        <rect className={styles.sand} x="20" y="108" width="80" height="70" style={{ transform: `scaleY(${elapsed})` }} />
      </g>
      {flowing ? <line className={styles.stream} x1="60" y1="98" x2="60" y2="176" /> : null}
      <path className={styles.outline} d={TOP_BULB} />
      <path className={styles.outline} d={BOTTOM_BULB} />
      <rect className={styles.frame} x="10" y="10" width="100" height="12" rx="4" />
      <rect className={styles.frame} x="10" y="178" width="100" height="12" rx="4" />
    </svg>
  </div>;
}
