import type { CSSProperties } from "react";
import type { ActiveGameEffect } from "./model.ts";
import styles from "./GameEffectLayer.module.css";

const PARTICLES = Array.from({ length: 12 }, (_, index) => index);

export function GameEffectLayer({ effect }: { readonly effect: ActiveGameEffect | null }) {
  if (!effect) return null;

  return <div
    className={styles.layer}
    data-kind={effect.kind}
    data-level={effect.level}
    data-tone={effect.tone}
    key={effect.id}
    style={{ "--effect-duration": `${effect.durationMs}ms` } as CSSProperties}
    aria-live="assertive"
    aria-atomic="true"
  >
    <div className={styles.flash} aria-hidden="true" />
    <div className={styles.particles} aria-hidden="true">
      {PARTICLES.map((particle) => <i key={particle} />)}
    </div>
    <div className={styles.burst} role="status">
      <span className={styles.badge} aria-hidden="true">{effect.badge}</span>
      <strong className={styles.headline}>{effect.headline}</strong>
      <b className={styles.metric}>{effect.metric}</b>
      {effect.detail && <span className={styles.detail}>{effect.detail}</span>}
    </div>
  </div>;
}
