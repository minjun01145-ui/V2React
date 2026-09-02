import { useCallback, useEffect, useState } from "react";
import { addPokemonItem, consumePokemonItem, saveCapturedPokemon } from "./repository.ts";
import { pokemonCatchAccountId, subscribeSharedPokemonCatchData } from "./channel.ts";
import { EMPTY_POKEMON_INVENTORY, type PokemonInventory, type PokemonItemId, type StoredCapturedPokemon } from "./types.ts";

export function usePokemonCatchData({ uid, studentNumber }: { readonly uid: string; readonly studentNumber: string }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<PokemonInventory>(EMPTY_POKEMON_INVENTORY);
  const [captures, setCaptures] = useState<StoredCapturedPokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    void pokemonCatchAccountId(uid, studentNumber).then((resolvedAccountId) => {
      if (!active) return;
      setAccountId(resolvedAccountId);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason : new Error(String(reason)));
      setLoading(false);
    });
    return () => { active = false; };
  }, [studentNumber, uid]);

  useEffect(() => {
    if (!accountId) return;
    return subscribeSharedPokemonCatchData(accountId, (snapshot) => {
      setInventory(snapshot.inventory);
      setCaptures([...snapshot.captures]);
      setLoading(snapshot.loading);
      setError(snapshot.error);
    });
  }, [accountId]);

  const addItem = useCallback((itemId: PokemonItemId, rewardId: string) => accountId ? addPokemonItem(accountId, itemId, rewardId) : Promise.reject(new Error("학생 게임 데이터를 준비하는 중입니다.")), [accountId]);
  const consumeItem = useCallback((itemId: PokemonItemId) => accountId ? consumePokemonItem(accountId, itemId) : Promise.resolve(false), [accountId]);
  const saveCapture = useCallback((capture: StoredCapturedPokemon) => accountId ? saveCapturedPokemon(accountId, capture) : Promise.reject(new Error("학생 게임 데이터를 준비하는 중입니다.")), [accountId]);
  return { inventory, captures, loading, error, addItem, consumeItem, saveCapture } as const;
}
