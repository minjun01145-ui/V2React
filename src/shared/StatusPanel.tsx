import type { ReactNode } from "react";
import styles from "./StatusPanel.module.css";

type Tone = "default" | "waiting" | "error";

interface Props {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: Tone;
}

export default function StatusPanel({ title, children, tone = "default" }: Props) {
  return <section className={[styles.panel, styles[tone]].filter(Boolean).join(" ")}>
    <div className={styles.dot} aria-hidden="true" />
    <div><h2>{title}</h2><p>{children}</p></div>
  </section>;
}
