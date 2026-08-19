import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: "primary" | "ghost";
  readonly full?: boolean;
}

export default function Button({ variant = "primary", full = false, className = "", type = "button", ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], full ? styles.full : "", className].filter(Boolean).join(" ");
  return <button className={classes} type={type} {...props} />;
}
