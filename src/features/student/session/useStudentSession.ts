import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentIdentity } from "../../../auth/types.ts";
import { getGame } from "../../../games/registry.ts";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { usePlayer, usePlayerHeartbeat, useRoundParticipant, useSession } from "../../../multiplayer/hooks.ts";
import { confirmRoundReady, joinSession, leaveSession } from "../../../multiplayer/repository.ts";
import {
  resolvePlayingParticipation,
  resolveStudentSessionState,
  type StudentSessionState,
} from "./studentSessionState.ts";

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
  const activeRoundId = (session?.status === SESSION_STATUS.PREPARING || session?.status === SESSION_STATUS.PLAYING) && session.roundId
    ? session.roundId
    : undefined;
  const {
    value: participant,
    loading: participantLoading,
    error: participantError,
  } = useRoundParticipant(roomId, activeRoundId, identity.uid);
  const heartbeat = usePlayerHeartbeat(roomId, identity.uid, Boolean(player));
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<Error | null>(null);
  const [readinessError, setReadinessError] = useState<Error | null>(null);
  const confirmingRound = useRef<string | null>(null);
  const joinAttempt = useRef(0);
  const activeJoin = useRef<{
    readonly attempt: number;
    readonly roomId: string;
    readonly playerId: string;
    readonly roundId: string | null;
  } | null>(null);

  const { uid: playerId, studentNumber, displayName } = identity;

  const runJoin = useCallback(
    async ({ nickname, roundId }: JoinWithNicknameOptions & { readonly roundId: string | null }): Promise<void> => {
      if (activeJoin.current) return;
      const resolvedNickname = nickname?.trim() ? nickname.trim() : null;
      const attempt = ++joinAttempt.current;
      activeJoin.current = { attempt, roomId, playerId, roundId };
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
        activeJoin.current = null;
        setJoining(false);
        setJoinError(error instanceof Error ? error : new Error("대기실 입장에 실패했습니다."));
        throw error instanceof Error ? error : new Error("대기실 입장에 실패했습니다.");
      }
    },
    [displayName, playerId, roomId, studentNumber],
  );

  const joinWithNickname = useCallback(
    async ({ nickname }: JoinWithNicknameOptions): Promise<void> => {
      if (player || activeJoin.current) return;
      await runJoin({ nickname, roundId: activeRoundId ?? null });
    },
    [activeRoundId, player, runJoin],
  );

  const retryJoin = useCallback((): void => {
    setJoinError(null);
    setReadinessError(null);
    confirmingRound.current = null;
  }, []);

  const participationDecision = resolvePlayingParticipation({
    session,
    player,
    participant,
    participantLoading,
  });

  useEffect(() => {
    activeJoin.current = null;
    setJoining(false);
    setJoinError(null);
  }, [playerId, roomId]);

  useEffect(() => {
    const active = activeJoin.current;
    if (!active || active.roundId === (activeRoundId ?? null)) return;
    activeJoin.current = null;
    setJoining(false);
    setJoinError(null);
  }, [activeRoundId]);

  useEffect(() => {
    if (session?.status !== SESSION_STATUS.PREPARING || !activeRoundId || participant?.playerId !== playerId) return;
    if (confirmingRound.current === activeRoundId) return;
    confirmingRound.current = activeRoundId;
    setReadinessError(null);
    void getGame(session.gameId).loadStudent()
      .then(() => confirmRoundReady(roomId, activeRoundId, playerId))
      .catch((error: unknown) => {
      confirmingRound.current = null;
      setReadinessError(error instanceof Error ? error : new Error("게임 시작 접속 확인에 실패했습니다."));
      });
  }, [activeRoundId, participant?.playerId, playerId, roomId, session?.gameId, session?.status]);

  useEffect(() => {
    if (participationDecision !== "ensure" || activeJoin.current || joinError || participantError) return;
    void runJoin({ nickname: player?.nickname ?? null, roundId: activeRoundId ?? null }).catch(() => undefined);
  }, [activeRoundId, joinError, participantError, participationDecision, player?.nickname, runJoin]);

  useEffect(() => {
    const waitingMembershipConfirmed = Boolean(session && session.status !== SESSION_STATUS.PLAYING && player);
    const playingMembershipConfirmed = participationDecision === "ready";
    if (!waitingMembershipConfirmed && !playingMembershipConfirmed) return;
    activeJoin.current = null;
    setJoining(false);
    setJoinError(null);
  }, [participationDecision, player, session?.status]);

  useEffect(() => {
    if (!joining || !activeJoin.current) return undefined;
    const timer = window.setTimeout(() => {
      if (!activeJoin.current) return;
      activeJoin.current = null;
      setJoining(false);
      setJoinError(new Error("입장 정보 확인이 늦어지고 있습니다. 다시 시도해 주세요."));
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [joining, participant, player]);

  const leave = useCallback(async (): Promise<void> => {
    await leaveSession(roomId, playerId).catch(console.error);
    await onChangeStudent();
  }, [onChangeStudent, playerId, roomId]);

  return {
    state: resolveStudentSessionState({
      session,
      player,
      participant,
      sessionLoading,
      playerLoading,
      participantLoading,
      joining,
      sessionError,
      playerError,
      participantError,
      readinessError,
      joinError,
      heartbeatError: heartbeat.error,
    }),
    joinWithNickname,
    retryJoin,
    leave,
  };
}
