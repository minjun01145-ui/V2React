import type { StudentIdentity } from "../../../auth/types.ts";
import { findCharacter } from "../../../characters/catalog.ts";
import { usePokemonCatchData } from "../../../student-data/pokemon-catch/usePokemonCatchData.ts";
import { useStudentCharacter } from "../../../student-data/cosmetics/StudentCharacterProvider.tsx";
import type { EquippedPokemonAvatar } from "../../../student-data/cosmetics/types.ts";
import type { NicknameGrade, PlayerAvatar } from "../../../multiplayer/types.ts";
import { displayLabel } from "../../../multiplayer/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import Avatar from "../../../shared/ui/Avatar.tsx";
import CharacterShopDialog from "./CharacterShopDialog.tsx";
import NicknameChangeButton from "../profile/NicknameChangeButton.tsx";
import styles from "./CharacterShop.module.css";

interface Props {
  readonly identity: Pick<StudentIdentity, "uid" | "studentNumber" | "displayName">;
  readonly roomId: string;
  readonly nickname: string | null;
  readonly nicknameGrade: NicknameGrade | null;
  readonly initialAvatar: PlayerAvatar | null;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}

export default function CharacterShop({ identity, roomId, nickname, nicknameGrade, initialAvatar, open, onOpen, onClose }: Props) {
  const { cosmetics, balance, loading, error, equipStudentCharacter, equipCapturedPokemon, reload } = useStudentCharacter();
  const pokemonData = usePokemonCatchData(identity);
  const equippedAvatar = cosmetics.equippedAvatar;
  const displayedAvatar = loading || error ? initialAvatar : equippedAvatar;
  const equippedCharacter = displayedAvatar?.kind === "character" ? findCharacter(displayedAvatar.characterId) : null;
  const equippedPokemon = displayedAvatar?.kind === "pokemon" ? displayedAvatar : null;
  const equippedName = displayedAvatar?.kind === "maple" ? "내 코디" : equippedCharacter?.name ?? equippedPokemon?.name ?? null;
  const hasVisibleAvatar = Boolean(displayedAvatar);
  const currentNickname = displayLabel(identity.displayName, nickname);

  const equipCharacter = async (characterId: string): Promise<void> => {
    await equipStudentCharacter(characterId);
  };

  const equipPokemon = async (pokemon: EquippedPokemonAvatar): Promise<void> => {
    await equipCapturedPokemon(pokemon);
  };

  return (
    <>
      <section className={styles.profile} aria-labelledby="student-profile-title">
        <div className={styles.profileStage} data-empty={hasVisibleAvatar ? undefined : "true"}>
          {hasVisibleAvatar ? <Avatar avatar={displayedAvatar} label={equippedName ?? "내 캐릭터"} /> : null}
          {!hasVisibleAvatar ? <span className={styles.emptyAvatar} aria-hidden="true">?</span> : null}
        </div>

        <div className={styles.profileDetails}>
          <div className={styles.nameRow}>
            {nicknameGrade ? <span className={styles.nicknameGrade} data-grade={nicknameGrade}>{nicknameGrade}</span> : null}
            <h2 className={styles.profileTitle} id="student-profile-title" title={currentNickname}>{currentNickname}</h2>
            <NicknameChangeButton
              roomId={roomId}
              playerId={identity.uid}
              displayName={identity.displayName}
              nickname={nickname}
              nicknameGrade={nicknameGrade}
            />
          </div>
          {nickname ? <p className={styles.realName}>본명 {identity.displayName}</p> : null}
          <dl className={styles.equippedInfo}>
            <div>
              <dt>장착 캐릭터</dt>
              <dd title={equippedName ?? undefined}>{loading && !hasVisibleAvatar ? "불러오는 중…" : equippedName ?? "미설정"}</dd>
            </div>
            <div><dt>V2코인</dt><dd>{balance === null ? "확인 중…" : balance.toLocaleString()}</dd></div>
          </dl>
        </div>

        <div className={styles.profileAction}>
          <Button onClick={onOpen}>캐릭터 상점</Button>
          {error ? <Button size="sm" variant="ghost" onClick={reload}>다시 불러오기</Button> : null}
        </div>
      </section>
      {error ? <p role="alert">{error.message}</p> : null}

      {open ? (
        <CharacterShopDialog
          open
          equippedAvatar={equippedAvatar}
          charactersLoading={loading}
          captures={pokemonData.captures}
          pokemonLoading={pokemonData.loading}
          error={error ?? pokemonData.error}
          onClose={onClose}
          onEquipCharacter={equipCharacter}
          onEquipPokemon={equipPokemon}
        />
      ) : null}
    </>
  );
}
