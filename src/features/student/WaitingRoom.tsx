import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../shared/ui/Typography.tsx";
import styles from "./WaitingRoom.module.css";

interface Props {
  readonly studentNumber: string;
  readonly displayName: string;
  readonly onLeave: () => Promise<void>;
}

export default function WaitingRoom({ studentNumber, displayName, onLeave }: Props) {
  return <div className={styles.stack}>
    <StatusPanel title="대기 중" tone="waiting">선생님이 시작 버튼을 누르면 자동으로 게임이 시작됩니다.</StatusPanel>
    <Card className={styles.card}><Eyebrow>YOU ARE IN</Eyebrow><h2>{studentNumber} · {displayName}</h2><Muted>선생님의 시작 신호를 기다리고 있습니다.</Muted><Button variant="ghost" onClick={() => void onLeave()}>다른 학생으로 로그인</Button></Card>
  </div>;
}
