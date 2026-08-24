import { useState, type ChangeEvent, type FormEvent } from "react";
import { completeStudentLogin, prepareStudentLogin } from "../../../auth/studentAuth.ts";
import type { StudentIdentity, StudentLoginChallenge } from "../../../auth/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import BrandMark from "../../../shared/ui/BrandMark.tsx";
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
  const [challenge, setChallenge] = useState<StudentLoginChallenge | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submitIdentity = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const prepared = await prepareStudentLogin({ studentNumber, name });
      setChallenge(prepared);
      setPin("");
      setPinConfirmation("");
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학번과 이름을 다시 확인해 주세요."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitPin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting || !challenge) return;
    if (challenge.mode === "pin_setup" && pin !== pinConfirmation) {
      setError("두 비밀번호가 서로 다릅니다.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const identity = await completeStudentLogin({
        studentNumber: challenge.studentNumber,
        name: challenge.name,
        pin,
      });
      onAuthenticated(identity);
    } catch (value: unknown) {
      setPin("");
      setPinConfirmation("");
      setError(toErrorMessage(value, "학번, 이름 또는 비밀번호를 다시 확인해 주세요."));
    } finally {
      setSubmitting(false);
    }
  };

  const backToIdentity = (): void => {
    if (submitting) return;
    setChallenge(null);
    setPin("");
    setPinConfirmation("");
    setError("");
  };

  return (
    <main className={styles.page}>
      <div className={styles.glowOne} aria-hidden="true" />
      <div className={styles.glowTwo} aria-hidden="true" />

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="landing-title">
          <a className={styles.brand} href="/" aria-label="Jurye Classroom 홈">
            <BrandMark />
            <span>JURYE CLASSROOM</span>
          </a>

          <div className={styles.introCopy}>
            <p className={styles.eyebrow}>PLAY · LEARN · GROW</p>
            <h1 id="landing-title">배움이 즐거워지는<br />우리 반 게임 교실</h1>
            <p className={styles.description}>
              친구들과 함께 풀고, 생각하고, 성장해요.<br />학번과 이름을 확인하고 나만의 4자리 비밀번호로 시작해요.
            </p>
          </div>

          <div className={styles.features} aria-label="서비스 특징">
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">✓</span>
              <span><strong>간편한 입장</strong><small>학번·이름·숫자 4자리</small></span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">↗</span>
              <span><strong>함께하는 수업</strong><small>실시간으로 참여하는 교실</small></span>
            </div>
          </div>

          <p className={styles.introFooter}>Designed for our classroom</p>
        </section>

        <section className={styles.loginArea} aria-labelledby="login-title">
          <div className={styles.mobileBrand}>
            <BrandMark className={styles.mobileBrandMark} />
            <span>JURYE CLASSROOM</span>
          </div>

          <form className={styles.form} onSubmit={(event) => void (challenge ? submitPin(event) : submitIdentity(event))}>
            <div className={styles.roomBadge}>
              <span className={styles.liveDot} aria-hidden="true" />
              현재 수업 <strong>{roomId}</strong>
            </div>

            <div className={styles.formHeading}>
              <p>{challenge ? `${challenge.displayName} 학생` : "반가워요!"}</p>
              <h2 id="login-title">{challenge?.mode === "pin_setup" ? "비밀번호를 만들어요" : challenge ? "비밀번호를 입력해요" : "수업에 참여해요"}</h2>
              <span>{challenge?.mode === "pin_setup" ? "처음 한 번만 사용할 숫자 4자리 비밀번호를 정해 주세요." : challenge ? "처음 접속할 때 정한 숫자 4자리를 입력해 주세요." : "학번과 이름을 먼저 확인할게요."}</span>
            </div>

            {challenge ? (
              <>
                <div className={styles.identitySummary}>
                  <span>확인된 학생</span>
                  <strong>{challenge.studentNumber} · {challenge.displayName}</strong>
                </div>
                <div className={styles.field}>
                  <label htmlFor="student-pin"><span>03</span> 숫자 4자리 비밀번호</label>
                  <input
                    id="student-pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete={challenge.mode === "pin_setup" ? "new-password" : "current-password"}
                    maxLength={4}
                    pattern="[0-9０-９]{4}"
                    placeholder="••••"
                    value={pin}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setPin(event.target.value)}
                    disabled={submitting}
                    required
                    autoFocus
                  />
                </div>
                {challenge.mode === "pin_setup" ? (
                  <div className={styles.field}>
                    <label htmlFor="student-pin-confirmation"><span>04</span> 비밀번호 확인</label>
                    <input
                      id="student-pin-confirmation"
                      name="pinConfirmation"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={4}
                      pattern="[0-9０-９]{4}"
                      placeholder="한 번 더 입력"
                      value={pinConfirmation}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setPinConfirmation(event.target.value)}
                      disabled={submitting}
                      required
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className={styles.field}>
                  <label htmlFor="student-number"><span>01</span> 학번</label>
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
                  <label htmlFor="student-name"><span>02</span> 이름</label>
                  <input
                    id="student-name"
                    name="name"
                    autoComplete="name"
                    maxLength={30}
                    placeholder="이름을 입력해 주세요"
                    value={name}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
              </>
            )}

            {error ? <p className={styles.error} role="alert"><span aria-hidden="true">!</span>{error}</p> : null}

            <button className={styles.submitButton} type="submit" disabled={submitting}>
              <span>{submitting ? "정보를 확인하고 있어요" : challenge?.mode === "pin_setup" ? "비밀번호 만들고 입장하기" : challenge ? "교실 입장하기" : "다음"}</span>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </button>

            {challenge ? <button className={styles.backButton} type="button" onClick={backToIdentity} disabled={submitting}>학번과 이름 다시 입력</button> : null}

            <p className={styles.formNote}>{challenge?.mode === "pin_setup" ? "비밀번호 원문은 저장하지 않으며, 잊어버리면 선생님이 초기화할 수 있습니다." : "입력한 정보는 수업 참여 확인에만 사용됩니다."}</p>
          </form>

          <a className={styles.adminLink} href={teacherUrl(roomId)}>
            <span aria-hidden="true">⌁</span> 교사용 관리자 페이지
          </a>
        </section>
      </div>
    </main>
  );
}
