import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: "primary" | "accent" | "ghost" | "quiet" | "danger" | "onBrand";
  readonly size?: "sm" | "md" | "lg";
  readonly full?: boolean;
}

export default function Button({ variant = "primary", size = "md", full = false, className = "", type = "button", ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], full ? styles.full : "", className].filter(Boolean).join(" ");
  return <button className={classes} type={type} {...props} />;
}
