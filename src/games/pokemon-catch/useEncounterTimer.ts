import { useCallback, useEffect, useRef, useState } from "react";
import { ENCOUNTER_TIME_MS } from "./itemRules.ts";

export function useEncounterTimer({ encounterKey, running, onExpired }: {
  readonly encounterKey: string | null;
  readonly running: boolean;
  readonly onExpired: () => void;
}) {
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(ENCOUNTER_TIME_MS);
  const expiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (!encounterKey) return;
    const nextDeadline = Date.now() + ENCOUNTER_TIME_MS;
    expiredRef.current = false;
    setDeadlineMs(nextDeadline);
    setRemainingMs(ENCOUNTER_TIME_MS);
  }, [encounterKey]);

  useEffect(() => {
    if (!running || deadlineMs === null) return;
    const update = () => {
      const nextRemaining = Math.max(0, deadlineMs - Date.now());
      setRemainingMs(nextRemaining);
      if (nextRemaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpiredRef.current();
      }
    };
    update();
    const intervalId = globalThis.setInterval(update, 100);
    return () => globalThis.clearInterval(intervalId);
  }, [deadlineMs, running]);

  const extend = useCallback((milliseconds: number) => {
    if (expiredRef.current || milliseconds <= 0) return false;
    setDeadlineMs((current) => current === null ? current : current + milliseconds);
    setRemainingMs((current) => current + milliseconds);
    return true;
  }, []);

  return { remainingMs, extend } as const;
}
