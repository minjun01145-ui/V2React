import type { ReactNode } from "react";
import styles from "./StudentGameFrame.module.css";

export default function StudentGameFrame({ children }: { readonly children: ReactNode }) {
  return <div className={styles.frame}>{children}</div>;
}
