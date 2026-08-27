import { useEffect, useMemo, useState } from "react";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { timedGameClockSnapshot } from "./clock.ts";
import { readTimedGameConfig } from "./config.ts";

export function useTimedGameClock(session: ActiveGameSession) {
  const config = useMemo(() => readTimedGameConfig(session.gameConfig), [session.gameConfig]);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (config.durationMs === null) return undefined;
    const update = (): void => setNowMs(Date.now());
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [config.durationMs, session.roundId]);

  return useMemo(() => ({
    config,
    ...timedGameClockSnapshot(config, session.startedAtMs, nowMs),
  }), [config, nowMs, session.startedAtMs]);
}
