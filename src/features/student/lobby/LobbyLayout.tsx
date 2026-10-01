import type { ReactNode } from "react";
import styles from "./LobbyLayout.module.css";
export default function LobbyLayout({ topBar, children }: { readonly topBar: ReactNode; readonly children: ReactNode }) {
  return <div className={styles.layout}>{topBar}<div className={styles.body}>{children}</div></div>;
}
