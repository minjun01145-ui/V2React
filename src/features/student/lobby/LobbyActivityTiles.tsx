import Button from "../../../shared/ui/Button.tsx";
import styles from "./LobbyActivityTiles.module.css";
interface Props {
  readonly disabled?: boolean;
  readonly soloDisabled?: boolean;
  readonly onSolo?: () => void;
  readonly onSentence?: () => void;
  readonly onAcidRain?: () => void;
  readonly onPlatformer?: () => void;
}
export default function LobbyActivityTiles({ disabled = false, soloDisabled = false, onSolo, onSentence, onAcidRain, onPlatformer }: Props) {
  const tiles = [
    { title: "혼자하기", onClick: onSolo, disabled: disabled || soloDisabled },
    { title: "문장 타자", onClick: onSentence, disabled },
    { title: "산성비", onClick: onAcidRain, disabled },
    { title: "점프 타워", onClick: onPlatformer, disabled },
  ];
  return <div className={styles.grid}>{tiles.map((tile) => <Button variant="ghost" className={styles.tile} key={tile.title} disabled={tile.disabled} onClick={tile.onClick}><strong>{tile.title}</strong></Button>)}</div>;
}
