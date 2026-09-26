import { useCallback, useEffect, useState } from "react";
import { resolveStudentGameDataAccountId } from "../accountId.ts";
import { equipCharacter, equipPokemon, subscribeStudentCosmetics } from "./repository.ts";
import { EMPTY_STUDENT_COSMETICS, type EquippedPokemonAvatar, type StudentCosmetics } from "./types.ts";

interface StudentAccount {
  readonly uid: string;
  readonly studentNumber: string;
}

export function useStudentCosmetics({ uid, studentNumber }: StudentAccount) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cosmetics, setCosmetics] = useState<StudentCosmetics>(EMPTY_STUDENT_COSMETICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void resolveStudentGameDataAccountId(uid, studentNumber).then((resolvedAccountId) => {
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
    if (!accountId) return undefined;
    return subscribeStudentCosmetics(accountId, (value) => {
      setCosmetics(value);
      setLoading(false);
    }, (reason) => {
      setError(reason);
      setLoading(false);
    });
  }, [accountId]);

  const equipStudentCharacter = useCallback((characterId: string) => accountId
    ? equipCharacter(accountId, characterId)
    : Promise.reject(new Error("학생 상점 정보를 준비하는 중입니다.")), [accountId]);

  const equipCapturedPokemon = useCallback((pokemon: EquippedPokemonAvatar) => accountId
    ? equipPokemon(accountId, pokemon)
    : Promise.reject(new Error("학생 상점 정보를 준비하는 중입니다.")), [accountId]);

  return { cosmetics, loading, error, equipStudentCharacter, equipCapturedPokemon } as const;
}
