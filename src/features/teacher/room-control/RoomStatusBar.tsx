import type { ReactNode } from "react";
import styles from "./RoomStatusBar.module.css";

interface Props {
  label: string;
  detail: string;
  tone: "waiting" | "preparing" | "playing";
  actions?: ReactNode;
}

export default function RoomStatusBar({ label, detail, tone, actions }: Props) {
  return <div className={styles.bar}>
    <div className={styles.status} role="status">
      <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />
      <strong>{label}</strong>
      <span className={styles.detail}>{detail}</span>
    </div>
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </div>;
}
