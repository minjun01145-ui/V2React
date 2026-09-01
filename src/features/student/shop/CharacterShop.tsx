import { useState } from "react";
import type { StudentIdentity } from "../../../auth/types.ts";
import { findCharacter } from "../../../characters/catalog.ts";
import { useStudentCosmetics } from "../../../student-data/cosmetics/useStudentCosmetics.ts";
import Button from "../../../shared/ui/Button.tsx";
import CharacterPreview from "./CharacterPreview.tsx";
import CharacterShopDialog from "./CharacterShopDialog.tsx";
import styles from "./CharacterShop.module.css";

interface Props {
  readonly identity: Pick<StudentIdentity, "uid" | "studentNumber">;
}

export default function CharacterShop({ identity }: Props) {
  const [open, setOpen] = useState(false);
  const { cosmetics, loading, error, equip } = useStudentCosmetics(identity);
  const equippedCharacter = findCharacter(cosmetics.equippedCharacterId);

  return (
    <>
      <div className={styles.launcher}>
        {equippedCharacter ? (
          <div className={styles.currentCharacter}>
            <CharacterPreview character={equippedCharacter} size="small" />
            <span><small>장착 캐릭터</small><strong>{equippedCharacter.name}</strong></span>
          </div>
        ) : <p className={styles.noCharacter}>아직 장착한 캐릭터가 없어요.</p>}
        <Button variant="ghost" onClick={() => setOpen(true)}>상점 보기</Button>
      </div>

      <CharacterShopDialog
        open={open}
        equippedCharacterId={cosmetics.equippedCharacterId}
        loading={loading}
        error={error}
        onClose={() => setOpen(false)}
        onEquip={equip}
      />
    </>
  );
}
