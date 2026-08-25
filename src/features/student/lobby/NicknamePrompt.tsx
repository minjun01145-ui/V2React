import { useEffect, useRef, useState } from "react";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import {
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
  validateNickname,
} from "./nickname.ts";
import styles from "./WaitingRoom.module.css";

interface Props {
  readonly defaultDisplayName: string;
  readonly onChooseNickname: (nickname: string | null) => Promise<void>;
}

export default function NicknamePrompt({ defaultDisplayName, onChooseNickname }: Props) {
  const popup = usePopup();
  const [busy, setBusy] = useState(false);
  const prompted = useRef(false);

  useEffect(() => {
    if (prompted.current || busy) return;
    prompted.current = true;
    void (async (): Promise<void> => {
      const values = await popup.requestInput({
        eyebrow: "대기실",
        title: "게임에서 사용할 닉네임을 써 주세요.",
        message: "이 닉네임은 이 대기실과 게임에서만 사용하는 임시 이름입니다. 본명은 그대로 보존돼요.",
        confirmLabel: "이 닉네임 사용하기",
        cancelLabel: "그냥 본명으로 하기",
        allowCancel: true,
        clearOnError: true,
        fields: [
          {
            name: "nickname",
            label: "닉네임",
            placeholder: defaultDisplayName,
            maxLength: NICKNAME_MAX_LENGTH,
            autoFocus: true,
            validate: (value) => validateNickname(value),
          },
        ],
        validate: (values) => validateNickname(values.nickname),
      });
      const nickname = values ? normalizeNickname(values.nickname) : null;
      setBusy(true);
      try {
        await onChooseNickname(nickname || null);
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, defaultDisplayName, onChooseNickname, popup, prompted]);

  return (
    <Card className={styles.card}>
      <h2 className={styles.sectionTitle}>닉네임 입력 대기 중</h2>
      <p className={styles.hint}>팝업 창에서 닉네임을 입력하거나 본명으로 입장할 수 있어요.</p>
      <Button variant="ghost" disabled>입장 준비 중…</Button>
    </Card>
  );
}