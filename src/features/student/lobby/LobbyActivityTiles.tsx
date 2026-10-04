import CoverTile from "../../../shared/ui/CoverTile.tsx";
import { coverArt } from "../../../shared/ui/coverArt.ts";
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
    { title: "혼자하기", art: coverArt("solo"), onClick: onSolo, disabled: disabled || soloDisabled },
    { title: "문장 타자", art: coverArt("typing"), onClick: onSentence, disabled },
    { title: "산성비", art: coverArt("acid-rain"), onClick: onAcidRain, disabled },
    { title: "점프 타워", art: coverArt("lobby-platformer"), onClick: onPlatformer, disabled },
  ];
  return <div className={styles.grid}>{tiles.map((tile) => <CoverTile key={tile.title} title={tile.title} art={tile.art} disabled={tile.disabled} {...(tile.onClick ? { onClick: tile.onClick } : {})} />)}</div>;
}
