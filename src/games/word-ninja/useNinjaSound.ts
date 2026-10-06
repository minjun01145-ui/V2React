import { useEffect, useRef } from "react";

export type NinjaSound = "swoosh" | "slice" | "miss" | "golden" | "milestone" | "toss" | "frenzy" | "curse" | "chain";
type Tone = readonly [frequency: number, endFrequency: number, delay: number, duration: number, volume: number, type: OscillatorType];
type Noise = readonly [filter: BiquadFilterType, frequency: number, endFrequency: number, duration: number, volume: number];

const TONES: Record<NinjaSound, readonly Tone[]> = {
  swoosh: [],
  slice: [[300, 90, 0, 0.12, 0.2, "triangle"]],
  miss: [[220, 140, 0, 0.3, 0.12, "sawtooth"], [233, 150, 0, 0.3, 0.08, "square"]],
  golden: [[1319, 1319, 0, 0.09, 0.07, "sine"], [1760, 1760, 0.06, 0.09, 0.07, "sine"], [2637, 2637, 0.12, 0.3, 0.06, "sine"]],
  milestone: [[523, 523, 0, 0.08, 0.07, "square"], [659, 659, 0.07, 0.08, 0.07, "square"], [784, 784, 0.14, 0.08, 0.07, "square"], [1047, 1047, 0.21, 0.28, 0.08, "square"]],
  toss: [[140, 260, 0, 0.12, 0.08, "sine"]],
  // A gong-like rise for the all-correct frenzy.
  frenzy: [[392, 392, 0, 0.5, 0.08, "triangle"], [587, 587, 0.05, 0.45, 0.07, "triangle"], [784, 1568, 0.12, 0.4, 0.06, "sine"]],
  // Two detuned falling tones for the curse.
  curse: [[330, 110, 0, 0.55, 0.09, "sawtooth"], [311, 104, 0.02, 0.55, 0.07, "square"]],
  chain: [[1175, 1568, 0, 0.09, 0.05, "square"]],
};

const NOISES: Partial<Record<NinjaSound, Noise>> = {
  // The blade: a fast high-passed sweep.
  swoosh: ["bandpass", 900, 4_200, 0.16, 0.35],
  // The juice: a wet low crunch.
  slice: ["lowpass", 2_400, 500, 0.2, 0.7],
  miss: ["lowpass", 600, 200, 0.25, 0.5],
  frenzy: ["bandpass", 3_000, 600, 0.3, 0.35],
};

export function useNinjaSound() {
  const context = useRef<AudioContext | null>(null);
  const noise = useRef<AudioBuffer | null>(null);
  useEffect(() => () => { void context.current?.close().catch(() => undefined); context.current = null; }, []);
  return (sound: NinjaSound, combo = 0) => {
    if (typeof AudioContext === "undefined") return;
    try {
      const audio = context.current ??= new AudioContext({ latencyHint: "interactive" });
      const play = () => {
        const now = audio.currentTime;
        const tones = sound === "slice"
          // The ring climbs with the combo so a streak sounds like it is heating up.
          ? [...TONES.slice, [880 + Math.min(combo, 24) * 36, 880 + Math.min(combo, 24) * 36, 0.03, 0.14, 0.05, "triangle"] as const]
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
        const shape = NOISES[sound];
        if (!shape) return;
        noise.current ??= (() => {
          const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.3), audio.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          return buffer;
        })();
        const [type, frequency, endFrequency, duration, volume] = shape;
        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();
        source.buffer = noise.current;
        filter.type = type;
        filter.Q.value = 1.2;
        filter.frequency.setValueAtTime(frequency, now);
        filter.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        source.connect(filter).connect(gain).connect(audio.destination);
        source.start(now);
        source.stop(now + duration);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      };
      if (audio.state === "suspended") void audio.resume().then(play).catch(() => undefined);
      else if (audio.state === "running") play();
    } catch { /* Sound is optional on browsers without an available audio device. */ }
  };
}
