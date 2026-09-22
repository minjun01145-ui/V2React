import { useEffect, useRef, useState } from "react";
import { usePlayers } from "../../../multiplayer/hooks.ts";
import type { NicknameGrade } from "../../../multiplayer/types.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import {
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
  validateNickname,
} from "./nickname.ts";
import { pickRandomNickname } from "./randomNickname.ts";

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
  const { activePlayers, loading: playersLoading } = usePlayers(roomId);
  const activePlayersRef = useRef(activePlayers);
  const [busy, setBusy] = useState(false);
  const prompted = useRef(false);

  useEffect(() => {
    activePlayersRef.current = activePlayers;
  }, [activePlayers]);

  useEffect(() => {
    if (playersLoading || prompted.current || busy) return;
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
      const choice: NicknameChoice = values
        ? { nickname: normalizeNickname(values.nickname), nicknameGrade: null }
        : (() => {
            const usedNicknames = new Set(activePlayersRef.current.flatMap((player) => player.nickname ? [player.nickname] : []));
            const randomNickname = pickRandomNickname(usedNicknames);
            return { nickname: randomNickname.nickname, nicknameGrade: randomNickname.grade };
          })();
      if (!choice.nickname) return;
      setBusy(true);
      try {
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
  }, [busy, defaultDisplayName, onChooseNickname, playersLoading, popup, prompted]);

  return null;
}
