import { useEffect, useState } from "react";
import type { EquippedAvatar } from "../../student-data/cosmetics/types.ts";
import { useCharacterStandFrame } from "../useCharacterStandFrame.ts";
import { findCharacter } from "../../characters/catalog.ts";
import { mapleCharacterUrl } from "../../characters/maple.ts";
import defaultCharacter from "../../assets/maple-default.png";
import styles from "./Avatar.module.css";

/** Shared by profiles, lobbies and games. Only appearance IDs travel with a Maple avatar. */
export default function Avatar({ avatar, label = "캐릭터", className = "", eager = false, showStatus = false }: {
  readonly avatar: EquippedAvatar | null | undefined;
  readonly label?: string;
  readonly className?: string;
  readonly eager?: boolean;
  readonly showStatus?: boolean;
}) {
  const legacy = avatar?.kind === "character" ? findCharacter(avatar.characterId) : null;
  const frame = useCharacterStandFrame(legacy?.standFrames ?? null);
  const source = avatar?.kind === "maple" ? mapleCharacterUrl(avatar.appearance) : avatar?.kind === "pokemon" ? avatar.spriteUrl : frame;
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => setFailed(null), [source]);
  if (failed === source && avatar?.kind === "maple") {
    const fallback = <img className={`${styles.avatar} ${className}`} src={defaultCharacter} alt={`${label} · 이미지 연결 실패, 기본 캐릭터 표시`} />;
    return showStatus ? <span className={styles.failure}>{fallback}<span role="status">캐릭터 이미지를 불러오지 못했습니다.</span></span> : fallback;
  }
  if (!source || failed === source) return <span className={`${styles.fallback} ${className}`} role="img" aria-label={`${label} 이미지 없음`}>🙂</span>;
  return <img className={`${styles.avatar} ${className}`} src={source} alt={label} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false}
    onError={(event) => {
      const fallback = avatar?.kind === "pokemon" ? avatar.fallbackSpriteUrl : null;
      if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
      else setFailed(source);
    }} />;
}
