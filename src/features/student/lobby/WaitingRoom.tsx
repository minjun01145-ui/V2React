import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createWaitingTypingConfig, parseWaitingTypingConfig } from "../../../games/typing/waitingTypingConfig.ts";
import { typingDemoSet } from "../../../games/typing/demoSet.ts";
import { usePlayers } from "../../../multiplayer/hooks.ts";
import { replaceRandomNicknameIfUnchanged } from "../../../multiplayer/repository.ts";
import type { GameSession, NicknameGrade, PlayerAvatar } from "../../../multiplayer/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Card from "../../../shared/ui/Card.tsx";
import Button from "../../../shared/ui/Button.tsx";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import CharacterShop from "../shop/CharacterShop.tsx";
import TypingGameButton from "./TypingGameButton.tsx";
import styles from "./WaitingRoom.module.css";
import StudentQuestionAuthoring from "../../../student-question-activity/StudentQuestionAuthoring.tsx";
import { useStudentQuestionSubmission } from "../../../student-question-activity/useStudentQuestionSubmission.ts";
import { shouldShowStudentQuestionAuthoring } from "../../../student-question-activity/model.ts";
import StudentWaitingDice from "../../../waiting-dice/StudentWaitingDice.tsx";
import { pickRandomNickname } from "./randomNickname.ts";

const TypingPracticeGame = lazy(() => import("../../../games/typing/TypingPracticeGame.tsx"));
const SentencePracticeGame = lazy(() => import("../../../games/typing/SentencePracticeGame.tsx"));
const LobbyPlatformer = lazy(() => import("../../../games/lobby-platformer/LobbyPlatformer.tsx"));

interface Props {
  readonly roomId: string;
  readonly session: GameSession;
  readonly selfStudentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly nicknameGrade: NicknameGrade | null;
  readonly avatar: PlayerAvatar | null;
  readonly uid: string;
}

export default function WaitingRoom({ roomId, session, selfStudentNumber, displayName, nickname, nicknameGrade, avatar, uid }: Props) {
  const { activePlayers } = usePlayers(roomId);
  const resolvingDuplicateNickname = useRef(false);
  const duplicateRetryTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  const [duplicateRetry, setDuplicateRetry] = useState(0);
  const [typingOpen, setTypingOpen] = useState<"sentence" | "acid-rain" | null>(null);
  const [platformerOpen, setPlatformerOpen] = useState(false);
  const savedTypingConfig = parseWaitingTypingConfig(session.waitingTypingConfig);
  const typingConfig = savedTypingConfig ?? createWaitingTypingConfig(typingDemoSet.id);
  const activity = session.classroomActivity;
  const targeted = Boolean(activity?.expectedPlayerIds.includes(uid));
  const authoring = useStudentQuestionSubmission(roomId, targeted && activity ? activity.runId : null, uid);

  useEffect(() => {
    if (!nickname || !nicknameGrade || resolvingDuplicateNickname.current) return;
    const sameNickname = activePlayers.filter((player) => player.nickname === nickname);
    if (sameNickname.length < 2) return;
    const keeperId = [...sameNickname]
      .sort((a, b) => Number(Boolean(a.nicknameGrade)) - Number(Boolean(b.nicknameGrade)) || a.id.localeCompare(b.id))[0]?.id;
    if (keeperId === uid) return;
    const usedNicknames = new Set(activePlayers.flatMap((player) => player.nickname ? [player.nickname] : []));
    const next = pickRandomNickname(usedNicknames);
    resolvingDuplicateNickname.current = true;
    void replaceRandomNicknameIfUnchanged(roomId, uid, nickname, nicknameGrade, next.nickname, next.grade)
      .catch(console.error)
      .finally(() => {
        resolvingDuplicateNickname.current = false;
        if (!mounted.current) return;
        if (duplicateRetryTimer.current !== null) window.clearTimeout(duplicateRetryTimer.current);
        duplicateRetryTimer.current = window.setTimeout(() => {
          duplicateRetryTimer.current = null;
          setDuplicateRetry((value) => value + 1);
        }, 500);
      });
  }, [activePlayers, duplicateRetry, nickname, nicknameGrade, roomId, uid]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (duplicateRetryTimer.current !== null) window.clearTimeout(duplicateRetryTimer.current);
    };
  }, []);
  if (targeted && activity?.phase === "active" && authoring.loading) return <StatusPanel title="질문 만들기 확인 중" tone="waiting">제출 상태를 불러오고 있습니다.</StatusPanel>;
  if (activity && shouldShowStudentQuestionAuthoring(activity, uid, authoring.submission)) return <StudentQuestionAuthoring roomId={roomId} playerId={uid} activity={activity} />;
  if (typingOpen && typingConfig) {
    return <Suspense fallback={<StatusPanel title="타자 연습 준비 중">게임 화면을 불러오고 있어요.</StatusPanel>}>
      {typingOpen === "sentence"
        ? <SentencePracticeGame roomId={roomId} nickname={nickname || displayName} config={typingConfig} onExit={() => setTypingOpen(null)} />
        : <TypingPracticeGame config={typingConfig} onExit={() => setTypingOpen(null)} />}
    </Suspense>;
  }
  if (platformerOpen) {
    return <Suspense fallback={<StatusPanel title="플랫포머 준비 중">게임 화면을 불러오고 있어요.</StatusPanel>}>
      <LobbyPlatformer
        roomId={roomId}
        playerId={uid}
        label={nickname || displayName}
        players={activePlayers}
        onExit={() => setPlatformerOpen(false)}
      />
    </Suspense>;
  }
  return (
    <div className={styles.stack}>
      <StatusPanel title="대기 중" tone="waiting">선생님이 시작하면 게임이 자동으로 시작됩니다.</StatusPanel>
      <StudentWaitingDice roomId={roomId} uid={uid} players={activePlayers} />
      <Card className={styles.profileCard}>
        <CharacterShop
          identity={{ uid, studentNumber: selfStudentNumber, displayName }}
          roomId={roomId}
          nickname={nickname}
          nicknameGrade={nicknameGrade}
          initialAvatar={avatar}
        />
      </Card>
      <Card className={styles.card}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>대기 중인 학생</h2>
          <span>{activePlayers.length}명</span>
        </div>
        <PlayerGrid players={activePlayers} selfStudentNumber={selfStudentNumber} />
      </Card>
      <div className={styles.actions}>
        <TypingGameButton mode="sentence" onClick={() => setTypingOpen("sentence")} />
        <TypingGameButton mode="acid-rain" onClick={() => setTypingOpen("acid-rain")} />
        <Button variant="ghost" onClick={() => setPlatformerOpen(true)}>플랫포머 (테스트)</Button>
        {!savedTypingConfig ? <p className={styles.activityHint}>선생님이 세트를 선택하기 전에는 기본 영어 연습 세트로 시작해요.</p> : null}
      </div>
    </div>
  );
}
