import type { CSSProperties, ReactNode } from "react";
import type { CoverArt } from "../../../shared/ui/coverArt.ts";
import styles from "./RoomStatusBar.module.css";

interface Props {
  label: string;
  count: string;
  title?: string;
  tone: "waiting" | "preparing" | "playing";
  actions?: ReactNode;
  art?: CoverArt | null;
}

export default function RoomStatusBar({ label, count, title, tone, actions, art }: Props) {
  return <div className={styles.bar} data-tone={tone}>
    {art ? <span className={styles.thumb} style={{ "--cover-color": art.color } as CSSProperties} aria-hidden="true">{art.image ? <img src={art.image} alt="" draggable={false} /> : <span>{art.emoji}</span>}</span> : null}
    <div className={styles.status} role="status">
      <span className={styles.label}><span className={styles.dot} aria-hidden="true" />{label}</span>
      {title ? <strong className={styles.title}>{title}</strong> : null}
    </div>
    <div className={styles.count}><strong>{count}</strong><span>명</span></div>
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </div>;
}
