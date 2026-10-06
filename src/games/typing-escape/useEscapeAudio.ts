import { useEffect, useRef, useState } from "react";
import type { phaseAt } from "./model.ts";

// The recorded chant is quiet next to the lobby BGM: each clip is normalized,
// then boosted through a limiter so the louder voice never clips.
const CHANT_GAIN = 2.2;
function normalize(buffer: AudioBuffer): AudioBuffer {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) for (const sample of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = data[i]! / peak;
  }
  return buffer;
}
const clips = import.meta.glob("./audio/*.wav", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
export function useEscapeAudio(teacher: boolean, active: boolean, phase: ReturnType<typeof phaseAt>, hits: number, escapes: number) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const buffers = useRef<AudioBuffer[]>([]);
  const voice = useRef<AudioNode | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const lastCue = useRef("");
  const previous = useRef({ hits, escapes });
  const choseSound = useRef(false);
  useEffect(() => {
    let disposed = false;
    const context = new AudioContext(); audio.current = context;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = .002; limiter.release.value = .12;
    const boost = context.createGain(); boost.gain.value = CHANT_GAIN;
    boost.connect(limiter).connect(context.destination); voice.current = boost;
    const sync = () => { if (!disposed) setEnabled(context.state === "running"); };
    const unlock = () => {
      if (choseSound.current) return;
      void context.resume().then(() => {
        if (context.state === "running") { document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock); }
      }).catch(() => {});
    };
    context.addEventListener("statechange", sync); sync();
    document.addEventListener("pointerdown", unlock); document.addEventListener("keydown", unlock);
    if (teacher) void Promise.all(Array.from({ length: 10 }, async (_, index) => {
      const response = await fetch(clips[`./audio/${index}.wav`]!);
      if (!response.ok) throw new Error("구호 소리를 불러오지 못했습니다.");
      return normalize(await context.decodeAudioData(await response.arrayBuffer()));
    })).then(values => { if (!disposed) { buffers.current = values; setReady(true); } }).catch(() => {
      if (!disposed) setError("구호 소리를 불러오지 못했습니다. 새로고침해 주세요.");
    });
    return () => {
      disposed = true; source.current?.stop(); document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock);
      context.removeEventListener("statechange", sync); void context.close();
    };
  }, [teacher]);
  const toggle = () => {
    const context = audio.current;
    if (!context) return;
    choseSound.current = true;
    setError(null);
    if (context.state === "running") { source.current?.stop(); source.current = null; void context.suspend(); }
    else void context.resume().catch(() => setError("소리를 켜려면 다시 눌러 주세요."));
  };
  useEffect(() => {
    if (!teacher || !enabled || !ready || !active || document.hidden) { source.current?.stop(); source.current = null; return; }
    const context = audio.current;
    if (!context || context.state !== "running") return;
    const key = `${phase.cycle}:${phase.watching ? "watch" : phase.beat}`;
    if (key === lastCue.current) return;
    lastCue.current = key;
    source.current?.stop(); source.current = null;
    if (!phase.watching && phase.syllable >= 0) {
      const next = context.createBufferSource();
      next.buffer = buffers.current[phase.syllable]!;
      next.playbackRate.value = Math.max(1.25, Math.min(7, next.buffer.duration * 1_050 / phase.beatMs));
      next.connect(voice.current ?? context.destination); next.start(); source.current = next;
      next.onended = () => { next.disconnect(); if (source.current === next) source.current = null; };
    }
  }, [teacher, enabled, ready, active, phase.cycle, phase.beat, phase.syllable, phase.beatMs, phase.watching]);
  useEffect(() => {
    const shot = hits > previous.current.hits;
    const success = escapes > previous.current.escapes;
    previous.current = { hits, escapes };
    const context = audio.current;
    if (!active || !enabled || !context || document.hidden || (!shot && !success)) return;
    if (shot) {
      const noise = context.createBuffer(1, context.sampleRate * .24, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
      const bang = context.createBufferSource(); bang.buffer = noise;
      const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 2_000;
      const gain = context.createGain(); gain.gain.value = .45;
      bang.connect(filter).connect(gain).connect(context.destination); bang.start();
      bang.onended = () => { bang.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
    if (success) [523, 659, 784, 1047].forEach((frequency, index) => {
      const note = context.createOscillator(); const gain = context.createGain();
      const at = context.currentTime + index * .075;
      note.type = "square"; note.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, at); gain.gain.exponentialRampToValueAtTime(.001, at + .18);
      note.connect(gain).connect(context.destination); note.start(at); note.stop(at + .2);
      note.onended = () => { note.disconnect(); gain.disconnect(); };
    });
  }, [hits, escapes, active, enabled]);
  return { enabled, toggle, error };
}
