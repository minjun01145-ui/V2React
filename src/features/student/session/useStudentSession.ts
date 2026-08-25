import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentIdentity } from "../../../auth/types.ts";
import { usePlayer, usePlayerHeartbeat, useSession } from "../../../multiplayer/hooks.ts";
import { joinSession, leaveSession } from "../../../multiplayer/repository.ts";
import { resolveStudentSessionState, type StudentSessionState } from "./studentSessionState.ts";

interface UseStudentSessionOptions {
  readonly roomId: string;
  readonly identity: StudentIdentity;
  readonly onChangeStudent: () => Promise<void>;
}

export interface JoinWithNicknameOptions {
  readonly nickname: string | null;
}

interface UseStudentSessionResult {
  readonly state: StudentSessionState;
  readonly joinWithNickname: (options: JoinWithNicknameOptions) => Promise<void>;
  readonly retryJoin: () => void;
  readonly leave: () => Promise<void>;
}

export function useStudentSession({
  roomId,
  identity,
  onChangeStudent,
}: UseStudentSessionOptions): UseStudentSessionResult {
  const { session, loading: sessionLoading, error: sessionError } = useSession(roomId);
  const { player, loading: playerLoading, error: playerError } = usePlayer(roomId, identity.uid);
  const heartbeat = usePlayerHeartbeat(roomId, identity.uid, Boolean(player));
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<Error | null>(null);
  const joinAttempt = useRef(0);
  const activeJoin = useRef<{ readonly attempt: number; readonly roomId: string; readonly playerId: string } | null>(null);

  const { uid: playerId, studentNumber, displayName } = identity;

  const joinWithNickname = useCallback(
    async ({ nickname }: JoinWithNicknameOptions): Promise<void> => {
      if (joining || player) return;
      const resolvedNickname = nickname?.trim() ? nickname.trim() : null;
      const attempt = ++joinAttempt.current;
      activeJoin.current = { attempt, roomId, playerId };
      setJoining(true);
      setJoinError(null);
      try {
        await joinSession({
          roomId,
          playerId,
          studentNumber,
          displayName,
          nickname: resolvedNickname,
        });
      } catch (error: unknown) {
        if (activeJoin.current?.attempt !== attempt) return;
        setJoinError(error instanceof Error ? error : new Error("대기실 입장에 실패했습니다."));
        throw error instanceof Error ? error : new Error("대기실 입장에 실패했습니다.");
      } finally {
        if (activeJoin.current?.attempt !== attempt) return;
        activeJoin.current = null;
        setJoining(false);
      }
    },
    [displayName, joining, player, playerId, roomId, studentNumber],
  );

  const retryJoin = useCallback((): void => {
    setJoinError(null);
  }, []);

  const leave = useCallback(async (): Promise<void> => {
    await leaveSession(roomId, playerId).catch(console.error);
    await onChangeStudent();
  }, [onChangeStudent, playerId, roomId]);

  useEffect(() => {
    if (!player) return undefined;
    const releasePresence = (event: PageTransitionEvent): void => {
      if (!event.persisted) void leaveSession(roomId, playerId).catch(() => undefined);
    };
    window.addEventListener("pagehide", releasePresence);
    return () => window.removeEventListener("pagehide", releasePresence);
  }, [player, playerId, roomId]);

  return {
    state: resolveStudentSessionState({
      session,
      player,
      sessionLoading,
      playerLoading,
      joining,
      sessionError,
      playerError,
      joinError,
      heartbeatError: heartbeat.error,
    }),
    joinWithNickname,
    retryJoin,
    leave,
  };
}
