import { useEffect, useState } from "react";
import type { StudentIdentity } from "../../../auth/types.ts";
import { findCharacter } from "../../../characters/catalog.ts";
import { updatePlayerAvatar } from "../../../multiplayer/repository.ts";
import { usePokemonCatchData } from "../../../student-data/pokemon-catch/usePokemonCatchData.ts";
import { useStudentCosmetics } from "../../../student-data/cosmetics/useStudentCosmetics.ts";
import type { EquippedPokemonAvatar } from "../../../student-data/cosmetics/types.ts";
import type { PlayerAvatar } from "../../../multiplayer/types.ts";
import { displayLabel } from "../../../multiplayer/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import CharacterPreview from "./CharacterPreview.tsx";
import CharacterShopDialog from "./CharacterShopDialog.tsx";
import styles from "./CharacterShop.module.css";

interface Props {
  readonly identity: Pick<StudentIdentity, "uid" | "studentNumber" | "displayName">;
  readonly roomId: string;
  readonly nickname: string | null;
  readonly initialAvatar: PlayerAvatar | null;
}

export default function CharacterShop({ identity, roomId, nickname, initialAvatar }: Props) {
  const [open, setOpen] = useState(false);
  const { cosmetics, loading, error, equipStudentCharacter, equipCapturedPokemon } = useStudentCosmetics(identity);
  const pokemonData = usePokemonCatchData(identity);
  const equippedAvatar = cosmetics.equippedAvatar;
  const displayedAvatar = loading || error ? initialAvatar : equippedAvatar;
  const equippedCharacter = displayedAvatar?.kind === "character" ? findCharacter(displayedAvatar.characterId) : null;
  const equippedPokemon = displayedAvatar?.kind === "pokemon" ? displayedAvatar : null;
  const equippedName = equippedCharacter?.name ?? equippedPokemon?.name ?? null;
  const hasVisibleAvatar = Boolean(equippedCharacter || equippedPokemon);
  const currentNickname = displayLabel(identity.displayName, nickname);

  useEffect(() => {
    if (loading || error) return;
    void updatePlayerAvatar(roomId, identity.uid, equippedAvatar).catch(console.error);
  }, [equippedAvatar, error, identity.uid, loading, roomId]);

  const equipCharacter = async (characterId: string): Promise<void> => {
    await equipStudentCharacter(characterId);
    await updatePlayerAvatar(roomId, identity.uid, { kind: "character", characterId });
  };

  const equipPokemon = async (pokemon: EquippedPokemonAvatar): Promise<void> => {
    await equipCapturedPokemon(pokemon);
    await updatePlayerAvatar(roomId, identity.uid, pokemon);
  };

  return (
    <>
      <section className={styles.profile} aria-labelledby="student-profile-title">
        <div className={styles.profileStage} data-empty={hasVisibleAvatar ? undefined : "true"}>
          {equippedCharacter ? <CharacterPreview character={equippedCharacter} size="small" /> : null}
          {equippedPokemon ? (
            <img
              className={styles.currentPokemon}
              src={equippedPokemon.spriteUrl}
              alt={`${equippedPokemon.name} 포켓몬`}
              onError={(event) => {
                const fallback = equippedPokemon.fallbackSpriteUrl;
                if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
              }}
            />
          ) : null}
          {!hasVisibleAvatar ? <span className={styles.emptyAvatar} aria-hidden="true">?</span> : null}
        </div>

        <div className={styles.profileDetails}>
          <p className={styles.profileEyebrow}>내 프로필</p>
          <h2 className={styles.profileTitle} id="student-profile-title" title={currentNickname}>{currentNickname}</h2>
          {nickname ? <p className={styles.realName}>본명 {identity.displayName}</p> : <p className={styles.realName}>현재 닉네임으로 본명을 사용 중이에요.</p>}
          <dl className={styles.equippedInfo}>
            <div>
              <dt>장착 캐릭터</dt>
              <dd title={equippedName ?? undefined}>{loading && !hasVisibleAvatar ? "불러오는 중…" : equippedName ?? "미설정"}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.profileAction}>
          <Button variant="ghost" onClick={() => setOpen(true)}>캐릭터 바꾸기</Button>
        </div>
      </section>

      <CharacterShopDialog
        open={open}
        equippedAvatar={equippedAvatar}
        charactersLoading={loading}
        captures={pokemonData.captures}
        pokemonLoading={pokemonData.loading}
        error={error ?? pokemonData.error}
        onClose={() => setOpen(false)}
        onEquipCharacter={equipCharacter}
        onEquipPokemon={equipPokemon}
      />
    </>
  );
}
