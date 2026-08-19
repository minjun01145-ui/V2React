import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlaceholderGame.module.css";

export default function PlaceholderStudentGame({ player }: StudentGameModuleProps) {
  return (
    <Card className={styles.placeholder}>
      <div className={styles.badge}>STUDENT GAME MODULE</div>
      <h2>{player.displayName}, 준비!</h2>
      <p>학생용 게임 진입점이 정상적으로 분리되어 로드되었습니다.</p>
      <code>src/games/placeholder/PlaceholderStudentGame.tsx</code>
    </Card>
  );
}
