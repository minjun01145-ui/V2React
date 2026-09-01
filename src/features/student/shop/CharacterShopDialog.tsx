import { useEffect, useRef, useState } from "react";
import {
  CHARACTER_CATALOG,
  type CharacterCatalogItem,
} from "../../../characters/catalog.ts";
import Button from "../../../shared/ui/Button.tsx";
import CharacterPreview from "./CharacterPreview.tsx";
import styles from "./CharacterShop.module.css";

interface Props {
  readonly open: boolean;
  readonly equippedCharacterId: string | null;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly onClose: () => void;
  readonly onEquip: (characterId: string) => Promise<void>;
}

export default function CharacterShopDialog({
  open,
  equippedCharacterId,
  loading,
  error,
  onClose,
  onEquip,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busyCharacterId, setBusyCharacterId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) setMessage(null);
  }, [open]);

  const equip = async (character: CharacterCatalogItem): Promise<void> => {
    setBusyCharacterId(character.id);
    setMessage(null);
    try {
      await onEquip(character.id);
      setMessage(`${character.name} 캐릭터를 장착했습니다.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "장착 요청을 처리하지 못했습니다.");
    } finally {
      setBusyCharacterId(null);
    }
  };

  return (
    <dialog
      aria-labelledby="character-shop-title"
      className={styles.dialog}
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.shop}>
        <header className={styles.header}>
          <div>
            <p>CHARACTER SHOP</p>
            <h2 id="character-shop-title">캐릭터 상점</h2>
          </div>
          <button className={styles.close} type="button" aria-label="상점 닫기" onClick={onClose}>×</button>
        </header>

        {error ? <p className={styles.notice} role="alert">{error.message}</p> : null}
        {message ? <p className={styles.notice} role="status">{message}</p> : null}

        <div className={styles.grid} aria-busy={loading}>
          {CHARACTER_CATALOG.map((character) => {
            const equipped = equippedCharacterId === character.id;
            const busy = busyCharacterId === character.id;
            return (
              <article className={`${styles.item} ${equipped ? styles.equipped : ""}`} key={character.id}>
                <div className={styles.stage}>
                  {equipped ? <span className={styles.badge}>장착 중</span> : null}
                  <CharacterPreview character={character} />
                </div>
                <div className={styles.itemBody}>
                  <div>
                    <h3>{character.name}</h3>
                    <p>만든이 {character.creator}</p>
                  </div>
                  <Button
                    full
                    variant={equipped ? "ghost" : "primary"}
                    disabled={loading || Boolean(busyCharacterId) || equipped}
                    onClick={() => void equip(character)}
                  >
                    {busy ? "장착 중…" : equipped ? "장착 중" : "장착하기"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
