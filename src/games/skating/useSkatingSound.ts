import { useCallback, useEffect, useRef, useState } from "react";
import type { SkatingFx, SkatingFxEvent } from "./fx.ts";

interface Tone {
  readonly wave: OscillatorType;
  readonly from: number;
  readonly to?: number;
  readonly volume: number;
  readonly duration: number;
  readonly delay?: number;
}

function playTone(ctx: AudioContext, tone: Tone): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const at = ctx.currentTime + (tone.delay ?? 0);
  oscillator.type = tone.wave;
  oscillator.frequency.setValueAtTime(tone.from, at);
  if (tone.to) oscillator.frequency.exponentialRampToValueAtTime(tone.to, at + tone.duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(tone.volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + tone.duration + 0.02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

/** Filtered white noise: ice crunch, glass shatter and booster whoosh. */
function playNoise(ctx: AudioContext, duration: number, volume: number, frequency: number, sweepTo?: number): void {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const at = ctx.currentTime;
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(frequency, at);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + duration);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(at);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}

function playFx(ctx: AudioContext, event: SkatingFxEvent, selfId: string): void {
  switch (event.type) {
    case "gate": {
      if (!event.correct) return;
      playTone(ctx, { wave: "triangle", from: 170, to: 45, volume: 0.16, duration: 0.14 });
      playTone(ctx, { wave: "triangle", from: 320, to: 1500, volume: 0.045, duration: 0.23 });
      const notes = event.combo % 5 === 0 ? [660, 880, 1100, 1320] : [660, 990];
      notes.forEach((from, index) => playTone(ctx, { wave: "sine", from, volume: 0.09, duration: 0.18, delay: 0.05 + index * 0.07 }));
      return;
    }
    case "crash":
      if (event.playerId !== selfId) return;
      playNoise(ctx, 0.45, 0.35, 3_800, 900);
      playTone(ctx, { wave: "sawtooth", from: 320, to: 60, volume: 0.08, duration: 0.5 });
      return;
    case "respawn":
      if (event.playerId !== selfId) return;
      [520, 780].forEach((from, index) => playTone(ctx, { wave: "sine", from, volume: 0.07, duration: 0.14, delay: index * 0.08 }));
      return;
    case "item":
      if (event.kind === "booster") {
        playNoise(ctx, 0.7, 0.22, 400, 4_000);
        playTone(ctx, { wave: "sawtooth", from: 180, to: 900, volume: 0.06, duration: 0.6 });
      } else {
        [523, 659, 784, 1046].forEach((from, index) => playTone(ctx, { wave: "square", from, volume: 0.04, duration: 0.12, delay: index * 0.06 }));
      }
      return;
    case "punch":
      if (event.attackerId !== selfId && event.targetId !== selfId) return;
      playTone(ctx, { wave: "triangle", from: event.targetId ? 220 : 160, to: 50, volume: event.targetId ? 0.2 : 0.08, duration: 0.12 });
      if (event.targetId) playNoise(ctx, 0.08, 0.15, 1_200);
      return;
    case "bump":
      playNoise(ctx, 0.12, 0.12, 2_400);
      return;
    case "tick":
      playTone(ctx, { wave: "sine", from: 880, volume: 0.08, duration: 0.12 });
      return;
  }
}

export function useSkatingSound(fx: SkatingFx, selfId: string) {
  const audio = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const unlock = useCallback((): void => {
    if (typeof AudioContext === "undefined") return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => undefined);
    } catch { /* Sound is optional on devices without an audio output. */ }
  }, []);

  useEffect(() => fx.subscribe((event) => {
    const ctx = audio.current;
    if (mutedRef.current || !ctx || ctx.state !== "running") return;
    playFx(ctx, event, selfId);
  }), [fx, selfId]);

  useEffect(() => () => { void audio.current?.close().catch(() => undefined); audio.current = null; }, []);

  return { unlock, muted, toggle: () => { unlock(); setMuted((value) => !value); } };
}
