import type { ReactNode } from "react";
import { usePlayerGameProgress } from "../question-engine/multiplayer/hooks.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { TimedGameOver, TimedGameStatus } from "./TimedGameStatus.tsx";
import { useTimedGameClock } from "./useTimedGameClock.ts";
import styles from "./TimedGame.module.css";

function numericField(value: unknown, key: "score" | "correctCount"): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return 0;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "number" && Number.isFinite(field) ? Math.max(0, field) : 0;
}

export default function TimedStudentGameBoundary({ roomId, session, player, children }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly children: ReactNode;
}) {
  const clock = useTimedGameClock(session);
  const progress = usePlayerGameProgress(roomId, session.roundId, player.id);
  if (clock.expired) return <TimedGameOver score={numericField(progress.value, "score")} correctCount={numericField(progress.value, "correctCount")} />;
  return <div className={styles.timedBoundary}>
    <div className={styles.globalClock}><TimedGameStatus session={session} /></div>
    {children}
  </div>;
}
