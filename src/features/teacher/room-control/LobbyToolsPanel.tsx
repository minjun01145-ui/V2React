import type { GameSession } from "../../../multiplayer/types.ts";
import Card from "../../../shared/ui/Card.tsx";
import WaitingTypingSetupPanel from "./WaitingTypingSetupPanel.tsx";
import styles from "./LobbyToolsPanel.module.css";
import Button from "../../../shared/ui/Button.tsx";

interface Props {
  readonly roomId: string;
  readonly session: GameSession | null;
  readonly typingDisabled: boolean;
  readonly onDrawing: () => void;
}

export default function LobbyToolsPanel({ roomId, session, typingDisabled, onDrawing }: Props) {
  return <div className={styles.panel}>
    <Card><h2 className={styles.title}>대기 중 타자 세트</h2><WaitingTypingSetupPanel roomId={roomId} session={session} disabled={typingDisabled} /></Card>
    <Card><h2 className={styles.title}>그림그리기</h2><Button variant="ghost" full disabled={typingDisabled} onClick={onDrawing}>그림판 열기</Button></Card>
  </div>;
}
