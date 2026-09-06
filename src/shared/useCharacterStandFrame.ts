import { useEffect, useState, useSyncExternalStore } from "react";

const FRAME_DURATION_MS = 320;
const FRAME_COUNT = 4;

let currentFrame = 0;
let ticker: number | null = null;
const subscribers = new Set<() => void>();
const preloadCache = new Map<string, Promise<void>>();

function notifySubscribers(): void {
  for (const subscriber of subscribers) subscriber();
}

function stopTicker(): void {
  if (ticker === null) return;
  window.clearInterval(ticker);
  ticker = null;
}

function startTicker(): void {
  stopTicker();
  if (document.hidden || subscribers.size === 0) return;
  ticker = window.setInterval(() => {
    currentFrame = (currentFrame + 1) % FRAME_COUNT;
    notifySubscribers();
  }, FRAME_DURATION_MS);
}

function handleVisibilityChange(): void {
  if (document.hidden) {
    stopTicker();
    return;
  }
  currentFrame = 0;
  notifySubscribers();
  startTicker();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  if (subscribers.size === 1) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    startTicker();
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size > 0) return;
    stopTicker();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

function getFrame(): number {
  return currentFrame;
}

function preloadFrame(source: string): Promise<void> {
  const cached = preloadCache.get(source);
  if (cached) return cached;

  const pending = new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (typeof image.decode !== "function") {
        resolve();
        return;
      }
      void image.decode().catch(() => undefined).then(() => resolve());
    };
    image.onerror = () => resolve();
    image.src = source;
  });
  preloadCache.set(source, pending);
  return pending;
}

/**
 * 한 캐릭터의 대기 프레임을 한 장씩만 노출한다.
 * 모든 프레임을 먼저 디코딩하고, 탭이 다시 보일 때 첫 프레임부터 재개해
 * 겹친 CSS 애니메이션이 비동기화되며 생기던 깜빡임을 막는다.
 */
export function useCharacterStandFrame(frames: readonly [string, string, string, string] | null): string | null {
  const frame = useSyncExternalStore(subscribe, getFrame, () => 0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    if (!frames) return () => { active = false; };
    void Promise.all(frames.map(preloadFrame)).then(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [frames]);

  if (!frames) return null;
  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return ready && !reducedMotion ? (frames[frame] ?? frames[0]) : frames[0];
}
