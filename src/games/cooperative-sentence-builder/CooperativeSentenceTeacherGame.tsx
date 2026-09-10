import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useCooperativeTeams } from "../../multiplayer/cooperative/hooks.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Card from "../../shared/ui/Card.tsx";
import styles from "./CooperativeSentence.module.css";

export default function CooperativeSentenceTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const teams = useCooperativeTeams(roomId, session.roundId);
  if (teams.error) return <StatusPanel title="조 현황 연결 오류" tone="error">{teams.error.message}</StatusPanel>;
  const visible = teams.value.filter((team) => team.status !== "eliminated");
  return <div className={styles.teacher}>
    <div className={styles.teacherHeading}><div><span>COOPERATIVE SENTENCE</span><h2>협동 문장만들기 현황</h2></div><TimedGameStatus session={session} compact /></div>
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
