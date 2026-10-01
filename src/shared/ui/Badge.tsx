import type { ReactNode } from "react";
import styles from "./Badge.module.css";

interface Props {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "accent";
  size?: "md" | "lg";
  children: ReactNode;
}

export default function Badge({ tone = "neutral", size = "md", children }: Props) {
  return <span className={`${styles.badge} ${styles[tone]} ${size === "lg" ? styles.lg : ""}`}>{children}</span>;
}
