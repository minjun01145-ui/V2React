import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentIdentity } from "../../../auth/types.ts";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { usePlayer, usePlayerHeartbeat, useSession } from "../../../multiplayer/hooks.ts";
import { joinSession, leaveSession } from "../../../multiplayer/repository.ts";
import { resolveStudentSessionState, type StudentSessionState } from "./studentSessionState.ts";

interface UseStudentSessionOptions {
  readonly roomId: string;
  readonly identity: StudentIdentity;
  readonly onChangeStudent: () => Promise<void>;
}

interface UseStudentSessionResult {
  readonly state: StudentSessionState;
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
  const [retryGeneration, setRetryGeneration] = useState(0);
  const joinAttempt = useRef(0);
  const activeJoin = useRef<{ readonly attempt: number; readonly roomId: string; readonly playerId: string } | null>(null);

  const { uid: playerId, studentNumber, displayName } = identity;

  useEffect(() => {
    const cannotJoin = sessionLoading
      || playerLoading
      || Boolean(sessionError)
      || Boolean(playerError)
      || Boolean(joinError)
      || !session
      || Boolean(player)
      || session.status === SESSION_STATUS.PLAYING;

    if (cannotJoin) {
      activeJoin.current = null;
      setJoining(false);
      return;
    }
    if (activeJoin.current?.roomId === roomId && activeJoin.current.playerId === playerId) return;

    const attempt = ++joinAttempt.current;
    activeJoin.current = { attempt, roomId, playerId };
    setJoining(true);
    void joinSession({ roomId, playerId, studentNumber, displayName })
      .catch((error: unknown) => {
        if (activeJoin.current?.attempt !== attempt) return;
        setJoinError(error instanceof Error ? error : new Error("대기실 입장에 실패했습니다."));
      })
      .finally(() => {
        if (activeJoin.current?.attempt !== attempt) return;
        activeJoin.current = null;
        setJoining(false);
      });
  }, [
    displayName,
    joinError,
    player,
    playerError,
    playerId,
    playerLoading,
    retryGeneration,
    roomId,
    session,
    sessionError,
    sessionLoading,
    studentNumber,
  ]);

  const retryJoin = useCallback((): void => {
    setJoinError(null);
    setRetryGeneration((current) => current + 1);
  }, []);

  const leave = useCallback(async (): Promise<void> => {
    await leaveSession(roomId, playerId).catch(console.error);
    await onChangeStudent();
  }, [onChangeStudent, playerId, roomId]);

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
    retryJoin,
    leave,
  };
}
