import { updatePlayerNickname } from "../../../multiplayer/repository.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import {
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
  validateNickname,
} from "../lobby/nickname.ts";
import styles from "./NicknameChangeButton.module.css";

interface Props {
  readonly roomId: string;
  readonly playerId: string;
  readonly displayName: string;
  readonly nickname: string | null;
}

export default function NicknameChangeButton({ roomId, playerId, displayName, nickname }: Props) {
  const popup = usePopup();

  const changeNickname = async (): Promise<void> => {
    await popup.requestInput({
      title: "닉네임 바꾸기",
      message: "빈칸으로 저장하면 본명으로 표시됩니다.",
      confirmLabel: "변경하기",
      cancelLabel: "취소",
      fields: [{
        name: "nickname",
        label: "닉네임",
        placeholder: displayName,
        initialValue: nickname ?? "",
        maxLength: NICKNAME_MAX_LENGTH,
        required: false,
        autoFocus: true,
        validate: (value) => validateNickname(value),
      }],
      validate: (values) => validateNickname(values.nickname),
      onConfirm: async (values) => {
        const nextNickname = normalizeNickname(values.nickname) || null;
        if (nextNickname === nickname) return null;
        await updatePlayerNickname(roomId, playerId, nextNickname);
        return null;
      },
    });
  };

  return (
    <Button className={styles.button} variant="ghost" onClick={() => void changeNickname()}>
      닉네임 바꾸기
    </Button>
  );
}
