import { POKEMON_ITEM, type PokemonInventory, type PokemonItemId } from "../../../student-data/pokemon-catch/types.ts";
import { POKEMON_ITEMS } from "../itemRules.ts";
import type { EncounterPhase } from "../types.ts";
import styles from "../PokemonCatch.module.css";

interface Props {
  readonly inventory: PokemonInventory;
  readonly usingItem: boolean;
  readonly phase: EncounterPhase;
  readonly asleep: boolean;
  readonly onClose: () => void;
  readonly onUseItem: (itemId: PokemonItemId) => void;
}

export function ItemBagDialog({ inventory, usingItem, phase, asleep, onClose, onUseItem }: Props) {
  return <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="아이템 가방"><section className={styles.itemCard}>
    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">×</button>
    <span className={styles.quizStep}>ITEM BAG</span><h2>아이템 사용하기</h2>
    <div className={styles.itemGrid}>{POKEMON_ITEMS.map((item) => {
      const unavailable = inventory[item.id] < 1 || usingItem || phase !== "ready" || (item.id === POKEMON_ITEM.SLEEP_SPRAY && asleep);
      return <div key={item.id} data-item={item.id}>
        <div className={styles.itemIcon}>{item.kind === "ball" ? "◉" : item.id === POKEMON_ITEM.SLEEP_SPRAY ? "Zz" : "+15"}</div>
        <div><strong>{item.name}</strong><small>{item.description}</small></div><b>× {inventory[item.id]}</b>
        <button type="button" onClick={() => onUseItem(item.id)} disabled={unavailable}>{item.kind === "ball" ? "던지기" : "사용"}</button>
      </div>;
    })}</div>
  </section></div>;
}
