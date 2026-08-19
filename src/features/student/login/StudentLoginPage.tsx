import { useState, type ChangeEvent, type FormEvent } from "react";
import { claimStudentIdentity } from "../../../auth/studentAuth.ts";
import type { StudentIdentity } from "../../../auth/types.ts";
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const identity = await claimStudentIdentity({ studentNumber, name });
      onAuthenticated(identity);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학번과 이름을 다시 확인해 주세요."));
    } finally {
      setSubmitting(false);
    }
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
              친구들과 함께 풀고, 생각하고, 성장해요.<br />학번과 이름만 입력하면 바로 시작할 수 있어요.
            </p>
          </div>

          <div className={styles.features} aria-label="서비스 특징">
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">✓</span>
              <span><strong>간편한 입장</strong><small>학번과 이름이면 준비 끝</small></span>
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

          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            <div className={styles.roomBadge}>
              <span className={styles.liveDot} aria-hidden="true" />
              현재 수업 <strong>{roomId}</strong>
            </div>

            <div className={styles.formHeading}>
              <p>반가워요!</p>
              <h2 id="login-title">수업에 참여해요</h2>
              <span>내 정보를 입력하고 교실로 들어오세요.</span>
            </div>

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

            {error ? <p className={styles.error} role="alert"><span aria-hidden="true">!</span>{error}</p> : null}

            <button className={styles.submitButton} type="submit" disabled={submitting}>
              <span>{submitting ? "입장 정보를 확인하고 있어요" : "교실 입장하기"}</span>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </button>

            <p className={styles.formNote}>입력한 정보는 수업 참여 확인에만 사용됩니다.</p>
          </form>

          <a className={styles.adminLink} href={teacherUrl(roomId)}>
            <span aria-hidden="true">⌁</span> 교사용 관리자 페이지
          </a>
        </section>
      </div>
    </main>
  );
}
