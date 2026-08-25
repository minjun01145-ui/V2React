import { usePlayers } from "../../../multiplayer/hooks.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import TypingGameButton from "./TypingGameButton.tsx";
import { displayLabel } from "./nickname.ts";
import styles from "./WaitingRoom.module.css";

interface Props {
  readonly roomId: string;
  readonly selfStudentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly onLeave: () => Promise<void>;
}

export default function WaitingRoom({ roomId, selfStudentNumber, displayName, nickname, onLeave }: Props) {
  const { activePlayers } = usePlayers(roomId);
  return (
    <div className={styles.stack}>
      <StatusPanel title="대기 중" tone="waiting">선생님이 시작하면 게임이 자동으로 시작됩니다.</StatusPanel>
      <Card className={styles.card}>
        <h2 className={styles.sectionTitle}>대기 중인 학생</h2>
        <PlayerGrid players={activePlayers} selfStudentNumber={selfStudentNumber} />
      </Card>
      <div className={styles.actions}>
        <TypingGameButton />
        <Button variant="ghost" onClick={() => void onLeave()}>다른 학생으로</Button>
      </div>
      <p className={styles.selfHint}>현재 닉네임: {displayLabel(displayName, nickname)}</p>
    </div>
  );
}
