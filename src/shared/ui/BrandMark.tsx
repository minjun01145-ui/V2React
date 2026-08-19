import styles from "./BrandMark.module.css";

interface Props {
  readonly className?: string | undefined;
}

export default function BrandMark({ className = "" }: Props) {
  const classes = [styles.mark, className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      <span>J</span>
    </span>
  );
}