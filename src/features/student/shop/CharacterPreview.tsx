import type { CharacterCatalogItem } from "../../../characters/catalog.ts";
import { useCharacterStandFrame } from "../../../shared/useCharacterStandFrame.ts";
import styles from "./CharacterPreview.module.css";

interface Props {
  readonly character: CharacterCatalogItem;
  readonly size?: "small" | "large";
}

export default function CharacterPreview({ character, size = "large" }: Props) {
  const source = useCharacterStandFrame(character.standFrames);
  return (
    <div className={`${styles.preview} ${styles[size]}`} aria-label={`${character.name} 대기 동작`}>
      <img
        className={styles.frame}
        src={source ?? character.standFrames[0]}
        alt={`${character.name} 캐릭터`}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
