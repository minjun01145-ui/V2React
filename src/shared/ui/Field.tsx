import type { ReactNode } from "react";
import styles from "./Field.module.css";

interface Props {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export default function Field({ label, hint, error, children, className = "" }: Props) {
  return <label className={`${styles.field} ${className}`}>
    <span className={styles.label}>{label}</span>
    {children}
    {hint ? <span className={styles.hint}>{hint}</span> : null}
    {error ? <span className={styles.error}>{error}</span> : null}
  </label>;
}
