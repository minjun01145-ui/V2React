import { useCallback, useEffect, useState } from "react";
import { auth } from "../../firebase/firebaseClient.ts";
import { addPokemonItem, consumePokemonItem, ensurePokemonCatchData, saveCapturedPokemon, subscribeCapturedPokemon, subscribePokemonInventory } from "./repository.ts";
import { EMPTY_POKEMON_INVENTORY, type PokemonInventory, type PokemonItemId, type StoredCapturedPokemon } from "./types.ts";

export function usePokemonCatchData({ uid, studentNumber }: { readonly uid: string; readonly studentNumber: string }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<PokemonInventory>(EMPTY_POKEMON_INVENTORY);
  const [captures, setCaptures] = useState<StoredCapturedPokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
      setError(new Error("학생 계정 인증 정보를 확인하지 못했습니다."));
      setLoading(false);
      return;
    }
    void user.getIdTokenResult().then((token) => {
      if (!active) return;
      setAccountId(token.claims.role === "test-student" ? `test-${uid}` : studentNumber);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason : new Error(String(reason)));
      setLoading(false);
    });
    return () => { active = false; };
  }, [studentNumber, uid]);

  useEffect(() => {
    if (!accountId) return;
    let inventoryReady = false;
    let capturesReady = false;
    const markReady = () => {
      if (inventoryReady && capturesReady) setLoading(false);
    };
    void ensurePokemonCatchData(accountId).catch((reason: unknown) => setError(reason instanceof Error ? reason : new Error(String(reason))));
    const stopInventory = subscribePokemonInventory(accountId, (value) => {
      setInventory(value);
      inventoryReady = true;
      markReady();
    }, (reason) => { setError(reason); setLoading(false); });
    const stopCaptures = subscribeCapturedPokemon(accountId, (value) => {
      setCaptures(value);
      capturesReady = true;
      markReady();
    }, (reason) => { setError(reason); setLoading(false); });
    return () => { stopInventory(); stopCaptures(); };
  }, [accountId]);

  const addItem = useCallback((itemId: PokemonItemId) => accountId ? addPokemonItem(accountId, itemId) : Promise.reject(new Error("학생 게임 데이터를 준비하는 중입니다.")), [accountId]);
  const consumeItem = useCallback((itemId: PokemonItemId) => accountId ? consumePokemonItem(accountId, itemId) : Promise.resolve(false), [accountId]);
  const saveCapture = useCallback((capture: StoredCapturedPokemon) => accountId ? saveCapturedPokemon(accountId, capture) : Promise.reject(new Error("학생 게임 데이터를 준비하는 중입니다.")), [accountId]);
  return { inventory, captures, loading, error, addItem, consumeItem, saveCapture } as const;
}
