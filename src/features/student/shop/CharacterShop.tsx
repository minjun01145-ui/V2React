import { useEffect, useState } from "react";
import type { StudentIdentity } from "../../../auth/types.ts";
import { findCharacter } from "../../../characters/catalog.ts";
import { updatePlayerAvatar } from "../../../multiplayer/repository.ts";
import { usePokemonCatchData } from "../../../student-data/pokemon-catch/usePokemonCatchData.ts";
import { useStudentCosmetics } from "../../../student-data/cosmetics/useStudentCosmetics.ts";
import type { EquippedPokemonAvatar } from "../../../student-data/cosmetics/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import CharacterPreview from "./CharacterPreview.tsx";
import CharacterShopDialog from "./CharacterShopDialog.tsx";
import styles from "./CharacterShop.module.css";

interface Props {
  readonly identity: Pick<StudentIdentity, "uid" | "studentNumber">;
  readonly roomId: string;
}

export default function CharacterShop({ identity, roomId }: Props) {
  const [open, setOpen] = useState(false);
  const { cosmetics, loading, error, equipStudentCharacter, equipCapturedPokemon } = useStudentCosmetics(identity);
  const pokemonData = usePokemonCatchData(identity);
  const equippedAvatar = cosmetics.equippedAvatar;
  const equippedCharacter = equippedAvatar?.kind === "character" ? findCharacter(equippedAvatar.characterId) : null;
  const equippedPokemon = equippedAvatar?.kind === "pokemon" ? equippedAvatar : null;

  useEffect(() => {
    if (loading) return;
    void updatePlayerAvatar(roomId, identity.uid, equippedAvatar).catch(console.error);
  }, [equippedAvatar, identity.uid, loading, roomId]);

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
      <div className={styles.launcher}>
        {equippedCharacter ? (
          <div className={styles.currentCharacter}>
            <CharacterPreview character={equippedCharacter} size="small" />
            <span><small>장착 캐릭터</small><strong>{equippedCharacter.name}</strong></span>
          </div>
        ) : equippedPokemon ? (
          <div className={styles.currentCharacter}>
            <img className={styles.currentPokemon} src={equippedPokemon.spriteUrl} alt="" />
            <span><small>장착 포켓몬</small><strong>{equippedPokemon.name}</strong></span>
          </div>
        ) : <p className={styles.noCharacter}>아직 장착한 캐릭터가 없어요.</p>}
        <Button variant="ghost" onClick={() => setOpen(true)}>상점 보기</Button>
      </div>

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
