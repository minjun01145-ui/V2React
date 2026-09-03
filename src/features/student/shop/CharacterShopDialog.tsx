import { useEffect, useRef, useState } from "react";
import { CHARACTER_CATALOG, type CharacterCatalogItem } from "../../../characters/catalog.ts";
import type { EquippedAvatar, EquippedPokemonAvatar } from "../../../student-data/cosmetics/types.ts";
import type { StoredCapturedPokemon } from "../../../student-data/pokemon-catch/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import CharacterPreview from "./CharacterPreview.tsx";
import styles from "./CharacterShop.module.css";

type ShopTab = "characters" | "pokemon";

interface Props {
  readonly open: boolean;
  readonly equippedAvatar: EquippedAvatar | null;
  readonly charactersLoading: boolean;
  readonly captures: readonly StoredCapturedPokemon[];
  readonly pokemonLoading: boolean;
  readonly error: Error | null;
  readonly onClose: () => void;
  readonly onEquipCharacter: (characterId: string) => Promise<void>;
  readonly onEquipPokemon: (pokemon: EquippedPokemonAvatar) => Promise<void>;
}

function CapturedPokemonImage({ pokemon }: { readonly pokemon: StoredCapturedPokemon }) {
  const [source, setSource] = useState(pokemon.spriteUrl);
  useEffect(() => setSource(pokemon.spriteUrl), [pokemon.spriteUrl]);
  return <img className={styles.pokemonSprite} src={source} alt={`${pokemon.nickname ?? pokemon.name} 포켓몬`} onError={() => {
    if (pokemon.fallbackSpriteUrl && source !== pokemon.fallbackSpriteUrl) setSource(pokemon.fallbackSpriteUrl);
  }} />;
}

export default function CharacterShopDialog({
  open, equippedAvatar, charactersLoading, captures, pokemonLoading, error,
  onClose, onEquipCharacter, onEquipPokemon,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<ShopTab>("characters");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) { setMessage(null); setTab("characters"); }
  }, [open]);

  const equipCharacter = async (character: CharacterCatalogItem): Promise<void> => {
    setBusyKey(`character:${character.id}`);
    setMessage(null);
    try {
      await onEquipCharacter(character.id);
      setMessage(`${character.name} 캐릭터를 장착했습니다.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "장착 요청을 처리하지 못했습니다.");
    } finally { setBusyKey(null); }
  };

  const equipPokemon = async (pokemon: StoredCapturedPokemon): Promise<void> => {
    setBusyKey(`pokemon:${pokemon.captureId}`);
    setMessage(null);
    try {
      await onEquipPokemon({
        kind: "pokemon", captureId: pokemon.captureId, name: pokemon.nickname ?? pokemon.name,
        spriteUrl: pokemon.spriteUrl, fallbackSpriteUrl: pokemon.fallbackSpriteUrl,
      });
      setMessage(`${pokemon.nickname ?? pokemon.name}을(를) 캐릭터로 장착했습니다.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "장착 요청을 처리하지 못했습니다.");
    } finally { setBusyKey(null); }
  };

  return <dialog aria-labelledby="character-shop-title" className={styles.dialog} ref={dialogRef} onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.shop}>
      <header className={styles.header}>
        <div><p>CHARACTER SHOP</p><h2 id="character-shop-title">캐릭터 상점</h2><span>원하는 캐릭터를 바로 장착할 수 있어요.</span></div>
        <button className={styles.close} type="button" aria-label="상점 닫기" onClick={onClose}>×</button>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="상점 목록">
        <button type="button" role="tab" aria-selected={tab === "characters"} onClick={() => setTab("characters")}>학생 캐릭터</button>
        <button type="button" role="tab" aria-selected={tab === "pokemon"} onClick={() => setTab("pokemon")}>잡은 포켓몬 <span>{captures.length}</span></button>
      </div>

      {error ? <p className={styles.notice} role="alert">{error.message}</p> : null}
      {message ? <p className={styles.notice} role="status">{message}</p> : null}

      {tab === "characters" ? <div className={styles.grid} aria-busy={charactersLoading} role="tabpanel">
        {CHARACTER_CATALOG.map((character) => {
          const equipped = equippedAvatar?.kind === "character" && equippedAvatar.characterId === character.id;
          const busy = busyKey === `character:${character.id}`;
          return <article className={`${styles.item} ${equipped ? styles.equipped : ""}`} key={character.id}>
            <div className={styles.stage}>{equipped ? <span className={styles.badge}>장착 중</span> : null}<CharacterPreview character={character} /></div>
            <div className={styles.itemBody}><div><h3>{character.name}</h3><p>만든이 {character.creator}</p></div>
              <Button full variant={equipped ? "ghost" : "primary"} disabled={charactersLoading || Boolean(busyKey) || equipped} onClick={() => void equipCharacter(character)}>{busy ? "장착 중…" : equipped ? "장착 중" : "장착하기"}</Button>
            </div>
          </article>;
        })}
      </div> : <div role="tabpanel" aria-busy={pokemonLoading}>
        {!pokemonLoading && captures.length === 0 ? <div className={styles.emptyPokemon}><strong>아직 잡은 포켓몬이 없어요.</strong><p>포켓몬 잡기 게임에서 포획하면 여기에 나타납니다.</p></div> : null}
        <div className={styles.grid}>{captures.map((pokemon) => {
          const equipped = equippedAvatar?.kind === "pokemon" && equippedAvatar.captureId === pokemon.captureId;
          const busy = busyKey === `pokemon:${pokemon.captureId}`;
          return <article className={`${styles.item} ${equipped ? styles.equipped : ""}`} key={pokemon.captureId}>
            <div className={`${styles.stage} ${styles.pokemonStage}`}>{equipped ? <span className={styles.badge}>장착 중</span> : null}<CapturedPokemonImage pokemon={pokemon} /></div>
            <div className={styles.itemBody}><div><h3>{pokemon.nickname ?? pokemon.name}</h3><p>{pokemon.nickname ? `${pokemon.name} · ` : ""}Lv.{pokemon.level}</p></div>
              <Button full variant={equipped ? "ghost" : "primary"} disabled={pokemonLoading || Boolean(busyKey) || equipped} onClick={() => void equipPokemon(pokemon)}>{busy ? "장착 중…" : equipped ? "장착 중" : "장착하기"}</Button>
            </div>
          </article>;
        })}</div>
      </div>}
    </div>
  </dialog>;
}
