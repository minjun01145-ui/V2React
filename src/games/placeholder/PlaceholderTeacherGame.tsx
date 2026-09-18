import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlaceholderGame.module.css";

export default function PlaceholderTeacherGame(_: TeacherGameModuleProps) {
  return (
    <Card className={styles.placeholder}>
      <h2>게임이 시작되었습니다.</h2>
    </Card>
  );
}
