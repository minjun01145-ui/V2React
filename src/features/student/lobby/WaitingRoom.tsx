import { lazy, Suspense, useState } from "react";
import { parseWaitingTypingConfig } from "../../../games/typing/waitingTypingConfig.ts";
import { usePlayers } from "../../../multiplayer/hooks.ts";
import type { GameSession } from "../../../multiplayer/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Card from "../../../shared/ui/Card.tsx";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import CharacterShop from "../shop/CharacterShop.tsx";
import TypingGameButton from "./TypingGameButton.tsx";
import { displayLabel } from "./nickname.ts";
import styles from "./WaitingRoom.module.css";

const TypingPracticeGame = lazy(() => import("../../../games/typing/TypingPracticeGame.tsx"));

interface Props {
  readonly roomId: string;
  readonly session: GameSession;
  readonly selfStudentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly uid: string;
}

export default function WaitingRoom({ roomId, session, selfStudentNumber, displayName, nickname, uid }: Props) {
  const { activePlayers } = usePlayers(roomId);
  const [typingOpen, setTypingOpen] = useState(false);
  const typingConfig = parseWaitingTypingConfig(session.waitingTypingConfig);
  if (typingOpen && typingConfig) {
    return <Suspense fallback={<StatusPanel title="타자 연습 준비 중">게임 화면을 불러오고 있어요.</StatusPanel>}><TypingPracticeGame config={typingConfig} onExit={() => setTypingOpen(false)} /></Suspense>;
  }
  return (
    <div className={styles.stack}>
      <StatusPanel title="대기 중" tone="waiting">선생님이 시작하면 게임이 자동으로 시작됩니다.</StatusPanel>
      <Card className={styles.card}>
        <h2 className={styles.sectionTitle}>대기 중인 학생</h2>
        <PlayerGrid players={activePlayers} selfStudentNumber={selfStudentNumber} />
      </Card>
      <div className={styles.actions}>
        <TypingGameButton disabled={!typingConfig} onClick={() => setTypingOpen(true)} />
        {!typingConfig ? <p className={styles.activityHint}>선생님이 타자 연습 세트를 선택하면 시작할 수 있어요.</p> : null}
      </div>
      <Card className={styles.shopCard}>
        <CharacterShop identity={{ uid, studentNumber: selfStudentNumber }} />
      </Card>
      <p className={styles.selfHint}>현재 닉네임: {displayLabel(displayName, nickname)}</p>
    </div>
  );
}
