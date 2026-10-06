import { useState } from "react";
import { isTimerSkin, type TimerSkin } from "./skins.ts";

const STORAGE_KEY = "v2r.slideTimerSkin";

function readSkin(): TimerSkin {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTimerSkin(stored) ? stored : "normal";
  } catch {
    return "normal";
  }
}

/** The teacher's chosen timer look, remembered in this browser only. */
export function useTimerSkin(): readonly [TimerSkin, (skin: TimerSkin) => void] {
  const [skin, setSkin] = useState<TimerSkin>(readSkin);
  const change = (next: TimerSkin): void => {
    setSkin(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be blocked; the choice still applies for this session.
    }
  };
  return [skin, change];
}
