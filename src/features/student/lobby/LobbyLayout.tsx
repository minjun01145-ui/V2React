import type { ReactNode } from "react";
import styles from "./LobbyLayout.module.css";
/** Top bar, an optional notice strip under it, then the lobby body. */
export default function LobbyLayout({ topBar, notice = null, children }: { readonly topBar: ReactNode; readonly notice?: ReactNode; readonly children: ReactNode }) {
  return <div className={styles.layout}>{topBar}<div className={styles.notice}>{notice}</div><div className={styles.body}>{children}</div></div>;
}
