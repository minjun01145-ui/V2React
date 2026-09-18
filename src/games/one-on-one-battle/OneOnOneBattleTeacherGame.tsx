import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useBattleStandings } from "../../multiplayer/battle/hooks.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Card from "../../shared/ui/Card.tsx";
import styles from "./OneOnOneBattle.module.css";

const statusLabel = { active: "배틀 중", searching: "상대 찾는 중", completed: "공동 승리" } as const;
export default function OneOnOneBattleTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const standings = useBattleStandings(roomId, session.roundId);
  if (standings.error) return <StatusPanel title="배틀 현황 연결 오류" tone="error">{standings.error.message}</StatusPanel>;
  return <div className={styles.teacher}><div className={styles.teacherHeader}><div><h2>1:1 배틀 현황</h2></div><TimedGameStatus session={session} compact /></div>
    {standings.loading ? <StatusPanel title="배틀을 편성하고 있습니다" tone="waiting">학생들을 익명으로 매칭하고 있습니다.</StatusPanel> : null}
    <div className={styles.standings}>{standings.value.map((student) => <Card className={styles.standing} key={student.id}><header><h3>{student.nickname}</h3><span className={styles.status}>{statusLabel[student.status]}</span></header><dl><div><dt>승리</dt><dd>{student.kills}</dd></div><div><dt>패배</dt><dd>{student.deaths}</dd></div></dl></Card>)}</div>
  </div>;
}
