import type { CoverArt } from "./coverArt.ts";
import { themeCover } from "./themeCover.ts";
import styles from "./CoverArtwork.module.css";

export default function CoverArtwork({ art }: { readonly art: CoverArt }) {
  const key = art.key;
  return <>
    <span className={styles.original} data-themed={Boolean(key)}>{art.image ? <img src={art.image} alt="" draggable={false} /> : <span className={styles.emoji}>{art.emoji}</span>}</span>
    {key ? (["arcade", "paper", "space"] as const).map((theme) => <img key={theme} className={styles.themed} data-cover-theme={theme} src={themeCover(key, theme)} alt="" draggable={false} />) : null}
  </>;
}
