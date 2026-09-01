import type { CharacterCatalogItem } from "../../../characters/catalog.ts";
import styles from "./CharacterPreview.module.css";

interface Props {
  readonly character: CharacterCatalogItem;
  readonly size?: "small" | "large";
}

export default function CharacterPreview({ character, size = "large" }: Props) {
  return (
    <div className={`${styles.preview} ${styles[size]}`} aria-label={`${character.name} 대기 동작`}>
      {character.standFrames.map((source, index) => (
        <img
          aria-hidden={index === 0 ? undefined : true}
          className={styles.frame}
          key={source}
          src={source}
          alt={index === 0 ? `${character.name} 캐릭터` : ""}
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      ))}
    </div>
  );
}
