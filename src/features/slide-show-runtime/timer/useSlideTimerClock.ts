import { useEffect, useState } from "react";
import { subscribeLiveServerTimeOffset } from "../../../live-world/client.ts";

/** Both roles calculate from the same server clock, not the number of interval ticks. */
export function useSlideTimerClock(deadlineMs: number | null) {
  const [offsetMs, setOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now);
  useEffect(() => subscribeLiveServerTimeOffset(setOffsetMs), []);
  useEffect(() => {
    setNowMs(Date.now());
    if (deadlineMs === null || deadlineMs <= Date.now() + offsetMs) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now + offsetMs >= deadlineMs) window.clearInterval(interval);
    }, 250);
    return () => window.clearInterval(interval);
  }, [deadlineMs, offsetMs]);
  return { nowMs: nowMs + offsetMs, offsetMs };
}
