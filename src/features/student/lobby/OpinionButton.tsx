import { MAX_OPINION_LENGTH, type OpinionAuthor } from "../../../student-opinions/model.ts";
import { submitOpinion } from "../../../student-opinions/repository.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";

/**
 * Lets a student leave an opinion for the teacher. The popup only says what is true (the teacher's
 * screen does not show the author); it must never promise anonymity, since the author is recorded
 * and may be identified for student protection under the school's rules.
 */
export default function OpinionButton({ roomId, author }: { readonly roomId: string; readonly author: OpinionAuthor }) {
  const { requestInput, showMessage } = usePopup();

  const open = async (): Promise<void> => {
    const result = await requestInput({
      title: "의견 남기기",
      size: "large",
      message: <>
        <p>선생님께 하고 싶은 말을 자유롭게 남겨 주세요.</p>
        <p>선생님 화면에는 누가 썼는지 나오지 않아요.</p>
      </>,
      fields: [{ name: "text", label: "의견", multiline: true, maxLength: MAX_OPINION_LENGTH }],
      confirmLabel: "보내기",
      onConfirm: async (values) => {
        try {
          await submitOpinion(roomId, author, values.text ?? "");
          return null;
        } catch (cause: unknown) {
          return toErrorMessage(cause, "의견을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
      },
    });
    if (result) await showMessage({ title: "의견을 보냈어요", tone: "success" });
  };

  return <Button variant="ghost" full onClick={() => void open()}>의견 남기기</Button>;
}
