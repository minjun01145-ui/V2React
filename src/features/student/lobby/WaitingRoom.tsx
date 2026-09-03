import { lazy, Suspense, useState } from "react";
import { createWaitingTypingConfig, parseWaitingTypingConfig } from "../../../games/typing/waitingTypingConfig.ts";
import { typingDemoSet } from "../../../games/typing/demoSet.ts";
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
  const savedTypingConfig = parseWaitingTypingConfig(session.waitingTypingConfig);
  const typingConfig = savedTypingConfig ?? createWaitingTypingConfig(typingDemoSet.id);
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
        <TypingGameButton onClick={() => setTypingOpen(true)} />
        {!savedTypingConfig ? <p className={styles.activityHint}>선생님이 세트를 선택하기 전에는 기본 영어 연습 세트로 시작해요.</p> : null}
      </div>
      <Card className={styles.shopCard}>
        <CharacterShop identity={{ uid, studentNumber: selfStudentNumber }} />
      </Card>
      <p className={styles.selfHint}>현재 닉네임: {displayLabel(displayName, nickname)}</p>
    </div>
  );
}
