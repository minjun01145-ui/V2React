import { useEffect, useState } from "react";
import type { DiceCount, DicePhase } from "./model.ts";
import styles from "./DiceDisplay.module.css";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"] as const;

function Die({ value, rolling }: { readonly value: number | undefined; readonly rolling: boolean }) {
  const [rollingValue, setRollingValue] = useState(1);
  useEffect(() => {
    if (!rolling) return undefined;
    setRollingValue(Math.floor(Math.random() * 6) + 1);
    const timer = window.setInterval(() => setRollingValue(Math.floor(Math.random() * 6) + 1), 90);
    return () => window.clearInterval(timer);
  }, [rolling]);
  const face = rolling ? rollingValue : (value ?? 1);
  return <span className={styles.die} data-rolling={rolling ? "true" : undefined} role="img" aria-label={rolling ? "주사위 굴리는 중" : `주사위 ${face}`}>{DICE_FACES[face - 1]}</span>;
}

export default function DiceDisplay({ phase, diceCount, results }: {
  readonly phase: DicePhase;
  readonly diceCount: DiceCount;
  readonly results: readonly number[];
}) {
  const rolling = phase === "rolling";
  return (
    <div className={styles.dice} aria-label={`${diceCount}개 주사위`}>
      {Array.from({ length: diceCount }, (_, index) => <Die key={index} value={results[index]} rolling={rolling} />)}
    </div>
  );
}
