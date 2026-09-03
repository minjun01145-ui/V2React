import { useEffect, useState, type FormEvent } from "react";
import { MAX_POKEMON_NICKNAME_LENGTH } from "../captureRecord.ts";
import { PokemonSprite } from "../PokemonSprite.tsx";
import type { PokemonEncounter } from "../types.ts";
import styles from "../PokemonCatch.module.css";

export function CaptureResultDialog({ pokemon, saving, error, onContinue }: {
  readonly pokemon: PokemonEncounter;
  readonly saving: boolean;
  readonly error: string;
  readonly onContinue: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  useEffect(() => setNickname(""), [pokemon.id, pokemon.level]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!saving) onContinue(nickname);
  };

  return <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={`${pokemon.name} 포획 결과`}>
    <section className={styles.captureResultCard}>
      <span className={styles.captureResultEyebrow}>POKÉMON CAUGHT!</span>
      <h2>{pokemon.name}을(를) 잡았다!</h2>
      <div className={styles.captureResultHero}>
        <PokemonSprite className={styles.captureResultSprite} pokemon={pokemon} alt={pokemon.name} />
        <div>
          <small>No.{String(pokemon.id).padStart(3, "0")}</small>
          <strong>Lv. {pokemon.level}</strong>
          <div className={styles.typeBadges}>{pokemon.types.map((type) => <b key={type}>{type}</b>)}</div>
        </div>
      </div>
      <p className={styles.captureDescription}>{pokemon.description}</p>
      <dl className={styles.captureFacts}>
        <div><dt>키</dt><dd>{pokemon.heightMeters === null ? "알 수 없음" : `${pokemon.heightMeters} m`}</dd></div>
        <div><dt>몸무게</dt><dd>{pokemon.weightKg === null ? "알 수 없음" : `${pokemon.weightKg} kg`}</dd></div>
      </dl>
      <form onSubmit={submit}>
        <label htmlFor="pokemon-nickname">별명을 지어줄까요? <small>선택 사항</small></label>
        <input id="pokemon-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={MAX_POKEMON_NICKNAME_LENGTH} placeholder={pokemon.name} disabled={saving} autoFocus />
        {error ? <p className={styles.captureSaveError} role="alert">{error}</p> : null}
        <button type="submit" disabled={saving}>{saving ? "포획함에 저장하는 중…" : "계속하기"}</button>
      </form>
    </section>
  </div>;
}
