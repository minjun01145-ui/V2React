import { useEffect, useState } from "react";
import type { Player } from "../multiplayer/types.ts";
import { displayLabel } from "../multiplayer/types.ts";
import { DICE_COUNTS, type DiceCount } from "../dice/model.ts";
import { useDiceRoll } from "../dice/useDiceRoll.ts";
import { toErrorMessage } from "../shared/errors/errorMessage.ts";
import Button from "../shared/ui/Button.tsx";
import Card from "../shared/ui/Card.tsx";
import { cancelStudentDiceRoll, requestStudentDiceRoll } from "./repository.ts";
import { useWaitingDice } from "./useWaitingDice.ts";
import WaitingDiceStage from "./WaitingDiceStage.tsx";
import styles from "./WaitingDice.module.css";

export default function TeacherWaitingDice({ roomId, players, disabled = false }: {
  readonly roomId: string;
  readonly players: readonly Player[];
  readonly disabled?: boolean;
}) {
  const [diceCount, setDiceCount] = useState<DiceCount>(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [remotePlayerId, setRemotePlayerId] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "remote">("local");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const localDice = useDiceRoll();
  const { value, error: subscriptionError } = useWaitingDice(roomId, remotePlayerId);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const roller = value?.rollerId ? players.find((player) => player.id === value.rollerId) : undefined;
  const localRolling = localDice.state.phase === "rolling";
  const presentation = mode === "remote" ? value : {
    ...localDice.state,
    rollerId: null,
    rollerLabel: "선생님",
  };

  useEffect(() => {
    if (players.some((player) => player.id === selectedPlayerId)) return;
    setSelectedPlayerId(players[0]?.id ?? "");
  }, [players, selectedPlayerId]);

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (working) return;
    setWorking(true);
    setActionError(null);
    try {
      await action();
    } catch (cause: unknown) {
      console.error(cause);
      setActionError(toErrorMessage(cause, "주사위를 준비하지 못했습니다."));
    } finally {
      setWorking(false);
    }
  };

  const rollLocally = (): void => {
    if (localRolling || working) return;
    const previousRemotePlayerId = remotePlayerId;
    setRemotePlayerId(null);
    setMode("local");
    setActionError(null);
    if (previousRemotePlayerId) {
      void cancelStudentDiceRoll(roomId, previousRemotePlayerId).catch((cause: unknown) => {
        console.error(cause);
        setActionError(toErrorMessage(cause, "이전 학생 요청을 정리하지 못했습니다."));
      });
    }
    void localDice.roll(diceCount);
  };

  const askStudent = (): void => {
    if (!selectedPlayer) return;
    const previousRemotePlayerId = remotePlayerId;
    setRemotePlayerId(selectedPlayer.id);
    setMode("remote");
    void run(async () => {
      if (previousRemotePlayerId && previousRemotePlayerId !== selectedPlayer.id) {
        await cancelStudentDiceRoll(roomId, previousRemotePlayerId);
      }
      await requestStudentDiceRoll(roomId, diceCount, selectedPlayer);
    });
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>DICE</span><h2>주사위 굴리기</h2><p>직접 굴리거나 대기 중인 학생에게 부탁해 보세요.</p></div>
        <div className={styles.countPicker} role="group" aria-label="주사위 개수">
          {DICE_COUNTS.map((count) => <button key={count} type="button" aria-pressed={diceCount === count} disabled={disabled || working || localRolling} onClick={() => setDiceCount(count)}>{count}개</button>)}
        </div>
      </div>
      <WaitingDiceStage state={presentation} player={mode === "remote" ? roller : undefined} />
      <div className={styles.teacherControls}>
        <Button disabled={disabled || working || localRolling} onClick={rollLocally}>{localRolling && mode === "local" ? "굴리는 중…" : "내가 굴리기"}</Button>
        <span className={styles.or} aria-hidden="true">또는</span>
        <label>학생 선택
          <select value={selectedPlayerId} disabled={disabled || working || players.length === 0} onChange={(event) => setSelectedPlayerId(event.target.value)}>
            {players.length === 0 ? <option value="">접속 학생 없음</option> : players.map((player) => <option key={player.id} value={player.id}>{displayLabel(player.displayName, player.nickname)}</option>)}
          </select>
        </label>
        <Button variant="ghost" disabled={disabled || working || !selectedPlayer} onClick={askStudent}>이 학생에게 부탁하기</Button>
      </div>
      {(mode === "remote" && subscriptionError) || actionError ? <p className={styles.error}>{actionError ?? subscriptionError?.message}</p> : null}
    </Card>
  );
}
