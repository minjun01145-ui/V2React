import { useState } from "react";
import type { Player } from "../multiplayer/types.ts";
import { toErrorMessage } from "../shared/errors/errorMessage.ts";
import Button from "../shared/ui/Button.tsx";
import Card from "../shared/ui/Card.tsx";
import { rollRequestedWaitingDice } from "./repository.ts";
import { useWaitingDice } from "./useWaitingDice.ts";
import WaitingDiceStage from "./WaitingDiceStage.tsx";
import styles from "./WaitingDice.module.css";

export default function StudentWaitingDice({ roomId, uid, players }: {
  readonly roomId: string;
  readonly uid: string;
  readonly players: readonly Player[];
}) {
  const { value, loading, error: subscriptionError } = useWaitingDice(roomId, uid);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const roller = value?.rollerId ? players.find((player) => player.id === value.rollerId) : undefined;
  const requestedForMe = value?.phase === "requested" && value.rollerId === uid;

  const roll = async (): Promise<void> => {
    if (!requestedForMe || working) return;
    setWorking(true);
    setActionError(null);
    try {
      await rollRequestedWaitingDice(roomId, uid);
    } catch (cause: unknown) {
      console.error(cause);
      setActionError(toErrorMessage(cause, "주사위를 굴리지 못했습니다."));
    } finally {
      setWorking(false);
    }
  };

  if (!value && !subscriptionError) return null;
  return (
    <Card className={styles.card}>
      <div className={styles.studentHeader}>
        <div><h2>{requestedForMe ? "선생님이 주사위를 부탁했어요!" : "대기실 주사위"}</h2></div>
        {requestedForMe ? <Button disabled={working || loading} onClick={() => void roll()}>{working ? "굴리는 중…" : `${value.diceCount}개 굴리기`}</Button> : null}
      </div>
      <WaitingDiceStage state={value} player={roller} />
      {subscriptionError || actionError ? <p className={styles.error}>{actionError ?? subscriptionError?.message}</p> : null}
    </Card>
  );
}
