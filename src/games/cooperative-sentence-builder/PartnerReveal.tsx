import type { RevealedPartner } from "../../multiplayer/cooperative/types.ts";
import Avatar from "../../shared/ui/Avatar.tsx";
import styles from "./CooperativeSentence.module.css";

export default function PartnerReveal({ partner }: { readonly partner: RevealedPartner }) {
  return <div className={styles.partner}>
    <div className={styles.partnerAvatar}>
      <Avatar avatar={partner.avatar} label={`${partner.nickname}의 캐릭터`} />
    </div>
    <strong>{partner.nickname}</strong>
  </div>;
}
