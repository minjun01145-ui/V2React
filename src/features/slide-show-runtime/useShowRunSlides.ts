import { useEffect, useState } from "react";
import { loadShowRunSlides } from "../../slide-show/multiplayerService.ts";
import type { Slide } from "../../slide-show/types.ts";

interface ShowRunSlides {
  readonly slides: ReadonlyMap<string, Slide>;
  readonly loading: boolean;
  readonly error: Error | null;
}

/** Slides of a run never change once the show starts, so one load per run is enough. */
export function useShowRunSlides(roomId: string, runId: string): ShowRunSlides {
  const [state, setState] = useState<ShowRunSlides>({ slides: new Map(), loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ slides: new Map(), loading: true, error: null });
    void loadShowRunSlides(roomId, runId)
      .then((slides) => { if (active) setState({ slides, loading: false, error: null }); })
      .catch((error: unknown) => { if (active) setState({ slides: new Map(), loading: false, error: error instanceof Error ? error : new Error("슬라이드를 불러오지 못했습니다.") }); });
    return () => { active = false; };
  }, [roomId, runId]);
  return state;
}
