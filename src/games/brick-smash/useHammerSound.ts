import { useEffect, useRef } from "react";

export type HammerSound = "hit" | "miss" | "block" | "item" | "boom" | "milestone";
type Tone = readonly [frequency: number, endFrequency: number, delay: number, duration: number, volume: number, type: OscillatorType];

const TONES: Record<HammerSound, readonly Tone[]> = {
  hit: [[170, 48, 0, 0.14, 0.32, "triangle"]],
  miss: [[980, 800, 0, 0.26, 0.07, "square"], [1460, 1200, 0, 0.32, 0.05, "sine"]],
  block: [[520, 700, 0, 0.18, 0.08, "triangle"], [780, 1040, 0.05, 0.2, 0.06, "sine"]],
  boom: [[120, 32, 0, 0.42, 0.42, "sine"], [60, 28, 0, 0.5, 0.2, "triangle"]],
  milestone: [[523, 523, 0, 0.08, 0.07, "square"], [659, 659, 0.07, 0.08, 0.07, "square"], [784, 784, 0.14, 0.08, 0.07, "square"], [1047, 1047, 0.21, 0.28, 0.08, "square"]],
  item: [[660, 660, 0, 0.09, 0.09, "square"], [880, 880, 0.08, 0.09, 0.09, "square"], [1320, 1320, 0.16, 0.22, 0.08, "square"]],
};

export function useHammerSound() {
  const context = useRef<AudioContext | null>(null);
  const noise = useRef<AudioBuffer | null>(null);
  useEffect(() => () => { void context.current?.close().catch(() => undefined); context.current = null; }, []);
  return (sound: HammerSound, combo = 0) => {
    if (typeof AudioContext === "undefined") return;
    try {
      const audio = context.current ??= new AudioContext({ latencyHint: "interactive" });
      const play = () => {
        const now = audio.currentTime;
        const tones = sound === "hit"
          // The crack climbs with the combo so a streak sounds like it is heating up.
          ? [...TONES.hit, [620 + Math.min(combo, 20) * 40, 300, 0.01, 0.08, 0.06, "sine"] as const]
          : TONES[sound];
        for (const [frequency, endFrequency, delay, duration, volume, type] of tones) {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.type = type;
          oscillator.frequency.setValueAtTime(frequency, now + delay);
          oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + delay + duration);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.setValueAtTime(volume, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
          oscillator.connect(gain).connect(audio.destination);
          oscillator.start(now);
          oscillator.stop(now + delay + duration);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        }
        if (sound !== "hit" && sound !== "boom") return;
        // Short filtered noise burst: the "crunch" of the brick breaking.
        noise.current ??= (() => {
          const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.12), audio.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
          return buffer;
        })();
        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();
        source.buffer = noise.current;
        // A bomb rumbles low and loud; a normal hit cracks.
        filter.type = sound === "boom" ? "lowpass" : "bandpass";
        filter.frequency.value = sound === "boom" ? 700 : 1_800;
        filter.Q.value = 0.8;
        gain.gain.value = sound === "boom" ? 1.1 : 0.5;
        source.playbackRate.value = sound === "boom" ? 0.45 : 1;
        source.connect(filter).connect(gain).connect(audio.destination);
        source.start(now);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      };
      if (audio.state === "suspended") void audio.resume().then(play).catch(() => undefined);
      else if (audio.state === "running") play();
    } catch { /* Sound is optional on browsers without an available audio device. */ }
  };
}
