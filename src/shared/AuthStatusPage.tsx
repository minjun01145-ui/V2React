import BrandMark from "./ui/BrandMark.tsx";
import styles from "./AuthStatusPage.module.css";

interface Props {
  readonly eyebrow: string;
  readonly title: string;
  readonly message: string;
  readonly error?: string;
}

export default function AuthStatusPage({ eyebrow, title, message, error }: Props) {
  return (
    <main className={styles.page}>
      <section className={styles.card} role={error ? "alert" : "status"}>
        <BrandMark className={styles.brandMark} />
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.message}>{message}</p>
        {error ? <p className={styles.error}>{error}</p> : <span className={styles.loader} aria-hidden="true" />}
        {error ? <a className={styles.homeLink} href="/">첫 화면으로 돌아가기</a> : null}
      </section>
    </main>
  );
}
