import CoverTile from "../../../shared/ui/CoverTile.tsx";
import soloCover from "../solo/cover.svg";
import typingCover from "../../../games/typing/cover.svg";
import acidRainCover from "../../../games/acid-rain/cover.svg";
import platformerCover from "../../../games/lobby-platformer/cover.svg";
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
    { title: "혼자하기", cover: soloCover, onClick: onSolo, disabled: disabled || soloDisabled },
    { title: "문장 타자", cover: typingCover, onClick: onSentence, disabled },
    { title: "산성비", cover: acidRainCover, onClick: onAcidRain, disabled },
    { title: "점프 타워", cover: platformerCover, onClick: onPlatformer, disabled },
  ];
  return <div className={styles.grid}>{tiles.map((tile) => <CoverTile key={tile.title} title={tile.title} cover={tile.cover} disabled={tile.disabled} {...(tile.onClick ? { onClick: tile.onClick } : {})} />)}</div>;
}
