import { useEffect, useMemo, useState } from "react";
import GameHost from "../../../games/GameHost.tsx";
import { getGame, listGames } from "../../../games/registry.ts";
import { DEFAULT_TIMED_GAME_MODE, TIMED_GAME_MODE_OPTIONS, withTimedGameConfig, type TimedGameMode } from "../../../game-engine/timed-game/config.ts";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
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
import { Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherRoomController.module.css";

type RoomAction = (roomId: string) => Promise<void>;

interface Props {
  readonly roomId: string;
  readonly embedded?: boolean;
}

export default function TeacherRoomController({ roomId, embedded = false }: Props) {
  const { session, loading, error } = useSession(roomId, { ensure: true });
  const { activePlayers, players } = usePlayers(roomId);
  const [working, setWorking] = useState(false);
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const availableGames = useMemo(() => listGames().filter((game) => game.supportedSetTypes.length > 0), []);
  const [gameId, setGameId] = useState("pokemon-catch");
  const [selectedSetId, setSelectedSetId] = useState("");
  const [timedMode, setTimedMode] = useState<TimedGameMode>(DEFAULT_TIMED_GAME_MODE);
  const [setError, setSetError] = useState("");
  const { showMessage } = usePopup();

  useEffect(() => {
    let active = true;
    void listLearningSets()
      .then((next) => {
        if (!active) return;
        setSets(next);
        const initialGame = getGame("pokemon-catch");
        const compatible = next.filter((set) => initialGame.supportedSetTypes.includes(set.type));
        setSelectedSetId((current) => current && compatible.some((set) => set.id === current) ? current : (compatible[0]?.id ?? ""));
      })
      .catch((value: unknown) => { if (active) setSetError(toErrorMessage(value, "학습 세트 목록을 불러오지 못했습니다.")); });
    return () => { active = false; };
  }, []);

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
  const selectedGame = useMemo(() => getGame(gameId), [gameId]);
  const compatibleSets = useMemo(() => sets.filter((set) => selectedGame.supportedSetTypes.includes(set.type)), [selectedGame, sets]);
  const selectedSet = useMemo(() => compatibleSets.find((set) => set.id === selectedSetId) ?? null, [compatibleSets, selectedSetId]);
  const invalidSet = Boolean(selectedSet && selectedSet.itemCount < selectedGame.minimumSetItemCount);
  const selectGame = (nextGameId: string): void => {
    const nextGame = getGame(nextGameId);
    setGameId(nextGameId);
    setSelectedSetId(sets.find((set) => nextGame.supportedSetTypes.includes(set.type))?.id ?? "");
  };

  const startGame = (id: string): Promise<void> => {
    const baseConfig: Readonly<Record<string, unknown>> = selectedSet ? { setId: selectedSet.id } : {};
    const gameConfig = selectedGame.timing === "timed" ? withTimedGameConfig(baseConfig, timedMode) : baseConfig;
    return startSession(id, { gameId, gameConfig });
  };

  const actions = <>
    <Button disabled={working || loading || isPlaying || activePlayers.length === 0 || invalidSet} onClick={() => void run(startGame)}>게임 시작</Button>
    <Button variant="ghost" disabled={working || loading} onClick={() => void run(resetSession)}>대기실로</Button>
  </>;

  const content = <>
    {error ? <StatusPanel title="Firebase 연결 오류" tone="error">{error.message}</StatusPanel> : null}
    {isPlaying && session ? <GameHost role="teacher" roomId={roomId} session={session} /> : <>
      <StatusPanel title="학생 대기 중" tone="waiting">접속 {activePlayers.length}명{staleCount > 0 ? ` · 종료 추정 ${staleCount}명` : ""}</StatusPanel>
      <Card className={styles.setPicker}><div><h2>{selectedGame.title}</h2><Muted>{selectedGame.supportedSetTypes.map((type) => type === "reading-chunks" ? "끊어읽기" : "단어").join(" · ")} 세트 · {selectedGame.minimumSetItemCount}개 이상 필요{selectedGame.timing === "timed" ? " · 시간제" : ""}</Muted></div><div className={styles.pickerControls}><label>게임<select value={gameId} onChange={(event) => selectGame(event.target.value)} disabled={working}>{availableGames.map((game) => <option value={game.id} key={game.id}>{game.title}</option>)}</select></label><label>학습 세트<select value={selectedSetId} onChange={(event) => setSelectedSetId(event.target.value)} disabled={working}><option value="">내장 데모 세트</option>{compatibleSets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount}개)</option>)}</select></label>{selectedGame.timing === "timed" ? <label>게임 시간<select value={timedMode} onChange={(event) => setTimedMode(event.target.value as TimedGameMode)} disabled={working}>{TIMED_GAME_MODE_OPTIONS.map((option) => <option value={option.mode} key={option.mode}>{option.label} 모드</option>)}</select></label> : null}</div>{setError ? <p className={styles.setError}>{setError}</p> : null}{invalidSet ? <p className={styles.setError}>{selectedGame.title}을(를) 위해 {selectedGame.minimumSetItemCount}개 이상의 문항이 필요합니다.</p> : null}</Card>
      <Card><div className={styles.heading}><h2>접속 학생</h2><span className={styles.count}>{activePlayers.length}</span></div><PlayerGrid players={activePlayers} showStudentNumber emptyMessage="접속한 학생이 없습니다." /></Card>
    </>}
  </>;

  if (!embedded) return <PageShell title="교사용 컨트롤" roomId={roomId} actions={actions}>{content}</PageShell>;
  return <section className={styles.embedded} aria-label="테스트 멀티플레이 제어">
    <header className={styles.embeddedHeader}><div><h2>테스트 대기실 제어</h2></div><div className={styles.actions}>{actions}</div></header>
    {content}
  </section>;
}
