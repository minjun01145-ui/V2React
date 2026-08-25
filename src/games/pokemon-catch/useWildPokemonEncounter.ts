import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { encounterId } from "./encounterRules.ts";
import { fetchPokemonEncounter, prefetchPokemonEncounter } from "./pokeApi.ts";
import type { EncounterLoadStatus, PokemonEncounter } from "./types.ts";

export function useWildPokemonEncounter({ roundId, playerId, encounterIndex }: {
  readonly roundId: string;
  readonly playerId: string;
  readonly encounterIndex: number;
}) {
  const [reloadIndex, setReloadIndex] = useState(0);
  const [encounter, setEncounter] = useState<PokemonEncounter | null>(null);
  const [status, setStatus] = useState<EncounterLoadStatus>("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const seed = `${roundId}:${playerId}:${encounterIndex}`;
    setEncounter(null);
    setStatus("loading");
    setLoadError("");

    void fetchPokemonEncounter(encounterId(seed), controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setEncounter(next);
      setStatus("ready");
      prefetchPokemonEncounter(encounterId(`${roundId}:${playerId}:${encounterIndex + 1}`));
      if (next.cryUrl) void new Audio(next.cryUrl).play().catch(() => undefined);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setLoadError(toErrorMessage(error, "포켓몬을 불러오지 못했습니다."));
      setStatus("error");
    });

    return () => controller.abort();
  }, [encounterIndex, playerId, reloadIndex, roundId]);

  const reload = useCallback(() => setReloadIndex((value) => value + 1), []);
  return { encounter, status, loadError, reload } as const;
}
