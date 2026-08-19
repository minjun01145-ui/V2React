import { useState } from "react";
import GameHost from "../../../games/GameHost.tsx";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { usePlayers, useSession } from "../../../multiplayer/hooks.ts";
import { resetSession, startSession } from "../../../multiplayer/repository.ts";
import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherLobbyPage.module.css";

type RoomAction = (roomId: string) => Promise<void>;

export default function TeacherLobbyPage({ roomId }: { readonly roomId: string }) {
  const { session, loading, error } = useSession(roomId, { ensure: true });
  const { activePlayers, players } = usePlayers(roomId);
  const [working, setWorking] = useState(false);

  const run = async (action: RoomAction): Promise<void> => {
    if (working) return;
    setWorking(true);
    try {
      await action(roomId);
    } catch (actionError: unknown) {
      console.error(actionError);
      window.alert(toErrorMessage(actionError, "작업에 실패했습니다."));
    } finally {
      setWorking(false);
    }
  };

  const isPlaying = session?.status === SESSION_STATUS.PLAYING;
  const staleCount = Math.max(players.length - activePlayers.length, 0);

  return <PageShell eyebrow="TEACHER" title="교사용 컨트롤" roomId={roomId} actions={<><Button disabled={working || loading || isPlaying || activePlayers.length === 0} onClick={() => void run((id) => startSession(id))}>게임 시작</Button><Button variant="ghost" disabled={working || loading} onClick={() => void run(resetSession)}>대기실로</Button></>}>
    {error ? <StatusPanel title="Firebase 연결 오류" tone="error">{error.message}</StatusPanel> : null}
    {isPlaying && session ? <GameHost role="teacher" roomId={roomId} session={session} /> : <>
      <StatusPanel title="학생 대기 중" tone="waiting">접속 중 {activePlayers.length}명{staleCount > 0 ? ` · 연결 종료 추정 ${staleCount}명` : ""}</StatusPanel>
      <Card><div className={styles.heading}><div><Eyebrow>PLAYERS</Eyebrow><h2>접속 학생</h2></div><span className={styles.count}>{activePlayers.length}</span></div>{activePlayers.length === 0 ? <Muted>아직 접속한 학생이 없습니다.</Muted> : <div className={styles.grid}>{activePlayers.map((player, index) => <div className={styles.player} key={player.id}><span>{index + 1}</span><strong>{player.studentNumber} · {player.displayName}</strong></div>)}</div>}</Card>
    </>}
  </PageShell>;
}
