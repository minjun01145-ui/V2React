import styles from "./CoverTile.module.css";

interface Props {
  title: string;
  cover?: string | undefined;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function CoverTile({ title, cover, selected, disabled, onClick, className = "" }: Props) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={`${styles.tile} ${className}`}>
    {cover ? <img className={styles.art} src={cover} alt="" draggable={false} /> : <div className={styles.art} />}
    <span className={styles.name}>{title}</span>
  </button>;
}
