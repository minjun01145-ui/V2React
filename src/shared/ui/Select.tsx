import type { SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

export default function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${styles.select} ${className}`} {...props} />;
}
