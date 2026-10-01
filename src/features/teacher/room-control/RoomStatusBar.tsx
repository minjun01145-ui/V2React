import type { ReactNode } from "react";
import styles from "./RoomStatusBar.module.css";

interface Props {
  label: string;
  count: string;
  title?: string;
  tone: "waiting" | "preparing" | "playing";
  actions?: ReactNode;
}

export default function RoomStatusBar({ label, count, title, tone, actions }: Props) {
  return <div className={styles.bar}>
    <div className={styles.status} role="status">
      <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />
      <strong>{label}</strong>
      <span className={styles.count}><strong>{count}</strong>명</span>
      {title ? <span className={styles.title}>{title}</span> : null}
    </div>
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </div>;
}
