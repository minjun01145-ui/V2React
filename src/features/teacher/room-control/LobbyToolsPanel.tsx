import type { GameSession, Player } from "../../../multiplayer/types.ts";
import Card from "../../../shared/ui/Card.tsx";
import TeacherWaitingDice from "../../../waiting-dice/TeacherWaitingDice.tsx";
import WaitingTypingSetupPanel from "./WaitingTypingSetupPanel.tsx";
import styles from "./LobbyToolsPanel.module.css";

interface Props {
  readonly roomId: string;
  readonly players: readonly Player[];
  readonly session: GameSession | null;
  readonly disabled: boolean;
  readonly typingDisabled: boolean;
}

export default function LobbyToolsPanel({ roomId, players, session, disabled, typingDisabled }: Props) {
  return <div className={styles.panel}>
    <Card><h2 className={styles.title}>주사위</h2><TeacherWaitingDice roomId={roomId} players={players} disabled={disabled} /></Card>
    <Card><h2 className={styles.title}>대기 중 타자 세트</h2><WaitingTypingSetupPanel roomId={roomId} session={session} disabled={typingDisabled} /></Card>
  </div>;
}
