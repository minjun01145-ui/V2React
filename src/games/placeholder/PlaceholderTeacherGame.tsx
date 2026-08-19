import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlaceholderGame.module.css";

export default function PlaceholderTeacherGame(_: TeacherGameModuleProps) {
  return (
    <Card className={styles.placeholder}>
      <div className={styles.badge}>TEACHER GAME MODULE</div>
      <h2>게임이 시작되었습니다.</h2>
      <p>교사용 게임 모니터링 진입점이 학생 코드와 별도로 로드되었습니다.</p>
      <code>src/games/placeholder/PlaceholderTeacherGame.tsx</code>
    </Card>
  );
}
