import { GAME_CATEGORY_LABEL, GAME_CATEGORY_ORDER, type GameDefinition } from "../../../game-engine/contracts/gameDefinition.ts";
import SelectableCard from "../../../shared/ui/SelectableCard.tsx";
import styles from "./GamePicker.module.css";

interface Props {
  games: readonly GameDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}

export default function GamePicker({ games, selectedId, onSelect, disabled }: Props) {
  return <div className={styles.picker}>
    {GAME_CATEGORY_ORDER.map((category) => {
      const group = games.filter((game) => game.category === category);
      if (group.length === 0) return null;
      return <section className={styles.group} key={category} aria-label={GAME_CATEGORY_LABEL[category]}>
        <h3 className={styles.heading}>{GAME_CATEGORY_LABEL[category]}</h3>
        <div className={styles.cards}>
          {group.map((game) => <SelectableCard key={game.id} selected={selectedId === game.id} disabled={disabled} onClick={() => onSelect(game.id)}>
            <span className={styles.content}>
              <span className={styles.title}>{game.title}</span>
            </span>
          </SelectableCard>)}
        </div>
      </section>;
    })}
  </div>;
}
