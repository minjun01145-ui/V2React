import { useEffect, useState, type ReactNode } from "react";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { millisecondsUntilRoundStart, roundStartCountdownValue } from "../startSchedule.ts";

export default function RoundStartGate({ startedAtMs, children }: {
  readonly startedAtMs: number | null;
  readonly children: ReactNode;
}) {
  const [nowMs, setNowMs] = useState(Date.now());
  const remainingMs = millisecondsUntilRoundStart(startedAtMs, nowMs);

  useEffect(() => {
    if (remainingMs <= 0) return undefined;
    const update = (): void => setNowMs(Date.now());
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [remainingMs > 0, startedAtMs]);

  if (remainingMs > 0) {
    return <StatusPanel title={`${roundStartCountdownValue(remainingMs)}초 후 시작`} tone="waiting">모든 준비가 끝났습니다. 잠시 후 동시에 시작합니다.</StatusPanel>;
  }
  return children;
}
