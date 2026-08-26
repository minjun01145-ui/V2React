import { useEffect, useMemo, useState } from "react";
import GameHost from "../../../games/GameHost.tsx";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE, type LearningSetSummary } from "../../../learning-sets/types.ts";
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
type SupportedGameId = "pokemon-catch" | "sentence-builder" | "matching";

interface Props {
  readonly roomId: string;
  readonly embedded?: boolean;
}

export default function TeacherRoomController({ roomId, embedded = false }: Props) {
  const { session, loading, error } = useSession(roomId, { ensure: true });
  const { activePlayers, players } = usePlayers(roomId);
  const [working, setWorking] = useState(false);
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [gameId, setGameId] = useState<SupportedGameId>("pokemon-catch");
  const [selectedSetId, setSelectedSetId] = useState("");
  const [setError, setSetError] = useState("");
  const { showMessage } = usePopup();

  useEffect(() => {
    let active = true;
    void listLearningSets()
      .then((next) => {
        if (!active) return;
        setSets(next);
        const vocabularySets = next.filter((set) => set.type === LEARNING_SET_TYPE.VOCABULARY);
        setSelectedSetId((current) => current && vocabularySets.some((set) => set.id === current) ? current : (vocabularySets[0]?.id ?? ""));
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
  const setType = gameId === "sentence-builder" ? LEARNING_SET_TYPE.READING_CHUNKS : LEARNING_SET_TYPE.VOCABULARY;
  const compatibleSets = useMemo(() => sets.filter((set) => set.type === setType), [setType, sets]);
  const selectedSet = useMemo(() => compatibleSets.find((set) => set.id === selectedSetId) ?? null, [compatibleSets, selectedSetId]);
  const minimumItemCount = gameId === "matching" ? 6 : gameId === "pokemon-catch" ? 4 : 1;
  const invalidSet = Boolean(selectedSet && selectedSet.itemCount < minimumItemCount);
  const selectGame = (nextGameId: SupportedGameId): void => {
    const nextType = nextGameId === "sentence-builder" ? LEARNING_SET_TYPE.READING_CHUNKS : LEARNING_SET_TYPE.VOCABULARY;
    setGameId(nextGameId);
    setSelectedSetId(sets.find((set) => set.type === nextType)?.id ?? "");
  };

  const actions = <>
    <Button disabled={working || loading || isPlaying || activePlayers.length === 0 || invalidSet} onClick={() => void run((id) => startSession(id, { gameId, gameConfig: selectedSet ? { setId: selectedSet.id } : {} }))}>게임 시작</Button>
    <Button variant="ghost" disabled={working || loading} onClick={() => void run(resetSession)}>대기실로</Button>
  </>;

  const content = <>
    {error ? <StatusPanel title="Firebase 연결 오류" tone="error">{error.message}</StatusPanel> : null}
    {isPlaying && session ? <GameHost role="teacher" roomId={roomId} session={session} /> : <>
      <StatusPanel title="학생 대기 중" tone="waiting">접속 {activePlayers.length}명{staleCount > 0 ? ` · 종료 추정 ${staleCount}명` : ""}</StatusPanel>
      <Card className={styles.setPicker}><div><h2>{gameId === "pokemon-catch" ? "포켓몬 잡기" : gameId === "matching" ? "짝맞추기" : "문장 만들기"}</h2><Muted>{gameId === "matching" ? "단어 세트 · 6개 이상 필요" : gameId === "pokemon-catch" ? "단어 세트 · 4개 이상 필요" : "끊어읽기 세트"}</Muted></div><div className={styles.pickerControls}><label>게임<select value={gameId} onChange={(event) => selectGame(event.target.value as SupportedGameId)} disabled={working}><option value="pokemon-catch">포켓몬 잡기</option><option value="matching">짝맞추기</option><option value="sentence-builder">문장 만들기</option></select></label><label>학습 세트<select value={selectedSetId} onChange={(event) => setSelectedSetId(event.target.value)} disabled={working}><option value="">내장 데모 세트</option>{compatibleSets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount}개)</option>)}</select></label></div>{setError ? <p className={styles.setError}>{setError}</p> : null}{invalidSet ? <p className={styles.setError}>{gameId === "matching" ? "짝맞추기를 위해 6개 이상의 단어가 필요합니다." : "4지선다를 위해 4개 이상의 단어가 필요합니다."}</p> : null}</Card>
      <Card><div className={styles.heading}><h2>접속 학생</h2><span className={styles.count}>{activePlayers.length}</span></div><PlayerGrid players={activePlayers} showStudentNumber emptyMessage="접속한 학생이 없습니다." /></Card>
    </>}
  </>;

  if (!embedded) return <PageShell title="교사용 컨트롤" roomId={roomId} actions={actions}>{content}</PageShell>;
  return <section className={styles.embedded} aria-label="테스트 멀티플레이 제어">
    <header className={styles.embeddedHeader}><div><h2>테스트 대기실 제어</h2></div><div className={styles.actions}>{actions}</div></header>
    {content}
  </section>;
}
