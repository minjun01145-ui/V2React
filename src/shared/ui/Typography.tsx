import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Typography.module.css";

interface Props extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  readonly children: ReactNode;
}

export function Eyebrow({ children, className = "", ...props }: Props) {
  return <p className={[styles.eyebrow, className].filter(Boolean).join(" ")} {...props}>{children}</p>;
}

export function Muted({ children, className = "", ...props }: Props) {
  return <p className={[styles.muted, className].filter(Boolean).join(" ")} {...props}>{children}</p>;
}
