import { useEffect, useRef, useState } from "react";
import type { DashImpact } from "./model.ts";

export function useDashSound(impact: DashImpact | null) {
  const audio = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const seen = useRef(-1);
  const unlock = () => {
    if (typeof AudioContext === "undefined") return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => undefined);
    } catch { /* Sound is optional on devices without an audio output. */ }
  };
  useEffect(() => () => { void audio.current?.close().catch(() => undefined); audio.current = null; }, []);
  useEffect(() => {
    if (!impact || impact.gateIndex === seen.current) return;
    seen.current = impact.gateIndex;
    const ctx = audio.current;
    if (muted || !ctx || ctx.state !== "running") return;
    if (impact.correct) {
      // Low impact followed by an upward sweep gives the gate a physical punch.
      for (const [from, to, volume, duration] of [[170, 45, .16, .14], [320, 1500, .045, .23]]) {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        const now = ctx.currentTime;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(from!, now);
        oscillator.frequency.exponentialRampToValueAtTime(to!, now + duration!);
        gain.gain.setValueAtTime(volume!, now);
        gain.gain.exponentialRampToValueAtTime(.0001, now + duration!);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(now); oscillator.stop(now + duration!);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    }
    const tones = impact.correct ? (impact.combo % 5 === 0 ? [660, 880, 1100, 1320] : [660, 990]) : [190, 130];
    tones.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      const at = ctx.currentTime + .05 + index * .07;
      oscillator.type = impact.correct ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.09, at + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .18);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(at); oscillator.stop(at + .2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }, [impact, muted]);
  return { unlock, muted, toggle: () => { unlock(); setMuted(value => !value); } };
}
