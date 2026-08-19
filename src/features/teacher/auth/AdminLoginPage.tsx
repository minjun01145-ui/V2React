import { useState, type ChangeEvent, type FormEvent } from "react";
import { signInAdmin } from "../../../auth/teacherAuth.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import BrandMark from "../../../shared/ui/BrandMark.tsx";
import styles from "./AdminLoginPage.module.css";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError("");
    try {
      await signInAdmin(password);
      setPassword("");
    } catch (value: unknown) {
      setPassword("");
      setError(toErrorMessage(value, "관리자 로그인에 실패했습니다."));
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className={styles.page}>
      <a className={styles.backLink} href="/"><span aria-hidden="true">←</span> 학생 화면으로 돌아가기</a>

      <section className={styles.panel} aria-labelledby="admin-login-title">
        <BrandMark className={styles.panelBrandMark} />
        <p className={styles.eyebrow}>TEACHER ACCESS</p>
        <h1 id="admin-login-title">관리자 로그인</h1>
        <p className={styles.description}>수업을 준비하고 진행하려면<br />관리자 비밀번호를 입력해 주세요.</p>

        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label htmlFor="admin-password">비밀번호</label>
          <div className={styles.passwordField}>
            <input
              id="admin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="관리자 비밀번호"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              disabled={working}
              required
              autoFocus
            />
            <button
              type="button"
              className={styles.visibilityButton}
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              aria-pressed={showPassword}
              disabled={working}
            >{showPassword ? "숨김" : "보기"}</button>
          </div>

          {error ? <p className={styles.error} role="alert"><span aria-hidden="true">!</span>{error}</p> : null}

          <button className={styles.submitButton} type="submit" disabled={working}>
            {working ? "확인하고 있어요" : "관리자 페이지 입장"}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className={styles.securityNote}>
          <span aria-hidden="true">✓</span>
          <p><strong>안전하게 보호됩니다</strong>비밀번호는 이 사이트나 브라우저에 저장되지 않습니다.</p>
        </div>
      </section>

      <p className={styles.footer}>JURYE CLASSROOM · ADMIN</p>
    </main>
  );
}
