import type { StoredCapturedPokemon } from "../../../student-data/pokemon-catch/types.ts";
import { capturedPokemonDisplayName } from "../captureRecord.ts";
import { PokemonSprite } from "../PokemonSprite.tsx";
import styles from "../PokemonCatch.module.css";

interface Props {
  readonly captures: readonly StoredCapturedPokemon[];
  readonly onClose: () => void;
}

export function CollectionDialog({ captures, onClose }: Props) {
  return <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="내 포획함"><section className={styles.collectionCard}>
    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">×</button><span className={styles.quizStep}>MY COLLECTION</span><h2>내 포획함</h2>
    {captures.length === 0 ? <p className={styles.emptyCollection}>아직 잡은 포켓몬이 없어요.</p> : <div className={styles.collectionGrid}>{captures.map((pokemon) => <div key={pokemon.captureId}><PokemonSprite pokemon={pokemon} alt="" /><strong>{capturedPokemonDisplayName(pokemon)}</strong>{pokemon.nickname ? <span>{pokemon.name}</span> : null}<small>Lv.{pokemon.level} · {pokemon.types.join("/") || `No.${String(pokemon.speciesId).padStart(3, "0")}`}</small></div>)}</div>}
  </section></div>;
}
