import { useId } from "react";
import { formatTimerSeconds } from "../model.ts";
import { appleBites, elapsedFraction } from "./skins.ts";
import styles from "./AppleFace.module.css";

/** Bite marks around the apple, in the order they are taken (alternating sides). */
const BITES: readonly (readonly [number, number])[] = [
  [168, 92], [32, 112], [160, 160], [44, 168], [120, 196], [86, 200], [176, 128], [26, 76], [146, 56], [60, 56],
];
const BITE_RADIUS = 26;
const APPLE = "M100 62 C126 40 176 46 180 104 C184 160 148 206 118 200 C110 198 106 194 100 194 C94 194 90 198 82 200 C52 206 16 160 20 104 C24 46 74 40 100 62 Z";

/** An apple that gets bitten away as time passes, ending as a core. */
export default function AppleFace({ remainingSeconds, durationSeconds, finished }: {
  readonly remainingSeconds: number;
  readonly durationSeconds: number;
  readonly finished: boolean;
}) {
  const bites = appleBites(elapsedFraction(remainingSeconds, durationSeconds), BITES.length);
  const taken = BITES.slice(0, bites);
  // SVG ids are document-global; keep each apple's masks its own.
  const id = useId();
  return <div className={styles.face} role="timer" aria-label={`남은 시간 ${formatTimerSeconds(remainingSeconds)}`}>
    <svg viewBox="0 0 200 220" className={styles.apple}>
      <defs>
        <mask id={`${id}-skin`}><rect width="200" height="220" fill="#fff" />{taken.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={BITE_RADIUS} fill="#000" />)}</mask>
        <mask id={`${id}-flesh`}><rect width="200" height="220" fill="#fff" />{taken.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={BITE_RADIUS - 7} fill="#000" />)}</mask>
      </defs>
      <path className={styles.stem} d="M100 64 C100 44 106 30 114 22" />
      <path className={styles.leaf} d="M108 40 C122 22 146 22 156 30 C144 46 122 50 108 40 Z" />
      {finished ? <g className={styles.core}>
        <path d="M84 70 C100 76 116 70 116 70 C104 104 104 150 118 192 C104 186 96 186 82 192 C96 150 96 104 84 70 Z" />
        <circle cx="96" cy="128" r="3" className={styles.seed} /><circle cx="104" cy="140" r="3" className={styles.seed} />
      </g> : <g key={bites} className={styles.body}>
        <path d={APPLE} className={styles.flesh} mask={`url(#${id}-flesh)`} />
        <path d={APPLE} className={styles.skin} mask={`url(#${id}-skin)`} />
        <ellipse cx="62" cy="92" rx="12" ry="22" className={styles.shine} mask={`url(#${id}-skin)`} />
      </g>}
    </svg>
    <strong className={styles.digits}>{formatTimerSeconds(remainingSeconds)}</strong>
  </div>;
}
