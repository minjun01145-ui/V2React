import { useEffect, useRef, useState } from "react";
import { usePopup } from "../../../shared/popup/index.ts";
import {
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
  validateNickname,
} from "./nickname.ts";

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
        title: "게임에서 사용할 닉네임을 써 주세요.",
        message: "닉네임은 이 대기실과 게임에서만 쓰며 본명은 그대로 유지됩니다.",
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

  return null;
}
