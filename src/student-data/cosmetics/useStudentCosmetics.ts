import { useCallback, useEffect, useState } from "react";
import { resolveStudentGameDataAccountId } from "../accountId.ts";
import { equipCharacter, equipPokemon, subscribeStudentCosmetics } from "./repository.ts";
import { EMPTY_STUDENT_COSMETICS, type EquippedPokemonAvatar, type StudentCosmetics, type StudentWardrobe } from "./types.ts";
import { initializeStudentCharacter, saveStudentCharacter, subscribeStudentWardrobe, subscribeV2Coins } from "./shopRepository.ts";
import type { CharacterAppearance } from "../../characters/appearance.ts";

interface StudentAccount {
  readonly uid: string;
  readonly studentNumber: string;
}

export function useStudentCosmetics({ uid, studentNumber }: StudentAccount) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cosmetics, setCosmetics] = useState<StudentCosmetics>(EMPTY_STUDENT_COSMETICS);
  const [loading, setLoading] = useState(true);
  const [wardrobe, setWardrobe] = useState<StudentWardrobe | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setAccountId(null);
    setWardrobe(null);
    setBalance(null);
    setCosmetics(EMPTY_STUDENT_COSMETICS);
    void resolveStudentGameDataAccountId(uid, studentNumber).then(async (resolvedAccountId) => {
      if (!active) return;
      await initializeStudentCharacter();
      if (!active) return;
      setAccountId(resolvedAccountId);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason : new Error(String(reason)));
      setLoading(false);
    });
    return () => { active = false; };
  }, [studentNumber, uid, retry]);

  useEffect(() => {
    if (!accountId) return undefined;
    const stopCosmetics = subscribeStudentCosmetics(accountId, (value) => {
      setCosmetics(value);
      setLoading(false);
    }, (reason) => {
      setError(reason);
      setLoading(false);
    });
    const failed = (reason: Error) => { setError(reason); setLoading(false); };
    const stopWardrobe = subscribeStudentWardrobe(accountId, setWardrobe, failed);
    const stopCoins = subscribeV2Coins(accountId, setBalance, failed);
    return () => { stopCosmetics(); stopWardrobe(); stopCoins(); };
  }, [accountId]);

  const equipStudentCharacter = useCallback((characterId: string) => accountId
    ? equipCharacter(accountId, characterId)
    : Promise.reject(new Error("학생 상점 정보를 준비하는 중입니다.")), [accountId]);

  const equipCapturedPokemon = useCallback((pokemon: EquippedPokemonAvatar) => accountId
    ? equipPokemon(accountId, pokemon)
    : Promise.reject(new Error("학생 상점 정보를 준비하는 중입니다.")), [accountId]);

  const saveAppearance = useCallback((appearance: CharacterAppearance) => saveStudentCharacter(appearance), []);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  return { cosmetics, wardrobe, balance, loading: loading || (!error && (wardrobe === null || balance === null)), error, equipStudentCharacter, equipCapturedPokemon, saveAppearance, reload } as const;
}
