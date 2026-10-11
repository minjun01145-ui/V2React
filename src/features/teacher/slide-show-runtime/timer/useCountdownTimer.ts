import { useRef, useState } from "react";
import { changeShowTimer } from "../../../../slide-show/multiplayerService.ts";
import { slideTimerSnapshot, type TimerSnapshot } from "../../../../slide-show/timer.ts";
import type { SlideShowSessionState } from "../../../../slide-show/types.ts";
import type { TimerSkin } from "../../../../slide-show/timerSkins.ts";
import { toErrorMessage } from "../../../../shared/errors/errorMessage.ts";
import { useSlideTimerClock } from "../../../slide-show-runtime/timer/useSlideTimerClock.ts";

export interface CountdownTimer extends TimerSnapshot {
  readonly working: boolean;
  readonly adjust: (delta: number) => void;
  readonly start: () => void;
  readonly pause: () => void;
  readonly reset: () => void;
}

/** Session state owns the timer so reloads and both roles keep the same deadline. */
export function useCountdownTimer(roomId: string, show: SlideShowSessionState, skin: TimerSkin, onError: (message: string) => void): CountdownTimer {
  const clock = useSlideTimerClock(show.timer?.startedAtMs == null ? null : show.timer.startedAtMs + show.timer.remainingSeconds * 1_000);
  const timer = slideTimerSnapshot(show.timer, clock.nowMs);
  const pending = useRef(false);
  const [working, setWorking] = useState(false);
  const change = async (command: "start" | "pause" | "reset" | number): Promise<void> => {
    if (pending.current) return;
    pending.current = true;
    setWorking(true);
    onError("");
    try { await changeShowTimer(roomId, show.runId, command, Date.now() + clock.offsetMs, skin); }
    catch (cause: unknown) { onError(toErrorMessage(cause, "타이머를 변경하지 못했습니다.")); }
    finally { pending.current = false; setWorking(false); }
  };
  return { ...timer, working,
    adjust: (delta) => void change(delta),
    start: () => void change("start"),
    pause: () => void change("pause"),
    reset: () => void change("reset"),
  };
}
