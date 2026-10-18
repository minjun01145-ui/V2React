import type { ThemeId } from "../../../appearance/themes.ts";
import { coverArt } from "../../../shared/ui/coverArt.ts";
import styles from "./ThemePreview.module.css";

const cover = coverArt("learning-jump-tower");

/** A miniature app screen drawn with the theme's own tokens, so the preview is always the real palette. */
export default function ThemePreview({ themeId }: { readonly themeId: ThemeId }) {
  return <div className={styles.preview} data-theme={themeId} aria-hidden="true">
    <div className={styles.nav}><i /><i data-active /><i /><i /></div>
    <div className={styles.main}>
      <div className={styles.bar}><b /><span /></div>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.art} style={{ background: cover.color }}>{cover.image ? <img src={cover.image} alt="" /> : cover.emoji}</div>
          <b />
        </div>
        <div className={styles.tile} data-selected><div className={styles.art} data-soft /><b /></div>
      </div>
      <div className={styles.button} />
    </div>
  </div>;
}
