/* Short synthesized effects; no audio files to load. */

export type GoldRunSound = "coin" | "jump" | "hit" | "correct" | "wrong" | "down";
type Tone = readonly [frequency: number, endFrequency: number, delay: number, duration: number, volume: number, type: OscillatorType];

const TONES: Record<GoldRunSound, readonly Tone[]> = {
  coin: [[1568, 1568, 0, 0.06, 0.06, "square"], [2093, 2093, 0.05, 0.12, 0.05, "square"]],
  jump: [[260, 520, 0, 0.14, 0.07, "triangle"]],
  hit: [[180, 60, 0, 0.25, 0.16, "sawtooth"]],
  correct: [[659, 659, 0, 0.09, 0.07, "triangle"], [880, 880, 0.08, 0.09, 0.07, "triangle"], [1319, 1319, 0.16, 0.25, 0.07, "triangle"]],
  wrong: [[300, 200, 0, 0.2, 0.1, "square"], [220, 140, 0.16, 0.3, 0.1, "square"]],
  down: [[392, 98, 0, 0.7, 0.1, "sawtooth"]],
};

let audio: AudioContext | null = null;

export function playGoldRunSound(sound: GoldRunSound, pitch = 1): void {
  if (typeof AudioContext === "undefined") return;
  try {
    audio ??= new AudioContext({ latencyHint: "interactive" });
    const context = audio;
    const play = (): void => {
      const now = context.currentTime + 0.005;
      for (const [frequency, endFrequency, delay, duration, volume, type] of TONES[sound]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency * pitch, now + delay);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency * pitch, now + delay + duration);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.02);
        oscillator.addEventListener("ended", () => { oscillator.disconnect(); gain.disconnect(); }, { once: true });
      }
    };
    if (context.state === "suspended") void context.resume().then(play).catch(() => undefined);
    else play();
  } catch {
    // Sound is decoration; a blocked audio context must not stop the run.
  }
}
