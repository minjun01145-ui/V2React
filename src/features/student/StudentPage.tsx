import { useEffect, useState } from "react";
import type { StudentIdentity } from "../../auth/types.ts";
import GameHost from "../../games/GameHost.tsx";
import { SESSION_STATUS } from "../../multiplayer/constants.ts";
import { usePlayer, usePlayerHeartbeat, useSession } from "../../multiplayer/hooks.ts";
import { joinSession, leaveSession } from "../../multiplayer/repository.ts";
import PageShell from "../../shared/PageShell.tsx";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import WaitingRoom from "./WaitingRoom.tsx";

interface Props {
  readonly roomId: string;
  readonly identity: StudentIdentity;
  readonly onChangeStudent: () => Promise<void>;
}

export default function StudentPage({ roomId, identity, onChangeStudent }: Props) {
  const { session, loading: sessionLoading, error: sessionError } = useSession(roomId);
  const { player, loading: playerLoading } = usePlayer(roomId, identity.uid);
  const heartbeat = usePlayerHeartbeat(roomId, identity.uid, Boolean(player));
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<Error | null>(null);

  useEffect(() => {
    if (sessionLoading || playerLoading || !session || player || joining || session.status === SESSION_STATUS.PLAYING) return;
    let active = true;
    setJoining(true);
    setJoinError(null);
    void joinSession({ roomId, playerId: identity.uid, studentNumber: identity.studentNumber, displayName: identity.displayName })
      .catch((error: unknown) => {
        if (active) setJoinError(error instanceof Error ? error : new Error("대기실 입장에 실패했습니다."));
      })
      .finally(() => {
        if (active) setJoining(false);
      });
    return () => { active = false; };
  }, [identity, joining, player, playerLoading, roomId, session?.status, sessionLoading]);

  const handleLeave = async (): Promise<void> => {
    await leaveSession(roomId, identity.uid).catch(console.error);
    await onChangeStudent();
  };

  if (sessionLoading || playerLoading || joining) {
    return <PageShell eyebrow="STUDENT" title="접속 중" roomId={roomId}><StatusPanel title="대기실 연결 중">실시간 수업 연결을 확인하고 있습니다.</StatusPanel></PageShell>;
  }
  if (sessionError) {
    return <PageShell eyebrow="STUDENT" title="연결 오류" roomId={roomId}><StatusPanel title="Firebase 연결을 확인해 주세요" tone="error">{sessionError.message}</StatusPanel></PageShell>;
  }
  if (joinError) {
    return <PageShell eyebrow="STUDENT" title="입장 오류" roomId={roomId}><StatusPanel title="대기실에 입장하지 못했습니다" tone="error">{joinError.message}</StatusPanel><Button onClick={() => setJoinError(null)}>다시 시도</Button><Button variant="ghost" onClick={() => void handleLeave()}>다른 학생으로 로그인</Button></PageShell>;
  }
  if (heartbeat.error) {
    return <PageShell eyebrow="STUDENT" title="연결 오류" roomId={roomId}><StatusPanel title="대기실 연결을 다시 확인해 주세요" tone="error">{heartbeat.error.message}</StatusPanel></PageShell>;
  }
  if (!session) {
    return <PageShell eyebrow="STUDENT" title="대기실 준비 중" roomId={roomId}><StatusPanel title="선생님이 대기실을 준비하고 있습니다" tone="waiting">관리자 화면에서 대기실을 열면 자동으로 입장합니다.</StatusPanel></PageShell>;
  }
  if (!player && session.status === SESSION_STATUS.PLAYING) {
    return <PageShell eyebrow="STUDENT" title="게임 진행 중" roomId={roomId}><StatusPanel title="현재 게임이 진행 중입니다" tone="waiting">선생님이 대기실로 전환하면 자동으로 입장합니다.</StatusPanel></PageShell>;
  }
  if (!player) {
    return <PageShell eyebrow="STUDENT" title="대기실 준비 중" roomId={roomId}><StatusPanel title="입장을 준비하고 있습니다">잠시 후 자동으로 대기실에 연결됩니다.</StatusPanel></PageShell>;
  }
  if (session.status === SESSION_STATUS.PLAYING) {
    return <PageShell eyebrow="STUDENT GAME" title="게임 진행 중" roomId={roomId}><GameHost role="student" roomId={roomId} session={session} player={player} /></PageShell>;
  }
  return <PageShell eyebrow="STUDENT LOBBY" title="게임 대기실" roomId={roomId}><WaitingRoom studentNumber={player.studentNumber} displayName={player.displayName} onLeave={handleLeave} /></PageShell>;
}
