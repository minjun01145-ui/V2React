import { useCallback, useEffect, useRef, useState } from "react";
import { ENCOUNTER_TIME_MS } from "./itemRules.ts";

export function useEncounterTimer({ encounterKey, running, onExpired }: {
  readonly encounterKey: string | null;
  readonly running: boolean;
  readonly onExpired: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(ENCOUNTER_TIME_MS);
  const remainingRef = useRef(ENCOUNTER_TIME_MS);
  const expiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (!encounterKey) return;
    expiredRef.current = false;
    remainingRef.current = ENCOUNTER_TIME_MS;
    setRemainingMs(ENCOUNTER_TIME_MS);
  }, [encounterKey]);

  useEffect(() => {
    if (!running || !encounterKey || expiredRef.current) return;
    let previousTickMs = Date.now();
    const update = () => {
      const now = Date.now();
      const nextRemaining = Math.max(0, remainingRef.current - (now - previousTickMs));
      previousTickMs = now;
      remainingRef.current = nextRemaining;
      setRemainingMs(nextRemaining);
      if (nextRemaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpiredRef.current();
      }
    };
    update();
    const intervalId = globalThis.setInterval(update, 100);
    return () => globalThis.clearInterval(intervalId);
  }, [encounterKey, running]);

  const extend = useCallback((milliseconds: number) => {
    if (expiredRef.current || milliseconds <= 0) return false;
    remainingRef.current += milliseconds;
    setRemainingMs(remainingRef.current);
    return true;
  }, []);

  return { remainingMs, extend } as const;
}
