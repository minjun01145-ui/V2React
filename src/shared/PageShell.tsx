import type { ReactNode } from "react";
import { Eyebrow } from "./ui/Typography.tsx";
import styles from "./PageShell.module.css";

interface Props {
  readonly eyebrow: string;
  readonly title: string;
  readonly roomId: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}

export default function PageShell({ eyebrow, title, roomId, children, actions = null }: Props) {
  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p className={styles.room}>Room <strong>{roomId}</strong></p></div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
    {children}
  </main>;
}
