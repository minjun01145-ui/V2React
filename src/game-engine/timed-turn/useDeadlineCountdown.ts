import { useEffect, useState } from "react";
import { deadlineCountdownSnapshot } from "./model.ts";

export function useDeadlineCountdown(deadlineAtMs: number | null, durationMs: number) {
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    setNowMs(Date.now());
    if (deadlineAtMs === null) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, [deadlineAtMs]);
  return deadlineAtMs === null ? null : deadlineCountdownSnapshot(deadlineAtMs, durationMs, nowMs);
}
