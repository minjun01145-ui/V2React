import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveGameEffect, GameEffectDefinition } from "./model.ts";

export function useGameEffectEngine() {
  const [activeEffect, setActiveEffect] = useState<ActiveGameEffect | null>(null);
  const sequenceRef = useRef(0);

  const play = useCallback((effect: GameEffectDefinition): void => {
    sequenceRef.current += 1;
    setActiveEffect({
      ...effect,
      id: `game-effect-${sequenceRef.current}`,
    });
  }, []);

  const clear = useCallback((): void => setActiveEffect(null), []);

  useEffect(() => {
    if (!activeEffect) return;
    const effectId = activeEffect.id;
    const timer = globalThis.setTimeout(() => {
      setActiveEffect((current) => current?.id === effectId ? null : current);
    }, activeEffect.durationMs);
    return () => globalThis.clearTimeout(timer);
  }, [activeEffect]);

  return { activeEffect, play, clear } as const;
}
