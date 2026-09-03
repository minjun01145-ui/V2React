import { useEffect, useRef, useState } from "react";
import GameHost from "../../../games/GameHost.tsx";
import TeacherQuizGameRuntime from "../quiz-game-runtime/TeacherQuizGameRuntime.tsx";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { usePlayers, useRoundReadiness, useSessionSubscription } from "../../../multiplayer/hooks.ts";
import { countExpectedReady } from "../../../multiplayer/round-readiness/model.ts";
import { finalizeSessionStart } from "../../../multiplayer/repository.ts";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import { resetQuizAwareSession, startQuizGame, startRegularGameSession, subscribeQuizGameSession } from "../../../quiz-game/multiplayerService.ts";
import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { GameSetupPanel } from "./GameSetupPanel.tsx";
import styles from "./TeacherRoomController.module.css";
import { useGameSetup } from "./useGameSetup.ts";
import WaitingTypingSetupPanel from "./WaitingTypingSetupPanel.tsx";
import QuizGameLaunchPanel from "./QuizGameLaunchPanel.tsx";

type RoomAction = (roomId: string) => Promise<void>;

interface Props {
  readonly roomId: string;
  readonly embedded?: boolean;
}

export default function TeacherRoomController({ roomId, embedded = false }: Props) {
  const { value: sessionSnapshot, loading, error } = useSessionSubscription(roomId, subscribeQuizGameSession, { ensure: true });
  const session = sessionSnapshot ? sessionSnapshot.session : null;
  const quizGame = sessionSnapshot ? sessionSnapshot.quizGame : null;
  const { activePlayers, players } = usePlayers(roomId);
  const preparingRoundId = session?.status === SESSION_STATUS.PREPARING && session.roundId ? session.roundId : undefined;
  const { value: readiness, error: readinessError } = useRoundReadiness(roomId, preparingRoundId);
  const [working, setWorking] = useState(false);
  const [showStudentNumbers, setShowStudentNumbers] = useState(true);
  const finalizingRound = useRef<string | null>(null);
  const gameSetup = useGameSetup();
  const { requestConfirmation, showMessage } = usePopup();

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
  const isPreparing = session?.status === SESSION_STATUS.PREPARING;
  const staleCount = Math.max(players.length - activePlayers.length, 0);
  const expectedPlayerIds = session?.expectedPlayerIds ?? [];
  const readyCount = countExpectedReady(expectedPlayerIds, readiness);
  const expectedCount = new Set(expectedPlayerIds).size;

  useEffect(() => {
    if (!isPreparing || !preparingRoundId || expectedCount === 0 || readyCount !== expectedCount) return;
    if (finalizingRound.current === preparingRoundId) return;
    finalizingRound.current = preparingRoundId;
    setWorking(true);
    void finalizeSessionStart(roomId, preparingRoundId).catch(async (startError: unknown) => {
      console.error(startError);
      finalizingRound.current = null;
      await showMessage({ title: "게임을 시작하지 못했습니다", message: toErrorMessage(startError, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    }).finally(() => setWorking(false));
  }, [expectedCount, isPreparing, preparingRoundId, readyCount, roomId, showMessage]);

  const startGame = (id: string): Promise<void> => {
    return startRegularGameSession(id, { gameId: gameSetup.selectedGame.id, gameConfig: gameSetup.buildGameConfig() });
  };

  const forceStart = async (): Promise<void> => {
    if (!preparingRoundId || working) return;
    const confirmed = await requestConfirmation({
      eyebrow: "FORCE START",
      title: `현재 ${readyCount}/${expectedCount}명 접속 상태로 시작할까요?`,
      message: "아직 응답하지 않은 학생은 나중에 연결되면 진행 중인 게임에 합류할 수 있습니다.",
      tone: "warning",
      confirmLabel: "강제 시작",
      cancelLabel: "계속 기다리기",
      blurBackground: true,
    });
    if (!confirmed) return;
    await run(async () => {
      finalizingRound.current = preparingRoundId;
      try {
        await finalizeSessionStart(roomId, preparingRoundId);
      } catch (forceError: unknown) {
        finalizingRound.current = null;
        throw forceError;
      }
    });
  };

  const actions = <>
    <Button disabled={working || loading || isPlaying || isPreparing || activePlayers.length === 0 || gameSetup.invalidSet} onClick={() => void run(startGame)}>게임 시작</Button>
    {isPreparing ? <Button disabled={working || loading || readyCount === 0} onClick={() => void forceStart()}>강제 시작 ({readyCount}/{expectedCount})</Button> : null}
    <Button variant="ghost" disabled={working || loading} onClick={() => void run(resetQuizAwareSession)}>대기실로</Button>
  </>;

  const content = <>
    {error ? <StatusPanel title="Firebase 연결 오류" tone="error">{error.message}</StatusPanel> : null}
    {readinessError ? <StatusPanel title="접속 확인 오류" tone="error">{readinessError.message}</StatusPanel> : null}
    {isPlaying && session ? (quizGame ? <TeacherQuizGameRuntime roomId={roomId} session={session} quizGame={quizGame} /> : <GameHost role="teacher" roomId={roomId} session={session} />) : <>
      <StatusPanel title={isPreparing ? "게임 접속 확인 중" : "학생 대기 중"} tone="waiting">
        {isPreparing ? `${readyCount}/${expectedCount} 학생 접속 완료` : `접속 ${activePlayers.length}명${staleCount > 0 ? ` · 종료 추정 ${staleCount}명` : ""}`}
      </StatusPanel>
      {!isPreparing ? <><GameSetupPanel setup={gameSetup} disabled={working} />
      <QuizGameLaunchPanel disabled={working || activePlayers.length === 0} onStart={(plan) => run((id) => startQuizGame(id, plan))} />
      <WaitingTypingSetupPanel roomId={roomId} session={session} disabled={working} /></> : null}
      <Card>
        <div className={styles.heading}>
          <div className={styles.headingTitle}><h2>접속 학생</h2><span className={styles.count}>{activePlayers.length}</span></div>
          <button
            className={styles.studentNumberToggle}
            type="button"
            aria-pressed={showStudentNumbers}
            onClick={() => setShowStudentNumbers((visible) => !visible)}
          >
            <span className={styles.toggleTrack} aria-hidden="true"><span className={styles.toggleThumb} /></span>
            학번 {showStudentNumbers ? "표시" : "숨김"}
          </button>
        </div>
        <PlayerGrid players={activePlayers} showStudentNumber={showStudentNumbers} emptyMessage="접속한 학생이 없습니다." />
      </Card>
    </>}
  </>;

  if (!embedded) return <PageShell title="교사용 컨트롤" roomId={roomId} actions={actions}>{content}</PageShell>;
  return <section className={styles.embedded} aria-label="테스트 멀티플레이 제어">
    <header className={styles.embeddedHeader}><div><h2>테스트 대기실 제어</h2></div><div className={styles.actions}>{actions}</div></header>
    {content}
  </section>;
}
