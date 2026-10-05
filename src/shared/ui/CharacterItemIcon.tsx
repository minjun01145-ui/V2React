import { useState } from "react";
import { mapleItemIconUrl } from "../../characters/maple.ts";
import { CATEGORY_LABELS, type AvatarCategory } from "../../characters/appearance.ts";
import styles from "./CharacterItemIcon.module.css";
const fallback = { hair: "💇", face: "🙂", hat: "🧢", top: "👕", bottom: "👖", shoes: "👟", accessory: "👓", weapon: "⚔️" };
export default function CharacterItemIcon({ itemId, category }: { readonly itemId: number; readonly category: AvatarCategory }) {
  const [failedId, setFailedId] = useState<number | null>(null);
  return <span className={styles.icon}>
    {failedId === itemId ? <span role="img" aria-label={`${CATEGORY_LABELS[category]} 이미지 없음`}>{fallback[category]}</span>
      : <img src={mapleItemIconUrl(itemId)} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailedId(itemId)} />}
  </span>;
}
