import logo from "./logo.png";
import type { TenantConfig } from "../../tenant/config.ts";
import styles from "./BrandMark.module.css";

interface Props {
  readonly className?: string | undefined;
  readonly tenant: TenantConfig;
}

export default function BrandMark({ className = "", tenant }: Props) {
  const classes = [styles.mark, className].filter(Boolean).join(" ");
  if (tenant.usePrimaryLogo) return <img className={classes} src={logo} alt={tenant.brandAlt} draggable="false" />;
  return <span className={`${classes} ${styles.textMark}`} aria-label={tenant.brandAlt}>{tenant.brandName}<small>V2R</small></span>;
}
