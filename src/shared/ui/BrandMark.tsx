import logo from "./logo.png";
import styles from "./BrandMark.module.css";

interface Props {
  readonly className?: string | undefined;
}

export default function BrandMark({ className = "" }: Props) {
  const classes = [styles.mark, className].filter(Boolean).join(" ");
  return <img className={classes} src={logo} alt="Jurye" draggable="false" />;
}