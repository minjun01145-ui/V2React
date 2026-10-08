import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createWaitingTypingConfig, parseWaitingTypingConfig } from "../../../games/typing/waitingTypingConfig.ts";
import { typingDemoSet } from "../../../games/typing/demoSet.ts";
import { usePlayers } from "../../../multiplayer/hooks.ts";
import { replaceRandomNicknameIfUnchanged } from "../../../multiplayer/repository.ts";
import type { GameSession, NicknameGrade, PlayerAvatar } from "../../../multiplayer/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Card from "../../../shared/ui/Card.tsx";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import CharacterShop from "../shop/CharacterShop.tsx";
import OpinionButton from "./OpinionButton.tsx";
import LobbyActivityTiles from "./LobbyActivityTiles.tsx";
import styles from "./WaitingRoom.module.css";
import StudentQuestionAuthoring from "../../../student-question-activity/StudentQuestionAuthoring.tsx";
import { useStudentQuestionSubmission } from "../../../student-question-activity/useStudentQuestionSubmission.ts";
import { shouldShowStudentQuestionAuthoring } from "../../../student-question-activity/model.ts";
import { pickRandomNickname } from "./randomNickname.ts";
import StudentSoloExperience from "../solo/StudentSoloExperience.tsx";
import type { StudentIdentity } from "../../../auth/types.ts";
import type { Player } from "../../../multiplayer/types.ts";
import { canEnterSolo } from "../solo/model.ts";
import { useReloadOnNewDeployment } from "../../../app/useReloadOnNewDeployment.ts";

const TypingPracticeGame = lazy(() => import("../../../games/typing/TypingPracticeGame.tsx"));
const SentencePracticeGame = lazy(() => import("../../../games/typing/SentencePracticeGame.tsx"));
const LobbyPlatformer = lazy(() => import("../../../games/lobby-platformer/LobbyPlatformer.tsx"));
const LobbyDeathmatch = lazy(() => import("../../../games/lobby-deathmatch/LobbyDeathmatch.tsx"));
const DrawingBoard = lazy(() => import("../../../collaborative-drawing/DrawingBoard.tsx"));

interface Props {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly identity: StudentIdentity;
  readonly selfStudentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly nicknameGrade: NicknameGrade | null;
  readonly avatar: PlayerAvatar | null;
  readonly uid: string;
}

export default function WaitingRoom({ roomId, session, player, identity, selfStudentNumber, displayName, nickname, nicknameGrade, avatar, uid }: Props) {
  const { activePlayers } = usePlayers(roomId);
  const resolvingDuplicateNickname = useRef(false);
  const duplicateRetryTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  const [duplicateRetry, setDuplicateRetry] = useState(0);
  const [typingOpen, setTypingOpen] = useState<"sentence" | "acid-rain" | null>(null);
  const [platformerOpen, setPlatformerOpen] = useState(false);
  const [deathmatchOpen, setDeathmatchOpen] = useState(false);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [soloOpen, setSoloOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const savedTypingConfig = parseWaitingTypingConfig(session.waitingTypingConfig);
  const typingConfig = savedTypingConfig ?? createWaitingTypingConfig(typingDemoSet.id);
  const activity = session.classroomActivity;
  const targeted = Boolean(activity?.expectedPlayerIds.includes(uid));
  const requiredActivityActive = Boolean(activity?.phase === "active" && targeted);
  const soloAllowed = canEnterSolo(session.status, requiredActivityActive);
  const authoring = useStudentQuestionSubmission(roomId, targeted && activity ? activity.runId : null, uid);
  const authoringOpen = Boolean(activity && (targeted && activity.phase === "active" && authoring.loading
    || shouldShowStudentQuestionAuthoring(activity, uid, authoring.submission)));
  useReloadOnNewDeployment(!authoringOpen && !soloOpen && !drawingOpen && !typingOpen && !platformerOpen && !deathmatchOpen && !shopOpen);

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
  if (soloOpen && soloAllowed) return <StudentSoloExperience identity={identity} player={player} onReturnToLobby={() => setSoloOpen(false)} />;
  if (drawingOpen) {
    return <Suspense fallback={<StatusPanel title="그림판 준비 중">그림판을 불러오는 중…</StatusPanel>}>
      <DrawingBoard scope={{ roomId, boardId: "lobby" }} author={{ id: uid, label: nickname || displayName }}
        participants={activePlayers.map((participant) => ({ id: participant.id, label: participant.nickname || participant.displayName }))}
        onExit={() => setDrawingOpen(false)} />
    </Suspense>;
  }
  if (typingOpen && typingConfig) {
    return <Suspense fallback={<StatusPanel title="타자 연습 준비 중">게임 화면을 불러오고 있어요.</StatusPanel>}>
      {typingOpen === "sentence"
        ? <SentencePracticeGame roomId={roomId} nickname={nickname || displayName} config={typingConfig} onExit={() => setTypingOpen(null)} />
        : <TypingPracticeGame config={typingConfig} onExit={() => setTypingOpen(null)} />}
    </Suspense>;
  }
  if (platformerOpen) {
    return <Suspense fallback={<StatusPanel title="점프 타워 준비 중">게임 화면을 불러오고 있어요.</StatusPanel>}>
      <LobbyPlatformer
        roomId={roomId}
        playerId={uid}
        label={nickname || displayName}
        players={activePlayers}
        onExit={() => setPlatformerOpen(false)}
      />
    </Suspense>;
  }
  if (deathmatchOpen) {
    return <Suspense fallback={<StatusPanel title="데스매치 준비 중">게임 화면을 불러오고 있어요.</StatusPanel>}>
      <LobbyDeathmatch
        roomId={roomId}
        playerId={uid}
        label={nickname || displayName}
        players={activePlayers}
        onExit={() => setDeathmatchOpen(false)}
      />
    </Suspense>;
  }
  return (
    <div className={styles.stack}>
      <div className={styles.left}>
      <Card className={styles.profileCard}>
        <CharacterShop
          identity={{ uid, studentNumber: selfStudentNumber, displayName }}
          roomId={roomId}
          nickname={nickname}
          nicknameGrade={nicknameGrade}
          initialAvatar={avatar}
          open={shopOpen}
          onOpen={() => setShopOpen(true)}
          onClose={() => setShopOpen(false)}
        />
      </Card>
      <LobbyActivityTiles onShop={() => setShopOpen(true)} soloDisabled={!soloAllowed} onSolo={() => setSoloOpen(true)} onSentence={() => setTypingOpen("sentence")} onAcidRain={() => setTypingOpen("acid-rain")} onPlatformer={() => setPlatformerOpen(true)} onDeathmatch={() => setDeathmatchOpen(true)} onDrawing={() => setDrawingOpen(true)} />
      <OpinionButton roomId={roomId} author={{ playerId: uid, studentNumber: selfStudentNumber, displayName }} />
      </div>
      <div className={styles.right}>
      <Card className={styles.card}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>대기 중인 학생</h2>
          <strong className={styles.playerCount}>{activePlayers.length}</strong>
        </div>
        <div className={styles.players}><PlayerGrid players={activePlayers} selfStudentNumber={selfStudentNumber} /></div>
      </Card>
      </div>
    </div>
  );
}
