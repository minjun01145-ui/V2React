import { findCharacter } from "../../characters/catalog.ts";
import type { RevealedPartner } from "../../multiplayer/cooperative/types.ts";
import { useCharacterStandFrame } from "../../shared/useCharacterStandFrame.ts";
import styles from "./CooperativeSentence.module.css";

export default function PartnerReveal({ partner }: { readonly partner: RevealedPartner }) {
  const character = partner.avatar?.kind === "character" ? findCharacter(partner.avatar.characterId) : null;
  const frame = useCharacterStandFrame(character?.standFrames ?? null);
  return <div className={styles.partner}>
    <div className={styles.partnerAvatar}>
      {frame ? <img src={frame} alt={`${partner.nickname}의 캐릭터`} /> : null}
      {partner.avatar?.kind === "pokemon" ? <img src={partner.avatar.spriteUrl} alt={`${partner.nickname}의 포켓몬`} /> : null}
      {!frame && partner.avatar?.kind !== "pokemon" ? <span>?</span> : null}
    </div>
    <strong>{partner.nickname}</strong>
  </div>;
}
