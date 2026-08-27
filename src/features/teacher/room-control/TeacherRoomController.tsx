import { useState } from "react";
import GameHost from "../../../games/GameHost.tsx";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { usePlayers, useSession } from "../../../multiplayer/hooks.ts";
import { resetSession, startSession } from "../../../multiplayer/repository.ts";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { GameSetupPanel } from "./GameSetupPanel.tsx";
import styles from "./TeacherRoomController.module.css";
import { useGameSetup } from "./useGameSetup.ts";

type RoomAction = (roomId: string) => Promise<void>;

interface Props {
  readonly roomId: string;
  readonly embedded?: boolean;
}

export default function TeacherRoomController({ roomId, embedded = false }: Props) {
  const { session, loading, error } = useSession(roomId, { ensure: true });
  const { activePlayers, players } = usePlayers(roomId);
  const [working, setWorking] = useState(false);
  const gameSetup = useGameSetup();
  const { showMessage } = usePopup();

  const run = async (action: RoomAction): Promise<void> => {
    if (working) return;
    setWorking(true);
    try {
      await action(roomId);
    } catch (actionError: unknown) {
      console.error(actionError);
      await showMessage({ title: "작업을 완료하지 못했습니다", message: toErrorMessage(actionError, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    } finally {
      setWorking(false);
    }
  };

  const isPlaying = session?.status === SESSION_STATUS.PLAYING;
  const staleCount = Math.max(players.length - activePlayers.length, 0);

  const startGame = (id: string): Promise<void> => {
    return startSession(id, { gameId: gameSetup.selectedGame.id, gameConfig: gameSetup.buildGameConfig() });
  };

  const actions = <>
    <Button disabled={working || loading || isPlaying || activePlayers.length === 0 || gameSetup.invalidSet} onClick={() => void run(startGame)}>게임 시작</Button>
    <Button variant="ghost" disabled={working || loading} onClick={() => void run(resetSession)}>대기실로</Button>
  </>;

  const content = <>
    {error ? <StatusPanel title="Firebase 연결 오류" tone="error">{error.message}</StatusPanel> : null}
    {isPlaying && session ? <GameHost role="teacher" roomId={roomId} session={session} /> : <>
      <StatusPanel title="학생 대기 중" tone="waiting">접속 {activePlayers.length}명{staleCount > 0 ? ` · 종료 추정 ${staleCount}명` : ""}</StatusPanel>
      <GameSetupPanel setup={gameSetup} disabled={working} />
      <Card><div className={styles.heading}><h2>접속 학생</h2><span className={styles.count}>{activePlayers.length}</span></div><PlayerGrid players={activePlayers} showStudentNumber emptyMessage="접속한 학생이 없습니다." /></Card>
    </>}
  </>;

  if (!embedded) return <PageShell title="교사용 컨트롤" roomId={roomId} actions={actions}>{content}</PageShell>;
  return <section className={styles.embedded} aria-label="테스트 멀티플레이 제어">
    <header className={styles.embeddedHeader}><div><h2>테스트 대기실 제어</h2></div><div className={styles.actions}>{actions}</div></header>
    {content}
  </section>;
}
