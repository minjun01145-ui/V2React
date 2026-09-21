let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  try {
    audioContext ??= new AudioContext({ latencyHint: "interactive" });
    return audioContext;
  } catch {
    return null;
  }
}

function schedulePing(audio: AudioContext, startAt: number, frequency: number): void {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.13);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    gain.disconnect();
  }, { once: true });
}

export function playCorrectChime(): void {
  const audio = context();
  if (!audio) return;
  const play = (): void => {
    const now = audio.currentTime + 0.005;
    schedulePing(audio, now, 987.77);
    schedulePing(audio, now + 0.105, 1318.51);
  };
  if (audio.state === "suspended") {
    void audio.resume().then(play).catch(() => undefined);
    return;
  }
  play();
}
