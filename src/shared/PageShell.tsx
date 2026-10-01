import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

interface Props {
  readonly eyebrow?: string;
  readonly title: string;
  readonly roomId: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  readonly width?: "default" | "wide";
}

export default function PageShell({ title, roomId: _roomId, children, actions = null, width = "default" }: Props) {
  return <main className={`${styles.shell} ${styles[width]}`}>
    <header className={styles.header}>
      <div className={styles.titleBlock}><h1>{title}</h1></div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
    {children}
  </main>;
}
