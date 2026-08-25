import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

interface Props {
  readonly eyebrow?: string;
  readonly title: string;
  readonly roomId: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}

export default function PageShell({ title, roomId: _roomId, children, actions = null }: Props) {
  return <main className={styles.shell}>
    <header className={styles.header}>
      <div className={styles.titleBlock}><h1>{title}</h1><span className={styles.rule} aria-hidden="true" /></div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
    {children}
  </main>;
}
