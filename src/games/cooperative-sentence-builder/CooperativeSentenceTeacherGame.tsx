import { useState } from "react";
import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useCooperativeRoundState, useCooperativeTeams } from "../../multiplayer/cooperative/hooks.ts";
import { enableCooperativeHardMode } from "../../multiplayer/cooperative/repository.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { usePopup } from "../../shared/popup/index.ts";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import styles from "./CooperativeSentence.module.css";

export default function CooperativeSentenceTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const teams = useCooperativeTeams(roomId, session.roundId);
  const roundState = useCooperativeRoundState(roomId, session.roundId);
  const [enablingHardMode, setEnablingHardMode] = useState(false);
  const { showMessage } = usePopup();
  const turnOnHardMode = async (): Promise<void> => {
    if (enablingHardMode || roundState.value?.hardMode) return;
    setEnablingHardMode(true);
    try {
      await enableCooperativeHardMode(roomId, session.roundId);
    } catch (reason: unknown) {
      await showMessage({ title: "빡센모드를 활성화하지 못했습니다", message: toErrorMessage(reason, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    } finally {
      setEnablingHardMode(false);
    }
  };
  if (teams.error) return <StatusPanel title="조 현황 연결 오류" tone="error">{teams.error.message}</StatusPanel>;
  const visible = teams.value.filter((team) => team.status !== "eliminated");
  return <div className={styles.teacher}>
    <div className={styles.teacherHeading}><div><h2>커플 문장만들기 현황</h2></div><div className={styles.teacherActions}><Button onClick={() => void turnOnHardMode()} disabled={roundState.loading || !roundState.value || enablingHardMode || roundState.value.hardMode}>{roundState.value?.hardMode ? "빡센모드 활성화됨" : enablingHardMode ? "활성화 중…" : "빡센모드 활성화"}</Button><TimedGameStatus session={session} compact /></div></div>
    {roundState.value?.hardMode ? <StatusPanel title="빡센모드 진행 중" tone="error">각 학생에게 문장당 5초가 주어지며, 시간 초과는 오답으로 처리됩니다.</StatusPanel> : null}
    {teams.loading ? <StatusPanel title="조를 편성하고 있습니다" tone="waiting">학생들을 무작위 음식 조로 나누고 있습니다.</StatusPanel> : null}
    {!teams.loading && visible.length === 0 ? <StatusPanel title="새 조를 기다리는 중" tone="waiting">탈락한 학생들이 새로운 조를 찾고 있습니다.</StatusPanel> : null}
    <div className={styles.teamGrid}>{visible.map((team) => {
      const percent = team.questionCount > 0 ? Math.round(team.currentQuestionIndex / team.questionCount * 100) : 0;
      return <Card className={styles.teamCard} key={team.id} data-complete={team.status === "completed"}>
        <div className={styles.teamCardTop}><div><span>{team.memberCount}명</span><h3>{team.name}</h3></div><span className={styles.hearts}>{[0, 1].map((index) => <i key={index} data-alive={index < team.hearts}>♥</i>)}</span></div>
        <div className={styles.progressLabel}><strong>{team.status === "completed" ? "완료!" : `${team.currentQuestionIndex + 1}번 진행 중`}</strong><span>{team.currentQuestionIndex} / {team.questionCount}</span></div>
        <div className={styles.progressTrack}><i style={{ width: `${percent}%` }} /></div>
      </Card>;
    })}</div>
  </div>;
}
