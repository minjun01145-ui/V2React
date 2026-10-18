import type { CSSProperties } from "react";
import type { CoverArt } from "./coverArt.ts";
import styles from "./CoverTile.module.css";

interface Props {
  title: string;
  art: CoverArt | null;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function CoverTile({ title, art, selected, disabled, onClick, className = "" }: Props) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={`${styles.tile} ${className}`}>
    <span className={styles.art} style={art ? { "--cover-color": art.color } as CSSProperties : undefined} aria-hidden="true">
      {art?.image ? <img src={art.image} alt="" draggable={false} /> : art ? <span className={styles.emoji}>{art.emoji}</span> : null}
    </span>
    <span className={styles.name}>{title}</span>
  </button>;
}
