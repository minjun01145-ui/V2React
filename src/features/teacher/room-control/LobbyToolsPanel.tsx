import type { GameSession } from "../../../multiplayer/types.ts";
import Card from "../../../shared/ui/Card.tsx";
import WaitingTypingSetupPanel from "./WaitingTypingSetupPanel.tsx";
import styles from "./LobbyToolsPanel.module.css";

interface Props {
  readonly roomId: string;
  readonly session: GameSession | null;
  readonly typingDisabled: boolean;
}

export default function LobbyToolsPanel({ roomId, session, typingDisabled }: Props) {
  return <div className={styles.panel}>
    <Card><h2 className={styles.title}>대기 중 타자 세트</h2><WaitingTypingSetupPanel roomId={roomId} session={session} disabled={typingDisabled} /></Card>
  </div>;
}
