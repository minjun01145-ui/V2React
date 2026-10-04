import { useEffect, useRef } from "react";

export function useHammerSound() {
  const context = useRef<AudioContext | null>(null);
  useEffect(() => () => { void context.current?.close().catch(() => undefined); context.current = null; }, []);
  return (correct: boolean, combo: number) => {
    if (typeof AudioContext === "undefined") return;
    try {
      const audio = context.current ??= new AudioContext({ latencyHint: "interactive" });
      const play = () => {
        const now = audio.currentTime;
        for (const [frequency, duration, volume, type] of (correct
          ? [[160, 0.12, 0.22, "triangle"], [700 + Math.min(combo, 20) * 28, 0.09, 0.07, "sine"]]
          : [[960, 0.25, 0.08, "square"], [1433, 0.3, 0.045, "sine"]]) as [number, number, number, OscillatorType][]) {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.type = type;
          oscillator.frequency.setValueAtTime(frequency, now);
          oscillator.frequency.exponentialRampToValueAtTime(correct ? frequency * 0.35 : frequency * 0.82, now + duration);
          gain.gain.setValueAtTime(volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start(now);
          oscillator.stop(now + duration);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        }
      };
      if (audio.state === "suspended") void audio.resume().then(play).catch(() => undefined);
      else if (audio.state === "running") play();
    } catch { /* Sound is optional on browsers without an available audio device. */ }
  };
}
