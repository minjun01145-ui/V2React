import type { ReactNode } from "react";
import styles from "./Badge.module.css";

interface Props {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  children: ReactNode;
}

export default function Badge({ tone = "neutral", children }: Props) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
