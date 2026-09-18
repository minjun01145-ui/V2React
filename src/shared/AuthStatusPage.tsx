import BrandMark from "./ui/BrandMark.tsx";
import { tenantConfig, tenantConfigFromLocation, tenantHref } from "../tenant/config.ts";
import { PRIMARY_TENANT_ID } from "../tenant/scope.ts";
import styles from "./AuthStatusPage.module.css";

interface Props {
  readonly title: string;
  readonly message: string;
  readonly error?: string;
}

export default function AuthStatusPage({ title, message, error }: Props) {
  const tenant = tenantConfigFromLocation() ?? tenantConfig(PRIMARY_TENANT_ID);
  return (
    <main className={styles.page}>
      <section className={styles.card} role={error ? "alert" : "status"}>
        <BrandMark className={styles.brandMark} tenant={tenant} />
        <h1>{title}</h1>
        <p className={styles.message}>{message}</p>
        {error ? <p className={styles.error}>{error}</p> : <span className={styles.loader} aria-hidden="true" />}
        {error ? <a className={styles.homeLink} href={tenantHref("/", tenant.id)}>첫 화면으로 돌아가기</a> : null}
      </section>
    </main>
  );
}
