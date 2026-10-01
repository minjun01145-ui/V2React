import type { ButtonHTMLAttributes } from "react";
import styles from "./SelectableCard.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly selected: boolean;
}

export default function SelectableCard({ selected, className = "", type = "button", ...props }: Props) {
  return <button type={type} aria-pressed={selected} className={`${styles.card} ${selected ? styles.selected : ""} ${className}`} {...props} />;
}
