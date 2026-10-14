import { useEffect, useRef, useState } from "react";
import type { NicknameGrade } from "../../../multiplayer/types.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import {
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
  validateNickname,
} from "./nickname.ts";
import { ensureDailyRandomNickname } from "../../../student-data/random-nickname/repository.ts";

export interface NicknameChoice {
  readonly nickname: string;
  readonly nicknameGrade: NicknameGrade | null;
}

interface Props {
  readonly roomId: string;
  readonly defaultDisplayName: string;
  readonly onChooseNickname: (choice: NicknameChoice) => Promise<void>;
}

export default function NicknamePrompt({ roomId, defaultDisplayName, onChooseNickname }: Props) {
  const popup = usePopup();
  const [busy, setBusy] = useState(false);
  const prompted = useRef(false);

  useEffect(() => {
    if (prompted.current || busy) return;
    prompted.current = true;
    void (async (): Promise<void> => {
      const values = await popup.requestInput({
        title: "게임에서 사용할 닉네임을 써 주세요.",
        message: "직접 쓰거나 랜덤 음식 닉네임을 뽑을 수 있어요. 본명은 그대로 유지됩니다.",
        confirmLabel: "이 닉네임 사용하기",
        cancelLabel: "🎲 랜덤 닉네임 뽑기",
        allowCancel: true,
        closeOnEscape: false,
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
      setBusy(true);
      try {
        let choice: NicknameChoice;
        if (values) {
          choice = { nickname: normalizeNickname(values.nickname), nicknameGrade: null };
        } else {
          try {
            const roll = await ensureDailyRandomNickname(roomId);
            choice = { nickname: roll.nickname, nicknameGrade: roll.nicknameGrade };
          } catch (error: unknown) {
            prompted.current = false;
            await popup.showMessage({
              title: "랜덤 닉네임을 뽑지 못했어요",
              message: toErrorMessage(error, "잠시 후 다시 뽑아주세요."),
              tone: "error",
            });
            return;
          }
        }
        if (!choice.nickname) {
          prompted.current = false;
          return;
        }
        if (choice.nicknameGrade) {
          await popup.showMessage({
            title: `${choice.nicknameGrade}급 닉네임!`,
            message: `오늘의 랜덤 닉네임은 “${choice.nickname}”입니다.`,
            tone: choice.nicknameGrade === "S" ? "success" : "info",
            confirmLabel: "이 이름으로 입장하기",
          });
        }
        await onChooseNickname(choice);
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, defaultDisplayName, onChooseNickname, popup, prompted, roomId]);

  return null;
}
