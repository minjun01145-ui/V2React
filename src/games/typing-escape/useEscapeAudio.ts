import { useEffect, useRef, useState } from "react";

// Korean syllables rendered with Microsoft Heami, rate 3. Playback rate raises
// both speed and pitch so every teacher hears the same helium voice.
const clips = import.meta.glob("./audio/*.wav", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
export function useEscapeAudio(teacher: boolean, active: boolean, cycle: number, syllable: number, watching: boolean) {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const buffers = useRef<AudioBuffer[]>([]);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const lastCue = useRef("");
  useEffect(() => {
    if (!teacher) return;
    let disposed = false;
    const context = new AudioContext(); audio.current = context;
    const sync = () => { if (!disposed && context.state !== "closed") setEnabled(context.state === "running"); };
    context.addEventListener("statechange", sync); sync();
    void Promise.all(Array.from({ length: 10 }, async (_, index) => {
      const response = await fetch(clips[`./audio/${index}.wav`]!);
      if (!response.ok) throw new Error("구호 소리를 불러오지 못했습니다.");
      return context.decodeAudioData(await response.arrayBuffer());
    })).then(values => { if (!disposed) { buffers.current = values; setReady(true); } }).catch(() => {
      if (!disposed) setError("구호 소리를 불러오지 못했습니다. 새로고침해 주세요.");
    });
    return () => { disposed = true; source.current?.stop(); context.removeEventListener("statechange", sync); void context.close(); };
  }, [teacher]);
  const toggle = () => {
    const context = audio.current;
    if (!context) return;
    setError(null);
    if (enabled) { source.current?.stop(); void context.suspend(); setEnabled(false); }
    else void context.resume().then(() => setEnabled(true)).catch(() => setError("소리를 켜려면 다시 눌러 주세요."));
  };
  useEffect(() => {
    if (!teacher || !enabled || !ready || !active || document.hidden) { source.current?.stop(); source.current = null; return; }
    const context = audio.current;
    if (!context || context.state !== "running") return;
    const key = `${cycle}:${watching ? "shot" : syllable}`;
    if (key === lastCue.current) return;
    lastCue.current = key;
    source.current?.stop(); source.current = null;
    if (watching) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(180, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(35, context.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } else if (syllable >= 0) {
      const next = context.createBufferSource();
      next.buffer = buffers.current[syllable]!;
      next.playbackRate.value = 1.65;
      next.connect(context.destination); next.start(); source.current = next;
      next.onended = () => { next.disconnect(); if (source.current === next) source.current = null; };
    }
  }, [teacher, enabled, ready, active, cycle, syllable, watching]);
  return { enabled, toggle, error };
}
