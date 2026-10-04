import { useEffect, useRef, useState } from "react";
import GameHost from "../../../games/GameHost.tsx";
import { getGame } from "../../../games/registry.ts";
import TeacherQuizGameRuntime from "../quiz-game-runtime/TeacherQuizGameRuntime.tsx";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { usePlayers, useRoundReadiness, useSessionSubscription } from "../../../multiplayer/hooks.ts";
import { countExpectedReady } from "../../../multiplayer/round-readiness/model.ts";
import { finalizeSessionStart } from "../../../multiplayer/repository.ts";
import { withTimedGameConfig, type TimedGameMode } from "../../../game-engine/timed-game/config.ts";
import { resetQuizAwareSession, startQuizGame, startRegularGameSession, subscribeQuizGameSession } from "../../../quiz-game/multiplayerService.ts";
import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import { coverArt, isCoverKey } from "../../../shared/ui/coverArt.ts";
import ActivityLaunchPanel from "./ActivityLaunchPanel.tsx";
import styles from "./TeacherRoomController.module.css";
import { useGameSetup } from "./useGameSetup.ts";
import { useActivityLaunch } from "./useActivityLaunch.ts";
import LobbyToolsPanel from "./LobbyToolsPanel.tsx";
import RoomStatusBar from "./RoomStatusBar.tsx";
import TeacherStudentQuestionPanel from "../../../student-question-activity/TeacherStudentQuestionPanel.tsx";
import { startStudentQuestionActivity } from "../../../student-question-activity/repository.ts";
import type { StudentQuestionConfig } from "../../../student-question-activity/types.ts";
import type { QuizGamePlan } from "../../../quiz-game/types.ts";
import TeacherPlayerRoster from "./TeacherPlayerRoster.tsx";

type RoomAction = (roomId: string) => Promise<void>;

interface Props {
  readonly roomId: string;
  readonly embedded?: boolean;
}

export default function TeacherRoomController({ roomId, embedded = false }: Props) {
  const { value: sessionSnapshot, loading, error } = useSessionSubscription(roomId, subscribeQuizGameSession, { ensure: true });
  const session = sessionSnapshot ? sessionSnapshot.session : null;
  const quizGame = sessionSnapshot ? sessionSnapshot.quizGame : null;
  const { activePlayers } = usePlayers(roomId);
  const preparingRoundId = session?.status === SESSION_STATUS.PREPARING && session.roundId ? session.roundId : undefined;
  const { value: readiness, error: readinessError } = useRoundReadiness(roomId, preparingRoundId);
  const [working, setWorking] = useState(false);
  const finalizingRound = useRef<string | null>(null);
  const gameSetup = useGameSetup(session?.latestStudentQuestionResult?.resultSetId ?? null);
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
  const isQuestionActivity = Boolean(session?.classroomActivity);
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

  const startQuestions = (config: StudentQuestionConfig): Promise<void> => run(async (id) => {
    await startStudentQuestionActivity(id, config, activePlayers.map((player) => player.id));
  });
  const startQuiz = (plan: QuizGamePlan): Promise<void> => run((id) => startQuizGame(id, plan));
  const startLatestQuestions = (setId: string, timedMode: TimedGameMode): Promise<void> => run((id) => startRegularGameSession(id, { gameId: "ai-tutor", gameConfig: withTimedGameConfig({ setId }, timedMode) }));
  const launch = useActivityLaunch({
    setup: gameSetup,
    disabled: working || loading,
    hasPlayers: activePlayers.length > 0,
    latestQuestionSetId: session?.latestStudentQuestionResult?.resultSetId ?? null,
    onStartGame: () => run(startGame),
    onStartQuiz: startQuiz,
    onStartQuestions: startQuestions,
    onStartLatestQuestions: startLatestQuestions,
  });
  const activityTitle = launch.activityKind === "game" ? gameSetup.selectedGame.title
    : launch.activityKind === "quiz" ? launch.quizPlan?.name ?? "퀴즈쇼"
    : launch.activityKind === "questions" ? "질문 만들기" : "학생 질문 AI 문답";
  const statusArt = isPlaying && session ? (quizGame ? null : isCoverKey(session.gameId) ? coverArt(session.gameId) : null) : isPreparing ? null : launch.activityKind === "game" && isCoverKey(gameSetup.selectedGame.id) ? coverArt(gameSetup.selectedGame.id) : null;
  const actions = isPlaying || isPreparing ? <>
    {isPreparing ? <Button variant="accent" disabled={working || loading || readyCount === 0} onClick={() => void forceStart()}>강제 시작 ({readyCount}/{expectedCount})</Button> : null}
    <Button variant="ghost" disabled={working || loading || isQuestionActivity} onClick={() => void run(resetQuizAwareSession)}>대기실로 돌아가기</Button>
  </> : <Button variant="accent" size="lg" disabled={working || loading || activePlayers.length === 0 || launch.invalidSelection} onClick={() => void launch.start()}>{working ? "처리 중…" : activePlayers.length === 0 ? "학생 접속 대기 중" : launch.startLabel}</Button>;

  const content = <>
    <RoomStatusBar
      label={isPlaying ? "게임 진행 중" : isPreparing ? "접속 확인 중" : "학생 대기 중"}
      count={isPreparing ? `${readyCount}/${expectedCount}` : String(activePlayers.length)}
      {...(isPreparing ? {} : { title: isPlaying && session ? quizGame ? "퀴즈쇼" : getGame(session.gameId).title : activityTitle })}
      tone={isPlaying ? "playing" : isPreparing ? "preparing" : "waiting"}
      actions={actions}
      art={statusArt}
    />
    {error ? <StatusPanel title="Firebase 연결 오류" tone="error">{error.message}</StatusPanel> : null}
    {readinessError ? <StatusPanel title="접속 확인 오류" tone="error">{readinessError.message}</StatusPanel> : null}
    {isPlaying && session ? (quizGame ? <TeacherQuizGameRuntime roomId={roomId} session={session} quizGame={quizGame} /> : <GameHost role="teacher" roomId={roomId} session={session} />) : isPreparing ? <TeacherPlayerRoster roomId={roomId} players={activePlayers} disabled={working || loading} /> : <div className={styles.lobbyGrid} data-has-side={!isQuestionActivity}>
      <div className={styles.mainColumn}>
        <TeacherPlayerRoster roomId={roomId} players={activePlayers} disabled={working || loading} />
        {isQuestionActivity && session?.classroomActivity ? <TeacherStudentQuestionPanel roomId={roomId} activePlayers={activePlayers} activity={session.classroomActivity} disabled={working || isPlaying} onError={(value) => void showMessage({ title: "질문 만들기 오류", message: toErrorMessage(value, "작업을 완료하지 못했습니다."), tone: "error", blurBackground: false })} /> : null}
        {!isQuestionActivity ? <ActivityLaunchPanel setup={gameSetup} disabled={working || loading} launch={launch} /> : null}
      </div>
      {!isQuestionActivity ? <aside className={styles.sideColumn}><LobbyToolsPanel roomId={roomId} players={activePlayers} session={session} disabled={working || loading} typingDisabled={working} /></aside> : null}
    </div>}
  </>;

  if (!embedded) return <PageShell title="대기실" width="wide" roomId={roomId}><div className={styles.content}>{content}</div></PageShell>;
  return <section className={styles.embedded} aria-label="테스트 멀티플레이 제어">
    <header className={styles.embeddedHeader}><h2>테스트 대기실 제어</h2></header>
    {content}
  </section>;
}
