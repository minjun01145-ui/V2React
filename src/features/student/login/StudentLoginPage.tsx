import { useState, type ChangeEvent, type FormEvent } from "react";
import { completeStudentLogin, prepareStudentLogin } from "../../../auth/studentAuth.ts";
import type { StudentIdentity, StudentLoginChallenge } from "../../../auth/types.ts";
import { validateStudentPin } from "../../../auth/validation.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup, type PopupInputValues } from "../../../shared/popup/index.ts";
import BrandMark from "../../../shared/ui/BrandMark.tsx";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./StudentLoginPage.module.css";

interface Props {
  readonly roomId: string;
  readonly onAuthenticated: (identity: StudentIdentity) => void;
}

function teacherUrl(roomId: string): string {
  return `/teacher/?room=${encodeURIComponent(roomId)}`;
}

export default function StudentLoginPage({ roomId, onAuthenticated }: Props) {
  const [studentNumber, setStudentNumber] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { requestInput } = usePopup();

  const requestPin = async (challenge: StudentLoginChallenge): Promise<void> => {
    const setup = challenge.mode === "pin_setup";
    await requestInput({
      eyebrow: setup ? "FIRST LOGIN" : "STUDENT LOGIN",
      title: setup ? "숫자 4자리 비밀번호를 만들어요" : "비밀번호를 입력해 주세요",
      message: setup
        ? `${challenge.studentNumber} · ${challenge.displayName} 학생의 첫 로그인입니다. 다음 접속부터 사용할 숫자 4자리를 두 번 입력해 주세요.`
        : `${challenge.studentNumber} · ${challenge.displayName} 학생이 처음 정한 숫자 4자리를 입력해 주세요.`,
      tone: "info",
      blurBackground: true,
      closeOnBackdrop: false,
      closeOnEscape: true,
      confirmLabel: setup ? "비밀번호 만들고 입장" : "교실 입장",
      cancelLabel: "학번·이름 다시 입력",
      clearOnError: true,
      fields: [
        {
          name: "pin",
          label: setup ? "새 비밀번호" : "비밀번호",
          type: "password",
          inputMode: "numeric",
          autoComplete: setup ? "new-password" : "current-password",
          placeholder: "숫자 4자리",
          maxLength: 4,
          pattern: "[0-9０-９]{4}",
          autoFocus: true,
        },
        ...(setup ? [{
          name: "pinConfirmation",
          label: "비밀번호 확인",
          type: "password" as const,
          inputMode: "numeric" as const,
          autoComplete: "new-password",
          placeholder: "한 번 더 입력",
          maxLength: 4,
          pattern: "[0-9０-９]{4}",
        }] : []),
      ],
      validate: (values: PopupInputValues): string | null => {
        try {
          const pin = validateStudentPin(values.pin);
          if (setup && pin !== validateStudentPin(values.pinConfirmation)) return "두 비밀번호가 서로 다릅니다.";
          return null;
        } catch (value: unknown) {
          return toErrorMessage(value, "비밀번호는 숫자 4자리로 입력해 주세요.");
        }
      },
      onConfirm: async (values: PopupInputValues): Promise<string | null> => {
        try {
          const identity = await completeStudentLogin({
            studentNumber: challenge.studentNumber,
            name: challenge.name,
            pin: values.pin ?? "",
          });
          onAuthenticated(identity);
          return null;
        } catch (value: unknown) {
          return toErrorMessage(value, "학번, 이름 또는 비밀번호를 다시 확인해 주세요.");
        }
      },
    });
  };

  const submitIdentity = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const prepared = await prepareStudentLogin({ studentNumber, name });
      await requestPin(prepared);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학번과 이름을 다시 확인해 주세요."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.brand} href="/" aria-label="Jurye 홈">
          <BrandMark className={styles.brandMark} />
        </a>

        <div className={styles.loginPanel}>
          <form className={styles.form} onSubmit={(event) => void submitIdentity(event)}>
            <h2 id="login-title">수업에 참여해요</h2>
            <p className={styles.sub}>학번과 이름을 입력하면 비밀번호 창이 열려요.</p>

            <div className={styles.field}>
              <label htmlFor="student-number">학번</label>
              <input
                id="student-number"
                name="studentNumber"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                pattern="[0-9０-９]+"
                placeholder="예) 20315"
                value={studentNumber}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setStudentNumber(event.target.value)}
                disabled={submitting}
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="student-name">이름</label>
              <input
                id="student-name"
                name="name"
                autoComplete="name"
                maxLength={30}
                placeholder="이름"
                value={name}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                disabled={submitting}
                required
              />
            </div>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            <Button type="submit" full disabled={submitting}>{submitting ? "확인 중…" : "로그인"}</Button>
          </form>

          <a className={styles.adminLink} href={teacherUrl(roomId)}>교사용 관리자 페이지 →</a>
        </div>
      </div>
    </main>
  );
}
