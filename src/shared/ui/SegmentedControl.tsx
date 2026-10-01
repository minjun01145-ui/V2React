import styles from "./SegmentedControl.module.css";

interface Props<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  size?: "sm" | "md";
}

export default function SegmentedControl<T extends string>({ options, value, onChange, disabled = false, ariaLabel, size = "md" }: Props<T>) {
  return <div className={`${styles.group} ${styles[size]}`} role="group" aria-label={ariaLabel}>
    {options.map(({ id, label }) => <button key={id} type="button" className={styles.option} aria-pressed={id === value} disabled={disabled} onClick={() => onChange(id)}>{label}</button>)}
  </div>;
}
