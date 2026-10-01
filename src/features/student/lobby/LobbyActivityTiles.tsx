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
    { title: "혼자하기", description: "혼자 게임을 골라 연습해요", onClick: onSolo, disabled: disabled || soloDisabled },
    { title: "문장 타자", description: "대기 중 타자 연습", onClick: onSentence, disabled },
    { title: "산성비", description: "떨어지는 단어 입력", onClick: onAcidRain, disabled },
    { title: "점프 타워", description: "친구들과 탑 오르기", onClick: onPlatformer, disabled },
  ];
  return <div className={styles.grid}>{tiles.map((tile) => <Button variant="ghost" className={styles.tile} key={tile.title} disabled={tile.disabled} onClick={tile.onClick}><strong>{tile.title}</strong><span>{tile.description}</span></Button>)}</div>;
}
