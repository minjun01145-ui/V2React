import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlaceholderGame.module.css";

export default function PlaceholderStudentGame({ player }: StudentGameModuleProps) {
  return (
    <Card className={styles.placeholder}>
      <h2>{displayLabel(player.displayName, player.nickname)}, 준비!</h2>
    </Card>
  );
}
