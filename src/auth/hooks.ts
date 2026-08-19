import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeAdminAuth } from "./teacherAuth.ts";
import { subscribeStudentAuth, subscribeStudentIdentity } from "./studentAuth.ts";
import type { AdminSession, AuthState, StudentIdentity } from "./types.ts";

async function hasVerifiedStudentClaim(user: User): Promise<boolean> {
  const token = await user.getIdTokenResult();
  return token.claims.role === "student"
    && typeof token.claims.studentNumber === "string"
    && typeof token.claims.displayName === "string";
}

export function useStudentAuth(): AuthState<StudentIdentity> {
  const [state, setState] = useState<AuthState<StudentIdentity>>({ value: null, loading: true, error: null });

  useEffect(() => {
    let stopIdentity: (() => void) | null = null;
    let generation = 0;
    const stopAuth = subscribeStudentAuth((user: User | null) => {
      generation += 1;
      const currentGeneration = generation;
      stopIdentity?.();
      stopIdentity = null;

      if (!user || !user.isAnonymous) {
        setState({ value: null, loading: false, error: null });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: null }));
      void hasVerifiedStudentClaim(user)
        .then((verified) => {
          if (currentGeneration !== generation) return;
          if (!verified) {
            setState({ value: null, loading: false, error: null });
            return;
          }
          stopIdentity = subscribeStudentIdentity(
            user.uid,
            (identity) => setState({ value: identity, loading: false, error: null }),
            (error) => setState({ value: null, loading: false, error }),
          );
        })
        .catch((error: unknown) => {
          if (currentGeneration !== generation) return;
          setState({ value: null, loading: false, error: error instanceof Error ? error : new Error("학생 인증 확인에 실패했습니다.") });
        });
    });

    return () => {
      generation += 1;
      stopIdentity?.();
      stopAuth();
    };
  }, []);

  return state;
}

export function useAdminAuth(): AuthState<AdminSession> {
  const [state, setState] = useState<AuthState<AdminSession>>({ value: null, loading: true, error: null });
  useEffect(() => subscribeAdminAuth(
    (admin) => setState({ value: admin, loading: false, error: null }),
    (error) => setState({ value: null, loading: false, error }),
  ), []);
  return state;
}
