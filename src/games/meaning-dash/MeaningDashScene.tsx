import type { LiveRemoteFrame } from "../../live-world/core/types.ts";
import {
  MEANING_DASH_FIRST_GATE_Y,
  MEANING_DASH_GATE_SPACING,
  meaningDashGateIndexAtY,
  meaningDashGateY,
  meaningDashQuestionForGate,
  type MeaningDashCourse,
} from "./model.ts";
import runnerUrl from "./test-runner.svg";
import styles from "./MeaningDash.module.css";

export interface MeaningDashRenderableRunner {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly self?: boolean;
}

function screenBottom(worldY: number, cameraY: number, pixelsPerWorldUnit: number): number {
  return 86 + (worldY - cameraY) * pixelsPerWorldUnit;
}

export function movementFrameToRunner(frame: LiveRemoteFrame, label: string): MeaningDashRenderableRunner {
  return { id: frame.playerId, label, x: frame.x, y: frame.y };
}

export default function MeaningDashScene({
  course,
  runners,
  cameraY,
  pixelsPerWorldUnit = 54,
}: {
  readonly course: MeaningDashCourse;
  readonly runners: readonly MeaningDashRenderableRunner[];
  readonly cameraY: number;
  readonly pixelsPerWorldUnit?: number;
}) {
  const firstVisibleGate = Math.max(
    0,
    Math.floor((cameraY - MEANING_DASH_FIRST_GATE_Y - MEANING_DASH_GATE_SPACING) / MEANING_DASH_GATE_SPACING),
  );
  const gateIndexSet = new Set(
    Array.from({ length: 6 }, (_, offset) => firstVisibleGate + offset),
  );
  for (const runner of runners) {
    const nearbyGate = Math.max(0, meaningDashGateIndexAtY(runner.y));
    for (let offset = -1; offset <= 2; offset += 1) {
      const gateIndex = nearbyGate + offset;
      if (gateIndex >= 0) gateIndexSet.add(gateIndex);
    }
  }
  const gateIndexes = [...gateIndexSet].sort((left, right) => left - right);
  return <div className={styles.track}>
    <div className={styles.road}>
      <div className={styles.laneLine} style={{ left: "33.333%" }} />
      <div className={styles.laneLine} style={{ left: "66.666%" }} />
      {gateIndexes.map((gateIndex) => {
        const question = meaningDashQuestionForGate(course, gateIndex);
        const bottom = screenBottom(meaningDashGateY(gateIndex), cameraY, pixelsPerWorldUnit);
        if (bottom < -100 || bottom > 760) return null;
        return <div className={styles.gate} style={{ bottom }} key={gateIndex}>
          <div className={styles.gatePrompt}>{question.prompt}</div>
          <div className={styles.gateChoices}>
            {question.choices.map((choice, lane) => <div className={styles.gateChoice} key={lane}>{choice}</div>)}
          </div>
        </div>;
      })}
      {runners.map((runner) => {
        const bottom = screenBottom(runner.y, cameraY, pixelsPerWorldUnit);
        if (bottom < -80 || bottom > 720) return null;
        return <div
          className={runner.self ? `${styles.runner} ${styles.selfRunner}` : styles.runner}
          style={{ left: `${50 + runner.x * 28}%`, bottom }}
          key={runner.id}
        >
          <span className={styles.runnerName}>{runner.label}</span>
          <img src={runnerUrl} alt="" draggable={false} />
        </div>;
      })}
    </div>
  </div>;
}
