import { useEffect, useMemo, useState } from "react";
import GameHost from "../../../games/GameHost.tsx";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE, type LearningSetSummary } from "../../../learning-sets/types.ts";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { usePlayers, useSession } from "../../../multiplayer/hooks.ts";
import { resetSession, startSession } from "../../../multiplayer/repository.ts";
import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherLobbyPage.module.css";

type RoomAction = (roomId: string) => Promise<void>;

export default function TeacherLobbyPage({ roomId }: { readonly roomId: string }) {
  const { session, loading, error } = useSession(roomId, { ensure: true });
  const { activePlayers, players } = usePlayers(roomId);
  const [working, setWorking] = useState(false);
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [gameId, setGameId] = useState<"pokemon-catch" | "sentence-builder">("pokemon-catch");
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
  const setType = gameId === "pokemon-catch" ? LEARNING_SET_TYPE.VOCABULARY : LEARNING_SET_TYPE.READING_CHUNKS;
  const compatibleSets = useMemo(() => sets.filter((set) => set.type === setType), [setType, sets]);
  const selectedSet = useMemo(() => compatibleSets.find((set) => set.id === selectedSetId) ?? null, [compatibleSets, selectedSetId]);
  const invalidPokemonSet = gameId === "pokemon-catch" && Boolean(selectedSet && selectedSet.itemCount < 4);
  const selectGame = (nextGameId: "pokemon-catch" | "sentence-builder"): void => {
    const nextType = nextGameId === "pokemon-catch" ? LEARNING_SET_TYPE.VOCABULARY : LEARNING_SET_TYPE.READING_CHUNKS;
    setGameId(nextGameId);
    setSelectedSetId(sets.find((set) => set.type === nextType)?.id ?? "");
  };

  return <PageShell eyebrow="TEACHER" title="교사용 컨트롤" roomId={roomId} actions={<><Button disabled={working || loading || isPlaying || activePlayers.length === 0 || invalidPokemonSet} onClick={() => void run((id) => startSession(id, { gameId, gameConfig: selectedSet ? { setId: selectedSet.id } : {} }))}>게임 시작</Button><Button variant="ghost" disabled={working || loading} onClick={() => void run(resetSession)}>대기실로</Button></>}>
    {error ? <StatusPanel title="Firebase 연결 오류" tone="error">{error.message}</StatusPanel> : null}
    {isPlaying && session ? <GameHost role="teacher" roomId={roomId} session={session} /> : <>
      <StatusPanel title="학생 대기 중" tone="waiting">접속 {activePlayers.length}명{staleCount > 0 ? ` · 종료 추정 ${staleCount}명` : ""}</StatusPanel>
      <Card className={styles.setPicker}><div><Eyebrow>GAME CONTENT</Eyebrow><h2>{gameId === "pokemon-catch" ? "포켓몬 잡기" : "문장 만들기"}</h2><Muted>{gameId === "pokemon-catch" ? "단어 세트 · 4개 이상 필요" : "끊어읽기 세트"}</Muted></div><div className={styles.pickerControls}><label>게임<select value={gameId} onChange={(event) => selectGame(event.target.value as "pokemon-catch" | "sentence-builder")} disabled={working}><option value="pokemon-catch">포켓몬 잡기</option><option value="sentence-builder">문장 만들기</option></select></label><label>학습 세트<select value={selectedSetId} onChange={(event) => setSelectedSetId(event.target.value)} disabled={working}><option value="">내장 데모 세트</option>{compatibleSets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount}개)</option>)}</select></label></div>{setError ? <p className={styles.setError}>{setError}</p> : null}{invalidPokemonSet ? <p className={styles.setError}>4지선다를 위해 4개 이상의 단어가 필요합니다.</p> : null}</Card>
      <Card><div className={styles.heading}><div><Eyebrow>PLAYERS</Eyebrow><h2>접속 학생</h2></div><span className={styles.count}>{activePlayers.length}</span></div>{activePlayers.length === 0 ? <Muted>접속한 학생이 없습니다.</Muted> : <div className={styles.grid}>{activePlayers.map((player, index) => <div className={styles.player} key={player.id}><span>{index + 1}</span><strong>{player.studentNumber} · {player.displayName}</strong></div>)}</div>}</Card>
    </>}
  </PageShell>;
}
